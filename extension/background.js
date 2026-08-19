// StreamClips YouTube Background Service Worker
let autoSyncDebounceTimer = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SYNC_YOUTUBE_SESSION') {
    handleSessionSync(request.targetUrl || 'http://localhost:5000', request.targetChannel || {})
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  } else if (request.type === 'DISPATCH_YOUTUBE_CHAT_DOM') {
    dispatchChatToYouTubeTab(request.message)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

const YOUTUBE_URL_PATTERNS = ['*://youtube.com/*', '*://*.youtube.com/*'];

async function dispatchChatToYouTubeTab(message) {
  const tabs = await chrome.tabs.query({ url: YOUTUBE_URL_PATTERNS });
  if (!tabs || tabs.length === 0) {
    throw new Error('No open YouTube tab found. Please open YouTube live stream in a browser tab.');
  }
  tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  const activeTab = tabs[0];

  let res = await chrome.tabs.sendMessage(activeTab.id, { type: 'SEND_YOUTUBE_CHAT_DOM', message }).catch(() => null);

  // Fallback: Programmatically inject content.js into all frames if missing in tab and retry
  if (!res || !res.success) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id, allFrames: true },
        files: ['content.js']
      });
      await new Promise((r) => setTimeout(r, 250));
      res = await chrome.tabs.sendMessage(activeTab.id, { type: 'SEND_YOUTUBE_CHAT_DOM', message }).catch(() => null);
    } catch (e) {
      console.warn('[StreamClips Background] Script injection error:', e);
    }
  }

  return { success: res?.success || false };
}

// Silent Background Auto-Sync whenever YouTube rotates cookies in Chrome
chrome.cookies?.onChanged?.addListener((changeInfo) => {
  if (changeInfo?.cookie?.domain?.includes('youtube.com')) {
    const cookieName = changeInfo.cookie.name;
    if (['SAPISID', 'LOGIN_INFO', 'SID', '__Secure-3PAPISID', 'DELEGATED_SESSION_ID'].includes(cookieName)) {
      if (autoSyncDebounceTimer) clearTimeout(autoSyncDebounceTimer);
      autoSyncDebounceTimer = setTimeout(() => {
        console.log('[StreamClips Extension] Silent background auto-syncing YouTube cookies...');
        handleSessionSync('http://localhost:5000', {}).catch(() => {});
      }, 3000);
    }
  }
});

async function getAllYouTubeCookies() {
  const cookieMap = new Map();
  const sapisidList = new Set();
  const loginInfoList = new Set();

  let targetStoreId = undefined;
  try {
    const tabs = await chrome.tabs.query({ url: YOUTUBE_URL_PATTERNS });
    if (tabs && tabs.length > 0) {
      tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      const activeTab = tabs[0];
      if (activeTab && activeTab.storeId) {
        targetStoreId = activeTab.storeId;
      }
    }
  } catch (e) {}

  const storeOptions = targetStoreId ? { storeId: targetStoreId } : {};

  // Fetch cookies across all YouTube/Google endpoints
  const fetchers = [
    chrome.cookies.getAll({ url: 'https://www.youtube.com/live_chat', ...storeOptions }),
    chrome.cookies.getAll({ domain: '.youtube.com', ...storeOptions }),
    chrome.cookies.getAll({ domain: 'youtube.com', ...storeOptions }),
    chrome.cookies.getAll({ url: 'https://www.youtube.com', ...storeOptions }),
    chrome.cookies.getAll({ url: 'https://studio.youtube.com', ...storeOptions }),
    chrome.cookies.getAll({ domain: '.google.com', ...storeOptions })
  ];

  const results = await Promise.allSettled(fetchers);
  results.forEach((res) => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      res.value.forEach((c) => {
        if (c.name && c.value) {
          cookieMap.set(c.name, c.value);
          if (c.name === 'SAPISID' || c.name === '__Secure-3PAPISID') sapisidList.add(c.value);
          if (c.name === 'LOGIN_INFO') loginInfoList.add(c.value);
        }
      });
    }
  });

  // Filter base entries to keep essential authentication keys and ignore conflicting 1PSID/3PSID keys
  const targetKeys = ['SID', 'HSID', 'SSID', 'APISID', 'PREF'];
  const basePairs = [];
  targetKeys.forEach((k) => {
    if (cookieMap.has(k)) {
      basePairs.push(`${k}=${cookieMap.get(k)}`);
    }
  });
  const baseString = basePairs.join('; ');

  sapisidList.forEach((sap) => {
    loginInfoList.forEach((log) => {
      const cand = `SAPISID=${sap}; __Secure-3PAPISID=${sap}; LOGIN_INFO=${log}; ${baseString}`.replace(/;\s*;+/g, ';').trim();
      candidates.push(cand);
    });
  });

  return { cookieMap, candidates };
}

async function handleSessionSync(serverBaseUrl, targetChannel = {}) {
  // 1. Get YouTube cookies across all domains/urls
  const { cookieMap, candidates } = await getAllYouTubeCookies();
  if (cookieMap.size === 0) {
    throw new Error('No YouTube cookies found. Please make sure you are logged into YouTube in your browser.');
  }

  const sapisid = cookieMap.get('SAPISID') || cookieMap.get('__Secure-3PAPISID');
  if (!sapisid) {
    throw new Error('SAPISID session cookie not found. Please make sure you are logged into YouTube in your browser.');
  }

  // Ensure SAPISID is duplicated if only __Secure-3PAPISID exists
  if (!cookieMap.has('SAPISID') && cookieMap.has('__Secure-3PAPISID')) {
    cookieMap.set('SAPISID', cookieMap.get('__Secure-3PAPISID'));
  }

  const cookieString = Array.from(cookieMap.entries())
    .map(([name, val]) => `${name}=${val}`)
    .join('; ');

  // 2. Query active YouTube tab for metadata & DOM document.cookie
  let metadata = { handle: targetChannel.handle || '', channelId: targetChannel.channelId || '', channelName: targetChannel.name || '' };
  try {
    const tabs = await chrome.tabs.query({ url: YOUTUBE_URL_PATTERNS });
    if (tabs && tabs.length > 0) {
      tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        const res = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_YOUTUBE_METADATA' }).catch(() => null);
        if (res) {
          if (!metadata.handle && res.handle) metadata.handle = res.handle;
          if (!metadata.channelId && res.channelId) metadata.channelId = res.channelId;
          if (!metadata.channelName && res.channelName) metadata.channelName = res.channelName;
          if (res.tabCookie && res.tabCookie.includes('SAPISID=')) {
            candidates.unshift(res.tabCookie);
          }
        }
      }
    }
  } catch (e) {
    console.warn('[StreamClips Background] Could not query active YouTube tab:', e);
  }

  // 3. Post session data to MultiChat Backend Sync Endpoint
  const syncEndpoint = `${serverBaseUrl.replace(/\/$/, '')}/api/youtube/extension-sync`;
  const response = await fetch(syncEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cookie: cookieString,
      cookieCandidates: candidates,
      sapisid: sapisid,
      handle: targetChannel.handle || metadata.handle,
      userEmail: targetChannel.email || null,
      channelId: targetChannel.channelId || metadata.channelId,
      channelName: targetChannel.name || metadata.channelName
    })
  });

  const resJson = await response.json().catch(() => ({}));
  if (!response.ok || !resJson.success) {
    throw new Error(resJson.error || `Server sync failed with status ${response.status}`);
  }

  return {
    message: 'YouTube InnerTube session successfully synced to StreamClips!',
    channelName: resJson.channelName || metadata.channelName,
    handle: resJson.handle || metadata.handle,
    sapisidFound: true
  };
}
