import React, { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { parseMessageContent } from '../utils/emotes';
import { ArrowDown, MessageSquare, MoreVertical, Volume2, User, ShieldAlert, Trash2, Star, ExternalLink, Clock, ShieldCheck, ShieldOff, ChevronRight } from 'lucide-react';
import PlatformLogo, { DefaultSubscriberBadge, KickGiftedSubsBadge, TwitchDefaultSubscriberBadge } from './PlatformLogo';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/interfaces-tooltip';
import { getLiveTwitchBadgeUrl } from '../utils/twitchChat';
import { requestKickAvatar } from '../utils/kickAvatarResolver';

const appStartTime = Date.now();
export const GLOBAL_AVATAR_CACHE = new Map();
export const GLOBAL_DISPLAY_NAME_CACHE = new Map();

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

export const checkIsMentioned = (text, user, activeChannels = []) => {
  if (!text || typeof text !== 'string') return false;
  const textLower = text.toLowerCase();

  const targets = new Set();
  if (user?.username) {
    targets.add(user.username.toLowerCase());
    user.username.split(/\s+/).forEach(part => {
      if (part.length > 2) targets.add(part.toLowerCase());
    });
  }
  if (user?.channel_name) {
    targets.add(user.channel_name.toLowerCase());
  }
  if (Array.isArray(activeChannels)) {
    activeChannels.forEach(ch => {
      if (ch.name) {
        const cleanName = ch.name.toLowerCase().replace('@', '').trim();
        if (cleanName.length > 1) targets.add(cleanName);
      }
    });
  }
  targets.add('streamer');
  targets.add('broadcaster');

  for (const target of targets) {
    if (textLower.includes(`@${target}`) || textLower.includes(target)) {
      return true;
    }
  }
  return false;
};

export default function ChatFeed({ 
  messages, 
  onChatterClick, 
  settings, 
  moderation,
  activeTab = 'all',
  selectedChatter,
  onBlockUser,
  blockedUsers = new Set(),
  isInitialLoading = false,
  streamStartTimes = {},
  onThreadClick,
  onLoadMore,         // called when user scrolls near the top
  hasMore = false,    // true when older messages exist beyond the current window
  onResetDisplay,     // called when user returns to the bottom — resets to 200
  onScrollUp,         // called when user scrolls up from the bottom (breaks lock)
  totalMessagesCount = 0,
  onDeleteMessage,
  onTimeoutUser,
  onBanUser,
  onUnbanUser,
  onToggleModerator,
  onClearChat,
  onConnectChannel,
  onExploreEvents,
  user = { username: 'Streamer' },
  activeChannels = []
}) {
  const feedRef = useRef(null);

  // Continuously populate global avatar & display name cache for creator and active channels
  useEffect(() => {
    if (user) {
      const creatorAvatar = user?.avatarUrl || (typeof user?.avatar === 'string' && user?.avatar.startsWith('http') ? user.avatar : null);
      if (creatorAvatar) {
        const uName = (user?.username || '').toLowerCase().replace(/^@+/, '').trim();
        if (uName && uName !== 'streamer') GLOBAL_AVATAR_CACHE.set(uName, creatorAvatar);
        const ytHandle = (user?.ytCustomHandle || '').toLowerCase().replace(/^@+/, '').trim();
        if (ytHandle) GLOBAL_AVATAR_CACHE.set(ytHandle, creatorAvatar);
        const ytChan = (user?.ytChannelName || '').toLowerCase().replace(/^@+/, '').trim();
        if (ytChan) GLOBAL_AVATAR_CACHE.set(ytChan, creatorAvatar);
      }
      const creatorTitle = user?.ytChannelName || user?.channel_name || null;
      if (creatorTitle) {
        const uName = (user?.username || '').toLowerCase().replace(/^@+/, '').trim();
        if (uName && uName !== 'streamer') GLOBAL_DISPLAY_NAME_CACHE.set(uName, creatorTitle);
        const ytHandle = (user?.ytCustomHandle || '').toLowerCase().replace(/^@+/, '').trim();
        if (ytHandle) GLOBAL_DISPLAY_NAME_CACHE.set(ytHandle, creatorTitle);
      }
    }
    if (Array.isArray(activeChannels)) {
      activeChannels.forEach(ch => {
        if (ch.avatar && typeof ch.avatar === 'string' && ch.avatar.startsWith('http')) {
          const cleanName = ch.name ? ch.name.toLowerCase().replace(/^@+/, '').trim() : '';
          if (cleanName) GLOBAL_AVATAR_CACHE.set(cleanName, ch.avatar);
          const cleanDisplay = ch.displayName ? ch.displayName.toLowerCase().replace(/^@+/, '').trim() : '';
          if (cleanDisplay) GLOBAL_AVATAR_CACHE.set(cleanDisplay, ch.avatar);
        }
        if (ch.displayName && !ch.displayName.startsWith('@')) {
          const cleanName = ch.name ? ch.name.toLowerCase().replace(/^@+/, '').trim() : '';
          if (cleanName) GLOBAL_DISPLAY_NAME_CACHE.set(cleanName, ch.displayName);
        }
      });
    }
    messages.forEach(msg => {
      const raw = msg.avatarUrl || msg.avatar;
      if (raw && typeof raw === 'string' && raw.startsWith('http') && !isDefaultAvatar(raw)) {
        const cleanUser = msg.username ? msg.username.toLowerCase().replace(/^@+/, '').trim() : '';
        if (cleanUser) GLOBAL_AVATAR_CACHE.set(cleanUser, raw);
        const cleanDisplay = msg.displayName ? msg.displayName.toLowerCase().replace(/^@+/, '').trim() : '';
        if (cleanDisplay) GLOBAL_AVATAR_CACHE.set(cleanDisplay, raw);
      }
      if (msg.displayName && !msg.displayName.startsWith('@') && msg.username) {
        const cleanUser = (msg.username || '').toLowerCase().replace(/^@+/, '').trim();
        if (cleanUser) GLOBAL_DISPLAY_NAME_CACHE.set(cleanUser, msg.displayName);
      }
    });
  }, [user, activeChannels, messages]);

  const [, setAvatarUpdateTick] = useState(0);
  useEffect(() => {
    const handleAvatarResolved = (e) => {
      if (e.detail?.username && e.detail?.avatar) {
        GLOBAL_AVATAR_CACHE.set(e.detail.username, e.detail.avatar);
        setAvatarUpdateTick(t => t + 1);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('kick-avatar-resolved', handleAvatarResolved);
      return () => window.removeEventListener('kick-avatar-resolved', handleAvatarResolved);
    }
  }, []);

  const showAvatarForPlatform = (platform) => {
    const norm = platform ? platform.toLowerCase() : '';
    if (norm === 'youtube') return settings.showYoutubeProfilePictures;
    if (norm === 'twitch') return settings.showTwitchProfilePictures;
    if (norm === 'kick') return settings.showKickProfilePictures;
    return false;
  };

  const handleSpeakSuperchat = (msg) => {
    if (!window.speechSynthesis) return;
    try {
      const textToSpeak = `@${msg.displayName || msg.username} Gave ${msg.eventDetails?.amount || ''}${msg.text ? ' , ' + msg.text : ''}`;
      const vol = settings.ttsVolume !== undefined ? settings.ttsVolume / 100 : 0.5;
      const speed = settings.ttsSpeed !== undefined ? settings.ttsSpeed : 1.0;
      
      if (window.ttsManager) {
        window.ttsManager.speak(textToSpeak, vol, speed, settings.ttsVoiceName, true);
      } else {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.volume = vol;
        utterance.rate = speed;
        if (settings.ttsVoiceName) {
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(v => v.name === settings.ttsVoiceName);
          if (voice) utterance.voice = voice;
        }
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error('Failed to speak Superchat:', err);
    }
  };

  const handleSpeakMessage = (msg) => {
    if (!window.speechSynthesis) return;
    try {
      let cleanText = msg.text
        .replace(/https?:\/\/\S+/gi, 'link')
        .replace(/:[a-zA-Z0-9_]+:/g, ''); // strip emotes
        
      const displayName = msg.displayName || msg.username;
      const textToSpeak = settings.readTtsUsername !== false 
        ? `${displayName} says: ${cleanText}` 
        : cleanText;

      const vol = settings.ttsVolume !== undefined ? settings.ttsVolume / 100 : 0.5;
      const speed = settings.ttsSpeed !== undefined ? settings.ttsSpeed : 1.0;
      
      if (window.ttsManager) {
        window.ttsManager.speak(textToSpeak, vol, speed, settings.ttsVoiceName, true);
      } else {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.volume = vol;
        utterance.rate = speed;
        if (settings.ttsVoiceName) {
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(v => v.name === settings.ttsVoiceName);
          if (voice) utterance.voice = voice;
        }
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error('Failed to speak message:', err);
    }
  };
  const innerRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef(null);
  const [isLocked, setIsLocked] = useState(true);
  const isLockedRef = useRef(true); // Ref mirror so event handlers always see current value
  const scrollRestoreRef = useRef(null); // stores scrollHeight before load-more so we can restore position

  // Keep ref in sync with state
  const setIsLockedSync = (val) => {
    isLockedRef.current = val;
    setIsLocked(val);
  };

  // Dynamically load Google Font in head
  useEffect(() => {
    const fontFamily = settings.fontFamily;
    if (!fontFamily || fontFamily === 'inherit') return;
    
    const linkId = `gfont-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(linkId)) return;
    
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}&display=swap`;
    document.head.appendChild(link);
  }, [settings.fontFamily]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
      if (newMessagesLineTimeoutRef.current) {
        clearTimeout(newMessagesLineTimeoutRef.current);
      }
    };
  }, []);
  const [unreadCount, setUnreadCount] = useState(0);
  const [firstNewMessageId, setFirstNewMessageId] = useState(null);
  const firstNewMessageIdRef = useRef(null);
  const setFirstNewMessageIdSync = (val) => {
    firstNewMessageIdRef.current = val;
    setFirstNewMessageId(val);
  };
  const newMessagesLineTimeoutRef = useRef(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [timeoutTargetMsg, setTimeoutTargetMsg] = useState(null);
  const [selectedTimeoutDuration, setSelectedTimeoutDuration] = useState(300);
  const [revealedDeletedIds, setRevealedDeletedIds] = useState(new Set());

  const handleToggleMenu = (e, msg) => {
    e.stopPropagation();
    if (activeMenuId === msg.id) {
      setActiveMenuId(null);
      setMenuPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

    const right = Math.max(10, viewportWidth - rect.right);
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedMenuHeight = 270;

    let style = {
      position: 'fixed',
      right: `${right}px`,
      zIndex: 99999,
      width: '220px'
    };

    if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
      const calcTop = rect.top - estimatedMenuHeight - 6;
      if (calcTop < 10) {
        style.top = '10px';
        style.maxHeight = `${Math.max(160, rect.top - 16)}px`;
        style.overflowY = 'auto';
      } else {
        style.bottom = `${viewportHeight - rect.top + 6}px`;
        style.top = 'auto';
      }
    } else {
      const calcTop = rect.bottom + 6;
      if (calcTop + estimatedMenuHeight > viewportHeight - 10) {
        style.top = `${calcTop}px`;
        style.maxHeight = `${Math.max(160, viewportHeight - rect.bottom - 16)}px`;
        style.overflowY = 'auto';
      } else {
        style.top = `${calcTop}px`;
        style.bottom = 'auto';
      }
    }

    setMenuPos({ style, msg });
    setActiveMenuId(msg.id);
  };

  const toggleRevealDeleted = (id) => {
    setRevealedDeletedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!activeMenuId && !timeoutTargetMsg) return;
    const handleClickOutside = (e) => {
      if (
        e.target.closest('.message-context-menu') || 
        e.target.closest('.timeout-popup-container') ||
        e.target.closest('.msg-hover-action-btn') ||
        e.target.closest('.superchat-more-btn') ||
        e.target.closest('.message-actions-menu-btn')
      ) {
        return;
      }
      setActiveMenuId(null);
      setMenuPos(null);
      setTimeoutTargetMsg(null);
    };
    const handleScroll = (e) => {
      if (e.target && e.target.closest && (e.target.closest('.chat-feed-panel') || e.target.closest('#main-chat-messages-container'))) {
        setActiveMenuId(null);
        setMenuPos(null);
        setTimeoutTargetMsg(null);
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [activeMenuId, timeoutTargetMsg]);
  const [show24HrMs, setShow24HrMs] = useState(false);

  const toggleTimestampFormat = () => {
    setShow24HrMs(prev => !prev);
  };

  const renderTimestampText = (msg) => {
    try {
      const date = new Date(msg.rawTimestamp || Date.now());
      if (show24HrMs) {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        const parts = formatter.formatToParts(date);
        let hh = '', mm = '', ss = '';
        parts.forEach(p => {
          if (p.type === 'hour') hh = p.value;
          if (p.type === 'minute') mm = p.value;
          if (p.type === 'second') ss = p.value;
        });
        const ms = date.getMilliseconds().toString().padStart(3, '0');
        return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}.${ms}`;
      } else {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          hour12: true,
          hour: '2-digit',
          minute: '2-digit'
        });
        return formatter.format(date).replace(/\u202f/g, ' ');
      }
    } catch (e) {
      console.warn('Failed to format timestamp with Asia/Kolkata timezone, falling back to local browser timezone:', e);
      try {
        const date = new Date(msg.rawTimestamp || Date.now());
        if (show24HrMs) {
          const hh = date.getHours().toString().padStart(2, '0');
          const mm = date.getMinutes().toString().padStart(2, '0');
          const ss = date.getSeconds().toString().padStart(2, '0');
          const ms = date.getMilliseconds().toString().padStart(3, '0');
          return `${hh}:${mm}:${ss}.${ms}`;
        } else {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        }
      } catch (err2) {
        return msg.timestamp || '';
      }
    }
  };

  // Close context dropdown when clicking outside
  useEffect(() => {
    if (activeMenuId === null) return;
    const handleClose = () => setActiveMenuId(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [activeMenuId]);

  // Snapping scroll to bottom when returning to tab
  useEffect(() => {
    const handleFocus = () => {
      if (isLockedRef.current) {
        scrollToBottom();
        setTimeout(scrollToBottom, 50);
        setTimeout(scrollToBottom, 150);
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []); // Run once — uses ref for current lock state

  // Set up ResizeObserver to handle layout shifts, emote loads, avatar loads
  useEffect(() => {
    const feed = feedRef.current;
    const inner = innerRef.current;
    if (!feed || !inner) return;

    const resizeObserver = new ResizeObserver(() => {
      // Use ref to avoid stale closure
      if (isLockedRef.current) {
        scrollToBottom();
      }
    });

    resizeObserver.observe(inner);
    return () => {
      resizeObserver.disconnect();
    };
  }, []); // Run once — uses ref for current lock state

  // Monitor scroll to handle locking + reverse infinite scroll
  const handleScroll = () => {
    const feed = feedRef.current;
    if (!feed) return;

    if (isProgrammaticScrollRef.current) return;

    const wasLocked = isLockedRef.current;

    // Check if the user is close to the bottom (using settings.scrollLockThreshold or 80px threshold for responsiveness)
    const threshold = settings.scrollLockThreshold !== undefined ? settings.scrollLockThreshold : 80;
    const isAtBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < threshold;
    setIsLockedSync(isAtBottom);
    if (isAtBottom) {
      setUnreadCount(0);
      // User just scrolled back to the bottom from a scrolled-up position → reset display window
      if (!wasLocked && onResetDisplay) {
        onResetDisplay();
        scrollToBottom();
      }
    } else {
      // User scrolled up!
      if (wasLocked && onScrollUp) onScrollUp();
    }

    // Load older messages when user scrolls near the top
    // scrollRestoreRef being set means a load-more is already in-flight — skip duplicate
    if (feed.scrollTop < 80 && hasMore && onLoadMore && scrollRestoreRef.current === null) {
      scrollRestoreRef.current = feed.scrollHeight; // snapshot height BEFORE new items mount
      onLoadMore();
    }
  };

  // Manage New Messages separator line visibility and timers based on scroll lock state
  useEffect(() => {
    if (isLocked) {
      // User is at the bottom (either scrolled back or was already there)
      if (firstNewMessageIdRef.current) {
        if (newMessagesLineTimeoutRef.current) {
          clearTimeout(newMessagesLineTimeoutRef.current);
        }
        newMessagesLineTimeoutRef.current = setTimeout(() => {
          setFirstNewMessageIdSync(null);
          newMessagesLineTimeoutRef.current = null;
        }, 10000); // 10 seconds
      }
    } else {
      // User scrolled up — reset tracking for a clean slate
      setFirstNewMessageIdSync(null);
      if (newMessagesLineTimeoutRef.current) {
        clearTimeout(newMessagesLineTimeoutRef.current);
        newMessagesLineTimeoutRef.current = null;
      }
    }
  }, [isLocked]);

  // Reset programmatic scroll flag upon manual user interaction (wheel, drag, touch)
  const handleUserInteraction = () => {
    if (programmaticScrollTimeoutRef.current) {
      clearTimeout(programmaticScrollTimeoutRef.current);
      programmaticScrollTimeoutRef.current = null;
    }
    isProgrammaticScrollRef.current = false;
  };

  // Scroll to bottom helper
  const scrollToBottom = () => {
    const feed = feedRef.current;
    if (feed) {
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current);
      }
      isProgrammaticScrollRef.current = true;
      feed.scrollTop = feed.scrollHeight + 10000;
      
      programmaticScrollTimeoutRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        programmaticScrollTimeoutRef.current = null;
      }, 300); // 300ms safety timeout to let browser layout/scroll settle
      setIsLockedSync(true);
      setUnreadCount(0);
    }
  };

  // Scroll to bottom when message count increases (if locked)
  useEffect(() => {
    // Use the ref to get the current lock state (avoids stale closure bug)
    if (isLockedRef.current) {
      scrollToBottom();
      // Secondary deferred scroll to handle browser layout/rendering delays
      const handle = requestAnimationFrame(() => {
        scrollToBottom();
      });
      return () => cancelAnimationFrame(handle);
    } else {
      setUnreadCount(prev => prev + 1);
      // Track the first new message that arrives while scrolled up
      if (!firstNewMessageIdRef.current && messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) {
          setFirstNewMessageIdSync(lastMsg.id);
        }
      }
    }
  }, [totalMessagesCount]);

  // Fires when: (a) length changes — new message arrived at bottom
  //             (b) first visible message changes — window slid to a different batch
  const firstMsgId = messages.length > 0 ? String(messages[0].id) : '';
  useLayoutEffect(() => {
    if (scrollRestoreRef.current !== null) {
      const feed = feedRef.current;
      if (feed) {
        feed.scrollTop = feed.scrollHeight - scrollRestoreRef.current;
      }
      scrollRestoreRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, firstMsgId]);

  // Scroll to bottom when switching tabs
  useEffect(() => {
    scrollToBottom();
  }, [activeTab]);

  // Pre-compile blocklist regexes once when blocklist changes (not per-message per-render)
  const blocklistRegexes = useMemo(() => {
    if (!settings.blocklist || settings.blocklist.length === 0) return [];
    return settings.blocklist
      .filter(w => w)
      .map(w => ({ word: w, re: new RegExp(`\\b${w}\\b`, 'gi') }));
  }, [settings.blocklist]);

  // Clean filters for blocklisted terms
  const filterBlocklist = (text) => {
    if (blocklistRegexes.length === 0) return text;
    let filtered = text;
    blocklistRegexes.forEach(({ re }) => {
      re.lastIndex = 0; // reset stateful regex before each use
      filtered = filtered.replace(re, '***');
    });
    return filtered;
  };

  // Filter messages based on active channels, blocked and banned users checking all candidate user keys
  const visibleMessages = useMemo(() => {
    const enabledSet = new Set(
      (activeChannels || []).filter(ch => ch.enabled).map(ch => `${ch.platform}:${ch.name.toLowerCase().replace(/^@+/, '').trim()}`)
    );
    const enabledPlatforms = new Set(
      (activeChannels || []).filter(ch => ch.enabled).map(ch => ch.platform)
    );

    return messages.filter(msg => {
      // Filter out messages from removed or disabled channels
      if (!msg.isSystemEvent && activeChannels && activeChannels.length > 0) {
        const cleanChan = (msg.channel || '').toLowerCase().replace(/^@+/, '').trim();
        const msgKey = `${msg.platform}:${cleanChan}`;
        if (cleanChan) {
          if (!enabledSet.has(msgKey) && !enabledPlatforms.has(msg.platform)) return false;
        } else {
          if (!enabledPlatforms.has(msg.platform)) return false;
        }
      }

      const u1 = String(msg.username || '').replace(/^@+/, '').trim().toLowerCase();
      const u2 = String(msg.displayName || '').replace(/^@+/, '').trim().toLowerCase();
      const u3 = String(msg.author || '').replace(/^@+/, '').trim().toLowerCase();
      const cId = String(msg.channelId || msg.authorChannelId || msg.userId || '').toLowerCase();

      const isBlocked = blockedUsers instanceof Set && (
        (u1 && blockedUsers.has(u1)) ||
        (u2 && blockedUsers.has(u2)) ||
        (u3 && blockedUsers.has(u3)) ||
        (cId && blockedUsers.has(cId))
      );

      const isBanned = moderation?.bannedUsers instanceof Set && (
        (u1 && moderation.bannedUsers.has(u1)) ||
        (u2 && moderation.bannedUsers.has(u2)) ||
        (u3 && moderation.bannedUsers.has(u3)) ||
        (cId && moderation.bannedUsers.has(cId))
      );

      if (isBlocked || isBanned) return false;
      return true;
    });
  }, [messages, blockedUsers, moderation?.bannedUsers, activeChannels]);

  // Dynamic YouTube Top Contributor / Leaderboard Rank (#1, #2, #3) mapping
  const youtubeTop3Ranks = useMemo(() => {
    const userDonationMap = new Map();
    const explicitRankMap = new Map();

    messages.forEach(msg => {
      const keys = [
        msg.channelId,
        msg.authorChannelId,
        msg.authorExternalChannelId,
        msg.userId,
        msg.username,
        msg.displayName
      ].filter(Boolean).map(k => String(k).toLowerCase().trim());

      if (keys.length === 0) return;

      // Extract donation amounts
      if (msg.isSystemEvent && msg.eventType === 'donation') {
        const amtStr = msg.eventDetails?.amount || '';
        const amt = parseFloat(String(amtStr).replace(/[^\d.]/g, ''));
        if (!isNaN(amt) && amt > 0) {
          keys.forEach(k => {
            userDonationMap.set(k, (userDonationMap.get(k) || 0) + amt);
          });
        }
      }

      // Check if message carried a rank or badges with rank
      let rank = msg.youtubeRank;
      if (!rank && Array.isArray(msg.badges)) {
        if (msg.badges.includes('rank_1')) rank = 1;
        else if (msg.badges.includes('rank_2')) rank = 2;
        else if (msg.badges.includes('rank_3')) rank = 3;
      }
      if (rank && rank >= 1 && rank <= 3) {
        keys.forEach(k => {
          explicitRankMap.set(k, rank);
        });
      }
    });

    const sortedContributors = Array.from(userDonationMap.entries())
      .sort((a, b) => b[1] - a[1]);

    const top3Map = new Map();

    sortedContributors.slice(0, 3).forEach(([userKey], idx) => {
      top3Map.set(userKey, idx + 1);
    });

    // If explicit rank arrived from YouTube authorBadges and user isn't already assigned
    explicitRankMap.forEach((rank, userKey) => {
      if (!top3Map.has(userKey) && top3Map.size < 3) {
        top3Map.set(userKey, rank);
      }
    });

    return top3Map;
  }, [messages]);

  // Filter messages based on the active top tab
  // useMemo: only re-runs when visibleMessages or activeTab change
  const tabFilteredMessages = useMemo(() => visibleMessages.filter(msg => {
    // Bot message filtering
    if (settings.hideBotMessages) {
      const nameLower = (msg.username || '').toLowerCase();
      const displayLower = (msg.displayName || '').toLowerCase();
      const isBot = nameLower.endsWith('bot') || 
                    displayLower.endsWith('bot') || 
                    nameLower === 'streamelements' || 
                    nameLower === 'nightbot' || 
                    nameLower === 'wizebot' || 
                    nameLower === 'fossabot' || 
                    nameLower === 'moobot' ||
                    (msg.badges && msg.badges.includes('bot'));
      if (isBot) return false;
    }

    if (activeTab === 'all') return true;
    if (activeTab === 'events') return msg.isSystemEvent;
    if (activeTab === 'mentions') {
      return checkIsMentioned(msg.text, user, activeChannels);
    }
    const cleanChannel = msg.channel?.toLowerCase().replace('@', '').trim();
    const cleanTab = activeTab.toLowerCase().replace('@', '').trim();
    return cleanChannel === cleanTab;
  }), [visibleMessages, activeTab, settings.hideBotMessages, user, activeChannels]);

  const getUsernameColor = (msg) => {
    const platform = msg.platform;

    // Deterministic colors for chatters
    const nameColors = [
      '#ff6b6b', '#4dadf7', '#32d782', '#ffd43b', '#ff8787',
      '#da77f2', '#94d82d', '#ff922b', '#22b8cf', '#20c997'
    ];
    const getDeterministicColor = (username) => {
      if (!username) return '#d4d4d4';
      let hash = 0;
      for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
      }
      const index = Math.abs(hash) % nameColors.length;
      return nameColors[index];
    };

    // ── YouTube: match YouTube Live Chat colors exactly ──
    if (platform === 'youtube') {
      // Owner / Broadcaster → YouTube channel owner color
      if (msg.badges && msg.badges.includes('broadcaster')) {
        return '#ffffff';
      }
      // Moderator → YouTube blue wrench color
      if (msg.badges && msg.badges.includes('moderator')) {
        return '#5e84f1';
      }
      // Member / Subscriber → YouTube member green
      if (msg.badges && (msg.badges.includes('subscriber') || msg.badges.includes('member'))) {
        return '#2ba640';
      }
      // Regular YouTube chatter → off white (or random if enabled)
      if (settings.randomNameColors) {
        return getDeterministicColor(msg.username);
      }
      return '#d4d4d4';
    }

    // Assign randomized name color if enabled and platform did not provide color
    if (settings.randomNameColors && !msg.color) {
      return getDeterministicColor(msg.username);
    }

    // For all other platforms (Kick, Twitch, etc.), return msg.color directly to preserve the platform-fetched username colors without overriding them
    return msg.color || '#ffffff';
  };

  const getFormattedName = (msg) => {
    if (!msg) return '';
    let name = '';
    
    // Kick Chat ONLY: always show Channel Name without @ names
    if (msg.platform === 'kick' || settings.showChannelName) {
      name = msg.displayName || msg.username || '';
      name = name.replace(/^@+/, '');
    } else {
      const rawUser = msg.username || msg.displayName || '';
      name = `@${rawUser.replace(/^@+/, '')}`;
    }
    
    if (settings.removeAtSymbol || msg.platform === 'kick') {
      name = name.replace(/^@+/, '');
    }
    
    return name;
  };

  const renderUsernameWithTooltip = (msg, classNameSuffix = '', extraStyles = {}, children = null) => {
    const isSelected = selectedChatter && (msg?.username || '').toLowerCase() === (selectedChatter?.username || '').toLowerCase();
    const finalClassName = `msg-username${isSelected ? ' selected-username-highlight' : ''}${classNameSuffix ? ' ' + classNameSuffix : ''}`;
    const nameText = children || getFormattedName(msg);
    
    // For Kick Chat ONLY: disable hover tooltip popup when hovering over channel name
    if (msg.platform === 'kick') {
      return (
        <span 
          className={finalClassName}
          style={{ cursor: 'pointer', ...extraStyles }}
          onClick={() => onChatterClick(msg)}
        >
          {nameText}
        </span>
      );
    }

    const cleanUserKey = (msg.username || '').toLowerCase().replace(/^@+/, '');
    const cachedDisplayName = GLOBAL_DISPLAY_NAME_CACHE.get(cleanUserKey) || user?.ytChannelName;
    const resolvedDisplayName = (msg.displayName && !msg.displayName.startsWith('@') && msg.displayName !== msg.username)
      ? msg.displayName
      : (cachedDisplayName || msg.displayName || msg.username);

    const tooltipText = settings.showChannelName
      ? `@${msg.username.replace(/^@+/, '')}`
      : resolvedDisplayName.replace(/^@+/, '');
      
    return (
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <span 
            className={finalClassName}
            style={{ cursor: 'pointer', ...extraStyles }}
            onClick={() => onChatterClick(msg)}
          >
            {nameText}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    );
  };



  const getLevelColor = (level) => {
    if (level < 10) return '#9e9e9e'; // Grey
    if (level < 20) return '#FFEB3B'; // Vibrant Yellow (level 10-19)
    if (level < 30) return '#ff4b9f'; // Pink (level 20-29)
    if (level < 40) return '#00e5ff'; // Cyan (level 30-39)
    if (level < 50) return '#ffaa00'; // Yellow/Orange (level 40-49)
    if (level < 60) return '#ff4a4a'; // Red (level 50-59)
    if (level < 70) return '#00e676'; // Bright Green (level 60-69)
    if (level < 80) return '#b533ff'; // Purple (level 70-79)
    return '#ff3366'; // Pink-Red (level >= 80)
  };

  // Official Kick badge display order (matches kick.com chat)
  const KICK_BADGE_ORDER = ['broadcaster', 'moderator', 'vip', 'og', 'verified', 'staff', 'sub_gifter', 'founder', 'subscriber', 'bot'];
  const sortKickBadges = (badgesList) => {
    if (!Array.isArray(badgesList)) return [];
    return [...badgesList].filter(b => typeof b === 'string').sort((a, b) => {
      const aIsLevel = a.startsWith('level_');
      const bIsLevel = b.startsWith('level_');
      if (aIsLevel && !bIsLevel) return -1;
      if (!aIsLevel && bIsLevel) return 1;
      if (aIsLevel && bIsLevel) return 0;
      const ai = KICK_BADGE_ORDER.indexOf(a);
      const bi = KICK_BADGE_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  };

  const wrapWithTooltip = (element, text, key, side = "top") => {
    if (!text) return element;
    return (
      <Tooltip key={key} delayDuration={150}>
        <TooltipTrigger asChild>
          {element}
        </TooltipTrigger>
        <TooltipContent side={side} align="center">
          {text}
        </TooltipContent>
      </Tooltip>
    );
  };

  const renderBadgeWithTooltip = (badgeElement, badgeKey, uniqueKey) => {
    if (!badgeElement) return null;
    const keyToUse = uniqueKey || badgeKey;
    const tooltipText = badgeElement.props?.title || badgeElement.props?.alt;
    if (!tooltipText) return React.isValidElement(badgeElement) ? React.cloneElement(badgeElement, { key: keyToUse }) : badgeElement;
    
    const cleanElement = React.cloneElement(badgeElement, { title: undefined, key: keyToUse });
    return (
      <Tooltip key={keyToUse} delayDuration={150}>
        <TooltipTrigger asChild>
          {cleanElement}
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    );
  };


  const renderKickBadge = (badge, msg) => {
    if (!badge || typeof badge !== 'string') return null;
    const iconStyle = { width: 16, height: 16, verticalAlign: 'middle', marginRight: 4, display: 'inline-block' };
    if (badge.startsWith('level_')) {
      if (settings && settings.showLevelBadges === false) return null;
      // Always render custom dynamic SVGs for watch-time level badges to ensure beautiful glassmorphic aesthetics
      const level = parseInt(badge.split('_')[1]) || 1;
      const color = getLevelColor(level);
      
      let shapeSvg = null;
      if (level < 10) {
        // Circle (level 1-9)
        shapeSvg = (
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-block' }}>
            <defs>
              <linearGradient id="levelGreyGradient-feed" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#EAEAEA" />
                <stop offset="50%" stopColor="#D5D5D5" />
                <stop offset="100%" stopColor="#C5C5C5" />
              </linearGradient>
            </defs>
            <circle 
              cx="9" 
              cy="9" 
              r="7.5" 
              fill="url(#levelGreyGradient-feed)" 
              stroke="#A4A4A4"
              strokeWidth="0.8"
            />
            <text x="9" y="9.5" fontFamily="system-ui, -apple-system, sans-serif" fontSize="10.5" fontWeight="900" fill="#000" textAnchor="middle" dominantBaseline="central">
              {level}
            </text>
          </svg>
        );
      } else if (level < 20) {
        // Rounded rectangle (level 10-19)
        shapeSvg = (
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-block' }}>
            <defs>
              <linearGradient id="levelYellowGradient-feed" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFF59D" />
                <stop offset="50%" stopColor="#FFEB3B" />
                <stop offset="100%" stopColor="#FDD835" />
              </linearGradient>
            </defs>
            <rect 
              x="1.5" 
              y="1.5" 
              width="15" 
              height="15" 
              rx="3" 
              ry="3" 
              fill="url(#levelYellowGradient-feed)" 
              stroke="#C69A00"
              strokeWidth="0.8"
            />
            <text x="9" y="9.5" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9" fontWeight="900" fill="#000" textAnchor="middle" dominantBaseline="central">
              {level}
            </text>
          </svg>
        );
      } else if (level < 30) {
        // Teardrop / Shield shape (level 20-29)
        shapeSvg = (
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-block' }}>
            <path 
              d="M 9 1 C 9 1, 2 6.5, 2 11.5 C 2 15.5, 5.5 17, 9 17 C 12.5 17, 16 15.5, 16 11.5 C 16 6.5, 9 1, 9 1 Z" 
              fill={color} 
              stroke="#D01B7C"
              strokeWidth="0.8"
            />
            <text x="9" y="10.2" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9" fontWeight="900" fill="#000" textAnchor="middle" dominantBaseline="central">
              {level}
            </text>
          </svg>
        );
      } else if (level < 40) {
        // Rotated rounded square / Diamond (level 30-39)
        shapeSvg = (
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-block' }}>
            <defs>
              <linearGradient id="levelCyanGradient-feed" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#36F4FF" />
                <stop offset="50%" stopColor="#00F1FF" />
                <stop offset="100%" stopColor="#00B1BC" />
              </linearGradient>
            </defs>
            <rect 
              x="3.5" 
              y="3.5" 
              width="11" 
              height="11" 
              rx="2.2" 
              ry="2.2" 
              transform="rotate(45 9 9)"
              fill="url(#levelCyanGradient-feed)" 
              stroke="#00B1BC"
              strokeWidth="0.8"
            />
            <text x="9" y="9.5" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9" fontWeight="900" fill="#000" textAnchor="middle" dominantBaseline="central">
              {level}
            </text>
          </svg>
        );
      } else {
        // Horizontal Hexagon (level >= 40)
        shapeSvg = (
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-block' }}>
            <path d="M 1.5 9 L 5 2 L 13 2 L 16.5 9 L 13 16 L 5 16 Z" fill={color} />
            <text x="9" y="9.5" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9" fontWeight="900" fill="#000" textAnchor="middle" dominantBaseline="central">
              {level}
            </text>
          </svg>
        );
      }
      
      return (
        <span key={badge} className="kick-level-badge" title={`Level ${level}`}>
          {shapeSvg}
        </span>
      );
    }
    if (badge === 'broadcaster') {
      return (
        <span key={badge} className="kick-chatter-badge" title="Broadcaster" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg className="kick-svg-element" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={iconStyle}>
            <path d="M15.6773 22.1533C17.3698 22.1533 18.8182 21.5507 20.0233 20.3461C21.2282 19.1415 21.8307 17.6924 21.8307 16V6.15401C21.8307 4.46162 21.2286 3.01305 20.0233 1.80784C18.8182 0.602907 17.3698 0 15.6773 0C13.9849 0 12.5363 0.602907 11.3311 1.80784C10.1259 3.01285 9.52344 4.46162 9.52344 6.15401V16C9.52344 17.6923 10.1262 19.1415 11.3311 20.3461C12.5361 21.5507 13.9849 22.1533 15.6773 22.1533Z" fill="url(#paint0_linear_209_29909)"></path>
            <path d="M15.6773 22.1533C17.3698 22.1533 18.8182 21.5507 20.0233 20.3461C21.2282 19.1415 21.8307 17.6924 21.8307 16V6.15401C21.8307 4.46162 21.2286 3.01305 20.0233 1.80784C18.8182 0.602907 17.3698 0 15.6773 0C13.9849 0 12.5363 0.602907 11.3311 1.80784C10.1259 3.01285 9.52344 4.46162 9.52344 6.15401V16C9.52344 17.6923 10.1262 19.1415 11.3311 20.3461C12.5361 21.5507 13.9849 22.1533 15.6773 22.1533Z" fill="white" fillOpacity="0.3"></path>
            <path d="M26.3888 12.6731C26.1459 12.4295 25.8568 12.3076 25.5234 12.3076C25.1904 12.3076 24.902 12.4295 24.6581 12.6731C24.4147 12.9167 24.293 13.2051 24.293 13.5383V16C24.293 18.3718 23.4498 20.4006 21.7639 22.0864C20.0785 23.7723 18.0495 24.6153 15.6775 24.6153C13.3057 24.6153 11.2769 23.7723 9.59089 22.0864C7.90509 20.401 7.06226 18.3719 7.06226 16V13.5383C7.06226 13.2051 6.94041 12.9167 6.69692 12.6731C6.45329 12.4295 6.16514 12.3076 5.83159 12.3076C5.49804 12.3076 5.20956 12.4295 4.96606 12.6731C4.72237 12.9167 4.60059 13.2051 4.60059 13.5383V16C4.60059 18.8333 5.54627 21.2981 7.4371 23.3941C9.32799 25.4901 11.6645 26.6919 14.4467 26.9994V29.5381H9.52373C9.19038 29.5381 8.90196 29.6601 8.6584 29.9037C8.41477 30.1472 8.29293 30.4357 8.29293 30.7691C8.29293 31.1019 8.41477 31.391 8.6584 31.6344C8.90196 31.8778 9.19038 32 9.52373 32H21.831C22.1643 32 22.4531 31.8779 22.6963 31.6344C22.9402 31.391 23.0622 31.1019 23.0622 30.7691C23.0622 30.4358 22.9402 30.1472 22.6963 29.9037C22.4532 29.6601 22.1644 29.5381 21.831 29.5381H16.9086V26.9994C19.6904 26.6919 22.0267 25.4901 23.9178 23.3941C25.8089 21.2981 26.7548 18.8333 26.7548 16V13.5383C26.7548 13.2051 26.6327 12.9169 26.3888 12.6731Z" fill="url(#paint1_linear_209_29909)"></path>
          </svg>
        </span>
      );
    }
    if (badge === 'moderator') {
      return (
        <span key={badge} className="kick-chatter-badge" title="Moderator" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg className="kick-svg-element" fill="none" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={iconStyle}>
            <defs>
              <linearGradient id="KickModeratorBadgeA-feed" x1="18.8102" y1="-12.7222" x2="2.88536" y2="39.1063" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF6A4A"></stop>
                <stop offset="1" stopColor="#C70C00"></stop>
              </linearGradient>
              <linearGradient id="KickModeratorBadgeB-feed" x1="15.7467" y1="-4.75575" x2="16.321" y2="39.0672" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFC900"></stop>
                <stop offset="0.99" stopColor="#FF9500"></stop>
              </linearGradient>
              <linearGradient id="KickModeratorBadgeC-feed" x1="-14.9543" y1="46.9544" x2="32.0001" y2="-0.000509222" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0095FF"></stop>
                <stop offset="0.99" stopColor="#00C7FF"></stop>
              </linearGradient>
              <clipPath id="KickModeratorBadgeClipPath-feed">
                <rect width="32" height="32" fill="white"></rect>
              </clipPath>
            </defs>
            <g clipPath="url(#KickModeratorBadgeClipPath-feed)">
              <path d="M30 0C31.1046 0 32 0.895431 32 2V30C32 31.1046 31.1046 32 30 32H2C0.895431 32 0 31.1046 0 30V2C0 0.895431 0.895431 0 2 0H30ZM16.2197 2.99316C15.8292 2.60266 15.1962 2.60265 14.8057 2.99316L8.36328 9.43555C7.97294 9.82608 7.97284 10.4591 8.36328 10.8496L10.0918 12.5781C10.4823 12.9686 11.1153 12.9685 11.5059 12.5781L11.585 12.499L13.9414 14.8564L3.57129 25.2275C2.70357 26.0954 2.7035 27.5023 3.57129 28.3701C4.43911 29.2376 5.84612 29.2377 6.71387 28.3701L17.084 17.999L19.4414 20.3564L19.3633 20.4346C18.9728 20.8251 18.9728 21.4581 19.3633 21.8486L21.0918 23.5771C21.4823 23.9676 22.1154 23.9676 22.5059 23.5771L28.9482 17.1348C29.3386 16.7443 29.3386 16.1112 28.9482 15.7207L27.2197 13.9922C26.8293 13.6017 26.1962 13.6018 25.8057 13.9922L25.7266 14.0703L23.3701 11.7139C24.2377 10.8461 24.2376 9.4391 23.3701 8.57129C22.5023 7.7035 21.0954 7.70357 20.2275 8.57129L17.8701 6.21387L17.9482 6.13574C18.3388 5.74522 18.3388 5.11221 17.9482 4.72168L16.2197 2.99316Z" fill="url(#KickModeratorBadgeA-feed)"></path>
              <path d="M30 0C31.1046 0 32 0.895431 32 2V30C32 31.1046 31.1046 32 30 32H2C0.895431 32 0 31.1046 0 30V2C0 0.895431 0.895431 0 2 0H30ZM16.2197 2.99316C15.8292 2.60266 15.1962 2.60265 14.8057 2.99316L8.36328 9.43555C7.97294 9.82608 7.97284 10.4591 8.36328 10.8496L10.0918 12.5781C10.4823 12.9686 11.1153 12.9685 11.5059 12.5781L11.585 12.499L13.9414 14.8564L3.57129 25.2275C2.70357 26.0954 2.7035 27.5023 3.57129 28.3701C4.43911 29.2376 5.84612 29.2377 6.71387 28.3701L17.084 17.999L19.4414 20.3564L19.3633 20.4346C18.9728 20.8251 18.9728 21.4581 19.3633 21.8486L21.0918 23.5771C21.4823 23.9676 22.1154 23.9676 22.5059 23.5771L28.9482 17.1348C29.3386 16.7443 29.3386 16.1112 28.9482 15.7207L27.2197 13.9922C26.8293 13.6017 26.1962 13.6018 25.8057 13.9922L25.7266 14.0703L23.3701 11.7139C24.2377 10.8461 24.2376 9.4391 23.3701 8.57129C22.5023 7.7035 21.0954 7.70357 20.2275 8.57129L17.8701 6.21387L17.9482 6.13574C18.3388 5.74522 18.3388 5.11221 17.9482 4.72168L16.2197 2.99316Z" fill="url(#KickModeratorBadgeB-feed)"></path>
              <path d="M30 0C31.1046 0 32 0.895431 32 2V30C32 31.1046 31.1046 32 30 32H2C0.895431 32 0 31.1046 0 30V2C0 0.895431 0.895431 0 2 0H30ZM16.2197 2.99316C15.8292 2.60266 15.1962 2.60265 14.8057 2.99316L8.36328 9.43555C7.97294 9.82608 7.97284 10.4591 8.36328 10.8496L10.0918 12.5781C10.4823 12.9686 11.1153 12.9685 11.5059 12.5781L11.585 12.499L13.9414 14.8564L3.57129 25.2275C2.70357 26.0954 2.7035 27.5023 3.57129 28.3701C4.43911 29.2376 5.84612 29.2377 6.71387 28.3701L17.084 17.999L19.4414 20.3564L19.3633 20.4346C18.9728 20.8251 18.9728 21.4581 19.3633 21.8486L21.0918 23.5771C21.4823 23.9676 22.1154 23.9676 22.5059 23.5771L28.9482 17.1348C29.3386 16.7443 29.3386 16.1112 28.9482 15.7207L27.2197 13.9922C26.8293 13.6017 26.1962 13.6018 25.8057 13.9922L25.7266 14.0703L23.3701 11.7139C24.2377 10.8461 24.2376 9.4391 23.3701 8.57129C22.5023 7.7035 21.0954 7.70357 20.2275 8.57129L17.8701 6.21387L17.9482 6.13574C18.3388 5.74522 18.3388 5.11221 17.9482 4.72168L16.2197 2.99316Z" fill="url(#KickModeratorBadgeC-feed)"></path>
            </g>
          </svg>
        </span>
      );
    }
    if (badge === 'vip') {
      return (
        <span key={badge} className="kick-chatter-badge" title="VIP" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg className="kick-svg-element" fill="none" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={iconStyle}>
            <g clipPath="url(#KickVIPBadgeClipPath)">
              <path d="M30 0C31.1046 0 32 0.895431 32 2V30C32 31.1046 31.1046 32 30 32H2C0.895431 32 0 31.1046 0 30V2C0 0.895431 0.895431 4.10637e-08 2 0H30ZM15.9648 5C15.7748 5.00005 15.588 5.05204 15.4238 5.15039C15.2596 5.24878 15.124 5.39057 15.0303 5.56055L9.82812 15.0176L3.55078 11.8906C3.36913 11.7985 3.16534 11.7607 2.96387 11.7822C2.76241 11.8038 2.57048 11.8842 2.41113 12.0127C2.25235 12.1408 2.13185 12.3126 2.06348 12.5078C1.99511 12.7031 1.98143 12.9144 2.02441 13.1172L4.58301 25.127C4.63544 25.3782 4.77165 25.6034 4.96777 25.7627C5.16376 25.9217 5.40762 26.0056 5.65723 26H26.251C26.5009 26.0057 26.7453 25.9219 26.9414 25.7627C27.1376 25.6034 27.2737 25.3782 27.3262 25.127L29.9697 13.1172C30.0187 12.9103 30.0086 12.6932 29.9404 12.4922C29.8722 12.2912 29.7485 12.1151 29.585 11.9844C29.4215 11.8537 29.2249 11.7743 29.0186 11.7559C28.8122 11.7374 28.6049 11.7802 28.4219 11.8799L22.1025 15.0283L16.9004 5.56055C16.8066 5.39054 16.6701 5.24878 16.5059 5.15039C16.3416 5.05207 16.1549 5 15.9648 5Z" fill="url(#KickVIPBadgeA)"></path>
              <path d="M30 0C31.1046 0 32 0.895431 32 2V30C32 31.1046 31.1046 32 30 32H2C0.895431 32 0 31.1046 0 30V2C0 0.895431 0.895431 4.10637e-08 2 0H30ZM15.9648 5C15.7748 5.00005 15.588 5.05204 15.4238 5.15039C15.2596 5.24878 15.124 5.39057 15.0303 5.56055L9.82812 15.0176L3.55078 11.8906C3.36913 11.7985 3.16534 11.7607 2.96387 11.7822C2.76241 11.8038 2.57048 11.8842 2.41113 12.0127C2.25235 12.1408 2.13185 12.3126 2.06348 12.5078C1.99511 12.7031 1.98143 12.9144 2.02441 13.1172L4.58301 25.127C4.63544 25.3782 4.77165 25.6034 4.96777 25.7627C5.16376 25.9217 5.40762 26.0056 5.65723 26H26.251C26.5009 26.0057 26.7453 25.9219 26.9414 25.7627C27.1376 25.6034 27.2737 25.3782 27.3262 25.127L29.9697 13.1172C30.0187 12.9103 30.0086 12.6932 29.9404 12.4922C29.8722 12.2912 29.7485 12.1151 29.585 11.9844C29.4215 11.8537 29.2249 11.7743 29.0186 11.7559C28.8122 11.7374 28.6049 11.7802 28.4219 11.8799L22.1025 15.0283L16.9004 5.56055C16.8066 5.39054 16.6701 5.24878 16.5059 5.15039C16.3416 5.05207 16.1549 5 15.9648 5Z" fill="url(#KickVIPBadgeB)"></path>
            </g>
          </svg>
        </span>
      );
    }
    if (badge === 'verified') {
      return (
        <span key={badge} className="kick-chatter-badge" title="Verified" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg className="kick-svg-element" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={iconStyle}>
            <g clipPath="url(#KickVerifiedBadgeClipPath)">
              <path d="M30.8598 19.2368C30.1977 18.2069 29.5356 17.2138 28.8736 16.1839C28.7264 15.9632 28.7264 15.8161 28.8736 15.5954C29.5356 14.6023 30.1609 13.6092 30.823 12.6161C31.5954 11.4391 31.1908 10.2989 29.8667 9.82069C28.7632 9.41609 27.6598 8.97471 26.5563 8.57012C26.3356 8.49656 26.2253 8.34943 26.2253 8.09196C26.1885 6.87816 26.1149 5.66437 26.0414 4.48736C25.9678 3.2 24.9747 2.46437 23.7241 2.7954C22.5471 3.08966 21.3701 3.42069 20.2299 3.75173C19.9724 3.82529 19.8253 3.75173 19.6414 3.56782C18.9057 2.61149 18.1333 1.69195 17.3977 0.772414C16.5885 -0.257472 15.3379 -0.257472 14.492 0.772414C13.7563 1.69195 12.9839 2.61149 12.2851 3.53103C12.1012 3.7885 11.9172 3.82529 11.623 3.75173C10.4828 3.42069 9.34253 3.12644 8.53334 2.90575C6.95173 2.53793 5.99541 3.16322 5.92184 4.48736C5.84828 5.70115 5.77472 6.91495 5.73794 8.16552C5.73794 8.42299 5.62759 8.53333 5.4069 8.64368C4.26667 9.08506 3.12644 9.52644 1.98621 9.96782C0.809203 10.446 0.441387 11.5862 1.14023 12.6529C1.8023 13.6828 2.46437 14.6759 3.12644 15.7057C3.27356 15.9264 3.27356 16.0736 3.12644 16.331C2.42759 17.3609 1.76552 18.3908 1.10345 19.4575C0.478165 20.4506 0.882759 21.6276 1.98621 22.069C3.12644 22.5104 4.30345 22.9517 5.44368 23.3931C5.70115 23.4667 5.77471 23.6138 5.77471 23.8713C5.81149 25.0483 5.95862 26.1885 5.95862 27.3655C5.95862 28.5425 6.9885 29.6092 8.42298 29.1678C9.56321 28.8 10.7034 28.5425 11.8437 28.2115C12.0644 28.1379 12.2115 28.1747 12.3586 28.3954C13.131 29.3517 13.8667 30.2713 14.6391 31.2276C15.485 32.2575 16.6988 32.2575 17.508 31.2276C18.2805 30.2713 19.0161 29.3517 19.7885 28.3954C19.9356 28.2115 20.046 28.1379 20.3034 28.2115C21.4804 28.5425 22.6575 28.8368 23.8345 29.1678C25.0483 29.4988 26.0781 28.7632 26.1149 27.5126C26.1885 26.2989 26.2621 25.0851 26.2988 23.8345C26.2988 23.5402 26.446 23.4299 26.6667 23.3563C27.7701 22.9517 28.9103 22.5104 30.0138 22.069C31.1908 21.4805 31.5586 20.3034 30.8598 19.2368ZM22.069 13.2046L14.7127 20.5609C14.5287 20.7448 14.2713 20.892 14.0138 20.9287C13.9402 20.9287 13.8299 20.9655 13.7563 20.9655C13.4253 20.9655 13.0575 20.8184 12.8 20.5609L9.78392 17.5448C9.26898 17.0299 9.26898 16.1839 9.78392 15.669C10.2989 15.154 11.1448 15.154 11.6598 15.669L13.7196 17.7287L20.1196 11.3287C20.6345 10.8138 21.4805 10.8138 21.9954 11.3287C22.5839 11.8437 22.5839 12.6897 22.069 13.2046Z" fill="url(#KickVerifiedBadgeGradient)"></path>
            </g>
          </svg>
        </span>
      );
    }
    if (badge === 'subscriber') {
      const badgeImageUrl = msg.badgeImages && msg.badgeImages[badge];
      const months = parseInt(msg.monthsSubscribed) || 1;
      const titleText = `Subscriber (${months} ${months === 1 ? 'Month' : 'Months'})`;
      if (badgeImageUrl) {
        return (
          <img 
            key={badge} 
            className="msg-badge-icon" 
            src={badgeImageUrl} 
            alt={titleText} 
            title={titleText}
            style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 4, display: 'inline-block' }}
          />
        );
      }
      
      return (
        <span key={badge} className="kick-chatter-badge subscriber" title={titleText} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <DefaultSubscriberBadge size={16} />
        </span>
      );
    }
    if (badge === 'founder') {
      return (
        <span key={badge} className="kick-chatter-badge" title="Founder" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg className="kick-svg-element" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={iconStyle}>
            <g clipPath="url(#KickFounderNewClipPath)">
              <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="url(#KickFounderNewPaint0)"></path>
              <path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="url(#KickFounderNewPaint1)"></path>
              <path d="M16 29.0375C23.2004 29.0375 29.0375 23.2004 29.0375 16C29.0375 8.79958 23.2004 2.96249 16 2.96249C8.79959 2.96249 2.9625 8.79958 2.9625 16C2.9625 23.2004 8.79959 29.0375 16 29.0375Z" fill="#FEB635"></path>
              <path d="M16 29.0375C23.2004 29.0375 29.0375 23.2004 29.0375 16C29.0375 8.79958 23.2004 2.96249 16 2.96249C8.79959 2.96249 2.9625 8.79958 2.9625 16C2.9625 23.2004 8.79959 29.0375 16 29.0375Z" fill="url(#KickFounderNewPaint2)"></path>
              <path d="M29.0375 16C29.0375 23.1875 23.1875 29.0375 16 29.0375C13.6563 29.0375 11.4625 28.4187 9.5625 27.3312C11.3125 28.2062 13.2875 28.7 15.375 28.7C22.5625 28.7 28.4125 22.85 28.4125 15.6625C28.4125 10.8188 25.75 6.58125 21.8125 4.3375C26.0938 6.475 29.0375 10.8938 29.0375 16ZM16.8875 3.575C19.4563 3.575 21.85 4.325 23.8625 5.60625C21.675 3.95625 18.95 2.96875 16 2.96875C8.8125 2.96875 2.9625 8.8125 2.9625 16.0063C2.9625 20.6437 5.4 24.7313 9.0625 27.0312C5.9 24.65 3.85 20.8687 3.85 16.6125C3.85 9.425 9.7 3.575 16.8875 3.575Z" fill="black" fillOpacity="0.05"></path>
              <path d="M18.5966 9.45456V24H14.6477V13.0909H14.5625L11.3807 14.9943V11.6421L14.9602 9.45456H18.5966Z" fill="black" fillOpacity="0.8"></path>
              <path d="M18.5966 9.45456V24H14.6477V13.0909H14.5625L11.3807 14.9943V11.6421L14.9602 9.45456H18.5966Z" fill="url(#KickFounderNewPaint3)" fillOpacity="0.5"></path>
              <path d="M18.5966 9.45456V24H14.6477V13.0909H14.5625L11.3807 14.9943V11.6421L14.9602 9.45456H18.5966Z" stroke="black" strokeOpacity="0.1" strokeWidth="0.350269"></path>
            </g>
          </svg>
        </span>
      );
    }
    if (badge === 'og') {
      return (
        <span key={badge} className="kick-chatter-badge" title="OG" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg className="kick-svg-element" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={iconStyle}>
            <g clipPath="url(#KickOGNewClipPath)">
              <path d="M22.8226 17.2693V28.0037C22.8226 28.2177 22.8929 28.383 23.0336 28.4996C23.1742 28.5969 23.3969 28.6455 23.7017 28.6455H24.5104V32H21.838C19.9627 32 18.6265 31.6694 17.8294 31.0082C17.0559 30.347 16.6691 29.472 16.6691 28.383V16.8901C16.6691 15.8011 17.0559 14.926 17.8294 14.2648C18.6265 13.6036 19.9627 13.273 21.838 13.273H24.6511V16.6276H23.7017C23.3969 16.6276 23.1742 16.6859 23.0336 16.8026C22.8929 16.8998 22.8226 17.0554 22.8226 17.2693ZM32.0002 21.6447V24.8826H24.0885V21.6447H32.0002ZM25.8466 19.6904V17.2693C25.8466 17.0554 25.7763 16.8998 25.6357 16.8026C25.495 16.6859 25.2723 16.6276 24.9676 16.6276H24.0182V13.273H26.8312C28.7066 13.273 30.031 13.6036 30.8046 14.2648C31.6017 14.926 32.0002 15.8011 32.0002 16.8901V19.6904H25.8466ZM25.8466 28.0037V23.8908H32.0002V28.383C32.0002 29.472 31.6017 30.347 30.8046 31.0082C30.031 31.6694 28.7066 32 26.8312 32H24.1588V28.6455H24.9676C25.2723 28.6455 25.495 28.5969 25.6357 28.4996C25.7763 28.383 25.8466 28.2177 25.8466 28.0037Z" fill="white"></path>
              <path d="M22.8226 17.2693V28.0037C22.8226 28.2177 22.8929 28.383 23.0336 28.4996C23.1742 28.5969 23.3969 28.6455 23.7017 28.6455H24.5104V32H21.838C19.9627 32 18.6265 31.6694 17.8294 31.0082C17.0559 30.347 16.6691 29.472 16.6691 28.383V16.8901C16.6691 15.8011 17.0559 14.926 17.8294 14.2648C18.6265 13.6036 19.9627 13.273 21.838 13.273H24.6511V16.6276H23.7017C23.3969 16.6276 23.1742 16.6859 23.0336 16.8026C22.8929 16.8998 22.8226 17.0554 22.8226 17.2693ZM32.0002 21.6447V24.8826H24.0885V21.6447H32.0002ZM25.8466 19.6904V17.2693C25.8466 17.0554 25.7763 16.8998 25.6357 16.8026C25.495 16.6859 25.2723 16.6276 24.9676 16.6276H24.0182V13.273H26.8312C28.7066 13.273 30.031 13.6036 30.8046 14.2648C31.6017 14.926 32.0002 15.8011 32.0002 16.8901V19.6904H25.8466ZM25.8466 28.0037V23.8908H32.0002V28.383C32.0002 29.472 31.6017 30.347 30.8046 31.0082C30.031 31.6694 28.7066 32 26.8312 32H24.1588V28.6455H24.9676C25.2723 28.6455 25.495 28.5969 25.6357 28.4996C25.7763 28.383 25.8466 28.2177 25.8466 28.0037Z" fill="url(#KickOGNewPaint0)"></path>
              <path d="M22.8228 3.99625V14.7307C22.8228 14.9446 22.8931 15.1099 23.0338 15.2266C23.1744 15.3238 23.3971 15.3724 23.7019 15.3724H24.5106V18.727H21.8382C19.9629 18.727 18.6267 18.3964 17.8296 17.7352C17.056 17.074 16.6693 16.1989 16.6693 15.1099V3.61704C16.6693 2.52804 17.056 1.65295 17.8296 0.99177C18.6267 0.33059 19.9629 0 21.8382 0H24.6513V3.35452H23.7019C23.3971 3.35452 23.1744 3.41286 23.0338 3.52953C22.8931 3.62677 22.8228 3.78234 22.8228 3.99625ZM32.0004 8.37171V11.6095H24.0887V8.37171H32.0004ZM25.8468 6.41734V3.99625C25.8468 3.78234 25.7765 3.62677 25.6358 3.52953C25.4952 3.41286 25.2725 3.35452 24.9677 3.35452H24.0183V0H26.8314C28.7067 0 30.0312 0.33059 30.8048 0.99177C31.6018 1.65295 32.0004 2.52804 32.0004 3.61704V6.41734H25.8468ZM25.8468 14.7307V10.6178H32.0004V15.1099C32.0004 16.1989 31.6018 17.074 30.8048 17.7352C30.0312 18.3964 28.7067 18.727 26.8314 18.727H24.159V15.3724H24.9677C25.2725 15.3724 25.495 15.3238 25.6358 15.2266C25.7765 15.1099 25.8468 14.9446 25.8468 14.7307Z" fill="url(#KickOGNewPaint1)"></path>
              <path d="M9.38855 7.81748V4.28795C9.38855 4.07404 9.31822 3.91846 9.17757 3.82123C9.03691 3.70455 8.81421 3.64621 8.50947 3.64621H7.34909V0H10.3731C12.2485 0 13.573 0.33059 14.3465 0.99177C15.1436 1.65295 15.5421 2.52804 15.5421 3.61704V7.81748H9.38855ZM9.38855 14.439V7.43828H15.5421V15.1099C15.5421 16.1989 15.1436 17.074 14.3465 17.7352C13.573 18.3964 12.2485 18.727 10.3731 18.727H7.34909V15.0807H8.50947C8.81421 15.0807 9.03691 15.0321 9.17757 14.9349C9.31822 14.8182 9.38855 14.6529 9.38855 14.439ZM6.15354 4.28795V7.81748H0V3.61704C0 2.52804 0.386794 1.65295 1.16038 0.99177C1.95741 0.33059 3.29361 0 5.16897 0H8.193V3.64621H7.03262C6.72787 3.64621 6.50517 3.70455 6.36452 3.82123C6.22387 3.91846 6.15354 4.07404 6.15354 4.28795ZM6.15354 7.43828V14.439C6.15354 14.6529 6.22387 14.8182 6.36452 14.9349C6.50517 15.0321 6.72787 15.0807 7.03262 15.0807H8.193V18.727H5.16897C3.29361 18.727 1.95741 18.3964 1.16038 17.7352C0.386794 17.074 0 16.1989 0 15.1099V7.43828H6.15354Z" fill="white"></path>
              <path d="M9.38855 7.81748V4.28795C9.38855 4.07404 9.31822 3.91846 9.17757 3.82123C9.03691 3.70455 8.81421 3.64621 8.50947 3.64621H7.34909V0H10.3731C12.2485 0 13.573 0.33059 14.3465 0.99177C15.1436 1.65295 15.5421 2.52804 15.5421 3.61704V7.81748H9.38855ZM9.38855 14.439V7.43828H15.5421V15.1099C15.5421 16.1989 15.1436 17.074 14.3465 17.7352C13.573 18.3964 12.2485 18.727 10.3731 18.727H7.34909V15.0807H8.50947C8.81421 15.0807 9.03691 15.0321 9.17757 14.9349C9.31822 14.8182 9.38855 14.6529 9.38855 14.439ZM6.15354 4.28795V7.81748H0V3.61704C0 2.52804 0.386794 1.65295 1.16038 0.99177C1.95741 0.33059 3.29361 0 5.16897 0H8.193V3.64621H7.03262C6.72787 3.64621 6.50517 3.70455 6.36452 3.82123C6.22387 3.91846 6.15354 4.07404 6.15354 4.28795ZM6.15354 7.43828V14.439C6.15354 14.6529 6.22387 14.8182 6.36452 14.9349C6.50517 15.0321 6.72787 15.0807 7.03262 15.0807H8.193V18.727H5.16897C3.29361 18.727 1.95741 18.3964 1.16038 17.7352C0.386794 17.074 0 16.1989 0 15.1099V7.43828H6.15354Z" fill="url(#KickOGNewPaint1)"></path>
              <path d="M9.38839 21.0905V17.561C9.38839 17.3471 9.31807 17.1915 9.17741 17.0943C9.03676 16.9776 8.81406 16.9193 8.50932 16.9193H7.34893V13.273H10.373C12.2483 13.273 13.5728 13.6036 14.3464 14.2648C15.1434 14.926 15.5419 15.8011 15.5419 16.8901V21.0905H9.38839ZM9.38839 27.712V20.7113H15.5419V28.383C15.5419 29.472 15.1434 30.347 14.3464 31.0082C13.5728 31.6694 12.2483 32 10.373 32H7.34893V28.3538H8.50932C8.81406 28.3538 9.03676 28.3052 9.17741 28.2079C9.31807 28.0913 9.38839 27.926 9.38839 27.712ZM6.15339 17.561V21.0905H-0.000152588V16.8901C-0.000152588 15.8011 0.386641 14.926 1.16023 14.2648C1.95726 13.6036 3.29346 13.273 5.16882 13.273H8.19285V16.9193H7.03247C6.72772 16.9193 6.50502 16.9776 6.36437 17.0943C6.22371 17.1915 6.15339 17.3471 6.15339 17.561ZM6.15339 20.7113V27.712C6.15339 27.926 6.22371 28.0913 6.36437 28.2079C6.50502 28.3052 6.72772 28.3538 7.03247 28.3538H8.19285V32H5.16882C3.29346 32 1.95726 31.6694 1.16023 31.0082C0.386641 30.347 -0.000152588 29.472 -0.000152588 28.383V20.7113H6.15339Z" fill="#00FFF2"></path>
            </g>
          </svg>
        </span>
      );
    }
    if (badge === 'bot') {
      return (
        <span key={badge} className="kick-chatter-badge" title="Bot" style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg className="kick-svg-element" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={iconStyle}>
            <g clipPath="url(#KickBotBadgeClipPath)">
              <path d="M17.56 0H14.4533C13.717 0 13.12 0.597452 13.12 1.33445V4.4437C13.12 5.1807 13.717 5.77815 14.4533 5.77815H17.56C18.2964 5.77815 18.8933 5.1807 18.8933 4.4437V1.33445C18.8933 0.597452 18.2964 0 17.56 0Z" fill="url(#KickBotBadgeA)" />
              <path d="M17.3333 5.77815H14.6667V8.44704H17.3333V5.77815Z" fill="url(#KickBotBadgeB)" />
              <path d="M5.33333 14.8257C5.33333 14.8257 0 14.8257 0 20.1635C0 25.5013 5.33333 25.5013 5.33333 25.5013V14.8257Z" fill="url(#KickBotBadgeC)" />
              <path d="M26.6667 14.8257C26.6667 14.8257 32 14.8257 32 20.1635C32 25.5013 26.6667 25.5013 26.6667 25.5013V14.8257Z" fill="url(#KickBotBadgeD)" />
              <path d="M26.6667 10.8224H5.33333V28.1701H26.6667V10.8224Z" fill="#4FD8FF" />
              <path d="M15.76 11.2761C20.4133 11.2761 24.0933 12.3036 25.24 13.2911C26.3867 14.8657 26.1733 24.4737 24.9067 26.0751C24.2533 26.849 21.0667 28.01 16.28 28.01C11.24 28.01 7.73333 26.7556 6.94667 25.9283C5.70667 24.367 5.65333 14.7189 6.84 13.211C7.58667 12.4637 10.6667 11.2761 15.76 11.2761ZM15.76 7.27273C10.9067 7.27273 6.12 8.28691 4.01333 10.382C1.25333 13.1309 1.34667 25.7948 4.01333 28.6372C6.08 30.8524 11.2133 32 16.28 32C21.3467 32 26.08 30.9058 27.9867 28.6372C30.48 25.648 30.8667 12.9975 27.9867 10.382C25.7467 8.34028 20.72 7.27273 15.76 7.27273Z" fill="url(#KickBotBadgeE)" />
              <path d="M23 17.975C23 16.6852 21.9553 15.6397 20.6667 15.6397C19.378 15.6397 18.3333 16.6852 18.3333 17.975V21.3111C18.3333 22.6008 19.378 23.6464 20.6667 23.6464C21.9553 23.6464 23 22.6008 23 21.3111V17.975Z" fill="black" />
              <path d="M13.6667 17.975C13.6667 16.6852 12.622 15.6397 11.3333 15.6397C10.0447 15.6397 9 16.6852 9 17.975V21.3111C9 22.6008 10.0447 23.6464 11.3333 23.6464C12.622 23.6464 13.6667 22.6008 13.6667 21.3111V17.975Z" fill="black" />
            </g>
          </svg>
        </span>
      );
    }
    if (badge === 'sub_gifter') {
      const giftedCount = msg.giftedSubsCount || 1;
      if (giftedCount < 1) return null;
      const titleText = giftedCount > 1 ? `Gifted ${giftedCount} subs` : `Gifted ${giftedCount} sub`;
      return (
        <span key={badge} className="kick-chatter-badge" title={titleText} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <KickGiftedSubsBadge giftedCount={giftedCount} size={16} style={iconStyle} />
        </span>
      );
    }
    return null;
  };

  return (
    <div className="chat-feed-panel">
      {/* Shared SVG gradients for Kick badges */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        <defs>
          {/* Founder */}
          <linearGradient id="KickFounderNewPaint0" x1="15.7467" y1="-4.46667" x2="16.2533" y2="36.6933" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFC900" />
            <stop offset="0.99" stopColor="#FF9500" />
          </linearGradient>
          <linearGradient id="KickFounderNewPaint1" x1="16" y1="0" x2="16" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" stopOpacity="0.3" />
            <stop offset="1" stopColor="white" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="KickFounderNewPaint2" x1="15.7936" y1="-0.677142" x2="16.2064" y2="32.8618" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFC900" />
            <stop offset="0.99" stopColor="#FF9500" />
          </linearGradient>
          <linearGradient id="KickFounderNewPaint3" x1="18.5966" y1="16.7273" x2="11.3807" y2="16.7273" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" stopOpacity="0.1" />
            <stop offset="0.3" stopColor="white" stopOpacity="0.2" />
            <stop offset="0.65" stopColor="white" stopOpacity="0.05" />
            <stop offset="1" stopColor="white" stopOpacity="0.2" />
          </linearGradient>
          <clipPath id="KickFounderNewClipPath">
            <rect width="32" height="32" fill="white" />
          </clipPath>

          {/* OG */}
          <linearGradient id="KickOGNewPaint0" x1="23.9622" y1="0.695162" x2="24.4274" y2="31.9986" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00FFF2" />
            <stop offset="1" stopColor="#006399" />
          </linearGradient>
          <linearGradient id="KickOGNewPaint1" x1="7.77104" y1="0" x2="7.91062" y2="32.567" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00FFF2" />
            <stop offset="1" stopColor="#006399" />
          </linearGradient>
          <clipPath id="KickOGNewClipPath">
            <rect width="32" height="32" fill="white" />
          </clipPath>

          {/* Broadcaster */}
          <linearGradient id="paint0_linear_209_29909" x1="5.22969e-08" y1="-5.22969e-08" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF1CD2" />
            <stop offset="1" stopColor="#B20DFF" />
          </linearGradient>
          <linearGradient id="paint1_linear_209_29909" x1="-5.88081e-07" y1="-8.98822e-07" x2="4.72839" y2="35.6202" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF1CD2" />
            <stop offset="1" stopColor="#B20DFF" />
          </linearGradient>
          {/* Moderator */}
          <clipPath id="KickModeratorBadgeClipPath"><rect width="32" height="32" fill="white" /></clipPath>

          {/* Verified */}
          <linearGradient id="KickVerifiedBadgeGradient" x1="8.14138" y1="32.3591" x2="24.4968" y2="0.904884" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1EFF00" />
            <stop offset="0.99" stopColor="#00FF8C" />
          </linearGradient>
          <clipPath id="KickVerifiedBadgeClipPath"><rect width="32" height="32" fill="white" /></clipPath>

          {/* VIP */}
          <linearGradient id="KickVIPBadgeA" x1="18.8102" y1="-12.7222" x2="2.88536" y2="39.1063" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF6A4A" />
            <stop offset="1" stopColor="#C70C00" />
          </linearGradient>
          <linearGradient id="KickVIPBadgeB" x1="15.7467" y1="-4.75575" x2="16.321" y2="39.0672" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFC900" />
            <stop offset="0.99" stopColor="#FF9500" />
          </linearGradient>
          <clipPath id="KickVIPBadgeClipPath"><rect width="32" height="32" fill="white" /></clipPath>

          {/* Bot */}
          <linearGradient id="KickBotBadgeA" x1="15.963" y1="0.886836" x2="15.963" y2="43.3072" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00C7FF" />
            <stop offset="0.99" stopColor="#006399" />
          </linearGradient>
          <linearGradient id="KickBotBadgeB" x1="16" y1="-69.28" x2="16" y2="-69.28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00C7FF" />
            <stop offset="0.99" stopColor="#006399" />
          </linearGradient>
          <linearGradient id="KickBotBadgeC" x1="17.28" y1="-0.2" x2="16.8598" y2="31.7766" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00C7FF" />
            <stop offset="0.99" stopColor="#006399" />
          </linearGradient>
          <linearGradient id="KickBotBadgeD" x1="14.72" y1="-0.2" x2="15.1402" y2="31.7766" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00C7FF" />
            <stop offset="0.99" stopColor="#006399" />
          </linearGradient>
          <linearGradient id="KickBotBadgeE" x1="5.14015" y1="0.587156" x2="36.6592" y2="34.8544" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00C7FF" />
            <stop offset="0.99" stopColor="#006399" />
          </linearGradient>
          <clipPath id="KickBotBadgeClipPath">
            <rect width="32" height="32" fill="white" />
          </clipPath>
        </defs>
      </svg>

      <div 
        className={`feed-messages style-${settings.chatStyle || 'default'}`}
        ref={feedRef}
        onScroll={handleScroll}
        onWheel={handleUserInteraction}
        onTouchStart={handleUserInteraction}
        onMouseDown={handleUserInteraction}
        style={{ 
          position: 'relative',
          fontSize: `${settings.textSize || 15}px`,
          fontFamily: settings.fontFamily === 'inherit' ? 'inherit' : settings.fontFamily || 'inherit'
        }}
      >
        <div ref={innerRef} style={{ display: 'flex', flexDirection: 'column', gap: 'inherit', width: '100%' }}>
          {tabFilteredMessages.length === 0 ? (
            <div className="empty-feed-container">
              <div className="empty-feed-icon-box">
                <MessageSquare size={32} />
              </div>
              <h2 className="empty-feed-title">Let's chat away!</h2>
              <p className="empty-feed-description">
                Your focus workspace is primed for productivity. Connect a channel or start a thread when you're ready to break the quiet.
              </p>
              <div className="empty-feed-actions">
                <button 
                  className="empty-feed-btn primary"
                  onClick={onConnectChannel}
                >
                  Connect Channel
                </button>
                <button 
                  className="empty-feed-btn secondary"
                  onClick={onExploreEvents}
                >
                  Explore Events
                </button>
              </div>
            </div>
          ) : (
            (() => {
              const msgElements = tabFilteredMessages.map((msg, idx) => {
                const cleanUser = (msg.username || '').toLowerCase().replace(/^@+/, '').trim();
                const cleanDisplay = (msg.displayName || '').toLowerCase().replace(/^@+/, '').trim();
                const cleanChannel = (msg.channel || '').toLowerCase().replace(/^@+/, '').trim();
                const creatorUser = (user?.username || '').toLowerCase().replace(/^@+/, '').trim();
                const creatorAvatar = user?.avatarUrl || (typeof user?.avatar === 'string' && user?.avatar.startsWith('http') ? user.avatar : null);
                const isCreatorUser = Boolean(cleanUser && creatorUser && (cleanUser === creatorUser));

                let avatarUrl = null;
                if (msg.platform === 'kick') {
                  const cached = (cleanUser ? GLOBAL_AVATAR_CACHE.get(cleanUser) : null) || 
                                 (cleanDisplay ? GLOBAL_AVATAR_CACHE.get(cleanDisplay) : null) || 
                                 (isCreatorUser ? creatorAvatar : null) ||
                                 (cleanUser ? requestKickAvatar(cleanUser, msg.userId) : null);
                  const rawMsgAvatar = msg.avatarUrl || msg.avatar;
                  if (cached && typeof cached === 'string' && cached.length > 5 && !cached.includes('/kick-default-avatars/')) {
                    avatarUrl = proxifyAvatarUrl(cached);
                  } else if (rawMsgAvatar && typeof rawMsgAvatar === 'string' && rawMsgAvatar.startsWith('http') && !isDefaultAvatar(rawMsgAvatar) && !rawMsgAvatar.includes('default-avatar')) {
                    avatarUrl = proxifyAvatarUrl(rawMsgAvatar);
                  } else {
                    avatarUrl = getKickDefaultAvatarUrl(msg.username, msg.userId);
                  }
                } else {
                  const rawMsgAvatar = msg.avatarUrl || msg.avatar;
                  let resolvedAvatar = rawMsgAvatar;
                  if (isDefaultAvatar(resolvedAvatar)) {
                    resolvedAvatar = (cleanUser ? GLOBAL_AVATAR_CACHE.get(cleanUser) : null) || 
                                     (cleanDisplay ? GLOBAL_AVATAR_CACHE.get(cleanDisplay) : null) || 
                                     (isCreatorUser ? creatorAvatar : null);
                  }
                  const isDefault = isDefaultAvatar(resolvedAvatar);
                  avatarUrl = isDefault ? getDefaultAvatar(msg.platform, msg.username, msg.userId) : proxifyAvatarUrl(resolvedAvatar);
                }

            // Render Special Donation/Subscription Alerts
            if (msg.isSystemEvent) {
              if (msg.platform === 'youtube' && msg.eventType === 'donation') {
                const headerBg = msg.eventDetails?.headerBg || '#e62117';
                const bodyBg = msg.eventDetails?.bodyBg || '#f44336';
                const authorTextColor = msg.eventDetails?.authorTextColor || '#ffffff';
                const contentTextColor = msg.eventDetails?.contentTextColor || '#ffffff';
                
                return (
                  <div key={msg.id} className="superchat-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div className="superchat-header-container" style={{ backgroundColor: headerBg, padding: '12px', display: 'flex', alignItems: 'center' }}>
                      <div className="superchat-container">
                        <div className="superchat-left">
                          {showAvatarForPlatform('youtube') && (
                            <img 
                              className="msg-avatar superchat-avatar" 
                              src={avatarUrl} 
                              alt={msg.displayName} 
                              onError={(e) => {
                                e.target.src = getDefaultAvatar(msg.platform, msg.username, msg.userId);
                              }}
                            />
                          )}
                        </div>
                        <div className="superchat-right">
                          <div className="superchat-header-row" style={{ color: authorTextColor }}>
                            <div className="superchat-user-info">
                              {renderUsernameWithTooltip(msg, 'superchat-username', { color: authorTextColor })}
                              <span className="superchat-amount">{msg.eventDetails?.amount}</span>
                              <button 
                                className="superchat-speaker-btn"
                                style={{ 
                                  color: authorTextColor, 
                                  background: 'none', 
                                  border: 'none', 
                                  padding: '0 4px', 
                                  cursor: 'pointer', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  opacity: 0.8,
                                  transition: 'opacity 0.15s'
                                }}
                                title="Speak Superchat"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSpeakSuperchat(msg);
                                }}
                              >
                                <Volume2 size={15} style={{ verticalAlign: 'middle' }} />
                              </button>
                            </div>
                            <div className="superchat-actions" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                              {settings.showIcons && (
                                <span className="superchat-platform">
                                  <PlatformLogo platform={msg.platform} isShorts={msg.isShorts} size={14} />
                                </span>
                              )}
                              <button 
                                className="superchat-more-btn" 
                                style={{ color: authorTextColor }} 
                                title="More options"
                                onClick={(e) => handleToggleMenu(e, msg)}
                              >
                                <MoreVertical size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {(msg.text || msg.eventDetails?.stickerUrl) && (
                      <div className="superchat-body" style={{ backgroundColor: bodyBg, color: '#000000', padding: '12px 12px 12px 64px' }}>
                        {msg.eventDetails?.stickerUrl && (
                          <img 
                            className="superchat-sticker" 
                            src={msg.eventDetails.stickerUrl} 
                            alt="Super Sticker" 
                            style={{ width: '72px', height: '72px', objectFit: 'contain', marginTop: '4px' }}
                          />
                        )}
                        {msg.text && (
                          <div className="superchat-text" style={{ color: '#000000' }}>
                            {(msg.parts || parseMessageContent(msg.text)).map((part, index) => {
                              if (part.type === 'emote') {
                                return (
                                  <img 
                                    key={index} 
                                    className="chat-emote" 
                                    src={part.url} 
                                    alt={part.name} 
                                    style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', margin: '0 2px', objectFit: 'contain', display: 'inline-block' }}
                                  />
                                );
                              }
                              return <span key={index}>{part.content}</span>;
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              if (msg.platform === 'youtube' && msg.eventType === 'subscription') {
                const headerBg = msg.eventDetails?.headerBg || '#0f9d58';
                const bodyBg = msg.eventDetails?.bodyBg || '#0b8043';
                const authorTextColor = msg.eventDetails?.authorTextColor || '#ffffff';
                const hasUserMessage = msg.eventDetails?.hasUserMessage;
                
                return (
                  <div key={`${msg.id || 'msg'}-${idx}`} className="membership-card">
                    <div 
                      className="membership-header" 
                      style={{ 
                        backgroundColor: headerBg, 
                        color: authorTextColor,
                        borderRadius: hasUserMessage ? '8px 8px 0 0' : '8px'
                      }}
                    >
                      {showAvatarForPlatform('youtube') && (
                        <img 
                          className="msg-avatar" 
                          src={avatarUrl} 
                          alt={msg.displayName} 
                          style={{ width: '36px', height: '36px', borderRadius: '50%' }}
                        />
                      )}
                      <div className="membership-meta">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {renderUsernameWithTooltip(msg, '', { color: '#ffffff', fontWeight: 700 })}
                          {/* Render badges if any */}
                          {msg.badges && msg.badges.map(badge => {
                            const badgeImageUrl = msg.badgeImages && msg.badgeImages[badge];
                            if (badgeImageUrl) {
                              return (
                                <img 
                                  key={badge} 
                                  className="msg-badge-icon" 
                                  src={badgeImageUrl} 
                                  alt={badge} 
                                  title={badge} 
                                  style={{ width: '16px', height: '16px', display: 'inline-block', verticalAlign: 'middle', margin: 0 }}
                                />
                              );
                            }
                            return null;
                          })}
                        </div>
                        <span className="membership-tier" style={{ fontSize: '13px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.8)' }}>
                          {msg.eventDetails?.tier || 'Member'}
                        </span>
                      </div>
                      <div className="membership-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', marginLeft: 'auto' }} onClick={(e) => e.stopPropagation()}>
                        {settings.showIcons && (
                          <span className="membership-platform" style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <PlatformLogo platform={msg.platform} isShorts={msg.isShorts} size={15} />
                          </span>
                        )}
                        <Tooltip delayDuration={150}>
                          <TooltipTrigger asChild>
                            <button 
                              type="button" 
                              className="message-actions-menu-btn"
                              style={{ 
                                color: authorTextColor,
                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                width: '26px',
                                height: '26px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSpeakSuperchat({
                                  ...msg,
                                  text: `${msg.displayName} joined. ${msg.eventDetails?.tier || ''}`
                                });
                              }}
                            >
                              <Volume2 size={15} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="center">
                            Read Aloud
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip delayDuration={150}>
                          <TooltipTrigger asChild>
                            <button 
                              type="button" 
                              className="message-actions-menu-btn"
                              style={{ 
                                color: authorTextColor,
                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                width: '26px',
                                height: '26px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0
                              }}
                              onClick={(e) => handleToggleMenu(e, msg)}
                            >
                              <MoreVertical size={15} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="center">
                            Moderation & Insights
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    {hasUserMessage && (
                      <div className="membership-body" style={{ backgroundColor: bodyBg, borderRadius: '0 0 8px 8px' }}>
                        <div className="membership-text" style={{ paddingLeft: '48px' }}>
                          {msg.text || 'Welcome to the channel!'}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              const shouldAnimate = idx >= tabFilteredMessages.length - 5;
              return (
                <div 
                  key={`${msg.id || 'msg'}-${idx}`} 
                  className={`system-event-row ${msg.platform}-${msg.eventType}`}
                  style={{ animation: (isInitialLoading || !shouldAnimate) ? 'none' : undefined }}
                >
                  <div className="event-header">
                    {settings.showIcons && <span className="msg-platform-icon"><PlatformLogo platform={msg.platform} isShorts={msg.isShorts} size={14} /></span>}
                    {msg.platform !== 'kick' && showAvatarForPlatform(msg.platform) && (
                      <img className="msg-avatar smaller" src={avatarUrl} alt={msg.displayName} />
                    )}
                    {renderUsernameWithTooltip(msg, '', { color: getUsernameColor(msg) })}
                    <span className="event-text-label">{msg.text}</span>
                  </div>
                  {msg.eventDetails && msg.eventDetails.amount && (
                    <div className="event-details">{msg.eventDetails.amount}</div>
                  )}
                  {msg.eventDetails && msg.eventDetails.gift && (
                    <div className="event-details">Sent {msg.eventDetails.gift}</div>
                  )}
                </div>
              );
            }

            // Parse text with emotes and blocklist
            const filteredText = filterBlocklist(msg.text);
            const contentParts = msg.parts || parseMessageContent(filteredText);
            const cleanMsgUser = (msg.username || '').replace(/^@+/, '').trim().toLowerCase();
            const cleanMsgDisplay = (msg.displayName || '').replace(/^@+/, '').trim().toLowerCase();
            const msgChanId = msg.channelId || msg.userId || '';

            const checkTimedOut = (key) => {
              if (!key || !moderation?.timedOutUsers) return false;
              if (moderation.timedOutUsers instanceof Map) {
                const exp = moderation.timedOutUsers.get(key);
                return !!exp && exp > Date.now();
              }
              if (typeof moderation.timedOutUsers === 'object') {
                const exp = moderation.timedOutUsers[key];
                return !!exp && exp > Date.now();
              }
              return false;
            };

            const isDeleted = (moderation?.deletedMessageIds instanceof Set) 
              ? moderation.deletedMessageIds.has(msg.id) 
              : (Array.isArray(moderation?.deletedMessageIds) ? moderation.deletedMessageIds.includes(msg.id) : false);

            const isUserTimedOut = checkTimedOut(cleanMsgUser) || checkTimedOut(cleanMsgDisplay) || checkTimedOut(msgChanId);

            const isUserBanned = Boolean((cleanMsgUser || cleanMsgDisplay || msgChanId) && moderation?.bannedUsers && (
              moderation.bannedUsers instanceof Set 
                ? (moderation.bannedUsers.has(cleanMsgUser) || moderation.bannedUsers.has(cleanMsgDisplay) || moderation.bannedUsers.has(msgChanId))
                : (Array.isArray(moderation?.bannedUsers) ? (moderation.bannedUsers.includes(cleanMsgUser) || moderation.bannedUsers.includes(cleanMsgDisplay) || moderation.bannedUsers.includes(msgChanId)) : false)
            ));

            const isHiddenOrDeleted = isDeleted || isUserTimedOut || isUserBanned;
            const modHandle = (user?.user_metadata?.custom_handle || user?.user_metadata?.full_name || 'duplicatebunnysank9').replace(/^@+/, '');

            const isEven = idx % 2 === 0;
            const rowClass = `chat-message-row${settings.alternatingBackgrounds ? (isEven ? ' row-even' : ' row-odd') : ''} ${msg.repliedTo ? 'has-reply-thread' : ''}`;

            const shouldAnimate = idx >= tabFilteredMessages.length - 5;
            return (
              <div 
                key={`${msg.id || 'msg'}-${idx}`} 
                className={rowClass}
                style={{ animation: (isInitialLoading || !shouldAnimate) ? 'none' : undefined }}
              >
                {/* 1. Placeholder for grid (only rendered when there is a reply and metadata is visible) */}
                {msg.repliedTo && (settings.showTimestamps || settings.showIcons) && (
                  <div className="reply-empty-placeholder" />
                )}

                {/* 2. Reply Thread Header (only rendered when there is a reply) */}
                {msg.repliedTo && (
                  <div className="chat-reply-thread-header" onClick={() => onThreadClick && onThreadClick(msg)}>
                    <svg className="reply-thread-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '11px', height: '11px', marginRight: '4px', display: 'inline-block' }}>
                      <polyline points="9 17 4 12 9 7" />
                      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                    </svg>
                    <span className="reply-thread-text">
                      Replying to {renderUsernameWithTooltip(msg.repliedTo, 'reply-thread-user')}: <span className="reply-thread-body">{msg.repliedTo.text}</span>
                    </span>
                  </div>
                )}

                {/* 3. Left Metadata (Timestamp & Platform Icon) */}
                {(settings.showTimestamps || settings.showIcons) && (
                  <div className="chat-message-meta-left" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px', flexShrink: 0, height: '1.5em' }}>
                    {settings.showTimestamps && (
                      <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                          <span 
                            className="msg-timestamp"
                            onClick={toggleTimestampFormat}
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                          >
                            {renderTimestampText(msg)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="center">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <PlatformLogo platform={msg.platform} isShorts={msg.isShorts} size={12} />
                            <span>{renderTimestampText(msg)}</span>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {settings.showIcons && wrapWithTooltip(
                      <span className="msg-platform-icon">
                        <PlatformLogo platform={msg.platform} isShorts={msg.isShorts} size="0.9em" />
                      </span>,
                      msg.platform,
                      `platform-${msg.id}`
                    )}
                    {settings.showQuickModActions && (
                      <span className="quick-moderation-actions">
                        <button 
                          className="quick-moderation-button quick-timeout-message-button" 
                          type="button" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onTimeoutUser && onTimeoutUser(msg, 600);
                          }}
                          title="Timeout (10m)"
                        >
                          <svg className="quick-moderation-action-svg" xmlns="http://www.w3.org/2000/svg" viewBox="2 2 20 20" fill="none">
                            <path d="M12 7V12L14.5 13.5M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                          </svg>
                        </button>
                        <button 
                          className="quick-moderation-button quick-ban-message-button" 
                          type="button" 
                          onClick={(e) => {
                            e.stopPropagation();
                            const cleanUser = (msg.username || msg.displayName || msg.author || '').toLowerCase().replace(/^@+/, '').trim();
                            const isUserBanned = (moderation?.bannedUsers instanceof Set && moderation.bannedUsers.has(cleanUser)) ||
                                                 (blockedUsers instanceof Set && blockedUsers.has(cleanUser));
                            if (isUserBanned) {
                              onUnbanUser && onUnbanUser(msg);
                            } else {
                              onBanUser && onBanUser(msg);
                            }
                          }}
                          title={(() => {
                            const cleanUser = (msg.username || msg.displayName || msg.author || '').toLowerCase().replace(/^@+/, '').trim();
                            const isUserBanned = (moderation?.bannedUsers instanceof Set && moderation.bannedUsers.has(cleanUser)) ||
                                                 (blockedUsers instanceof Set && blockedUsers.has(cleanUser));
                            return isUserBanned ? "Unhide User" : "Hide User";
                          })()}
                        >
                          <svg className="quick-moderation-action-svg" xmlns="http://www.w3.org/2000/svg" viewBox="5 5 22 22" fill="currentColor">
                            <path d="M16 5C9.935 5 5 9.934 5 16c0 6.067 4.935 11 11 11s11-4.933 11-11c0-6.066-4.935-11-11-11zm0 2.75c1.777 0 3.427.569 4.775 1.53L9.279 20.778A8.214 8.214 0 0 1 7.75 16c0-4.549 3.701-8.25 8.25-8.25zm0 16.5a8.2 8.2 0 0 1-4.775-1.53l11.494-11.497A8.205 8.205 0 0 1 24.25 16c0 4.547-3.701 8.25-8.25 8.25z"></path>
                          </svg>
                        </button>
                        <button 
                          className="quick-moderation-button quick-delete-message-button" 
                          type="button" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteMessage && onDeleteMessage(msg);
                          }}
                          title="Delete Message"
                        >
                          <svg className="quick-moderation-action-svg" xmlns="http://www.w3.org/2000/svg" viewBox="2 2 20 20" fill="none">
                            <path d="M10 11V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                            <path d="M14 11V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                            <path d="M4 7H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                            <path d="M6 7H12H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                            <path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7H9V5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"></path>
                          </svg>
                        </button>
                      </span>
                    )}
                  </div>
                )}

                {/* 4. Main message row */}
                <div className="chat-message-main-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '4px', width: '100%', paddingRight: '68px', boxSizing: 'border-box' }}>
                  {showAvatarForPlatform(msg.platform) && (
                    <img 
                      className="msg-avatar" 
                      src={avatarUrl} 
                      alt={msg.displayName || msg.username} 
                      onError={(e) => {
                        const errCount = parseInt(e.target.dataset.errorCount || '0') + 1;
                        e.target.dataset.errorCount = errCount;
                        if (errCount === 1) {
                          const rawUrl = msg.avatarUrl || msg.avatar;
                          if (rawUrl && typeof rawUrl === 'string' && rawUrl.startsWith('http') && !rawUrl.includes('images.weserv.nl')) {
                            e.target.src = rawUrl;
                            return;
                          }
                        }
                        if (msg.platform === 'kick') {
                          const defaultKickUrl = getKickDefaultAvatarUrl(msg.username, msg.userId);
                          if (errCount === 2) {
                            e.target.src = proxifyAvatarUrl(defaultKickUrl);
                          } else {
                            e.target.src = defaultKickUrl;
                          }
                          return;
                        }
                        e.target.src = getDefaultAvatar(msg.platform, msg.username, msg.userId);
                      }}
                    />
                  )}

                  <div className="message-body-inline" style={{ flex: 1, minWidth: 0, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {msg.platform === 'youtube' ? (
                      <span className="youtube-chatter-badges-wrapper" style={{ display: 'inline', marginRight: '4px' }}>
                        {/* Wrap username in owner background container if YouTube broadcaster */}
                        {msg.badges && msg.badges.includes('broadcaster') ? (
                          <span className="chatter-container youtube-owner-chatter-background" style={{ marginRight: 0 }}>
                            {renderUsernameWithTooltip(msg, '', { color: '#0d0d0d', marginRight: 0, paddingRight: 0 })}
                          </span>
                        ) : msg.badges && msg.badges.includes('verified') && !msg.badges.includes('moderator') ? (
                          <span className="chatter-container youtube-verified-chatter-background" style={{ marginRight: 0 }}>
                            {renderUsernameWithTooltip(msg, '', { color: '#ffffff', marginRight: 0, paddingRight: 0 })}
                          </span>
                        ) : (
                          renderUsernameWithTooltip(msg, '', { color: getUsernameColor(msg), marginRight: 0, paddingRight: 0 })
                        )}

                        {/* For YouTube: badges after username with a clean 5px gap */}
                        {settings.showBadges && (
                          <span className="youtube-chatter-badges-list" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '5px', verticalAlign: 'middle' }}>
                            {msg.badges && msg.badges.map((badge, idx) => {
                              if (badge === 'broadcaster' || (typeof badge === 'string' && badge.startsWith('rank_'))) {
                                return null;
                              }
                              let badgeEl = null;
                              // Check if it's the verified badge
                              if (badge === 'verified') {
                                  badgeEl = (
                                    <span key={`${msg.id}-${badge}-${idx}`} className="youtube-chatter-verified-badge" title="Verified">
                                      <svg className="youtube-svg-element" viewBox="2 5 20 15" fill="#999999" style={{ width: '100%', height: '100%', display: 'block' }}>
                                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                                      </svg>
                                    </span>
                                  );
                              } else if (badge === 'moderator') {
                                  badgeEl = (
                                    <span key={`${msg.id}-${badge}-${idx}`} className="youtube-chatter-moderator-badge" title="Moderator">
                                      <svg className="youtube-svg-element" viewBox="3 1 18 22" fill="#5e84f1" style={{ width: '100%', height: '100%', display: 'block' }}>
                                        <path d="M3 4.998v9.857a6 6 0 003.365 5.39L12 23l5.635-2.755A6 6 0 0021 14.855V4.998a1 1 0 00-.656-.938L12 1 3.656 4.06A1 1 0 003 4.998Z" />
                                      </svg>
                                    </span>
                                  );
                              } else {
                                  const badgeImageUrl = (msg.badgeImages && msg.badgeImages[badge]) || 
                                                        (msg.platform === 'twitch' && msg.badgeVersions && getLiveTwitchBadgeUrl(msg.channel, badge, msg.badgeVersions[badge]));
                                  if (badgeImageUrl) {
                                    badgeEl = (
                                      <img 
                                        key={`${msg.id}-${badge}-${idx}`} 
                                        className="msg-badge-icon" 
                                        src={badgeImageUrl} 
                                        alt={badge === 'member' ? 'Member' : badge === 'subscriber' ? 'Member' : badge} 
                                        title={badge === 'member' ? 'Member' : badge === 'subscriber' ? 'Member' : badge}
                                        style={{ marginLeft: 0, marginRight: 0 }}
                                      />
                                    );
                                  } else if (badge === 'subscriber' || badge === 'member') {
                                    badgeEl = (
                                      <span key={`${msg.id}-${badge}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', marginRight: '4px' }} title={badge === 'member' ? 'Member' : 'Subscriber'}>
                                        <DefaultSubscriberBadge size="1.1em" />
                                      </span>
                                    );
                                  } else {
                                    const displayChar = badge === 'broadcaster' ? '👑' : null;
                                    if (displayChar) {
                                      badgeEl = (
                                        <span key={`${msg.id}-${badge}-${idx}`} className={`msg-badge ${badge} platform-${msg.platform}`} style={{ marginLeft: 0, marginRight: 0, verticalAlign: 'middle' }}>
                                          {displayChar}
                                        </span>
                                      );
                                    }
                                  }
                              }
                              return renderBadgeWithTooltip(badgeEl, badge, `${msg.id}-${badge}-${idx}`);
                            })}

                            {/* YouTube Top 1, #2, #3 Contributor Crown Pill Badge */}
                            {(() => {
                              const keys = [
                                msg.channelId,
                                msg.authorChannelId,
                                msg.authorExternalChannelId,
                                msg.userId,
                                msg.username,
                                msg.displayName
                              ].filter(Boolean).map(k => String(k).toLowerCase().trim());

                              let rank = (msg.youtubeRank && msg.youtubeRank >= 1 && msg.youtubeRank <= 3) ? msg.youtubeRank : null;
                              if (!rank && Array.isArray(msg.badges)) {
                                if (msg.badges.includes('rank_1')) rank = 1;
                                else if (msg.badges.includes('rank_2')) rank = 2;
                                else if (msg.badges.includes('rank_3')) rank = 3;
                              }
                              if (!rank) {
                                for (const k of keys) {
                                  const found = youtubeTop3Ranks.get(k);
                                  if (found && found >= 1 && found <= 3) {
                                    rank = found;
                                    break;
                                  }
                                }
                              }
                              if (!rank || rank < 1 || rank > 3) return null;

                              const rankBg = rank === 1 
                                ? '#4c1d95' 
                                : rank === 2 
                                ? '#4338ca' 
                                : '#3b0764';

                              return renderBadgeWithTooltip(
                                <span 
                                  key={`${msg.id}-yt-rank-${rank}`}
                                  className={`youtube-rank-badge youtube-rank-${rank}`}
                                  title={`Top Contributor #${rank}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3.5px',
                                    backgroundColor: rankBg,
                                    color: '#ffffff',
                                    padding: '1.5px 7.5px 1.5px 6.5px',
                                    borderRadius: '9999px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    lineHeight: '1',
                                    verticalAlign: 'middle',
                                    letterSpacing: '-0.2px',
                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
                                    userSelect: 'none'
                                  }}
                                >
                                  <svg 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2.5" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    style={{ width: '11px', height: '11px', display: 'block' }}
                                  >
                                    <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
                                  </svg>
                                  <span>#{rank}</span>
                                </span>,
                                `yt-rank-${rank}`,
                                `${msg.id}-yt-rank-${rank}`
                              );
                            })()}
                          </span>
                        )}
                      </span>
                    ) : (
                      <>
                        {/* For Twitch/Kick: badges before username */}
                        {msg.platform !== 'youtube' && settings.showBadges && msg.badges && (msg.platform === 'kick' ? sortKickBadges(msg.badges) : msg.badges).map((badge, idx) => {
                          let badgeEl = null;
                          if (msg.platform === 'kick') {
                            badgeEl = renderKickBadge(badge, msg);
                          } else {
                            const badgeImageUrl = (msg.badgeImages && msg.badgeImages[badge]) || 
                                                  (msg.platform === 'twitch' && msg.badgeVersions && getLiveTwitchBadgeUrl(msg.channel, badge, msg.badgeVersions[badge]));
                            if (badgeImageUrl) {
                              badgeEl = (
                                <img 
                                  key={`${msg.id}-${badge}-${idx}`} 
                                  className="msg-badge-icon" 
                                  src={badgeImageUrl} 
                                  alt={badge} 
                                  title={badge}
                                />
                              );
                            } else if (badge === 'subscriber' || badge === 'member') {
                              badgeEl = (
                                <span key={`${msg.id}-${badge}-${idx}`} style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', marginRight: '4px' }} title={badge === 'member' ? 'Member' : 'Subscriber'}>
                                  {msg.platform === 'twitch' ? (
                                    <TwitchDefaultSubscriberBadge size="1.1em" />
                                  ) : (
                                    <DefaultSubscriberBadge size="1.1em" />
                                  )}
                                </span>
                              );
                            } else {
                              const displayChar = 
                                badge === 'broadcaster' ? '👑' : 
                                badge === 'moderator' ? '🔧' :
                                badge === 'vip' ? '💎' : null;

                              if (displayChar) {
                                badgeEl = (
                                  <span key={`${msg.id}-${badge}-${idx}`} className={`msg-badge ${badge} platform-${msg.platform}`}>
                                    {displayChar}
                                  </span>
                                );
                              }
                            }
                          }
                          return renderBadgeWithTooltip(badgeEl, badge, `${msg.id}-${badge}-${idx}`);
                        })}

                        {renderUsernameWithTooltip(msg, '', { color: getUsernameColor(msg) })}
                      </>
                    )}
                    
                    {isHiddenOrDeleted ? (
                      revealedDeletedIds.has(msg.id) ? (
                        <>
                          <span className="msg-separator-space"> </span>
                          <span 
                            className="msg-text is-deleted-revealed" 
                            onClick={(e) => { e.stopPropagation(); toggleRevealDeleted(msg.id); }}
                            title="Click to hide and show deleted placeholder"
                            style={{ cursor: 'pointer', opacity: 0.85, textDecoration: 'line-through', color: '#ef4444' }}
                          >
                            {contentParts && contentParts.length > 0 ? contentParts.map((part, index) => {
                              if (part && part.type === 'emote' && part.url) {
                                return (
                                  <img 
                                    key={index}
                                    className="chat-emote" 
                                    src={part.url} 
                                    alt={part.name || 'emote'} 
                                  />
                                );
                              }
                              const rawC = typeof part === 'string' ? part : (typeof part?.content === 'string' ? part.content : (typeof part?.text === 'string' ? part.text : ''));
                              return <span key={index}>{rawC}</span>;
                            }) : String(msg.text || '')}
                          </span>
                        </>
                      ) : (
                        <span className="msg-deleted-text-container" style={{ marginLeft: '6px', fontSize: '13px', color: '#a1a1aa' }}>
                          <span>Message deleted by @{modHandle}. </span>
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); toggleRevealDeleted(msg.id); }}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              color: '#3b82f6', 
                              textDecoration: 'underline', 
                              cursor: 'pointer', 
                              fontSize: '12px',
                              padding: 0,
                              fontWeight: 600
                            }}
                          >
                            View deleted message
                          </button>
                        </span>
                      )
                    ) : (
                      <>
                        <span className="msg-separator-space"> </span>
                        <span className="msg-text">
                          {contentParts && contentParts.length > 0 ? (
                            contentParts.map((part, index) => {
                              if (!part) return null;
                              if (part.type === 'emote' && part.url) {
                                return (
                                  <Tooltip key={index} delayDuration={150}>
                                    <TooltipTrigger asChild>
                                      <img 
                                        className="chat-emote" 
                                        src={part.url} 
                                        alt={part.name || 'emote'} 
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" align="center">
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                        <img 
                                          src={part.url} 
                                          alt={part.name || 'emote'} 
                                          style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                                        />
                                        <span style={{ fontWeight: 600 }}>:{part.name || 'emote'}:</span>
                                        <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.6 }}>{msg.platform}</span>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              }
                              const rawContent = typeof part === 'string'
                                ? part
                                : (typeof part?.content === 'string'
                                    ? part.content
                                    : (typeof part?.text === 'string' ? part.text : ''));

                              if (rawContent) {
                                const words = rawContent.split(/(\s+)/);
                                return (
                                  <span key={index}>
                                    {words.map((word, wIdx) => {
                                      if (word && word.startsWith('@') && word.length > 1) {
                                        const match = word.match(/^(@[^\s.,!?:;]+)(.*)$/);
                                        if (match) {
                                          const handle = match[1];
                                          const punct = match[2];
                                          const isOwnerTag = checkIsMentioned(handle, user, activeChannels);
                                          if (isOwnerTag) {
                                            return (
                                              <React.Fragment key={wIdx}>
                                                <span className="chat-mention-tag owner-mention">
                                                  {handle}
                                                </span>
                                                {punct}
                                              </React.Fragment>
                                            );
                                          }
                                        }
                                      }
                                      return word;
                                    })}
                                  </span>
                                );
                              }
                              return null;
                            })
                          ) : (
                            <span>{String(msg.text || '')}</span>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div 
                  className="msg-actions-wrapper"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="msg-hover-actions">
                    {/* Speaker (TTS) Button */}
                    <Tooltip delayDuration={150}>
                      <TooltipTrigger asChild>
                        <button 
                          className="msg-hover-action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeakMessage(msg);
                          }}
                        >
                          <Volume2 size={15} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="center">
                        Read Aloud
                      </TooltipContent>
                    </Tooltip>

                    {/* Ellipsis Menu Button */}
                    <Tooltip delayDuration={150}>
                      <TooltipTrigger asChild>
                        <button 
                          className="msg-hover-action-btn" 
                          onClick={(e) => handleToggleMenu(e, msg)} 
                        >
                          &#8942;
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="center">
                        Moderation & Insights
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            );
          });

          return msgElements.map((element, idx) => {
            if (!element) return null;
            const msg = tabFilteredMessages[idx];
            const showSeparator = firstNewMessageId && String(msg.id) === String(firstNewMessageId);
            return (
              <React.Fragment key={msg?.id ? `${msg.id}-${idx}` : `msg-${idx}`}>
                {showSeparator && (
                  <div className="new-messages-separator">
                    <span className="new-messages-separator-text">New Messages</span>
                  </div>
                )}
                {element}
              </React.Fragment>
            );
          });
        })()
      )}
        </div>
      </div>

      {!isLocked && unreadCount > 0 && (
        <div
          className="scroll-lock-banner"
          onClick={() => {
            scrollToBottom();
            if (onResetDisplay) onResetDisplay(); // shrink back to 200 when returning to live feed
          }}
        >
          <ArrowDown size={14} /> More messages below ({unreadCount})
        </div>
      )}

      {/* Portaled 3-Dots Context Menu (Escapes parent overflow hidden/scroll clipping) */}
      {activeMenuId && menuPos && menuPos.msg && typeof window !== 'undefined' && createPortal(
        <div 
          className="message-context-menu" 
          style={menuPos.style}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. Chatter Info */}
          <button 
            type="button"
            className="message-context-menu-item"
            onClick={() => {
              onChatterClick(menuPos.msg);
              setActiveMenuId(null);
              setMenuPos(null);
            }}
          >
            <User size={13} style={{ marginRight: '8px', opacity: 0.8 }} />
            Chatter Info
          </button>

          {/* 2. Go to Channel */}
          <button 
            type="button"
            className="message-context-menu-item"
            onClick={() => {
              const msg = menuPos.msg;
              const channelId = msg.userId || msg.authorChannelId || msg.channelId;
              const targetUrl = msg.platform === 'youtube'
                ? (channelId && channelId.startsWith('UC') ? `https://www.youtube.com/channel/${channelId}` : `https://www.youtube.com/@${(msg.username || '').replace(/^@+/, '')}`)
                : msg.platform === 'twitch'
                  ? `https://twitch.tv/${msg.username}`
                  : `https://kick.com/${msg.username}`;
              window.open(targetUrl, '_blank');
              setActiveMenuId(null);
              setMenuPos(null);
            }}
          >
            <ExternalLink size={13} style={{ marginRight: '8px', opacity: 0.8 }} />
            Go to channel
          </button>

          {/* 3. Put User in Timeout */}
          <button 
            type="button"
            className="message-context-menu-item warning"
            onClick={() => {
              setTimeoutTargetMsg(menuPos.msg);
              setActiveMenuId(null);
            }}
          >
            <Clock size={13} style={{ marginRight: '8px', opacity: 0.8 }} />
            Put user in timeout
          </button>

          {/* 4. Hide / Unhide User on Channel (Ban / Unban) */}
          {menuPos.msg && (() => {
            const cleanUser = (menuPos.msg.username || menuPos.msg.displayName || menuPos.msg.author || '').toLowerCase().replace(/^@+/, '').trim();
            const isUserBanned = (moderation?.bannedUsers instanceof Set && moderation.bannedUsers.has(cleanUser)) ||
                                 (blockedUsers instanceof Set && blockedUsers.has(cleanUser));

            if (isUserBanned) {
              return (
                <button 
                  type="button"
                  className="message-context-menu-item"
                  onClick={() => {
                    onUnbanUser && onUnbanUser(menuPos.msg);
                    setActiveMenuId(null);
                    setMenuPos(null);
                  }}
                >
                  <ShieldCheck size={13} style={{ marginRight: '8px', opacity: 0.8, color: '#10b981' }} />
                  <span>Unhide user on this channel</span>
                </button>
              );
            }

            return (
              <button 
                type="button"
                className="message-context-menu-item destructive"
                onClick={() => {
                  onBanUser && onBanUser(menuPos.msg);
                  setActiveMenuId(null);
                  setMenuPos(null);
                }}
              >
                <ShieldAlert size={13} style={{ marginRight: '8px', opacity: 0.8 }} />
                <span>Hide user on this channel</span>
              </button>
            );
          })()}

          {/* 5. Add / Remove Moderator (YouTube only) */}
          {menuPos.msg && (!menuPos.msg.platform || String(menuPos.msg.platform).toLowerCase().includes('youtube')) && (
            <button 
              type="button"
              className="message-context-menu-item"
              onClick={() => {
                onToggleModerator && onToggleModerator(menuPos.msg);
                setActiveMenuId(null);
                setMenuPos(null);
              }}
            >
              {menuPos.msg.badges && Array.isArray(menuPos.msg.badges) && menuPos.msg.badges.includes('moderator') ? (
                <>
                  <ShieldOff size={13} style={{ marginRight: '8px', opacity: 0.8, color: '#ef4444' }} />
                  <span>Remove as moderator</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={13} style={{ marginRight: '8px', opacity: 0.8, color: '#10b981' }} />
                  <span>Add as moderator</span>
                </>
              )}
            </button>
          )}

          {/* 6. Remove Message (Delete) */}
          <div className="message-context-menu-divider" />
          <button 
            type="button"
            className="message-context-menu-item destructive"
            onClick={() => {
              onDeleteMessage && onDeleteMessage(menuPos.msg);
              setActiveMenuId(null);
              setMenuPos(null);
            }}
          >
            <Trash2 size={13} style={{ marginRight: '8px', opacity: 0.8 }} />
            Remove message
          </button>
        </div>,
        document.body
      )}

      {/* Portaled Standalone Timeout Duration Selector Popup */}
      {timeoutTargetMsg && typeof window !== 'undefined' && createPortal(
        <div 
          className="timeout-popup-container"
          onClick={(e) => e.stopPropagation()}
          style={{
            ...(menuPos?.style || { position: 'fixed', right: '20px', top: '100px' }),
            width: '240px',
            padding: '16px',
            backgroundColor: '#18181b',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.85)',
            zIndex: 99999
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', marginBottom: '12px' }}>
            Timeout duration
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {[
              { label: '10 seconds', seconds: 10 },
              { label: '60 seconds', seconds: 60 },
              { label: '5 minutes', seconds: 300 },
              { label: '10 minutes', seconds: 600 },
              { label: '30 minutes', seconds: 1800 },
              { label: '24 hours', seconds: 86400 }
            ].map((opt) => {
              const isSelected = selectedTimeoutDuration === opt.seconds;
              return (
                <div 
                  key={opt.seconds}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    cursor: 'pointer', 
                    fontSize: '13px', 
                    color: '#ffffff',
                    userSelect: 'none'
                  }}
                  onClick={() => setSelectedTimeoutDuration(opt.seconds)}
                >
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: isSelected ? '5px solid #3b82f6' : '2px solid #9ca3af',
                    boxSizing: 'border-box',
                    transition: 'all 0.15s ease',
                    flexShrink: 0
                  }} />
                  <span>{opt.label}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setTimeoutTargetMsg(null);
                setMenuPos(null);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                backgroundColor: '#374151',
                color: '#ffffff',
                fontWeight: '600',
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onTimeoutUser && onTimeoutUser(timeoutTargetMsg, selectedTimeoutDuration);
                setTimeoutTargetMsg(null);
                setMenuPos(null);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                fontWeight: '600',
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Confirm
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
