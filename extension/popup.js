document.addEventListener('DOMContentLoaded', async () => {
  const syncBtn = document.getElementById('sync-btn');
  const serverUrlInput = document.getElementById('server-url');
  const channelSelect = document.getElementById('channel-select');
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  const resultMsg = document.getElementById('result-msg');

  // Load saved server URL
  chrome.storage.local.get(['serverUrl', 'selectedHandle'], (data) => {
    if (data.serverUrl) {
      serverUrlInput.value = data.serverUrl;
    }
  });

  async function loadAvailableChannels() {
    const serverUrl = serverUrlInput.value.trim() || 'http://localhost:5000';
    try {
      const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/youtube/channels`);
      const data = await res.json();
      if (data.success && Array.isArray(data.channels) && data.channels.length > 0) {
        channelSelect.innerHTML = '';
        data.channels.forEach((ch) => {
          const opt = document.createElement('option');
          opt.value = JSON.stringify({ handle: ch.handle, email: ch.email, channelId: ch.channelId, name: ch.name });
          opt.textContent = `${ch.name} (${ch.handle})`;
          // Default to @duplicatebunnysank9 if found
          if ((ch.handle || '').includes('duplicatebunnysank9') || (ch.email || '').includes('cocthrushed72')) {
            opt.selected = true;
          }
          channelSelect.appendChild(opt);
        });
      } else {
        channelSelect.innerHTML = '<option value="">Default Account</option>';
      }
    } catch (e) {
      console.warn('[StreamClips Popup] Error fetching channel list:', e);
      channelSelect.innerHTML = `
        <option value='{"handle":"@duplicatebunnysank9","email":"cocthrushed72@gmail.com"}'>Duplicate Bunny Sank (@duplicatebunnysank9)</option>
        <option value='{"handle":"@bunnysank","email":"honeybunnypau51@gmail.com"}'>Bunny Sank (@bunnysank)</option>
      `;
    }
  }

  async function checkYouTubeStatus() {
    try {
      const fetchers = [
        chrome.cookies.getAll({ url: 'https://www.youtube.com' }),
        chrome.cookies.getAll({ domain: '.youtube.com' })
      ];
      const results = await Promise.allSettled(fetchers);
      let hasSapisid = false;

      results.forEach((res) => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          if (res.value.some((c) => c.name === 'SAPISID' || c.name === '__Secure-3PAPISID')) {
            hasSapisid = true;
          }
        }
      });

      if (hasSapisid) {
        statusText.textContent = 'Active YouTube Session Detected';
        statusDot.style.background = '#10b981';
      } else {
        statusText.textContent = 'No YouTube Session Found (Log into YouTube first)';
        statusDot.style.background = '#ef4444';
      }
    } catch (e) {
      statusText.textContent = 'Ready to sync';
      statusDot.style.background = '#8b5cf6';
    }
  }

  await checkYouTubeStatus();
  await loadAvailableChannels();

  // Switch Account Button Click
  const switchAccountBtn = document.getElementById('switch-account-btn');
  if (switchAccountBtn) {
    switchAccountBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://www.youtube.com/channel_switcher' });
    });
  }

  // Handle Sync Button Click
  syncBtn.addEventListener('click', async () => {
    const serverUrl = serverUrlInput.value.trim() || 'http://localhost:5000';
    chrome.storage.local.set({ serverUrl });

    let selectedChannel = {};
    try {
      if (channelSelect.value) {
        selectedChannel = JSON.parse(channelSelect.value);
      }
    } catch (e) {}

    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
    resultMsg.style.display = 'none';

    chrome.runtime.sendMessage(
      {
        type: 'SYNC_YOUTUBE_SESSION',
        targetUrl: serverUrl,
        targetChannel: selectedChannel
      },
      (response) => {
        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync InnerTube Session';

        if (response && response.success) {
          resultMsg.className = 'success';
          resultMsg.textContent = response.message || 'Successfully synced YouTube InnerTube session!';
          resultMsg.style.display = 'block';
          checkYouTubeStatus();
        } else {
          resultMsg.className = 'error';
          resultMsg.textContent = (response && response.error) || 'Sync failed. Ensure server is running.';
          resultMsg.style.display = 'block';
        }
      }
    );
  });

  // Handle Direct DOM Chat Posting
  const domSendBtn = document.getElementById('dom-send-btn');
  if (domSendBtn) {
    domSendBtn.addEventListener('click', () => {
      const msg = prompt('Enter message to post in your open YouTube Live stream chat:');
      if (!msg || !msg.trim()) return;

      domSendBtn.disabled = true;
      domSendBtn.textContent = 'Posting...';
      resultMsg.style.display = 'none';

      chrome.runtime.sendMessage(
        {
          type: 'DISPATCH_YOUTUBE_CHAT_DOM',
          message: msg.trim()
        },
        (response) => {
          domSendBtn.disabled = false;
          domSendBtn.textContent = '💬 Post Chat via Open YouTube Tab';

          if (response && response.success) {
            resultMsg.className = 'success';
            resultMsg.textContent = 'Message posted live via active YouTube tab!';
            resultMsg.style.display = 'block';
          } else {
            resultMsg.className = 'error';
            resultMsg.textContent = (response && response.error) || 'Failed to post via DOM. Make sure YouTube live stream is open in a browser tab.';
            resultMsg.style.display = 'block';
          }
        }
      );
    });
  }

  // Handle Headless Login Button Click
  const headlessLoginBtn = document.getElementById('headless-login-btn');
  if (headlessLoginBtn) {
    headlessLoginBtn.addEventListener('click', async () => {
      const serverUrl = serverUrlInput.value.trim() || 'http://localhost:5000';
      headlessLoginBtn.disabled = true;
      headlessLoginBtn.textContent = 'Launching Headless Window...';
      resultMsg.style.display = 'none';

      try {
        const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/youtube/headless-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'cocthrushed72@gmail.com' })
        });
        const data = await res.json();
        headlessLoginBtn.disabled = false;
        headlessLoginBtn.textContent = '🚀 Launch Headless Login Window';

        if (data.success) {
          resultMsg.className = 'success';
          resultMsg.textContent = data.message || 'Headless login completed & working session saved!';
          resultMsg.style.display = 'block';
        } else {
          resultMsg.className = 'error';
          resultMsg.textContent = data.error || 'Headless login failed.';
          resultMsg.style.display = 'block';
        }
      } catch (e) {
        headlessLoginBtn.disabled = false;
        headlessLoginBtn.textContent = '🚀 Launch Headless Login Window';
        resultMsg.className = 'error';
        resultMsg.textContent = 'Could not contact headless login server endpoint.';
        resultMsg.style.display = 'block';
      }
    });
  }

  // Handle Manual Cookie Save Button Click
  const saveManualCookieBtn = document.getElementById('save-manual-cookie-btn');
  const manualCookieInput = document.getElementById('manual-cookie-input');
  if (saveManualCookieBtn && manualCookieInput) {
    saveManualCookieBtn.addEventListener('click', async () => {
      const pastedCookie = manualCookieInput.value.trim();
      if (!pastedCookie) return alert('Please paste a SAPISID=... cookie string first.');

      const serverUrl = serverUrlInput.value.trim() || 'http://localhost:5000';
      saveManualCookieBtn.disabled = true;
      saveManualCookieBtn.textContent = 'Saving...';
      resultMsg.style.display = 'none';

      try {
        const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/youtube/extension-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cookie: pastedCookie,
            sapisid: 'manual',
            userEmail: 'cocthrushed72@gmail.com',
            handle: '@duplicatebunnysank9'
          })
        });
        const data = await res.json();
        saveManualCookieBtn.disabled = false;
        saveManualCookieBtn.textContent = 'Save Pasted Cookie';

        if (data.success) {
          resultMsg.className = 'success';
          resultMsg.textContent = 'Pasted working cookie saved successfully to Supabase!';
          resultMsg.style.display = 'block';
        } else {
          resultMsg.className = 'error';
          resultMsg.textContent = data.error || 'Failed to save pasted cookie.';
          resultMsg.style.display = 'block';
        }
      } catch (e) {
        saveManualCookieBtn.disabled = false;
        saveManualCookieBtn.textContent = 'Save Pasted Cookie';
        resultMsg.className = 'error';
        resultMsg.textContent = 'Could not contact sync endpoint to save cookie.';
        resultMsg.style.display = 'block';
      }
    });
  }
});
