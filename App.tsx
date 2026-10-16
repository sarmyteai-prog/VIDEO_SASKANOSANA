import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FooterBar } from './components/FooterBar';

export interface VideoComment {
  id: string;
  seconds: number;
  timecode: string;
  text: string;
  resolved: boolean;
  createdAt: number;
}

// Format seconds strictly as MM:SS (e.g., 04:12, 45:09)
export function formatMMSS(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00';
  const sec = Math.floor(totalSeconds);
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
}

// Parse MM:SS string into seconds
export function parseMMSS(tc: string): number | null {
  const clean = tc.trim();
  const match = clean.match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

// Extract Google Drive file ID or normalize cloud video URL
export function resolveVideoSource(input: string): {
  type: 'gdrive' | 'direct';
  streamUrl: string;
  embedUrl?: string;
  gdriveId?: string;
  key: string;
} {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      type: 'direct',
      streamUrl: '',
      key: 'default-session',
    };
  }

  // Check if it's a Google Drive URL or pure File ID
  const gdrivePatterns = [
    /\/file\/d\/([a-zA-Z0-9_-]{15,60})/,
    /[?&]id=([a-zA-Z0-9_-]{15,60})/,
    /\/d\/([a-zA-Z0-9_-]{15,60})/,
  ];

  for (const pattern of gdrivePatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const fileId = match[1];
      return {
        type: 'gdrive',
        gdriveId: fileId,
        streamUrl: `/api/gdrive?id=${encodeURIComponent(fileId)}`,
        embedUrl: `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`,
        key: `gd-${fileId}`,
      };
    }
  }

  // If user pasted a raw Google Drive file ID (25-50 chars, no slashes or dots)
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return {
      type: 'gdrive',
      gdriveId: trimmed,
      streamUrl: `/api/gdrive?id=${encodeURIComponent(trimmed)}`,
      embedUrl: `https://drive.google.com/file/d/${encodeURIComponent(trimmed)}/preview`,
      key: `gd-${trimmed}`,
    };
  }

  // Convert Dropbox share link to direct streaming URL
  if (trimmed.includes('dropbox.com')) {
    const directDropbox = trimmed
      .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
      .replace(/[?&]dl=0/, '')
      .replace(/[?&]dl=1/, '');
    return {
      type: 'direct',
      streamUrl: directDropbox,
      key: `url-${btoa(encodeURIComponent(trimmed)).slice(0, 24)}`,
    };
  }

  return {
    type: 'direct',
    streamUrl: trimmed,
    key: `url-${btoa(encodeURIComponent(trimmed)).slice(0, 24)}`,
  };
}

// Encode comments compactly for shareable URL hash
function encodeCommentsForUrl(comments: VideoComment[]): string {
  try {
    const compact = comments.map(c => [c.seconds, c.text, c.resolved ? 1 : 0]);
    return btoa(encodeURIComponent(JSON.stringify(compact)));
  } catch {
    return '';
  }
}

function decodeCommentsFromUrl(encoded: string): VideoComment[] | null {
  try {
    const json = decodeURIComponent(atob(encoded));
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return null;
    return arr.map((item: any, idx: number) => {
      const sec = Number(item[0]) || 0;
      return {
        id: `shared-${idx}-${Date.now()}`,
        seconds: sec,
        timecode: formatMMSS(sec),
        text: String(item[1] || ''),
        resolved: Boolean(item[2]),
        createdAt: Date.now() + idx,
      };
    });
  } catch {
    return null;
  }
}

const DEFAULT_DEMO_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

export const App: React.FC = () => {
  // Theme state: Studio Dark default for video editing comfort, with 1-click Nordic Matte Light toggle
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('kadrs_theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    localStorage.setItem('kadrs_theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Read initial parameters from URL (?gd=... or ?v=... & ?t=... & ?c=...)
  const initialParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const gd = params.get('gd');
    const v = params.get('v');
    const title = params.get('t') || localStorage.getItem('kadrs_last_title') || 'TV Melnā Montāža — Saskaņošana';
    const cParam = params.get('c');

    let rawVideoInput = '';
    if (gd) {
      rawVideoInput = `https://drive.google.com/file/d/${gd}/view`;
    } else if (v) {
      rawVideoInput = v;
    } else {
      rawVideoInput = localStorage.getItem('kadrs_last_video') || DEFAULT_DEMO_VIDEO;
    }

    return {
      rawVideoInput,
      title,
      sharedComments: cParam ? decodeCommentsFromUrl(cParam) : null,
    };
  }, []);

  const [projectTitle, setProjectTitle] = useState<string>(initialParams.title);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [videoInputUrl, setVideoInputUrl] = useState<string>(initialParams.rawVideoInput);
  const [activeVideoInput, setActiveVideoInput] = useState<string>(initialParams.rawVideoInput);
  const [localObjectUrl, setLocalObjectUrl] = useState<string | null>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [showSourcePanel, setShowSourcePanel] = useState<boolean>(false);

  // Fallback mode for Google Drive if direct stream is restricted/processing
  const [useGdriveEmbed, setUseGdriveEmbed] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  const resolvedSource = useMemo(() => {
    if (localObjectUrl) {
      return {
        type: 'direct' as const,
        streamUrl: localObjectUrl,
        key: `local-${localFileName || 'video'}`,
      };
    }
    return resolveVideoSource(activeVideoInput);
  }, [activeVideoInput, localObjectUrl, localFileName]);

  // Video player refs & playback state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [resumeAfterSubmit, setResumeAfterSubmit] = useState<boolean>(false);

  // Comment input & auto-locked timecode state
  const [commentText, setCommentText] = useState<string>('');
  const [lockedSeconds, setLockedSeconds] = useState<number | null>(null);
  const [manualTcInput, setManualTcInput] = useState<string>('');
  const [isEditingTc, setIsEditingTc] = useState<boolean>(false);
  const [wasAutoPaused, setWasAutoPaused] = useState<boolean>(false);

  // Comments list state
  const storageKey = `kadrs_comments_${resolvedSource.key}`;
  const [comments, setComments] = useState<VideoComment[]>(() => {
    if (initialParams.sharedComments && initialParams.sharedComments.length > 0) {
      return initialParams.sharedComments;
    }
    try {
      const saved = localStorage.getItem(`kadrs_comments_${resolveVideoSource(initialParams.rawVideoInput).key}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    // Default sample comments only if using the demo video for the first time
    if (initialParams.rawVideoInput === DEFAULT_DEMO_VIDEO) {
      return [
        {
          id: 'demo-1',
          seconds: 3,
          timecode: '00:03',
          text: 'Šeit nedaudz piegriezt ievada pauzi pirms pirmā teikuma',
          resolved: false,
          createdAt: Date.now() - 60000,
        },
        {
          id: 'demo-2',
          seconds: 9,
          timecode: '00:09',
          text: 'Pārbaudīt apakšējā titra vārdu un uzvārdu',
          resolved: true,
          createdAt: Date.now() - 30000,
        },
      ];
    }
    return [];
  });

  const [filterMode, setFilterMode] = useState<'all' | 'open' | 'resolved'>('all');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>('');

  // Copy feedback states
  const [copiedList, setCopiedList] = useState<boolean>(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState<boolean>(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  // Load comments when video source changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setComments(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    // Also check serverless session store
    fetch(`/api/comments?key=${encodeURIComponent(resolvedSource.key)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && Array.isArray(data.comments) && data.comments.length > 0) {
          setComments(data.comments);
        }
      })
      .catch(() => {});
  }, [storageKey, resolvedSource.key]);

  // Persist comments to LocalStorage & serverless store
  const saveComments = (updated: VideoComment[]) => {
    const sorted = [...updated].sort((a, b) => a.seconds - b.seconds || a.createdAt - b.createdAt);
    setComments(sorted);
    try {
      localStorage.setItem(storageKey, JSON.stringify(sorted));
    } catch {
      // ignore
    }
    fetch(`/api/comments?key=${encodeURIComponent(resolvedSource.key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments: sorted }),
    }).catch(() => {});
  };

  // Persist last video URL and title
  useEffect(() => {
    if (!localObjectUrl && activeVideoInput) {
      localStorage.setItem('kadrs_last_video', activeVideoInput);
    }
  }, [activeVideoInput, localObjectUrl]);

  useEffect(() => {
    localStorage.setItem('kadrs_last_title', projectTitle);
  }, [projectTitle]);

  // Handle typing in comment input: AUTO-PAUSE video & LOCK timecode (MM:SS)
  const handleCommentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    // The instant the user starts typing a comment, pause video & lock timecode!
    if (val.length > 0 && commentText.length === 0) {
      const vid = videoRef.current;
      const nowSec = Math.floor(vid ? vid.currentTime : currentTime);

      if (lockedSeconds === null) {
        setLockedSeconds(nowSec);
        setManualTcInput(formatMMSS(nowSec));
      }

      if (vid && !vid.paused) {
        vid.pause();
        setWasAutoPaused(true);
      }
    }

    // If user clears the input completely, unlock timecode so it follows playhead again
    if (val.length === 0) {
      setLockedSeconds(null);
      setWasAutoPaused(false);
    }

    setCommentText(val);
  };

  // Also pause & lock on focus if video is currently playing and user clicks into the input box
  const handleCommentInputFocus = () => {
    const vid = videoRef.current;
    if (vid && !vid.paused) {
      const nowSec = Math.floor(vid.currentTime);
      vid.pause();
      setWasAutoPaused(true);
      if (lockedSeconds === null) {
        setLockedSeconds(nowSec);
        setManualTcInput(formatMMSS(nowSec));
      }
    } else if (lockedSeconds === null && !useGdriveEmbed) {
      const nowSec = Math.floor(vid ? vid.currentTime : currentTime);
      setLockedSeconds(nowSec);
      setManualTcInput(formatMMSS(nowSec));
    }
  };

  // Add comment on Enter or button click
  const handleAddComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed) return;

    let targetSec = lockedSeconds !== null ? lockedSeconds : Math.floor(videoRef.current?.currentTime ?? currentTime);
    if (isEditingTc || useGdriveEmbed) {
      const parsed = parseMMSS(manualTcInput);
      if (parsed !== null) {
        targetSec = parsed;
      }
    }

    const newComment: VideoComment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      seconds: targetSec,
      timecode: formatMMSS(targetSec),
      text: trimmed,
      resolved: false,
      createdAt: Date.now(),
    };

    const next = [...comments, newComment];
    saveComments(next);

    setCommentText('');
    setLockedSeconds(null);
    setIsEditingTc(false);
    setWasAutoPaused(false);
    setActiveCommentId(newComment.id);

    if (resumeAfterSubmit && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  // Seek video to specific second when clicking a comment's timecode
  const seekToSeconds = (sec: number, commentId?: string) => {
    if (commentId) setActiveCommentId(commentId);
    setCurrentTime(sec);
    setLockedSeconds(sec);
    setManualTcInput(formatMMSS(sec));

    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.pause();
    }
  };

  // Toggle resolved status ("Atzīmēt kā izlabotu")
  const toggleCommentResolved = (id: string) => {
    const next = comments.map(c => (c.id === id ? { ...c, resolved: !c.resolved } : c));
    saveComments(next);
  };

  // Delete comment
  const deleteComment = (id: string) => {
    const next = comments.filter(c => c.id !== id);
    saveComments(next);
  };

  // Save edited comment text
  const saveEditedComment = (id: string) => {
    const trimmed = editingCommentText.trim();
    if (!trimmed) return;
    const next = comments.map(c => (c.id === id ? { ...c, text: trimmed } : c));
    saveComments(next);
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  // Clear all resolved or all comments
  const clearResolvedComments = () => {
    const next = comments.filter(c => !c.resolved);
    saveComments(next);
  };

  // Copy comments list as clean plain text
  const copyCommentsAsText = () => {
    const listToCopy = filteredComments.length > 0 ? filteredComments : comments;
    if (listToCopy.length === 0) return;

    const lines = [
      `🎬 ${projectTitle}`,
      `──────────────────────────────`,
      ...listToCopy.map(c => `${c.resolved ? '[✓] ' : ''}${c.timecode} — ${c.text}`),
    ];

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 2500);
  };

  // Copy shareable editor URL (includes video source, project title, and encoded comments)
  const copyEditorShareLink = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    if (resolvedSource.type === 'gdrive' && resolvedSource.gdriveId) {
      url.searchParams.set('gd', resolvedSource.gdriveId);
    } else if (activeVideoInput && !localObjectUrl) {
      url.searchParams.set('v', activeVideoInput);
    }
    url.searchParams.set('t', projectTitle);
    if (comments.length > 0) {
      const encoded = encodeCommentsForUrl(comments);
      if (encoded) url.searchParams.set('c', encoded);
    }

    navigator.clipboard.writeText(url.toString());
    setCopiedShareUrl(true);
    setTimeout(() => setCopiedShareUrl(false), 2500);
  };

  // Apply new video source URL
  const handleApplyVideoSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoInputUrl.trim()) return;
    setLocalObjectUrl(null);
    setLocalFileName(null);
    setStreamError(null);
    setUseGdriveEmbed(false);
    setActiveVideoInput(videoInputUrl.trim());
    setShowSourcePanel(false);
  };

  // Handle local MP4 file selection
  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (localObjectUrl) {
      URL.revokeObjectURL(localObjectUrl);
    }
    const objUrl = URL.createObjectURL(file);
    setLocalObjectUrl(objUrl);
    setLocalFileName(file.name);
    setProjectTitle(file.name.replace(/\.[^/.]+$/, ''));
    setStreamError(null);
    setUseGdriveEmbed(false);
    setShowSourcePanel(false);
  };

  // Change playback speed
  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
  };

  // Step -5s / +5s
  const stepSeconds = (delta: number) => {
    if (!videoRef.current) return;
    const nextSec = Math.max(0, Math.min(duration || 99999, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = nextSec;
    setCurrentTime(nextSec);
    if (lockedSeconds !== null) {
      setLockedSeconds(Math.floor(nextSec));
      setManualTcInput(formatMMSS(nextSec));
    }
  };

  const filteredComments = useMemo(() => {
    if (filterMode === 'open') return comments.filter(c => !c.resolved);
    if (filterMode === 'resolved') return comments.filter(c => c.resolved);
    return comments;
  }, [comments, filterMode]);

  const resolvedCount = useMemo(() => comments.filter(c => c.resolved).length, [comments]);
  const displayTimecode = lockedSeconds !== null ? formatMMSS(lockedSeconds) : formatMMSS(currentTime);

  return (
    <div className={`min-h-screen flex flex-col justify-between transition-colors ${
      isDark
        ? 'bg-[#0B131E] text-[#E2ECF2]'
        : 'bg-[#E8EFF3] text-[#002C37]'
    }`}>
      {/* TOP BAR */}
      <header className={`border-b px-4 sm:px-6 py-3 transition-colors ${
        isDark
          ? 'bg-[#0F1A2A]/95 border-[#1E334A]'
          : 'bg-[#DFE8EE]/95 border-[#BACDD9]'
      }`}>
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Brand & Editable Project Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0E7C86] flex items-center justify-center text-white shadow-sm shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 4 20 12 6 20 6 4"/>
              </svg>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#0E7C86] dark:text-[#2DD4BF]">
                  KADRS • VIDEO SASKAŅOŠANA
                </span>
                {resolvedSource.type === 'gdrive' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0E7C86]/15 text-[#0E7C86] dark:text-[#2DD4BF] border border-[#0E7C86]/30">
                    Google Drive Mākonis 24/7
                  </span>
                )}
              </div>

              {isEditingTitle ? (
                <input
                  type="text"
                  value={projectTitle}
                  onChange={e => setProjectTitle(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={e => e.key === 'Enter' && setIsEditingTitle(false)}
                  autoFocus
                  className={`text-sm sm:text-base font-extrabold px-2 py-0.5 rounded-lg border outline-none ${
                    isDark
                      ? 'bg-[#16263B] border-[#2DD4BF] text-white'
                      : 'bg-[#EAF1F6] border-[#0E7C86] text-[#002C37]'
                  }`}
                />
              ) : (
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="group flex items-center gap-1.5 text-left truncate max-w-[260px] sm:max-w-[460px] cursor-pointer"
                  title="Klikšķini, lai mainītu epizodes / projekta nosaukumu"
                >
                  <h1 className={`text-sm sm:text-base font-extrabold truncate ${
                    isDark ? 'text-white' : 'text-[#002C37]'
                  }`}>
                    {projectTitle}
                  </h1>
                  <svg className="opacity-40 group-hover:opacity-100 transition-opacity shrink-0" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Right: Source button, Share Link button, Theme toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowSourcePanel(prev => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                showSourcePanel
                  ? 'bg-[#0E7C86] border-[#2DD4BF] text-white'
                  : isDark
                    ? 'bg-[#152336] border-[#243B56] text-[#CBD5E1] hover:border-[#2DD4BF] hover:text-white'
                    : 'bg-[#EAF1F6] border-[#BACDD9] text-[#002C37] hover:border-[#0E7C86]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span>Ielīmēt video saiti</span>
            </button>

            <button
              onClick={copyEditorShareLink}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex items-center gap-1.5 ${
                copiedShareUrl
                  ? 'bg-[#10B981] border-[#10B981] text-white'
                  : 'bg-[#0E7C86] hover:bg-[#096169] border-[#0E7C86] text-white shadow-xs'
              }`}
              title="Nokopēt tiešo saiti redaktoram (ar šo video un komentāriem)"
            >
              {copiedShareUrl ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span>Saite nokopēta!</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  <span>Kopēt saiti redaktoram</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsDark(prev => !prev)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-[#152336] border-[#243B56] text-[#2DD4BF] hover:bg-[#1C2F47]'
                  : 'bg-[#EAF1F6] border-[#BACDD9] text-[#002C37] hover:bg-[#D8E4EC]'
              }`}
              title={isDark ? 'Pārslēgt uz Nordic Matte gaišo režīmu' : 'Pārslēgt uz montāžas tumšo režīmu'}
              aria-label="Mainīt tēmu"
            >
              {isDark ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Video Source Bar */}
        {showSourcePanel && (
          <div className={`max-w-[1600px] mx-auto mt-3 p-4 rounded-2xl border transition-all ${
            isDark
              ? 'bg-[#132033] border-[#243B56]'
              : 'bg-[#EAF1F6] border-[#BACDD9]'
          }`}>
            <form onSubmit={handleApplyVideoSource} className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
              <div className="flex-1 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={projectTitle}
                  onChange={e => setProjectTitle(e.target.value)}
                  placeholder="Epizodes / projekta nosaukums..."
                  className={`sm:w-64 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-bold outline-none ${
                    isDark
                      ? 'bg-[#0B131E] border-[#243B56] focus:border-[#2DD4BF] text-white'
                      : 'bg-[#DFE8EE] border-[#BACDD9] focus:border-[#0E7C86] text-[#002C37]'
                  }`}
                />
                <input
                  type="text"
                  value={videoInputUrl}
                  onChange={e => setVideoInputUrl(e.target.value)}
                  placeholder="Ielīmē Google Drive saiti (Ikviens, kam ir saite), Dropbox vai tiešo .mp4 URL..."
                  className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-medium outline-none ${
                    isDark
                      ? 'bg-[#0B131E] border-[#243B56] focus:border-[#2DD4BF] text-white'
                      : 'bg-[#DFE8EE] border-[#BACDD9] focus:border-[#0E7C86] text-[#002C37]'
                  }`}
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#0E7C86] hover:bg-[#096169] text-white text-xs font-extrabold cursor-pointer transition-all"
                >
                  Ielādēt video
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={handleLocalFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    isDark
                      ? 'bg-[#192B42] border-[#2A4565] text-[#CBD5E1] hover:text-white'
                      : 'bg-[#DFE8EE] border-[#BACDD9] text-[#002C37] hover:border-[#0E7C86]'
                  }`}
                  title="Atvērt lokālu .mp4 failu no sava datora tūlītējai apskatei"
                >
                  Lokāls .mp4
                </button>
              </div>
            </form>

            <p className={`mt-2 text-[11px] leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-[#2C4A5E]'}`}>
              💡 <strong>24/7 Mākoņa straumēšanai:</strong> Iemet <code>.mp4</code> failu Google Drive vai Dropbox, uzliec piekļuvi <em>&ldquo;Ikviens, kam ir saite&rdquo; (Anyone with the link)</em>, ielīmē saiti šeit un nospied <strong>&ldquo;Kopēt saiti redaktoram&rdquo;</strong>. Redaktors varēs skatīties pa taisno pārlūkā bez faila lejupielādes pat tad, kad Tavs dators ir izslēgts.
            </p>
          </div>
        )}
      </header>

      {/* MAIN WORKSPACE: 2-Column Kollaborate.tv Layout */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* LEFT COLUMN: Clean Video Player + Single Comment Input Row (8 cols on desktop) */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            
            {/* VIDEO PLAYER CARD */}
            <div className={`rounded-2xl overflow-hidden border shadow-lg transition-colors ${
              isDark
                ? 'bg-[#070C14] border-[#1E334A]'
                : 'bg-[#0F1B29] border-[#BACDD9]'
            }`}>
              {/* Top Mini Status inside Player if Google Drive */}
              {resolvedSource.type === 'gdrive' && (
                <div className="flex items-center justify-between px-4 py-2 bg-[#0F1A2A] border-b border-[#1E334A] text-xs text-[#CBD5E1]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
                    <span className="font-semibold">
                      {useGdriveEmbed
                        ? 'Google Drive Iebūvētais Straumētājs (Bez ierobežojumiem)'
                        : 'Tiešais MP4 Mākoņa Pleijeris (Ar automātisku pauzi rakstot)'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setUseGdriveEmbed(prev => !prev);
                      setStreamError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#162740] hover:bg-[#1F3556] text-[#2DD4BF] font-bold text-[11px] border border-[#2DD4BF]/30 cursor-pointer transition-colors"
                  >
                    {useGdriveEmbed ? 'Pārslēgt uz Tiešo MP4 pleijeri' : 'Ja liels fails lēni lādējas → Drive Pleijeris'}
                  </button>
                </div>
              )}

              {/* Video Area (16:9) */}
              <div className="relative aspect-video w-full bg-black flex items-center justify-center">
                {resolvedSource.type === 'gdrive' && useGdriveEmbed && resolvedSource.embedUrl ? (
                  <iframe
                    src={resolvedSource.embedUrl}
                    className="w-full h-full border-0"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                    title={projectTitle}
                  />
                ) : (
                  <video
                    ref={videoRef}
                    src={resolvedSource.streamUrl}
                    className="w-full h-full object-contain bg-black"
                    controls
                    playsInline
                    preload="metadata"
                    onTimeUpdate={() => {
                      if (videoRef.current) {
                        setCurrentTime(videoRef.current.currentTime);
                      }
                    }}
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        setDuration(videoRef.current.duration || 0);
                        setStreamError(null);
                      }
                    }}
                    onPlay={() => {
                      setIsPlaying(true);
                      setWasAutoPaused(false);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onError={() => {
                      if (resolvedSource.type === 'gdrive') {
                        setStreamError('Fails ir ļoti liels vai Google Drive vēl apstrādā tiešo plūsmu.');
                        setUseGdriveEmbed(true);
                      } else {
                        setStreamError('Neizdevās ielādēt video no norādītās saites. Pārbaudi, vai saite ir publiska.');
                      }
                    }}
                  />
                )}

                {streamError && !useGdriveEmbed && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center">
                    <p className="text-sm font-bold text-amber-300 mb-3 max-w-md">{streamError}</p>
                    {resolvedSource.type === 'gdrive' && (
                      <button
                        onClick={() => setUseGdriveEmbed(true)}
                        className="px-4 py-2 rounded-xl bg-[#0E7C86] text-white text-xs font-extrabold cursor-pointer"
                      >
                        Atvērt Google Drive Iebūvētajā Pleijerī →
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Studio Timeline Marker Bar & Quick Transport Bar */}
              {!useGdriveEmbed && (
                <div className="px-4 py-2.5 bg-[#0C1624] border-t border-[#1E334A] flex flex-col gap-2">
                  {/* Interactive Comment Markers Bar */}
                  {duration > 0 && (
                    <div
                      className="relative h-2.5 w-full bg-[#192B42] rounded-full cursor-pointer group"
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        seekToSeconds(Math.floor(ratio * duration));
                      }}
                      title="Klikšķini, lai pārietu uz laika vietu"
                    >
                      {/* Progress Fill */}
                      <div
                        className="absolute top-0 left-0 bottom-0 bg-[#0E7C86] rounded-full pointer-events-none"
                        style={{ width: `${Math.min(100, (currentTime / duration) * 100)}%` }}
                      />
                      {/* Comment Dots on Timeline */}
                      {comments.map(c => {
                        const leftPct = Math.min(99.2, Math.max(0.5, (c.seconds / duration) * 100));
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={ev => {
                              ev.stopPropagation();
                              seekToSeconds(c.seconds, c.id);
                            }}
                            style={{ left: `${leftPct}%` }}
                            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-[#0C1624] transition-transform hover:scale-150 cursor-pointer ${
                              c.resolved ? 'bg-[#10B981]' : 'bg-[#F59E0B]'
                            }`}
                            title={`${c.timecode} — ${c.text}`}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Quick Studio Controls */}
                  <div className="flex items-center justify-between text-xs text-[#CBD5E1]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!videoRef.current) return;
                          if (videoRef.current.paused) videoRef.current.play();
                          else videoRef.current.pause();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#162740] hover:bg-[#1F3556] text-white font-bold cursor-pointer flex items-center gap-1"
                      >
                        {isPlaying ? '⏸ Pauze' : '▶ Atskaņot'}
                      </button>
                      <button
                        type="button"
                        onClick={() => stepSeconds(-5)}
                        className="px-2 py-1 rounded-lg bg-[#162740] hover:bg-[#1F3556] text-[#94A3B8] hover:text-white font-mono-tc font-bold cursor-pointer"
                        title="Atpakaļ 5 sekundes"
                      >
                        -5s
                      </button>
                      <button
                        type="button"
                        onClick={() => stepSeconds(5)}
                        className="px-2 py-1 rounded-lg bg-[#162740] hover:bg-[#1F3556] text-[#94A3B8] hover:text-white font-mono-tc font-bold cursor-pointer"
                        title="Uz priekšu 5 sekundes"
                      >
                        +5s
                      </button>
                      <button
                        type="button"
                        onClick={cyclePlaybackRate}
                        className="px-2 py-1 rounded-lg bg-[#162740] hover:bg-[#1F3556] text-[#2DD4BF] font-mono-tc font-bold cursor-pointer"
                        title="Mainīt atskaņošanas ātrumu"
                      >
                        {playbackRate}x
                      </button>
                    </div>

                    <div className="font-mono-tc font-bold text-xs text-[#E2ECF2]">
                      <span className="text-[#2DD4BF]">{formatMMSS(currentTime)}</span>
                      <span className="opacity-40 mx-1">/</span>
                      <span className="opacity-75">{formatMMSS(duration)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SINGLE COMMENT INPUT BAR (Directly under the player — Kollaborate.tv style) */}
            <form
              onSubmit={handleAddComment}
              className={`p-3 sm:p-4 rounded-2xl border shadow-md transition-all ${
                lockedSeconds !== null
                  ? isDark
                    ? 'bg-[#122236] border-[#2DD4BF] ring-2 ring-[#2DD4BF]/20'
                    : 'bg-[#EAF1F6] border-[#0E7C86] ring-2 ring-[#0E7C86]/20'
                  : isDark
                    ? 'bg-[#101C2E] border-[#1E334A]'
                    : 'bg-[#DFE8EE] border-[#BACDD9]'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                
                {/* Locked / Current Timecode Pill (MM:SS) */}
                <div className="flex items-center gap-2 shrink-0">
                  {isEditingTc || useGdriveEmbed ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E7C86] dark:text-[#2DD4BF]">
                        TC:
                      </span>
                      <input
                        type="text"
                        value={manualTcInput}
                        onChange={e => setManualTcInput(e.target.value)}
                        placeholder="MM:SS"
                        className={`w-20 px-2.5 py-2 rounded-xl font-mono-tc text-sm font-extrabold text-center border outline-none ${
                          isDark
                            ? 'bg-[#0B131E] border-[#2DD4BF] text-[#2DD4BF]'
                            : 'bg-[#E8EFF3] border-[#0E7C86] text-[#002C37]'
                        }`}
                        title="Ievadi laika kodu MM:SS (piem. 04:15)"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setManualTcInput(displayTimecode);
                        setIsEditingTc(true);
                      }}
                      className={`px-3 py-2 rounded-xl font-mono-tc text-sm font-extrabold flex items-center gap-1.5 border cursor-pointer transition-all ${
                        lockedSeconds !== null
                          ? 'bg-[#0E7C86] border-[#2DD4BF] text-white shadow-xs'
                          : isDark
                            ? 'bg-[#162740] border-[#243B56] text-[#2DD4BF]'
                            : 'bg-[#E8EFF3] border-[#BACDD9] text-[#0E7C86]'
                      }`}
                      title="Laika kods fiksējas automātiski, sākot rakstīt (klikšķini, ja vēlies ievadīt MM:SS ar roku)"
                    >
                      <span className={`w-2 h-2 rounded-full ${lockedSeconds !== null ? 'bg-amber-300 animate-pulse' : 'bg-[#2DD4BF]'}`} />
                      <span>{displayTimecode}</span>
                    </button>
                  )}

                  {wasAutoPaused && (
                    <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 sm:hidden">
                      ⏸ Auto-pauze
                    </span>
                  )}
                </div>

                {/* Single Comment Input Field */}
                <input
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onFocus={handleCommentInputFocus}
                  onChange={handleCommentInputChange}
                  placeholder="Sāc rakstīt komentāru — video automātiski nopauzēsies un piefiksēs laika kodu (MM:SS)..."
                  className={`flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium outline-none transition-all ${
                    isDark
                      ? 'bg-[#0B131E] border-[#243B56] focus:border-[#2DD4BF] text-white placeholder-[#64748B]'
                      : 'bg-[#E8EFF3] border-[#BACDD9] focus:border-[#0E7C86] text-[#002C37] placeholder-[#5B7687]'
                  }`}
                />

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#0E7C86] hover:bg-[#096169] disabled:opacity-40 text-white font-extrabold text-xs sm:text-sm transition-all cursor-pointer shrink-0 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>Pievienot</span>
                  <span className="text-[10px] opacity-80 font-mono-tc hidden sm:inline">↵</span>
                </button>
              </div>

              {/* Subtle Helper Row under Input */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  {lockedSeconds !== null ? (
                    <span className="text-[#0E7C86] dark:text-[#2DD4BF] font-bold flex items-center gap-1">
                      ⏸ Laika kods nofiksēts pie <strong className="font-mono-tc">{formatMMSS(lockedSeconds)}</strong>
                      <button
                        type="button"
                        onClick={() => {
                          const now = Math.floor(videoRef.current?.currentTime ?? currentTime);
                          setLockedSeconds(now);
                          setManualTcInput(formatMMSS(now));
                        }}
                        className="ml-1 underline opacity-80 hover:opacity-100 cursor-pointer"
                      >
                        (atjaunot uz pašreizējo sekundi)
                      </button>
                    </span>
                  ) : (
                    <span className={isDark ? 'text-[#94A3B8]' : 'text-[#2C4A5E]'}>
                      Tiklīdz sāksi rakstīt, pleijeris automātiski apstāsies un paņems precīzu <span className="font-mono-tc font-bold">MM:SS</span>.
                    </span>
                  )}
                </div>

                {!useGdriveEmbed && (
                  <label className={`flex items-center gap-1.5 cursor-pointer select-none font-semibold ${
                    isDark ? 'text-[#94A3B8] hover:text-white' : 'text-[#2C4A5E] hover:text-[#002C37]'
                  }`}>
                    <input
                      type="checkbox"
                      checked={resumeAfterSubmit}
                      onChange={e => setResumeAfterSubmit(e.target.checked)}
                      className="rounded accent-[#0E7C86]"
                    />
                    <span>Turpināt video pēc Enter</span>
                  </label>
                )}
              </div>
            </form>
          </div>

          {/* RIGHT COLUMN: Simple Timecoded Comments List (4 cols on desktop) */}
          <div className={`lg:col-span-4 rounded-2xl border shadow-lg flex flex-col lg:h-[calc(100vh-140px)] lg:min-h-[540px] lg:max-h-[780px] transition-colors ${
            isDark
              ? 'bg-[#101C2E] border-[#1E334A]'
              : 'bg-[#DFE8EE] border-[#BACDD9]'
          }`}>
            
            {/* Comments Header */}
            <div className={`p-4 border-b flex flex-col gap-3 ${
              isDark ? 'border-[#1E334A]' : 'border-[#BACDD9]'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className={`text-sm sm:text-base font-extrabold ${isDark ? 'text-white' : 'text-[#002C37]'}`}>
                    Komentāri
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold font-mono-tc ${
                    isDark
                      ? 'bg-[#162740] text-[#2DD4BF] border border-[#2DD4BF]/30'
                      : 'bg-[#EAF1F6] text-[#0E7C86] border border-[#BACDD9]'
                  }`}>
                    {resolvedCount}/{comments.length} izlaboti
                  </span>
                </div>

                {/* Copy List as Text Button */}
                <button
                  type="button"
                  onClick={copyCommentsAsText}
                  disabled={comments.length === 0}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 ${
                    copiedList
                      ? 'bg-[#10B981] border-[#10B981] text-white'
                      : isDark
                        ? 'bg-[#162740] border-[#2DD4BF]/40 text-[#2DD4BF] hover:bg-[#1E3454]'
                        : 'bg-[#EAF1F6] border-[#0E7C86]/40 text-[#0E7C86] hover:bg-[#E2ECF2]'
                  }`}
                  title="Nokopēt komentāru sarakstu kā tīru tekstu ar laika kodiem"
                >
                  {copiedList ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span>Nokopēts!</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      <span>Kopēt sarakstu</span>
                    </>
                  )}
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'all', label: `Visi (${comments.length})` },
                      { id: 'open', label: `Aktīvie (${comments.length - resolvedCount})` },
                      { id: 'resolved', label: `Izlabotie (${resolvedCount})` },
                    ] as const
                  ).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilterMode(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        filterMode === tab.id
                          ? 'bg-[#0E7C86] text-white'
                          : isDark
                            ? 'text-[#94A3B8] hover:text-white hover:bg-[#162740]'
                            : 'text-[#2C4A5E] hover:text-[#002C37] hover:bg-[#EAF1F6]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {resolvedCount > 0 && (
                  <button
                    type="button"
                    onClick={clearResolvedComments}
                    className="text-[11px] font-semibold text-rose-400 hover:underline cursor-pointer"
                    title="Dzēst visus kā izlabotus atzīmētos komentārus"
                  >
                    Notīrīt izlabotos
                  </button>
                )}
              </div>
            </div>

            {/* Comments List Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredComments.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-center px-6">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-3 ${
                    isDark ? 'bg-[#162740] text-[#2DD4BF]' : 'bg-[#EAF1F6] text-[#0E7C86]'
                  }`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <p className={`text-xs sm:text-sm font-bold mb-1 ${isDark ? 'text-[#E2ECF2]' : 'text-[#002C37]'}`}>
                    {comments.length === 0 ? 'Vēl nav pievienots neviens komentārs' : 'Šajā filtrā nav komentāru'}
                  </p>
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-[#2C4A5E]'}`}>
                    Skaties video un sāc rakstīt zem pleijera — video pats nopauzēsies un piefiksēs laika kodu.
                  </p>
                </div>
              ) : (
                filteredComments.map(c => {
                  const isNearPlayhead = !useGdriveEmbed && Math.abs(currentTime - c.seconds) < 1.5;
                  const isSelected = activeCommentId === c.id;

                  return (
                    <div
                      key={c.id}
                      className={`group p-3 rounded-xl border transition-all flex items-start gap-2.5 ${
                        c.resolved
                          ? isDark
                            ? 'bg-[#0C1624]/60 border-[#1E334A]/60 opacity-65'
                            : 'bg-[#E8EFF3]/70 border-[#BACDD9]/60 opacity-70'
                          : isNearPlayhead || isSelected
                            ? isDark
                              ? 'bg-[#162942] border-[#2DD4BF]/70 shadow-xs'
                              : 'bg-[#EAF1F6] border-[#0E7C86] shadow-xs'
                            : isDark
                              ? 'bg-[#142236] border-[#1F3550] hover:border-[#2DD4BF]/40'
                              : 'bg-[#EAF1F6] border-[#BACDD9] hover:border-[#0E7C86]/50'
                      }`}
                    >
                      {/* Checkbox: Mark as Resolved ("Atzīmēt kā izlabotu") */}
                      <button
                        type="button"
                        onClick={() => toggleCommentResolved(c.id)}
                        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                          c.resolved
                            ? 'bg-[#10B981] border-[#10B981] text-white'
                            : isDark
                              ? 'bg-[#0B131E] border-[#334E68] hover:border-[#2DD4BF]'
                              : 'bg-[#DFE8EE] border-[#8FA8B8] hover:border-[#0E7C86]'
                        }`}
                        title={c.resolved ? 'Atzīmēts kā izlabots (klikšķini, lai atgrieztu)' : 'Atzīmēt kā izlabotu'}
                      >
                        {c.resolved && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>

                      {/* Clickable Timecode Pill (MM:SS) — Jumps video to exact second */}
                      <button
                        type="button"
                        onClick={() => seekToSeconds(c.seconds, c.id)}
                        className={`px-2 py-0.5 rounded-lg font-mono-tc text-xs font-extrabold shrink-0 cursor-pointer transition-all border ${
                          c.resolved
                            ? isDark
                              ? 'bg-[#162740]/60 border-[#243B56] text-[#10B981]'
                              : 'bg-[#DFE8EE] border-[#BACDD9] text-[#059669]'
                            : 'bg-[#0E7C86] hover:bg-[#096169] border-[#2DD4BF]/40 text-white shadow-2xs'
                        }`}
                        title={`Pāriet uz ${c.timecode} (${c.seconds} sek.)`}
                      >
                        {c.timecode}
                      </button>

                      {/* Comment Text or Inline Edit */}
                      <div className="flex-1 min-w-0">
                        {editingCommentId === c.id ? (
                          <div className="flex flex-col gap-1.5">
                            <input
                              type="text"
                              value={editingCommentText}
                              onChange={e => setEditingCommentText(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEditedComment(c.id);
                                if (e.key === 'Escape') setEditingCommentId(null);
                              }}
                              autoFocus
                              className={`w-full px-2.5 py-1 rounded-lg border text-xs font-medium outline-none ${
                                isDark
                                  ? 'bg-[#0B131E] border-[#2DD4BF] text-white'
                                  : 'bg-[#DFE8EE] border-[#0E7C86] text-[#002C37]'
                              }`}
                            />
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => saveEditedComment(c.id)}
                                className="px-2 py-0.5 rounded bg-[#0E7C86] text-white text-[10px] font-bold cursor-pointer"
                              >
                                Saglabāt
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCommentId(null)}
                                className="px-2 py-0.5 rounded text-[10px] font-semibold opacity-70 hover:opacity-100 cursor-pointer"
                              >
                                Atcelt
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p
                            onClick={() => seekToSeconds(c.seconds, c.id)}
                            className={`text-xs sm:text-sm leading-snug break-words cursor-pointer ${
                              c.resolved
                                ? 'line-through opacity-75'
                                : isDark
                                  ? 'text-[#E2ECF2] font-medium'
                                  : 'text-[#002C37] font-medium'
                            }`}
                          >
                            {c.text}
                          </p>
                        )}
                      </div>

                      {/* Edit & Delete Actions on Hover */}
                      {editingCommentId !== c.id && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(c.id);
                              setEditingCommentText(c.text);
                            }}
                            className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer ${
                              isDark ? 'text-[#94A3B8] hover:text-white' : 'text-[#2C4A5E] hover:text-[#002C37]'
                            }`}
                            title="Rediģēt komentāru"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteComment(c.id)}
                            className="p-1 rounded text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                            title="Dzēst komentāru"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Standard Footer with EU Directives & Sarmyte Credit */}
        <FooterBar isDark={isDark} />
      </main>
    </div>
  );
};

export default App;
