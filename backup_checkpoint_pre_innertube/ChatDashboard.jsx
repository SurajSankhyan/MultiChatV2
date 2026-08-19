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
  Globe
} from 'lucide-react';
import ChatFeed from './ChatFeed';
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
import { YoutubeChatClient } from '../utils/youtubeChat';
import { ChatSimulator } from '../utils/simulator';
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
    index = (numId % 8) + 1;
  } else if (username) {
    let hash = 0;
    const cleanUser = username.toLowerCase();
    for (let i = 0; i < cleanUser.length; i++) {
      hash = cleanUser.charCodeAt(i) + ((hash << 5) - hash);
    }
    index = (Math.abs(hash) % 8) + 1;
  }
  return `https://kick.com/img/default-profile-pictures/default-avatar-${index}.webp`;
};

const proxifyAvatarUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  let cleanUrl = url.trim();
  if (cleanUrl.startsWith('/')) {
    cleanUrl = 'https://kick.com' + cleanUrl;
  }
  if (cleanUrl.startsWith('https://kick.com/')) {
    return `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}`;
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

// Global TTS Queue Manager to speak messages sequentially (1 by 1)
window.ttsManager = {
  queue: [],
  isSpeaking: false,
  activeUtterances: new Set(),

  speak: function(text, volume, rate, voiceName, forceImmediate = false, username = '', readUsername = false) {
    if (!window.speechSynthesis) return;

    // Strip emotes/links from speech to make it cleaner
    let cleanText = (text || '')
      .replace(/https?:\/\/\S+/gi, 'link')
      .replace(/:[a-zA-Z0-9_]+:/g, ''); // strip emotes

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

const speakMessage = (username, text, ttsVolume = 0.5, ttsSpeed = 1.0, readUsername = true, ttsVoiceName = '') => {
  if (window.ttsManager) {
    window.ttsManager.speak(text, ttsVolume, ttsSpeed, ttsVoiceName, false, username, readUsername);
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
  const [resolvedStreamerNames, setResolvedStreamerNames] = useState({});

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
  
  // Moderation state initialized from localStorage
  const [moderation, setModeration] = useState(() => {
    try {
      const storedDeleted = typeof window !== 'undefined' ? localStorage.getItem('prochat_deleted_msg_ids') : null;
      const storedTimedOut = typeof window !== 'undefined' ? localStorage.getItem('prochat_timed_out_users') : null;
      const storedBanned = typeof window !== 'undefined' ? localStorage.getItem('prochat_banned_users') : null;

      const deletedSet = storedDeleted ? new Set(JSON.parse(storedDeleted)) : new Set();
      const bannedSet = storedBanned ? new Set(JSON.parse(storedBanned)) : new Set();
      
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
        deletedMessageIds: deletedSet
      };
    } catch (e) {
      return {
        bannedUsers: new Set(),
        timedOutUsers: new Map(),
        deletedMessageIds: new Set()
      };
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('prochat_deleted_msg_ids', JSON.stringify(Array.from(moderation.deletedMessageIds)));
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

  const [youtubeShortsChannels, setYoutubeShortsChannels] = useState(new Set());

  // Client references
  const twitchClientRef = useRef(null);
  const kickClientRef = useRef(null);
  const youtubeClientRef = useRef(null);
  const simulatorRef = useRef(null);

  const handleAddChannel = async (platform, name) => {
    const cleanName = name.toLowerCase().replace('@', '').trim();
    if (activeChannels.some(ch => ch.platform === platform && ch.name.toLowerCase().replace('@', '') === cleanName)) {
      throw new Error('Channel already added');
    }

    try {
      if (platform === 'kick') {
        try {
          let data = null;
          if (kickClientRef.current) {
            try {
              data = await kickClientRef.current.fetchWithProxyFallback(`https://kick.com/api/v1/channels/${cleanName}`);
            } catch (err) {
              data = await kickClientRef.current.fetchWithProxyFallback(`https://kick.com/api/v2/channels/${cleanName}`);
            }
          } else {
            let res = await fetch(`/api/kick/api/v1/channels/${cleanName}`);
            if (!res.ok) {
              res = await fetch(`/api/kick/api/v2/channels/${cleanName}`);
            }
            if (!res.ok) throw new Error('Channel not found');
            data = await res.json();
          }
          if (!data || !data.chatroom) throw new Error('Channel not found');
        } catch (err) {
          console.warn(`Kick verification failed for ${cleanName}: ${err.message}. Adding anyway.`);
        }
      } else if (platform === 'youtube') {
        try {
          let html;
          const userSupplied = name.trim().replace('@', '');
          let liveUrl = `https://www.youtube.com/@${cleanName}/live`;
          if (/^uc[a-zA-Z0-9_-]{22}$/i.test(cleanName)) {
            liveUrl = `https://www.youtube.com/channel/${userSupplied}/live`;
          }
          if (youtubeClientRef.current) {
            html = await youtubeClientRef.current.fetchWithProxyFallback(liveUrl);
          } else {
            const localProxyUrl = liveUrl.replace('https://www.youtube.com', '/ytproxy');
            const res = await fetch(localProxyUrl);
            if (!res.ok) throw new Error('Channel not found');
            html = await res.text();
          }
          if (!html || html.length < 500) throw new Error('Channel not found');
          const isRealChannel = html.includes('ytcfg') || html.includes('channelId') || html.includes('externalId') || html.includes('youtube');
          if (!isRealChannel) throw new Error('Channel not found');
        } catch (err) {
          console.warn(`YouTube verification failed for ${cleanName}: ${err.message}. Adding anyway.`);
        }
      }
      addChannel(platform, platform === 'kick' ? cleanName : name.trim());
    } catch (err) {
      throw new Error(`Channel "${name}" not found on ${platform}`);
    }
  };

  // Uptime, Viewers, and Filter Tab state
  const [activeTab, setActiveTab] = useState('all');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [uptime, setUptime] = useState(null);
  const [viewerCount, setViewerCount] = useState(19);
  const [streamStartTimes, setStreamStartTimes] = useState(() => {
    const cached = localStorage.getItem('prochat_cached_stream_start_times');
    return cached ? JSON.parse(cached) : {};
  });

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
      const times = Object.values(streamStartTimes)
        .map(t => new Date(t).getTime())
        .filter(t => !isNaN(t));
      
      if (times.length > 0) {
        const earliest = Math.min(...times);
        const diffSecs = Math.floor((Date.now() - earliest) / 1000);
        setUptime(diffSecs >= 0 ? diffSecs : 0);
      } else {
        setUptime(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [streamStartTimes]);

  // Viewer count variance
  useEffect(() => {
    const interval = setInterval(() => {
      setViewerCount(prev => {
        const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        const next = prev + delta;
        return next > 0 ? next : 1;
      });
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    if (seconds === null || seconds === undefined) return 'N/A';
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  // Setup Connections
  useEffect(() => {
    let messageBuffer = [];
    let dripTimer = null;

    // Drip messages one at a time for smooth rendering
    const startDrip = () => {
      if (dripTimer) return;
      dripTimer = setInterval(() => {
        if (messageBuffer.length === 0) {
          clearInterval(dripTimer);
          dripTimer = null;
          return;
        }
        
        // Always drip exactly 1 message per tick for smooth, consistent display
        const msg = messageBuffer.splice(0, 1)[0];
        setMessages(prev => [...prev, msg].slice(-300));

        // TTS & Mention Sound notification processing
        if (msg) {
          const cfg = settingsRef.current;
          if (msg.isSystemEvent) {
            // Auto-read Super Chat donation
            if (msg.platform === 'youtube' && msg.eventType === 'donation' && cfg.enableSuperchatTts) {
              const textToSpeak = `@${msg.displayName || msg.username} Gave ${msg.eventDetails?.amount || ''}${msg.text ? ' , ' + msg.text : ''}`;
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
            const u = userRef.current;
            const isMe = (msg.username || '').toLowerCase() === (u?.username || '').toLowerCase() || 
                         (msg.badges && msg.badges.includes('broadcaster'));
            
            if (!isMe) {
              // Mention sound play checking
              if (cfg.enableMentionSound) {
                const nameLower = (u?.username || 'streamer').toLowerCase();
                const msgLower = (msg.text || '').toLowerCase();
                const isMentioned = msgLower.includes(`@${nameLower}`) || msgLower.includes(nameLower);
                if (isMentioned) {
                  playMentionSound(
                    (cfg.mentionSoundVolume !== undefined ? cfg.mentionSoundVolume : 50) / 100,
                    cfg.mentionSoundType || 'bell'
                  );
                }
              }

              // TTS speak checking
              if (cfg.enableTts) {
                speakMessage(
                  msg.displayName || msg.username,
                  msg.text,
                  (cfg.ttsVolume !== undefined ? cfg.ttsVolume : 50) / 100,
                  cfg.ttsSpeed !== undefined ? cfg.ttsSpeed : 1.0,
                  cfg.ttsReadUsernames !== false,
                  cfg.ttsVoiceName
                );
              }
            }
          }
        }
      }, 50); // 50ms per message = up to 20 messages/sec smooth rendering
    };

    // Callback for incoming messages — never drops messages
    const handleNewMessage = (msg) => {
      if (msg && msg.platform === 'youtube' && msg.text) {
        const normText = msg.text.trim();
        const existingIdx = (messagesRef.current || []).findIndex(m =>
          m.platform === 'youtube' &&
          m.text?.trim() === normText &&
          (m.rawTimestamp || 0) >= Date.now() - 15000
        );
        if (existingIdx !== -1) {
          // Update the existing message in-place with official YouTube avatar & ID
          setMessages(prev => prev.map((m, idx) => {
            if (idx === existingIdx) {
              return {
                ...m,
                id: msg.id || m.id,
                avatarUrl: msg.avatarUrl || m.avatarUrl,
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
        setResolvedStreamerNames(prev => ({
          ...prev,
          [ch]: metadata.displayName
        }));
      }
      if (ch === 'all') {
        setPlatformStatuses(prev => ({ ...prev, twitch: status }));
      } else if (ch === 'kick_all') {
        setPlatformStatuses(prev => ({ ...prev, kick: status }));
      } else if (ch === 'youtube_all') {
        setPlatformStatuses(prev => ({ ...prev, youtube: status }));
      } else {
        // Individual channel status
        setPlatformStatuses(prev => ({ ...prev, [ch]: status }));
      }

      // Update stream start times and viewers count
      if (status === 'connected') {
        if (metadata && metadata.startTime) {
          setStreamStartTimes(prev => {
            const next = { ...prev, [ch]: metadata.startTime };
            localStorage.setItem('prochat_cached_stream_start_times', JSON.stringify(next));
            return next;
          });
        } else {
          setStreamStartTimes(prev => {
            const next = { ...prev };
            delete next[ch];
            localStorage.setItem('prochat_cached_stream_start_times', JSON.stringify(next));
            return next;
          });
        }
        if (metadata && metadata.viewers !== undefined) {
          setStreamViewers(prev => {
            const next = { ...prev, [ch]: metadata.viewers };
            localStorage.setItem('prochat_cached_stream_viewers', JSON.stringify(next));
            return next;
          });
        }
        if (metadata && metadata.isShorts !== undefined) {
          setYoutubeShortsChannels(prev => {
            const next = new Set(prev);
            if (metadata.isShorts) {
              next.add(ch);
            } else {
              next.delete(ch);
            }
            return next;
          });
        }
      } else if (status === 'offline' || status === 'disconnected') {
        setStreamStartTimes(prev => {
          const next = { ...prev };
          delete next[ch];
          localStorage.setItem('prochat_cached_stream_start_times', JSON.stringify(next));
          return next;
        });
        setStreamViewers(prev => {
          const next = { ...prev };
          delete next[ch];
          localStorage.setItem('prochat_cached_stream_viewers', JSON.stringify(next));
          return next;
        });
        setYoutubeShortsChannels(prev => {
          const next = new Set(prev);
          next.delete(ch);
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
        setMessages(prev => prev.map(msg => {
          if (msg.platform === 'youtube' && msg.channelId === channelId) {
            return { ...msg, displayName: realName };
          }
          return msg;
        }));
      },
      (msgId, authorChannelId) => {
        if (msgId) {
          handleDeleteMessage(msgId);
        } else if (authorChannelId) {
          handleDeleteUserMessages(authorChannelId);
        }
      }
    );

    // Initialize Simulator
    simulatorRef.current = new ChatSimulator(handleNewMessage);

    return () => {
      messageBuffer = [];
      if (dripTimer) clearInterval(dripTimer);
      if (twitchClientRef.current) twitchClientRef.current.disconnect();
      if (kickClientRef.current) kickClientRef.current.disconnect();
      if (youtubeClientRef.current) youtubeClientRef.current.disconnect();
      if (simulatorRef.current) simulatorRef.current.stop();
      if (window.ttsManager) window.ttsManager.cancel();
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
        twitchClientRef.current.channels.forEach(ch => {
          if (!twitchChannels.some(tc => tc.name.toLowerCase() === ch)) {
            twitchClientRef.current.leave(ch);
          }
        });
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

    // 2. Manage Kick Pusher connections
    const kickChannels = enabledChannels.filter(ch => ch.platform === 'kick');
    if (kickClientRef.current && !modeDemo) {
      if (kickChannels.length > 0) {
        if (!kickClientRef.current.isConnected) {
          kickClientRef.current.connect();
        }
        kickClientRef.current.channelsMap.forEach((_, ch) => {
          if (!kickChannels.some(kc => kc.name.toLowerCase().replace('@', '').trim() === ch)) {
            kickClientRef.current.leave(ch);
          }
        });
        kickChannels.forEach(ch => {
          kickClientRef.current.join(ch.name);
        });
        setPlatformStatuses(prev => ({
          ...prev,
          kick: kickClientRef.current.isConnected ? 'connected' : 'connecting'
        }));
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
        youtubeClientRef.current.activePolls.forEach((_, ch) => {
          if (!youtubeChannels.some(yc => yc.name.toLowerCase().replace('@', '').trim() === ch)) {
            youtubeClientRef.current.leave(ch);
          }
        });
        youtubeChannels.forEach(ch => {
          const cleanName = ch.name.toLowerCase().replace('@', '').trim();
          setPlatformStatuses(prev => ({
            ...prev,
            [cleanName]: prev[cleanName] === 'connected' ? 'connected' : 'connecting',
            youtube: 'connected'
          }));
          youtubeClientRef.current.join(ch.name, settings.youtubeChatMode || 'live');
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

  }, [activeChannels, modeDemo, settings.youtubeChatMode]);



  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Handle sending a streamer message to selected targets
  const handleSendMessage = async (text, targets) => {
    const promises = targets.map(async (target) => {
      const handleName = target.name || user?.ytCustomHandle || user?.username || 'Streamer';
      const realDisplayName = user?.ytChannelName || (target.displayName && !target.displayName.startsWith('@') ? target.displayName : handleName);
      const rawAvatar = target.avatar || user?.avatarUrl || user?.avatar;
      const validAvatarUrl = typeof rawAvatar === 'string' && rawAvatar.startsWith('http') ? rawAvatar : null;

      let tempOptId = null;
      // Only push optimistic message if we have a valid photo avatar URL OR for non-YouTube platforms
      if (validAvatarUrl || target.platform !== 'youtube') {
        tempOptId = 'opt_' + Math.random().toString(36).substring(2, 11);
        const streamerMsg = {
          id: tempOptId,
          platform: target.platform,
          channel: target.name.toLowerCase(),
          username: handleName,
          displayName: realDisplayName,
          avatarUrl: validAvatarUrl || undefined,
          color: '#ffc107',
          text: text,
          badges: ['broadcaster'],
          rawTimestamp: Date.now(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
        };
        setMessages(prev => [...prev, streamerMsg].slice(-300));
      }

      // Direct YouTube Live Chat API Posting
      if (target.platform === 'youtube') {
        const targetClean = (target.id || target.name || '').toLowerCase().replace(/^@+/, '').trim();
        const userConnectedHandle = (user?.ytCustomHandle || '').toLowerCase().replace(/^@+/, '').trim();
        const userConnectedId = (user?.ytChannelId || '').toLowerCase().trim();
        const userConnectedName = (user?.ytChannelName || '').toLowerCase().trim();

        const isUserConnectedChannel = target.verified || (
          targetClean && (
            (userConnectedHandle && targetClean === userConnectedHandle) ||
            (userConnectedId && targetClean === userConnectedId) ||
            (userConnectedName && targetClean === userConnectedName)
          )
        );

        if (!isUserConnectedChannel) {
          console.warn('[MultiChat] Cannot send chat message to unverified/unconnected YouTube channel:', target.name);
          alert(`Security Warning: You can only send chat messages to your own connected YouTube broadcast channel (@${userConnectedHandle || userConnectedName || 'connected_channel'}).`);
          return;
        }

        const liveChatId = resolveLiveChatId(target);
        
        try {
          const res = await fetch('/api/youtube/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user?.id,
              userEmail: user?.email,
              channelId: target.id || target.name,
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
          } else {
            console.log('[MultiChat] Successfully posted YouTube chat message:', result);
            if (result.id && tempOptId) {
              setMessages(prev => prev.map(m => m.id === tempOptId ? { ...m, id: result.id } : m));
            }
          }
        } catch (err) {
          console.warn('[MultiChat] Failed to dispatch YouTube message:', err);
        }
      }
    });

    await Promise.all(promises);
  };

  const resolveLiveChatId = (msgObj) => {
    if (msgObj?.liveChatId && typeof msgObj.liveChatId === 'string') {
      const trimmed = msgObj.liveChatId.trim();
      if (trimmed.length >= 20 && !trimmed.startsWith('sys-') && !trimmed.startsWith('LCC.') && !trimmed.startsWith('@') && !trimmed.startsWith('UC')) {
        return trimmed;
      }
    }
    const channelKey = (msgObj?.channel || msgObj?.name || '').toLowerCase().replace(/^@+/, '').trim();
    if (channelKey && youtubeClientRef.current?.activePolls?.has(channelKey)) {
      const poll = youtubeClientRef.current.activePolls.get(channelKey);
      if (poll?.liveChatId) return poll.liveChatId;
    }
    if (youtubeClientRef.current?.activePolls) {
      for (const [_, p] of youtubeClientRef.current.activePolls) {
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
    const channelName = msgObj?.channel || '';
    if (channelName && channelName !== 'global') {
      return channelName.replace(/^@+/, '');
    }
    const ytChan = activeChannels.find(ch => ch.enabled && ch.platform === 'youtube');
    if (ytChan && ytChan.name) {
      return ytChan.name.replace(/^@+/, '');
    }
    if (user?.user_metadata?.custom_handle) {
      return user.user_metadata.custom_handle.replace(/^@+/, '');
    }
    return 'username';
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
  const handleDeleteMessage = async (msgOrId) => {
    const msgId = typeof msgOrId === 'object' ? msgOrId.id : msgOrId;
    const msgObj = typeof msgOrId === 'object' 
      ? msgOrId 
      : messages.find(m => String(m.id) === String(msgId));
    
    setModeration(prev => {
      const next = new Set(prev.deletedMessageIds);
      next.add(msgId);
      return { ...prev, deletedMessageIds: next };
    });

    const platform = msgObj?.platform || 'youtube';
    if (platform === 'youtube' && user) {
      const liveChatId = resolveLiveChatId(msgObj);
      const targetChannelId = resolveTargetChannelId(msgObj) || msgObj?.username || msgObj?.displayName || '';
      console.log('[MultiChat] Executing YouTube API delete message:', msgId, 'liveChatId:', liveChatId, 'targetChannelId:', targetChannelId);
      try {
        const res = await fetch('/api/youtube/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            userEmail: user.email,
            action: 'delete',
            messageId: msgId,
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

  const handleDeleteUserMessages = (authorChannelId) => {
    setMessages(prevMessages => {
      const targetIds = prevMessages
        .filter(msg => msg.platform === 'youtube' && msg.channelId === authorChannelId)
        .map(msg => msg.id);

      if (targetIds.length > 0) {
        setModeration(prev => {
          const next = new Set(prev.deletedMessageIds);
          targetIds.forEach(id => next.add(id));
          return { ...prev, deletedMessageIds: next };
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

    const msgObj = isObj 
      ? msgOrUser 
      : messages.find(m => {
          const u1 = (m.username || '').replace(/^@+/, '').trim().toLowerCase();
          const u2 = (m.displayName || '').replace(/^@+/, '').trim().toLowerCase();
          return u1 === cleanUserLower || u2 === cleanUserLower;
        });

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

      const nextDeleted = (prev.deletedMessageIds instanceof Set) 
        ? new Set(prev.deletedMessageIds) 
        : new Set();
      messages.forEach(m => {
        const mUser = (m.username || '').replace(/^@+/, '').trim().toLowerCase();
        const mDisplay = (m.displayName || '').replace(/^@+/, '').trim().toLowerCase();
        const mChanId = m.channelId || m.userId || '';
        if (targetUsernames.has(mUser) || targetUsernames.has(mDisplay) || (mChanId && targetUsernames.has(mChanId))) {
          nextDeleted.add(m.id);
        }
      });

      return { ...prev, timedOutUsers: nextTimedOut, deletedMessageIds: nextDeleted };
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

    if (user) {
      console.log('[MultiChat] Executing YouTube API timeout user:', cleanUser, 'targetChannelId:', targetChannelId, 'durationSeconds:', durationSeconds);
      try {
        const res = await fetch('/api/youtube/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            userEmail: user.email,
            action: 'timeout',
            targetChannelId: targetChannelId,
            durationSeconds: durationSeconds,
            liveChatId: liveChatId,
            messageId: msgObj?.id
          })
        });
        const data = await res.json();
        console.log('[MultiChat] YouTube API timeout result:', data);
      } catch (err) {
        console.warn('[MultiChat] YouTube API timeout error:', err);
      }
    }
  };

  const handleBanUser = async (msgOrUser) => {
    const username = typeof msgOrUser === 'object' ? (msgOrUser.displayName || msgOrUser.username || msgOrUser.author) : msgOrUser;
    const cleanUser = (username || '').replace(/^@+/, '').trim();
    const msgObj = typeof msgOrUser === 'object' ? msgOrUser : messages.find(m => {
      const u1 = (m.username || '').replace(/^@+/, '').trim().toLowerCase();
      const u2 = (m.displayName || '').replace(/^@+/, '').trim().toLowerCase();
      return u1 === cleanUser.toLowerCase() || u2 === cleanUser.toLowerCase();
    });
    const modHandle = getModeratorHandle(msgObj);

    const keysToBan = new Set();
    if (cleanUser) keysToBan.add(cleanUser.toLowerCase());
    if (msgObj?.username) keysToBan.add(msgObj.username.replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.displayName) keysToBan.add(msgObj.displayName.replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.author) keysToBan.add(msgObj.author.replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.channelId) keysToBan.add(msgObj.channelId.toLowerCase());
    if (msgObj?.authorChannelId) keysToBan.add(msgObj.authorChannelId.toLowerCase());

    setModeration(prev => {
      const nextBanned = new Set(prev.bannedUsers);
      keysToBan.forEach(k => nextBanned.add(k));

      const nextDeleted = new Set(prev.deletedMessageIds);
      messages.forEach(m => {
        const u1 = (m.username || '').replace(/^@+/, '').trim().toLowerCase();
        const u2 = (m.displayName || '').replace(/^@+/, '').trim().toLowerCase();
        const u3 = (m.author || '').replace(/^@+/, '').trim().toLowerCase();
        const cId = (m.channelId || m.authorChannelId || m.userId || '').toLowerCase();
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

    setMessages(prev => [
      ...prev,
      {
        id: 'sys-ban-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        platform: msgObj?.platform || 'youtube',
        channel: msgObj?.channel || 'global',
        username: 'System',
        displayName: 'System',
        text: `@${cleanUser} was hidden on channel by @${modHandle}.`,
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
      console.log('[MultiChat] Executing YouTube API ban user:', cleanUser, 'targetChannelId:', targetChannelId);
      try {
        const res = await fetch('/api/youtube/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            userEmail: user.email,
            action: 'ban',
            targetChannelId: targetChannelId,
            username: cleanUser,
            displayName: msgObj?.displayName || cleanUser,
            liveChatId: liveChatId
          })
        });
        const data = await res.json();
        console.log('[MultiChat] YouTube API ban result:', data);
      } catch (err) {
        console.warn('[MultiChat] YouTube API ban error:', err);
      }
    }
  };

  const handleUnbanUser = async (msgOrUser) => {
    const username = typeof msgOrUser === 'object' ? (msgOrUser.displayName || msgOrUser.username || msgOrUser.author) : msgOrUser;
    const cleanUser = (username || '').replace(/^@+/, '').trim();
    const msgObj = typeof msgOrUser === 'object' ? msgOrUser : messages.find(m => {
      const u1 = (m.username || '').replace(/^@+/, '').trim().toLowerCase();
      const u2 = (m.displayName || '').replace(/^@+/, '').trim().toLowerCase();
      return u1 === cleanUser.toLowerCase() || u2 === cleanUser.toLowerCase();
    });
    const modHandle = getModeratorHandle(msgObj);

    const keysToUnban = new Set();
    if (cleanUser) keysToUnban.add(cleanUser.toLowerCase());
    if (msgObj?.username) keysToUnban.add(msgObj.username.replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.displayName) keysToUnban.add(msgObj.displayName.replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.author) keysToUnban.add(msgObj.author.replace(/^@+/, '').trim().toLowerCase());
    if (msgObj?.channelId) keysToUnban.add(msgObj.channelId.toLowerCase());
    if (msgObj?.authorChannelId) keysToUnban.add(msgObj.authorChannelId.toLowerCase());

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
            userId: user.id,
            userEmail: user.email,
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
    if (!msg || msg.platform !== 'youtube' || !user) return;
    const liveChatId = resolveLiveChatId(msg);
    const targetChannelId = resolveTargetChannelId(msg);
    const isMod = msg.badges && msg.badges.includes('moderator');
    const action = isMod ? 'remove_moderator' : 'add_moderator';
    const cleanUser = (msg.displayName || msg.username || '').replace(/^@+/, '').trim();

    console.log('[MultiChat] Executing YouTube API toggle moderator:', action, 'targetChannelId:', targetChannelId);

    try {
      const res = await fetch('/api/youtube/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          action: action,
          targetChannelId: targetChannelId,
          modId: msg.modId || targetChannelId,
          liveChatId: liveChatId
        })
      });
      const data = await res.json();
      console.log('[MultiChat] YouTube API toggle moderator result:', data);

      if (res.ok && !data.error) {
        setMessages(prev => prev.map(m => {
          if (m.username === msg.username || (targetChannelId && m.channelId === targetChannelId)) {
            const currentBadges = m.badges || [];
            const newBadges = isMod ? currentBadges.filter(b => b !== 'moderator') : [...currentBadges, 'moderator'];
            return { ...m, badges: newBadges };
          }
          return m;
        }));
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: 'sys-mod-err-' + Date.now(),
            platform: 'youtube',
            channel: msg.channel || 'global',
            username: 'System',
            displayName: 'System',
            text: `⚠️ YouTube API Moderator Notice for @${cleanUser}: ${data.error || 'Failed to update moderator status on YouTube.'}`,
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
          isShorts: msg.isShorts,
          avatar: msg.avatar,
          badges: msg.badges || [],
          badgeImages: msg.badgeImages || {},
          badgeVersions: msg.badgeVersions || {},
          color: msg.color,
          monthsSubscribed: msg.monthsSubscribed,
          giftedSubsCount: msg.giftedSubsCount
        });
      }
    });
    return Array.from(chattersMap.values());
  }, [messages]);

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

  // Always exactly 200 messages in the DOM.
  // In live mode the window slides forward with new messages.
  // In history mode the window is frozen (new messages accumulate in unreadCount).
  const recentMessages = useMemo(() => {
    if (windowEnd === null) {
      if (messages.length <= 200) return messages;
      return messages.slice(-200); // live: always newest 200
    }
    const end = Math.min(windowEnd, messages.length);
    const start = Math.max(0, end - 200);
    return messages.slice(start, end);            // history: frozen 200-message window
  }, [messages, windowEnd]);

  // True when the visible window doesn't start at the very beginning of history
  const hasMore = windowEnd !== null ? windowEnd > 200 : messages.length > 200;

  const [viewerDisplayMode, setViewerDisplayMode] = useState('individual'); // 'individual' | 'combined' | 'hidden'
  const [uptimeDisplayMode, setUptimeDisplayMode] = useState('individual'); // 'individual' | 'combined' | 'hidden'
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

  const viewersByPlatform = {};
  const uptimesByPlatform = {};

  activeChannels.filter(ch => ch.enabled).forEach(ch => {
    const cleanName = ch.name.toLowerCase().replace('@', '').trim();
    const status = platformStatuses[cleanName] || platformStatuses[ch.platform];
    const isChannelConnected = status === 'connected';
    const isShorts = ch.platform === 'youtube' && youtubeShortsChannels.has(cleanName);
    const displayPlatform = isShorts ? 'youtube_shorts' : ch.platform;

    // 1. Calculate watchers count for this channel
    let count = 0;
    if (isChannelConnected) {
      const realCount = streamViewers[cleanName];
      if (realCount !== undefined && realCount !== null) {
        count = realCount; // Use exact real viewer count
      }
    }
    
    if (!viewersByPlatform[displayPlatform]) {
      viewersByPlatform[displayPlatform] = 0;
    }
    viewersByPlatform[displayPlatform] += count;

    // 2. Calculate elapsed stream duration for this channel
    if (isChannelConnected) {
      const startTimeStr = streamStartTimes[cleanName];
      if (startTimeStr) {
        const startMs = new Date(startTimeStr).getTime();
        if (!isNaN(startMs)) {
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

  const totalConnectedViewers = Object.entries(streamViewers)
    .filter(([chName]) => activeChannels.some(ch => ch.enabled && ch.name.toLowerCase().replace('@', '').trim() === chName))
    .reduce((sum, [, count]) => sum + (count || 0), 0);

  const displayViewerCount = activeChannels.some(ch => ch.enabled) ? totalConnectedViewers : 0;

  const getViewersTooltip = () => {
    const parts = [];
    activeChannels.filter(ch => ch.enabled).forEach(ch => {
      const v = streamViewers[ch.name.toLowerCase().replace('@', '').trim()] || 0;
      parts.push(`${ch.platform.toUpperCase()} (${ch.name}): ${v} viewers`);
    });
    return parts.length > 0 ? parts.join('\n') : 'No active streams';
  };

  const getUptimeTooltip = () => {
    const parts = [];
    activeChannels.filter(ch => ch.enabled).forEach(ch => {
      const startTime = streamStartTimes[ch.name.toLowerCase().replace('@', '').trim()];
      if (startTime) {
        const diffSecs = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
        const durationStr = diffSecs >= 0 ? formatUptime(diffSecs) : '00:00:00';
        parts.push(`${ch.platform.toUpperCase()} (${ch.name}): ${durationStr}`);
      } else {
        parts.push(`${ch.platform.toUpperCase()} (${ch.name}): N/A`);
      }
    });
    return parts.length > 0 ? parts.join('\n') : 'No active streams';
  };

  const activeEnabledChannels = activeChannels.filter(ch => ch.enabled);

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
                      {Object.keys(viewersByPlatform).length > 0 ? (
                        Object.entries(viewersByPlatform).map(([platform, count]) => (
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
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
              {activeEnabledChannels.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {activeEnabledChannels.map(ch => {
                    const cleanName = ch.name.toLowerCase().replace('@', '').trim();
                    const v = streamViewers[cleanName] || 0;
                    const startTime = streamStartTimes[cleanName];
                    let durationStr = 'offline';
                    if (startTime) {
                      const diffSecs = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
                      durationStr = diffSecs >= 0 ? formatUptime(diffSecs) : '00:00:00';
                    }
                    return (
                      <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PlatformLogo platform={ch.platform} size={12} />
                        <span style={{ fontWeight: 600 }}>{ch.name}:</span>
                        <span>{v} viewers ({durationStr})</span>
                      </div>
                    );
                  })}
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
                  alt={user.username || 'User Profile'} 
                  className="user-profile-pic"
                  referrerPolicy="no-referrer"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 'var(--burger-btn-border-radius, 8px)',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="white"
                  height="20"
                  width="20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2c2.757 0 5 2.243 5 5.001 0 2.756-2.243 5-5 5s-5-2.244-5-5c0-2.758 2.243-5.001 5-5.001zm0-2c-3.866 0-7 3.134-7 7.001 0 3.865 3.134 7 7 7s7-3.135 7-7c0-3.867-3.134-7.001-7-7.001zm6.369 13.353c-.497.498-1.057.931-1.658 1.302 2.872 1.874 4.378 5.083 4.972 7.346h-19.387c.572-2.29 2.058-5.503 4.973-7.358-.603-.374-1.162-.811-1.658-1.312-4.258 3.072-5.611 8.506-5.611 10.669h24c0-2.142-1.44-7.557-5.631-10.647z" />
                </svg>
              )}
            </button>
            {isProfileOpen && (
              <nav className="popup-window" style={{ visibility: 'visible', opacity: 1, transform: 'scale(1)' }}>
                <legend>{user.username || 'Profile'}</legend>
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
                  const isActive = activeTab === ch.name.toLowerCase();
                  const cleanShortsName = ch.name.toLowerCase().replace('@', '').trim();
                  const isOnline = !!streamStartTimes[cleanName];
                  const viewers = streamViewers[cleanName] || 0;
                  
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
                            isShorts={ch.platform === 'youtube' && youtubeShortsChannels.has(cleanShortsName)} 
                            size={20} 
                          />
                          <span className="sidebar-nav-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', width: '100%', minWidth: 0 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {ch.platform === 'youtube' ? (resolvedStreamerNames[cleanName] || ch.name) : ch.name}
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
                        {ch.name} {isOnline ? `(LIVE - ${viewers} viewers)` : '(Offline)'}
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
          <div className="breadcrumb-container">
            <span className="breadcrumb-item">
              {['all', 'events', 'mentions'].includes(activeTab) ? 'All' : 
                activeChannels.find(ch => ch.name.toLowerCase() === activeTab)?.platform.toUpperCase() || 'Platform'}
            </span>
            <ChevronRight size={12} style={{ color: '#71717a' }} />
            <span className="breadcrumb-item active">
              {activeTab === 'all' ? 'General' : 
               activeTab === 'events' ? 'Events' : 
               activeTab === 'mentions' ? 'Mentions' : 
               activeChannels.find(ch => ch.name.toLowerCase() === activeTab)?.name || activeTab}
            </span>
          </div>

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
        />
      )}
    </div>
  );
}
