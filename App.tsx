import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FooterBar } from './components/FooterBar';

export interface VideoComment {
  id: string;
  seconds: number;
  endSeconds?: number;
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

// Format cut range as "MM:SS – MM:SS"
export function formatCutRange(startSec: number, endSec: number): string {
  const s = Math.min(startSec, endSec);
  const e = Math.max(startSec, endSec);
  return `${formatMMSS(s)} – ${formatMMSS(e)}`;
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
  type: 'empty' | 'gdrive' | 'direct';
  streamUrl: string;
  embedUrl?: string;
  gdriveId?: string;
  key: string;
} {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      type: 'empty',
      streamUrl: '',
      key: 'default-session',
    };
  }

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

  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return {
      type: 'gdrive',
      gdriveId: trimmed,
      streamUrl: `/api/gdrive?id=${encodeURIComponent(trimmed)}`,
      embedUrl: `https://drive.google.com/file/d/${encodeURIComponent(trimmed)}/preview`,
      key: `gd-${trimmed}`,
    };
  }

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

function encodeCommentsForUrl(comments: VideoComment[]): string {
  try {
    const compact = comments.map(c => [
      c.seconds,
      c.text,
      c.resolved ? 1 : 0,
      c.endSeconds && c.endSeconds > c.seconds ? c.endSeconds : 0,
    ]);
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
      const endSec = Number(item[3]) || 0;
      const hasCut = endSec > sec;
      return {
        id: `shared-${idx}-${Date.now()}`,
        seconds: sec,
        endSeconds: hasCut ? endSec : undefined,
        timecode: hasCut ? formatCutRange(sec, endSec) : formatMMSS(sec),
        text: String(item[1] || ''),
        resolved: Boolean(item[2]),
        createdAt: Date.now() + idx,
      };
    });
  } catch {
    return null;
  }
}

export const App: React.FC = () => {
  // Theme state: Studio Dark default for editing room comfort, 1-click Nordic Matte Light toggle
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

  // Read initial parameters from URL (if any) and clear any old saved videos
  const initialParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const gd = params.get('gd');
    const v = params.get('v');
    const cParam = params.get('c');

    // Clean out old stored Google Drive videos from localStorage
    try {
      localStorage.removeItem('kadrs_last_video');
    } catch {
      // ignore
    }

    let rawVideoInput = '';
    if (gd) {
      rawVideoInput = `https://drive.google.com/file/d/${gd}/view`;
    } else if (v) {
      rawVideoInput = v;
    }

    return {
      rawVideoInput,
      title: params.get('t') || 'Video labošana',
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
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

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

  // Comment input & In/Out timecode state (Direct In/Out, no mode switching)
  const [commentText, setCommentText] = useState<string>('');
  const [inSeconds, setInSeconds] = useState<number | null>(null);
  const [outSeconds, setOutSeconds] = useState<number | null>(null);
  const [manualInInput, setManualInInput] = useState<string>('');
  const [manualOutInput, setManualOutInput] = useState<string>('');
  const [isEditingIn, setIsEditingIn] = useState<boolean>(false);
  const [isEditingOut, setIsEditingOut] = useState<boolean>(false);
  const [wasAutoPaused, setWasAutoPaused] = useState<boolean>(false);

  // Accessibility live announcement state (WCAG 4.1.3 Status Messages)
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');

  // Undo buffer for deleted comments (Jakob Nielsen Heuristic #3: User control & freedom)
  const [undoSnapshot, setUndoSnapshot] = useState<{
    previousComments: VideoComment[];
    label: string;
  } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

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
    return [];
  });

  const [filterMode, setFilterMode] = useState<'all' | 'open' | 'resolved'>('all');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>('');

  const [copiedList, setCopiedList] = useState<boolean>(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  // TV Post-Production Rough Cut Calculations: Total cut duration & final broadcast runtime ("Gala raidījums")
  const totalCutSeconds = useMemo(() => {
    return comments.reduce((acc, c) => {
      if (c.endSeconds && c.endSeconds > c.seconds) {
        return acc + (c.endSeconds - c.seconds);
      }
      return acc;
    }, 0);
  }, [comments]);

  const finalDuration = Math.max(0, duration - totalCutSeconds);

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

  // Direct In & Out helpers (One-click, instant CUT on Out — zero extra clicks!)
  const setInToCurrent = () => {
    const vid = videoRef.current;
    const nowSec = Math.floor(vid ? vid.currentTime : currentTime);
    setInSeconds(nowSec);
    setManualInInput(formatMMSS(nowSec));
    setIsEditingIn(false);
    setLiveAnnouncement(`In sākums uzlikts: ${formatMMSS(nowSec)}`);
  };

  const setOutToCurrent = () => {
    const vid = videoRef.current;
    const nowSec = Math.floor(vid ? vid.currentTime : currentTime);
    const startSec = inSeconds !== null ? inSeconds : Math.max(0, nowSec - 5);
    const realStart = Math.min(startSec, nowSec);
    const realEnd = Math.max(startSec, nowSec);

    // Auto-pause video on Out
    if (vid && !vid.paused) {
      vid.pause();
      setWasAutoPaused(true);
    }

    const tcFormatted = formatCutRange(realStart, realEnd);
    const userText = commentText.trim();
    const textToSave = userText
      ? (userText.toUpperCase().startsWith('CUT') ? userText : `CUT ${userText}`)
      : 'CUT';

    const newComment: VideoComment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      seconds: realStart,
      endSeconds: realEnd,
      timecode: tcFormatted,
      text: textToSave,
      resolved: false,
      createdAt: Date.now(),
    };

    const next = [...comments, newComment];
    saveComments(next);

    // Immediately reset In/Out and clear comment box for zero extra actions
    setInSeconds(null);
    setOutSeconds(null);
    setManualInInput('');
    setManualOutInput('');
    setIsEditingIn(false);
    setIsEditingOut(false);
    setCommentText('');
    setActiveCommentId(newComment.id);
    setLiveAnnouncement(`Izgriezums ${tcFormatted} automātiski pievienots!`);

    if (resumeAfterSubmit && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const clearOut = () => {
    setOutSeconds(null);
    setManualOutInput('');
    setIsEditingOut(false);
    setCommentText('');
    setLiveAnnouncement('Out noņemts');
  };

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
    fetch(`/api/comments?key=${encodeURIComponent(resolvedSource.key)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && Array.isArray(data.comments) && data.comments.length > 0) {
          setComments(data.comments);
        }
      })
      .catch(() => {});
  }, [storageKey, resolvedSource.key]);

  useEffect(() => {
    try {
      localStorage.removeItem('kadrs_last_video');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('kadrs_last_title', projectTitle);
  }, [projectTitle]);

  // Global keyboard shortcuts when not typing in an input (Nielsen Heuristic #7: Efficiency of use)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (isInputFocused) return;

      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        if (videoRef.current) {
          e.preventDefault();
          if (videoRef.current.paused) videoRef.current.play().catch(() => {});
          else videoRef.current.pause();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        stepSeconds(-5);
      } else if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        stepSeconds(5);
      } else if (e.key === 'c' || e.key === 'C' || e.key === '/') {
        e.preventDefault();
        commentInputRef.current?.focus();
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setInToCurrent();
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setOutToCurrent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Handle typing in comment input: AUTO-PAUSE video immediately on any keystroke & LOCK In timecode
  const handleCommentInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    const vid = videoRef.current;
    // Auto-pause video unconditionally as soon as user types or edits text
    if (vid && !vid.paused) {
      vid.pause();
      setWasAutoPaused(true);
      const nowSec = Math.floor(vid.currentTime);
      if (inSeconds === null) {
        setInSeconds(nowSec);
        setManualInInput(formatMMSS(nowSec));
      }
      setLiveAnnouncement(`Video nopauzēts pie ${formatMMSS(nowSec)}.`);
    } else if (inSeconds === null && val.trim().length > 0) {
      const nowSec = Math.floor(vid ? vid.currentTime : currentTime);
      setInSeconds(nowSec);
      setManualInInput(formatMMSS(nowSec));
    }

    if (val.length === 0 && outSeconds === null) {
      setInSeconds(null);
      setWasAutoPaused(false);
    }

    setCommentText(val);
  };

  // Pause & lock In on focus if video is currently playing
  const handleCommentInputFocus = () => {
    const vid = videoRef.current;
    if (vid && !vid.paused) {
      const nowSec = Math.floor(vid.currentTime);
      vid.pause();
      setWasAutoPaused(true);
      if (inSeconds === null) {
        setInSeconds(nowSec);
        setManualInInput(formatMMSS(nowSec));
      }
      setLiveAnnouncement(`Video nopauzēts pie ${formatMMSS(nowSec)}.`);
    } else if (inSeconds === null && !useGdriveEmbed) {
      const nowSec = Math.floor(vid ? vid.currentTime : currentTime);
      setInSeconds(nowSec);
      setManualInInput(formatMMSS(nowSec));
    }
  };

  // Add comment on Enter or button click
  const handleAddComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed) return;

    let inSec = inSeconds !== null ? inSeconds : Math.floor(videoRef.current?.currentTime ?? currentTime);
    if (isEditingIn || (useGdriveEmbed && manualInInput)) {
      const parsedIn = parseMMSS(manualInInput);
      if (parsedIn !== null) inSec = parsedIn;
    }

    let outSec: number | null = outSeconds;
    if (outSeconds !== null && (isEditingOut || manualOutInput)) {
      const parsedOut = parseMMSS(manualOutInput);
      if (parsedOut !== null) outSec = parsedOut;
    }

    let targetSec: number;
    let targetEndSec: number | undefined = undefined;
    let tcFormatted: string;

    if (outSec !== null && outSec !== inSec) {
      const realStart = Math.min(inSec, outSec);
      const realEnd = Math.max(inSec, outSec);
      targetSec = realStart;
      targetEndSec = realEnd;
      tcFormatted = formatCutRange(realStart, realEnd);
    } else {
      targetSec = inSec;
      tcFormatted = formatMMSS(inSec);
    }

    const newComment: VideoComment = {
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      seconds: targetSec,
      endSeconds: targetEndSec,
      timecode: tcFormatted,
      text: trimmed,
      resolved: false,
      createdAt: Date.now(),
    };

    const next = [...comments, newComment];
    saveComments(next);

    setCommentText('');
    setInSeconds(null);
    setOutSeconds(null);
    setManualInInput('');
    setManualOutInput('');
    setIsEditingIn(false);
    setIsEditingOut(false);
    setWasAutoPaused(false);
    setActiveCommentId(newComment.id);
    setLiveAnnouncement(`Pievienots komentārs pie ${tcFormatted}.`);

    if (resumeAfterSubmit && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  // Seek video to specific second when clicking a comment's timecode
  const seekToSeconds = (sec: number, commentId?: string) => {
    if (commentId) setActiveCommentId(commentId);
    setCurrentTime(sec);
    setInSeconds(sec);
    setManualInInput(formatMMSS(sec));
    setOutSeconds(null);
    setManualOutInput('');

    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.pause();
    }
    setLiveAnnouncement(`Pārlēkts uz laika kodu ${formatMMSS(sec)}.`);
  };

  // Toggle resolved status ("Atzīmēt kā izlabotu")
  const toggleCommentResolved = (id: string) => {
    const target = comments.find(c => c.id === id);
    const next = comments.map(c => (c.id === id ? { ...c, resolved: !c.resolved } : c));
    saveComments(next);
    if (target) {
      setLiveAnnouncement(
        `Komentārs pie ${target.timecode} atzīmēts kā ${!target.resolved ? 'izlabots' : 'aktīvs'}.`
      );
    }
  };

  // Trigger Undo Toast helper
  const registerUndo = (previous: VideoComment[], label: string) => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }
    setUndoSnapshot({ previousComments: previous, label });
    undoTimerRef.current = window.setTimeout(() => {
      setUndoSnapshot(null);
    }, 6000);
  };

  const handleUndo = () => {
    if (!undoSnapshot) return;
    saveComments(undoSnapshot.previousComments);
    setLiveAnnouncement('Darbība atcelta, komentāri atjaunoti.');
    setUndoSnapshot(null);
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }
  };

  // Delete comment with Undo support
  const deleteComment = (id: string) => {
    const target = comments.find(c => c.id === id);
    registerUndo(comments, target ? `Komentārs (${target.timecode}) izdzēsts` : 'Komentārs izdzēsts');
    const next = comments.filter(c => c.id !== id);
    saveComments(next);
    setLiveAnnouncement('Komentārs izdzēsts. Pieejama atcelšana.');
  };

  // Save edited comment text
  const saveEditedComment = (id: string) => {
    const trimmed = editingCommentText.trim();
    if (!trimmed) return;
    const next = comments.map(c => (c.id === id ? { ...c, text: trimmed } : c));
    saveComments(next);
    setEditingCommentId(null);
    setEditingCommentText('');
    setLiveAnnouncement('Komentāra teksts saglabāts.');
  };

  // Clear all resolved comments with Undo support
  const clearResolvedComments = () => {
    registerUndo(comments, 'Izlabotie komentāri notīrīti');
    const next = comments.filter(c => !c.resolved);
    saveComments(next);
    setLiveAnnouncement('Izlabotie komentāri notīrīti.');
  };

  // Copy comments list as clean plain text
  const copyCommentsAsText = () => {
    const listToCopy = filteredComments.length > 0 ? filteredComments : comments;
    if (listToCopy.length === 0) return;

    const lines = [
      projectTitle,
      duration > 0 && totalCutSeconds > 0
        ? `Sākotnējais ilgums: ${formatMMSS(duration)} | Izgriezts: -${formatMMSS(totalCutSeconds)} (-${totalCutSeconds}s) | Gala raidījums: ${formatMMSS(finalDuration)}`
        : '',
      `──────────────────────────────`,
      ...listToCopy.map(c => `${c.resolved ? '[OK] ' : ''}${c.timecode} — ${c.text}`),
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedList(true);
    setLiveAnnouncement('Komentāru saraksts nokopēts starpliktuvē.');
  };


  const handleApplyVideoSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoInputUrl.trim()) return;
    setLocalObjectUrl(null);
    setLocalFileName(null);
    setStreamError(null);
    setUseGdriveEmbed(false);
    setActiveVideoInput(videoInputUrl.trim());
    setShowSourcePanel(false);
    setLiveAnnouncement('Jauns video avots ielādēts.');
  };

  const loadLocalFile = (file: File) => {
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
    setLiveAnnouncement(`Ielādēts lokālais fails ${file.name}.`);
  };

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadLocalFile(file);
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.mov') || file.name.endsWith('.webm'))) {
      loadLocalFile(file);
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextRate;
    }
  };

  const stepSeconds = (delta: number) => {
    if (!videoRef.current) return;
    const nextSec = Math.max(0, Math.min(duration || 99999, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = nextSec;
    setCurrentTime(nextSec);
    if (inSeconds !== null) {
      setInSeconds(Math.floor(nextSec));
      setManualInInput(formatMMSS(nextSec));
    }
  };

  const filteredComments = useMemo(() => {
    if (filterMode === 'open') return comments.filter(c => !c.resolved);
    if (filterMode === 'resolved') return comments.filter(c => c.resolved);
    return comments;
  }, [comments, filterMode]);

  const resolvedCount = useMemo(() => comments.filter(c => c.resolved).length, [comments]);
  const displayTimecode = inSeconds !== null ? formatMMSS(inSeconds) : formatMMSS(currentTime);
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const hasLoadedVideo = resolvedSource.type !== 'empty';

  return (
    <div className={`min-h-screen min-h-[100dvh] flex flex-col justify-between ui-fast ${
      isDark
        ? 'bg-[#0B131E] text-[#E8F0F6]'
        : 'bg-[#E8EFF3] text-[#002C37]'
    }`}>
      {/* Hidden File Input for Local MP4 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm"
        onChange={handleLocalFileChange}
        className="hidden"
      />

      {/* Skip to Main Content Link (WCAG 2.4.1 Bypass Blocks) */}
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-[#0E7C86] focus:text-white focus:font-extrabold focus:text-xs focus:shadow-lg"
      >
        Pāriet uz video pleijeri un komentāriem
      </a>

      {/* Screen Reader Status Live Region (WCAG 4.1.3) */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* TOP BAR (Operate Mode Header) */}
      <header className={`border-b px-4 sm:px-6 py-3 ui-fast ${
        isDark
          ? 'bg-[#0F1A2A]/95 border-[#1E334A]'
          : 'bg-[#DFE8EE]/95 border-[#B2C7D4]'
      }`}>
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Brand & Editable Project Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0E7C86] flex items-center justify-center text-white shadow-xs shrink-0" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 4 20 12 6 20 6 4"/>
              </svg>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0B626B] dark:text-[#2DD4BF]">
                  POSTQ PREVIEW
                </span>
              </div>

              {isEditingTitle ? (
                <input
                  type="text"
                  value={projectTitle}
                  onChange={e => setProjectTitle(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  onKeyDown={e => e.key === 'Enter' && setIsEditingTitle(false)}
                  aria-label="Projekta vai epizodes nosaukums"
                  autoFocus
                  className={`text-sm sm:text-base font-extrabold px-2.5 py-1 rounded-lg border ${
                    isDark
                      ? 'bg-[#16263B] border-[#2DD4BF] text-white'
                      : 'bg-[#EAF1F6] border-[#0E7C86] text-[#002C37]'
                  }`}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="group min-h-[36px] flex items-center gap-1.5 text-left truncate max-w-[250px] sm:max-w-[460px] cursor-pointer rounded-lg px-1 -ml-1"
                  title="Klikšķini, lai mainītu epizodes vai projekta nosaukumu"
                  aria-label={`Projekta nosaukums: ${projectTitle}. Klikšķini, lai rediģētu`}
                >
                  <h1 className={`text-sm sm:text-base font-extrabold truncate text-balance ${
                    isDark ? 'text-white' : 'text-[#002C37]'
                  }`}>
                    {projectTitle}
                  </h1>
                  <svg className="opacity-50 group-hover:opacity-100 ui-fast shrink-0" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Right: Upload Video button, Share Link button, Theme toggle (All >= 42px height) */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-extrabold bg-[#0E7C86] hover:bg-[#096169] text-white border border-[#0E7C86] ui-fast hover-lift cursor-pointer flex items-center gap-2 shadow-xs"
              title="Izvēlēties .mp4 video failu no sava datora"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span>Augšupielādēt video (.mp4)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDark(prev => !prev)}
              className={`min-w-[42px] min-h-[42px] flex items-center justify-center rounded-xl border ui-fast hover-lift cursor-pointer ${
                isDark
                  ? 'bg-[#152336] border-[#243B56] text-[#2DD4BF] hover:bg-[#1C2F47]'
                  : 'bg-[#EAF1F6] border-[#B2C7D4] text-[#002C37] hover:bg-[#D8E4EC]'
              }`}
              title={isDark ? 'Pārslēgt uz Nordic Matte gaišo režīmu' : 'Pārslēgt uz montāžas tumšo režīmu'}
              aria-label={isDark ? 'Pārslēgt uz gaišo režīmu' : 'Pārslēgt uz tumšo režīmu'}
            >
              {isDark ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE: 2-Column Kollaborate.tv Layout */}
      <main id="main-workspace" className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* LEFT COLUMN: Clean Video Player + Single Comment Input Row (8 cols on desktop) */}
          <section aria-label="Video atskaņotājs un jauna komentāra ievade" className="lg:col-span-8 flex flex-col gap-2.5">
            
            {/* VIDEO PLAYER CONTAINER */}
            <div className={`rounded-2xl overflow-hidden border shadow-lg ui-fast ${
              isDark
                ? 'bg-[#070C14] border-[#1E334A]'
                : 'bg-[#0F1B29] border-[#B2C7D4]'
            }`}>
              {/* Video Area (16:9) — Shows Intuitive Video Onboarding Dropzone when no video is loaded yet! */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleDropFile}
                className="relative aspect-video w-full bg-[#080F1A] flex items-center justify-center"
              >
                {!hasLoadedVideo ? (
                  /* PURE FILE UPLOAD & DRAG/DROP ZONE — NO LINK INPUTS */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full h-full p-6 sm:p-12 flex flex-col items-center justify-center text-center ui-fast cursor-pointer group ${
                      isDraggingFile
                        ? 'bg-[#0E7C86]/25 border-2 border-dashed border-[#2DD4BF]'
                        : 'bg-gradient-to-b from-[#0D1829] to-[#070C14] hover:bg-[#0E1A2E]'
                    }`}
                    title="Noklikšķini, lai izvēlētos video failu no datora"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-[#0E7C86]/20 border border-[#2DD4BF]/40 group-hover:scale-105 group-hover:border-[#2DD4BF] flex items-center justify-center text-[#2DD4BF] mb-4 shadow-lg ui-fast" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-2 text-balance">
                      Augšupielādē video
                    </h2>
                    <p className="max-w-[44ch] text-xs sm:text-sm text-[#9FB3C8] mb-6 leading-relaxed">
                      Ievelc savu <strong>.mp4</strong> vai <strong>.mov</strong> failu šeit vai noklikšķini, lai atvērtu no datora:
                    </p>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#0E7C86] hover:bg-[#096169] text-white font-extrabold text-xs sm:text-sm cursor-pointer ui-fast flex items-center gap-2 shadow-md hover-lift"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <span>Izvēlēties video failu no datora</span>
                    </button>
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <video
                      ref={videoRef}
                      src={resolvedSource.streamUrl}
                      className="w-full h-full object-contain bg-black"
                      controls
                      playsInline
                      preload="auto"
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
                    />

                    {/* Liels, skaidrs profesionāls TV Timecode augšējā kreisajā stūrī — tikai TC */}
                    <div
                      aria-label={`Pašreizējais laika kods ${formatMMSS(currentTime)}`}
                      className="absolute top-3 left-3 sm:top-5 sm:left-5 z-30 pointer-events-none select-none bg-black/85 backdrop-blur-md px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-white/20 shadow-2xl flex items-center justify-center"
                    >
                      <span className="font-mono-tc font-black text-2xl sm:text-3xl tracking-wider text-[#2DD4BF] drop-shadow-lg">
                        {formatMMSS(currentTime)}
                      </span>
                    </div>
                  </div>
                )}

                {streamError && !useGdriveEmbed && hasLoadedVideo && (
                  <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center">
                    <p className="text-sm font-bold text-amber-300 mb-4 max-w-md leading-relaxed">{streamError}</p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {resolvedSource.type === 'gdrive' && (
                        <button
                          type="button"
                          onClick={() => setUseGdriveEmbed(true)}
                          className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0E7C86] text-white text-xs font-extrabold cursor-pointer ui-fast"
                        >
                          Atvērt Google Drive Iebūvētajā Pleijerī →
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setStreamError(null);
                          fileInputRef.current?.click();
                        }}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-[#162740] border border-[#2A4565] text-white text-xs font-bold cursor-pointer ui-fast flex items-center gap-1.5"
                      >
                        <span>Izvēlēties citu .mp4 failu</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Studio Timeline Marker Bar & Quick Transport Bar */}
              {hasLoadedVideo && !useGdriveEmbed && (
                <div className="px-4 py-2.5 bg-[#0C1624] border-t border-[#1E334A] flex flex-col gap-2">
                  {/* GPU-Accelerated Interactive Comment Markers Scrubber Bar */}
                  {duration > 0 && (
                    <div
                      role="slider"
                      aria-label="Video laika līnija ar komentāru atzīmēm"
                      aria-valuemin={0}
                      aria-valuemax={Math.floor(duration)}
                      aria-valuenow={Math.floor(currentTime)}
                      aria-valuetext={formatMMSS(currentTime)}
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'ArrowLeft') stepSeconds(-5);
                        if (e.key === 'ArrowRight') stepSeconds(5);
                      }}
                      className="relative h-3 w-full bg-[#192B42] rounded-full cursor-pointer flex items-center"
                      onClick={e => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        seekToSeconds(Math.floor(ratio * duration));
                      }}
                      title="Klikšķini uz laika līnijas, lai pārietu uz konkrētu sekundi"
                    >
                      <div
                        className="absolute inset-0 bg-[#0E7C86] rounded-full origin-left pointer-events-none"
                        style={{ transform: `scaleX(${progressRatio})` }}
                      />

                      {/* Render Cut Ranges on the Scrubber */}
                      {comments.map(c => {
                        if (c.endSeconds && c.endSeconds > c.seconds && duration > 0) {
                          const startPct = Math.max(0, (c.seconds / duration) * 100);
                          const widthPct = Math.min(100 - startPct, ((c.endSeconds - c.seconds) / duration) * 100);
                          return (
                            <div
                              key={`range-${c.id}`}
                              onClick={ev => {
                                ev.stopPropagation();
                                seekToSeconds(c.seconds, c.id);
                              }}
                              style={{ left: `${startPct}%`, width: `${Math.max(1, widthPct)}%` }}
                              className={`absolute top-0 bottom-0 rounded-xs cursor-pointer border-x ui-fast ${
                                c.resolved
                                  ? 'bg-[#10B981]/30 border-[#10B981]'
                                  : 'bg-rose-500/50 border-rose-400 hover:bg-rose-500/70'
                              }`}
                              title={`${c.timecode} — ${c.text}`}
                            />
                          );
                        }
                        return null;
                      })}

                      {/* Live Cut Preview while outSeconds is active */}
                      {inSeconds !== null && outSeconds !== null && duration > 0 && (
                        (() => {
                          const s = Math.min(inSeconds, outSeconds);
                          const e = Math.max(inSeconds, outSeconds);
                          const startPct = Math.max(0, (s / duration) * 100);
                          const widthPct = Math.min(100 - startPct, ((e - s) / duration) * 100);
                          return (
                            <div
                              style={{ left: `${startPct}%`, width: `${Math.max(1.2, widthPct)}%` }}
                              className="absolute top-0 bottom-0 bg-rose-500/60 border-x-2 border-rose-300 pointer-events-none animate-pulse"
                            />
                          );
                        })()
                      )}

                      {/* Point Comment Markers */}
                      {comments.map(c => {
                        const leftPct = Math.min(99.2, Math.max(0.8, (c.seconds / duration) * 100));
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={ev => {
                              ev.stopPropagation();
                              seekToSeconds(c.seconds, c.id);
                            }}
                            style={{ left: `${leftPct}%` }}
                            aria-label={`Komentārs pie ${c.timecode}: ${c.text}`}
                            className={`hover-dot absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-[#0C1624] ui-fast cursor-pointer ${
                              c.resolved ? 'bg-[#10B981]' : c.endSeconds ? 'bg-rose-500' : 'bg-[#F59E0B]'
                            }`}
                            title={`${c.timecode} — ${c.text}`}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Quick Studio Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#E8F0F6]">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!videoRef.current) return;
                          if (videoRef.current.paused) videoRef.current.play();
                          else videoRef.current.pause();
                        }}
                        aria-label={isPlaying ? 'Pauzēt video (Space)' : 'Atskaņot video (Space)'}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#162740] hover:bg-[#1F3556] text-white font-bold cursor-pointer ui-fast flex items-center gap-1.5"
                      >
                        <span>{isPlaying ? '⏸ Pauze' : '▶ Atskaņot'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => stepSeconds(-5)}
                        aria-label="Atpakaļ 5 sekundes"
                        className="min-h-[38px] min-w-[42px] px-2.5 py-1.5 rounded-lg bg-[#162740] hover:bg-[#1F3556] text-[#CBD5E1] hover:text-white font-mono-tc font-bold cursor-pointer ui-fast"
                        title="Atpakaļ 5 sekundes (← vai J)"
                      >
                        -5s
                      </button>
                      <button
                        type="button"
                        onClick={() => stepSeconds(5)}
                        aria-label="Uz priekšu 5 sekundes"
                        className="min-h-[38px] min-w-[42px] px-2.5 py-1.5 rounded-lg bg-[#162740] hover:bg-[#1F3556] text-[#CBD5E1] hover:text-white font-mono-tc font-bold cursor-pointer ui-fast"
                        title="Uz priekšu 5 sekundes (→ vai L)"
                      >
                        +5s
                      </button>
                      <button
                        type="button"
                        onClick={cyclePlaybackRate}
                        aria-label={`Atskaņošanas ātrums ${playbackRate}x. Klikšķini, lai mainītu`}
                        className="min-h-[38px] min-w-[44px] px-2.5 py-1.5 rounded-lg bg-[#162740] hover:bg-[#1F3556] text-[#2DD4BF] font-mono-tc font-bold cursor-pointer ui-fast"
                        title="Mainīt atskaņošanas ātrumu (1x / 1.25x / 1.5x / 2x)"
                      >
                        {playbackRate}x
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="font-mono-tc font-bold text-xs sm:text-sm text-[#E8F0F6] flex items-center flex-wrap gap-1.5" aria-label="Pašreizējais laika kods un kopējais garums">
                        <span className="text-[#2DD4BF]">{formatMMSS(currentTime)}</span>
                        <span className="opacity-40 mx-0.5">/</span>
                        <span className="opacity-80">{formatMMSS(duration)}</span>
                        {totalCutSeconds > 0 && (
                          <span
                            className="ml-1 sm:ml-2 px-2 py-0.5 rounded-md bg-rose-950/80 border border-rose-500/50 text-rose-300 text-[11px] font-bold flex items-center gap-1.5"
                            title={`Kopā izgriezts -${formatMMSS(totalCutSeconds)} (-${totalCutSeconds}s). Gala raidījuma garums: ${formatMMSS(finalDuration)}`}
                          >
                            <span className="text-rose-400">-{formatMMSS(totalCutSeconds)}</span>
                            <span className="opacity-40">|</span>
                            <span className="text-white">Gala: {formatMMSS(finalDuration)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SINGLE COMMENT INPUT BAR (Direct In / Out on the same line — Zero window switching) */}
            <form
              onSubmit={handleAddComment}
              autoComplete="off"
              className={`p-3.5 sm:p-4 rounded-2xl border shadow-md ui-fast ${
                outSeconds !== null
                  ? 'bg-rose-950/20 border-rose-500 ring-2 ring-rose-500/20'
                  : inSeconds !== null
                    ? isDark
                      ? 'bg-[#122236] border-[#2DD4BF] ring-2 ring-[#2DD4BF]/20'
                      : 'bg-[#EAF1F6] border-[#0E7C86] ring-2 ring-[#0E7C86]/20'
                    : isDark
                      ? 'bg-[#101C2E] border-[#1E334A]'
                      : 'bg-[#DFE8EE] border-[#B2C7D4]'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                
                {/* IN & OUT BADGES (Directly on the same line) */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  
                  {/* IN Button */}
                  {isEditingIn ? (
                    <div className="flex items-center gap-1 bg-black/40 px-2.5 py-1 rounded-xl border border-[#2DD4BF] min-h-[44px]">
                      <span className="text-[10px] font-extrabold text-[#2DD4BF] uppercase">In:</span>
                      <input
                        type="text"
                        autoComplete="off"
                        value={manualInInput}
                        onChange={e => setManualInInput(e.target.value)}
                        onBlur={() => setIsEditingIn(false)}
                        onKeyDown={e => e.key === 'Enter' && setIsEditingIn(false)}
                        autoFocus
                        placeholder="MM:SS"
                        className="w-16 bg-transparent font-mono-tc font-extrabold text-white text-center focus:outline-hidden text-sm"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (inSeconds === null) {
                          setInToCurrent();
                        } else {
                          setManualInInput(formatMMSS(inSeconds));
                          setIsEditingIn(true);
                        }
                      }}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl font-mono-tc text-xs sm:text-sm font-extrabold flex items-center gap-1.5 border cursor-pointer ui-fast ${
                        inSeconds !== null
                          ? 'bg-[#0E7C86] border-[#2DD4BF] text-white shadow-xs'
                          : isDark
                            ? 'bg-[#162740] border-[#243B56] text-[#2DD4BF]'
                            : 'bg-[#E8EFF3] border-[#B2C7D4] text-[#0B626B]'
                      }`}
                      title="Sākums (In / I taustiņš). Klikšķini, lai rediģētu."
                    >
                      <span className="text-[10px] uppercase font-bold opacity-75">In:</span>
                      <span>{inSeconds !== null ? formatMMSS(inSeconds) : formatMMSS(currentTime)}</span>
                    </button>
                  )}

                  {/* OUT Button — Tiklīdz nospiež, automātiski pievienojas CUT komentārs bez liekām darbībām */}
                  <button
                    type="button"
                    onClick={setOutToCurrent}
                    className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-extrabold border cursor-pointer ui-fast flex items-center gap-1.5 shadow-xs ${
                      inSeconds !== null
                        ? 'bg-rose-600 hover:bg-rose-700 border-rose-400 text-white'
                        : isDark
                          ? 'bg-[#162740] hover:bg-[#1E3454] border-[#243B56] text-[#E8F0F6]'
                          : 'bg-[#E8EFF3] hover:bg-[#DDE7ED] border-[#B2C7D4] text-[#002C37]'
                    }`}
                    title={
                      inSeconds !== null
                        ? `Izgriezt no ${formatMMSS(inSeconds)} līdz šim brīdim (Out / O taustiņš) — uzreiz saglabā CUT!`
                        : 'Piefiksēt beigu punktu un uzreiz izgriezt (Out / O taustiņš)'
                    }
                  >
                    <span>+ Out</span>
                    {inSeconds !== null && (
                      <span className="px-1.5 py-0.5 rounded-md bg-black/40 font-mono-tc text-[11px] font-bold">
                        -{Math.max(0, Math.floor(currentTime) - inSeconds)}s
                      </span>
                    )}
                  </button>
                </div>

                {/* Comment Input */}
                <label htmlFor="comment-main-input" className="sr-only">
                  {outSeconds !== null ? 'Īsināšanas komentāra teksts' : 'Komentāra teksts'}
                </label>
                <input
                  id="comment-main-input"
                  name="comment_no_history"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  ref={commentInputRef}
                  type="text"
                  value={commentText}
                  onFocus={handleCommentInputFocus}
                  onKeyDown={e => {
                    if (e.key !== 'Enter' && e.key !== 'Escape') {
                      const vid = videoRef.current;
                      if (vid && !vid.paused) {
                        vid.pause();
                        setWasAutoPaused(true);
                        const nowSec = Math.floor(vid.currentTime);
                        if (inSeconds === null) {
                          setInSeconds(nowSec);
                          setManualInInput(formatMMSS(nowSec));
                        }
                      }
                    }
                  }}
                  onChange={handleCommentInputChange}
                  placeholder={
                    outSeconds !== null
                      ? `Ko izgriezt vai saīsināt no ${formatMMSS(inSeconds ?? currentTime)} līdz ${formatMMSS(outSeconds)}?`
                      : 'Sāc rakstīt komentāru — video automātiski nopauzēsies...'
                  }
                  className={`min-h-[44px] flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium ui-fast ${
                    isDark
                      ? 'bg-[#0B131E] border-[#243B56] focus:border-[#2DD4BF] text-white placeholder-[#7C93AB]'
                      : 'bg-[#E8EFF3] border-[#B2C7D4] focus:border-[#0E7C86] text-[#002C37] placeholder-[#4A677A]'
                  }`}
                />

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className={`min-h-[44px] px-5 py-2.5 rounded-xl disabled:opacity-40 text-white font-extrabold text-xs sm:text-sm ui-fast cursor-pointer shrink-0 flex items-center justify-center gap-1.5 shadow-xs ${
                    outSeconds !== null
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-[#0E7C86] hover:bg-[#096169]'
                  }`}
                >
                  <span>{outSeconds !== null ? 'Pievienot izgriezumu' : 'Pievienot'}</span>
                  <span className="text-xs opacity-85 font-mono-tc hidden sm:inline" aria-hidden="true">↵</span>
                </button>
              </div>

              {/* Options Row */}
              {!useGdriveEmbed && (
                <div className="mt-2 flex justify-end">
                  <label className={`min-h-[28px] flex items-center gap-2 cursor-pointer select-none text-xs font-semibold ${
                    isDark ? 'text-[#9FB3C8] hover:text-white' : 'text-[#153A54] hover:text-[#002C37]'
                  }`}>
                    <input
                      type="checkbox"
                      checked={resumeAfterSubmit}
                      onChange={e => setResumeAfterSubmit(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-[#0E7C86]"
                    />
                    <span>Turpināt video pēc Enter</span>
                  </label>
                </div>
              )}
            </form>
          </section>

          {/* RIGHT COLUMN: Clean Timecoded Comments Log (Zero Cards-in-Cards — Divide-Y Architecture) */}
          <aside
            aria-label="Laika kodu komentāru saraksts"
            className={`lg:col-span-4 rounded-2xl border shadow-lg flex flex-col lg:h-[calc(100dvh-135px)] lg:min-h-[540px] lg:max-h-[790px] overflow-hidden ui-fast ${
              isDark
                ? 'bg-[#101C2E] border-[#1E334A]'
                : 'bg-[#DFE8EE] border-[#B2C7D4]'
            }`}
          >
            
            {/* Comments Header */}
            <div className={`p-4 border-b flex flex-col gap-3 ${
              isDark ? 'border-[#1E334A] bg-[#0D1726]/60' : 'border-[#B2C7D4] bg-[#E8EFF3]/60'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className={`text-sm sm:text-base font-extrabold ${isDark ? 'text-white' : 'text-[#002C37]'}`}>
                    Komentāri
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold font-mono-tc ${
                    isDark
                      ? 'bg-[#162740] text-[#2DD4BF] border border-[#2DD4BF]/30'
                      : 'bg-[#EAF1F6] text-[#0B626B] border border-[#B2C7D4]'
                  }`}>
                    {resolvedCount}/{comments.length} izlaboti
                  </span>
                </div>

                {/* Copy List as Text Button (>= 40px touch target) */}
                <button
                  type="button"
                  onClick={copyCommentsAsText}
                  disabled={comments.length === 0}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold border ui-fast hover-lift cursor-pointer flex items-center gap-1.5 disabled:opacity-40 ${
                    copiedList
                      ? 'bg-[#10B981] border-[#10B981] text-white'
                      : isDark
                        ? 'bg-[#162740] border-[#2DD4BF]/40 text-[#2DD4BF] hover:bg-[#1E3454]'
                        : 'bg-[#EAF1F6] border-[#0E7C86]/40 text-[#0B626B] hover:bg-[#E2ECF2]'
                  }`}
                  title="Nokopēt komentāru sarakstu kā tīru tekstu ar laika kodiem"
                >
                  {copiedList ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span>Nokopēts!</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      <span>Kopēt sarakstu</span>
                    </>
                  )}
                </button>
              </div>

              {/* TV Rough Cut Statistics: Total Cut Duration & Final Broadcast Runtime */}
              {totalCutSeconds > 0 && (
                <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono-tc ui-fast ${
                  isDark
                    ? 'bg-rose-950/30 border-rose-500/40'
                    : 'bg-rose-50 border-rose-300'
                }`}>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-rose-400">Izgriežams kopā:</div>
                    <div className="font-extrabold text-xs sm:text-sm text-rose-500">
                      -{formatMMSS(totalCutSeconds)} <span className="text-[10px] font-normal opacity-75">(-{totalCutSeconds}s)</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-[#2DD4BF]">
                      Gala raidījums:
                    </div>
                    <div className="font-extrabold text-xs sm:text-sm text-[#2DD4BF]">
                      {formatMMSS(finalDuration)}
                    </div>
                  </div>
                </div>
              )}

              {/* Filter Tabs (Accessible >= 38px targets) */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1" role="tablist" aria-label="Komentāru filtri">
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
                      role="tab"
                      aria-selected={filterMode === tab.id}
                      onClick={() => setFilterMode(tab.id)}
                      className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold ui-fast cursor-pointer ${
                        filterMode === tab.id
                          ? 'bg-[#0E7C86] text-white shadow-2xs'
                          : isDark
                            ? 'text-[#9FB3C8] hover:text-white hover:bg-[#162740]'
                            : 'text-[#153A54] hover:text-[#002C37] hover:bg-[#EAF1F6]'
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
                    className="min-h-[38px] px-2 text-xs font-bold text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
                    title="Dzēst visus kā izlabotus atzīmētos komentārus"
                  >
                    Notīrīt izlabotos
                  </button>
                )}
              </div>
            </div>

            {/* Undo Banner (Jakob Nielsen Heuristic #3: User control and freedom) */}
            {undoSnapshot && (
              <div
                role="alert"
                className={`modal-enter px-4 py-2.5 border-b flex items-center justify-between gap-2 text-xs font-bold ${
                  isDark
                    ? 'bg-[#192D45] border-[#2DD4BF]/40 text-[#E8F0F6]'
                    : 'bg-[#EAF1F6] border-[#0E7C86]/40 text-[#002C37]'
                }`}
              >
                <span>{undoSnapshot.label}</span>
                <button
                  type="button"
                  onClick={handleUndo}
                  className="min-h-[34px] px-3 py-1 rounded-lg bg-[#0E7C86] hover:bg-[#096169] text-white font-extrabold cursor-pointer ui-fast"
                >
                  Atcelt (Undo)
                </button>
              </div>
            )}

            {/* Comments List Body — Zero Cards-in-Cards (Clean Divide-Y Rows) */}
            <div className={`flex-1 overflow-y-auto divide-y ${
              isDark ? 'divide-[#1E334A]' : 'divide-[#B2C7D4]'
            }`}>
              {filteredComments.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center px-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                    isDark ? 'bg-[#162740] text-[#2DD4BF]' : 'bg-[#EAF1F6] text-[#0B626B]'
                  }`} aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <p className={`text-sm font-extrabold mb-1 ${isDark ? 'text-[#E8F0F6]' : 'text-[#002C37]'}`}>
                    {comments.length === 0 ? 'Vēl nav pievienots neviens komentārs' : 'Šajā filtrā nav komentāru'}
                  </p>
                  <p className={`max-w-[38ch] text-xs leading-relaxed ${isDark ? 'text-[#9FB3C8]' : 'text-[#153A54]'}`}>
                    Skaties video un sāc rakstīt zem pleijera — video pats nopauzēsies un piefiksēs laika kodu.
                  </p>
                </div>
              ) : (
                filteredComments.map(c => {
                  const isNearPlayhead = !useGdriveEmbed && Math.abs(currentTime - c.seconds) < 1.5;
                  const isSelected = activeCommentId === c.id;
                  const isCutComment = Boolean(c.endSeconds && c.endSeconds > c.seconds) || c.text.trim().toUpperCase().startsWith('CUT');
                  const cutDiffSec = c.endSeconds && c.endSeconds > c.seconds ? (c.endSeconds - c.seconds) : null;

                  return (
                    <div
                      key={c.id}
                      className={`group px-3.5 py-3 ui-fast flex items-start gap-2.5 border-l-4 ${
                        c.resolved
                          ? isDark
                            ? 'border-l-[#10B981]/50 bg-[#0B1422]/40 opacity-75'
                            : 'border-l-[#059669]/50 bg-[#E8EFF3]/50 opacity-75'
                          : isCutComment
                            ? isDark
                              ? 'border-l-rose-500 bg-rose-950/25 hover:bg-rose-950/40 border-b border-b-rose-950/30'
                              : 'border-l-rose-500 bg-rose-50/85 hover:bg-rose-100/80 border-b border-b-rose-200/50'
                            : isNearPlayhead || isSelected
                              ? isDark
                                ? 'border-l-[#2DD4BF] bg-[#162942]'
                                : 'border-l-[#0E7C86] bg-[#EAF1F6]'
                              : isDark
                                ? 'border-l-transparent hover:bg-[#142236]'
                                : 'border-l-transparent hover:bg-[#E8EFF3]'
                      }`}
                    >
                      {/* Checkbox: Mark as Resolved (>= 38px hit wrapper for motor accessibility) */}
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={c.resolved}
                        aria-label={`Atzīmēt komentāru pie ${c.timecode} kā izlabotu`}
                        onClick={() => toggleCommentResolved(c.id)}
                        className="min-w-[38px] min-h-[38px] -ml-1 flex items-center justify-center shrink-0 cursor-pointer rounded-lg"
                        title={c.resolved ? 'Atzīmēts kā izlabots (klikšķini, lai atgrieztu)' : 'Atzīmēt kā izlabotu'}
                      >
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center ui-fast ${
                          c.resolved
                            ? 'bg-[#10B981] border-[#10B981] text-white'
                            : isCutComment
                              ? isDark
                                ? 'bg-[#0B131E] border-rose-500/60 group-hover:border-rose-400'
                                : 'bg-white border-rose-400 group-hover:border-rose-600'
                              : isDark
                                ? 'bg-[#0B131E] border-[#3E5A78] group-hover:border-[#2DD4BF]'
                                : 'bg-[#E8EFF3] border-[#7896A8] group-hover:border-[#0E7C86]'
                        }`}>
                          {c.resolved && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </span>
                      </button>

                      {/* Clickable Timecode Pill (MM:SS or Cut Range) — Sārtā krāsā priekš CUT */}
                      <button
                        type="button"
                        onClick={() => seekToSeconds(c.seconds, c.id)}
                        aria-label={`Pāriet uz laika kodu ${c.timecode}`}
                        className={`min-h-[38px] px-2.5 py-1 rounded-xl font-mono-tc text-xs font-extrabold shrink-0 cursor-pointer ui-fast border flex items-center gap-1.5 ${
                          c.resolved
                            ? isDark
                              ? 'bg-[#162740]/60 border-[#243B56] text-[#10B981]'
                              : 'bg-[#E8EFF3] border-[#B2C7D4] text-[#059669]'
                            : isCutComment
                              ? 'bg-rose-600 hover:bg-rose-700 border-rose-400 text-white shadow-xs'
                              : 'bg-[#0E7C86] hover:bg-[#096169] border-[#2DD4BF]/40 text-white shadow-2xs'
                        }`}
                        title={`Pāriet uz ${c.timecode} (${c.seconds} sek.)`}
                      >
                        <span>{c.timecode}</span>
                        {cutDiffSec !== null && (
                          <span className="px-1.5 py-0.5 rounded-md bg-black/40 text-[10px] font-extrabold font-mono-tc">
                            -{cutDiffSec}s
                          </span>
                        )}
                      </button>

                      {/* Comment Text or Inline Edit */}
                      <div className="flex-1 min-w-0 pt-1">
                        {editingCommentId === c.id ? (
                          <div className="flex flex-col gap-2">
                            <label htmlFor={`edit-comment-${c.id}`} className="sr-only">Rediģēt komentāra tekstu</label>
                            <input
                              id={`edit-comment-${c.id}`}
                              type="text"
                              autoComplete="off"
                              value={editingCommentText}
                              onChange={e => setEditingCommentText(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEditedComment(c.id);
                                if (e.key === 'Escape') setEditingCommentId(null);
                              }}
                              autoFocus
                              className={`min-h-[38px] w-full px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium ${
                                isDark
                                  ? 'bg-[#0B131E] border-[#2DD4BF] text-white'
                                  : 'bg-[#E8EFF3] border-[#0E7C86] text-[#002C37]'
                              }`}
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => saveEditedComment(c.id)}
                                className="min-h-[34px] px-3 py-1 rounded-lg bg-[#0E7C86] text-white text-xs font-bold cursor-pointer ui-fast"
                              >
                                Saglabāt
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCommentId(null)}
                                className="min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold opacity-80 hover:opacity-100 cursor-pointer"
                              >
                                Atcelt
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p
                            onClick={() => seekToSeconds(c.seconds, c.id)}
                            className={`max-w-[62ch] text-xs sm:text-sm leading-relaxed break-words cursor-pointer ${
                              c.resolved
                                ? 'line-through opacity-75'
                                : isCutComment
                                  ? isDark
                                    ? 'text-rose-100 font-medium'
                                    : 'text-rose-950 font-medium'
                                  : isDark
                                    ? 'text-[#E8F0F6] font-medium'
                                    : 'text-[#002C37] font-medium'
                            }`}
                          >
                            {c.text.trim().toUpperCase().startsWith('CUT') ? (
                              <>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-600 text-white font-mono-tc text-[10px] font-extrabold mr-1.5 shadow-2xs tracking-wide">
                                  CUT
                                </span>
                                <span>{c.text.trim().replace(/^CUT\s*/i, '')}</span>
                              </>
                            ) : (
                              c.text
                            )}
                          </p>
                        )}
                      </div>

                      {/* Edit & Delete Actions (Accessible on Touch, Keyboard Focus-Within, and Hover) */}
                      {editingCommentId !== c.id && (
                        <div className="flex items-center gap-0.5 opacity-80 sm:opacity-40 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ui-fast shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(c.id);
                              setEditingCommentText(c.text);
                            }}
                            aria-label={`Rediģēt komentāru pie ${c.timecode}`}
                            className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer ${
                              isDark ? 'text-[#9FB3C8] hover:text-white' : 'text-[#2C4A5E] hover:text-[#002C37]'
                            }`}
                            title="Rediģēt komentāru"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteComment(c.id)}
                            aria-label={`Dzēst komentāru pie ${c.timecode}`}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-rose-500 dark:text-rose-400 hover:bg-rose-500/15 cursor-pointer"
                            title="Dzēst komentāru"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
          </aside>

        </div>

        {/* Standard Footer with EU Directives & Sarmyte Credit */}
        <FooterBar isDark={isDark} />
      </main>
    </div>
  );
};

export default App;
