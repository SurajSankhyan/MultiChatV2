// StreamClips YouTube Content Script - Metadata Extractor & DOM Chat Dispatcher
(function() {
  function getYouTubeMetadata() {
    let handle = '';
    let channelId = '';
    let channelName = '';

    try {
      if (window.ytcfg && typeof window.ytcfg.get === 'function') {
        channelId = window.ytcfg.get('CHANNEL_ID') || window.ytcfg.get('DELEGATED_SESSION_ID') || '';
        handle = window.ytcfg.get('HANDLE') || window.ytcfg.get('LOGGED_IN_USER_HANDLE') || '';
      }

      const avatarBtn = document.querySelector('button#avatar-btn, yt-img-shadow#avatar');
      if (avatarBtn) {
        const img = avatarBtn.querySelector('img');
        if (img && img.alt) {
          channelName = img.alt.trim();
        }
      }

      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical && canonical.href) {
        const match = canonical.href.match(/youtube\.com\/(@[a-zA-Z0-9._-]+)/) ||
                      canonical.href.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          if (match[1].startsWith('@')) handle = match[1];
          else channelId = match[1];
        }
      }

      if (!handle && window.ytInitialData) {
        const str = JSON.stringify(window.ytInitialData);
        const match = str.match(/"handle"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/) || str.match(/"customUrl"\s*:\s*"([^"]+)"/);
        if (match && match[1]) handle = match[1];
      }
    } catch (e) {
      console.warn('[StreamClips Extension] Error extracting DOM metadata:', e);
    }

    return { handle, channelId, channelName, tabCookie: document.cookie || '' };
  }

  function sendChatMessageToDOM(text) {
    try {
      const input = document.querySelector('div#input[contenteditable="true"], #input.yt-live-chat-text-input-field-renderer');
      if (input) {
        input.focus();
        input.innerText = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));

        setTimeout(() => {
          const sendBtn = document.querySelector('yt-icon-button#send-button button, button#send-button');
          if (sendBtn) {
            sendBtn.click();
            console.log('[StreamClips Extension] Posted message via active YouTube tab DOM!');
          }
        }, 150);
        return true;
      }
    } catch (e) {
      console.warn('[StreamClips Extension] Error sending via DOM:', e);
    }
    return false;
  }

  // Listen for messages from background script or popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_YOUTUBE_METADATA') {
      const meta = getYouTubeMetadata();
      sendResponse(meta);
    } else if (request.type === 'SEND_YOUTUBE_CHAT_DOM') {
      const success = sendChatMessageToDOM(request.message);
      sendResponse({ success });
    }
    return true;
  });

  // Also listen for window.postMessage from MultiChat Website
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'STREAMCLIPS_SEND_YOUTUBE_CHAT') {
      sendChatMessageToDOM(event.data.message);
    }
  });
})();
