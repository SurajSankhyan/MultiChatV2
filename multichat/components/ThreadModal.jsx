import React from 'react';
import { X, MessageSquare } from 'lucide-react';
import PlatformLogo, { DefaultSubscriberBadge, KickGiftedSubsBadge, TwitchDefaultSubscriberBadge } from './PlatformLogo';
import { parseMessageContent } from '../utils/emotes';
import { getLiveTwitchBadgeUrl } from '../utils/twitchChat';
import { calculateYoutubeTop3Ranks } from '../utils/youtubeChat';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/interfaces-tooltip';

export default function ThreadModal({ 
  activeMessage, 
  onClose, 
  messages = [],
  settings
}) {
  const [isClosing, setIsClosing] = React.useState(false);
  const youtubeTop3Ranks = React.useMemo(() => calculateYoutubeTop3Ranks(messages), [messages]);

  const handleClose = React.useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200); // 200ms exit animation
  }, [onClose]);

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClose]);

  if (!activeMessage) return null;

  // Traverse up and down to collect all messages in this conversation thread
  const getThreadMessages = () => {
    // 1. Find the root parent of the thread
    let root = activeMessage;
    const visitedIds = new Set();

    while (root.repliedTo) {
      const parentId = root.repliedTo.id || root.repliedTo.msgId;
      if (!parentId || visitedIds.has(parentId)) break;
      visitedIds.add(parentId);

      const parentMsg = messages.find(m => m.id === parentId);
      if (parentMsg) {
        root = parentMsg;
      } else {
        // If parent is not in current list, mock it from metadata
        root = {
          id: parentId,
          username: root.repliedTo.username,
          displayName: root.repliedTo.displayName,
          text: root.repliedTo.text,
          timestamp: 'Prior Message',
          platform: root.platform,
          avatar: '',
          isMock: true,
          repliedTo: null
        };
        break;
      }
    }

    // 2. Traversed down: collect root and all replies connected to the chain
    const threadIds = new Set([root.id]);
    const threadMessages = [root];

    // Traverse list to add any messages replying to someone in our thread list
    // (messages list is sorted chronologically, so children come after parents)
    messages.forEach(m => {
      if (m.id === root.id) return;
      if (m.repliedTo) {
        const pId = m.repliedTo.id || m.repliedTo.msgId;
        if (threadIds.has(pId)) {
          threadIds.add(m.id);
          // Avoid duplicate items
          if (!threadMessages.some(tm => tm.id === m.id)) {
            threadMessages.push(m);
          }
        }
      }
    });

    // Make sure our triggering activeMessage is in the list
    if (!threadIds.has(activeMessage.id)) {
      threadMessages.push(activeMessage);
    }

    // Sort messages chronologically
    return threadMessages.sort((a, b) => {
      if (a.isMock) return -1;
      if (b.isMock) return 1;
      return new Date(a.timestampRaw || a.timestamp) - new Date(b.timestampRaw || b.timestamp);
    });
  };

  const threadList = getThreadMessages();

  // Find the first valid timestamp to show on the centered divider
  const getThreadStartTime = () => {
    const firstRealMsg = threadList.find(m => !m.isMock);
    return firstRealMsg ? firstRealMsg.timestamp : '00:00 AM';
  };

  // Helper to get username color
  const getUsernameColor = (msg) => {
    if (msg.color) return msg.color;
    // Default colors based on platform
    if (msg.platform === 'twitch') return '#9146FF';
    if (msg.platform === 'kick') return '#53FC18';
    if (msg.platform === 'youtube') return '#FF0000';
    return '#ffffff';
  };

  const getFormattedName = (msg) => {
    if (!msg) return '';
    let name = '';
    const currentSettings = settings || {};
    
    // Kick Chat ONLY: always show Channel Name without @ names
    if (msg.platform === 'kick' || currentSettings.showChannelName) {
      name = msg.displayName || msg.username || '';
      name = name.replace(/^@+/, '');
    } else {
      const rawUser = msg.username || msg.displayName || '';
      name = `@${rawUser.replace(/^@+/, '')}`;
    }
    
    if (currentSettings.removeAtSymbol || msg.platform === 'kick') {
      name = name.replace(/^@+/, '');
    }
    
    return name;
  };

  const renderUsernameWithTooltip = (logMsg, style = {}) => {
    if (!logMsg) return null;
    const formattedName = getFormattedName(logMsg);
    const currentSettings = settings || {};
    
    const tooltipText = currentSettings.showChannelName 
      ? `@${logMsg.username.replace(/^@+/, '')}` 
      : (logMsg.displayName || logMsg.username).replace(/^@+/, '');

    return (
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <span 
            className="thread-modal-username" 
            style={{ cursor: 'pointer', ...style }}
          >
            {formattedName}:
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    );
  };

  // Kick badge helper functions copied from ChatFeed.jsx
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


  const KICK_BADGE_ORDER = ['broadcaster', 'moderator', 'vip', 'og', 'verified', 'staff', 'sub_gifter', 'founder', 'subscriber', 'bot'];
  const sortKickBadges = (badges) => {
    if (!badges) return [];
    return [...badges].sort((a, b) => {
      // level_ badges always come before named badges
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

  const renderKickBadge = (badge, msg) => {
    const iconStyle = { width: 17, height: 17, verticalAlign: 'middle', marginRight: 4, display: 'inline-block' };
    
    if (badge.startsWith('level_')) {
      if (settings && settings.showLevelBadges === false) return null;
      const level = parseInt(badge.split('_')[1]) || 1;
      const color = getLevelColor(level);
      
      let shapeSvg = null;
      if (level < 10) {
        // Circle (level 1-9)
        shapeSvg = (
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-block' }}>
            <defs>
              <linearGradient id="levelGreyGradient-thread" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#EAEAEA" />
                <stop offset="50%" stopColor="#D5D5D5" />
                <stop offset="100%" stopColor="#C5C5C5" />
              </linearGradient>
            </defs>
            <circle 
              cx="9" 
              cy="9" 
              r="7.5" 
              fill="url(#levelGreyGradient-thread)" 
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
              <linearGradient id="levelYellowGradient-thread" x1="0%" y1="0%" x2="100%" y2="100%">
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
              fill="url(#levelYellowGradient-thread)" 
              stroke="#C69A00"
              strokeWidth="0.8"
            />
            <text x="9" y="9.5" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9" fontWeight="900" fill="#000" textAnchor="middle" dominantBaseline="central">
              {level}
            </text>
          </svg>
        );
      } else if (level < 30) {
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
        shapeSvg = (
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '4px', verticalAlign: 'middle', display: 'inline-block' }}>
            <defs>
              <linearGradient id="levelCyanGradient-thread" x1="0%" y1="0%" x2="100%" y2="100%">
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
              fill="url(#levelCyanGradient-thread)" 
              stroke="#00B1BC"
              strokeWidth="0.8"
            />
            <text x="9" y="9.5" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9" fontWeight="900" fill="#000" textAnchor="middle" dominantBaseline="central">
              {level}
            </text>
          </svg>
        );
      } else {
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
          <svg className="kick-svg-element" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={iconStyle}>
            <defs>
              <linearGradient id="KickModeratorBadgeA-thread" x1="18.8102" y1="-12.7222" x2="2.88536" y2="39.1063" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF6A4A"></stop>
                <stop offset="1" stopColor="#C70C00"></stop>
              </linearGradient>
              <linearGradient id="KickModeratorBadgeB-thread" x1="15.7467" y1="-4.75575" x2="16.321" y2="39.0672" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFC900"></stop>
                <stop offset="0.99" stopColor="#FF9500"></stop>
              </linearGradient>
              <linearGradient id="KickModeratorBadgeC-thread" x1="-14.9543" y1="46.9544" x2="32.0001" y2="-0.000509222" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0095FF"></stop>
                <stop offset="0.99" stopColor="#00C7FF"></stop>
              </linearGradient>
              <clipPath id="KickModeratorBadgeClipPath-thread">
                <rect width="32" height="32" fill="white"></rect>
              </clipPath>
            </defs>
            <g clipPath="url(#KickModeratorBadgeClipPath-thread)">
              <path d="M30 0C31.1046 0 32 0.895431 32 2V30C32 31.1046 31.1046 32 30 32H2C0.895431 32 0 31.1046 0 30V2C0 0.895431 0.895431 0 2 0H30ZM16.2197 2.99316C15.8292 2.60266 15.1962 2.60265 14.8057 2.99316L8.36328 9.43555C7.97294 9.82608 7.97284 10.4591 8.36328 10.8496L10.0918 12.5781C10.4823 12.9686 11.1153 12.9685 11.5059 12.5781L11.585 12.499L13.9414 14.8564L3.57129 25.2275C2.70357 26.0954 2.7035 27.5023 3.57129 28.3701C4.43911 29.2376 5.84612 29.2377 6.71387 28.3701L17.084 17.999L19.4414 20.3564L19.3633 20.4346C18.9728 20.8251 18.9728 21.4581 19.3633 21.8486L21.0918 23.5771C21.4823 23.9676 22.1154 23.9676 22.5059 23.5771L28.9482 17.1348C29.3386 16.7443 29.3386 16.1112 28.9482 15.7207L27.2197 13.9922C26.8293 13.6017 26.1962 13.6018 25.8057 13.9922L25.7266 14.0703L23.3701 11.7139C24.2377 10.8461 24.2376 9.4391 23.3701 8.57129C22.5023 7.7035 21.0954 7.70357 20.2275 8.57129L17.8701 6.21387L17.9482 6.13574C18.3388 5.74522 18.3388 5.11221 17.9482 4.72168L16.2197 2.99316Z" fill="url(#KickModeratorBadgeA-thread)"></path>
              <path d="M30 0C31.1046 0 32 0.895431 32 2V30C32 31.1046 31.1046 32 30 32H2C0.895431 32 0 31.1046 0 30V2C0 0.895431 0.895431 0 2 0H30ZM16.2197 2.99316C15.8292 2.60266 15.1962 2.60265 14.8057 2.99316L8.36328 9.43555C7.97294 9.82608 7.97284 10.4591 8.36328 10.8496L10.0918 12.5781C10.4823 12.9686 11.1153 12.9685 11.5059 12.5781L11.585 12.499L13.9414 14.8564L3.57129 25.2275C2.70357 26.0954 2.7035 27.5023 3.57129 28.3701C4.43911 29.2376 5.84612 29.2377 6.71387 28.3701L17.084 17.999L19.4414 20.3564L19.3633 20.4346C18.9728 20.8251 18.9728 21.4581 19.3633 21.8486L21.0918 23.5771C21.4823 23.9676 22.1154 23.9676 22.5059 23.5771L28.9482 17.1348C29.3386 16.7443 29.3386 16.1112 28.9482 15.7207L27.2197 13.9922C26.8293 13.6017 26.1962 13.6018 25.8057 13.9922L25.7266 14.0703L23.3701 11.7139C24.2377 10.8461 24.2376 9.4391 23.3701 8.57129C22.5023 7.7035 21.0954 7.70357 20.2275 8.57129L17.8701 6.21387L17.9482 6.13574C18.3388 5.74522 18.3388 5.11221 17.9482 4.72168L16.2197 2.99316Z" fill="url(#KickModeratorBadgeB-thread)"></path>
              <path d="M30 0C31.1046 0 32 0.895431 32 2V30C32 31.1046 31.1046 32 30 32H2C0.895431 32 0 31.1046 0 30V2C0 0.895431 0.895431 0 2 0H30ZM16.2197 2.99316C15.8292 2.60266 15.1962 2.60265 14.8057 2.99316L8.36328 9.43555C7.97294 9.82608 7.97284 10.4591 8.36328 10.8496L10.0918 12.5781C10.4823 12.9686 11.1153 12.9685 11.5059 12.5781L11.585 12.499L13.9414 14.8564L3.57129 25.2275C2.70357 26.0954 2.7035 27.5023 3.57129 28.3701C4.43911 29.2376 5.84612 29.2377 6.71387 28.3701L17.084 17.999L19.4414 20.3564L19.3633 20.4346C18.9728 20.8251 18.9728 21.4581 19.3633 21.8486L21.0918 23.5771C21.4823 23.9676 22.1154 23.9676 22.5059 23.5771L28.9482 17.1348C29.3386 16.7443 29.3386 16.1112 28.9482 15.7207L27.2197 13.9922C26.8293 13.6017 26.1962 13.6018 25.8057 13.9922L25.7266 14.0703L23.3701 11.7139C24.2377 10.8461 24.2376 9.4391 23.3701 8.57129C22.5023 7.7035 21.0954 7.70357 20.2275 8.57129L17.8701 6.21387L17.9482 6.13574C18.3388 5.74522 18.3388 5.11221 17.9482 4.72168L16.2197 2.99316Z" fill="url(#KickModeratorBadgeC-thread)"></path>
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
            style={{ width: 17, height: 17, verticalAlign: 'middle', marginRight: 4, display: 'inline-block' }}
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
              <path d="M9.38839 21.0905V17.561C9.38839 17.3471 9.31807 17.1915 9.17741 17.0943C9.03676 16.9776 8.81406 16.9193 8.50932 16.9193H7.34893V13.273H10.373C12.2483 13.273 13.5728 13.6036 14.3464 14.2648C15.1434 14.926 15.5419 15.8011 15.5419 16.8901V21.0905H9.38839ZM9.38839 27.712V20.7113H15.5419V28.383C15.5419 29.472 15.1436 30.347 14.3464 31.0082C13.5728 31.6694 12.2483 32 10.373 32H7.34893V28.3538H8.50932C8.81406 28.3538 9.03676 28.3052 9.17741 28.2079C9.31807 28.0913 9.38839 27.926 9.38839 27.712ZM6.15339 17.561V21.0905H-0.000152588V16.8901C-0.000152588 15.8011 0.386641 14.926 1.16023 14.2648C1.95726 13.6036 3.29346 13.273 5.16882 13.273H8.19285V16.9193H7.03247C6.72772 16.9193 6.50502 16.9776 6.36437 17.0943C6.22371 17.1915 6.15339 17.3471 6.15339 17.561ZM6.15339 20.7113V27.712C6.15339 27.926 6.22371 28.0913 6.36437 28.2079C6.50517 28.3052 6.72787 28.3538 7.03247 28.3538H8.19285V32H5.16882C3.29346 32 1.95726 31.6694 1.16023 31.0082C0.386641 30.347 -0.000152588 29.472 -0.000152588 28.383V20.7113H6.15339Z" fill="#00FFF2"></path>
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
          <KickGiftedSubsBadge giftedCount={giftedCount} size={17} style={iconStyle} />
        </span>
      );
    }
    
    // Standard fallback for unrecognized Kick badges is null to avoid rendering raw strings like 'level'
    return null;
  };

  const renderBadge = (badge, msg) => {
    if (msg.platform === 'youtube' && (badge === 'broadcaster' || (typeof badge === 'string' && badge.startsWith('rank_')))) {
      return null;
    }

    if (msg.platform === 'kick') {
      return renderKickBadge(badge, msg);
    }

    const badgeImageUrl = (msg.badgeImages && msg.badgeImages[badge]) || 
                          (msg.platform === 'twitch' && msg.badgeVersions && getLiveTwitchBadgeUrl(msg.channel, badge, msg.badgeVersions[badge]));
    if (badgeImageUrl) {
      return (
        <img 
          key={badge} 
          className="msg-badge-icon" 
          src={badgeImageUrl} 
          alt={badge} 
          title={badge}
          style={{ width: 17, height: 17, verticalAlign: 'middle', marginRight: 4, display: 'inline-block' }}
        />
      );
    }

    if (badge === 'subscriber' || badge === 'member') {
      return (
        <span key={badge} style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', marginRight: '4px' }} title={badge === 'member' ? 'Member' : 'Subscriber'}>
          {msg.platform === 'twitch' ? (
            <TwitchDefaultSubscriberBadge size={15} />
          ) : (
            <DefaultSubscriberBadge size={15} />
          )}
        </span>
      );
    }

    // Fallbacks
    const displayChar = 
      badge === 'broadcaster' ? '👑' : 
      badge === 'moderator' ? '🔧' :
      badge === 'vip' ? '💎' : null;

    if (!displayChar) return null;

    return (
      <span 
        key={badge} 
        className={`msg-badge ${badge} platform-${msg.platform}`} 
        style={{ 
          marginRight: 4, 
          verticalAlign: 'middle',
          fontSize: '11px',
          display: 'inline-block'
        }}
      >
        {displayChar}
      </span>
    );
  };

  return (
    <div className={`thread-modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div 
        className={`thread-modal-container ${isClosing ? 'closing' : ''}`} 
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: isClosing
            ? 'modalExit 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            : 'modalSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        {/* Modal Header */}
        <div className="thread-modal-header">
          <div className="thread-modal-header-title">
            <MessageSquare size={20} className="thread-modal-title-icon" />
            <h3>Thread</h3>
            {/* Platform Logo directly after Thread title text */}
            <PlatformLogo platform={activeMessage.platform} isShorts={activeMessage.isShorts} size={18} style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center' }} />
          </div>
          <button className="thread-modal-close" onClick={handleClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="thread-modal-body">
          {/* Centered Divider with Timestamp of the first message */}
          <div className="thread-modal-divider">
            <span className="thread-modal-divider-text">{getThreadStartTime()}</span>
          </div>

          <div className="thread-modal-messages-list">
            {threadList.map((msg, index) => {
              return (
                <div 
                  key={msg.id || index} 
                  className={`thread-modal-message-row ${msg.isMock ? 'mock-prior-message' : ''}`}
                >
                  <div className="thread-modal-main-message">
                    {/* Render badges before username for non-YouTube platforms */}
                    {msg.platform !== 'youtube' && msg.badges && (msg.platform === 'kick' ? sortKickBadges(msg.badges) : msg.badges).map(badge => renderBadge(badge, msg))}

                    {/* Username */}
                    {renderUsernameWithTooltip(msg, { color: getUsernameColor(msg), fontWeight: '700', marginRight: '6px' })}

                    {/* For YouTube: standard badges + dynamic rank badge after username */}
                    {msg.platform === 'youtube' && (
                      <>
                        {msg.badges && msg.badges.map(badge => renderBadge(badge, msg))}
                        {(() => {
                          const keys = [
                            msg.channelId,
                            msg.authorChannelId,
                            msg.authorExternalChannelId,
                            msg.userId,
                            msg.username,
                            msg.displayName
                          ].filter(Boolean).map(k => String(k).toLowerCase().trim());

                          let rank = (typeof msg.youtubeRank === 'number' && msg.youtubeRank >= 1 && msg.youtubeRank <= 3) ? msg.youtubeRank : null;

                          if (!rank && Array.isArray(msg.badges)) {
                            if (msg.badges.includes('rank_1')) rank = 1;
                            else if (msg.badges.includes('rank_2')) rank = 2;
                            else if (msg.badges.includes('rank_3')) rank = 3;
                          }

                          if (!rank && youtubeTop3Ranks) {
                            for (const k of keys) {
                              const found = youtubeTop3Ranks.get(k);
                              if (found && found >= 1 && found <= 3) {
                                rank = found;
                                break;
                              }
                            }
                          }
                          if (!rank || rank < 1 || rank > 3) return null;
                          return (
                            <span 
                              key={`${msg.id}-thread-yt-rank-${rank}`}
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
                                fontSize: '12px',
                                fontWeight: '800',
                                lineHeight: '1',
                                verticalAlign: 'middle',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
                                margin: '0 4px',
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
                                style={{ width: '12px', height: '12px', display: 'block', flexShrink: 0 }}
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
                      </>
                    )}

                    {/* Message text / emotes */}
                    <span className="thread-modal-text">
                      {(msg.parts || parseMessageContent(msg.text)).map((part, pIdx) => {
                        if (part.type === 'emote') {
                          return (
                            <img 
                              key={pIdx} 
                              className="chat-emote" 
                              src={part.url} 
                              alt={part.name} 
                              style={{ width: '1.3em', height: '1.3em', verticalAlign: 'middle', margin: '0 2px', objectFit: 'contain' }}
                            />
                          );
                        }
                        return <span key={pIdx}>{part.content}</span>;
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SVG definitions/gradients for Kick badges */}
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
          
          {/* Sub Gifter ClipPaths */}
          <clipPath id="clip0_KickGiftedSubsBadge"><rect width="24" height="24.5" fill="white" transform="translate(4 4)"></rect></clipPath>
          <clipPath id="clip1_KickGiftedSubsBadge"><rect width="24" height="24.5" fill="white" transform="translate(4 4)"></rect></clipPath>
        </defs>
      </svg>
    </div>
  );
}
