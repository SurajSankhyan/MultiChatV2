import React, { useState, useEffect } from 'react';
import { Sliders, MoreHorizontal, Trash2, MessageSquare, Globe, Lock } from 'lucide-react';
import PlatformLogo from './PlatformLogo';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/interfaces-tooltip';
import { AnimatePresence, motion } from 'framer-motion';

const isChannelConnected = (ch, user) => {
  if (!ch) return false;
  if (ch.platform === 'global') return true;

  if (ch.platform === 'kick') {
    const connectedKickUser = typeof window !== 'undefined' ? String(localStorage.getItem('prochat_kick_username') || '').toLowerCase().replace(/^@+/, '').trim() : '';
    const cleanChName = String(ch.name || '').toLowerCase().replace(/^@+/, '').trim();
    if (ch.is_connected === true) return true;
    if (connectedKickUser && cleanChName === connectedKickUser) return true;
    return false;
  }

  if (ch.platform === 'youtube') {
    const cleanCh = String(ch.name || '').toLowerCase().replace(/^@+/, '').trim();
    const cleanChDisplay = String(ch.displayName || '').toLowerCase().replace(/^@+/, '').trim();
    const cleanChId = String(ch.id || '').trim();

    const uHandle = String(user?.ytCustomHandle || user?.custom_handle || '').toLowerCase().replace(/^@+/, '').trim();
    const uName = String(user?.ytChannelName || user?.channel_name || '').toLowerCase().replace(/^@+/, '').trim();
    const uId = String(user?.ytChannelId || user?.channel_id || '').trim();

    let sHandle = '';
    let sName = '';
    let sId = '';
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('prochat_user') || '{}');
        sHandle = String(stored.ytCustomHandle || stored.custom_handle || '').toLowerCase().replace(/^@+/, '').trim();
        sName = String(stored.ytChannelName || stored.channel_name || '').toLowerCase().replace(/^@+/, '').trim();
        sId = String(stored.ytChannelId || stored.channel_id || '').trim();
      } catch (e) {}
    }

    const myHandles = [uHandle, sHandle].filter(Boolean);
    const myNames = [uName, sName].filter(Boolean);
    const myIds = [uId, sId].filter(Boolean);

    if (ch.verified === true && ch.userId && user?.id && String(ch.userId) === String(user.id)) return true;
    if (ch.is_connected === true) return true;

    if (myIds.length > 0 && myIds.some(id => id === cleanChId)) return true;
    if (myHandles.length > 0 && myHandles.some(h => h === cleanCh || h === cleanChDisplay)) return true;
    if (myNames.length > 0 && myNames.some(n => n === cleanCh || n === cleanChDisplay)) return true;

    return false;
  }

  if (ch.platform === 'twitch') {
    if (ch.verified || ch.is_connected) return true;
    return false;
  }

  return false;
};

export default function ChatInput({ 
  activeChannels, 
  user,
  onSendMessage, 
  onToggleSettings,
  onClearChat,
  youtubeShortsChannels = new Set(),
  resolvedStreamerNames = {},
  youtubeChatMode = 'live',
  onChangeYoutubeChatMode,
  cleanUi = false,
  onChangeCleanUi,
  streamStartTimes = {}
}) {
  const [text, setText] = useState('');
  const [activeChannelIdx, setActiveChannelIdx] = useState(0);
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);

  useEffect(() => {
    if (!isActionsOpen) return;
    const handleClose = () => setIsActionsOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isActionsOpen]);

  const isYoutubeOffline = (ch) => {
    if (!ch || ch.platform !== 'youtube') return false;
    const cleanName = String(ch.name || '').toLowerCase().replace(/^@+/, '').trim();
    return !streamStartTimes[cleanName] && !streamStartTimes[`@${cleanName}`];
  };

  const activeChannelsLength = activeChannels.length;
  const streamStartTimesKey = JSON.stringify(streamStartTimes);

  useEffect(() => {
    if (activeChannels.length > 0) {
      if (activeChannelIdx >= activeChannels.length) {
        const firstOnline = activeChannels.findIndex(ch => isChannelConnected(ch, user) && !isYoutubeOffline(ch));
        setActiveChannelIdx(firstOnline !== -1 ? firstOnline : 0);
        return;
      }

      const currentCh = activeChannelIdx === -1 ? null : activeChannels[activeChannelIdx % activeChannels.length];
      if (currentCh && currentCh.platform === 'youtube' && isYoutubeOffline(currentCh)) {
        const firstOnline = activeChannels.findIndex(ch => isChannelConnected(ch, user) && !isYoutubeOffline(ch));
        if (firstOnline !== -1) {
          setActiveChannelIdx(firstOnline);
        } else {
          setActiveChannelIdx(-1);
        }
      }
    }
  }, [activeChannelsLength, activeChannelIdx, streamStartTimesKey]);

  const [isSending, setIsSending] = useState(false);

  const getFormattedChannelName = (ch) => {
    if (!ch) return '';
    const cleanName = ch.name.toLowerCase().replace(/^@+/, '').trim();
    const resolved = resolvedStreamerNames[cleanName];
    if (resolved && !resolved.toLowerCase().includes('404') && !resolved.toLowerCase().includes('not found') && resolved.toLowerCase() !== 'youtube') {
      return resolved.replace(/^@+/, '');
    }
    if (ch.displayName && !ch.displayName.toLowerCase().includes('404') && !ch.displayName.startsWith('@')) {
      return ch.displayName.replace(/^@+/, '');
    }
    return ch.name.replace(/^@+/, '');
  };

  const connectedChannels = activeChannels.filter(ch => isChannelConnected(ch, user) && !isYoutubeOffline(ch));
  const isGlobalMode = activeChannelIdx === -1;
  const currentChannel = isGlobalMode ? { platform: 'global', name: 'Global' } : activeChannels[activeChannelIdx % activeChannels.length];
  const isCurrentConnected = isGlobalMode ? connectedChannels.length > 0 : isChannelConnected(currentChannel, user);
  const isCurrentChannelYoutubeOffline = currentChannel?.platform === 'youtube' && isYoutubeOffline(currentChannel);
  const isInputDisabled = !currentChannel || !isCurrentConnected || isSending || isCurrentChannelYoutubeOffline;
  const isSendDisabled = isInputDisabled || !text.trim();

  const formattedCurrentName = getFormattedChannelName(currentChannel);
  let placeholderText = "Send a message...";
  if (!currentChannel) {
    placeholderText = "Connect a channel to chat...";
  } else if (isSending) {
    placeholderText = "Send a message...";
  } else if (isCurrentChannelYoutubeOffline) {
    placeholderText = "YouTube live stream is offline (chat disabled)";
  } else if (!isCurrentConnected) {
    placeholderText = `Connect ${formattedCurrentName} Channel to chat`;
  } else if (isGlobalMode) {
    placeholderText = `Broadcast message to ${connectedChannels.length} connected channel${connectedChannels.length > 1 ? 's' : ''}...`;
  } else {
    placeholderText = currentChannel.platform === 'kick'
      ? `Send a message to ${formattedCurrentName}...`
      : `Send a message to @${formattedCurrentName}...`;
  }

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!text.trim() || activeChannels.length === 0 || isSending) return;

    let targetChannels = [];
    if (activeChannelIdx === -1) {
      targetChannels = activeChannels.filter(ch => isChannelConnected(ch, user) && !isYoutubeOffline(ch));
    } else {
      const selectedCh = activeChannels[activeChannelIdx % activeChannels.length];
      if (selectedCh && isChannelConnected(selectedCh, user) && !isYoutubeOffline(selectedCh)) {
        targetChannels = [selectedCh];
      }
    }

    if (targetChannels.length === 0) return;

    const messageText = text;
    setIsSending(true);
    try {
      await onSendMessage(messageText, targetChannels);
      setText('');
    } catch (err) {
      console.warn('[ChatInput] Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const cycleChannel = () => {
    if (activeChannels.length <= 1) return;

    // Quick-cycling ONLY cycles through connected and online channels
    const connectedIndices = activeChannels
      .map((ch, idx) => ({ ch, idx }))
      .filter(({ ch }) => isChannelConnected(ch, user) && !isYoutubeOffline(ch))
      .map(({ idx }) => idx);

    const cycleOrder = [-1, ...connectedIndices];
    if (cycleOrder.length <= 1) return;

    const currentPos = cycleOrder.indexOf(activeChannelIdx);
    const nextPos = (currentPos + 1) % cycleOrder.length;
    setActiveChannelIdx(cycleOrder[nextPos]);
  };

  const currentChannelIsShorts = currentChannel && currentChannel.platform === 'youtube'
    ? youtubeShortsChannels.has(currentChannel.name.toLowerCase().replace('@', '').trim())
    : false;

  const charLimit = 200;

  return (
    <div id="unified-chat-input-toolbar-wrapper" className="floating-chat-input-container">
      <div className="floating-input-capsule">
        {/* Left actions */}
        <div className="capsule-left-actions">
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button 
                type="button" 
                className="setting-btn capsule-setting-btn"
                onClick={onToggleSettings}
                disabled={isSending}
              >
                <span className="bar bar1"></span>
                <span className="bar bar2"></span>
                <span className="bar bar1"></span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Preferences
            </TooltipContent>
          </Tooltip>

          {/* 2. Selected Channel Target Selector */}
          {currentChannel && (
            <div 
              id="livestream-target-button-container"
              style={{ display: 'flex', alignItems: 'center' }}
              onMouseEnter={() => !isSending && setIsTargetDropdownOpen(true)}
              onMouseLeave={() => setIsTargetDropdownOpen(false)}
            >
              <button 
                type="button" 
                className="capsule-btn"
                onClick={cycleChannel}
                disabled={isSending}
              >
                {currentChannel.platform === 'global' ? (
                  <Globe size={15} style={{ color: 'var(--accent-color, #00ffff)' }} />
                ) : (
                  <PlatformLogo platform={currentChannel.platform} isShorts={currentChannelIsShorts} size={15} />
                )}
              </button>
              
              <AnimatePresence>
                {isTargetDropdownOpen && activeChannels.length > 1 && !isSending && (
                  <motion.div 
                    className="target-dropup-menu"
                    style={{ bottom: '50px', left: '0' }}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                  >
                    <button
                      type="button"
                      className={`target-dropup-item platform-global ${activeChannelIdx === -1 ? 'active' : ''}`}
                      onClick={() => {
                        setActiveChannelIdx(-1);
                        setIsTargetDropdownOpen(false);
                      }}
                    >
                      <Globe size={13} style={{ color: 'var(--accent-color, #00ffff)', marginRight: '8px' }} />
                      <span>Global ({connectedChannels.length} Connected)</span>
                    </button>
                    {activeChannels.map((ch, idx) => {
                      const isSelected = idx === activeChannelIdx;
                      const cleanChName = String(ch.name || '').toLowerCase().replace('@', '').trim();
                      const isChShorts = ch.platform === 'youtube' && youtubeShortsChannels.has(cleanChName);
                      const isChConnected = isChannelConnected(ch, user);
                      const isChOffline = ch.platform === 'youtube' && isYoutubeOffline(ch);
                      const chDisplayName = getFormattedChannelName(ch);
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          disabled={isChOffline || !isChConnected}
                          className={`target-dropup-item platform-${ch.platform} ${isSelected ? 'active' : ''}`}
                          onClick={() => {
                            if (isChOffline || !isChConnected) return;
                            setActiveChannelIdx(idx);
                            setIsTargetDropdownOpen(false);
                          }}
                          style={{
                            opacity: isChOffline ? 0.45 : (isChConnected ? 1 : 0.45),
                            cursor: (isChOffline || !isChConnected) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <PlatformLogo platform={ch.platform} isShorts={isChShorts} size={13} />
                            <span>{chDisplayName}</span>
                          </div>
                          {isChOffline ? (
                            <span style={{ fontSize: '11px', color: '#71717a', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                              Offline
                            </span>
                          ) : !isChConnected ? (
                            <span style={{ fontSize: '11px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
                              <Lock size={10} /> Read-only
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* 3. Text Area Form */}
        <form onSubmit={handleSend} style={{ display: 'flex', flex: 1, position: 'relative', alignItems: 'center' }}>
          <input 
            className="capsule-text-input"
            placeholder={placeholderText}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isInputDisabled}
            maxLength={charLimit}
            autoComplete="off"
            name="text"
            type="text"
            style={{
              color: isSending ? 'rgba(255, 255, 255, 0.45)' : (isInputDisabled ? '#71717a' : undefined),
              transition: 'color 0.2s ease'
            }}
          />
          {text.length > 0 && (
            <span className="input-char-limit-indicator" style={{ color: text.length > charLimit ? '#ef4444' : 'var(--text-muted)', right: '10px' }}>
              {text.length}/{charLimit}
            </span>
          )}
        </form>

        {/* 4. Right actions: More actions, Send Button */}
        <div className="capsule-right-actions">
          <div 
            id="bottom-bar-actions-menu-container" 
            style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button 
                  type="button" 
                  className="capsule-btn"
                  onClick={() => !isSending && setIsActionsOpen(!isActionsOpen)}
                  disabled={isSending}
                >
                  <MoreHorizontal size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                More Actions
              </TooltipContent>
            </Tooltip>
            {isActionsOpen && !isSending && (
              <div className="bottom-actions-dropdown" style={{ bottom: '50px', right: '0' }}>
                {activeChannels.some(ch => ch.platform === 'youtube') && (
                  <>
                    <button 
                      type="button"
                      className={`bottom-actions-dropdown-item ${youtubeChatMode === 'live' ? 'active-selection' : ''}`}
                      onClick={() => {
                        onChangeYoutubeChatMode('live');
                        setIsActionsOpen(false);
                      }}
                    >
                      <PlatformLogo platform="youtube" size={13} style={{ marginRight: '8px', opacity: 0.9 }} />
                      <span>Live Chat (All)</span>
                      <div className={`check ${youtubeChatMode === 'live' ? 'checked' : ''}`}>
                        <svg width="18px" height="18px" viewBox="0 0 18 18">
                          <path d="M1,9 L1,3.5 C1,2 2,1 3.5,1 L14.5,1 C16,1 17,2 17,3.5 L17,14.5 C17,16 16,17 14.5,17 L3.5,17 C2,17 1,16 1,14.5 L1,9 Z"></path>
                          <polyline points="1 9 7 14 15 4"></polyline>
                        </svg>
                      </div>
                    </button>
                    <button 
                      type="button"
                      className={`bottom-actions-dropdown-item ${youtubeChatMode === 'top' ? 'active-selection' : ''}`}
                      onClick={() => {
                        onChangeYoutubeChatMode('top');
                        setIsActionsOpen(false);
                      }}
                    >
                      <PlatformLogo platform="youtube" size={13} style={{ marginRight: '8px', opacity: 0.9 }} />
                      <span>Top Chat (Filtered)</span>
                      <div className={`check ${youtubeChatMode === 'top' ? 'checked' : ''}`}>
                        <svg width="18px" height="18px" viewBox="0 0 18 18">
                          <path d="M1,9 L1,3.5 C1,2 2,1 3.5,1 L14.5,1 C16,1 17,2 17,3.5 L17,14.5 C17,16 16,17 14.5,17 L3.5,17 C2,17 1,16 1,14.5 L1,9 Z"></path>
                          <polyline points="1 9 7 14 15 4"></polyline>
                        </svg>
                      </div>
                    </button>
                    <div className="bottom-actions-dropdown-divider" />
                  </>
                )}
                <button 
                  type="button"
                  className={`bottom-actions-dropdown-item ${cleanUi ? 'active-selection' : ''}`}
                  onClick={() => {
                    onChangeCleanUi(!cleanUi);
                    setIsActionsOpen(false);
                  }}
                >
                  <MessageSquare size={13} style={{ marginRight: '8px', opacity: 0.9 }} />
                  <span>Clean UI (Minimal)</span>
                  <div className={`check ${cleanUi ? 'checked' : ''}`}>
                    <svg width="18px" height="18px" viewBox="0 0 18 18">
                      <path d="M1,9 L1,3.5 C1,2 2,1 3.5,1 L14.5,1 C16,1 17,2 17,3.5 L17,14.5 C17,16 16,17 14.5,17 L3.5,17 C2,17 1,16 1,14.5 L1,9 Z"></path>
                      <polyline points="1 9 7 14 15 4"></polyline>
                    </svg>
                  </div>
                </button>
                <div className="bottom-actions-dropdown-divider" />
                <button 
                  type="button"
                  className="bottom-actions-dropdown-item destructive"
                  onClick={() => {
                    onClearChat();
                    setIsActionsOpen(false);
                  }}
                >
                  <Trash2 size={13} style={{ marginRight: '8px', opacity: 0.8 }} />
                  Clear Chat
                </button>
              </div>
            )}
          </div>

          <button 
            type="button" 
            className="capsule-send-btn"
            disabled={isSendDisabled}
            onClick={handleSend}
            style={{ opacity: isSending ? 0.85 : 1, transition: 'all 0.2s ease' }}
          >
            {isSending ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span className="spinner" style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite'
                }} />
                Sending...
              </span>
            ) : (
              'Chat'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
