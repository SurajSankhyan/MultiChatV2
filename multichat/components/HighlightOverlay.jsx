import React, { useEffect, useState, useRef } from 'react';
import PlatformLogo from './PlatformLogo';

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

export default function HighlightOverlay({ previewData = null }) {
  const [activeHighlight, setActiveHighlight] = useState(previewData);
  const [animatingState, setAnimatingState] = useState('hidden'); // 'entering' | 'active' | 'exiting' | 'hidden'
  const autoHideTimerRef = useRef(null);

  // Read config from URL parameters
  const [config, setConfig] = useState(() => {
    if (typeof window === 'undefined') return {};
    const query = new URLSearchParams(window.location.search);
    return {
      scale: parseFloat(query.get('scale') || '1'),
      bottom: query.get('bottom') || '60px',
      left: query.get('left') || '80px',
      autoHideSeconds: query.has('autoHideSeconds') ? parseInt(query.get('autoHideSeconds'), 10) : null,
      transparentBg: query.get('transparent') !== 'false',
      fontFamily: query.get('fontFamily') || 'inherit',
      showOnlyFirstName: query.get('firstNameOnly') === 'true'
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

  // Set up BroadcastChannel and Storage Listener for real-time OBS cross-window sync
  useEffect(() => {
    let bc = null;
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
      }
    };

    window.addEventListener('storage', handleStorage);

    // ESC key closes highlight locally
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        hideHighlight();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (bc) bc.close();
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
    authorBgColor: customAuthorBg
  } = activeHighlight;

  // Determine colors based on amount tiers or YouTube superchat
  let dynamicBg = customBg || null;
  let dynamicText = customText || null;
  let tierName = '';

  if (amountValue && !isSuperChat) {
    const tierColor = colorForManualAmount(amountValue);
    if (tierColor) {
      if (!dynamicBg) dynamicBg = tierColor.bg;
      if (!dynamicText) dynamicText = tierColor.text;
      tierName = tierColor.tier;
    }
  }

  const authorName = config.showOnlyFirstName ? displayName.split(' ')[0] : displayName;
  const currency = detectCurrencySymbol(donationAmount);
  const displayAmount = amountValue ? `${currency}${Math.floor(amountValue)}` : (donationAmount || null);

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
        {/* Author Name */}
        <div 
          className="hl-name"
          style={{
            backgroundColor: customAuthorBg || '#ffa500',
            color: '#222222'
          }}
        >
          {authorName}
          <div className="hl-badges">
            <PlatformLogo platform={platform} isShorts={isShorts} size={20} />
          </div>
        </div>

        {/* Message */}
        <div 
          className="hl-message"
          style={{
            backgroundColor: dynamicBg || '#222222',
            color: dynamicText || '#ffffff'
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

        {/* Avatar */}
        <div 
          className="hl-img"
          style={{
            backgroundColor: customAuthorBg || '#ffa500'
          }}
        >
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
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
              display: avatarUrl ? 'none' : 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontWeight: 800, 
              fontSize: '38px' 
            }}
          >
            {authorName[0]?.toUpperCase() || 'U'}
          </div>
        </div>

        {/* Donation / Super Chat Ribbon */}
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
    </div>
  );
}
