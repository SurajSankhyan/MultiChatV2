import React, { useEffect, useState, useRef } from 'react';
import PlatformLogo, { DefaultSubscriberBadge, KickGiftedSubsBadge, TwitchDefaultSubscriberBadge } from './PlatformLogo';
import { getLiveTwitchBadgeUrl } from '../utils/twitchChat';

// Color mapping matching youtube.js exactly
export const colorForManualAmount = (amount) => {
  if (amount === null || typeof amount === 'undefined') return null;
  const a = Number(amount);
  if (isNaN(a) || a <= 10) return null;
  if (a >= 11 && a <= 40) return { bg: '#00e5ff', text: '#111111', tier: 'cyan' };
  if (a >= 41 && a <= 100) return { bg: '#1de9b6', text: '#111111', tier: 'teal' };
  if (a >= 101 && a <= 500) return { bg: '#ffca28', text: '#111111', tier: 'yellow' };
  if (a >= 501 && a <= 999) return { bg: '#f57c00', text: '#ffffff', tier: 'orange' };
  if (a >= 1000 && a <= 2000) return { bg: '#e91e63', text: '#ffffff', tier: 'pink' };
  if (a > 2000) return { bg: '#e62117', text: '#ffffff', tier: 'red' };
  return null;
};

// Duration mapping (seconds) matching youtube.js line 160-173 exactly
export const getDurationForAmount = (amount) => {
  if (amount === null || typeof amount === 'undefined' || isNaN(amount)) return null;
  const a = Number(amount);
  if (a <= 10) return 5 * 60;
  if (a >= 11 && a <= 40) return 7 * 60;
  if (a >= 41 && a <= 100) return 10 * 60;
  if (a >= 101 && a <= 500) return 15 * 60;
  if (a >= 501 && a <= 999) return 20 * 60;
  if (a >= 1000 && a <= 2000) return 25 * 60;
  if (a > 2000) return 30 * 60;
  return null;
};

export const parseAmountString = (s) => {
  if (!s && s !== 0) return null;
  if (typeof s !== 'string') s = String(s);
  s = s.replace(/\u00A0/g, ' ');
  s = s.replace(/\s+/g, ' ');
  const cleaned = s.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  if (cleaned === '') return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
};

export const detectCurrencySymbol = (text) => {
  if (!text) return '₹';
  const t = String(text).replace(/\u00A0/g, ' ').trim();
  const m = t.match(/([^\d.,\s]{1,3})\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (m && m[1]) return m[1].trim();
  const m2 = t.match(/([0-9]+(?:[.,][0-9]+)?)\s*([A-Za-z]{2,4})/);
  if (m2 && m2[2]) return m2[2].toUpperCase();
  if (t.includes('₹')) return '₹';
  if (t.includes('$')) return '$';
  if (t.includes('€')) return '€';
  if (t.includes('£')) return '£';
  if (t.includes('¥')) return '¥';
  return '₹';
};

const KICK_BADGE_ORDER = ['broadcaster', 'moderator', 'vip', 'og', 'verified', 'staff', 'sub_gifter', 'founder', 'subscriber', 'bot'];
const sortKickBadges = (badges) => {
  if (!badges || !Array.isArray(badges)) return [];
  return [...badges].sort((a, b) => {
    const aIsLevel = typeof a === 'string' && a.startsWith('level_');
    const bIsLevel = typeof b === 'string' && b.startsWith('level_');
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

const getKickLevelColor = (level) => {
  if (level < 10) return '#9e9e9e';
  if (level < 20) return '#FFEB3B';
  if (level < 30) return '#ff4b9f';
  if (level < 40) return '#00e5ff';
  if (level < 50) return '#ffaa00';
  if (level < 60) return '#ff4a4a';
  if (level < 70) return '#00e676';
  if (level < 80) return '#b533ff';
  return '#ff3366';
};

export const getHighResAvatarUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  const cleanUrl = url.trim();

  // Match any Google / YouTube / GGPHT / Googleusercontent avatar URL
  if (
    cleanUrl.includes('googleusercontent.com') || 
    cleanUrl.includes('ggpht.com') || 
    cleanUrl.includes('youtube.com') ||
    cleanUrl.includes('ytimg.com')
  ) {
    // If URL contains =sXX (e.g. =s32, =s48, =s64, =s88, =s128, =s176, =s800)
    if (/=s\d+/.test(cleanUrl)) {
      return cleanUrl.replace(/=s\d+/, '=s1280');
    }
    // If URL contains /sXX-c/ or /sXX/
    if (/\/s\d+(-c)?\//.test(cleanUrl)) {
      return cleanUrl.replace(/\/s\d+(-c)?\//, '/s1280-c/');
    }
    // If URL contains =wXX-hXX
    if (/=w\d+(-h\d+)?/.test(cleanUrl)) {
      return cleanUrl.replace(/=w\d+(-h\d+)?/, '=w1280-h1280');
    }
    // If URL has no parameter
    if (!cleanUrl.includes('=')) {
      return `${cleanUrl}=s1280`;
    }
  }
  
  // Kick avatar URLs
  if (cleanUrl.includes('kick.com') || cleanUrl.includes('kick-files')) {
    return cleanUrl.replace(/_(50x50|100x100|300x300)\./, '.').replace(/\/thumb\//, '/full/');
  }

  // Twitch avatar URLs
  if (cleanUrl.includes('jtvnw.net') || cleanUrl.includes('twitch.tv')) {
    return cleanUrl.replace(/-(50x50|70x70|150x150)\./, '-600x600.');
  }

  return cleanUrl;
};

export default function HighlightOverlay({ previewData = null }) {
  const [activeHighlight, setActiveHighlight] = useState(previewData);
  const [animatingState, setAnimatingState] = useState('hidden'); // 'entering' | 'active' | 'exiting' | 'hidden'
  const autoHideTimerRef = useRef(null);

  // Read config from URL parameters and localStorage
  const [config, setConfig] = useState(() => {
    let local = {};
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('prochat_settings');
        if (stored) local = JSON.parse(stored);
      } catch (e) {}
    }

    const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    return {
      scale: parseFloat(query.get('scale') || local.highlightScale || '1'),
      bottom: query.get('bottom') || local.highlightCommentBottom || '60px',
      left: query.get('left') || local.highlightCommentLeft || '80px',
      autoHideSeconds: query.has('autoHideSeconds') ? parseInt(query.get('autoHideSeconds'), 10) : (local.overlayFadeTime !== undefined ? local.overlayFadeTime : 8),
      transparentBg: query.get('transparent') !== 'false',
      fontFamily: query.get('fontFamily') || local.fontFamily || 'inherit',
      showOnlyFirstName: query.get('firstNameOnly') === 'true' || !!local.highlightFirstNameOnly,
      showPlatformLogo: query.get('showSocialLogo') === 'true' || query.get('showPlatformLogo') === 'true' || !!local.highlightShowPlatformLogo,
      commentBgColor: query.get('commentBg') || local.highlightCommentBgColor || '#222222',
      commentTextColor: query.get('commentColor') || local.highlightCommentTextColor || '#ffffff',
      authorBgColor: query.get('authorBg') || local.highlightAuthorBgColor || '#ffa500',
      authorTextColor: query.get('authorColor') || local.highlightAuthorTextColor || '#222222',
      authorAvatarBorderColor: query.get('avatarBorder') || local.highlightAuthorAvatarBorderColor || '#ffa500'
    };
  });

  const showHighlight = (data) => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }

    setActiveHighlight(data);
    setAnimatingState('entering');

    setTimeout(() => {
      setAnimatingState('active');
    }, 300);

    // Duration logic matching youtube.js line 480-492:
    // appliedAmount -> config.autoHideSeconds -> fallback 4s
    let durationSeconds = null;
    if (data.amountValue !== null && data.amountValue !== undefined) {
      const mapped = getDurationForAmount(data.amountValue);
      if (mapped) durationSeconds = mapped;
    }
    if ((!durationSeconds || durationSeconds <= 0) && data.autoHideSeconds && data.autoHideSeconds > 0) {
      durationSeconds = Number(data.autoHideSeconds);
    }
    if ((!durationSeconds || durationSeconds <= 0) && config.autoHideSeconds && config.autoHideSeconds > 0) {
      durationSeconds = Number(config.autoHideSeconds);
    }
    if (!durationSeconds || durationSeconds <= 0) {
      durationSeconds = 4;
    }

    autoHideTimerRef.current = setTimeout(() => {
      hideHighlight();
    }, durationSeconds * 1000);
  };

  const hideHighlight = () => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    setAnimatingState('exiting');
    setTimeout(() => {
      setAnimatingState('hidden');
      setActiveHighlight(null);
    }, 280);
  };

  useEffect(() => {
    if (previewData) {
      showHighlight(previewData);
    }
  }, [previewData]);

  // Set up BroadcastChannel, Storage Listener, and Supabase Realtime for instant OBS & online sync
  useEffect(() => {
    let isSubscribed = true;
    let bc = null;
    let supabaseChannel = null;

    try {
      bc = new BroadcastChannel('multichat_highlight_overlay');
      bc.onmessage = (event) => {
        const { command, data } = event.data || {};
        if (command === 'show' && data) {
          showHighlight(data);
        } else if (command === 'hide') {
          hideHighlight();
        }
      };
    } catch (e) {
      console.warn("BroadcastChannel not supported", e);
    }

    // Connect to Supabase Realtime WebSocket for cross-device & OBS Studio syncing
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        import('@/utils/supabase/client').then(({ createClient }) => {
          if (!isSubscribed) return;
          const supabase = createClient();
          supabaseChannel = supabase.channel('multichat_highlight_overlay', {
            config: { broadcast: { self: true } }
          });
          supabaseChannel
            .on('broadcast', { event: 'highlight' }, (payload) => {
              if (!isSubscribed) return;
              const msg = payload?.payload || payload || {};
              if (msg.command === 'show' && msg.data) {
                showHighlight(msg.data);
              } else if (msg.command === 'hide') {
                hideHighlight();
              }
            })
            .subscribe();
        }).catch(() => {});
      }
    } catch (e) {}

    const handleStorage = (e) => {
      if (e.key === 'multichat_active_highlight_event') {
        try {
          const payload = JSON.parse(e.newValue);
          if (payload) {
            if (payload.command === 'show' && payload.data) {
              showHighlight(payload.data);
            } else if (payload.command === 'hide') {
              hideHighlight();
            }
          }
        } catch (err) {}
      } else if (e.key === 'prochat_settings') {
        try {
          const local = JSON.parse(e.newValue);
          if (local) {
            setConfig(prev => ({
              ...prev,
              showPlatformLogo: local.highlightShowPlatformLogo !== undefined ? local.highlightShowPlatformLogo : prev.showPlatformLogo,
              showOnlyFirstName: local.highlightFirstNameOnly !== undefined ? local.highlightFirstNameOnly : prev.showOnlyFirstName,
              commentBgColor: local.highlightCommentBgColor || prev.commentBgColor,
              commentTextColor: local.highlightCommentTextColor || prev.commentTextColor,
              authorBgColor: local.highlightAuthorBgColor || prev.authorBgColor,
              authorTextColor: local.highlightAuthorTextColor || prev.authorTextColor,
              authorAvatarBorderColor: local.highlightAuthorAvatarBorderColor || prev.authorAvatarBorderColor
            }));
          }
        } catch (err) {}
      }
    };

    window.addEventListener('storage', handleStorage);

    // Check if there was a recent highlight dispatched in the last 4 seconds
    try {
      const stored = localStorage.getItem('multichat_active_highlight_event');
      if (stored) {
        const payload = JSON.parse(stored);
        if (payload && payload.command === 'show' && payload.data && payload.timestamp && (Date.now() - payload.timestamp < 4000)) {
          showHighlight(payload.data);
        }
      }
    } catch (e) {}

    // ESC key closes highlight locally
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        hideHighlight();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isSubscribed = false;
      if (bc) bc.close();
      if (supabaseChannel) supabaseChannel.unsubscribe();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('keydown', handleKeyDown);
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [config.autoHideSeconds]);

  if (animatingState === 'hidden' || !activeHighlight) {
    return (
      <div 
        className="highlight-overlay-container empty"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: config.transparentBg ? 'transparent' : '#000000',
          pointerEvents: 'none',
          overflow: 'hidden'
        }}
      />
    );
  }

  const {
    displayName = 'Streamer',
    username = 'streamer',
    avatarUrl,
    text,
    parts = [],
    platform = 'youtube',
    isShorts = false,
    donationAmount,
    amountValue,
    isSuperChat = false,
    isMembership = false,
    membershipTier,
    membershipDuration,
    isGift = false,
    giftDetails,
    backgroundColor: customBg,
    textColor: customText,
    authorBgColor: customAuthorBg,
    authorTextColor: customAuthorText,
    badges = [],
    badgeImages = {},
    badgeVersions = {},
    isOwner = false,
    isBroadcaster = false,
    isModerator = false,
    isMember = false,
    isVerified = false,
    youtubeRank = null,
    giftedSubsCount = null,
    channel = null,
    showPlatformLogo: highlightSpecificPlatformLogo
  } = activeHighlight;

  // 1. Resolve Effective Donation Amount
  const effectiveAmount = (amountValue !== null && amountValue !== undefined && !isNaN(amountValue)) 
    ? Number(amountValue) 
    : parseAmountString(donationAmount);

  // 2. Determine colors based on amount tiers or YouTube superchat (matching extension youtube.js)
  let dynamicBg = customBg || null;
  let dynamicText = customText || null;
  let tierName = '';

  if (effectiveAmount !== null && effectiveAmount !== undefined && !isNaN(effectiveAmount)) {
    const tierColor = colorForManualAmount(effectiveAmount);
    if (tierColor) {
      dynamicBg = tierColor.bg;
      dynamicText = tierColor.text;
      tierName = tierColor.tier;
    }
  }

  // Fallback to configured colors if not a colored superchat/tier
  const finalCommentBg = dynamicBg || config.commentBgColor || '#222222';
  const finalCommentText = dynamicText || config.commentTextColor || '#ffffff';
  const finalAuthorBg = customAuthorBg || config.authorBgColor || '#ffa500';
  const finalAuthorText = customAuthorText || config.authorTextColor || '#222222';
  const finalAvatarBorder = customAuthorBg || config.authorAvatarBorderColor || '#ffa500';

  const shouldShowFirstNameOnly = config.showOnlyFirstName || activeHighlight.showOnlyFirstName;
  const authorName = shouldShowFirstNameOnly ? displayName.split(' ')[0] : displayName;
  const currency = detectCurrencySymbol(donationAmount);
  const displayAmount = effectiveAmount ? `${currency}${Math.floor(effectiveAmount)}` : (donationAmount || null);
  const highResAvatar = getHighResAvatarUrl(avatarUrl);

  const shouldShowPlatformLogo = highlightSpecificPlatformLogo !== undefined 
    ? highlightSpecificPlatformLogo 
    : config.showPlatformLogo;

  // Render chatter badges (YouTube, Kick, Twitch) matching live chat feed
  const renderChatterBadges = () => {
    const normPlatform = (platform || 'youtube').toLowerCase();

    if (normPlatform === 'youtube') {
      const badgeElements = [];
      const handled = new Set();

      // 1. Broadcaster / Owner Crown
      if (isOwner || isBroadcaster || badges.includes('broadcaster') || badges.includes('owner')) {
        badgeElements.push(
          <span key="yt-broadcaster" className="hl-badge-icon" title="Channel Owner" style={{ fontSize: '20px', lineHeight: 1 }}>
            👑
          </span>
        );
        handled.add('broadcaster');
        handled.add('owner');
      }

      // 2. Moderator Badge (blue shield matching ChatFeed.jsx)
      if (isModerator || badges.includes('moderator')) {
        const modImg = badgeImages?.moderator;
        badgeElements.push(
          modImg ? (
            <img 
              key="yt-mod-img" 
              className="hl-badge-icon yt-live-chat-author-badge-renderer" 
              src={modImg} 
              alt="Moderator" 
              title="Moderator" 
              style={{ width: 24, height: 24, verticalAlign: 'middle', objectFit: 'contain' }}
            />
          ) : (
            <span key="yt-mod-svg" className="hl-badge-icon youtube-chatter-moderator-badge" title="Moderator" style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="#5e84f1">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
              </svg>
            </span>
          )
        );
        handled.add('moderator');
      }

      // 3. Verified Checkmark (matching ChatFeed.jsx)
      if (isVerified || badges.includes('verified')) {
        const verImg = badgeImages?.verified;
        badgeElements.push(
          verImg ? (
            <img 
              key="yt-ver-img" 
              className="hl-badge-icon yt-live-chat-author-badge-renderer" 
              src={verImg} 
              alt="Verified" 
              title="Verified" 
              style={{ width: 24, height: 24, verticalAlign: 'middle', objectFit: 'contain' }}
            />
          ) : (
            <span key="yt-ver-svg" className="hl-badge-icon youtube-chatter-verified-badge" title="Verified" style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#999999" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )
        );
        handled.add('verified');
      }

      // 4. Member / Loyalty Badges (exact custom image from live chat feed)
      const memberImg = badgeImages?.member || badgeImages?.subscriber || (badgeImages && Object.keys(badgeImages).find(k => k.includes('member') || k.includes('sub') || k.includes('custom') || k.includes('loyalty')) ? badgeImages[Object.keys(badgeImages).find(k => k.includes('member') || k.includes('sub') || k.includes('custom') || k.includes('loyalty'))] : null);

      if (isMember || badges.includes('member') || badges.includes('subscriber') || memberImg) {
        badgeElements.push(
          memberImg ? (
            <img 
              key="yt-member-img" 
              className="hl-badge-icon yt-live-chat-author-badge-renderer" 
              src={memberImg} 
              alt="Member" 
              title="Member" 
              style={{ width: 24, height: 24, verticalAlign: 'middle', objectFit: 'contain' }}
            />
          ) : (
            <span key="yt-member-def" className="hl-badge-icon" title="Member" style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
              <DefaultSubscriberBadge size={24} />
            </span>
          )
        );
        handled.add('member');
        handled.add('subscriber');
      }

      // 5. Any remaining custom badges from badgeImages dictionary
      if (badgeImages && typeof badgeImages === 'object') {
        Object.entries(badgeImages).forEach(([key, url]) => {
          if (!handled.has(key) && url && typeof url === 'string') {
            badgeElements.push(
              <img 
                key={`yt-custom-badge-${key}`} 
                className="hl-badge-icon yt-live-chat-author-badge-renderer" 
                src={url} 
                alt={key} 
                title={key} 
                style={{ width: 24, height: 24, verticalAlign: 'middle', objectFit: 'contain' }}
              />
            );
            handled.add(key);
          }
        });
      }

      // 6. Top Contributor Rank Pill (#1, #2, #3)
      let rank = (typeof youtubeRank === 'number' && youtubeRank >= 1 && youtubeRank <= 3) ? youtubeRank : null;
      if (!rank && Array.isArray(badges)) {
        if (badges.includes('rank_1')) rank = 1;
        else if (badges.includes('rank_2')) rank = 2;
        else if (badges.includes('rank_3')) rank = 3;
      }
      if (rank && rank >= 1 && rank <= 3) {
        badgeElements.push(
          <span 
            key={`yt-rank-${rank}`}
            className={`youtube-rank-badge youtube-rank-${rank}`}
            title={`Top Contributor #${rank}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              backgroundColor: '#3b00bb',
              color: '#ffffff',
              padding: '2px 8px 2px 7px',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: '800',
              lineHeight: '1',
              verticalAlign: 'middle',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.45)'
            }}
          >
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#ffffff" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              style={{ width: '13px', height: '13px', display: 'block', flexShrink: 0 }}
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
      }

      return badgeElements;
    }

    if (normPlatform === 'kick') {
      const sorted = sortKickBadges(badges);
      const iconStyle = { width: 24, height: 24, verticalAlign: 'middle', display: 'inline-block' };

      return sorted.map((b) => {
        if (typeof b === 'string' && b.startsWith('level_')) {
          const lvl = parseInt(b.split('_')[1], 10) || 1;
          const col = getKickLevelColor(lvl);
          return (
            <span key={b} className="hl-badge-icon kick-level-badge" title={`Level ${lvl}`} style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
              <svg width="24" height="24" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                {lvl < 10 ? (
                  <circle cx="9" cy="9" r="7.5" fill="#EAEAEA" stroke="#A4A4A4" strokeWidth="0.8" />
                ) : lvl < 20 ? (
                  <rect x="1.5" y="1.5" width="15" height="15" rx="3" fill="#FFEB3B" stroke="#C69A00" strokeWidth="0.8" />
                ) : lvl < 30 ? (
                  <path d="M 9 1 C 9 1, 2 6.5, 2 11.5 C 2 15.5, 5.5 17, 9 17 C 12.5 17, 16 15.5, 16 11.5 C 16 6.5, 9 1, 9 1 Z" fill={col} stroke="#D01B7C" strokeWidth="0.8" />
                ) : lvl < 40 ? (
                  <rect x="3.5" y="3.5" width="11" height="11" rx="2.2" transform="rotate(45 9 9)" fill="#00F1FF" stroke="#00B1BC" strokeWidth="0.8" />
                ) : (
                  <path d="M 1.5 9 L 5 2 L 13 2 L 16.5 9 L 13 16 L 5 16 Z" fill={col} />
                )}
                <text x="9" y="9.5" fontFamily="system-ui, -apple-system, sans-serif" fontSize="10" fontWeight="900" fill="#000" textAnchor="middle" dominantBaseline="central">
                  {lvl}
                </text>
              </svg>
            </span>
          );
        }

        if (b === 'subscriber') {
          const badgeImageUrl = badgeImages && badgeImages[b];
          if (badgeImageUrl) {
            return (
              <img key={b} className="hl-badge-icon" src={badgeImageUrl} alt="Subscriber" title="Subscriber" style={iconStyle} />
            );
          }
          return (
            <span key={b} className="hl-badge-icon" title="Subscriber" style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
              <DefaultSubscriberBadge size={24} />
            </span>
          );
        }

        if (b === 'sub_gifter') {
          const gCount = giftedSubsCount || 1;
          return (
            <span key={b} className="hl-badge-icon" title={`Gifted ${gCount} subs`} style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
              <KickGiftedSubsBadge giftedCount={gCount} size={24} style={iconStyle} />
            </span>
          );
        }

        if (b === 'moderator') {
          return (
            <span key={b} className="hl-badge-icon" title="Moderator" style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
              <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={iconStyle}>
                <g clipPath="url(#KickModeratorBadgeClipPath-hl)">
                  <path d="M30 0C31.1046 0 32 0.895431 32 2V30C32 31.1046 31.1046 32 30 32H2C0.895431 32 0 31.1046 0 30V2C0 0.895431 0.895431 0 2 0H30ZM16.2197 2.99316C15.8292 2.60266 15.1962 2.60265 14.8057 2.99316L8.36328 9.43555C7.97294 9.82608 7.97284 10.4591 8.36328 10.8496L10.0918 12.5781C10.4823 12.9686 11.1153 12.9685 11.5059 12.5781L11.585 12.499L13.9414 14.8564L3.57129 25.2275C2.70357 26.0954 2.7035 27.5023 3.57129 28.3701C4.43911 29.2376 5.84612 29.2377 6.71387 28.3701L17.084 17.999L19.4414 20.3564L19.3633 20.4346C18.9728 20.8251 18.9728 21.4581 19.3633 21.8486L21.0918 23.5771C21.4823 23.9676 22.1154 23.9676 22.5059 23.5771L28.9482 17.1348C29.3386 16.7443 29.3386 16.1112 28.9482 15.7207L27.2197 13.9922C26.8293 13.6017 26.1962 13.6018 25.8057 13.9922L25.7266 14.0703L23.3701 11.7139C24.2377 10.8461 24.2376 9.4391 23.3701 8.57129C22.5023 7.7035 21.0954 7.70357 20.2275 8.57129L17.8701 6.21387L17.9482 6.13574C18.3388 5.74522 18.3388 5.11221 17.9482 4.72168L16.2197 2.99316Z" fill="#0095FF" />
                </g>
              </svg>
            </span>
          );
        }

        if (b === 'verified') {
          return (
            <span key={b} className="hl-badge-icon" title="Verified" style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={iconStyle}>
                <path d="M30.8598 19.2368C30.1977 18.2069 29.5356 17.2138 28.8736 16.1839C28.7264 15.9632 28.7264 15.8161 28.8736 15.5954C29.5356 14.6023 30.1609 13.6092 30.823 12.6161C31.5954 11.4391 31.1908 10.2989 29.8667 9.82069C28.7632 9.41609 27.6598 8.97471 26.5563 8.57012C26.3356 8.49656 26.2253 8.34943 26.2253 8.09196C26.1885 6.87816 26.1149 5.66437 26.0414 4.48736C25.9678 3.2 24.9747 2.46437 23.7241 2.7954C22.5471 3.08966 21.3701 3.42069 20.2299 3.75173C19.9724 3.82529 19.8253 3.75173 19.6414 3.56782C18.9057 2.61149 18.1333 1.69195 17.3977 0.772414C16.5885 -0.257472 15.3379 -0.257472 14.492 0.772414C13.7563 1.69195 12.9839 2.61149 12.2851 3.53103C12.1012 3.7885 11.9172 3.82529 11.623 3.75173C10.4828 3.42069 9.34253 3.12644 8.53334 2.90575C6.95173 2.53793 5.99541 3.16322 5.92184 4.48736C5.84828 5.70115 5.77472 6.91495 5.73794 8.16552C5.73794 8.42299 5.62759 8.53333 5.4069 8.64368C4.26667 9.08506 3.12644 9.52644 1.98621 9.96782C0.809203 10.446 0.441387 11.5862 1.14023 12.6529C1.8023 13.6828 2.46437 14.6759 3.12644 15.7057C3.27356 15.9264 3.27356 16.0736 3.12644 16.331C2.42759 17.3609 1.76552 18.3908 1.10345 19.4575C0.478165 20.4506 0.882759 21.6276 1.98621 22.069C3.12644 22.5104 4.30345 22.9517 5.44368 23.3931C5.70115 23.4667 5.77471 23.6138 5.77471 23.8713C5.81149 25.0483 5.95862 26.1885 5.95862 27.3655C5.95862 28.5425 6.9885 29.6092 8.42298 29.1678C9.56321 28.8 10.7034 28.5425 11.8437 28.2115C12.0644 28.1379 12.2115 28.1747 12.3586 28.3954C13.131 29.3517 13.8667 30.2713 14.6391 31.2276C15.485 32.2575 16.6988 32.2575 17.508 31.2276C18.2805 30.2713 19.0161 29.3517 19.7885 28.3954C19.9356 28.2115 20.046 28.1379 20.3034 28.2115C21.4804 28.5425 22.6575 28.8368 23.8345 29.1678C25.0483 29.4988 26.0781 28.7632 26.1149 27.5126C26.1885 26.2989 26.2621 25.0851 26.2988 23.8345C26.2988 23.5402 26.446 23.4299 26.6667 23.3563C27.7701 22.9517 28.9103 22.5104 30.0138 22.069C31.1908 21.4805 31.5586 20.3034 30.8598 19.2368ZM22.069 13.2046L14.7127 20.5609C14.5287 20.7448 14.2713 20.892 14.0138 20.9287C13.9402 20.9287 13.8299 20.9655 13.7563 20.9655C13.4253 20.9655 13.0575 20.8184 12.8 20.5609L9.78392 17.5448C9.26898 17.0299 9.26898 16.1839 9.78392 15.669C10.2989 15.154 11.1448 15.154 11.6598 15.669L13.7196 17.7287L20.1196 11.3287C20.6345 10.8138 21.4805 10.8138 21.9954 11.3287C22.5839 11.8437 22.5839 12.6897 22.069 13.2046Z" fill="#1EFF00" />
              </svg>
            </span>
          );
        }

        const displayChar = 
          b === 'broadcaster' ? '👑' : 
          b === 'vip' ? '💎' : 
          b === 'og' ? '⚡' : 
          b === 'bot' ? '🤖' : null;

        if (displayChar) {
          return (
            <span key={b} className="hl-badge-icon" title={b} style={{ fontSize: '20px', lineHeight: 1 }}>
              {displayChar}
            </span>
          );
        }
        return null;
      });
    }

    if (normPlatform === 'twitch') {
      return (badges || []).map((b) => {
        const badgeImageUrl = (badgeImages && badgeImages[b]) || 
                              (badgeVersions && getLiveTwitchBadgeUrl(channel, b, badgeVersions[b]));
        if (badgeImageUrl) {
          return (
            <img key={b} className="hl-badge-icon" src={badgeImageUrl} alt={b} title={b} style={{ width: 24, height: 24, verticalAlign: 'middle', objectFit: 'contain' }} />
          );
        }
        if (b === 'subscriber' || b === 'member') {
          return (
            <span key={b} className="hl-badge-icon" title="Subscriber" style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
              <TwitchDefaultSubscriberBadge size={24} />
            </span>
          );
        }
        const displayChar = 
          b === 'broadcaster' ? '👑' : 
          b === 'moderator' ? '🔧' :
          b === 'vip' ? '💎' : null;

        if (displayChar) {
          return (
            <span key={b} className="hl-badge-icon" title={b} style={{ fontSize: '20px', lineHeight: 1 }}>
              {displayChar}
            </span>
          );
        }
        return null;
      });
    }

    return null;
  };

  return (
    <div 
      className="highlight-overlay-root"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: config.transparentBg ? 'transparent' : '#000000',
        pointerEvents: 'none',
        overflow: 'hidden',
        fontFamily: config.fontFamily !== 'inherit' ? config.fontFamily : 'Avenir Next, Helvetica, Geneva, Verdana, Arial, sans-serif',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        padding: `0 0 ${config.bottom || '60px'} ${config.left || '80px'}`,
        boxSizing: 'border-box'
      }}
    >
      <div 
        className={`hl-c-cont ${animatingState === 'entering' ? 'animate-in' : animatingState === 'exiting' ? 'animate-out' : ''}`}
        style={{
          transform: `scale(${config.scale || 1})`,
          transformOrigin: 'bottom left',
          position: 'relative'
        }}
      >
        {/* Author Name Tag (matching extension .hl-name) */}
        <div 
          className="hl-name"
          style={{
            backgroundColor: finalAuthorBg,
            color: finalAuthorText
          }}
        >
          {authorName}
          <div className="hl-badges">
            {/* Chatter Badges (Members, Mods, Verified, etc.) */}
            {renderChatterBadges()}

            {/* Optional Social Media / Platform Logo (toggled by user setting) */}
            {shouldShowPlatformLogo && (
              <PlatformLogo platform={platform} isShorts={isShorts} size={22} />
            )}
          </div>
        </div>

        {/* Message Box (matching extension .hl-message with dynamic tier color) */}
        <div 
          className="hl-message"
          style={{
            backgroundColor: finalCommentBg,
            color: finalCommentText
          }}
        >
          {parts && parts.length > 0 ? (
            parts.map((p, idx) => {
              if (p.type === 'emote') {
                return (
                  <img 
                    key={idx} 
                    src={p.url} 
                    alt={p.name} 
                    style={{ width: '48px', verticalAlign: 'middle', margin: '0 4px' }}
                  />
                );
              }
              return <span key={idx}>{p.content || p.text || ''}</span>;
            })
          ) : (
            <span>{text}</span>
          )}
        </div>

        {/* Avatar with High Resolution 1280px Support */}
        <div 
          className="hl-img"
          style={{
            backgroundColor: finalAvatarBorder
          }}
        >
          {highResAvatar ? (
            <img 
              src={highResAvatar} 
              alt={authorName}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const sibling = e.currentTarget.nextElementSibling;
                if (sibling) sibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            style={{ 
              width: '100%', 
              height: '100%', 
              borderRadius: '50%', 
              background: '#18181b', 
              color: '#fff', 
              display: highResAvatar ? 'none' : 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 800, 
              fontSize: '38px' 
            }}
          >
            {authorName[0]?.toUpperCase() || 'U'}
          </div>
        </div>

        {/* Donation / Super Chat Ribbon with Dynamic Tier Class */}
        {displayAmount && (
          <div className={`donation ${tierName ? `tier-${tierName}` : 'gold'}`}>
            {displayAmount}
          </div>
        )}

        {/* Membership Ribbon */}
        {isMembership && !displayAmount && (
          <div className={`donation membership ${membershipTier ? membershipTier.toLowerCase() : 'gold'}`}>
            {membershipDuration || 'NEW MEMBER!'}
          </div>
        )}

        {/* Gift Ribbon */}
        {isGift && giftDetails && !displayAmount && (
          <div className="donation membership gold">
            GIFT {giftDetails.jewels ? `${giftDetails.jewels} Jewels` : ''}
          </div>
        )}
      </div>

      {/* SVG clip-paths and definitions for badges */}
      <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        <defs>
          <clipPath id="KickModeratorBadgeClipPath-hl">
            <rect width="32" height="32" fill="white" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}
