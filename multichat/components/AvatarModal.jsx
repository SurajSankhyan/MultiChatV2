import React, { useEffect, useState } from 'react';
import { X, ExternalLink, User } from 'lucide-react';
import PlatformLogo from './PlatformLogo';

export function getHighResAvatarUrl(url, platform = 'youtube') {
  if (!url || typeof url !== 'string') return url;
  let clean = url.trim();

  // 1. YouTube / Google Avatars: Rewrite domain directly to https://yt3.googleusercontent.com/<photoId>=s1280
  if (
    clean.includes('googleusercontent.com') || 
    clean.includes('ggpht.com') || 
    clean.includes('youtube.com') ||
    clean.includes('ytimg.com')
  ) {
    try {
      const parsed = new URL(clean.startsWith('http') ? clean : 'https://' + clean);
      let pathname = parsed.pathname;
      if (pathname.startsWith('/')) pathname = pathname.substring(1);
      const photoId = pathname.split('=')[0];
      return 'https://yt3.googleusercontent.com/' + photoId + '=s1280';
    } catch (e) {
      if (clean.includes('=')) {
        clean = clean.split('=')[0] + '=s1280';
      } else {
        clean = clean + '=s1280';
      }
      return clean.replace(/https?:\/\/[^/]+\//, 'https://yt3.googleusercontent.com/');
    }
  }

  // 2. Twitch Avatars: upgrade thumbnail sizes to 600x600
  if (clean.includes('static-cdn.jtvnw.net') || clean.includes('jtv_user_pictures')) {
    clean = clean.replace(/-(?:30x30|50x50|70x70|150x150|300x300)\.(png|jpg|jpeg|webp)/gi, '-600x600.$1');
    return clean;
  }

  // 3. Kick Avatars: request full-size original master or 1280px quality proxy
  if (clean.includes('images.weserv.nl')) {
    try {
      const urlObj = new URL(clean);
      const raw = urlObj.searchParams.get('url');
      if (raw) {
        let unencoded = decodeURIComponent(raw);
        if (unencoded.startsWith('http')) return unencoded;
      }
      urlObj.searchParams.set('w', '1280');
      urlObj.searchParams.set('q', '100');
      return urlObj.toString();
    } catch (e) {}
  }

  return clean;
}

export default function AvatarModal({ user, onClose }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const highResSrc = getHighResAvatarUrl(user?.avatarUrl, user?.platform);
  const [currentSrc, setCurrentSrc] = useState(highResSrc);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!user) return null;

  const {
    displayName = 'User',
    username = '',
    avatarUrl,
    platform = 'youtube',
    channelUrl
  } = user;

  const cleanUser = (username || displayName || '').replace(/^@+/, '').trim();
  const targetChannelUrl = channelUrl || (
    platform === 'youtube'
      ? `https://www.youtube.com/@${cleanUser}`
      : platform === 'kick'
      ? `https://kick.com/${cleanUser}`
      : platform === 'twitch'
      ? `https://www.twitch.tv/${cleanUser}`
      : null
  );

  const dpOpenUrl = currentSrc || avatarUrl;

  const handleImageError = () => {
    if (currentSrc !== avatarUrl && avatarUrl) {
      setCurrentSrc(avatarUrl);
    } else {
      setImgError(true);
    }
  };

  return (
    <div 
      className="avatar-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      <div 
        className="avatar-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#101116',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '24px',
          boxShadow: '0 28px 70px rgba(0, 0, 0, 0.95), 0 0 50px rgba(255, 165, 0, 0.18)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '36px 28px 30px',
          textAlign: 'center',
          animation: 'modalScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '14px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          }}
          title="Close (ESC)"
        >
          <X size={18} />
        </button>

        {/* Avatar Image Frame */}
        <div 
          style={{
            position: 'relative',
            width: '240px',
            height: '240px',
            borderRadius: '50%',
            padding: '4px',
            background: 'linear-gradient(135deg, #ffa500, #ff5722, #a855f7)',
            boxShadow: '0 14px 40px rgba(255, 165, 0, 0.35), 0 0 20px rgba(168, 85, 247, 0.2)',
            marginBottom: '22px',
            marginTop: '8px'
          }}
        >
          {currentSrc && !imgError ? (
            <img 
              src={currentSrc} 
              alt={displayName} 
              onLoad={() => setImgLoaded(true)}
              onError={handleImageError}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                objectFit: 'cover',
                display: 'block',
                backgroundColor: '#18181b',
                opacity: imgLoaded ? 1 : 0.85,
                transition: 'opacity 0.2s ease'
              }}
            />
          ) : null}

          {(!currentSrc || imgError) && (
            <div 
              style={{ 
                width: '100%', 
                height: '100%', 
                borderRadius: '50%', 
                background: '#18181b', 
                color: '#ffffff', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: 800, 
                fontSize: '76px' 
              }}
            >
              {displayName[0]?.toUpperCase() || 'U'}
            </div>
          )}

          {/* Platform Badge Overlay */}
          <div 
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              backgroundColor: '#090a0f',
              border: '2px solid #18181b',
              borderRadius: '50%',
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.7)'
            }}
          >
            <PlatformLogo platform={platform} size={22} />
          </div>
        </div>

        {/* User Info */}
        <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800, color: '#ffffff', wordBreak: 'break-word' }}>
          {displayName}
        </h2>
        {username && (
          <p style={{ margin: '0 0 22px', fontSize: '14.5px', color: '#94a3b8', fontFamily: 'monospace' }}>
            @{cleanUser}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          {targetChannelUrl && (
            <a
              href={targetChannelUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 18px',
                borderRadius: '12px',
                backgroundColor: '#ffa500',
                color: '#111111',
                fontSize: '14px',
                fontWeight: 700,
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                boxShadow: '0 4px 14px rgba(255, 165, 0, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(255, 165, 0, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(255, 165, 0, 0.3)';
              }}
            >
              <ExternalLink size={16} />
              <span>Visit Channel</span>
            </a>
          )}
          {dpOpenUrl && (
            <a
              href={dpOpenUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 18px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.16)';
                e.currentTarget.style.color = '#38bdf8';
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              }}
              title="Open full size DP in new tab"
            >
              <ExternalLink size={16} />
              <span>Open DP</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
