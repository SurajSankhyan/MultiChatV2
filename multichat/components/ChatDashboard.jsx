import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Settings, 
  Sliders, 
  Tv, 
  ExternalLink, 
  MessageSquare,
  Shield,
  Layers,
  LogOut,
  Loader2,
  Clock,
  Eye,
  Users,
  X,
  Compass,
  Star,
  AtSign,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  PanelLeft,
  Globe,
  ThumbsUp,
  Gift,
  Crown
} from 'lucide-react';
import ChatFeed, { checkIsMentioned, GLOBAL_AVATAR_CACHE } from './ChatFeed';
import ChatInput from './ChatInput';
import SpidermanPet from './SpidermanPet';
import ChatterInsights from './ChatterInsights';
import ThreadModal from './ThreadModal';
import SettingsDrawer from './SettingsDrawer';
import PlatformLogo from './PlatformLogo';
import AnimatedDropdown from './ui/animated-dropdown';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/interfaces-tooltip';
import { TwitchChatClient } from '../utils/twitchChat';
import { KickChatClient } from '../utils/kickChat';
import { YoutubeChatClient, calculateYoutubeTop3Ranks } from '../utils/youtubeChat';
import { ChatSimulator } from '../utils/simulator';
import { parseAmountString, detectCurrencySymbol, getHighResAvatarUrl } from './HighlightOverlay';

export const isBotMessage = (msg) => {
  if (!msg) return false;
  const nameLower = (msg.username || '').toLowerCase().replace(/^@+/, '').trim();
  const displayLower = (msg.displayName || '').toLowerCase().replace(/^@+/, '').trim();
  const knownBots = ['streamelements', 'nightbot', 'wizebot', 'fossabot', 'moobot', 'botrix', 'soundalerts', 'streamlabs', 'kbot', 'botrixoficial', 'botrixofficial', 'kickbot'];
  if (knownBots.includes(nameLower) || knownBots.includes(displayLower)) return true;
  if (nameLower.endsWith('bot') || displayLower.endsWith('bot')) return true;
  if (Array.isArray(msg.badges) && (msg.badges.includes('bot') || msg.badges.includes('verified_bot'))) return true;
  if (msg.userRole === 'bot') return true;
  return false;
};
const isDefaultAvatar = (url) => {
  if (!url || typeof url !== 'string') return true;
  const lower = url.trim().toLowerCase();
  return lower === '' || 
         lower === 'default' || 
         lower === 'null' || 
         lower === 'undefined';
};

const getKickDefaultAvatarUrl = (username, id) => {
  let index = 1;
  const numId = parseInt(id);
  if (numId && !isNaN(numId)) {
    index = (numId % 6) + 1;
  } else if (username) {
    let hash = 0;
    const cleanUser = username.toLowerCase();
    for (let i = 0; i < cleanUser.length; i++) {
      hash = cleanUser.charCodeAt(i) + ((hash << 5) - hash);
    }
    index = (Math.abs(hash) % 6) + 1;
  }
  return `/kick-default-avatars/default-avatar-${index}.webp`;
};

const proxifyAvatarUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  let cleanUrl = url.trim();
  if (cleanUrl.startsWith('data:')) return cleanUrl;
  if (cleanUrl.startsWith('/kick-default-avatars/')) return cleanUrl;
  if (cleanUrl.startsWith('/api/kick/avatar')) return cleanUrl;
  if (cleanUrl.includes('files.kick.com')) return cleanUrl;
  if (cleanUrl.includes('yt3.ggpht.com')) return cleanUrl;
  if (cleanUrl.includes('static-cdn.jtvnw.net')) return cleanUrl;
  if (cleanUrl.includes('7tv.app')) return cleanUrl;
  if (cleanUrl.includes('weserv.nl')) return cleanUrl;
  if (cleanUrl.includes('googleusercontent.com')) return cleanUrl;
  if (cleanUrl.startsWith('/')) {
    cleanUrl = 'https://kick.com' + cleanUrl;
  }
  if (cleanUrl.includes('kick.com/img/default-profile-pictures/')) {
    const match = cleanUrl.match(/default-avatar-(\d+)/);
    const idx = match ? ((parseInt(match[1]) % 6) || 1) : 1;
    return `/kick-default-avatars/default-avatar-${idx}.webp`;
  }
  if (cleanUrl.includes('kick.com/')) {
    return `/api/kick/avatar?url=${encodeURIComponent(cleanUrl)}`;
  }
  return cleanUrl;
};

const getDefaultAvatar = (platform, username, id) => {
  const norm = platform ? platform.toLowerCase() : '';
  if (norm === 'kick') {
    const defaultUrl = getKickDefaultAvatarUrl(username, id);
    return proxifyAvatarUrl(defaultUrl);
  }
  if (norm === 'youtube') {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="12" fill="%231a1a1a"/><circle cx="12" cy="8" r="3.5" fill="%23FF0000"/><path d="M12 14c-4 0-6 2-6 3v1h12v-1c0-1-2-3-6-3z" fill="%23FF0000"/></svg>`;
  }
  if (norm === 'twitch') {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="12" fill="%231a1a1a"/><circle cx="12" cy="8" r="3.5" fill="%239146FF"/><path d="M12 14c-4 0-6 2-6 3v1h12v-1c0-1-2-3-6-3z" fill="%239146FF"/></svg>`;
  }
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="12" fill="%231a1a1a"/><circle cx="12" cy="8" r="3.5" fill="%23888888"/><path d="M12 14c-4 0-6 2-6 3v1h12v-1c0-1-2-3-6-3z" fill="%23888888"/></svg>`;
};

const playMentionSound = (volume = 0.5, soundType = 'bell') => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    
    if (soundType === 'retro') {
      // 8-bit coin sound
      const playNote = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, startTime);
        gainNode.gain.setValueAtTime(volume * 0.08, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      playNote(987.77, now, 0.08); // B5
      playNote(1318.51, now + 0.08, 0.22); // E6
    } else if (soundType === 'bubble') {
      // Satisfying bubble pop (frequency sweep)
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
      gainNode.gain.setValueAtTime(volume * 0.25, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (soundType === 'digital') {
      // Clean high-tech blip
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1600, now);
      gainNode.gain.setValueAtTime(volume * 0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else {
      // Default: bell (nice double chime)
      const playNote = (freq, startTime, duration) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gainNode.gain.setValueAtTime(volume * 0.15, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      playNote(1046.50, now, 0.12); // C6
      playNote(1318.51, now + 0.10, 0.20); // E6
    }
  } catch (e) {
    console.error('Failed to play mention sound:', e);
  }
};

// Global Anti-Spam tracking for TTS (sliding window of recent messages)
const ttsRecentHistory = [];

/**
 * Validates whether a message is spam and should be skipped by TTS
 */
export const isTtsSpam = (rawText, username = '') => {
  if (!rawText || typeof rawText !== 'string') return { isSpam: true, reason: 'empty' };

  const text = rawText.trim();
  if (text.length === 0) return { isSpam: true, reason: 'empty' };

  // 1. Bot & Chat Commands: starts with !, /, ., #, $ followed by word (e.g. !drop, !points, !discord, !uptime)
  if (/^[!/.#$][a-zA-Z0-9_-]{2,}/i.test(text)) {
    return { isSpam: true, reason: 'command' };
  }

  // 2. Pure Links / URLs
  const urlRegex = /https?:\/\/\S+|discord\.(gg|io|me)\/\S+|t\.me\/\S+|bit\.ly\/\S+/gi;
  const withoutUrls = text.replace(urlRegex, '').trim();
  if (withoutUrls.length < 2 && text.match(urlRegex)) {
    return { isSpam: true, reason: 'link_only' };
  }

  // 3. Pure Emojis, Emotes, or Symbols (nothing readable for TTS)
  const readableChars = text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/:[a-zA-Z0-9_]+:/g, '')
    .replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±\s]/g, '')
    .trim();

  if (readableChars.length === 0) {
    return { isSpam: true, reason: 'emoji_or_symbol_only' };
  }

  // 4. Character Flood Spam (e.g. "aaaaaaaaaaaa", "wwwwwwwwwwww", "GGGGGGGGGGGGGG")
  const singleCharRepeats = text.match(/(.)\1{4,}/gi);
  if (singleCharRepeats) {
    const totalRepeatedChars = singleCharRepeats.reduce((sum, m) => sum + m.length, 0);
    if (totalRepeatedChars >= 8 || totalRepeatedChars / text.length >= 0.45) {
      return { isSpam: true, reason: 'character_flood' };
    }
  }

  // Check repeating 2-char or 3-char patterns (e.g. "hahahahahaha", "lolololololol", "kekwkekw")
  const patternMatch = text.match(/(.{2,3})\1{3,}/gi);
  if (patternMatch) {
    const totalPatternChars = patternMatch.reduce((sum, m) => sum + m.length, 0);
    if (totalPatternChars / text.length >= 0.5) {
      return { isSpam: true, reason: 'pattern_flood' };
    }
  }

  // 5. Word Flood Spam (e.g. "hi hi hi hi hi hi" or "sub sub sub sub sub sub")
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length >= 4) {
    const freq = {};
    for (const w of words) {
      freq[w] = (freq[w] || 0) + 1;
    }
    const maxFreq = Math.max(...Object.values(freq));
    if (maxFreq / words.length >= 0.55) {
      return { isSpam: true, reason: 'word_flood' };
    }
  }

  // 6. User Flood & Duplicate Message Rate Limiting
  if (username) {
    const userKey = username.toLowerCase().trim();
    const now = Date.now();
    const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();

    // Clean history older than 25 seconds
    while (ttsRecentHistory.length > 0 && (now - ttsRecentHistory[0].time) > 25000) {
      ttsRecentHistory.shift();
    }

    const userRecent = ttsRecentHistory.filter(h => h.username === userKey);

    // Duplicate message by same user within 15 seconds
    if (userRecent.some(h => h.text === normalizedText && (now - h.time) < 15000)) {
      return { isSpam: true, reason: 'duplicate_user_message' };
    }

    // Rate limit: same user sending more than 2 messages within 6 seconds
    const rapidCount = userRecent.filter(h => (now - h.time) < 6000).length;
    if (rapidCount >= 2) {
      return { isSpam: true, reason: 'user_rate_limit' };
    }
  }

  return { isSpam: false };
};

/**
 * Cleans and formats chat text for optimal, natural speech synthesis
 */
export const sanitizeTtsText = (text, maxChars = 150) => {
  if (!text || typeof text !== 'string') return '';

  let clean = text
    // Strip links
    .replace(/https?:\/\/\S+/gi, '')
    // Strip colon/bracket emotes like :smile: or [emote:123]
    .replace(/:[a-zA-Z0-9_]+:/g, '')
    .replace(/\[emote:[^\]]+\]/gi, '')
    // Strip emojis so TTS doesn't read out "fire flame red heart"
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
    // Collapse single character repetitions: e.g. "sooooo" -> "soo", "Wwwwwww" -> "Ww"
    .replace(/(.)\1{2,}/gi, '$1$1')
    // Collapse repeated words: e.g. "hi hi hi hi" -> "hi hi"
    .replace(/\b(\w+)(?:\s+\1\b){2,}/gi, '$1 $1')
    // Collapse punctuation: "????" -> "?", "!!!!" -> "!"
    .replace(/([?!.,~])\1+/g, '$1')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Enforce max character limit to prevent audio lockup from wall of text
  if (maxChars && clean.length > maxChars) {
    clean = clean.substring(0, maxChars).trim() + '...';
  }

  return clean;
};

// Global TTS Queue Manager to speak messages sequentially (1 by 1)
window.ttsManager = {
  queue: [],
  isSpeaking: false,
  activeUtterances: new Set(),

  speak: function(text, volume, rate, voiceName, forceImmediate = false, username = '', readUsername = false, antiSpam = true, maxChars = 150) {
    if (!window.speechSynthesis) return;

    // Run anti-spam filter for queued/auto-read messages
    if (!forceImmediate && antiSpam) {
      const spamCheck = isTtsSpam(text, username);
      if (spamCheck.isSpam) {
        console.log(`[TTS Anti-Spam] Skipped spam chat from ${username || 'User'} (${spamCheck.reason}): "${text}"`);
        return;
      }
    }

    // Clean text of emotes, excessive repeats, emojis, links, and length limit
    let cleanText = sanitizeTtsText(text, maxChars);
    if (!cleanText || cleanText.length === 0) return;

    // Record entry into recent history for flood protection
    if (username) {
      ttsRecentHistory.push({
        username: username.toLowerCase().trim(),
        text: cleanText.toLowerCase().trim(),
        time: Date.now()
      });
      if (ttsRecentHistory.length > 50) ttsRecentHistory.shift();
    }

    const textToSpeak = readUsername && username ? `${username} says: ${cleanText}` : cleanText;

    if (forceImmediate) {
      this.cancel();

      try {
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.volume = volume;
        utterance.rate = rate;
        this.activeUtterances.add(utterance);

        if (voiceName) {
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(v => v.name === voiceName);
          if (voice) utterance.voice = voice;
        }

        utterance.onend = () => {
          this.activeUtterances.delete(utterance);
        };
        utterance.onerror = () => {
          this.activeUtterances.delete(utterance);
        };

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.error("Manual TTS error:", e);
      }
      return;
    }

    // Auto-play queuing: cap queue size to 10 to prevent infinite backlog
    if (this.queue.length >= 10) {
      this.queue.shift(); // remove oldest to make room for newest
    }

    this.queue.push({
      textToSpeak,
      volume,
      rate,
      voiceName
    });

    if (!this.isSpeaking) {
      this.processNext();
    }
  },

  processNext: function() {
    if (!window.speechSynthesis) return;
    if (this.queue.length === 0) {
      this.isSpeaking = false;
      return;
    }

    this.isSpeaking = true;
    const next = this.queue.shift();

    try {
      const utterance = new SpeechSynthesisUtterance(next.textToSpeak);
      utterance.volume = next.volume;
      utterance.rate = next.rate;
      this.activeUtterances.add(utterance);

      if (next.voiceName) {
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.name === next.voiceName);
        if (voice) utterance.voice = voice;
      }

      utterance.onend = () => {
        this.activeUtterances.delete(utterance);
        this.processNext();
      };
      utterance.onerror = (e) => {
        this.activeUtterances.delete(utterance);
        console.warn("TTS error:", e);
        this.processNext();
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Queue TTS error:", e);
      this.isSpeaking = false;
      this.processNext();
    }
  },

  cancel: function() {
    this.queue = [];
    this.isSpeaking = false;
    this.activeUtterances.clear();
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }
};

const speakMessage = (username, text, ttsVolume = 0.5, ttsSpeed = 1.0, readUsername = true, ttsVoiceName = '', antiSpam = true, maxChars = 150) => {
  if (window.ttsManager) {
    window.ttsManager.speak(text, ttsVolume, ttsSpeed, ttsVoiceName, false, username, readUsername, antiSpam, maxChars);
  }
};

export default function ChatDashboard({ 
  user, 
  logout, 
  activeChannels, 
  addChannel, 
  removeChannel, 
  toggleChannel,
  reorderChannels = () => {},
  settings,
  updateSettings,
  messages,
  setMessages,
  modeDemo = false
}) {
  const settingsRef = useRef(settings);
  const userRef = useRef(user);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const prevYoutubeChatModeRef = useRef(settings?.youtubeChatMode || 'live');

  useEffect(() => {
    const prevMode = prevYoutubeChatModeRef.current;
    const currentMode = settings?.youtubeChatMode || 'live';
    if (prevMode !== currentMode) {
      setMessages(prev => prev.filter(msg => msg.platform !== 'youtube'));
    }
    prevYoutubeChatModeRef.current = currentMode;
  }, [settings?.youtubeChatMode, setMessages]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState('appearance');
  const [selectedChatter, setSelectedChatter] = useState(null);
  const [selectedThreadMsg, setSelectedThreadMsg] = useState(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isParticipantsClosing, setIsParticipantsClosing] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState(() => {
    const stored = localStorage.getItem('prochat_blocked_users');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const [streamViewers, setStreamViewers] = useState(() => {
    const cached = localStorage.getItem('prochat_cached_stream_viewers');
    return cached ? JSON.parse(cached) : {};
  });
  const [streamLikes, setStreamLikes] = useState(() => {
    const cached = localStorage.getItem('prochat_cached_stream_likes');
    return cached ? JSON.parse(cached) : {};
  });
  const [resolvedStreamerNames, setResolvedStreamerNames] = useState({});

  // 1. Fetch channel database mappings on mount to populate display names (e.g. "@duplicatebunnysank9" -> "Duplicate Bunny Sank")
  useEffect(() => {
    fetch('/api/youtube/channels')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.success && Array.isArray(data.channels)) {
          const map = {};
          data.channels.forEach(ch => {
            if (ch.handle && ch.name && ch.name !== '@user') {
              const cleanHandle = ch.handle.toLowerCase().replace(/^@+/, '').trim();
              map[cleanHandle] = ch.name.replace(/^@+/, '');
            }
          });
          setResolvedStreamerNames(prev => ({ ...map, ...prev }));
        }
      })
      .catch(() => {});
  }, []);

  // 2. Sync logged-in user channel details into resolvedStreamerNames if available
  useEffect(() => {
    if (user) {
      const channelTitle = user?.channel_name || user?.ytChannelName || (user?.username !== 'Streamer' && !user?.username?.startsWith('@') ? user?.username : null);
      const handlesToTry = [
        user?.custom_handle,
        user?.ytCustomHandle,
        user?.username,
        user?.email?.split('@')[0]
      ].filter(Boolean);

      if (channelTitle && channelTitle !== '@user' && !channelTitle.toLowerCase().includes('404')) {
        const updateMap = {};
        handlesToTry.forEach(h => {
          const clean = h.toLowerCase().replace(/^@+/, '').trim();
          if (clean) updateMap[clean] = channelTitle.replace(/^@+/, '');
        });
        setResolvedStreamerNames(prev => ({ ...updateMap, ...prev }));
      }
    }
  }, [user]);

  const getChannelDisplayName = useCallback((ch) => {
    if (!ch) return '';
    const cleanName = ch.name.toLowerCase().replace(/^@+/, '').trim();

    // 1. Prioritize logged-in user verified channel title for user's own channel
    if (user) {
      const channelTitle = user?.channel_name || user?.ytChannelName || (user?.username && !user?.username?.startsWith('@') && user?.username !== 'Streamer' ? user?.username : null);
      const userHandles = [
        user?.custom_handle,
        user?.ytCustomHandle,
        user?.username,
        user?.email?.split('@')[0]
      ].filter(Boolean).map(h => h.toLowerCase().replace(/^@+/, '').trim());

      if (channelTitle && channelTitle !== '@user' && !channelTitle.toLowerCase().includes('404') && userHandles.includes(cleanName)) {
        return channelTitle.replace(/^@+/, '');
      }
    }

    // 2. Check resolvedStreamerNames map
    const resolved = resolvedStreamerNames[cleanName];
    if (resolved && !resolved.toLowerCase().includes('404') && !resolved.toLowerCase().includes('not found') && resolved.toLowerCase() !== 'youtube') {
      return resolved.replace(/^@+/, '');
    }

    // 3. Fallback to ch.displayName
    if (ch.displayName && !ch.displayName.toLowerCase().includes('404') && !ch.displayName.startsWith('@')) {
      return ch.displayName.replace(/^@+/, '');
    }

    return ch.name.replace(/^@+/, '');
  }, [resolvedStreamerNames, user]);

  const getChannelUrl = (ch) => {
    if (!ch) return null;
    const cleanName = ch.name.replace(/^@+/, '').trim();
    const platform = (ch.platform || '').toLowerCase();

    switch (platform) {
      case 'kick':
        return `https://kick.com/${cleanName}`;
      case 'youtube':
      case 'youtube_shorts':
        if (ch.channelId && ch.channelId.startsWith('UC')) {
          return `https://www.youtube.com/channel/${ch.channelId}`;
        }
        return `https://www.youtube.com/@${cleanName}`;
      case 'twitch':
        return `https://www.twitch.tv/${cleanName}`;
      case 'tiktok':
        return `https://www.tiktok.com/@${cleanName}`;
      case 'rumble':
        return `https://rumble.com/c/${cleanName}`;
      case 'x':
      case 'twitter':
        return `https://x.com/${cleanName}`;
      default:
        return null;
    }
  };

  const handleOpenSettings = (tab = 'appearance') => {
    setSettingsActiveTab(tab);
    setIsSettingsOpen(true);
  };

  const handleCloseParticipants = useCallback(() => {
    setIsParticipantsClosing(true);
    setTimeout(() => {
      setShowParticipants(false);
      setIsParticipantsClosing(false);
    }, 250); // Matches CSS transition duration
  }, []);

  const handleToggleParticipants = useCallback(() => {
    if (showParticipants) {
      handleCloseParticipants();
    } else {
      setShowParticipants(true);
    }
  }, [showParticipants, handleCloseParticipants]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Close any open popup/modal/drawer when Escape is pressed
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedChatter) {
          // Let ChatterInsights handle its own 200ms close animation
          return;
        } else if (selectedThreadMsg) {
          // Let ThreadModal handle its own close animation
          return;
        } else if (isSettingsOpen) {
          // Let SettingsDrawer handle its own close animation
          return;
        } else if (showParticipants) {
          handleCloseParticipants();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedChatter, selectedThreadMsg, isSettingsOpen, showParticipants, handleCloseParticipants]);

  const handleBlockUser = (username) => {
    const lower = username.toLowerCase();
    setBlockedUsers(prev => {
      const next = new Set(prev);
      next.add(lower);
      localStorage.setItem('prochat_blocked_users', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleUnblockUser = (username) => {
    const lower = username.toLowerCase();
    setBlockedUsers(prev => {
      const next = new Set(prev);
      next.delete(lower);
      localStorage.setItem('prochat_blocked_users', JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleClearEvents = () => {
    setMessages(prev => prev.filter(m => !m.isSystemEvent));
  };

  // Live Stream Chat Highlight Overlay State (Chat Overlay V5.2 Engine)
  const [activeHighlightId, setActiveHighlightId] = useState(null);
  const [heldSuper, setHeldSuper] = useState(null);

  const broadcastChannelRef = useRef(null);
  const supabaseChannelRef = useRef(null);

  useEffect(() => {
    try {
      broadcastChannelRef.current = new BroadcastChannel('multichat_highlight_overlay');
    } catch (e) {}

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        import('@/utils/supabase/client').then(({ createClient }) => {
          const supabase = createClient();
          const channel = supabase.channel('multichat_highlight_overlay', {
            config: { broadcast: { self: true } }
          });
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              supabaseChannelRef.current = channel;
            }
          });
        }).catch(() => {});
      }
    } catch (e) {}

    return () => {
      if (broadcastChannelRef.current) broadcastChannelRef.current.close();
      if (supabaseChannelRef.current) supabaseChannelRef.current.unsubscribe();
    };
  }, []);

  const handleHideHighlight = useCallback(() => {
    setActiveHighlightId(null);
    setHeldSuper(null);
    try {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ command: 'hide' });
      }
      localStorage.setItem('multichat_active_highlight_event', JSON.stringify({ command: 'hide', timestamp: Date.now() }));
    } catch (e) {}

    if (supabaseChannelRef.current) {
      try {
        supabaseChannelRef.current.send({
          type: 'broadcast',
          event: 'highlight',
          payload: { command: 'hide' }
        }).catch(() => {});
      } catch (e) {}
    }
  }, []);

  const handleHighlightMessage = useCallback((msg, options = {}) => {
    if (!msg) return;

    // If this message is already active on overlay, clicking again hides it
    if (activeHighlightId === msg.id && !options.force && !options.overrideAmount) {
      handleHideHighlight();
      return;
    }

    const {
      overrideAmount,
      overrideMessage,
      overrideAuthor
    } = options;

    // Check if this is a StreamElements / Streamlabs message
    const isStreamService = isBotMessage(msg) && (
      (msg.username && (msg.username.toLowerCase().includes('streamelements') || msg.username.toLowerCase().includes('streamlabs'))) ||
      (msg.text && (msg.text.includes('UPI') || msg.text.toLowerCase().includes('tip') || msg.text.toLowerCase().includes('tipped') || msg.text.toLowerCase().includes('donated')))
    );

    if (isStreamService && !heldSuper && !overrideAmount) {
      // First click on tip bot message: extract amount and message
      const text = msg.text || '';
      const amountParsed = parseAmountString(text);
      const curSymbol = detectCurrencySymbol(text);
      let messagePart = '';
      const msgMatch = text.match(/(?:Msg|Message)\s*:?\s*(.*)$/i) || text.match(/!+\s*Msg\s*:?\s*(.*)$/i);
      if (msgMatch && msgMatch[1]) messagePart = msgMatch[1].trim();

      setHeldSuper({
        amountValue: amountParsed ? Math.floor(amountParsed) : null,
        donationAmount: amountParsed ? `${curSymbol}${Math.floor(amountParsed)}` : null,
        messageText: messagePart || null,
        timestamp: Date.now()
      });
      return;
    }

    let finalAmountValue = null;
    let finalDonationAmount = null;
    let finalText = msg.text || '';
    let finalParts = msg.parts || [];

    // Check if we have a heldSuper to attach to this chatter
    if (heldSuper) {
      finalAmountValue = heldSuper.amountValue;
      finalDonationAmount = heldSuper.donationAmount;
      if (heldSuper.messageText) {
        finalText = heldSuper.messageText;
        finalParts = [{ type: 'text', content: finalText }];
      }
      setHeldSuper(null);
    } else if (overrideAmount !== undefined) {
      const parsed = parseAmountString(String(overrideAmount));
      if (parsed) {
        finalAmountValue = Math.floor(parsed);
        const sym = detectCurrencySymbol(String(overrideAmount));
        finalDonationAmount = `${sym}${finalAmountValue}`;
      } else {
        finalDonationAmount = String(overrideAmount);
      }
    } else if (msg.eventDetails?.amount) {
      finalDonationAmount = msg.eventDetails.amount;
      const parsed = parseAmountString(msg.eventDetails.amount);
      if (parsed) finalAmountValue = Math.floor(parsed);
    }

    const cleanUser = (msg.username || '').toLowerCase().replace(/^@+/, '').trim();
    const cleanDisplay = (msg.displayName || '').toLowerCase().replace(/^@+/, '').trim();
    const rawAvatar = msg.avatarUrl || msg._resolvedAvatar || msg.avatar || msg.authorPhoto || 
      (cleanUser ? GLOBAL_AVATAR_CACHE.get(cleanUser) : null) || 
      (cleanDisplay ? GLOBAL_AVATAR_CACHE.get(cleanDisplay) : null) || null;
    const resolvedAvatar = getHighResAvatarUrl(rawAvatar);

    const isDonationOrSuper = msg.eventType === 'donation' || !!finalDonationAmount;
    const isMembershipEvent = msg.eventType === 'subscription' || msg.eventType === 'membership';

    const payload = {
      chatId: msg.id,
      displayName: overrideAuthor || msg.displayName || msg.username || 'Viewer',
      username: msg.username || 'viewer',
      avatarUrl: resolvedAvatar,
      text: finalText,
      parts: finalParts,
      platform: msg.platform || 'youtube',
      isShorts: !!msg.isShorts,
      donationAmount: finalDonationAmount,
      amountValue: finalAmountValue,
      isSuperChat: isDonationOrSuper,
      isMembership: isMembershipEvent,
      membershipTier: msg.eventDetails?.tier || null,
      membershipDuration: msg.eventDetails?.milestoneText || msg.eventDetails?.tier || null,
      isGift: msg.eventDetails?.subType === 'gift_purchase' || msg.eventDetails?.subType === 'gift_redemption' || !!msg.giftDetails,
      giftDetails: msg.giftDetails || null,
      backgroundColor: isDonationOrSuper ? (msg.eventDetails?.bodyBg || null) : null,
      textColor: isDonationOrSuper ? (msg.eventDetails?.contentTextColor || null) : null,
      authorBgColor: isDonationOrSuper ? (msg.eventDetails?.headerBg || null) : null,
      badges: Array.isArray(msg.badges) ? msg.badges : [],
      badgeImages: msg.badgeImages || {},
      badgeVersions: msg.badgeVersions || {},
      isOwner: !!msg.isOwner,
      isBroadcaster: !!msg.isBroadcaster,
      isModerator: !!msg.isModerator,
      isMember: !!msg.isMember || (Array.isArray(msg.badges) && (msg.badges.includes('member') || msg.badges.includes('subscriber'))),
      isVerified: !!msg.isVerified || (Array.isArray(msg.badges) && msg.badges.includes('verified')),
      youtubeRank: msg.youtubeRank || null,
      giftedSubsCount: msg.giftedSubsCount || null,
      monthsSubscribed: msg.monthsSubscribed || null,
      channel: msg.channel || null,
      showPlatformLogo: !!settings.highlightShowPlatformLogo,
      autoHideSeconds: settings.overlayFadeTime || 8
    };

    setActiveHighlightId(msg.id);

    // Send to local BroadcastChannel and localStorage
    try {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.postMessage({ command: 'show', data: payload });
      }
      localStorage.setItem('multichat_active_highlight_event', JSON.stringify({ command: 'show', data: payload, timestamp: Date.now() }));
    } catch (e) {}

    if (supabaseChannelRef.current) {
      try {
        supabaseChannelRef.current.send({
          type: 'broadcast',
          event: 'highlight',
          payload: { command: 'show', data: payload }
        }).catch(() => {});
      } catch (e) {}
    }
  }, [activeHighlightId, heldSuper, settings.overlayFadeTime, settings.highlightShowPlatformLogo, handleHideHighlight]);

  // Global ESC key to hide overlay
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleHideHighlight();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleHideHighlight]);
  
  // Moderation state initialized from localStorage
  const [moderation, setModeration] = useState(() => {
    try {
      const storedDeleted = typeof window !== 'undefined' ? localStorage.getItem('prochat_deleted_msg_ids') : null;
      const storedDeletedBy = typeof window !== 'undefined' ? localStorage.getItem('prochat_deleted_by_map') : null;
      const storedTimedOut = typeof window !== 'undefined' ? localStorage.getItem('prochat_timed_out_users') : null;
      const storedBanned = typeof window !== 'undefined' ? localStorage.getItem('prochat_banned_users') : null;

      const deletedSet = storedDeleted ? new Set(JSON.parse(storedDeleted)) : new Set();
      const bannedSet = storedBanned ? new Set(JSON.parse(storedBanned)) : new Set();
      const deletedByMap = new Map();
      if (storedDeletedBy) {
        try {
          const arr = JSON.parse(storedDeletedBy);
          if (Array.isArray(arr)) {
            arr.forEach(([id, actor]) => deletedByMap.set(id, actor));
          }
        } catch (e) {}
      }
      
      const timedOutMap = new Map();
      if (storedTimedOut) {
        const arr = JSON.parse(storedTimedOut);
        const now = Date.now();
        arr.forEach(([u, exp]) => {
          if (exp > now) timedOutMap.set(u, exp);
        });
      }

      return {
        bannedUsers: bannedSet,
        timedOutUsers: timedOutMap,
        deletedMessageIds: deletedSet,
        deletedByMap
      };
    } catch (e) {
      return {
        bannedUsers: new Set(),
        timedOutUsers: new Map(),
        deletedMessageIds: new Set(),
        deletedByMap: new Map()
      };
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('prochat_deleted_msg_ids', JSON.stringify(Array.from(moderation.deletedMessageIds)));
        localStorage.setItem('prochat_deleted_by_map', JSON.stringify(Array.from(moderation.deletedByMap ? moderation.deletedByMap.entries() : [])));
        localStorage.setItem('prochat_banned_users', JSON.stringify(Array.from(moderation.bannedUsers)));
        localStorage.setItem('prochat_timed_out_users', JSON.stringify(Array.from(moderation.timedOutUsers.entries())));
      }
    } catch (e) {}
  }, [moderation]);

  const [platformStatuses, setPlatformStatuses] = useState({
    twitch: 'disconnected',
    youtube: 'disconnected',
    kick: 'disconnected'
  });

  const [clientsInitialized, setClientsInitialized] = useState(false);

  const [youtubeShortsChannels, setYoutubeShortsChannels] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('prochat_cached_youtube_shorts_channels');
        if (saved) {
          const arr = JSON.parse(saved);
          if (Array.isArray(arr)) return new Set(arr);
        }
      } catch (e) {}
    }
    return new Set();
  });

  // Client references
  const twitchClientRef = useRef(null);
  const kickClientRef = useRef(null);
  const youtubeClientRef = useRef(null);
  const simulatorRef = useRef(null);

  const handleAddChannel = async (platform, name) => {
    let input = (name || '').trim();
    if (!input) return;
    let cleanName = input;

    if (platform === 'youtube') {
      if (input.includes('youtube.com/') || input.includes('youtu.be/')) {
        try {
          const u = new URL(input.startsWith('http') ? input : `https://${input}`);
          if (u.searchParams.has('v')) {
            cleanName = u.searchParams.get('v');
          } else if (u.pathname.startsWith('/@')) {
            cleanName = u.pathname.split('/')[1];
          } else if (u.pathname.startsWith('/channel/')) {
            cleanName = u.pathname.split('/')[2];
          } else if (u.pathname.startsWith('/live/')) {
            cleanName = u.pathname.split('/')[2];
          } else if (u.pathname.startsWith('/shorts/')) {
            cleanName = u.pathname.split('/')[2];
          }
        } catch (e) {}
      }
      if (!cleanName.startsWith('@') && !cleanName.startsWith('UC') && !/^[a-zA-Z0-9_-]{11}$/.test(cleanName)) {
        cleanName = `@${cleanName.replace(/^@+/, '')}`;
      }
    } else if (platform === 'kick') {
      if (input.includes('kick.com/')) {
        cleanName = input.split('kick.com/')[1].split('/')[0].split('?')[0];
      }
      cleanName = cleanName.toLowerCase().replace(/^@+/, '').trim();
    } else if (platform === 'twitch') {
      if (input.includes('twitch.tv/')) {
        cleanName = input.split('twitch.tv/')[1].split('/')[0].split('?')[0];
      }
      cleanName = cleanName.toLowerCase().replace(/^@+/, '').replace(/^#+/, '').trim();
    }

    const checkKey = cleanName.toLowerCase().replace(/^@+/, '').trim();
    if (activeChannels.some(ch => ch.platform === platform && ch.name.toLowerCase().replace(/^@+/, '').trim() === checkKey)) {
      throw new Error('Channel already added');
    }
    addChannel(platform, cleanName);
  };

  const parseStartTimeMs = (val) => {
    if (!val) return null;
    if (val instanceof Date || (val && typeof val.getTime === 'function')) {
      const ms = val.getTime();
      return !isNaN(ms) && ms > 0 ? ms : null;
    }
    if (typeof val === 'number') {
      if (val <= 0) return null;
      return val < 10000000000 ? val * 1000 : val;
    }
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed || trimmed === 'offline' || trimmed === 'N/A') return null;
      if (/^\d+$/.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        return num < 10000000000 ? num * 1000 : num;
      }
      let parseable = trimmed;
      if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(trimmed)) {
        parseable = trimmed.replace(' ', 'T') + 'Z';
      }
      const ms = Date.parse(parseable);
      if (!isNaN(ms) && ms > 0) return ms;
    }
    return null;
  };

  // Uptime, Viewers, and Filter Tab state
  const [activeTab, setActiveTab] = useState('all');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [streamStartTimes, setStreamStartTimes] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('multichat_stream_start_times_v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {}
    }
    return {};
  });

  const [uptime, setUptime] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('multichat_stream_start_times_v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            const times = Object.values(parsed)
              .map(t => parseStartTimeMs(t))
              .filter(t => t !== null && t > 0 && t <= Date.now() + 60000);
            if (times.length > 0) {
              const earliest = Math.min(...times);
              const diffSecs = Math.floor((Date.now() - earliest) / 1000);
              return diffSecs >= 0 ? diffSecs : 0;
            }
          }
        }
      } catch (e) {}
    }
    return null;
  });
  const [viewerCount, setViewerCount] = useState(19);

  // Drag and Drop state for reordering channels
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = (e, id) => {
    e.dataTransfer.effectAllowed = 'move';
    const index = activeChannels.findIndex(ch => ch.id === id);
    setDraggedIndex(index);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    
    const targetIndex = activeChannels.findIndex(ch => ch.id === id);
    if (draggedIndex === targetIndex) return;

    const items = [...activeChannels];
    const draggedItem = items[draggedIndex];
    items.splice(draggedIndex, 1);
    items.splice(targetIndex, 0, draggedItem);
    
    reorderChannels(items);
    setDraggedIndex(targetIndex);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Track unread system events
  const [hasUnreadEvents, setHasUnreadEvents] = useState(false);
  const prevMessagesLengthRef = useRef(messages.length);

  useEffect(() => {
    if (activeTab === 'events') {
      setHasUnreadEvents(false);
      prevMessagesLengthRef.current = messages.length;
      return;
    }

    if (messages.length > prevMessagesLengthRef.current) {
      const newMessages = messages.slice(prevMessagesLengthRef.current);
      const hasNewEvent = newMessages.some(msg => msg.isSystemEvent);
      if (hasNewEvent) {
        setHasUnreadEvents(true);
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, activeTab]);

  // Uptime tick timer relative to stream start times
  useEffect(() => {
    const interval = setInterval(() => {
      const activeChannelKeys = new Set(
        activeChannels
          .filter(ch => ch.enabled)
          .flatMap(ch => {
            const raw = ch.name.toLowerCase().replace(/^@+/, '').trim();
            const atClean = `@${raw}`;
            const justClean = ch.name.toLowerCase().replace('@', '').trim();
            return [raw, ch.name.toLowerCase(), atClean, justClean];
          })
      );

      const times = Object.entries(streamStartTimes)
        .filter(([k]) => {
          if (activeChannelKeys.size === 0) return true;
          const lowerK = String(k).toLowerCase().trim();
          const cleanK = lowerK.replace(/^@+/, '').trim();
          return activeChannelKeys.has(lowerK) || activeChannelKeys.has(cleanK) || activeChannelKeys.has(`@${cleanK}`);
        })
        .map(([, t]) => parseStartTimeMs(t))
        .filter(t => t !== null && t > 0 && t <= Date.now() + 60000);
      
      if (times.length > 0) {
        const earliest = Math.min(...times);
        const diffSecs = Math.floor((Date.now() - earliest) / 1000);
        setUptime(diffSecs >= 0 ? diffSecs : 0);
      } else {
        setUptime(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [streamStartTimes, activeChannels]);



  const formatUptime = (seconds) => {
    if (seconds === null || seconds === undefined) return 'N/A';
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const activeChannelsRef = useRef(activeChannels);
  useEffect(() => {
    activeChannelsRef.current = activeChannels;
  }, [activeChannels]);

  // Setup Connections
  useEffect(() => {
    let messageBuffer = [];
    let dripTimer = null;

    const drainBuffer = () => {
      if (messageBuffer.length === 0) {
        if (dripTimer) {
          clearInterval(dripTimer);
          dripTimer = null;
        }
        return;
      }

      // Adaptive batch size: if buffer is small, process 1-2 msgs; if flooded, process up to 50 msgs per tick
      const batchSize = Math.min(messageBuffer.length, messageBuffer.length > 50 ? 50 : (messageBuffer.length > 20 ? 20 : (messageBuffer.length > 5 ? 5 : 1)));
      const batch = messageBuffer.splice(0, batchSize);

      setMessages(prev => {
        if (!batch || batch.length === 0) return prev;
        const seen = new Set();
        const startIdx = Math.max(0, prev.length - 200);
        for (let i = startIdx; i < prev.length; i++) {
          if (prev[i]?.id) seen.add(prev[i].id);
        }
        const toAdd = [];
        for (let i = 0; i < batch.length; i++) {
          const item = batch[i];
          if (item && item.id) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
          }
          toAdd.push(item);
        }
        if (toAdd.length === 0) return prev;
        return [...prev, ...toAdd];
      });

      // Process notifications / sounds / TTS for the batch
      const cfg = settingsRef.current;
      const u = userRef.current;
      const nameLower = (u?.username || 'streamer').toLowerCase();

      for (const msg of batch) {
        try {
          if (msg.isSystemEvent) {
            if (cfg.enableAlertSound) {
              playAlertSound(
                (cfg.alertSoundVolume !== undefined ? cfg.alertSoundVolume : 50) / 100,
                cfg.alertSoundType || 'bell'
              );
            }
            if (cfg.enableSuperchatTts && (msg.eventType === 'donation' || msg.isSuperChat)) {
              const amountStr = msg.eventDetails?.amount || '';
              const textToSpeak = `${msg.displayName || msg.username || 'Someone'} sent ${amountStr}${msg.text ? ': ' + msg.text : ''}`;
              speakMessage(
                '',
                textToSpeak,
                (cfg.ttsVolume !== undefined ? cfg.ttsVolume : 50) / 100,
                cfg.ttsSpeed !== undefined ? cfg.ttsSpeed : 1.0,
                false,
                cfg.ttsVoiceName
              );
            }
          } else {
            const hasBroadcasterBadge = Array.isArray(msg.badges) && msg.badges.includes('broadcaster');
            const isMe = (msg.username || '').toLowerCase() === (u?.username || '').toLowerCase() || hasBroadcasterBadge;
            const isBot = isBotMessage(msg);

            if (!isMe) {
              // Mention sound
              if (cfg.enableMentionSound && (!isBot || !cfg.hideBotMessages)) {
                const rawTextStr = typeof msg.text === 'string' ? msg.text : String(msg.text || '');
                const msgLower = rawTextStr.toLowerCase();
                const isMentioned = msgLower.includes(`@${nameLower}`) || msgLower.includes(nameLower);
                if (isMentioned) {
                  playMentionSound(
                    (cfg.mentionSoundVolume !== undefined ? cfg.mentionSoundVolume : 50) / 100,
                    cfg.mentionSoundType || 'bell'
                  );
                }
              }

              // TTS speak checking - respect hideBotMessages and ttsIgnoreBots
              const shouldIgnoreBot = isBot && (cfg.hideBotMessages || cfg.ttsIgnoreBots !== false);
              if (cfg.enableTts && !shouldIgnoreBot) {
                const rawTextStr = typeof msg.text === 'string' ? msg.text : String(msg.text || '');
                speakMessage(
                  msg.displayName || msg.username || 'User',
                  rawTextStr,
                  (cfg.ttsVolume !== undefined ? cfg.ttsVolume : 50) / 100,
                  cfg.ttsSpeed !== undefined ? cfg.ttsSpeed : 1.0,
                  cfg.ttsReadUsernames !== false,
                  cfg.ttsVoiceName,
                  cfg.ttsAntiSpam !== false,
                  cfg.ttsMaxChars || 150
                );
              }
            }
          }
        } catch (err) {
          console.warn('[MultiChat] Notification processing error:', err);
        }
      }
    };

    // Drip / adaptive batch flush
    const startDrip = () => {
      if (dripTimer) return;
      drainBuffer();
      dripTimer = setInterval(drainBuffer, 40);
    };

    // Callback for incoming messages — never drops messages & deduplicates optimistic/sent messages
    const handleNewMessage = (msg) => {
      if (!msg) return;

      // Filter out messages from channels that were removed or disabled
      if (!modeDemo && activeChannelsRef.current) {
        const isChannelActive = activeChannelsRef.current.some(ch => {
          if (!ch.enabled) return false;
          if (ch.platform !== msg.platform) return false;
          const cleanChan = (ch.name || '').toLowerCase().replace(/^@+/, '').trim();
          const msgChan = (msg.channel || '').toLowerCase().replace(/^@+/, '').trim();
          if (!msgChan) return true;
          return cleanChan === msgChan || cleanChan.includes(msgChan) || msgChan.includes(cleanChan);
        });
        if (!isChannelActive) {
          return; // Ignore messages from disconnected/removed channels
        }
      }

      if (msg && msg.text) {
        const normText = String(msg.text).trim();
        const existingIdx = (messagesRef.current || []).findIndex(m =>
          m.platform === msg.platform &&
          String(m.id || '').startsWith('opt_') &&
          String(m.text || '').trim() === normText &&
          (m.rawTimestamp || 0) >= Date.now() - 15000
        );
        if (existingIdx !== -1) {
          // Replace the broadcaster's optimistic message in-place with official received message
          setMessages(prev => prev.map((m, idx) => {
            if (idx === existingIdx) {
              return {
                ...msg,
                avatarUrl: msg.avatarUrl || msg.avatar || m.avatarUrl,
                badges: msg.badges || m.badges
              };
            }
            return m;
          }));
          return;
        }
      }

      messageBuffer.push(msg);
      startDrip();
    };

    // Callback for connection status updates
    const handleStatusUpdate = (ch, status, metadata) => {
      if (metadata && metadata.displayName) {
        const rawClean = ch.replace(/^@+/, '').trim();
        const atClean = `@${rawClean}`;
        const lowerRaw = rawClean.toLowerCase();
        const lowerAt = atClean.toLowerCase();
        setResolvedStreamerNames(prev => ({
          ...prev,
          [ch]: metadata.displayName,
          [rawClean]: metadata.displayName,
          [atClean]: metadata.displayName,
          [lowerRaw]: metadata.displayName,
          [lowerAt]: metadata.displayName
        }));
      }
      if (ch === 'all') {
        setPlatformStatuses(prev => ({ ...prev, twitch: status }));
      } else if (ch === 'kick_all') {
        setPlatformStatuses(prev => ({ ...prev, kick: status }));
      } else if (ch === 'youtube_all') {
        setPlatformStatuses(prev => ({ ...prev, youtube: status }));
      } else {
        // Individual channel status - map across all handle / casing variants
        const rawClean = ch.replace(/^@+/, '').trim();
        const atClean = `@${rawClean}`;
        const justClean = ch.replace('@', '').trim();
        const lowerCh = ch.toLowerCase();
        const lowerRaw = rawClean.toLowerCase();
        const lowerAt = atClean.toLowerCase();

        setPlatformStatuses(prev => ({ 
          ...prev, 
          [ch]: status,
          [rawClean]: status,
          [atClean]: status,
          [justClean]: status,
          [lowerCh]: status,
          [lowerRaw]: status,
          [lowerAt]: status
        }));
      }

      // Handle stream metrics based on status
      const rawClean = ch.replace(/^@+/, '').trim();
      const atClean = `@${rawClean}`;
      const justClean = ch.replace('@', '').trim();
      const lowerCh = ch.toLowerCase();
      const lowerRaw = rawClean.toLowerCase();
      const lowerAt = atClean.toLowerCase();

      if (status === 'connected') {
        const startTimeVal = metadata?.startTime;
        if (startTimeVal) {
          const parsedMs = parseStartTimeMs(startTimeVal);
          if (parsedMs && parsedMs > 0 && parsedMs <= Date.now() + 60000) {
            setStreamStartTimes(prev => {
              const existingMs = parseStartTimeMs(prev[ch] || prev[rawClean]);
              // Protect from stale VOD dates (older by > 24 hours than already established live start time)
              if (existingMs && (existingMs - parsedMs > 24 * 3600 * 1000)) {
                return prev;
              }
              const next = { 
                ...prev, 
                [ch]: startTimeVal, 
                [rawClean]: startTimeVal, 
                [atClean]: startTimeVal, 
                [justClean]: startTimeVal,
                [lowerCh]: startTimeVal,
                [lowerRaw]: startTimeVal,
                [lowerAt]: startTimeVal
              };
              try { localStorage.setItem('multichat_stream_start_times_v2', JSON.stringify(next)); } catch (e) {}
              return next;
            });
          }
        } else {
          // If startTimeVal was not provided in this payload, restore from existing cache if available
          try {
            const stored = localStorage.getItem('multichat_stream_start_times_v2');
            if (stored) {
              const parsed = JSON.parse(stored);
              const cached = parsed[ch] || parsed[rawClean] || parsed[atClean] || parsed[justClean] || parsed[lowerCh] || parsed[lowerRaw] || parsed[lowerAt];
              if (cached) {
                setStreamStartTimes(prev => {
                  if (prev[ch] || prev[rawClean]) return prev;
                  return { ...prev, [ch]: cached, [rawClean]: cached, [atClean]: cached, [justClean]: cached, [lowerCh]: cached, [lowerRaw]: cached, [lowerAt]: cached };
                });
              }
            }
          } catch (e) {}
        }
        if (metadata && metadata.viewers !== undefined && metadata.viewers !== null) {
          setStreamViewers(prev => {
            const next = { 
              ...prev, 
              [ch]: metadata.viewers, 
              [rawClean]: metadata.viewers, 
              [atClean]: metadata.viewers, 
              [justClean]: metadata.viewers,
              [lowerCh]: metadata.viewers,
              [lowerRaw]: metadata.viewers,
              [lowerAt]: metadata.viewers
            };
            try { localStorage.setItem('prochat_cached_stream_viewers', JSON.stringify(next)); } catch (e) {}
            return next;
          });
        }
        if (metadata && metadata.likes !== undefined && metadata.likes !== null) {
          setStreamLikes(prev => {
            const next = { 
              ...prev, 
              [ch]: metadata.likes, 
              [rawClean]: metadata.likes, 
              [atClean]: metadata.likes, 
              [justClean]: metadata.likes,
              [lowerCh]: metadata.likes,
              [lowerRaw]: metadata.likes,
              [lowerAt]: metadata.likes
            };
            try { localStorage.setItem('prochat_cached_stream_likes', JSON.stringify(next)); } catch (e) {}
            return next;
          });
        }
        if (metadata && metadata.isShorts !== undefined) {
          setYoutubeShortsChannels(prev => {
            const next = new Set(prev);
            if (metadata.isShorts) {
              next.add(ch);
              next.add(rawClean);
              next.add(atClean);
              next.add(justClean);
              next.add(lowerCh);
              next.add(lowerRaw);
              next.add(lowerAt);
            } else {
              next.delete(ch);
              next.delete(rawClean);
              next.delete(atClean);
              next.delete(justClean);
              next.delete(lowerCh);
              next.delete(lowerRaw);
              next.delete(lowerAt);
            }
            try { localStorage.setItem('prochat_cached_youtube_shorts_channels', JSON.stringify(Array.from(next))); } catch (e) {}
            return next;
          });
        }
      } else if (status === 'offline' || status === 'disconnected') {
        // Retain cached stream start times during transient disconnections/polling drops
        // Only clear temporary viewers/likes metric
        setStreamViewers(prev => {
          const next = { ...prev };
          delete next[ch];
          delete next[rawClean];
          delete next[atClean];
          delete next[justClean];
          delete next[lowerCh];
          delete next[lowerRaw];
          delete next[lowerAt];
          try { localStorage.setItem('prochat_cached_stream_viewers', JSON.stringify(next)); } catch (e) {}
          return next;
        });
        setStreamLikes(prev => {
          const next = { ...prev };
          delete next[ch];
          delete next[rawClean];
          delete next[atClean];
          delete next[justClean];
          delete next[lowerCh];
          delete next[lowerRaw];
          delete next[lowerAt];
          try { localStorage.setItem('prochat_cached_stream_likes', JSON.stringify(next)); } catch (e) {}
          return next;
        });

        setYoutubeShortsChannels(prev => {
          const next = new Set(prev);
          next.delete(ch);
          next.delete(rawClean);
          next.delete(atClean);
          next.delete(justClean);
          next.delete(lowerCh);
          next.delete(lowerRaw);
          next.delete(lowerAt);
          try { localStorage.setItem('prochat_cached_youtube_shorts_channels', JSON.stringify(Array.from(next))); } catch (e) {}
          return next;
        });
      }
    };

    // Initialize Twitch Client
    twitchClientRef.current = new TwitchChatClient(handleNewMessage, handleStatusUpdate);

    // Initialize Kick Client
    kickClientRef.current = new KickChatClient(handleNewMessage, handleStatusUpdate);

    // Initialize YouTube Client
    youtubeClientRef.current = new YoutubeChatClient(
      handleNewMessage, 
      handleStatusUpdate,
      (channelId, realName) => {
        if (realName && !realName.toLowerCase().includes('404') && !realName.toLowerCase().includes('not found')) {
          const cleanName = (channelId || '').toLowerCase().replace(/^@+/, '').trim();
          setResolvedStreamerNames(prev => ({
            ...prev,
            [cleanName]: realName
          }));
        }
        setMessages(prev => prev.map(msg => {
          if (msg.platform === 'youtube' && msg.channelId === channelId) {
            return { ...msg, displayName: realName };
          }
          return msg;
        }));
      },
      (msgId, authorChannelId, deletedBy) => {
        if (msgId) {
          handleDeleteMessage(msgId, deletedBy);
        } else if (authorChannelId) {
          handleDeleteUserMessages(authorChannelId, deletedBy);
        }
      }
    );

    // Initialize Simulator
    simulatorRef.current = new ChatSimulator(handleNewMessage);

    setClientsInitialized(true);

    return () => {
      messageBuffer = [];
      if (dripTimer) clearInterval(dripTimer);
      if (twitchClientRef.current) twitchClientRef.current.disconnect();
      if (kickClientRef.current) kickClientRef.current.disconnect();
      if (youtubeClientRef.current) youtubeClientRef.current.disconnect();
      if (simulatorRef.current) simulatorRef.current.stop();
      if (window.ttsManager) window.ttsManager.cancel();
      setClientsInitialized(false);
    };
  }, []);

  // Cancel currently queued/speaking messages if TTS settings are toggled off
  useEffect(() => {
    if (settings && !settings.enableTts && !settings.enableSuperchatTts) {
      if (window.ttsManager) {
        window.ttsManager.cancel();
      }
    }
  }, [settings?.enableTts, settings?.enableSuperchatTts]);

  // Update channels subscription whenever the list of active channels changes
  useEffect(() => {
    const enabledChannels = activeChannels.filter(ch => ch.enabled);

    // 1. Manage Twitch IRC connections
    const twitchChannels = enabledChannels.filter(ch => ch.platform === 'twitch');
    if (twitchClientRef.current && !modeDemo) {
      if (twitchChannels.length > 0) {
        if (!twitchClientRef.current.isConnected) {
          twitchClientRef.current.connect();
        }
        if (twitchClientRef.current.channels) {
          Array.from(twitchClientRef.current.channels).forEach(ch => {
            if (!twitchChannels.some(tc => tc.name.toLowerCase().replace(/^@+/, '').trim() === ch.toLowerCase().replace(/^@+/, '').trim())) {
              twitchClientRef.current.leave(ch);
            }
          });
        }
        twitchChannels.forEach(ch => {
          twitchClientRef.current.join(ch.name);
        });
        setPlatformStatuses(prev => ({
          ...prev,
          twitch: twitchClientRef.current.isConnected ? 'connected' : 'connecting'
        }));
      } else {
        if (twitchClientRef.current.isConnected || twitchClientRef.current.socket) {
          twitchClientRef.current.disconnect();
        }
        setPlatformStatuses(prev => ({
          ...prev,
          twitch: 'disconnected'
        }));
      }
    }

    // 2. Manage Kick Pusher connections & Kick Live Status Polling
    const kickChannels = enabledChannels.filter(ch => ch.platform === 'kick');
    if (kickClientRef.current && !modeDemo) {
      if (kickChannels.length > 0) {
        if (!kickClientRef.current.isConnected) {
          kickClientRef.current.connect();
        }
        if (kickClientRef.current.channelsMap) {
          Array.from(kickClientRef.current.channelsMap.keys()).forEach(ch => {
            if (!kickChannels.some(kc => kc.name.toLowerCase().replace(/^@+/, '').trim() === ch)) {
              kickClientRef.current.leave(ch);
            }
          });
        }
        kickChannels.forEach(ch => {
          const cleanName = ch.name.toLowerCase().replace(/^@+/, '').trim();
          kickClientRef.current.join(ch.name);

          // Fetch real-time Kick stream status (LIVE vs OFFLINE)
          fetch(`/api/kick/api/v2/channels/${cleanName}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              const kickUser = data?.user;
              const kickDisplayName = kickUser?.username || kickUser?.display_name || kickUser?.name || data?.username || data?.name;
              if (kickDisplayName) {
                setResolvedStreamerNames(prev => ({ ...prev, [cleanName]: kickDisplayName }));
              }
              const livestream = data?.livestream;
              if (livestream && livestream.is_live !== false) {
                // Stream is LIVE on Kick
                const viewers = livestream.viewer_count || 0;
                const startTime = livestream.created_at || livestream.start_time;
                setStreamViewers(prev => {
                  const next = { ...prev, [cleanName]: viewers, [ch.name]: viewers, [`@${cleanName}`]: viewers };
                  try { localStorage.setItem('prochat_cached_stream_viewers', JSON.stringify(next)); } catch (e) {}
                  return next;
                });
                if (startTime) {
                  setStreamStartTimes(prev => {
                    const next = { ...prev, [cleanName]: startTime, [ch.name]: startTime, [`@${cleanName}`]: startTime };
                    try { localStorage.setItem('multichat_stream_start_times_v2', JSON.stringify(next)); } catch (e) {}
                    return next;
                  });
                }
                setPlatformStatuses(prev => ({ ...prev, [cleanName]: 'connected', kick: kickClientRef.current?.isConnected ? 'connected' : prev.kick }));
              } else {
                // Stream is OFFLINE on Kick (Chatroom is still active)
                setStreamViewers(prev => {
                  const next = { ...prev };
                  delete next[cleanName];
                  delete next[ch.name];
                  delete next[`@${cleanName}`];
                  try { localStorage.setItem('prochat_cached_stream_viewers', JSON.stringify(next)); } catch (e) {}
                  return next;
                });
                setStreamStartTimes(prev => {
                  const next = { ...prev };
                  delete next[cleanName];
                  delete next[ch.name];
                  delete next[`@${cleanName}`];
                  try { localStorage.setItem('multichat_stream_start_times_v2', JSON.stringify(next)); } catch (e) {}
                  return next;
                });
                if (kickClientRef.current && kickClientRef.current.isConnected) {
                  setPlatformStatuses(prev => ({ ...prev, [cleanName]: 'connected', kick: 'connected' }));
                }
              }
            })
            .catch(() => {
              // Maintain current stream viewers/start times during transient network errors
              if (kickClientRef.current && kickClientRef.current.isConnected) {
                setPlatformStatuses(prev => ({ ...prev, [cleanName]: 'connected', kick: 'connected' }));
              }
            });
        });
      } else {
        if (kickClientRef.current.isConnected || kickClientRef.current.socket) {
          kickClientRef.current.disconnect();
        }
        setPlatformStatuses(prev => ({
          ...prev,
          kick: 'disconnected'
        }));
      }
    }

    // 3. Manage YouTube polling connections
    const youtubeChannels = enabledChannels.filter(ch => ch.platform === 'youtube');
    if (youtubeClientRef.current && !modeDemo) {
      if (youtubeChannels.length > 0) {
        if (youtubeClientRef.current.activePolls) {
          Array.from(youtubeClientRef.current.activePolls.keys()).forEach(ch => {
            if (!youtubeChannels.some(yc => yc.name.toLowerCase().replace(/^@+/, '').trim() === ch)) {
              youtubeClientRef.current.leave(ch);
            }
          });
        }
        youtubeChannels.forEach(ch => {
          const cleanName = ch.name.toLowerCase().replace(/^@+/, '').trim();
          setPlatformStatuses(prev => ({
            ...prev,
            [cleanName]: prev[cleanName] === 'connected' ? 'connected' : 'connecting',
            youtube: 'connected'
          }));
          youtubeClientRef.current.join(ch.name, settings.youtubeChatMode || 'live');

          // Resolve YouTube channel display name (e.g. "@duplicatebunnysank9" -> "Duplicate Bunny Sank")
          if (youtubeClientRef.current && youtubeClientRef.current.resolveChannelName) {
            youtubeClientRef.current.resolveChannelName(ch.name).then(resolvedTitle => {
              if (resolvedTitle && !resolvedTitle.toLowerCase().includes('404') && !resolvedTitle.toLowerCase().includes('not found') && resolvedTitle.toLowerCase() !== 'youtube') {
                setResolvedStreamerNames(prev => ({
                  ...prev,
                  [cleanName]: resolvedTitle.replace(/^@+/, '')
                }));
              }
            }).catch(() => {});
          }
        });
      } else {
        youtubeClientRef.current.disconnect();
        setPlatformStatuses(prev => ({
          ...prev,
          youtube: 'disconnected'
        }));
      }
    }

    // 4. Manage Simulator for simulated streams / demo mode
    const simulatedChannels = enabledChannels.filter(ch => 
      ch.platform === 'tiktok' || ch.platform === 'rumble' || ch.platform === 'x'
    );
    if (simulatorRef.current) {
      if (simulatedChannels.length > 0 || modeDemo) {
        const channelsToSimulate = modeDemo 
          ? [
              { id: 'demo-youtube', name: 'DemoStreamerYT', platform: 'youtube', enabled: true },
              { id: 'demo-twitch', name: 'DemoStreamerTwitch', platform: 'twitch', enabled: true },
              { id: 'demo-kick', name: 'DemoStreamerKick', platform: 'kick', enabled: true }
            ]
          : simulatedChannels;
        simulatorRef.current.start(channelsToSimulate);
        
        // Force platform statuses to connected in demo mode
        if (modeDemo) {
          setPlatformStatuses(prev => ({
            ...prev,
            twitch: 'connected',
            youtube: 'connected',
            kick: 'connected'
          }));
        }
      } else {
        simulatorRef.current.stop();
      }
    }

    const currentEnabledKeys = new Set();
    enabledChannels.forEach(ch => {
      const raw = (ch.name || '').toLowerCase().trim();
      const clean = raw.replace(/^@+/, '').trim();
      currentEnabledKeys.add(raw);
      currentEnabledKeys.add(clean);
      currentEnabledKeys.add(`@${clean}`);
      currentEnabledKeys.add(ch.name);
    });

    setPlatformStatuses(prev => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        const cleanK = k.toLowerCase().replace(/^@+/, '').trim();
        if (k !== 'youtube' && k !== 'kick' && k !== 'twitch' && !currentEnabledKeys.has(cleanK) && !currentEnabledKeys.has(k)) {
          delete next[k];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setStreamViewers(prev => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (!currentEnabledKeys.has(k)) {
          delete next[k];
          changed = true;
        }
      });
      if (changed) localStorage.setItem('prochat_cached_stream_viewers', JSON.stringify(next));
      return changed ? next : prev;
    });
    setStreamLikes(prev => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (!currentEnabledKeys.has(k)) {
          delete next[k];
          changed = true;
        }
      });
      if (changed) localStorage.setItem('prochat_cached_stream_likes', JSON.stringify(next));
      return changed ? next : prev;
    });
    setStreamStartTimes(prev => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (!currentEnabledKeys.has(k) && !currentEnabledKeys.has(k.replace(/^@+/, ''))) {
          delete next[k];
          changed = true;
        }
      });
      if (changed) localStorage.setItem('multichat_stream_start_times_v2', JSON.stringify(next));
      return changed ? next : prev;
    });

  }, [activeChannels, modeDemo, settings.youtubeChatMode, clientsInitialized]);



  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Handle sending a streamer message to selected targets
  const handleSendMessage = async (text, targets) => {
    const promises = targets.map(async (target) => {
      let handleName = target.name || 'Streamer';
      let realDisplayName = target.displayName || handleName;
      let rawAvatar = target.avatar;

      if (target.platform === 'kick') {
        const storedKickUser = (typeof window !== 'undefined' ? localStorage.getItem('prochat_kick_username') : null) || '';
        const storedKickAvatar = (typeof window !== 'undefined' ? localStorage.getItem('prochat_kick_avatar') : null) || '';
        handleName = storedKickUser || target.name;
        realDisplayName = storedKickUser || (target.displayName && !target.displayName.startsWith('@') ? target.displayName : handleName);
        if (storedKickAvatar) rawAvatar = storedKickAvatar;
      } else if (target.platform === 'youtube') {
        handleName = user?.ytCustomHandle || target.name;
        realDisplayName = user?.ytChannelName || (target.displayName && !target.displayName.startsWith('@') ? target.displayName : handleName);
        if (user?.avatarUrl || user?.avatar) rawAvatar = user.avatarUrl || user.avatar;
      } else if (target.platform === 'twitch') {
        handleName = target.name;
        realDisplayName = target.displayName || target.name;
      }

      const validAvatarUrl = typeof rawAvatar === 'string' && rawAvatar.startsWith('http') ? rawAvatar : null;

      let tempOptId = null;
      // Skip local optimistic insertion for Kick so only official delivered messages from Kick WebSocket display in chat feed
      if (target.platform !== 'kick') {
        tempOptId = 'opt_' + Math.random().toString(36).substring(2, 11);
        const streamerMsg = {
          id: tempOptId,
          platform: target.platform,
          channel: target.name.toLowerCase(),
          username: handleName,
          displayName: realDisplayName,
          avatarUrl: validAvatarUrl || undefined,
          color: target.platform === 'twitch' ? '#9146ff' : '#ffc107',
          text: text,
          badges: ['broadcaster'],
          rawTimestamp: Date.now(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
        };
        setMessages(prev => [...prev, streamerMsg].slice(-300));
      }

      // Direct YouTube Live Chat API & Extension DOM Posting
      if (target.platform === 'youtube') {
        const liveChatId = resolveLiveChatId(target);

        // 1. Post via Chrome Extension DOM Dispatch if extension is active in browser
        if (typeof window !== 'undefined') {
          window.postMessage({ type: 'STREAMCLIPS_SEND_YOUTUBE_CHAT', message: text }, '*');
        }

        try {
          console.log('[MultiChat] Posting YouTube chat message with auto-detected live broadcast...');
          const res = await fetch('/api/youtube/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user?.id,
              userEmail: user?.email,
              channelId: user?.ytCustomHandle || user?.ytChannelId || user?.username,
              liveChatId: liveChatId,
              message: text
            })
          });

          const result = await res.json();
          if (!res.ok) {
            console.warn('[MultiChat] YouTube Chat Send notice:', result.error || result);
            const rawErr = typeof result.error === 'string' ? result.error : JSON.stringify(result.error || '');
            const cleanErr = rawErr.replace(/<[^>]*>?/gm, '').trim();
            alert(cleanErr || 'Failed to send YouTube live chat message.');
          }
        } catch (err) {
          console.warn('[MultiChat] Failed to dispatch YouTube message:', err);
        }
      }

      // Direct Kick Live Chat API Posting
      if (target.platform === 'kick') {
        try {
          const cleanName = target.name.toLowerCase().replace(/^@+/, '').trim();
          const kickToken = (typeof window !== 'undefined' ? localStorage.getItem('prochat_kick_auth_token') : null) || '';
          const kickRefreshToken = (typeof window !== 'undefined' ? localStorage.getItem('prochat_kick_refresh_token') : null) || '';
          const kickUser = (typeof window !== 'undefined' ? localStorage.getItem('prochat_kick_username') : null) || '';
          const kickCookie = (typeof window !== 'undefined' ? localStorage.getItem('prochat_kick_cookie') : null) || '';
          const cachedChatroomId = (typeof window !== 'undefined' ? localStorage.getItem(`prochat_kick_chatroom_id_${cleanName}`) : null) ||
                                    kickClientRef.current?.channelsMap?.get(cleanName) || '';

          const res = await fetch('/api/kick/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send',
              channel: target.name,
              message: text,
              userEmail: user?.email,
              userId: user?.id,
              kickUser,
              chatroomId: cachedChatroomId,
              kickToken,
              kickRefreshToken,
              kickCookie
            })
          });

          const result = await res.json();
          if (!res.ok || !result.success) {
            console.warn('[MultiChat] Kick Chat Send notice:', result?.error);
            // Roll back optimistic message if delivery to Kick failed
            if (tempOptId) {
              setMessages(prev => prev.filter(m => m.id !== tempOptId));
            }
            const errStr = typeof result?.error === 'string' ? result.error : 'Failed to send Kick chat message';
            alert(`Kick Chat Notice: ${errStr}`);
          } else {
            console.log('[MultiChat] Successfully posted Kick chat message:', result);
            if (result.newToken && typeof window !== 'undefined') {
              localStorage.setItem('prochat_kick_auth_token', result.newToken);
            }
            if (result.chatroomId && typeof window !== 'undefined') {
              localStorage.setItem(`prochat_kick_chatroom_id_${cleanName}`, String(result.chatroomId));
            }
          }
        } catch (err) {
          console.warn('[MultiChat] Failed to dispatch Kick message:', err);
          if (tempOptId) {
            setMessages(prev => prev.filter(m => m.id !== tempOptId));
          }
          alert(`Kick Chat Notice: Network error when posting to Kick chat (${err.message}).`);
        }
      }
    });

    await Promise.all(promises);
  };

  const handleHeadlessConnectYouTube = async () => {
    try {
      alert('Opening Google Account Picker window... Please select your account in the window.');
      const res = await fetch('/api/youtube/headless-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email })
      });
      const data = await res.json();
      if (data.success) {
        alert(`🎉 YouTube Account (${data.handle}) Connected Successfully!`);
      } else {
        alert(`Connection notice: ${data.error || 'Could not complete login.'}`);
      }
    } catch (e) {
      console.warn('Headless connect exception:', e);
    }
  };

  const resolveLiveChatId = (msgObj) => {
    if (msgObj?.liveChatId && typeof msgObj.liveChatId === 'string') {
      const trimmed = msgObj.liveChatId.trim();
      if (trimmed.length >= 11 && !trimmed.startsWith('sys-') && !trimmed.startsWith('LCC.') && !trimmed.startsWith('@') && !trimmed.startsWith('UC')) {
        return trimmed;
      }
    }
    if (msgObj?.videoId && typeof msgObj.videoId === 'string') {
      const trimmed = msgObj.videoId.trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    }
    const channelKey = (msgObj?.channel || msgObj?.name || '').toLowerCase().replace(/^@+/, '').trim();
    if (channelKey && youtubeClientRef.current?.activePolls?.has(channelKey)) {
      const poll = youtubeClientRef.current.activePolls.get(channelKey);
      if (poll?.videoId) return poll.videoId;
      if (poll?.liveChatId) return poll.liveChatId;
    }
    if (youtubeClientRef.current?.activePolls) {
      for (const [_, p] of youtubeClientRef.current.activePolls) {
        if (p?.videoId) return p.videoId;
        if (p?.liveChatId) return p.liveChatId;
      }
    }
    return '';
  };

  const resolveTargetChannelId = (msgObj) => {
    if (msgObj && typeof msgObj === 'object') {
      const candidates = [msgObj.channelId, msgObj.authorChannelId, msgObj.userId, msgObj.authorExternalChannelId];
      for (const cand of candidates) {
        if (cand && typeof cand === 'string' && cand.startsWith('UC')) {
          return cand;
        }
      }
    }
    const username = (msgObj?.username || msgObj?.displayName || (typeof msgObj === 'string' ? msgObj : '')).replace(/^@+/, '').trim().toLowerCase();
    if (username && Array.isArray(messages)) {
      const match = messages.find(m => {
        const u1 = (m.username || '').replace(/^@+/, '').trim().toLowerCase();
        const u2 = (m.displayName || '').replace(/^@+/, '').trim().toLowerCase();
        return (u1 === username || u2 === username) && (
          (m.channelId && typeof m.channelId === 'string' && m.channelId.startsWith('UC')) ||
          (m.authorChannelId && typeof m.authorChannelId === 'string' && m.authorChannelId.startsWith('UC')) ||
          (m.userId && typeof m.userId === 'string' && m.userId.startsWith('UC'))
        );
      });
      if (match) {
        return match.channelId || match.authorChannelId || match.userId;
      }
    }
    return (msgObj && typeof msgObj === 'object') ? (msgObj.channelId || msgObj.authorChannelId || msgObj.userId || '') : (typeof msgObj === 'string' ? msgObj : '');
  };

  const getModeratorHandle = (msgObj) => {
    const verifiedCh = activeChannels.find(ch => ch.enabled && ch.verified && ch.platform === msgObj?.platform);
    if (verifiedCh) {
      return (verifiedCh.displayName || verifiedCh.name || '').replace(/^@+/, '');
    }
    const custom = user?.custom_handle || user?.ytCustomHandle || user?.channel_name || user?.ytChannelName || user?.username || user?.user_metadata?.custom_handle || user?.user_metadata?.full_name;
    if (custom && custom !== 'Streamer' && !custom.toLowerCase().includes('404')) {
      return custom.replace(/^@+/, '');
    }
    return '';
  };

  const formatDurationText = (sec) => {
    if (sec === 10) return '10 seconds';
    if (sec === 60) return '60 seconds';
    if (sec === 300) return '5 minutes';
    if (sec === 600) return '10 minutes';
    if (sec === 1800) return '30 minutes';
    if (sec === 86400) return '24 hours';
    return sec >= 60 ? `${Math.floor(sec / 60)} minutes` : `${sec} seconds`;
  };

  // Moderation Handlers
  const handleDeleteMessage = async (msgOrId, explicitDeletedBy = null) => {
    const msgId = typeof msgOrId === 'object' ? msgOrId.id : msgOrId;
    const msgObj = typeof msgOrId === 'object' 
      ? msgOrId 
      : messages.find(m => String(m.id) === String(msgId));
    
    // Check if the channel is connected with the current account
    const isChannelConnected = activeChannels.some(ch => 
      ch.platform === msgObj?.platform && 
      ch.verified && 
      ch.enabled &&
      (ch.name?.toLowerCase().replace(/^@+/, '') === (msgObj?.channel || '').toLowerCase().replace(/^@+/, '') ||
       ch.id === msgObj?.channelId)
    );

    let modActor = explicitDeletedBy || (typeof msgOrId === 'object' && msgOrId?.deletedBy ? msgOrId.deletedBy : null);
    if (!modActor && isChannelConnected) {
      const handle = getModeratorHandle(msgObj);
      if (handle) modActor = handle;
    }

    setModeration(prev => {
      const next = new Set(prev.deletedMessageIds);
      next.add(msgId);
      const nextMap = new Map(prev.deletedByMap || []);
      if (modActor) {
        nextMap.set(msgId, modActor);
      }
      return { ...prev, deletedMessageIds: next, deletedByMap: nextMap };
    });

    const platform = msgObj?.platform || 'youtube';
    if (platform === 'youtube' && user) {
      const liveChatId = resolveLiveChatId(msgObj);
      const targetChannelId = resolveTargetChannelId(msgObj) || msgObj?.username || msgObj?.displayName || '';
      const activeVideoId = settings?.youtubeVideoId || (liveChatId && /^[a-zA-Z0-9_-]{11}$/.test(liveChatId.trim()) ? liveChatId.trim() : (msgObj?.videoId || ''));
      console.log('[MultiChat] Executing YouTube API delete message:', msgId, 'videoId:', activeVideoId);
      try {
        const res = await fetch('/api/youtube/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id, userEmail: user?.email,
              channelId: user?.ytCustomHandle || user?.ytChannelId || user?.username,
              action: 'delete',
            messageId: msgId,
            videoId: activeVideoId,
            video_id: activeVideoId,
            params: msgObj?.deleteParams || msgObj?.params || '',
            deleteParams: msgObj?.deleteParams || msgObj?.params || '',
            menuParams: msgObj?.menuParams || '',
            message: msgObj?.text || msgObj?.message || '',
            liveChatId: liveChatId,
            targetChannelId: targetChannelId,
            username: msgObj?.username || msgObj?.displayName || ''
          })
        });
        const data = await res.json();
        console.log('[MultiChat] YouTube API delete result:', data);
      } catch (err) {
        console.warn('[MultiChat] YouTube API delete error:', err);
      }
    }
  };

  const handleDeleteUserMessages = (authorChannelId, explicitDeletedBy = null) => {
    setMessages(prevMessages => {
      const targetMsgs = prevMessages.filter(msg => msg.platform === 'youtube' && msg.channelId === authorChannelId);
      const targetIds = targetMsgs.map(msg => msg.id);

      if (targetIds.length > 0) {
        setModeration(prev => {
          const next = new Set(prev.deletedMessageIds);
          const nextMap = new Map(prev.deletedByMap || []);
          targetIds.forEach(id => {
            next.add(id);
            if (explicitDeletedBy) nextMap.set(id, explicitDeletedBy);
          });
          return { ...prev, deletedMessageIds: next, deletedByMap: nextMap };
        });
      }
      return prevMessages;
    });
  };

  const handleTimeoutUser = async (msgOrUser, durationSeconds = 300) => {
    const isObj = typeof msgOrUser === 'object' && msgOrUser !== null;
    const rawUsername = isObj ? (msgOrUser.username || msgOrUser.displayName) : msgOrUser;
    const cleanUser = (rawUsername || '').replace(/^@+/, '').trim();
    const cleanUserLower = cleanUser.toLowerCase();

    const msgObj = (isObj && (msgOrUser.timeoutParams || msgOrUser.menuParams || msgOrUser.params))
      ? msgOrUser 
      : ([...messages].reverse().find(m => {
          const u1 = (m.username || '').replace(/^@+/, '').trim().toLowerCase();
          const u2 = (m.displayName || '').replace(/^@+/, '').trim().toLowerCase();
          const u3 = (m.author || '').replace(/^@+/, '').trim().toLowerCase();
          const u4 = (m.channelId || m.authorChannelId || m.authorExternalChannelId || '').replace(/^@+/, '').trim().toLowerCase();
          return u1 === cleanUserLower || u2 === cleanUserLower || u3 === cleanUserLower || (u4 && u4 === cleanUserLower);
        }) || (isObj ? msgOrUser : null));

    const targetUsernames = new Set([cleanUserLower]);
    if (msgObj?.username) targetUsernames.add(msgObj.username.replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.displayName) targetUsernames.add(msgObj.displayName.replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.channelId) targetUsernames.add(msgObj.channelId);
    if (msgObj?.userId) targetUsernames.add(msgObj.userId);

    const expiryTime = Date.now() + durationSeconds * 1000;
    const modHandle = getModeratorHandle(msgObj);
    const durationStr = formatDurationText(durationSeconds);

    setModeration(prev => {
      const nextTimedOut = (prev.timedOutUsers instanceof Map) 
        ? new Map(prev.timedOutUsers) 
        : new Map();
      targetUsernames.forEach(name => {
        if (name) nextTimedOut.set(name, expiryTime);
      });

      return { ...prev, timedOutUsers: nextTimedOut };
    });
    setSelectedChatter(null);

    setMessages(prev => [
      ...prev,
      {
        id: 'sys-timeout-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        platform: msgObj?.platform || 'youtube',
        channel: msgObj?.channel || 'global',
        username: 'System',
        displayName: 'System',
        text: `@${cleanUser} was timed out by @${modHandle} for ${durationStr}.`,
        isSystemEvent: true,
        eventType: 'moderation',
        rawTimestamp: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      }
    ]);

    const targetChannelId = resolveTargetChannelId(msgObj) || cleanUser;
    const liveChatId = resolveLiveChatId(msgObj);
    const targetEmail = user?.email || (typeof window !== 'undefined' ? localStorage.getItem('prochat_user_email') : null);
    const activeVideoId = settings?.youtubeVideoId || (liveChatId && /^[a-zA-Z0-9_-]{11}$/.test(liveChatId.trim()) ? liveChatId.trim() : (msgObj?.videoId || ''));

    console.log('[MultiChat] Executing YouTube API timeout user:', cleanUser, 'videoId:', activeVideoId, 'durationSeconds:', durationSeconds);
    try {
      const res = await fetch('/api/youtube/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id, userEmail: user?.email || targetEmail,
            channelId: user?.ytCustomHandle || user?.ytChannelId || user?.username,
            action: 'timeout',
          videoId: activeVideoId,
          video_id: activeVideoId,
          targetChannelId: targetChannelId,
          durationSeconds: durationSeconds,
          liveChatId: liveChatId,
          messageId: msgObj?.id,
          params: msgObj?.timeoutParams || msgObj?.params || '',
          timeoutParams: msgObj?.timeoutParams || msgObj?.params || '',
          menuParams: msgObj?.menuParams || ''
        })
      });
      const data = await res.json();
      console.log('[MultiChat] YouTube API timeout result:', data);
    } catch (err) {
      console.warn('[MultiChat] YouTube API timeout error:', err);
    }
  };

  const handleBanUser = async (msgOrUser) => {
    const isObj = typeof msgOrUser === 'object' && msgOrUser !== null;
    const username = isObj ? (msgOrUser.displayName || msgOrUser.username || msgOrUser.author) : msgOrUser;
    const cleanUser = (username || '').replace(/^@+/, '').trim();
    const cleanUserLower = cleanUser.toLowerCase();

    const msgObj = (isObj && (msgOrUser.banParams || msgOrUser.menuParams || msgOrUser.params))
      ? msgOrUser 
      : ([...messages].reverse().find(m => {
          const u1 = (m.username || '').replace(/^@+/, '').trim().toLowerCase();
          const u2 = (m.displayName || '').replace(/^@+/, '').trim().toLowerCase();
          const u3 = (m.author || '').replace(/^@+/, '').trim().toLowerCase();
          const u4 = (m.channelId || m.authorChannelId || m.authorExternalChannelId || '').replace(/^@+/, '').trim().toLowerCase();
          return u1 === cleanUserLower || u2 === cleanUserLower || u3 === cleanUserLower || (u4 && u4 === cleanUserLower);
        }) || (isObj ? msgOrUser : null));

    const targetUsernames = new Set([cleanUserLower]);
    if (msgObj?.username) targetUsernames.add(msgObj.username.replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.displayName) targetUsernames.add(msgObj.displayName.replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.channelId) targetUsernames.add(msgObj.channelId);
    if (msgObj?.userId) targetUsernames.add(msgObj.userId);

    const modHandle = getModeratorHandle(msgObj);

    setModeration(prev => {
      const nextBanned = (prev.bannedUsers instanceof Set) ? new Set(prev.bannedUsers) : new Set();
      targetUsernames.forEach(name => {
        if (name) nextBanned.add(name);
      });

      return { ...prev, bannedUsers: nextBanned };
    });
    setSelectedChatter(null);

    setMessages(prev => [
      ...prev,
      {
        id: 'sys-ban-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        platform: msgObj?.platform || 'youtube',
        channel: msgObj?.channel || 'global',
        username: 'System',
        displayName: 'System',
        text: `@${cleanUser} was banned/hidden by @${modHandle}.`,
        isSystemEvent: true,
        eventType: 'moderation',
        rawTimestamp: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      }
    ]);

    const targetChannelId = resolveTargetChannelId(msgObj) || cleanUser;
    const liveChatId = resolveLiveChatId(msgObj);
    const targetEmail = user?.email || (typeof window !== 'undefined' ? localStorage.getItem('prochat_user_email') : null);
    const activeVideoId = settings?.youtubeVideoId || (liveChatId && /^[a-zA-Z0-9_-]{11}$/.test(liveChatId.trim()) ? liveChatId.trim() : (msgObj?.videoId || ''));

    console.log('[MultiChat] Executing YouTube API ban user:', cleanUser, 'videoId:', activeVideoId);
    try {
      const res = await fetch('/api/youtube/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id, userEmail: user?.email || targetEmail,
            channelId: user?.ytCustomHandle || user?.ytChannelId || user?.username,
            action: 'ban',
          videoId: activeVideoId,
          video_id: activeVideoId,
          targetChannelId: targetChannelId,
          liveChatId: liveChatId,
          messageId: msgObj?.id,
          params: msgObj?.banParams || msgObj?.params || '',
          banParams: msgObj?.banParams || msgObj?.params || '',
          menuParams: msgObj?.menuParams || ''
        })
      });
      const data = await res.json();
      console.log('[MultiChat] YouTube API ban result:', data);
    } catch (err) {
      console.warn('[MultiChat] YouTube API ban error:', err);
    }

    const keysToBan = new Set();
    if (cleanUser) keysToBan.add(String(cleanUser).toLowerCase());
    if (msgObj?.username) keysToBan.add(String(msgObj.username).replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.displayName) keysToBan.add(String(msgObj.displayName).replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.author) keysToBan.add(String(msgObj.author).replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.channelId) keysToBan.add(String(msgObj.channelId).toLowerCase());
    if (msgObj?.authorChannelId) keysToBan.add(String(msgObj.authorChannelId).toLowerCase());
    if (msgObj?.userId) keysToBan.add(String(msgObj.userId).toLowerCase());

    setModeration(prev => {
      const nextBanned = new Set(prev.bannedUsers);
      keysToBan.forEach(k => nextBanned.add(k));

      const nextDeleted = new Set(prev.deletedMessageIds);
      messages.forEach(m => {
        const u1 = String(m.username || '').replace(/^@+/, '').trim().toLowerCase();
        const u2 = String(m.displayName || '').replace(/^@+/, '').trim().toLowerCase();
        const u3 = String(m.author || '').replace(/^@+/, '').trim().toLowerCase();
        const cId = String(m.channelId || m.authorChannelId || m.userId || '').toLowerCase();
        if (keysToBan.has(u1) || keysToBan.has(u2) || keysToBan.has(u3) || keysToBan.has(cId)) {
          nextDeleted.add(m.id);
        }
      });

      return { ...prev, bannedUsers: nextBanned, deletedMessageIds: nextDeleted };
    });
    setBlockedUsers(prev => {
      const next = new Set(prev);
      keysToBan.forEach(k => next.add(k));
      return next;
    });
    setSelectedChatter(null);
  };

  const handleUnbanUser = async (msgOrUser) => {
    const username = typeof msgOrUser === 'object' ? (msgOrUser.displayName || msgOrUser.username || msgOrUser.author) : msgOrUser;
    const cleanUser = String(username || '').replace(/^@+/, '').trim();
    const msgObj = typeof msgOrUser === 'object' ? msgOrUser : messages.find(m => {
      const u1 = String(m.username || '').replace(/^@+/, '').trim().toLowerCase();
      const u2 = String(m.displayName || '').replace(/^@+/, '').trim().toLowerCase();
      return u1 === cleanUser.toLowerCase() || u2 === cleanUser.toLowerCase();
    });
    const modHandle = getModeratorHandle(msgObj);

    const keysToUnban = new Set();
    if (cleanUser) keysToUnban.add(String(cleanUser).toLowerCase());
    if (msgObj?.username) keysToUnban.add(String(msgObj.username).replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.displayName) keysToUnban.add(String(msgObj.displayName).replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.author) keysToUnban.add(String(msgObj.author).replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.channelId) keysToUnban.add(String(msgObj.channelId).toLowerCase());
    if (msgObj?.authorChannelId) keysToUnban.add(String(msgObj.authorChannelId).toLowerCase());
    if (msgObj?.userId) keysToUnban.add(String(msgObj.userId).toLowerCase());

    setModeration(prev => {
      const nextBanned = new Set(prev.bannedUsers);
      keysToUnban.forEach(k => nextBanned.delete(k));
      return { ...prev, bannedUsers: nextBanned };
    });
    setBlockedUsers(prev => {
      const next = new Set(prev);
      keysToUnban.forEach(k => next.delete(k));
      return next;
    });
    setSelectedChatter(null);

    setMessages(prev => [
      ...prev,
      {
        id: 'sys-unban-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        platform: msgObj?.platform || 'youtube',
        channel: msgObj?.channel || 'global',
        username: 'System',
        displayName: 'System',
        text: `@${cleanUser} was unhidden on channel by @${modHandle}.`,
        isSystemEvent: true,
        eventType: 'moderation',
        rawTimestamp: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      }
    ]);

    const platform = msgObj?.platform || 'youtube';
    if (platform === 'youtube' && user) {
      const liveChatId = resolveLiveChatId(msgObj);
      const targetChannelId = resolveTargetChannelId(msgObj) || cleanUser;
      console.log('[MultiChat] Executing YouTube API unban user:', cleanUser, 'targetChannelId:', targetChannelId);
      try {
        const res = await fetch('/api/youtube/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id, userEmail: user?.email,
              channelId: user?.ytCustomHandle || user?.ytChannelId || user?.username,
              action: 'unban',
            targetChannelId: targetChannelId,
            username: cleanUser,
            displayName: msgObj?.displayName || cleanUser,
            liveChatId: liveChatId
          })
        });
        const data = await res.json();
        console.log('[MultiChat] YouTube API unban result:', data);
      } catch (err) {
        console.warn('[MultiChat] YouTube API unban error:', err);
      }
    }
  };

  const handleToggleModerator = async (msg) => {
    if (!msg || (msg.platform && msg.platform !== 'youtube')) return;
    const liveChatId = resolveLiveChatId(msg);
    const cleanUser = (msg.displayName || msg.username || msg.author || '').replace(/^@+/, '').trim();
    const targetChannelId = resolveTargetChannelId(msg) || cleanUser;
    const isMod = msg.badges && msg.badges.includes('moderator');
    const action = isMod ? 'remove_moderator' : 'add_moderator';
    const targetEmail = user?.email || (typeof window !== 'undefined' ? localStorage.getItem('prochat_user_email') : null);
    const activeVideoId = settings?.youtubeVideoId || (liveChatId && /^[a-zA-Z0-9_-]{11}$/.test(liveChatId.trim()) ? liveChatId.trim() : (msg?.videoId || ''));

    console.log('[MultiChat] Executing YouTube API toggle moderator:', action, 'cleanUser:', cleanUser, 'targetChannelId:', targetChannelId);

    try {
      const res = await fetch('/api/youtube/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id, userEmail: user?.email || targetEmail,
            channelId: user?.ytCustomHandle || user?.ytChannelId || user?.username,
            action: action,
          videoId: activeVideoId,
          video_id: activeVideoId,
          targetChannelId: targetChannelId,
          username: cleanUser,
          displayName: cleanUser,
          modId: msg.modId || targetChannelId,
          liveChatId: liveChatId,
          messageId: msg?.id,
          params: msg?.menuParams || msg?.params || '',
          menuParams: msg?.menuParams || ''
        })
      });
      const data = await res.json();
      console.log('[MultiChat] YouTube API toggle moderator result:', data);

      if (res.ok && data.success !== false && !data.error) {
        setMessages(prev => prev.map(m => {
          const mUser = (m.displayName || m.username || m.author || '').replace(/^@+/, '').trim();
          if (mUser.toLowerCase() === cleanUser.toLowerCase() || (targetChannelId && m.channelId === targetChannelId)) {
            const currentBadges = m.badges || [];
            const newBadges = isMod ? currentBadges.filter(b => b !== 'moderator') : [...new Set([...currentBadges, 'moderator'])];
            return { ...m, badges: newBadges };
          }
          return m;
        }));

        setMessages(prev => [
          ...prev,
          {
            id: 'sys-mod-ok-' + Date.now(),
            platform: 'youtube',
            channel: msg.channel || 'global',
            username: 'System',
            displayName: 'System',
            text: isMod ? `@${cleanUser} is no longer a moderator on YouTube.` : `@${cleanUser} was granted moderator status on YouTube!`,
            isSystemEvent: true,
            eventType: 'moderation',
            rawTimestamp: Date.now(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: 'sys-mod-err-' + Date.now(),
            platform: 'youtube',
            channel: msg.channel || 'global',
            username: 'System',
            displayName: 'System',
            text: `⚠️ YouTube API Moderator Notice for @${cleanUser}: ${data.error || data.warning || 'Failed to update moderator status on YouTube.'}`,
            isSystemEvent: true,
            eventType: 'error',
            rawTimestamp: Date.now(),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
          }
        ]);
      }
    } catch (err) {
      console.warn('[MultiChat] YouTube API moderator toggle error:', err);
    }
  };

  // Memoized: only recomputes when the messages array changes, not on every render
  const uniqueChatters = useMemo(() => {
    const chattersMap = new Map();
    messages.forEach(msg => {
      if (!msg.username) return;
      if (msg.isSystemEvent && msg.eventType !== 'donation' && msg.eventType !== 'subscription') return;
      const lower = msg.username.toLowerCase();
      if (!chattersMap.has(lower)) {
        chattersMap.set(lower, {
          username: msg.username,
          displayName: msg.displayName || msg.username,
          platform: msg.platform,
          channel: msg.channel,
          channelId: msg.channelId || msg.authorChannelId,
          authorChannelId: msg.authorChannelId,
          isShorts: msg.isShorts,
          avatar: msg.avatar,
          badges: msg.badges ? [...msg.badges] : [],
          badgeImages: msg.badgeImages || {},
          badgeVersions: msg.badgeVersions || {},
          color: msg.color,
          youtubeRank: msg.youtubeRank,
          monthsSubscribed: msg.monthsSubscribed,
          giftedSubsCount: msg.giftedSubsCount
        });
      } else {
        const existing = chattersMap.get(lower);
        if (msg.youtubeRank && !existing.youtubeRank) existing.youtubeRank = msg.youtubeRank;
        if (msg.badges && msg.badges.length > 0) {
          existing.badges = Array.from(new Set([...existing.badges, ...msg.badges]));
        }
        if (msg.avatar && (!existing.avatar || existing.avatar.includes('default'))) {
          existing.avatar = msg.avatar;
        }
      }
    });
    return Array.from(chattersMap.values());
  }, [messages]);

  const youtubeTop3Ranks = useMemo(() => calculateYoutubeTop3Ranks(messages), [messages]);

  // windowEnd = null  →  live mode: always show the last 200 messages (newest at bottom)
  // windowEnd = N      →  history mode: show messages[N-200 .. N], frozen while user reads
  const [windowEnd, setWindowEnd] = useState(null);

  // Offset windowEnd when messages array shifts from the front to prevent scroll jumps
  const prevMessagesRef = useRef([]);
  useEffect(() => {
    const oldMessages = prevMessagesRef.current;
    prevMessagesRef.current = messages;

    if (windowEnd !== null && oldMessages.length > 0 && messages.length > 0) {
      const newFirstId = messages[0]?.id;
      const oldIndex = oldMessages.findIndex(m => m.id === newFirstId);
      if (oldIndex > 0) {
        setWindowEnd(prev => {
          if (prev === null) return null;
          return Math.max(200, prev - oldIndex);
        });
      } else if (oldIndex === -1) {
        setWindowEnd(prev => {
          if (prev === null) return null;
          return Math.min(prev, messages.length);
        });
      }
    }
  }, [messages, windowEnd]);

  // Stable ref so handleLoadMore can read messages.length without being in its dep array
  const messagesLengthRef = useRef(messages.length);
  messagesLengthRef.current = messages.length;

  // Slide the window 200 messages further back into history.
  // First call freezes the window at the current live end; subsequent calls keep sliding.
  const handleLoadMore = useCallback(() => {
    setWindowEnd(prev => {
      const currentEnd = prev !== null ? prev : messagesLengthRef.current;
      return Math.max(200, currentEnd - 200); // never go before the 200th message
    });
  }, []);

  // Return to live mode — window snaps back to the latest 200 messages
  const handleResetDisplay = useCallback(() => {
    setWindowEnd(null);
  }, []);

  // Freeze the window at the current end when scrolling up manually
  const handleScrollUp = useCallback(() => {
    setWindowEnd(prev => {
      if (prev !== null) return prev;
      return messagesLengthRef.current;
    });
  }, []);

  const recentMessages = useMemo(() => {
    if (activeTab === 'events') {
      const events = messages.filter(m => m.isSystemEvent);
      if (events.length <= 200) return events;
      return events.slice(-200);
    }
    if (activeTab === 'mentions') {
      const mentions = messages.filter(m => checkIsMentioned(m.text, user, activeChannels));
      if (mentions.length <= 200) return mentions;
      return mentions.slice(-200);
    }

    if (windowEnd === null) {
      if (messages.length <= 200) return messages;
      return messages.slice(-200); // live: always newest 200
    }
    const end = Math.min(windowEnd, messages.length);
    const start = Math.max(0, end - 200);
    return messages.slice(start, end);            // history: frozen 200-message window
  }, [messages, windowEnd, activeTab, user, activeChannels]);

  // True when the visible window doesn't start at the very beginning of history
  const hasMore = windowEnd !== null ? windowEnd > 200 : messages.length > 200;

  const [viewerDisplayMode, setViewerDisplayMode] = useState('individual'); // 'individual' | 'combined' | 'hidden'
  const [uptimeDisplayMode, setUptimeDisplayMode] = useState('individual'); // 'individual' | 'combined' | 'hidden'
  const [likesDisplayMode, setLikesDisplayMode] = useState('individual'); // 'individual' | 'combined' | 'hidden'
  const [superchatDisplayMode, setSuperchatDisplayMode] = useState('amount'); // 'amount' | 'hidden'
  const [membershipDisplayMode, setMembershipDisplayMode] = useState('count'); // 'count' | 'hidden'
  const [participantFilter, setParticipantFilter] = useState('all');

  // Memoized counts — only recalculate when uniqueChatters changes
  const { youtubeCount, kickCount, twitchCount, totalCount } = useMemo(() => ({
    youtubeCount: uniqueChatters.filter(c => c.platform === 'youtube').length,
    kickCount:    uniqueChatters.filter(c => c.platform === 'kick').length,
    twitchCount:  uniqueChatters.filter(c => c.platform === 'twitch').length,
    totalCount:   uniqueChatters.length,
  }), [uniqueChatters]);

  const filteredChatters = useMemo(() =>
    uniqueChatters.filter(c => participantFilter === 'all' || c.platform === participantFilter),
  [uniqueChatters, participantFilter]);

  const isChannelLive = useCallback((ch) => {
    const cleanName = ch.name.toLowerCase().replace(/^@+/, '').trim();
    const rawClean = ch.name.toLowerCase().replace('@', '').trim();
    const lowerName = ch.name.toLowerCase();
    const status = platformStatuses[cleanName] || platformStatuses[rawClean] || platformStatuses[lowerName] || platformStatuses[ch.platform];
    const realCount = streamViewers[cleanName] ?? streamViewers[rawClean] ?? streamViewers[`@${cleanName}`] ?? streamViewers[ch.name] ?? streamViewers[lowerName] ?? 0;
    const realLikes = streamLikes[cleanName] ?? streamLikes[rawClean] ?? streamLikes[`@${cleanName}`] ?? streamLikes[ch.name] ?? streamLikes[lowerName] ?? 0;
    const startTime = streamStartTimes[cleanName] ?? streamStartTimes[rawClean] ?? streamStartTimes[`@${cleanName}`] ?? streamStartTimes[`@${rawClean}`] ?? streamStartTimes[ch.name] ?? streamStartTimes[lowerName];
    const isConnected = status === 'connected' || status === 'live';
    return realCount > 0 || realLikes > 0 || (isConnected && (ch.platform === 'youtube' ? (realCount > 0 || !!startTime) : !!startTime));
  }, [platformStatuses, streamViewers, streamLikes, streamStartTimes]);

  const enabledChannels = useMemo(() => activeChannels.filter(ch => ch.enabled), [activeChannels]);
  const liveChannels = useMemo(() => enabledChannels.filter(ch => isChannelLive(ch)), [enabledChannels, isChannelLive]);
  const hasAnyLive = liveChannels.length > 0;

  const viewersByPlatform = {};
  const uptimesByPlatform = {};
  const likesByPlatform = {};

  const targetChannelsForMetrics = hasAnyLive ? liveChannels : enabledChannels;

  targetChannelsForMetrics.forEach(ch => {
    const cleanName = ch.name.toLowerCase().replace(/^@+/, '').trim();
    const rawClean = ch.name.toLowerCase().replace('@', '').trim();
    const lowerName = ch.name.toLowerCase();
    const status = platformStatuses[cleanName] || platformStatuses[rawClean] || platformStatuses[lowerName] || platformStatuses[ch.platform];
    const isShorts = ch.platform === 'youtube' && (youtubeShortsChannels.has(cleanName) || youtubeShortsChannels.has(rawClean));
    const displayPlatform = isShorts ? 'youtube_shorts' : ch.platform;

    // 1. Calculate watchers count for this channel
    const realCount = streamViewers[cleanName] ?? streamViewers[rawClean] ?? streamViewers[`@${cleanName}`] ?? streamViewers[ch.name] ?? streamViewers[lowerName] ?? 0;
    const isChannelConnected = status === 'connected' || status === 'live' || realCount > 0;
    
    let count = isChannelConnected ? realCount : (realCount > 0 ? realCount : 0);
    if (!viewersByPlatform[displayPlatform]) {
      viewersByPlatform[displayPlatform] = 0;
    }
    viewersByPlatform[displayPlatform] += count;

    // 2. Calculate likes count for this channel (YouTube only)
    if (ch.platform === 'youtube') {
      const realLikes = streamLikes[cleanName] ?? streamLikes[rawClean] ?? streamLikes[`@${cleanName}`] ?? streamLikes[ch.name] ?? streamLikes[lowerName] ?? 0;
      let lCount = isChannelConnected ? realLikes : (realLikes > 0 ? realLikes : 0);
      if (!likesByPlatform[displayPlatform]) {
        likesByPlatform[displayPlatform] = 0;
      }
      likesByPlatform[displayPlatform] += lCount;
    }

    // 3. Calculate elapsed stream duration for this channel
    const isStreamActive = ch.platform === 'youtube'
      ? (status === 'connected' || realCount > 0)
      : (status === 'connected' && (realCount > 0 || !!(streamStartTimes[cleanName] || streamStartTimes[rawClean])));

    if (isStreamActive) {
      const startTimeVal = streamStartTimes[cleanName] || 
                           streamStartTimes[rawClean] || 
                           streamStartTimes[`@${cleanName}`] || 
                           streamStartTimes[`@${rawClean}`] || 
                           streamStartTimes[ch.name] || 
                           streamStartTimes[lowerName];
      if (startTimeVal) {
        const startMs = parseStartTimeMs(startTimeVal);
        if (startMs && !isNaN(startMs)) {
          const elapsedSecs = Math.floor((Date.now() - startMs) / 1000);
          const currentEarliest = uptimesByPlatform[displayPlatform];
          const secs = elapsedSecs >= 0 ? elapsedSecs : 0;
          if (currentEarliest === undefined || secs > currentEarliest) {
            uptimesByPlatform[displayPlatform] = secs;
          }
        }
      }
    }
  });

  const activeViewersByPlatform = viewersByPlatform;
  const activeLikesByPlatform = likesByPlatform;

  const handleWatchersClick = () => {
    setViewerDisplayMode(prev => {
      if (prev === 'individual') return 'combined';
      if (prev === 'combined') return 'hidden';
      return 'individual';
    });
  };

  const handleUptimeClick = () => {
    setUptimeDisplayMode(prev => {
      if (prev === 'individual') return 'combined';
      if (prev === 'combined') return 'hidden';
      return 'individual';
    });
  };

  const handleLikesClick = () => {
    setLikesDisplayMode(prev => {
      if (prev === 'individual') return 'combined';
      if (prev === 'combined') return 'hidden';
      return 'individual';
    });
  };

  const handleSuperchatClick = () => {
    setSuperchatDisplayMode(prev => {
      if (prev === 'amount') return 'hidden';
      return 'amount';
    });
  };

  const handleMembershipClick = () => {
    setMembershipDisplayMode(prev => {
      if (prev === 'count') return 'hidden';
      return 'count';
    });
  };

  const getWatchersTooltip = () => {
    const parts = [];
    activeChannels.filter(ch => ch.enabled).forEach(ch => {
      const clean = ch.name.toLowerCase().replace(/^@+/, '').trim();
      const rawClean = ch.name.toLowerCase().replace('@', '').trim();
      const status = platformStatuses[clean] || platformStatuses[rawClean] || platformStatuses[ch.platform];
      const isChannelConnected = status === 'connected' || (streamViewers[clean] ?? streamViewers[rawClean] ?? 0) > 0;
      const count = isChannelConnected ? (streamViewers[clean] ?? streamViewers[rawClean] ?? streamViewers[`@${clean}`] ?? 0) : 0;
      const likesCount = isChannelConnected ? (streamLikes[clean] ?? streamLikes[rawClean] ?? streamLikes[`@${clean}`] ?? 0) : 0;
      const statusLabel = isChannelConnected ? 'Live' : 'Offline';
      if (ch.platform === 'youtube') {
        parts.push(`${ch.platform.toUpperCase()} (${getChannelDisplayName(ch)}): ${count.toLocaleString()} viewers • ${likesCount.toLocaleString()} likes (${statusLabel})`);
      } else {
        parts.push(`${ch.platform.toUpperCase()} (${getChannelDisplayName(ch)}): ${count.toLocaleString()} viewers (${statusLabel})`);
      }
    });
    return parts.length > 0 ? parts.join('\n') : 'No active streams';
  };

  const getLikesTooltip = () => {
    const parts = [];
    activeChannels.filter(ch => ch.enabled && ch.platform === 'youtube').forEach(ch => {
      const clean = ch.name.toLowerCase().replace(/^@+/, '').trim();
      const rawClean = ch.name.toLowerCase().replace('@', '').trim();
      const status = platformStatuses[clean] || platformStatuses[rawClean] || platformStatuses[ch.platform];
      const isChannelConnected = status === 'connected' || (streamViewers[clean] ?? streamViewers[rawClean] ?? 0) > 0;
      const likesCount = isChannelConnected ? (streamLikes[clean] ?? streamLikes[rawClean] ?? streamLikes[`@${clean}`] ?? 0) : 0;
      const statusLabel = isChannelConnected ? 'Live' : 'Offline';
      parts.push(`${ch.platform.toUpperCase()} (${getChannelDisplayName(ch)}): ${likesCount.toLocaleString()} likes (${statusLabel})`);
    });
    return parts.length > 0 ? parts.join('\n') : 'No active streams';
  };

  const getUptimeTooltip = () => {
    const parts = [];
    activeChannels.filter(ch => ch.enabled).forEach(ch => {
      const clean = ch.name.toLowerCase().replace(/^@+/, '').trim();
      const rawClean = ch.name.toLowerCase().replace('@', '').trim();
      const status = platformStatuses[clean] || platformStatuses[rawClean] || platformStatuses[ch.platform];
      const lowerName = ch.name.toLowerCase();
      const startTime = streamStartTimes[clean] ?? 
                        streamStartTimes[rawClean] ?? 
                        streamStartTimes[`@${clean}`] ?? 
                        streamStartTimes[`@${rawClean}`] ?? 
                        streamStartTimes[ch.name] ?? 
                        streamStartTimes[lowerName];
      if (startTime) {
        const startMs = parseStartTimeMs(startTime);
        if (startMs) {
          const diffSecs = Math.floor((Date.now() - startMs) / 1000);
          const durationStr = diffSecs >= 0 ? formatUptime(diffSecs) : '00:00:00';
          parts.push(`${ch.platform.toUpperCase()} (${getChannelDisplayName(ch)}): ${durationStr}`);
          return;
        }
      } else if (status === 'connected') {
        parts.push(`${ch.platform.toUpperCase()} (${getChannelDisplayName(ch)}): 00:00:00`);
        return;
      }
      parts.push(`${ch.platform.toUpperCase()} (${getChannelDisplayName(ch)}): N/A`);
    });
    return parts.length > 0 ? parts.join('\n') : 'No active streams';
  };

  const parseAmountValue = (amountStr) => {
    if (!amountStr || typeof amountStr !== 'string') return 0;
    const clean = amountStr.replace(/[^\d.]/g, '');
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
  };

  const { liveSuperchatTotal, liveSuperchatCount, liveMembershipCount } = useMemo(() => {
    let sum = 0;
    let count = 0;
    let memberCount = 0;
    messages.forEach(msg => {
      if (msg.platform === 'youtube' && msg.isSystemEvent) {
        if (msg.eventType === 'donation') {
          const amt = parseAmountValue(msg.eventDetails?.amount);
          sum += amt;
          count += 1;
        } else if (msg.eventType === 'subscription' || msg.eventType === 'membership') {
          memberCount += 1;
        }
      }
    });
    return { liveSuperchatTotal: sum, liveSuperchatCount: count, liveMembershipCount: memberCount };
  }, [messages]);

  const currencySymbol = settings.superchatCurrency || '₹';

  const formatSuperchatAmount = (val) => {
    const num = Math.round((val || 0) * 100) / 100;
    const formatted = num.toLocaleString('en-US', {
      minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2
    });
    return `${currencySymbol}${formatted}`;
  };


  const totalConnectedViewers = Object.entries(streamViewers)
    .filter(([chName]) => activeChannels.some(ch => ch.enabled && (
      ch.name.toLowerCase().replace(/^@+/, '').trim() === chName ||
      ch.name.toLowerCase().replace('@', '').trim() === chName
    )))
    .reduce((sum, [, count]) => sum + (count || 0), 0);

  const displayViewerCount = activeChannels.some(ch => ch.enabled) ? totalConnectedViewers : 0;

  const totalConnectedLikes = Object.entries(streamLikes)
    .filter(([chName]) => activeChannels.some(ch => ch.enabled && ch.platform === 'youtube' && (
      ch.name.toLowerCase().replace(/^@+/, '').trim() === chName ||
      ch.name.toLowerCase().replace('@', '').trim() === chName
    )))
    .reduce((sum, [, count]) => sum + (count || 0), 0);

  const displayLikesCount = activeChannels.some(ch => ch.enabled && ch.platform === 'youtube') ? totalConnectedLikes : 0;

  const formatLikesNumber = (num) => {
    if (!num || isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(num);
  };



  const activeEnabledChannels = activeChannels.filter(ch => ch.enabled);
  const hasYoutubeChannel = activeEnabledChannels.some(ch => ch.platform === 'youtube');
  const selectedCh = activeChannels.find(ch => 
    ch.name.toLowerCase() === activeTab || 
    ch.name.toLowerCase().replace(/^@+/, '') === activeTab.toLowerCase().replace(/^@+/, '')
  );
  const channelUrl = selectedCh ? getChannelUrl(selectedCh) : null;
  const channelDisplayName = selectedCh 
    ? getChannelDisplayName(selectedCh) 
    : (activeTab === 'all' ? 'General' : activeTab === 'events' ? 'Events' : activeTab === 'mentions' ? 'Mentions' : activeTab);

  return (
    <div className={`dashboard-container theme-${settings.theme} ${settings?.cleanUi ? 'clean-ui-active' : ''}`} id="main-content" style={{ display: 'flex' }}>
      {/* Dashboard Top Header */}
      <header className="dashboard-header" id="top-bar-container">
        <div id="top-bar-container-left-header" style={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button 
                type="button"
                className="header-sidebar-toggle-btn"
                onClick={() => setIsSidebarHidden(!isSidebarHidden)}
              >
                <PanelLeft size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start">
              {isSidebarHidden ? "Show Sidebar" : "Hide Sidebar"}
            </TooltipContent>
          </Tooltip>
          <a href="/" id="top-bar-container-project-name">
            ProChat
          </a>
          <span className="focus-mode-badge">
            <svg fill="none" height="48" viewBox="0 0 48 48" width="48" xmlns="http://www.w3.org/2000/svg" className="focus-mode-badge-sparkle" style={{ width: '12px', height: '12px' }}>
              <path clipRule="evenodd" d="m0 24c15.2548 0 24-8.7452 24-24 0 15.2548 8.7452 24 24 24-15.2548 0-24 8.7452-24 24 0-15.2548-8.7452-24-24-24z" fill="#eab308" fillRule="evenodd"/>
            </svg>
            Pro
          </span>
        </div>

        <div className="header-center">
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <div 
                className="combined-metrics-pill"
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <div className="metric-pill-section" onClick={handleWatchersClick}>
                  <Eye size={13} style={{ color: 'var(--text-muted)' }} />
                  {viewerDisplayMode === 'individual' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      {Object.keys(activeViewersByPlatform).length > 0 ? (
                        Object.entries(activeViewersByPlatform).map(([platform, count]) => (
                          <span key={platform} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <PlatformLogo platform={platform} size={12} />
                            <span>{count}</span>
                          </span>
                        ))
                      ) : (
                        <span>0</span>
                      )}
                    </span>
                  )}
                  {viewerDisplayMode === 'combined' && (
                    <span>{displayViewerCount}</span>
                  )}
                  {viewerDisplayMode === 'hidden' && (
                    <span>--</span>
                  )}
                </div>
                <div className="metric-pill-divider" />
                <div className="metric-pill-section" onClick={handleUptimeClick}>
                  <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                  {uptimeDisplayMode === 'individual' && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      {Object.keys(uptimesByPlatform).length > 0 ? (
                        Object.entries(uptimesByPlatform).map(([platform, secs]) => (
                          <span key={platform} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <PlatformLogo platform={platform} size={12} />
                            <span>{formatUptime(secs)}</span>
                          </span>
                        ))
                      ) : (
                        <span>N/A</span>
                      )}
                    </span>
                  )}
                  {uptimeDisplayMode === 'combined' && (
                    <span>{uptime !== null ? formatUptime(uptime) : 'N/A'}</span>
                  )}
                  {uptimeDisplayMode === 'hidden' && (
                    <span>--</span>
                  )}
                </div>
                {hasYoutubeChannel && (
                  <>
                    <div className="metric-pill-divider" />
                    <div className="metric-pill-section" onClick={handleLikesClick} title="Total YouTube Likes">
                      <ThumbsUp size={13} style={{ color: 'var(--text-muted)' }} />
                      {likesDisplayMode === 'individual' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          {Object.keys(activeLikesByPlatform).length > 0 ? (
                            Object.entries(activeLikesByPlatform).map(([platform, count]) => (
                              <span key={platform} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <PlatformLogo platform={platform} size={12} />
                                <span>{formatLikesNumber(count)}</span>
                              </span>
                            ))
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <PlatformLogo platform="youtube" size={12} />
                              <span>0</span>
                            </span>
                          )}
                        </span>
                      )}
                      {likesDisplayMode === 'combined' && (
                        <span>{formatLikesNumber(displayLikesCount)}</span>
                      )}
                      {likesDisplayMode === 'hidden' && (
                        <span>--</span>
                      )}
                    </div>
                    <div className="metric-pill-divider" />
                    <div className="metric-pill-section" onClick={handleSuperchatClick} title="Total Super Chat Amount">
                      <Gift size={13} style={{ color: 'var(--text-muted)' }} />
                      {superchatDisplayMode === 'amount' && (
                        <span>{formatSuperchatAmount(liveSuperchatTotal)}</span>
                      )}
                      {superchatDisplayMode === 'hidden' && (
                        <span>--</span>
                      )}
                    </div>
                    <div className="metric-pill-divider" />
                    <div className="metric-pill-section" onClick={handleMembershipClick} title="Total YouTube Memberships">
                      <Crown size={13} style={{ color: 'var(--text-muted)' }} />
                      {membershipDisplayMode === 'count' && (
                        <span>{liveMembershipCount}</span>
                      )}
                      {membershipDisplayMode === 'hidden' && (
                        <span>--</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
              {activeEnabledChannels.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(() => {
                    const channelsToDisplay = hasAnyLive ? liveChannels : enabledChannels;

                    return channelsToDisplay.map(ch => {
                      const cleanName = ch.name.toLowerCase().replace(/^@+/, '').trim();
                      const rawClean = ch.name.toLowerCase().replace('@', '').trim();
                      const lowerName = ch.name.toLowerCase();
                      const v = streamViewers[cleanName] ?? streamViewers[rawClean] ?? streamViewers['@' + cleanName] ?? streamViewers[ch.name] ?? streamViewers[lowerName] ?? 0;
                      const l = streamLikes[cleanName] ?? streamLikes[rawClean] ?? streamLikes['@' + cleanName] ?? streamLikes[ch.name] ?? streamLikes[lowerName] ?? 0;
                      const startTime = streamStartTimes[cleanName] ?? 
                                        streamStartTimes[rawClean] ?? 
                                        streamStartTimes['@' + cleanName] ?? 
                                        streamStartTimes['@' + rawClean] ?? 
                                        streamStartTimes[ch.name] ?? 
                                        streamStartTimes[lowerName];
                      
                      const isConnected = platformStatuses[cleanName] === 'connected' || platformStatuses[rawClean] === 'connected';
                      const isStreamLive = v > 0 || l > 0 || (isConnected && !!startTime);
                      
                      const isYoutube = ch.platform === 'youtube';
                      let durationStr = 'offline';
                      if (isStreamLive) {
                        durationStr = 'Live';
                        if (startTime) {
                          const startMs = parseStartTimeMs(startTime);
                          if (startMs && !isNaN(startMs)) {
                            const diffSecs = Math.floor((Date.now() - startMs) / 1000);
                            if (diffSecs >= 0) {
                              durationStr = formatUptime(diffSecs);
                            }
                          }
                        }
                      }
                      return (
                        <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <PlatformLogo platform={ch.platform} size={12} />
                          <span style={{ fontWeight: 600 }}>{getChannelDisplayName(ch)}:</span>
                          <span>
                            {v} viewers
                            {isYoutube ? ` • ${formatLikesNumber(l)} likes` : ''} 
                            {` (${durationStr})`}
                          </span>
                        </div>
                      );
                    });
                  })()}
                  {hasYoutubeChannel && (
                    <>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        <Gift size={12} style={{ color: '#eab308' }} />
                        <span style={{ fontWeight: 600 }}>Super Chats:</span>
                        <span>{formatSuperchatAmount(liveSuperchatTotal)} ({liveSuperchatCount} {liveSuperchatCount === 1 ? 'donation' : 'donations'})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        <Crown size={12} style={{ color: '#10b981' }} />
                        <span style={{ fontWeight: 600 }}>Memberships:</span>
                        <span>{liveMembershipCount} {liveMembershipCount === 1 ? 'member' : 'members'}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                'No active streams'
              )}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Bug Report Button */}
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button 
                className="BugButton"
                onClick={(e) => e.currentTarget.blur()}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 43 42"
                  className="bugsvg"
                >
                  <path
                    strokeWidth="4"
                    stroke="#cfcfcf"
                    d="M20 7H23C26.866 7 30 10.134 30 14V28.5C30 33.1944 26.1944 37 21.5 37C16.8056 37 13 33.1944 13 28.5V14C13 10.134 16.134 7 20 7Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeWidth="4"
                    stroke="#cfcfcf"
                    d="M18 2V7"
                  />
                  <path
                    strokeLinecap="round"
                    strokeWidth="4"
                    stroke="#cfcfcf"
                    d="M25 2V7"
                  />
                  <path
                    strokeLinecap="round"
                    strokeWidth="4"
                    stroke="#cfcfcf"
                    d="M31 22H41"
                  />
                  <path
                    strokeLinecap="round"
                    strokeWidth="4"
                    stroke="#cfcfcf"
                    d="M2 22H12"
                  />
                  <path
                    strokeLinecap="round"
                    strokeWidth="4"
                    stroke="#cfcfcf"
                    d="M12.5785 15.2681C3.5016 15.2684 4.99951 12.0004 5 4"
                  />
                  <path
                    strokeLinecap="round"
                    strokeWidth="4"
                    stroke="#cfcfcf"
                    d="M12.3834 29.3877C3.20782 29.3874 4.72202 32.4736 4.72252 40.0291"
                  />
                  <path
                    strokeLinecap="round"
                    strokeWidth="4"
                    stroke="#cfcfcf"
                    d="M30.0003 14.8974C39.0545 15.553 37.7958 12.1852 38.3718 4.20521"
                  />
                  <path
                    strokeLinecap="round"
                    strokeWidth="4"
                    stroke="#cfcfcf"
                    d="M29.9944 29.7379C39.147 29.1188 37.8746 32.2993 38.4568 39.8355"
                  />
                </svg>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
              Bug Report
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <div 
                id="chatter-list-button"
                onClick={handleToggleParticipants}
                style={{ cursor: 'pointer' }}
              >
                <Users size={20} className={showParticipants ? 'text-cyan-400' : ''} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
              Chatters List
            </TooltipContent>
          </Tooltip>

          <div className="popup" ref={profileMenuRef}>
            <button 
              type="button"
              className="burger" 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              style={{ padding: 0 }}
              aria-label="User Profile Menu"
            >
              {user?.avatar && (user.avatar.startsWith('http://') || user.avatar.startsWith('https://') || user.avatar.startsWith('data:')) ? (
                <img 
                  src={user.avatar} 
                  alt={user?.username || 'User Profile'} 
                  className="top-bar-user-avatar"
                  referrerPolicy="no-referrer"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 'var(--burger-btn-border-radius, 8px)',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <span className="top-bar-avatar-initial">
                  {(user?.username || 'S').charAt(0).toUpperCase()}
                </span>
              )}
            </button>
            {isProfileOpen && (
              <nav className="popup-window" style={{ visibility: 'visible', opacity: 1, transform: 'scale(1)' }}>
                <legend>{user?.username || 'Profile'}</legend>
                <ul>
                  <li>
                    <button 
                      type="button"
                      onClick={() => {
                        handleOpenSettings('appearance');
                        setIsProfileOpen(false);
                      }}
                    >
                      <Sliders size={14} style={{ color: 'var(--accent-color, #00bf63)' }} />
                      <span>Settings</span>
                    </button>
                  </li>
                  <li>
                    <button 
                      type="button"
                      onClick={() => {
                        logout();
                        setIsProfileOpen(false);
                      }}
                    >
                      <LogOut size={14} style={{ color: 'red' }} />
                      <span>Sign Out</span>
                    </button>
                  </li>
                </ul>
              </nav>
            )}
          </div>
        </div>
      </header>

      {/* Main Panel Workspace Grid */}
      <div id="chat-messages-and-sidebar-container">
        {/* Left Navigation Sidebar */}
        <aside className={`left-sidebar ${isSidebarExpanded ? 'expanded' : ''} ${isSidebarHidden ? 'hidden' : ''}`}>
          <div className="sidebar-top-section">
            {/* 1. All Chat nav item */}
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button 
                  className={`sidebar-nav-item ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  <MessageSquare size={20} />
                  <span className="sidebar-nav-label">All Chat</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">All Chat</TooltipContent>
            </Tooltip>

            {/* 2. Events nav item */}
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button 
                  className={`sidebar-nav-item ${activeTab === 'events' ? 'active' : ''}`}
                  onClick={() => setActiveTab('events')}
                >
                  <Compass size={20} />
                  {hasUnreadEvents && <span className="sidebar-item-badge-dot" />}
                  <span className="sidebar-nav-label">Events</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Events</TooltipContent>
            </Tooltip>

            <div className="sidebar-divider" />

            {/* 4. Mentions */}
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button 
                  className={`sidebar-nav-item ${activeTab === 'mentions' ? 'active' : ''}`}
                  onClick={() => setActiveTab('mentions')}
                >
                  <AtSign size={20} />
                  <span className="sidebar-nav-label">Mentions</span>
                </button>
              </TooltipTrigger>
            </Tooltip>
          </div>

          {activeChannels.filter(ch => ch.enabled).length > 0 && (
            <>
              <div className="sidebar-divider" style={{ margin: '8px 0', flexShrink: 0 }} />
              <div className="sidebar-channels-scroll-container">
                {/* 5. Dynamic Active Channels List */}
                {activeChannels.filter(ch => ch.enabled).map(ch => {
                  const cleanName = ch.name.toLowerCase().replace('@', '').trim();
                  const rawClean = ch.name.toLowerCase().replace(/^@+/, '').trim();
                  const isActive = activeTab === ch.name.toLowerCase();
                  const isConnected = platformStatuses[cleanName] === 'connected' || 
                                      platformStatuses[rawClean] === 'connected' ||
                                      platformStatuses[ch.name] === 'connected' ||
                                      platformStatuses[ch.name.toLowerCase()] === 'connected';
                  const lowerName = ch.name.toLowerCase();
                  const startTime = streamStartTimes[cleanName] ?? 
                                    streamStartTimes[rawClean] ?? 
                                    streamStartTimes[`@${cleanName}`] ?? 
                                    streamStartTimes[`@${rawClean}`] ?? 
                                    streamStartTimes[ch.name] ?? 
                                    streamStartTimes[lowerName];
                  const viewers = streamViewers[cleanName] ?? streamViewers[rawClean] ?? streamViewers[`@${cleanName}`] ?? 0;
                  const likes = streamLikes[cleanName] ?? streamLikes[rawClean] ?? streamLikes[`@${cleanName}`] ?? 0;
                  
                  const isOnline = ch.platform === 'youtube'
                    ? isConnected
                    : (isConnected && (viewers > 0 || !!startTime));
                  
                  return (
                    <Tooltip key={ch.id} delayDuration={150}>
                      <TooltipTrigger asChild>
                        <button 
                          className={`sidebar-nav-item channel-item ${isActive ? 'active' : ''} ${draggedIndex !== null && activeChannels[draggedIndex]?.id === ch.id ? 'dragging' : ''}`}
                          onClick={() => setActiveTab(ch.name.toLowerCase())}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, ch.id)}
                          onDragOver={(e) => handleDragOver(e, ch.id)}
                          onDragEnd={handleDragEnd}
                          style={{
                            color: isActive ? '#0f0f11' : (isOnline ? '#ffffff' : '#71717a'),
                            position: 'relative'
                          }}
                        >
                          {isOnline && (
                            <span className="live-left-indicator" />
                          )}
                          <PlatformLogo 
                            platform={ch.platform} 
                            isShorts={ch.platform === 'youtube' && (youtubeShortsChannels.has(cleanName) || youtubeShortsChannels.has(rawClean) || youtubeShortsChannels.has(ch.name))} 
                            size={20} 
                          />
                          <span className="sidebar-nav-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', width: '100%', minWidth: 0 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {getChannelDisplayName(ch)}
                            </span>
                            {isOnline && (
                              <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700, flexShrink: 0 }}>
                                {viewers}
                              </span>
                            )}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        {(() => {
                          if (!isOnline) return `${getChannelDisplayName(ch)} (Offline)`;
                          let durationPart = '';
                          if (startTime) {
                            const startMs = parseStartTimeMs(startTime);
                            if (startMs) {
                              const diffSecs = Math.floor((Date.now() - startMs) / 1000);
                              if (diffSecs >= 0) durationPart = ` • ${formatUptime(diffSecs)}`;
                            }
                          }
                          return `${getChannelDisplayName(ch)} (LIVE - ${viewers} viewers${ch.platform === 'youtube' ? ` • ${likes} likes` : ''}${durationPart})`;
                        })()}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </>
          )}

          <div className="sidebar-bottom-section">
            {/* Connect Channel Plus button */}
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button 
                  className="sidebar-add-btn"
                  onClick={() => handleOpenSettings('channels')}
                >
                  <Plus size={20} />
                  <span className="sidebar-nav-label">Add Channel</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Manage Channels</TooltipContent>
            </Tooltip>

            {/* Sidebar toggle collapse button */}
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button 
                  className="sidebar-toggle-btn"
                  onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                >
                  <ChevronRight size={18} />
                  <span className="sidebar-nav-label">Collapse</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isSidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
              </TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* Unified Chat Feed & Input */}
        <section id="all-messages-container" className="full-width" style={{ position: 'relative' }}>
          {recentMessages.length === 0 && <SpidermanPet />}
          {/* Breadcrumb path */}
          <div className="breadcrumb-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="breadcrumb-item">
                {['all', 'events', 'mentions'].includes(activeTab) ? 'All' : (selectedCh?.platform.toUpperCase() || 'PLATFORM')}
              </span>
              <ChevronRight size={12} style={{ color: '#71717a' }} />
              {channelUrl ? (
                <a 
                  href={channelUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="breadcrumb-item active breadcrumb-channel-link"
                  style={{ textDecoration: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <span>{channelDisplayName}</span>
                  <ExternalLink size={11} style={{ opacity: 0.7 }} />
                </a>
              ) : (
                <span className="breadcrumb-item active">
                  {channelDisplayName}
                </span>
              )}
            </div>

            {activeTab === 'events' && (
              <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="clear-events-btn"
                    onClick={handleClearEvents}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#f87171',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.22)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.18)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                      e.currentTarget.style.color = '#fca5a5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.22)';
                      e.currentTarget.style.color = '#f87171';
                    }}
                  >
                    <Trash2 size={12} />
                    <span>Clear Events</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Clear all events feed history
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {heldSuper && (
            <div className="held-tip-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>💸</span>
                <span>
                  Tip <strong>{heldSuper.donationAmount || `₹${heldSuper.amountValue}`}</strong> selected! Click any viewer in chat to feature them with this tip on stream.
                </span>
              </div>
              <button 
                type="button" 
                onClick={() => setHeldSuper(null)}
                style={{ background: 'none', border: 'none', color: '#fef08a', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 6px', borderRadius: '4px' }}
                title="Cancel tip pairing"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <ChatFeed 
            messages={recentMessages}
            onChatterClick={setSelectedChatter}
            onThreadClick={setSelectedThreadMsg}
            settings={settings}
            moderation={moderation}
            activeTab={activeTab}
            selectedChatter={selectedChatter}
            onBlockUser={handleBlockUser}
            blockedUsers={blockedUsers}
            isInitialLoading={isInitialLoading}
            streamStartTimes={streamStartTimes}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            onResetDisplay={handleResetDisplay}
            onScrollUp={handleScrollUp}
            totalMessagesCount={messages.length}
            onDeleteMessage={handleDeleteMessage}
            onTimeoutUser={handleTimeoutUser}
            onBanUser={handleBanUser}
            onUnbanUser={handleUnbanUser}
            onToggleModerator={handleToggleModerator}
            onClearChat={handleClearChat}
            onConnectChannel={() => handleOpenSettings('channels')}
            onExploreEvents={() => setActiveTab('events')}
            user={user}
            activeChannels={activeChannels}
            onHighlightMessage={handleHighlightMessage}
            activeHighlightId={activeHighlightId}
            heldSuper={heldSuper}
          />
          
          <ChatInput 
            activeChannels={activeChannels.filter(ch => ch.enabled)}
            user={user}
            onSendMessage={handleSendMessage}
            onToggleSettings={() => handleOpenSettings('appearance')}
            onClearChat={handleClearChat}
            youtubeShortsChannels={youtubeShortsChannels}
            resolvedStreamerNames={resolvedStreamerNames}
            youtubeChatMode={settings.youtubeChatMode || 'live'}
            onChangeYoutubeChatMode={(mode) => updateSettings({ youtubeChatMode: mode })}
            isSidebarHidden={isSidebarHidden}
            setIsSidebarHidden={setIsSidebarHidden}
            cleanUi={settings.cleanUi || false}
            onChangeCleanUi={(clean) => updateSettings({ cleanUi: clean })}
            streamStartTimes={streamStartTimes}
          />
        </section>

        {/* Right Panel: Participants Sidebar Panel */}
        {showParticipants && (
          <aside className={`participants-panel ${isParticipantsClosing ? 'closing' : ''}`}>
            <div className="participants-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="participants-title">Participants ({filteredChatters.length})</h3>
                <button 
                  className="delete-btn" 
                  onClick={handleCloseParticipants}
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="participants-filter-container">
                <AnimatedDropdown
                  value={participantFilter}
                  onChange={setParticipantFilter}
                  align="left"
                  items={[
                    { 
                      name: `All Platforms (${totalCount})`, 
                      value: 'all',
                      icon: <Globe size={14} style={{ color: 'var(--accent-color, #00ffff)' }} />
                    },
                    { 
                      name: `YouTube (${youtubeCount})`, 
                      value: 'youtube',
                      icon: <PlatformLogo platform="youtube" size={14} />
                    },
                    { 
                      name: `Kick (${kickCount})`, 
                      value: 'kick',
                      icon: <PlatformLogo platform="kick" size={14} />
                    },
                    { 
                      name: `Twitch (${twitchCount})`, 
                      value: 'twitch',
                      icon: <PlatformLogo platform="twitch" size={14} />
                    }
                  ]}
                  className="participants-filter-dropdown"
                />
              </div>
            </div>
            <div className="participants-list">
              {filteredChatters.map(chatter => (
                <div 
                  key={chatter.username} 
                  className="participant-item"
                  onClick={() => setSelectedChatter(chatter)}
                >
                  <img 
                    className="participant-avatar" 
                    src={isDefaultAvatar(chatter.avatar) ? getDefaultAvatar(chatter.platform, chatter.username) : proxifyAvatarUrl(chatter.avatar)} 
                    alt={chatter.displayName} 
                    onError={(e) => {
                      e.target.src = getDefaultAvatar(chatter.platform, chatter.username);
                    }}
                  />
                  <span className="participant-name">{chatter.displayName}</span>
                  {(() => {
                    if (chatter.platform !== 'youtube') return null;
                    const chatterKeys = [chatter.channelId, chatter.authorChannelId, chatter.username, chatter.displayName]
                      .filter(Boolean).map(k => String(k).toLowerCase().trim());
                    let rank = (typeof chatter.youtubeRank === 'number' && chatter.youtubeRank >= 1 && chatter.youtubeRank <= 3) ? chatter.youtubeRank : null;

                    if (!rank && Array.isArray(chatter.badges)) {
                      if (chatter.badges.includes('rank_1')) rank = 1;
                      else if (chatter.badges.includes('rank_2')) rank = 2;
                      else if (chatter.badges.includes('rank_3')) rank = 3;
                    }

                    if (!rank && youtubeTop3Ranks) {
                      for (const k of chatterKeys) {
                        const found = youtubeTop3Ranks.get(k);
                        if (found && found >= 1 && found <= 3) {
                          rank = found;
                          break;
                        }
                      }
                    }
                    if (!rank || rank < 1 || rank > 3) return null;
                    const rankBg = '#3b00bb';
                    return (
                      <span 
                        className={`youtube-rank-badge youtube-rank-${rank}`}
                        title={`Top Contributor #${rank}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '3px',
                          backgroundColor: rankBg,
                          color: '#ffffff',
                          padding: '1px 6px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: '800',
                          lineHeight: '1',
                          marginLeft: '4px',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
                          flexShrink: 0
                        }}
                      >
                        <svg 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="#ffffff" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          style={{ width: '11px', height: '11px', display: 'block', flexShrink: 0 }}
                        >
                          <circle cx="3.5" cy="6" r="1.3" fill="#ffffff" stroke="none" />
                          <circle cx="12" cy="3" r="1.3" fill="#ffffff" stroke="none" />
                          <circle cx="20.5" cy="6" r="1.3" fill="#ffffff" stroke="none" />
                          <path d="M3.5 7.5 L5.5 16 H18.5 L20.5 7.5 L15 12 L12 4.5 L9 12 Z" />
                          <line x1="4.5" y1="19" x2="19.5" y2="19" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                        <span>#{rank}</span>
                      </span>
                    );
                  })()}
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <span className="msg-platform-icon" style={{ cursor: 'pointer', marginRight: 0, marginLeft: 'auto', opacity: 0.8 }}>
                        <PlatformLogo platform={chatter.platform} isShorts={chatter.isShorts} size={14} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center">
                      <span style={{ textTransform: 'capitalize' }}>
                        {chatter.platform === 'youtube' ? 'YouTube' : chatter.platform}
                      </span>
                    </TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Center Panel Popup Modal: Chatter Insights */}
        {selectedChatter && selectedChatter.username !== 'insights' && (
          <ChatterInsights 
            chatter={selectedChatter}
            onClose={() => setSelectedChatter(null)}
            messages={messages}
            onBlockUser={handleBlockUser}
            onThreadClick={(msg) => {
              setSelectedChatter(null);
              setSelectedThreadMsg(msg);
            }}
            settings={settings}
          />
        )}

        {/* Conversation Thread Popup Modal */}
        {selectedThreadMsg && (
          <ThreadModal 
            activeMessage={selectedThreadMsg}
            onClose={() => setSelectedThreadMsg(null)}
            messages={messages}
            settings={settings}
          />
        )}
      </div>

      {/* Global settings sliding drawer overlay */}
      {isSettingsOpen && (
        <SettingsDrawer 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          updateSettings={updateSettings}
          activeChannels={activeChannels}
          onAddChannel={handleAddChannel}
          removeChannel={removeChannel}
          toggleChannel={toggleChannel}
          platformStatuses={platformStatuses}
          blockedUsers={blockedUsers}
          onUnblockUser={handleUnblockUser}
          youtubeShortsChannels={youtubeShortsChannels}
          initialTab={settingsActiveTab}
          user={user}
        />
      )}
    </div>
  );
}

