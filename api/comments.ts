import type { VercelRequest, VercelResponse } from '@vercel/node';

interface StoredComment {
  id: string;
  seconds: number;
  timecode: string;
  text: string;
  author: string;
  resolved: boolean;
  createdAt: number;
}

// Warm-instance in-memory store keyed by video project key
const memoryStore = new Map<string, StoredComment[]>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const key = typeof req.query.key === 'string' ? req.query.key.trim() : '';
  if (!key) {
    return res.status(400).json({ error: 'Trūkst projekta atslēgas (key).' });
  }

  if (req.method === 'GET') {
    const comments = memoryStore.get(key) || [];
    return res.status(200).json({ comments });
  }

  if (req.method === 'POST') {
    const body = req.body;
    if (body && Array.isArray(body.comments)) {
      memoryStore.set(key, body.comments);
      return res.status(200).json({ ok: true, comments: body.comments });
    }
    return res.status(400).json({ error: 'Nederīgs komentāru formāts.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
