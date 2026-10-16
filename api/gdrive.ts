import type { VercelRequest, VercelResponse } from '@vercel/node';

// Max chunk size per Range request (~3.5 MB) to stay safely under Vercel's 4.5 MB serverless payload limit
const CHUNK_SIZE = 3.5 * 1024 * 1024;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    return res.status(200).end();
  }

  const fileId = typeof req.query.id === 'string' ? req.query.id.trim() : '';
  if (!fileId || !/^[a-zA-Z0-9_-]{10,60}$/.test(fileId)) {
    return res.status(400).json({ error: 'Nederīgs Google Drive faila ID.' });
  }

  const rangeHeader = req.headers.range;
  let start = 0;
  let requestedEnd: number | null = null;

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      start = parseInt(match[1], 10);
      if (match[2]) {
        requestedEnd = parseInt(match[2], 10);
      }
    }
  }

  const end = requestedEnd !== null
    ? Math.min(requestedEnd, start + CHUNK_SIZE - 1)
    : start + CHUNK_SIZE - 1;

  const targetRange = `bytes=${start}-${end}`;

  try {
    let downloadUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;

    let upstream = await fetch(downloadUrl, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: {
        Range: targetRange,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    });

    const contentType = upstream.headers.get('content-type') || '';

    // If Google Drive returns an HTML confirmation page for very large files, extract uuid and retry
    if (contentType.includes('text/html') && req.method !== 'HEAD') {
      const html = await upstream.text();
      const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/);
      if (uuidMatch && uuidMatch[1]) {
        downloadUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t&uuid=${encodeURIComponent(uuidMatch[1])}`;
        upstream = await fetch(downloadUrl, {
          method: 'GET',
          headers: {
            Range: targetRange,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          },
          redirect: 'follow',
        });
      } else {
        return res.status(422).json({
          error: 'Google Drive pieprasa tiešo skatīšanos vai failam nav uzlikta piekļuve "Ikviens, kam ir saite".',
        });
      }
    }

    const finalContentType = upstream.headers.get('content-type') || 'video/mp4';
    if (finalContentType.includes('text/html')) {
      return res.status(422).json({
        error: 'Fails nav publiski pieejams tiešajai MP4 straumēšanai.',
      });
    }

    const contentRange = upstream.headers.get('content-range');
    const contentLength = upstream.headers.get('content-length');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', finalContentType.includes('octet-stream') ? 'video/mp4' : finalContentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    if (req.method === 'HEAD') {
      return res.status(upstream.status).end();
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return res.status(upstream.status === 206 ? 206 : 200).send(buffer);
  } catch (err: any) {
    return res.status(500).json({
      error: 'Kļūda straumējot no Google Drive',
      details: err?.message || 'Unknown error',
    });
  }
}
