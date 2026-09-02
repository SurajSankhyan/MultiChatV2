// YouTube Live Chat Polling Client using InnerTube API & CORS Proxies

// Global caches to store resolved channel names and handle pending network requests
const YOUTUBE_NAME_CACHE = new Map(); // channelId -> displayName
const PENDING_NAME_RESOLVES = new Map(); // channelId -> Promise<displayName>

// Mapping of YouTube Gift items to their default Jewel values
const YOUTUBE_GIFT_JEWELS_MAP = {
  'star': 10,
  'stars': 10,
  'shooting star': 50,
  'super star': 100,
  'hiding': 10,
  'hiding...': 10,
  'treat': 10,
  'heart': 10,
  'hearts': 10,
  'high five': 10,
  'highfive': 10,
  'clap': 10,
  'thumbs up': 10,
  'thumbsup': 10,
  'samosa': 20,
  'taco': 20,
  'popcorn': 20,
  'cupcake': 20,
  'boba': 50,
  'glowstick': 50,
  'party popper': 50,
  'mic drop': 100,
  'micdrop': 100,
  'bouquet': 100,
  'rose': 100,
  'trophy': 200,
  'crown': 500,
  'diamond': 1000,
  'fireworks': 1000,
  'sports car': 2500,
  'sportscar': 2500,
  'spaceship': 5000,
  'rocket': 5000
};

export class YoutubeChatClient {
  constructor(onMessageCallback, onStatusCallback, onNameResolvedCallback, onMessageDeletedCallback) {
    this.onMessage = onMessageCallback;
    this.onStatus = onStatusCallback; // (channel, status)
    this.onNameResolved = onNameResolvedCallback;
    this.onMessageDeleted = onMessageDeletedCallback;
    this.activePolls = new Map(); // channelName -> { intervalId, videoId, apiKey, continuationToken }
    
    // Rotating public CORS proxies as fallback
    this.proxies = [
      (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
      (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];
  }

  connect() {
    // No-op: YouTube chat is individual per channel polling
  }

  mapToLocalProxy(url) {
    if (!url.startsWith('https://www.youtube.com')) return url;
    const path = url.replace('https://www.youtube.com', '');
    
    // Obfuscate /live_chat to avoid adblockers blocking the request
    if (path.startsWith('/live_chat')) {
      return path.replace('/live_chat', '/ytproxy/chat');
    }
    return '/ytproxy' + path;
  }

  getLiveUrl(channelName) {
    const trimmed = channelName.trim();
    // Check if it's already a full video url
    if (trimmed.includes('watch?v=') || trimmed.includes('youtu.be/') || trimmed.includes('/live/')) {
      return trimmed.startsWith('http') ? trimmed : `https://www.youtube.com/${trimmed}`;
    }
    // Check if it's an 11-char video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return `https://www.youtube.com/watch?v=${trimmed}`;
    }
    // Check if it matches YouTube channel ID format: starts with UC/uc and is 24 chars
    if (/^uc[a-zA-Z0-9_-]{22}$/i.test(trimmed)) {
      return `https://www.youtube.com/channel/${trimmed}/live`;
    }
    // Otherwise assume it's a handle or username slug
    const cleanSlug = trimmed.replace('@', '');
    return `https://www.youtube.com/@${cleanSlug}/live`;
  }

  // Helper to fetch from url trying local proxy first, and falling back to CORS proxies
  async fetchWithProxyFallback(url, timeoutMs = 8000, channelName = null) {
    let lastError = null;
    const isValidYoutubeHtml = (text) => {
      if (!text || typeof text !== 'string' || text.length < 500) return false;
      if (text.includes('google.com/sorry') || text.includes('<title>Sorry...</title>') || text.includes('consent.youtube.com/m?')) {
        return false;
      }
      return text.includes('ytInitialData') || text.includes('ytcfg') || text.includes('youtube.com') || text.includes('isLive') || text.includes('watch?v=');
    };

    const fetchTimeout = async (target, opts = {}) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(target, { ...opts, signal: controller.signal });
        clearTimeout(timer);
        return res;
      } catch (e) {
        clearTimeout(timer);
        throw e;
      }
    };

    // 1. Try local proxy first
    if (url.startsWith('https://www.youtube.com') || url.startsWith('https://m.youtube.com')) {
      const localProxyUrl = this.mapToLocalProxy(url);
      try {
        console.log(`YouTube client: trying local proxy: ${localProxyUrl}`);
        const res = await fetchTimeout(localProxyUrl);
        if (res.ok) {
          const text = await res.text();
          if (isValidYoutubeHtml(text)) {
            return text;
          }
        }
      } catch (err) {
        lastError = err;
        console.warn('Local proxy fetch failed, trying query proxy:', err.message);
      }

      // 1b. Try dedicated query proxy (/api/youtube/proxy?url=...)
      try {
        const queryProxyUrl = `/api/youtube/proxy?url=${encodeURIComponent(url)}${channelName ? '&channel=' + encodeURIComponent(channelName) : ''}`;
        const res2 = await fetchTimeout(queryProxyUrl);
        if (res2.ok) {
          const text2 = await res2.text();
          if (isValidYoutubeHtml(text2)) {
            return text2;
          }
        }
      } catch (err2) {
        lastError = err2;
        console.warn('Query proxy fetch failed, falling back to public proxies:', err2.message);
      }
    }

    // 2. Fall back to rotating public proxies
    for (let i = 0; i < this.proxies.length; i++) {
      const proxiedUrl = this.proxies[i](url);
      try {
        console.log(`YouTube client: trying public proxy index ${i} for ${url}`);
        const res = await fetchTimeout(proxiedUrl);
        if (res.ok) {
          const text = await res.text();
          if (isValidYoutubeHtml(text)) {
            return text;
          }
        }
      } catch (err) {
        lastError = err;
        console.warn(`Public proxy ${i} failed:`, err.message);
      }
    }
    throw lastError || new Error('All CORS proxies failed to load page');
  }

  // Fetch structured player metadata directly via Innertube Player API
  async fetchPlayerMetadata(videoId, apiKey = '') {
    if (!videoId) return null;

    const payload = {
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240404.01.00',
          hl: 'en',
          gl: 'US'
        }
      },
      videoId
    };

    const keyToUse = apiKey || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
    const endpoint = `https://www.youtube.com/youtubei/v1/player?key=${keyToUse}`;
    const localEndpoint = `/ytproxy/youtubei/v1/player?key=${keyToUse}`;

    const parsePlayerJson = (json) => {
      if (!json || json.error || (!json.microformat && !json.videoDetails)) return null;
      const mf = json.microformat?.playerMicroformatRenderer;
      const liveDetails = mf?.liveBroadcastDetails;
      const candidateTime = liveDetails?.actualStartTime || liveDetails?.startTimestamp;
      let startTime = null;
      let isExact = false;
      if (candidateTime) {
        if (candidateTime instanceof Date || (candidateTime && typeof candidateTime.getTime === 'function')) {
          const ms = candidateTime.getTime();
          if (!isNaN(ms) && ms > 0 && ms <= Date.now() + 60000) {
            startTime = ms;
            isExact = true;
          }
        } else if (typeof candidateTime === 'number') {
          startTime = candidateTime < 10000000000 ? candidateTime * 1000 : candidateTime;
          isExact = true;
        } else if (typeof candidateTime === 'string') {
          if (/^[0-9]{10,13}$/.test(candidateTime)) {
            const rawNum = parseInt(candidateTime, 10);
            startTime = rawNum < 10000000000 ? rawNum * 1000 : rawNum;
            isExact = true;
          } else {
            let parseable = candidateTime.trim();
            if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(parseable)) {
              parseable = parseable.replace(' ', 'T') + 'Z';
            }
            const parsed = Date.parse(parseable);
            if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now() + 60000) {
              startTime = parsed;
              isExact = true;
            }
          }
        }
      }
      let isShorts = false;
      const formats = json.streamingData?.adaptiveFormats || json.streamingData?.formats || [];
      for (const fmt of formats) {
        if (fmt.width && fmt.height && fmt.height > fmt.width) {
          isShorts = true;
          break;
        }
      }
      const viewers = parseInt(json.videoDetails?.viewCount, 10) || 0;
      const likes = parseInt(json.videoDetails?.likeCount, 10) || 0;
      return {
        isLive: !!json.videoDetails?.isLive || !!json.videoDetails?.isLiveContent || liveDetails?.isLiveNow !== false,
        startTime,
        isExact,
        viewers,
        likes,
        isShorts,
        title: json.videoDetails?.title
      };
    };

    // 1. Try dedicated live-info API endpoint (handles InnerTube on backend with proxy fallback)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8500);
      const res = await fetch(`/api/youtube/live-info?videoId=${encodeURIComponent(videoId)}`, {
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          return {
            isLive: data.isLive !== false,
            startTime: data.startTime || null,
            isExact: !!data.isExact,
            viewers: data.viewers || 0,
            likes: data.likes || 0,
            isShorts: !!data.isShorts,
            title: data.title || '',
            author: data.author || ''
          };
        }
      }
    } catch (e) {}

    // 1b. Try InnerTube backend endpoint with live_info action
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('/api/youtube/innertube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'live_info', videoId }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          return {
            isLive: data.isLive !== false,
            startTime: data.startTime || null,
            isExact: !!data.isExact,
            viewers: data.viewers || 0,
            likes: data.likes || 0,
            isShorts: !!data.isShorts,
            title: data.title || '',
            author: data.author || ''
          };
        }
      }
    } catch (e) {}

    // 2. Try local Next.js proxy (/ytproxy/youtubei/v1/player)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(localEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const parsed = parsePlayerJson(data);
        if (parsed) return parsed;
      }
    } catch (e) {}

    // 3. Try query proxy (/api/youtube/proxy)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const queryUrl = `/api/youtube/proxy?url=${encodeURIComponent(endpoint)}`;
      const res = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const parsed = parsePlayerJson(data);
        if (parsed) return parsed;
      }
    } catch (e) {}

    // 4. Try rotating public CORS proxies directly (fallback for static hosting)
    for (const proxyFn of this.proxies) {
      try {
        const proxiedUrl = proxyFn(endpoint);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(proxiedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const parsed = parsePlayerJson(data);
          if (parsed && parsed.startTime) return parsed;
        }
      } catch (e) {}
    }

    // 5. Fallback: fetch watch page HTML directly via proxy fallback (which contains itemprop="startDate" and startTimestamp)
    try {
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const watchHtml = await this.fetchWithProxyFallback(watchUrl);
      if (watchHtml) {
        const meta = this.parseMetadataFromHtml(watchHtml);
        if (meta && (meta.startTime || meta.isLive)) {
          return {
            isLive: meta.isLive,
            startTime: meta.startTime,
            isExact: !!meta.isExact,
            viewers: meta.viewers || 0,
            likes: meta.likes || 0,
            isShorts: !!meta.isShorts,
            title: ''
          };
        }
      }
    } catch (e) {}

    return null;
  }

  // Resolves the exact live stream broadcast start timestamp using an off-screen YouTube player bridge
  resolveLiveStartTimeViaIFrame(videoId) {
    if (typeof window === 'undefined' || !videoId) return Promise.resolve(null);

    return new Promise((resolve) => {
      let resolved = false;
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.bottom = '0px';
      iframe.style.right = '0px';
      iframe.style.width = '120px';
      iframe.style.height = '80px';
      iframe.style.opacity = '0.001';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-99999';
      iframe.setAttribute('tabindex', '-1');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.setAttribute('allow', 'autoplay; encrypted-media');
      iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=1&playsinline=1&controls=0&origin=${encodeURIComponent(window.location.origin)}`;

      let pollInterval = null;

      const cleanup = () => {
        if (resolved) return;
        resolved = true;
        if (pollInterval) clearInterval(pollInterval);
        window.removeEventListener('message', messageHandler);
        clearTimeout(timeout);
        try {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch (e) {}
      };

      const messageHandler = (e) => {
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (data) {
            // Check direct live broadcast details from playerResponse if provided by IFrame API
            const liveDetails = data.info?.playerResponse?.microformat?.playerMicroformatRenderer?.liveBroadcastDetails;
            const candTime = liveDetails?.actualStartTime || liveDetails?.startTimestamp;
            if (candTime) {
              const parsed = Date.parse(candTime);
              if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now() + 60000) {
                cleanup();
                resolve(parsed);
                return;
              }
            }
          }
        } catch (err) {}
      };

      iframe.onload = () => {
        pollInterval = setInterval(() => {
          try {
            if (iframe.contentWindow) {
              iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*');
              iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'getCurrentTime', args: [] }), '*');
              iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'getDuration', args: [] }), '*');
            }
          } catch (e) {}
        }, 250);
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 5000);

      window.addEventListener('message', messageHandler);
      document.body.appendChild(iframe);
    });
  }

  // Resolves the YouTube channel display name from InnerTube browse endpoint with HTML scraper fallback
  async resolveChannelName(channelId) {
    if (!channelId) return null;

    // 1. Check cache first
    if (YOUTUBE_NAME_CACHE.has(channelId)) {
      return YOUTUBE_NAME_CACHE.get(channelId);
    }

    // 2. Check if a fetch is already in progress
    if (PENDING_NAME_RESOLVES.has(channelId)) {
      return PENDING_NAME_RESOLVES.get(channelId);
    }

    // 3. Start a new resolve promise
    const promise = (async () => {
      // Find API key and client version from active polls
      let apiKey = '';
      let clientVersion = '2.20240404.01.00';
      for (const poll of this.activePolls.values()) {
        if (poll.apiKey) {
          apiKey = poll.apiKey;
          if (poll.clientVersion) clientVersion = poll.clientVersion;
          break;
        }
      }

      if (apiKey) {
        try {
          const endpoint = `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`;
          const localEndpoint = `/ytproxy/youtubei/v1/browse?key=${apiKey}`;
          const payload = {
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: clientVersion
              }
            },
            browseId: channelId
          };

          console.log(`YouTube client: resolving channel name via InnerTube browse API for ${channelId}`);
          
          let response;
          try {
            response = await fetch(localEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Local proxy returned ${response.status}`);
          } catch (e) {
            console.warn('Local proxy InnerTube browse failed, trying public proxy:', e.message);
            const publicProxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(endpoint)}`;
            response = await fetch(publicProxyUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          }

          if (response && response.ok) {
            const data = await response.json();
            const title = data.header?.c4TabbedHeaderRenderer?.title ||
                          data.metadata?.playlistMetadataRenderer?.title ||
                          data.microformat?.microformatDataRenderer?.title;
            if (title) {
              console.log(`YouTube client: resolved name via InnerTube browse -> ${title}`);
              YOUTUBE_NAME_CACHE.set(channelId, title);
              return title;
            }
          }
        } catch (err) {
          console.warn(`YouTube client: InnerTube browse failed for ${channelId}:`, err.message);
        }
      }

      // Fallback: HTML scraper page fetch
      try {
        const cleanHandle = channelId.startsWith('@') ? channelId : `@${channelId}`;
        const url = channelId.startsWith('UC') && channelId.length === 24
          ? `https://www.youtube.com/channel/${channelId}`
          : `https://www.youtube.com/${cleanHandle}`;

        console.log(`YouTube client: falling back to HTML scraper page fetch for ${channelId} (${url})`);
        const html = await this.fetchWithProxyFallback(url);
        if (!html) return null;

        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch && titleMatch[1]) {
          let name = titleMatch[1].trim();
          name = name.replace(/\s*-\s*YouTube$/, '').trim();
          const norm = name.toLowerCase();
          if (name && norm !== 'youtube' && !norm.includes('404') && !norm.includes('not found') && !norm.includes('error')) {
            console.log(`YouTube client: resolved name via HTML scraper -> ${name}`);
            YOUTUBE_NAME_CACHE.set(channelId, name);
            return name;
          }
        }
      } catch (err) {
        console.warn(`YouTube client: HTML scraper fallback failed for ${channelId}:`, err.message);
      }

      return null;
    })();

    PENDING_NAME_RESOLVES.set(channelId, promise);

    // Clean up from pending list when done
    promise.finally(() => {
      PENDING_NAME_RESOLVES.delete(channelId);
    });

    return promise;
  }

  // Parse YouTube video ID from general inputs (URLs or video IDs)
  extractVideoId(input) {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 1. Direct 11-char video ID (e.g. hHW1oY26kxQ)
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    // 2. watch?v=...
    const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchMatch) return watchMatch[1];

    // 3. youtu.be/...
    const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];

    // 4. /live/...
    const liveMatch = trimmed.match(/\/live\/([a-zA-Z0-9_-]{11})/);
    if (liveMatch) return liveMatch[1];

    // 5. /embed/...
    const embedMatch = trimmed.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (embedMatch) return embedMatch[1];

    return null;
  }

  parseMetadataFromHtml(html) {
    if (!html) return null;
    let playerJson = null;
    try {
      const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});\s*(?:var\s+meta|<\/script>)/s) || 
                          html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/);
      if (playerMatch && playerMatch[1]) {
        playerJson = JSON.parse(playerMatch[1]);
      }
    } catch (e) {}

    let dataJson = null;
    try {
      const dataMatch = html.match(/ytInitialData\s*=\s*(\{.*?\});\s*(?:var\s+meta|<\/script>)/s) || 
                        html.match(/ytInitialData\s*=\s*(\{.*?\});/);
      if (dataMatch && dataMatch[1]) {
        dataJson = JSON.parse(dataMatch[1]);
      }
    } catch (e) {}

    let isLive = false;
    let isShorts = false;
    let viewers = 0;
    let likes = 0;
    let startTime = null;
    let isExact = false;

    // 0. Extract exact ISO startDate / datePublished directly from HTML itemprop tags (exact to the second)
    const startDateMatch = html.match(/itemprop="startDate"\s+content="([^"]+)"/i) || 
                           html.match(/<meta\s+itemprop="startDate"\s+content="([^"]+)"/i) ||
                           html.match(/"startDate"\s*:\s*"([^"]+)"/i);
    if (startDateMatch && startDateMatch[1]) {
      const parsedStart = Date.parse(startDateMatch[1]);
      if (!isNaN(parsedStart) && parsedStart > 0 && parsedStart <= Date.now() + 60000) {
        startTime = parsedStart;
        isLive = true;
        isExact = true;
      }
    }

    if (html.includes('itemprop="isLiveBroadcast" content="True"') || html.includes('itemprop="isLiveBroadcast" content="true"') || html.includes('BADGE_STYLE_TYPE_LIVE_NOW') || html.includes('"label":"LIVE"')) {
      isLive = true;
    }

    if (playerJson && playerJson.videoDetails) {
      isLive = !!playerJson.videoDetails.isLiveContent || !!playerJson.videoDetails.isLive || isLive;
    }

    if (playerJson && playerJson.microformat && playerJson.microformat.playerMicroformatRenderer) {
      const mf = playerJson.microformat.playerMicroformatRenderer;
      if (mf.liveBroadcastDetails) {
        if (mf.liveBroadcastDetails.isLiveNow !== false) {
          isLive = true;
        }
        const candidateTime = mf.liveBroadcastDetails.actualStartTime || mf.liveBroadcastDetails.startTimestamp;
        if (candidateTime) {
          let parseable = String(candidateTime).trim();
          if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(parseable)) {
            parseable = parseable.replace(' ', 'T') + 'Z';
          }
          const parsedTime = Date.parse(parseable);
          if (!isNaN(parsedTime) && parsedTime > 0 && parsedTime <= Date.now() + 60000) {
            startTime = parsedTime;
            isExact = true;
          }
        }
      }
    }

    // Extract concurrent viewers from html first
    const origMatch = html.match(/"originalViewCount"\s*:\s*"([^"]+)"/);
    if (origMatch && origMatch[1]) {
      const val = parseInt(origMatch[1].replace(/[^0-9]/g, ''), 10);
      if (!isNaN(val)) viewers = val;
    } else {
      const shortIdx = html.indexOf('"shortViewCountText"');
      if (shortIdx !== -1) {
        const sub = html.substring(shortIdx, shortIdx + 300);
        const runTextMatch = sub.match(/"text"\s*:\s*"([^"]+)"/);
        if (runTextMatch && runTextMatch[1]) {
          const text = runTextMatch[1].toLowerCase();
          if (text.includes('k')) viewers = Math.round(parseFloat(text.replace(/[^0-9.]/g, '')) * 1000);
          else if (text.includes('m')) viewers = Math.round(parseFloat(text.replace(/[^0-9.]/g, '')) * 1000000);
          else viewers = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
        }
      }
    }

    // Fallback for viewers if still not found
    if (!viewers && isLive && playerJson && playerJson.videoDetails && playerJson.videoDetails.viewCount) {
       viewers = parseInt(playerJson.videoDetails.viewCount, 10) || 0;
    }

    // Fallback for startTime if not found: prioritize actualStartTime and startTimestamp first
    if (!startTime) {
       const priorityRegexes = [
         /"(?:actualStartTime|startTimestamp|startDate)"\s*:\s*"([^"]+)"/gi,
         /itemprop="startDate"\s+content="([^"]+)"/gi
       ];
       for (const rgx of priorityRegexes) {
         if (startTime) break;
         const matches = [...html.matchAll(rgx)];
         for (const m of matches) {
           const str = m[1];
           if (/^[0-9]{10,13}$/.test(str)) {
             const rawNum = parseInt(str, 10);
             startTime = rawNum < 10000000000 ? rawNum * 1000 : rawNum;
             isExact = true;
             break;
           }
           let parseable = str.trim();
           if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(parseable)) {
             parseable = parseable.replace(' ', 'T') + 'Z';
           }
           const parsed = Date.parse(parseable);
           if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now() + 60000) {
             startTime = parsed;
             isExact = true;
             break;
           }
         }
       }
    }

    // Check aspect ratio for Shorts
    if (playerJson && playerJson.streamingData) {
      const formats = playerJson.streamingData.adaptiveFormats || playerJson.streamingData.formats || [];
      for (const format of formats) {
        if (format && format.width && format.height) {
          if (format.height > format.width) {
            isShorts = true;
            break;
          }
        }
      }
    }
    if (!isShorts && html) {
      const formatMatches = [...html.matchAll(/"width"\s*:\s*(\d+)\s*,\s*"height"\s*:\s*(\d+)/g)];
      for (const m of formatMatches) {
        const w = parseInt(m[1], 10);
        const h = parseInt(m[2], 10);
        if (w > 0 && h > 0 && h > w) {
          isShorts = true;
          break;
        }
      }
    }

    // Parse likes from ytInitialData
    if (dataJson && dataJson.contents) {
      try {
        const results = dataJson.contents.twoColumnWatchNextResults?.results?.results?.contents;
        if (results) {
          const videoPrimaryInfo = results.find(c => c.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer;
          if (videoPrimaryInfo && videoPrimaryInfo.videoActions) {
            const actions = videoPrimaryInfo.videoActions.menuRenderer?.topLevelButtons;
            if (actions) {
              const likeBtn = actions.find(a => a.segmentedLikeDislikeButtonViewModel)?.segmentedLikeDislikeButtonViewModel?.likeButtonViewModel?.likeButtonViewModel?.toggleButtonViewModel?.toggleButtonViewModel?.defaultButtonViewModel?.buttonViewModel;
              if (likeBtn && likeBtn.title) {
                const titleStr = likeBtn.title.toLowerCase().replace(/,/g, '');
                if (titleStr.includes('k')) {
                  likes = Math.round(parseFloat(titleStr.replace(/[^0-9.]/g, '')) * 1000);
                } else if (titleStr.includes('m')) {
                  likes = Math.round(parseFloat(titleStr.replace(/[^0-9.]/g, '')) * 1000000);
                } else {
                  likes = parseInt(titleStr.replace(/[^0-9]/g, ''), 10) || 0;
                }
              }
            }
          }
        }
      } catch(e) {}
    }

    // Fallback for likes if not found
    if (!likes) {
      const countMatch = html.match(/"likeCount"\s*:\s*"([0-9.,KMBkmb]+)"/i) || html.match(/"likeCount"\s*:\s*([0-9]+)/i);
      if (countMatch && countMatch[1]) {
        const text = String(countMatch[1]).toLowerCase().replace(/,/g, '');
        if (text.includes('k')) likes = Math.round(parseFloat(text.replace(/[^0-9.]/g, '')) * 1000);
        else if (text.includes('m')) likes = Math.round(parseFloat(text.replace(/[^0-9.]/g, '')) * 1000000);
        else likes = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
      } else {
        const labelMatch = html.match(/"label"\s*:\s*"([0-9.,KMBkmb]+)\s+likes?"/i) || 
                           html.match(/"accessibilityData"\s*:\s*\{"label"\s*:\s*"([0-9.,KMBkmb]+)\s+likes?"\}/i);
        if (labelMatch && labelMatch[1]) {
          const text = labelMatch[1].toLowerCase().replace(/,/g, '');
          if (text.includes('k')) likes = Math.round(parseFloat(text.replace(/[^0-9.]/g, '')) * 1000);
          else if (text.includes('m')) likes = Math.round(parseFloat(text.replace(/[^0-9.]/g, '')) * 1000000);
          else likes = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
        }
      }
    }

    return { isLive, isShorts, viewers, likes, startTime, isExact };
  }

  parseViewersFromHtml(html) {
    const meta = this.parseMetadataFromHtml(html);
    return meta ? meta.viewers : null;
  }

  parseLikesFromHtml(html) {
    const meta = this.parseMetadataFromHtml(html);
    return meta ? meta.likes : null;
  }

  parseStartTimestamp(html) {
    const meta = this.parseMetadataFromHtml(html);
    return meta ? meta.startTime : null;
  }

  extractLiveVideoId(html) {
    if (!html) return null;
    
    // Explicit offline / ended markers
    if (
      html.includes('"status":"LIVE_STREAM_OFFLINE"') ||
      html.includes('"reason":"This live stream has ended."') ||
      html.includes('This live stream has ended') ||
      html.includes('liveChatReplayRenderer') ||
      html.includes('"liveChatReplayContinuationData"') ||
      html.includes('"isLiveNow":false')
    ) {
      return null;
    }

    const meta = this.parseMetadataFromHtml(html);
    if (!meta || !meta.isLive) {
      // Check if confirmed live via multiple regexes
      const isLiveMatch = /"isLive"\s*:\s*true/i.test(html) ||
                     /"isLiveNow"\s*:\s*true/i.test(html) ||
                     /"isLiveContent"\s*:\s*true/i.test(html) ||
                     /"isLiveBroadcast"\s*:\s*true/i.test(html) ||
                     /"status"\s*:\s*"LIVE"/i.test(html) ||
                     /\bwatching now\b/i.test(html) ||
                     /liveChatRenderer/i.test(html);
      if (!isLiveMatch) return null;
    }
    
    // Explicit offline safeguard: if the canonical URL is a channel page, it's not a live watch page
    const channelCanonicalMatch = html.match(/<link\s+rel="canonical"\s+href="[^"]*(?:\/channel\/|\/@)[^"]+"/i);
    if (channelCanonicalMatch) {
      return null;
    }

    // 1. Try canonical URL watch?v= or /shorts/
    const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="[^"]*(?:watch\?v=|\/shorts\/)([a-zA-Z0-9_-]{11})"/i);
    if (canonicalMatch && canonicalMatch[1]) {
      return canonicalMatch[1];
    }
    
    // 2. Try liveStreamabilityRenderer videoId
    const liveStreamMatch = html.match(/"liveStreamabilityRenderer"\s*:\s*\{\s*"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/i);
    if (liveStreamMatch && liveStreamMatch[1]) {
      return liveStreamMatch[1];
    }

    // 3. Try watchEndpoint / currentVideoEndpoint videoId
    const endpointMatch = html.match(/"watchEndpoint"\s*:\s*\{\s*"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/i);
    if (endpointMatch && endpointMatch[1]) {
      return endpointMatch[1];
    }
    
    // 4. Try videoDetails videoId
    const vidDetailsMatch = html.match(/"videoDetails"\s*:\s*\{[^}]*"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/i);
    if (vidDetailsMatch && vidDetailsMatch[1]) {
      return vidDetailsMatch[1];
    }

    // 5. Fallback to general videoId
    const videoIdMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/i);
    if (videoIdMatch && videoIdMatch[1]) {
      return videoIdMatch[1];
    }
    
    return null;
  }

  setupOfflinePoll(channelName, chatMode = 'live') {
    const trimmedName = channelName.trim();
    const pollKey = trimmedName.toLowerCase().replace('@', '');
    
    const existing = this.activePolls.get(pollKey);
    if (existing) {
      if (existing.timeoutId) clearTimeout(existing.timeoutId);
      if (existing.intervalId) clearInterval(existing.intervalId);
      if (existing.viewerIntervalId) clearInterval(existing.viewerIntervalId);
    }

    const pollInstance = {
      isOffline: true,
      timeoutId: null,
      intervalId: null,
      viewerIntervalId: null,
      seenIds: new Set(),
      trimmedName: trimmedName,
      chatMode
    };
    
    this.activePolls.set(pollKey, pollInstance);
    
    const checkLive = async () => {
      try {
        console.log(`YouTube client: polling offline channel status for ${pollKey}`);
        const liveUrl = this.getLiveUrl(trimmedName);
        const html = await this.fetchWithProxyFallback(liveUrl);
        
        const videoId = this.extractLiveVideoId(html);
        if (videoId) {
          console.log(`YouTube client: channel ${pollKey} went live! Re-joining...`);
          if (pollInstance.viewerIntervalId) clearInterval(pollInstance.viewerIntervalId);
          this.activePolls.delete(pollKey);
          this.join(trimmedName, chatMode);
        }
      } catch (err) {
        console.warn(`YouTube client: offline poll failed for ${pollKey}:`, err.message);
      }
    };
    
    pollInstance.viewerIntervalId = setInterval(checkLive, 10000);
  }

  extractInnertubeParams(html) {
    if (!html) return {};
    let apiKey = null;
    const keyMatchers = [
      /"INNERTUBE_API_KEY":"([^"]+)"/,
      /"innertubeApiKey":"([^"]+)"/,
      /ytcfg\.set\s*\(\s*\{\s*"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/
    ];
    for (const regex of keyMatchers) {
      const match = html.match(regex);
      if (match && match[1]) {
        apiKey = match[1];
        break;
      }
    }

    let clientVersion = '2.20240404.01.00';
    const versionMatchers = [
      /"INNERTUBE_CONTEXT_CLIENT_VERSION"\s*:\s*"([^"]+)"/,
      /"clientVersion"\s*:\s*"([^"]+)"/,
      /"CLIENT_VERSION"\s*:\s*"([^"]+)"/
    ];
    for (const regex of versionMatchers) {
      const match = html.match(regex);
      if (match && match[1]) {
        clientVersion = match[1];
        break;
      }
    }

    let continuationToken = null;
    const contMatchers = [
      /"reloadContinuationData"\s*:\s*\{\s*"continuation"\s*:\s*"([^"]+)"/,
      /"timedContinuationData"\s*:\s*\{\s*"continuation"\s*:\s*"([^"]+)"/,
      /"continuationData":\s*\{\s*"continuation"\s*:\s*"([^"]+)"/,
      /"liveChatRenderer"[^}]*"continuation":"([^"]+)"/,
      /"continuation":"([^"]+)"/
    ];
    for (const regex of contMatchers) {
      const match = html.match(regex);
      if (match && match[1]) {
        continuationToken = match[1];
        break;
      }
    }

    let liveChatId = null;
    const lcMatch = html.match(/"activeLiveChatId"\s*:\s*"([^"]+)"/) || html.match(/"liveChatId"\s*:\s*"([^"]+)"/);
    if (lcMatch && lcMatch[1]) {
      liveChatId = lcMatch[1];
    }

    return { apiKey, clientVersion, continuationToken, liveChatId };
  }

  extractChannelNameFromHtml(html) {
    if (!html) return null;
    
    // 1. Try ownerChannelName / channelTitle
    const ownerChannelMatch = html.match(/"ownerChannelName"\s*:\s*"([^"]+)"/i) ||
                              html.match(/"channelTitle"\s*:\s*"([^"]+)"/i);
    if (ownerChannelMatch && ownerChannelMatch[1] && ownerChannelMatch[1].trim()) {
      return ownerChannelMatch[1].trim();
    }

    // 2. Try author field
    const authorMatch = html.match(/"author"\s*:\s*"([^"]+)"/);
    if (authorMatch && authorMatch[1] && authorMatch[1].trim() && !authorMatch[1].toLowerCase().includes('youtube')) {
      return authorMatch[1].trim();
    }

    // 3. Try videoOwnerRenderer runs text
    const ownerRunMatch = html.match(/"videoOwnerRenderer"\s*:\s*\{[^}]*"title"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([^"]+)"/);
    if (ownerRunMatch && ownerRunMatch[1] && ownerRunMatch[1].trim()) {
      return ownerRunMatch[1].trim();
    }

    // 4. Try itemprop author link
    const itempropAuthorMatch = html.match(/<span\s+itemprop="author"[^>]*>\s*<link\s+itemprop="name"\s+content="([^"]+)"/i);
    if (itempropAuthorMatch && itempropAuthorMatch[1] && itempropAuthorMatch[1].trim()) {
      return itempropAuthorMatch[1].trim();
    }

    return null;
  }

  async join(channelName, chatMode = 'live') {
    const trimmedName = channelName.trim();
    if (!trimmedName) return;

    const pollKey = trimmedName.toLowerCase().replace('@', '');
    let existingSeenIds = new Set();

    if (this.activePolls.has(pollKey)) {
      const active = this.activePolls.get(pollKey);
      
      // If we are already online and the requested chat mode matches the active chat mode, return early
      if (!active.isOffline && active.chatMode === chatMode) return;
      
      // If we need to switch mode, let's leave first, rejoin and reset seenIds
      if (active.chatMode !== chatMode && !active.isOffline) {
        console.log(`YouTube client: switching chat mode for ${pollKey} from ${active.chatMode} to ${chatMode}`);
        this.leave(trimmedName);
        existingSeenIds = new Set(); // Reset seenIds on chat mode switch to fetch fresh history
      } else if (active.seenIds) {
        existingSeenIds = active.seenIds;
      }
    }

    this.onStatus(pollKey, 'connecting');

    try {
      let videoId = this.extractVideoId(trimmedName);
      let resolvedDisplayName = trimmedName.replace('@', '');
      let pageHtml = null;
      let isShorts = false;
      let localStartTime = null;
      let isExactStartTime = false;
      let localViewers = null;
      let localLikes = null;

      if (!videoId) {
        const liveUrl = this.getLiveUrl(trimmedName);

        console.log(`YouTube client: resolving video ID: ${liveUrl}`);
        pageHtml = await this.fetchWithProxyFallback(liveUrl);

        // Extract channel ID and channel title directly from HTML (0ms)
        const canonicalMatch = pageHtml.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/([^"]+)"/) ||
                               pageHtml.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/);
        const channelId = canonicalMatch ? canonicalMatch[1] : null;

        const extractedChannelName = this.extractChannelNameFromHtml(pageHtml);
        if (extractedChannelName) {
          resolvedDisplayName = extractedChannelName;
          YOUTUBE_NAME_CACHE.set(pollKey, extractedChannelName);
          if (channelId) YOUTUBE_NAME_CACHE.set(channelId, extractedChannelName);
        }

        videoId = this.extractLiveVideoId(pageHtml);

        if (!videoId) {
          console.log(`YouTube client: channel ${pollKey} is offline.`);
          if (channelId && !YOUTUBE_NAME_CACHE.has(channelId)) {
            this.resolveChannelName(channelId).then(resolved => {
              if (resolved) this.onNameResolved(pollKey, resolved);
            }).catch(() => {});
          }
          this.onStatus(pollKey, 'offline', { startTime: null, viewers: 0, likes: 0, displayName: resolvedDisplayName });
          this.setupOfflinePoll(trimmedName, chatMode);
          return;
        }

        // Extract live stream metadata if present in HTML
        if (pageHtml) {
          const meta = this.parseMetadataFromHtml(pageHtml);
          if (meta) {
            localStartTime = meta.startTime;
            isExactStartTime = !!meta.isExact;
            localViewers = meta.viewers;
            localLikes = meta.likes;
            if (meta.isShorts) isShorts = true;
          }
        }

        // Async resolve channel display name in background without blocking connection
        if (channelId && !YOUTUBE_NAME_CACHE.has(channelId)) {
          this.resolveChannelName(channelId).then(resolved => {
            if (resolved) this.onNameResolved(pollKey, resolved);
          }).catch(() => {});
        }
      }

      if (!videoId) {
        throw new Error('Could not find active live stream video ID. Channel might be offline.');
      }

      console.log(`YouTube client: resolved video ID: ${videoId}`);

      // Extract Innertube API parameters directly from pageHtml if present
      let { apiKey, clientVersion, continuationToken, liveChatId } = this.extractInnertubeParams(pageHtml);

      // If tokens weren't in main page HTML or chatMode is specific, fetch live chat page directly (1 fast request)
      if (!apiKey || !continuationToken) {
        try {
          const chatPageUrl = `https://www.youtube.com/live_chat?v=${videoId}`;
          console.log(`YouTube client: fetching live chat page for tokens: ${chatPageUrl}`);
          const chatHtml = await this.fetchWithProxyFallback(chatPageUrl, 8000, trimmedName);
          if (chatHtml) {
            const chatParams = this.extractInnertubeParams(chatHtml);
            if (!apiKey && chatParams.apiKey) apiKey = chatParams.apiKey;
            if (!continuationToken && chatParams.continuationToken) continuationToken = chatParams.continuationToken;
            if (!clientVersion && chatParams.clientVersion) clientVersion = chatParams.clientVersion;
            if (!liveChatId && chatParams.liveChatId) liveChatId = chatParams.liveChatId;

            // Also extract metadata/startTime from chatHtml if not resolved yet
            if (!localStartTime) {
              const chatMeta = this.parseMetadataFromHtml(chatHtml);
              if (chatMeta && chatMeta.startTime) {
                localStartTime = chatMeta.startTime;
                isExactStartTime = !!chatMeta.isExact;
              }
            }
          }
        } catch (e) {
          console.warn("YouTube client: live_chat fetch error:", e.message);
        }
      }

      if (!apiKey) {
        apiKey = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
      }

      // Resolve exact live stream start time via InnerTube Player API
      if ((!localStartTime || !isExactStartTime) && videoId) {
        try {
          const pMeta = await this.fetchPlayerMetadata(videoId, apiKey);
          if (pMeta) {
            if (pMeta.startTime) {
              localStartTime = pMeta.startTime;
              isExactStartTime = !!pMeta.isExact;
            }
            if (pMeta.isShorts) isShorts = true;
            if (pMeta.viewers !== null && pMeta.viewers !== undefined && localViewers === null) localViewers = pMeta.viewers;
          }
        } catch (e) {
          console.warn("YouTube client: fetchPlayerMetadata error:", e.message);
        }
      }

      console.log(`YouTube client: connected to stream ${videoId} with clientVersion: ${clientVersion}, startTime: ${localStartTime ? new Date(localStartTime).toISOString() : 'null'}`);

      const currentViewers = localViewers !== null ? localViewers : null;
      const currentLikes = localLikes !== null ? localLikes : null;

      // Store poll instance with seen-ID dedup set and adaptive polling
      const pollInstance = {
        videoId,
        liveChatId,
        apiKey,
        continuationToken,
        clientVersion: clientVersion || '2.20240404.01.00',
        timeoutId: null,
        viewerIntervalId: null,
        seenIds: existingSeenIds,
        startTimestamp: localStartTime || null,
        isExactStartTime,
        isShorts,
        displayName: resolvedDisplayName,
        trimmedName: trimmedName,
        chatMode,
        viewers: currentViewers,
        likes: currentLikes,
        isPolling: false,
        rankSlots: { 1: null, 2: null, 3: null },
        contributorDonationMap: new Map(),
        recordDonation(userKey, amount) {
          if (!userKey || isNaN(amount) || amount <= 0) return;
          const k = String(userKey).toLowerCase().trim();
          this.contributorDonationMap.set(k, (this.contributorDonationMap.get(k) || 0) + amount);
        },
        recordExplicitRank(keys = [], rank) {
          if (!rank || rank < 1 || rank > 3) return;
          const keyArr = (Array.isArray(keys) ? keys : [keys]).filter(Boolean).map(k => String(k).toLowerCase().trim());
          if (keyArr.length === 0) return;
          
          // Clear any existing slot held by this user
          for (let r = 1; r <= 3; r++) {
            if (this.rankSlots[r] && keyArr.some(k => this.rankSlots[r].keys.includes(k))) {
              this.rankSlots[r] = null;
            }
          }
          // Assign slot to this user (displacing previous holder)
          this.rankSlots[rank] = { primaryKey: keyArr[0], keys: keyArr };
        },
        getRankForUser(keys = []) {
          const keyArr = (Array.isArray(keys) ? keys : [keys]).filter(Boolean).map(k => String(k).toLowerCase().trim());
          // 1. Check active explicit rank slots
          for (let r = 1; r <= 3; r++) {
            if (this.rankSlots[r] && keyArr.some(k => this.rankSlots[r].keys.includes(k))) {
              return r;
            }
          }
          // 2. Check stream donations
          if (this.contributorDonationMap.size > 0) {
            const sorted = Array.from(this.contributorDonationMap.entries()).sort((a, b) => b[1] - a[1]);
            for (let i = 0; i < Math.min(3, sorted.length); i++) {
              const [contributorKey] = sorted[i];
              for (const k of keyArr) {
                if (k === contributorKey) {
                  return i + 1;
                }
              }
            }
          }
          return null;
        }
      };

      this.activePolls.set(pollKey, pollInstance);
      this.onStatus(pollKey, 'connected', { 
        startTime: pollInstance.startTimestamp,
        isExact: !!pollInstance.isExactStartTime,
        viewers: pollInstance.viewers,
        likes: pollInstance.likes,
        isShorts,
        displayName: resolvedDisplayName
      });

      // If start timestamp is still missing, trigger background iframe bridge resolution
      if (!pollInstance.startTimestamp && videoId) {
        this.resolveLiveStartTimeViaIFrame(videoId).then(iStartTime => {
          if (iStartTime && !pollInstance.startTimestamp && this.activePolls.has(pollKey)) {
            pollInstance.startTimestamp = iStartTime;
            pollInstance.isExactStartTime = true;
            try {
                const stored = localStorage.getItem('prochat_cached_stream_start_times') || '{}';
                const next = { ...JSON.parse(stored), [pollInstance.videoId]: iStartTime };
                localStorage.setItem('prochat_cached_stream_start_times', JSON.stringify(next));
            } catch (e) {}
            this.onStatus(pollKey, 'connected', {
              startTime: iStartTime,
              isExact: true,
              viewers: pollInstance.viewers,
              likes: pollInstance.likes,
              isShorts: pollInstance.isShorts,
              displayName: resolvedDisplayName
            });
          }
        }).catch(() => {});
      }

      // Adaptive polling loop
      let consecutiveErrors = 0;
      let isPollActive = false;

      const scheduleNextPoll = (delay = 1000) => {
        if (!this.activePolls.has(pollKey)) return;
        if (pollInstance.timeoutId) clearTimeout(pollInstance.timeoutId);
        pollInstance.timeoutId = setTimeout(async () => {
          if (!this.activePolls.has(pollKey) || isPollActive) return;
          isPollActive = true;
          try {
            await this.pollChat(pollKey);
            consecutiveErrors = 0;
          } catch (err) {
            consecutiveErrors++;
            console.warn(`YouTube client: poll error for ${pollKey} (fail #${consecutiveErrors}):`, err.message);
          } finally {
            isPollActive = false;
          }
          if (!this.activePolls.has(pollKey)) return;
          scheduleNextPoll(1000);
        }, delay);
      };

      // Immediate first poll if chat continuation token is available
      if (continuationToken) {
        scheduleNextPoll(0);
      }

      // Periodic viewer and like count update for YouTube
      pollInstance.viewerIntervalId = setInterval(async () => {
        try {
          const liveUrl = this.getLiveUrl(trimmedName);
          const html = await this.fetchWithProxyFallback(liveUrl);
          if (html) {
            const currentVideoId = this.extractLiveVideoId(html);
            if (!currentVideoId) {
              console.log(`YouTube client: channel ${pollKey} went offline during 15s poll.`);
              this.onStatus(pollKey, 'offline', { startTime: null, viewers: 0, likes: 0, displayName: pollInstance.displayName });
              this.leave(trimmedName);
              this.setupOfflinePoll(trimmedName, pollInstance.chatMode);
              return;
            }

            const meta = this.parseMetadataFromHtml(html);
            if (meta) {
              if (meta.startTime) {
                // Never overwrite an already established timer with a rough estimate
                if (!pollInstance.startTimestamp || (meta.isExact && !pollInstance.isExactStartTime)) {
                  pollInstance.startTimestamp = meta.startTime;
                  if (meta.isExact) pollInstance.isExactStartTime = true;
                }
              }
              if (meta.viewers !== null && meta.viewers !== undefined) pollInstance.viewers = meta.viewers;
              if (meta.likes !== null && meta.likes !== undefined) pollInstance.likes = meta.likes;
              if (meta.isShorts) pollInstance.isShorts = true;
            }
            if (!pollInstance.startTimestamp || !pollInstance.isShorts) {
              try {
                const pMeta = await this.fetchPlayerMetadata(pollInstance.videoId, pollInstance.apiKey);
                if (pMeta) {
                  if (pMeta.startTime && !pollInstance.startTimestamp) {
                    pollInstance.startTimestamp = pMeta.startTime;
                    pollInstance.isExactStartTime = !!pMeta.isExact;
                  }
                  if (pMeta.isShorts) pollInstance.isShorts = true;
                  if (pMeta.viewers && pollInstance.viewers === null) pollInstance.viewers = pMeta.viewers;
                }
              } catch (e) {}
            }

            this.onStatus(pollKey, 'connected', { 
              startTime: pollInstance.startTimestamp,
              isExact: pollInstance.isExactStartTime,
              viewers: pollInstance.viewers,
              likes: pollInstance.likes,
              isShorts: pollInstance.isShorts,
              displayName: pollInstance.displayName || pollInstance.trimmedName.replace('@', '')
            });
          }
        } catch (e) {}
      }, 15000);

    } catch (err) {
      console.error(`Failed to join YouTube stream "${trimmedName}":`, err);
      this.onStatus(pollKey, 'disconnected');
    }
  }

  leave(channelName) {
    const pollKey = channelName.toLowerCase().replace('@', '').trim();
    const poll = this.activePolls.get(pollKey);
    if (poll) {
      if (poll.timeoutId) clearTimeout(poll.timeoutId);
      if (poll.viewerIntervalId) clearInterval(poll.viewerIntervalId);
      this.activePolls.delete(pollKey);
      this.onStatus(pollKey, 'disconnected');
      console.log(`Stopped polling YouTube channel: ${pollKey}`);
    }
  }

  disconnect() {
    this.activePolls.forEach(poll => {
      if (poll.timeoutId) clearTimeout(poll.timeoutId);
      if (poll.viewerIntervalId) clearInterval(poll.viewerIntervalId);
    });
    this.activePolls.clear();
  }

  async pollChat(channelName) {
    const pollKey = (channelName || '').toLowerCase().replace('@', '').trim();
    const poll = this.activePolls.get(pollKey) || this.activePolls.get(channelName);
    if (!poll || !poll.apiKey || !poll.continuationToken) return;
    if (poll.isPolling) return; // Prevent concurrent requests for same token
    poll.isPolling = true;

    try {
      const endpoint = `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${poll.apiKey}`;
      const payload = {
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: poll.clientVersion || '2.20240404.01.00'
          }
        },
        continuation: poll.continuationToken
      };

      // 1. Try local proxy first for the POST request
      let response;
      try {
        const localEndpoint = `/ytproxy/get_chat?key=${poll.apiKey}`;
        response = await fetch(localEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error(`Local proxy responded with status ${response.status}`);
        }
      } catch (err) {
        // 1b. Fallback to secondary query proxy
        try {
          const queryEndpoint = `/api/youtube/proxy?url=${encodeURIComponent(endpoint)}&channel=${encodeURIComponent(pollKey)}`;
          response = await fetch(queryEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          if (!response.ok) {
            throw new Error(`Query proxy responded with status ${response.status}`);
          }
        } catch (err2) {
          // 2. Fall back to public CORS proxy
          try {
            const publicProxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(endpoint)}`;
            response = await fetch(publicProxyUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            });
            if (!response.ok) {
              throw new Error(`Public proxy responded with status ${response.status}`);
            }
          } catch (e3) {
            poll.retryCount = (poll.retryCount || 0) + 1;
            return;
          }
        }
      }

      const data = await response.json();
      poll.retryCount = 0; // reset on success
      
      let nextToken = null;
      const contents = data.continuationContents;
      if (contents && contents.liveChatContinuation) {
        const liveChatCont = contents.liveChatContinuation;
        
        if (liveChatCont.continuations && liveChatCont.continuations[0]) {
          const contData = liveChatCont.continuations[0];
          if (contData.liveChatReplayContinuationData) {
            console.log(`YouTube client: stream ${channelName} has ended (switched to replay). Transitioning to offline.`);
            this.onStatus(channelName, 'offline');
            this.leave(channelName);
            this.setupOfflinePoll(channelName, poll.chatMode);
            return;
          }
          nextToken = contData.timedContinuationData?.continuation ||
                      contData.invalidationContinuationData?.continuation;
        }

        // Parse active Super Chat ticker items to record stream top donors
        if (liveChatCont.ticker?.liveChatTickerRenderer?.items && poll.recordDonation) {
          liveChatCont.ticker.liveChatTickerRenderer.items.forEach(tickerItem => {
            const tr = tickerItem.liveChatTickerPaidMessageItemRenderer ||
                       tickerItem.liveChatTickerPaidStickerItemRenderer ||
                       tickerItem.liveChatTickerSponsorItemRenderer;
            if (tr) {
              const userKey = tr.authorName?.simpleText || tr.authorExternalChannelId;
              const amtStr = tr.amount?.simpleText || tr.purchaseAmountText?.simpleText || '';
              const amt = parseFloat(String(amtStr).replace(/[^\d.]/g, ''));
              if (userKey && !isNaN(amt) && amt > 0) {
                poll.recordDonation(userKey, amt);
                if (tr.authorExternalChannelId) poll.recordDonation(tr.authorExternalChannelId, amt);
              }
            }
          });
        }

        if (liveChatCont.actions) {
          liveChatCont.actions.forEach(action => {
            // 1. Process normal chat item
            let item = action.addChatItemAction?.item;

            // 2. Process ticker Super Chat / Super Sticker item
            if (!item && action.addLiveChatTickerItemAction?.item) {
              const tickerItem = action.addLiveChatTickerItemAction.item;
              const tickerRenderer = tickerItem.liveChatTickerPaidMessageItemRenderer ||
                                     tickerItem.liveChatTickerPaidStickerItemRenderer ||
                                     tickerItem.liveChatTickerSponsorItemRenderer;
              if (tickerRenderer?.showItemEndpoint?.showLiveChatItemEndpoint?.renderer) {
                item = tickerRenderer.showItemEndpoint.showLiveChatItemEndpoint.renderer;
              }
            }

            // 3. Process live banner
            if (!item && action.addBannerRenderer?.bannerRenderer?.liveChatBannerRenderer?.contents) {
              item = action.addBannerRenderer.bannerRenderer.liveChatBannerRenderer.contents;
            }

            if (item) {
              const renderer = item.liveChatTextMessageRenderer || 
                              item.liveChatPaidMessageRenderer || 
                              item.liveChatMembershipItemRenderer ||
                              item.liveChatPaidStickerRenderer ||
                              item.liveChatGiftMembershipReceivedRenderer ||
                              item.liveChatMembershipGiftRedeemedRenderer ||
                              item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer ||
                              item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer;
              if (renderer && renderer.id) {
                if (poll.seenIds.has(renderer.id)) return;
                poll.seenIds.add(renderer.id);
                // Cap seenIds to prevent memory leaks
                if (poll.seenIds.size > 500) {
                  const iter = poll.seenIds.values();
                  for (let i = 0; i < 200; i++) iter.next();
                  const remaining = new Set();
                  for (const val of iter) remaining.add(val);
                  poll.seenIds = remaining;
                }
              }
            }
            this.parseChatAction(channelName, action);

            // Handle YouTube message deletion actions
            const markDeleted = action.markChatItemAsDeletedAction;
            const removeDeleted = action.removeChatItemAction;
            const authorMarkDeleted = action.markChatItemsByAuthorAsDeletedAction;
            const authorRemoveDeleted = action.removeChatItemsByAuthorAction;

            let deletedBy = null;
            if (markDeleted && markDeleted.deletedStateMessageSnippet) {
              const snippet = markDeleted.deletedStateMessageSnippet;
              if (Array.isArray(snippet.runs)) {
                for (const r of snippet.runs) {
                  if (r && r.text) {
                    const cleanText = r.text.trim();
                    if (cleanText.startsWith('@')) {
                      deletedBy = cleanText.replace(/^@+/, '');
                      break;
                    }
                  }
                }
                if (!deletedBy) {
                  const combined = snippet.runs.map(r => r.text || '').join('');
                  const m = combined.match(/deleted by\s+@?([^\s.]+)/i);
                  if (m && m[1]) deletedBy = m[1].replace(/^@+/, '').trim();
                }
              } else if (typeof snippet.simpleText === 'string') {
                const m = snippet.simpleText.match(/deleted by\s+@?([^\s.]+)/i);
                if (m && m[1]) deletedBy = m[1].replace(/^@+/, '').trim();
              }
            }

            if (markDeleted && markDeleted.targetItemId) {
              const targetId = markDeleted.targetItemId;
              if (this.onMessageDeleted) {
                this.onMessageDeleted(targetId, null, deletedBy);
              }
            } else if (removeDeleted && removeDeleted.targetItemId) {
              const targetId = removeDeleted.targetItemId;
              if (this.onMessageDeleted) {
                this.onMessageDeleted(targetId, null, null);
              }
            } else if (authorMarkDeleted && authorMarkDeleted.externalChannelId) {
              const authorId = authorMarkDeleted.externalChannelId;
              if (this.onMessageDeleted) {
                this.onMessageDeleted(null, authorId, deletedBy);
              }
            } else if (authorRemoveDeleted && authorRemoveDeleted.externalChannelId) {
              const authorId = authorRemoveDeleted.externalChannelId;
              if (this.onMessageDeleted) {
                this.onMessageDeleted(null, authorId, null);
              }
            }
          });
        }
      }

      if (nextToken) {
        poll.continuationToken = nextToken;
      }

    } catch (e) {
      console.error(`Error polling YouTube chat for ${channelName}:`, e);
    } finally {
      poll.isPolling = false;
    }
  }

  convertYoutubeColor(num) {
    if (!num) return null;
    const hex = (num >>> 0).toString(16).padStart(8, '0');
    const a = parseInt(hex.substring(0, 2), 16) / 255;
    const r = parseInt(hex.substring(2, 4), 16);
    const g = parseInt(hex.substring(4, 6), 16);
    const b = parseInt(hex.substring(6, 8), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  parseChatAction(channelName, action) {
    try {
      const item = action.addChatItemAction?.item;
      if (!item) return;

      let renderer = null;
      let isSystemEvent = false;
      let eventType = ''; // 'donation' | 'subscription'
      let eventDetails = {};
      let text = '';
      const parts = [];

      if (item.liveChatTextMessageRenderer) {
        renderer = item.liveChatTextMessageRenderer;
      } else if (item.liveChatPaidMessageRenderer) {
        renderer = item.liveChatPaidMessageRenderer;
        isSystemEvent = true;
        eventType = 'donation';
        eventDetails = {
          amount: renderer.purchaseAmountText?.simpleText || '$0.00',
          headerBg: this.convertYoutubeColor(renderer.headerBackgroundColor) || '#e62117',
          bodyBg: this.convertYoutubeColor(renderer.bodyBackgroundColor) || '#f44336',
          authorTextColor: this.convertYoutubeColor(renderer.authorNameTextColor) || '#ffffff',
          contentTextColor: this.convertYoutubeColor(renderer.contentTextColor) || '#ffffff'
        };
      } else if (item.liveChatMembershipItemRenderer) {
        renderer = item.liveChatMembershipItemRenderer;
        isSystemEvent = true;
        eventType = 'subscription';
        
        let headerText = '';
        if (renderer.headerText?.runs) {
          renderer.headerText.runs.forEach(run => { headerText += run.text || ''; });
        } else if (renderer.headerText?.simpleText) {
          headerText = renderer.headerText.simpleText;
        }

        let subtextText = '';
        if (renderer.headerSubtext) {
          if (renderer.headerSubtext.simpleText) {
            subtextText = renderer.headerSubtext.simpleText;
          } else if (renderer.headerSubtext.runs) {
            renderer.headerSubtext.runs.forEach(run => { subtextText += run.text || ''; });
          }
        }

        // Check if this is a renewal milestone (e.g. "Member for 5 months") or a new member
        const combinedHeader = `${headerText} ${subtextText}`.trim();
        const monthMatch = combinedHeader.match(/Member for\s+([0-9]+\s*(?:months?|years?|days?|weeks?))/i) ||
                           subtextText.match(/([0-9]+\s*(?:months?|years?|days?|weeks?))/i);
        const isMilestone = !!monthMatch || /Member for/i.test(combinedHeader) || (!!renderer.message && !/Welcome to/i.test(combinedHeader));
        const durationText = monthMatch ? monthMatch[1] : (subtextText || '');

        let userCustomMessage = '';
        if (renderer.message?.runs) {
          renderer.message.runs.forEach(r => { userCustomMessage += r.text || ''; });
        } else if (renderer.message?.simpleText) {
          userCustomMessage = renderer.message.simpleText;
        }

        eventDetails = {
          subType: isMilestone ? 'milestone' : 'new_member',
          months: monthMatch ? monthMatch[1] : null,
          tier: isMilestone ? (durationText ? `Member for ${durationText}` : (subtextText || 'Member')) : (subtextText || headerText || 'Member'),
          milestoneText: isMilestone ? (combinedHeader.includes('Member for') ? combinedHeader : `Member for ${durationText}`) : null,
          hasUserMessage: !!userCustomMessage,
          userMessage: userCustomMessage,
          headerBg: this.convertYoutubeColor(renderer.headerBackgroundColor) || '#0f9d58',
          bodyBg: this.convertYoutubeColor(renderer.bodyBackgroundColor) || '#0b8043',
          authorTextColor: this.convertYoutubeColor(renderer.authorNameTextColor) || '#ffffff'
        };

        if (isMilestone) {
          text = userCustomMessage || eventDetails.milestoneText || 'Membership Milestone!';
        } else {
          text = headerText || subtextText || 'Joined Channel Membership!';
        }
      } else if (item.liveChatPaidStickerRenderer) {
        renderer = item.liveChatPaidStickerRenderer;
        isSystemEvent = true;
        eventType = 'donation';
        let stickerUrl = normalizeUrl(renderer.sticker?.thumbnails?.[0]?.url);
        eventDetails = {
          amount: renderer.purchaseAmountText?.simpleText || '$0.00',
          stickerUrl: stickerUrl,
          headerBg: this.convertYoutubeColor(renderer.backgroundColor) || '#e62117',
          bodyBg: this.convertYoutubeColor(renderer.backgroundColor) || '#f44336',
          authorTextColor: this.convertYoutubeColor(renderer.authorNameTextColor) || '#ffffff',
          contentTextColor: '#ffffff'
        };
        text = `Sent a Super Sticker: ${eventDetails.amount}`;
        parts.push({
          type: 'text',
          content: text
        });
      } else if (item.liveChatGiftMembershipReceivedRenderer) {
        renderer = item.liveChatGiftMembershipReceivedRenderer;
        isSystemEvent = true;
        eventType = 'subscription';
        
        let headerText = '';
        if (renderer.giftHeader && renderer.giftHeader.runs) {
          renderer.giftHeader.runs.forEach(run => { headerText += run.text || ''; });
        }
        text = headerText || 'Gifted memberships!';
        parts.push({
          type: 'text',
          content: text
        });
        
        eventDetails = {
          subType: 'gift_redemption',
          tier: 'Membership Gift',
          headerBg: '#0f9d58',
          bodyBg: '#0b8043',
          authorTextColor: '#ffffff'
        };
      } else if (item.liveChatMembershipGiftRedeemedRenderer) {
        renderer = item.liveChatMembershipGiftRedeemedRenderer;
        isSystemEvent = true;
        eventType = 'subscription';
        
        let headerText = '';
        if (renderer.giftHeader && renderer.giftHeader.runs) {
          renderer.giftHeader.runs.forEach(run => { headerText += run.text || ''; });
        }
        text = headerText || 'Redeemed a membership gift!';
        parts.push({
          type: 'text',
          content: text
        });
        
        eventDetails = {
          subType: 'gift_redemption',
          tier: 'Membership Gift',
          headerBg: '#0f9d58',
          bodyBg: '#0b8043',
          authorTextColor: '#ffffff'
        };
      } else if (item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer) {
        renderer = item.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer;
        isSystemEvent = true;
        eventType = 'subscription';
        
        const header = renderer.header?.liveChatSponsorshipsHeaderRenderer;
        let headerText = '';
        if (header?.primaryText?.runs) {
          header.primaryText.runs.forEach(r => { headerText += r.text || ''; });
        }
        text = headerText || 'Gifted memberships!';
        parts.push({
          type: 'text',
          content: text
        });
        
        eventDetails = {
          subType: 'gift_purchase',
          tier: 'Membership Gift',
          headerBg: '#0f9d58',
          bodyBg: '#0b8043',
          authorTextColor: '#ffffff'
        };
      } else if (item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer) {
        renderer = item.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer;
        isSystemEvent = true;
        eventType = 'subscription';
        
        let headerText = '';
        if (renderer.message?.runs) {
          renderer.message.runs.forEach(r => { headerText += r.text || ''; });
        }
        text = headerText || 'Accepted membership gift!';
        parts.push({
          type: 'text',
          content: text
        });
        
        eventDetails = {
          subType: 'gift_redemption',
          tier: 'Membership Gift',
          headerBg: '#0f9d58',
          bodyBg: '#0b8043',
          authorTextColor: '#ffffff'
        };
      } else if (item.liveChatPaidGiftRenderer || 
                 item.liveChatGiftRenderer || 
                 item.liveChatGiftPurchaseRenderer || 
                 item.liveChatJewelsGiftRenderer) {
        renderer = item.liveChatPaidGiftRenderer || 
                   item.liveChatGiftRenderer || 
                   item.liveChatGiftPurchaseRenderer || 
                   item.liveChatJewelsGiftRenderer;
        isSystemEvent = true;
        eventType = 'gift';
      }

      if (!renderer) return;

      // Extract message content and build parts array
      const runs = renderer.message?.runs || 
                   renderer.headerText?.runs || 
                   renderer.primaryText?.runs || 
                   renderer.title?.runs || 
                   renderer.giftText?.runs || [];

      if (parts.length === 0) {
        runs.forEach(run => {
          if (run.text) {
            if (!text || !text.includes(run.text)) {
              text += (text ? ' ' : '') + run.text;
            }
            parts.push({
              type: 'text',
              content: run.text
            });
          } else if (run.emoji || run.image || run.sticker || run.thumbnail) {
            const emojiObj = run.emoji || run.image || run.sticker || run.thumbnail || {};
            const name = emojiObj.shortcuts?.[0] || emojiObj.emojiId || emojiObj.name || 'gift';
            const thumbs = emojiObj.image?.thumbnails || emojiObj.thumbnails || [];
            let url = null;
            if (thumbs.length > 0) {
              url = normalizeUrl(thumbs[thumbs.length - 1]?.url || thumbs[0]?.url);
            }
            text += ` ${name} `;
            parts.push({
              type: 'emote',
              name: name,
              url: url
            });
          }
        });
      }

      // If no text in runs, check content / simpleText fields
      if (!text && renderer.text?.content) {
        text = renderer.text.content;
        parts.push({ type: 'text', content: text });
      } else if (!text && renderer.message?.simpleText) {
        text = renderer.message.simpleText;
        parts.push({ type: 'text', content: text });
      } else if (!text && renderer.headerText?.simpleText) {
        text = renderer.headerText.simpleText;
        parts.push({ type: 'text', content: text });
      } else if (!text && renderer.primaryText?.simpleText) {
        text = renderer.primaryText.simpleText;
        parts.push({ type: 'text', content: text });
      }

      // Check for Gift / Jewels item and images strictly on real gift events
      let isGift = false;
      let giftDetails = null;
      const isExplicitGift = eventType === 'gift' || 
                             !!item.liveChatJewelsGiftRenderer || 
                             !!item.liveChatPaidGiftRenderer || 
                             !!item.liveChatGiftPurchaseRenderer ||
                             !!renderer.gift || 
                             !!renderer.jewels || 
                             !!renderer.jewelsAmount;

      if (isExplicitGift) {
        isGift = true;
        const giftThumbs = renderer.sticker?.thumbnails || 
                           renderer.gift?.thumbnails || 
                           renderer.giftThumbnail?.thumbnails || 
                           renderer.giftImage?.thumbnails || 
                           renderer.giftImage?.sources || 
                           renderer.image?.thumbnails || [];
        let giftImageUrl = giftThumbs.length > 0 ? normalizeUrl(giftThumbs[giftThumbs.length - 1]?.url || giftThumbs[0]?.url) : null;

        let giftName = renderer.gift?.name || renderer.giftName || renderer.title || 'Gift';
        if (typeof giftName !== 'string' || !giftName) giftName = 'Gift';

        if (giftImageUrl && !parts.some(p => p.type === 'emote' && p.url === giftImageUrl)) {
          parts.push({
            type: 'emote',
            name: giftName || 'gift',
            url: giftImageUrl
          });
        }

        let jewels = null;
        if (renderer.purchaseAmountText?.simpleText) {
          const m = renderer.purchaseAmountText.simpleText.match(/(\d+)/);
          if (m) jewels = m[1];
        } else if (renderer.jewelsAmount || renderer.jewels || renderer.jewelAmount || renderer.rubies) {
          jewels = String(renderer.jewelsAmount || renderer.jewels || renderer.jewelAmount || renderer.rubies);
        } else if (giftName) {
          const cleanKey = giftName.toLowerCase().replace(/\.+$/, '').trim();
          if (YOUTUBE_GIFT_JEWELS_MAP[cleanKey]) {
            jewels = String(YOUTUBE_GIFT_JEWELS_MAP[cleanKey]);
          } else if (YOUTUBE_GIFT_JEWELS_MAP[giftName.toLowerCase().trim()]) {
            jewels = String(YOUTUBE_GIFT_JEWELS_MAP[giftName.toLowerCase().trim()]);
          }
        }

        if (!jewels) jewels = '10';

        giftDetails = {
          name: giftName,
          jewels: jewels,
          imageUrl: giftImageUrl
        };

        if (!text) {
          text = `sent ${giftName}`;
          parts.push({ type: 'text', content: text });
        }
      }

      // Check text for sent gifts (e.g. "@heliqx sent Star")
      if (!isGift && text) {
        const giftMatch = text.match(/sent\s+([A-Za-z0-9_.\s]+)/i);
        if (giftMatch) {
          const rawGiftName = giftMatch[1].replace(/[:*]/g, '').trim();
          const cleanKey = rawGiftName.toLowerCase().replace(/\.+$/, '').trim();
          if (YOUTUBE_GIFT_JEWELS_MAP[cleanKey] || YOUTUBE_GIFT_JEWELS_MAP[rawGiftName.toLowerCase()]) {
            isGift = true;
            const jewels = String(YOUTUBE_GIFT_JEWELS_MAP[cleanKey] || YOUTUBE_GIFT_JEWELS_MAP[rawGiftName.toLowerCase()] || 10);
            const emotePart = parts.find(p => p.type === 'emote');
            giftDetails = {
              name: rawGiftName,
              jewels: jewels,
              imageUrl: emotePart?.url || null
            };
          }
        }
      }

      if (isSystemEvent && eventType === 'subscription' && !renderer.message) {
        text = text || (eventDetails?.tier || 'Joined Channel Membership!');
        if (parts.length === 0) {
          parts.push({
            type: 'text',
            content: text
          });
        }
      }

      const authorChannelId = renderer.authorExternalChannelId || null;
      const rawHandle = renderer.authorName?.simpleText || 'anon';
      const username = rawHandle.toLowerCase().replace(/\s+/g, '');

      let displayName = rawHandle;
      if (authorChannelId && YOUTUBE_NAME_CACHE.has(authorChannelId)) {
        displayName = YOUTUBE_NAME_CACHE.get(authorChannelId);
      }



      // Determine badges and badge image URLs
      const badges = [];
      const badgeImages = {};
      if (isSystemEvent) {
        if (eventType === 'donation') badges.push('donation');
        if (eventType === 'subscription') badges.push('member');
      }
      let youtubeRank = null;

      // Scan all potential badge containers in the renderer
      const allBadgeSources = [
        ...(Array.isArray(renderer.authorBadges) ? renderer.authorBadges : []),
        ...(Array.isArray(renderer.badges) ? renderer.badges : []),
        ...(Array.isArray(renderer.authorNameBadges) ? renderer.authorNameBadges : []),
        ...(renderer.authorNameBadge ? [renderer.authorNameBadge] : []),
        ...(Array.isArray(renderer.rankingBadges) ? renderer.rankingBadges : []),
        ...(Array.isArray(renderer.leaderboardBadges) ? renderer.leaderboardBadges : []),
        ...(Array.isArray(renderer.customBadges) ? renderer.customBadges : []),
        ...(renderer.authorRankingBadge ? [renderer.authorRankingBadge] : []),
        ...(renderer.rankingBadge ? [renderer.rankingBadge] : []),
        ...(renderer.leaderboardBadge ? [renderer.leaderboardBadge] : []),
        ...(renderer.topChatterBadge ? [renderer.topChatterBadge] : []),
        ...(Array.isArray(renderer.beforeContentButtons) ? renderer.beforeContentButtons : []),
        ...(Array.isArray(renderer.afterContentButtons) ? renderer.afterContentButtons : []),
        ...(Array.isArray(renderer.inlineActionButtons) ? renderer.inlineActionButtons : []),
        ...(Array.isArray(renderer.inline_action_buttons) ? renderer.inline_action_buttons : [])
      ];

      // Check whole renderer for direct crown/rank buttons or fields
      const wholeRendererRank = extractRankFromBadge(renderer);
      if (wholeRendererRank && wholeRendererRank >= 1 && wholeRendererRank <= 3) {
        youtubeRank = wholeRendererRank;
        if (!badges.includes(`rank_${wholeRendererRank}`)) badges.push(`rank_${wholeRendererRank}`);
      }

      if (allBadgeSources.length > 0) {
        allBadgeSources.forEach(b => {
          if (!b) return;
          const badgeRenderer = b.liveChatAuthorBadgeRenderer || 
                                b.liveChatLeaderboardBadgeRenderer || 
                                b.liveChatContributorBadgeRenderer || 
                                b.liveChatRankingBadgeRenderer || 
                                b.authorBadgeRenderer || 
                                b;

          const rawJson = JSON.stringify(b);
          const rawLower = rawJson.toLowerCase();
          const tooltip = String(
            badgeRenderer.tooltip || 
            badgeRenderer.accessibility?.accessibilityData?.label || 
            badgeRenderer.customThumbnail?.accessibility?.accessibilityData?.label ||
            badgeRenderer.label ||
            badgeRenderer.icon?.iconType ||
            ''
          ).trim();
          const tooltipLower = tooltip.toLowerCase();
          const iconType = String(badgeRenderer.icon?.iconType || '').toUpperCase();
          const thumbs = badgeRenderer.customThumbnail?.thumbnails || [];
          let iconUrl = null;
          if (thumbs.length > 0) {
            iconUrl = normalizeUrl(thumbs[thumbs.length - 1]?.url || thumbs[0]?.url);
          }
          const lowerUrl = (iconUrl || '').toLowerCase();

          // 1. Standard badges
          if (tooltipLower.includes('moderator') || rawLower.includes('"moderator"') || iconType === 'MODERATOR') {
            if (!badges.includes('moderator')) badges.push('moderator');
            if (iconUrl) badgeImages['moderator'] = iconUrl;
          } else if (tooltipLower.includes('owner') || tooltipLower.includes('broadcaster') || iconType === 'OWNER' || rawLower.includes('"owner"')) {
            if (!badges.includes('broadcaster')) badges.push('broadcaster');
            if (iconUrl) badgeImages['broadcaster'] = iconUrl;
          } else if (tooltipLower.includes('verified') || iconType === 'VERIFIED' || rawLower.includes('"verified"')) {
            if (!badges.includes('verified')) badges.push('verified');
            if (iconUrl) badgeImages['verified'] = iconUrl;
          }

          // 2. Check if this badge is a Top Contributor / Leaderboard Rank (#1, #2, #3)
          const rankNum = extractRankFromBadge(b);
          if (rankNum && rankNum >= 1 && rankNum <= 3) {
            youtubeRank = rankNum;
            if (!badges.includes(`rank_${rankNum}`)) badges.push(`rank_${rankNum}`);
          } else if (
            tooltipLower.includes('member') || 
            tooltipLower.includes('sponsor') || 
            tooltipLower.includes('subscriber') || 
            tooltipLower.includes('month') || 
            tooltipLower.includes('year') ||
            tooltipLower.includes('सदस्य') ||
            (badgeRenderer.customThumbnail && !iconType && !rankNum)
          ) {
            if (!badges.includes('member')) badges.push('member');
            if (iconUrl) badgeImages['member'] = iconUrl;
          }
        });
      }

      // Check direct renderer rank fields if not found in badges
      if (!youtubeRank) {
        const directRank = renderer.authorRank || renderer.youtubeRank || renderer.topChatterRank || renderer.leaderboardRank || renderer.topFanRank || (renderer.isTopContributor ? 1 : null);
        if (directRank && directRank >= 1 && directRank <= 3) {
          youtubeRank = directRank;
          badges.push(`rank_${directRank}`);
        }
      }

      const pollKey = (channelName || '').toLowerCase().replace('@', '').trim();
      const poll = this.activePolls.get(pollKey) || this.activePolls.get(channelName);
      const isShorts = poll ? poll.isShorts : false;

      // Check if user has a rank recorded in the active poll
      if (!youtubeRank && poll && poll.getRankForUser) {
        const userKeys = [authorChannelId, username, displayName].filter(Boolean);
        const pollRank = poll.getRankForUser(userKeys);
        if (pollRank && pollRank >= 1 && pollRank <= 3) {
          youtubeRank = pollRank;
          badges.push(`rank_${pollRank}`);
        }
      }

      // If youtubeRank was found, record it in poll so subsequent messages dynamically track this slot
      if (youtubeRank && poll && poll.recordExplicitRank) {
        const userKeys = [authorChannelId, username, displayName].filter(Boolean);
        poll.recordExplicitRank(userKeys, youtubeRank);
      }

      // Check if user is a bot
      const lowerUser = username.toLowerCase();
      const knownBots = ['nightbot', 'streamelements', 'wizebot', 'moobot', 'kickbot', 'botrix', 'botrixoficial', 'botrixofficial', 'streamlabs', 'fossabot', 'soundalerts', 'kbot'];
      if (knownBots.includes(lowerUser) || (lowerUser.endsWith('bot') && lowerUser.length > 3)) {
        badges.push('bot');
      }

      const color = this.getRandomColor(username);
      // Use highest-quality thumbnail (last in array is largest) upgraded to 1280px
      const photoThumbnails = renderer.authorPhoto?.thumbnails;
      let avatar = photoThumbnails && photoThumbnails.length > 0 
        ? normalizeUrl(photoThumbnails[photoThumbnails.length - 1].url) 
        : null;
      if (avatar && typeof avatar === 'string' && (avatar.includes('googleusercontent.com') || avatar.includes('ggpht.com') || avatar.includes('youtube.com') || avatar.includes('ytimg.com'))) {
        if (/=s\d+/.test(avatar)) {
          avatar = avatar.replace(/=s\d+/, '=s1280');
        } else if (!avatar.includes('=')) {
          avatar = `${avatar}=s1280`;
        }
      }

      let deleteParams = null;
      let timeoutParams = null;
      let banParams = null;
      const actionButtons = renderer.inline_action_buttons || renderer.inlineActionButtons || [];
      if (Array.isArray(actionButtons)) {
        for (const b of actionButtons) {
          const btnData = b.buttonRenderer || b;
          const label = (btnData.text?.runs?.[0]?.text || btnData.tooltip || btnData.icon?.iconType || btnData.icon_type || btnData.label || '').toLowerCase();
          const iconType = (btnData.icon_type || btnData.iconType || btnData.icon?.iconType || '').toLowerCase();
          const endpoint = btnData?.serviceEndpoint || btnData?.endpoint;
          const params = endpoint?.payload?.params || endpoint?.moderateLiveChatEndpoint?.params || null;

          if (label.includes('remove') || label.includes('delete') || iconType.includes('delete')) {
            deleteParams = params;
          } else if (label.includes('timeout') || label.includes('hourglass') || iconType.includes('hourglass')) {
            timeoutParams = params;
          } else if (label.includes('hide') || label.includes('ban') || label.includes('remove_circle') || iconType.includes('remove_circle')) {
            banParams = params;
          }
        }
      }

      const menuEndpoint = renderer.menu_endpoint || renderer.menuEndpoint || renderer.contextMenuEndpoint;
      const menuParams = menuEndpoint?.payload?.params ||
                         menuEndpoint?.liveChatItemContextMenuEndpoint?.params ||
                         menuEndpoint?.contextMenuEndpoint?.params ||
                         menuEndpoint?.params ||
                         (typeof menuEndpoint === 'string' ? menuEndpoint : null);

      const parsedMsg = {
        id: renderer.id || Math.random().toString(36).substring(2, 11),
        platform: 'youtube',
        isShorts: isShorts,
        videoId: poll ? poll.videoId : null,
        liveChatId: poll ? poll.liveChatId : null,
        deleteParams: deleteParams,
        timeoutParams: timeoutParams,
        banParams: banParams,
        menuParams: menuParams,
        channel: channelName.toLowerCase(),
        username: username,
        displayName: displayName,
        channelId: authorChannelId,
        authorChannelId: authorChannelId,
        authorExternalChannelId: authorChannelId,
        color: color,
        text: text.trim(),
        parts: parts,
        avatar: avatar,
        badges: Array.from(new Set(badges)),
        badgeImages: badgeImages,
        youtubeRank: youtubeRank,
        isGift: isGift,
        giftDetails: giftDetails,
        isSystemEvent,
        eventType,
        eventDetails,
        rawTimestamp: (() => {
          if (renderer.timestampUsec) {
            const usec = parseInt(renderer.timestampUsec, 10);
            if (!isNaN(usec) && usec > 0) return Math.floor(usec / 1000);
          }
          return Date.now();
        })(),
        timestamp: (() => {
          if (renderer.timestampUsec) {
            const usec = parseInt(renderer.timestampUsec, 10);
            if (!isNaN(usec) && usec > 0) {
              return new Date(Math.floor(usec / 1000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            }
          }
          return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        })(),
        youtubeChatMode: poll ? poll.chatMode : 'live'
      };

      if (authorChannelId && !YOUTUBE_NAME_CACHE.has(authorChannelId)) {
        this.resolveChannelName(authorChannelId).then(realName => {
          if (realName) {
            parsedMsg.displayName = realName;
            if (this.onNameResolved) {
              this.onNameResolved(authorChannelId, realName);
            }
          }
        });
      }

      this.onMessage(parsedMsg);

    } catch (err) {
      console.error('Error parsing YouTube chat item:', err, action);
    }
  }

  getRandomColor(username) {
    const colors = [
      '#FF0000', '#FF4500', '#FF6347', '#FF7F50',
      '#DAA520', '#B22222', '#D2691E', '#CD5C5C'
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  }
}

function normalizeUrl(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return 'https:' + trimmed;
  }
  return 'https://' + trimmed;
}

export function extractRankFromBadge(b) {
  if (!b) return null;
  const badgeRenderer = b.liveChatAuthorBadgeRenderer || 
                        b.liveChatLeaderboardBadgeRenderer || 
                        b.liveChatContributorBadgeRenderer || 
                        b.liveChatRankingBadgeRenderer || 
                        b.liveChatTopChatterBadgeRenderer ||
                        b.authorBadgeRenderer || 
                        b.authorRankingBadgeRenderer ||
                        b.buttonViewModel ||
                        b.buttonRenderer ||
                        b;

  const rawJson = JSON.stringify(b);
  const rawLower = rawJson.toLowerCase();

  const tooltip = String(
    badgeRenderer.title ||
    badgeRenderer.accessibilityText ||
    badgeRenderer.tooltip || 
    badgeRenderer.accessibility?.accessibilityData?.label || 
    badgeRenderer.customThumbnail?.accessibility?.accessibilityData?.label ||
    badgeRenderer.label ||
    badgeRenderer.icon?.iconType ||
    badgeRenderer.iconName ||
    ''
  ).trim();
  const tooltipLower = tooltip.toLowerCase();

  const iconType = String(badgeRenderer.icon?.iconType || badgeRenderer.iconName || '').toUpperCase();
  const thumbs = badgeRenderer.customThumbnail?.thumbnails || [];
  const iconUrl = (thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || '').toLowerCase();

  // If this is clearly a moderator, owner, or verified badge, return null unless it explicitly has a crown/rank
  if (
    (tooltipLower.includes('moderator') || iconType === 'MODERATOR' || 
    tooltipLower.includes('owner') || iconType === 'OWNER' || 
    tooltipLower.includes('verified') || iconType === 'VERIFIED') &&
    !iconType.includes('CROWN') && !tooltipLower.includes('#')
  ) {
    return null;
  }

  // If it's a member duration tooltip like "Member (2 months)" or "Member for 2 years", it is NOT a leaderboard rank
  if (
    tooltipLower.includes('month') || 
    tooltipLower.includes('year') || 
    tooltipLower.includes('member (') || 
    tooltipLower.includes('member for') ||
    tooltipLower.includes('subscribed for') ||
    tooltipLower.includes('सदस्य (')
  ) {
    return null;
  }

  // 1. Icon type check
  if (iconType.includes('LEADERBOARD_1') || iconType.includes('RANK_1') || iconType.includes('SUPER_CHAT_1')) return 1;
  if (iconType.includes('LEADERBOARD_2') || iconType.includes('RANK_2') || iconType.includes('SUPER_CHAT_2')) return 2;
  if (iconType.includes('LEADERBOARD_3') || iconType.includes('RANK_3') || iconType.includes('SUPER_CHAT_3')) return 3;

  // 2. Exact string match on tooltip or label: "#1", "#2", "#3", "1", "2", "3", "1st", "2nd", "3rd"
  if (/^#?\s*1(?:\s*st)?$/i.test(tooltip)) return 1;
  if (/^#?\s*2(?:\s*nd)?$/i.test(tooltip)) return 2;
  if (/^#?\s*3(?:\s*rd)?$/i.test(tooltip)) return 3;

  // 3. Regex match in tooltip or label (English, Hindi, Russian, Spanish, French, etc.)
  const rankRegex = /(?:#|№|n\.º|nº|rank\s*|top\s*(?:fan|contributor|giver|member|chatter)?\s*#?|शीर्ष\s*|योगदानकर्ता\s*#?|रैंक\s*)\s*([1-3])\b/i;
  const match = tooltip.match(rankRegex) || rawLower.match(/(?:"tooltip"|"label"|"title"|"accessibilitytext")\s*:\s*"[^"]*?(?:#|№|n\.º|rank|top|शीर्ष|रैंक)[^\d]*?([1-3])\b/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }

  // 4. Check if icon/url/json mentions crown or leaderboard or top contributor with 1..3
  if (iconType.includes('CROWN') || iconType.includes('LEADERBOARD') || iconType.includes('TOP_CHATTER') || iconUrl.includes('crown') || iconUrl.includes('top_fan') || rawLower.includes('crown') || rawLower.includes('leaderboard')) {
    const numM = tooltip.match(/([1-3])/) || iconUrl.match(/([1-3])/) || rawLower.match(/([1-3])/);
    if (numM) return parseInt(numM[1], 10);
  }

  // 5. Check raw json for "#1", "#2", "#3"
  if (rawLower.includes('"#1"') || rawLower.includes('"# 1"') || rawLower.includes('top contributor #1') || rawLower.includes('top fan #1') || rawLower.includes('leaderboard #1')) return 1;
  if (rawLower.includes('"#2"') || rawLower.includes('"# 2"') || rawLower.includes('top contributor #2') || rawLower.includes('top fan #2') || rawLower.includes('leaderboard #2')) return 2;
  if (rawLower.includes('"#3"') || rawLower.includes('"# 3"') || rawLower.includes('top contributor #3') || rawLower.includes('top fan #3') || rawLower.includes('leaderboard #3')) return 3;

  return null;
}

/**
 * Computes dynamic exclusive YouTube Top #1, #2, #3 Contributor / Leaderboard ranks.
 * Strictly mirrors YouTube Live Chat feed:
 * 1. Explicit YouTube badges (authorBadges, rankingBadges, crowns e.g. ARATHI K V #2).
 * 2. Verified Super Chat / Donation Leaderboard.
 * 3. NO synthetic message guessing: Users without a badge on YouTube NEVER get a badge.
 * 4. Broadcasters, moderators, and bots NEVER receive viewer contributor ranks.
 * 5. Strict exclusivity & displacement: at most ONE user holds each rank slot at any moment.
 *    If User A holds #2 and later User B takes #2, User A's #2 rank is removed.
 * Returns a Map of userKey -> rank (1, 2, or 3).
 */
export function calculateYoutubeTop3Ranks(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return new Map();

  const rankSlots = { 1: null, 2: null, 3: null };
  const userDonations = new Map(); // canonicalId -> { total: number, keys: Set<string>, lastTimestamp: number }

  const knownBots = new Set(['nightbot', 'streamelements', 'wizebot', 'moobot', 'kickbot', 'botrix', 'botrixoficial', 'botrixofficial', 'streamlabs', 'fossabot', 'soundalerts', 'kbot']);

  messages.forEach((msg, idx) => {
    if (!msg || msg.platform !== 'youtube') return;

    const isBroadcaster = (msg.badges && (msg.badges.includes('broadcaster') || msg.badges.includes('owner'))) || msg.isOwner || msg.isBroadcaster;
    const isBot = knownBots.has((msg.username || '').toLowerCase()) || (msg.userRole === 'bot');
    if (isBroadcaster || isBot) return;

    const keys = [
      msg.channelId,
      msg.authorChannelId,
      msg.authorExternalChannelId,
      msg.userId,
      msg.username,
      msg.displayName
    ].filter(Boolean).map(k => String(k).toLowerCase().trim());

    if (keys.length === 0) return;
    const canonicalId = (msg.authorChannelId || msg.channelId || msg.username || keys[0]).toLowerCase().trim();
    const timestamp = msg.rawTimestamp || (idx * 1000);

    // 1. Super Chat / Donation Leaderboard
    if (msg.isSystemEvent && msg.eventType === 'donation') {
      const amtStr = msg.eventDetails?.amount || '';
      const amt = parseFloat(String(amtStr).replace(/[^\d.]/g, ''));
      if (!isNaN(amt) && amt > 0) {
        const prev = userDonations.get(canonicalId) || { total: 0, keys: new Set(), lastTimestamp: timestamp };
        prev.total += amt;
        prev.lastTimestamp = Math.max(prev.lastTimestamp, timestamp);
        keys.forEach(k => prev.keys.add(k));
        userDonations.set(canonicalId, prev);
      }
    }

    // 2. Explicit YouTube rank badge
    let rank = (typeof msg.youtubeRank === 'number' && msg.youtubeRank >= 1 && msg.youtubeRank <= 3) 
      ? msg.youtubeRank 
      : null;

    if (!rank && Array.isArray(msg.badges)) {
      if (msg.badges.includes('rank_1')) rank = 1;
      else if (msg.badges.includes('rank_2')) rank = 2;
      else if (msg.badges.includes('rank_3')) rank = 3;
    }

    if (rank && rank >= 1 && rank <= 3) {
      // Vacate any other slot this user was in
      for (let r = 1; r <= 3; r++) {
        if (rankSlots[r] && (rankSlots[r].canonicalId === canonicalId || keys.some(k => rankSlots[r].keys.includes(k)))) {
          rankSlots[r] = null;
        }
      }
      // Assign slot to this user (displaces prior holder of this rank)
      rankSlots[rank] = {
        canonicalId,
        keys,
        timestamp
      };
    }
  });

  const top3Map = new Map();

  // Step 1: If Super Chat donations exist, assign unoccupied slots to top donors
  if (userDonations.size > 0) {
    const sortedDonors = Array.from(userDonations.values())
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return b.lastTimestamp - a.lastTimestamp;
      });

    sortedDonors.slice(0, 3).forEach((donor, idx) => {
      const r = idx + 1;
      // Only assign if rank slot r is not occupied by an explicit YouTube badge
      if (!rankSlots[r]) {
        donor.keys.forEach(k => top3Map.set(k.toLowerCase().trim(), r));
      }
    });
  }

  // Step 2: Explicit ranks strictly populate and override
  for (let r = 1; r <= 3; r++) {
    const slot = rankSlots[r];
    if (slot && slot.keys) {
      // Clear any prior donation holder of rank r
      for (const [k, mappedRank] of Array.from(top3Map.entries())) {
        if (mappedRank === r) {
          top3Map.delete(k);
        }
      }
      slot.keys.forEach(k => {
        top3Map.set(k.toLowerCase().trim(), r);
      });
      if (slot.canonicalId) {
        top3Map.set(slot.canonicalId.toLowerCase().trim(), r);
      }
    }
  }

  return top3Map;
}

