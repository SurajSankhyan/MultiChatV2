// YouTube Live Chat Polling Client using InnerTube API & CORS Proxies

// Global caches to store resolved channel names and handle pending network requests
const YOUTUBE_NAME_CACHE = new Map(); // channelId -> displayName
const PENDING_NAME_RESOLVES = new Map(); // channelId -> Promise<displayName>

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
  async fetchWithProxyFallback(url, timeoutMs = 3500) {
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
    if (url.startsWith('https://www.youtube.com')) {
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
        console.warn('Local proxy fetch failed, trying query proxy:', err.message);
      }

      // 1b. Try dedicated query proxy (/api/youtube/proxy?url=...)
      try {
        const queryProxyUrl = `/api/youtube/proxy?url=${encodeURIComponent(url)}`;
        const res2 = await fetchTimeout(queryProxyUrl);
        if (res2.ok) {
          const text2 = await res2.text();
          if (isValidYoutubeHtml(text2)) {
            return text2;
          }
        }
      } catch (err2) {
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

    const endpoint = apiKey ? `https://www.youtube.com/youtubei/v1/player?key=${apiKey}` : 'https://www.youtube.com/youtubei/v1/player';
    const localEndpoint = `/ytproxy/youtubei/v1/player${apiKey ? `?key=${apiKey}` : ''}`;

    const parsePlayerJson = (json) => {
      if (!json || json.error || (!json.microformat && !json.videoDetails)) return null;
      const mf = json.microformat?.playerMicroformatRenderer;
      const liveDetails = mf?.liveBroadcastDetails;
      const candidateTime = liveDetails?.actualStartTime || liveDetails?.startTimestamp || liveDetails?.scheduledStartTime || mf?.publishDate || mf?.uploadDate;
      let startTime = null;
      if (candidateTime) {
        if (typeof candidateTime === 'number') {
          startTime = candidateTime < 10000000000 ? candidateTime * 1000 : candidateTime;
        } else if (typeof candidateTime === 'string') {
          if (/^[0-9]{10,13}$/.test(candidateTime)) {
            const rawNum = parseInt(candidateTime, 10);
            startTime = rawNum < 10000000000 ? rawNum * 1000 : rawNum;
          } else {
            const parsed = Date.parse(candidateTime);
            if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now() + 60000) startTime = parsed;
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
      return {
        isLive: !!json.videoDetails?.isLive || !!json.videoDetails?.isLiveContent || liveDetails?.isLiveNow !== false,
        startTime,
        viewers,
        isShorts,
        title: json.videoDetails?.title
      };
    };

    // 1. Try local proxy
    try {
      const res = await fetch(localEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = parsePlayerJson(data);
        if (parsed) return parsed;
      }
    } catch (e) {}

    // 2. Try query proxy
    try {
      const queryUrl = `/api/youtube/proxy?url=${encodeURIComponent(endpoint)}`;
      const res = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = parsePlayerJson(data);
        if (parsed) return parsed;
      }
    } catch (e) {}

    // 3. Try client-side CORS proxies
    for (const proxyFn of this.proxies) {
      try {
        const corsUrl = proxyFn(endpoint);
        const res = await fetch(corsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          const parsed = parsePlayerJson(data);
          if (parsed) return parsed;
        }
      } catch (e) {}
    }

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
            let secs = 0;
            if (data.event === 'infoDelivery' && data.info) {
              // Only use duration for live streams, as currentTime just tracks playhead position since the iframe loaded (causing 00:00:00 uptime)
              if (typeof data.info.duration === 'number' && data.info.duration > 0) {
                secs = data.info.duration;
              }
            }

            if (secs > 0) {
              const startMs = Date.now() - Math.floor(secs * 1000);
              cleanup();
              resolve(startMs);
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

    if (playerJson && playerJson.videoDetails) {
      isLive = !!playerJson.videoDetails.isLiveContent || !!playerJson.videoDetails.isLive;
    }

    if (playerJson && playerJson.microformat && playerJson.microformat.playerMicroformatRenderer) {
      const mf = playerJson.microformat.playerMicroformatRenderer;
      if (mf.liveBroadcastDetails) {
        if (mf.liveBroadcastDetails.isLiveNow !== false) {
          isLive = true;
        }
        const candidateTime = mf.liveBroadcastDetails.actualStartTime || mf.liveBroadcastDetails.startTimestamp || mf.liveBroadcastDetails.scheduledStartTime;
        if (candidateTime) {
          const parsedTime = new Date(candidateTime).getTime();
          if (!isNaN(parsedTime) && parsedTime > 0) {
            startTime = parsedTime;
          }
        }
      }
      if (!startTime && mf.publishDate) {
        const parsedPublish = new Date(mf.publishDate).getTime();
        if (!isNaN(parsedPublish) && parsedPublish > 0 && parsedPublish <= Date.now() + 60000) {
          startTime = parsedPublish;
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
         /"(?:scheduledStartTime|publishDate|uploadDate|datePublished)"\s*:\s*"([^"]+)"/gi
       ];
       for (const rgx of priorityRegexes) {
         if (startTime) break;
         const matches = [...html.matchAll(rgx)];
         for (const m of matches) {
           const str = m[1];
           if (/^[0-9]{10,13}$/.test(str)) {
             const rawNum = parseInt(str, 10);
             startTime = rawNum < 10000000000 ? rawNum * 1000 : rawNum;
             break;
           }
           const parsed = Date.parse(str);
           if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now() + 60000) {
             startTime = parsed;
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

    return { isLive, isShorts, viewers, likes, startTime };
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
      let localViewers = null;
      let localLikes = null;

      if (!videoId) {
        const liveUrl = this.getLiveUrl(trimmedName);

        console.log(`YouTube client: resolving video ID: ${liveUrl}`);
        pageHtml = await this.fetchWithProxyFallback(liveUrl);

        // Extract channel ID from HTML
        const canonicalMatch = pageHtml.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/([^"]+)"/) ||
                               pageHtml.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/);
        const channelId = canonicalMatch ? canonicalMatch[1] : null;

        videoId = this.extractLiveVideoId(pageHtml);

        if (!videoId) {
          console.log(`YouTube client: channel ${pollKey} is offline.`);
          if (channelId) {
            try {
              const resolved = await this.resolveChannelName(channelId);
              if (resolved) {
                resolvedDisplayName = resolved;
              }
            } catch (e) {
              console.warn("Failed to resolve offline channel display name:", e.message);
            }
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
            localViewers = meta.viewers;
            localLikes = meta.likes;
            if (meta.isShorts) isShorts = true;
          }
        }

        // Resolve channel display name for online channel
        if (channelId) {
          try {
            const resolved = await this.resolveChannelName(channelId);
            if (resolved) {
              resolvedDisplayName = resolved;
            }
          } catch (e) {
            console.warn("Failed to resolve online channel display name:", e.message);
          }
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
          const chatHtml = await this.fetchWithProxyFallback(chatPageUrl);
          if (chatHtml) {
            const chatParams = this.extractInnertubeParams(chatHtml);
            if (!apiKey && chatParams.apiKey) apiKey = chatParams.apiKey;
            if (!continuationToken && chatParams.continuationToken) continuationToken = chatParams.continuationToken;
            if (!clientVersion && chatParams.clientVersion) clientVersion = chatParams.clientVersion;
            if (!liveChatId && chatParams.liveChatId) liveChatId = chatParams.liveChatId;
          }
        } catch (e) {
          console.warn("YouTube client: live_chat fetch error:", e.message);
        }
      }

      if (!apiKey || !continuationToken) {
        console.log(`YouTube client: channel ${pollKey} has no active live chat tokens. Transitioning to offline polling.`);
        this.onStatus(pollKey, 'offline');
        this.setupOfflinePoll(trimmedName, chatMode);
        return;
      }

      // Resolve live stream start time via Innertube if not already extracted from HTML
      if (!localStartTime && videoId) {
        try {
          const pMeta = await this.fetchPlayerMetadata(videoId, apiKey);
          if (pMeta) {
            if (pMeta.startTime) localStartTime = pMeta.startTime;
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
        isShorts,
        displayName: resolvedDisplayName,
        trimmedName: trimmedName,
        chatMode,
        viewers: currentViewers,
        likes: currentLikes,
        isPolling: false,
        retryCount: 0
      };

      this.activePolls.set(pollKey, pollInstance);
      this.onStatus(pollKey, 'connected', { 
        startTime: pollInstance.startTimestamp,
        viewers: pollInstance.viewers,
        likes: pollInstance.likes,
        isShorts,
        displayName: resolvedDisplayName
      });

      // Sequential Adaptive Polling Loop (avoids overlapping requests and invalidating tokens over internet/Netlify)
      const scheduleNextPoll = (delay = 1000) => {
        if (!this.activePolls.has(pollKey)) return;
        pollInstance.timeoutId = setTimeout(async () => {
          if (!this.activePolls.has(pollKey)) return;
          try {
            await this.pollChat(pollKey);
          } catch (e) {
            console.warn(`YouTube polling error for ${pollKey}:`, e.message);
          }
          // Schedule next poll only after previous completes
          scheduleNextPoll(1000);
        }, delay);
      };

      // Immediate first poll
      scheduleNextPoll(0);

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
              if (meta.startTime) pollInstance.startTimestamp = meta.startTime;
              if (meta.viewers !== null && meta.viewers !== undefined) pollInstance.viewers = meta.viewers;
              if (meta.likes !== null && meta.likes !== undefined) pollInstance.likes = meta.likes;
              if (meta.isShorts) pollInstance.isShorts = true;
            }
            if (!pollInstance.startTimestamp || !pollInstance.isShorts) {
              try {
                const pMeta = await this.fetchPlayerMetadata(pollInstance.videoId, pollInstance.apiKey);
                if (pMeta) {
                  if (pMeta.startTime && !pollInstance.startTimestamp) pollInstance.startTimestamp = pMeta.startTime;
                  if (pMeta.isShorts) pollInstance.isShorts = true;
                  if (pMeta.viewers && pollInstance.viewers === null) pollInstance.viewers = pMeta.viewers;
                }
              } catch (e) {}
            }

            this.onStatus(pollKey, 'connected', { 
              startTime: pollInstance.startTimestamp,
              viewers: pollInstance.viewers,
              likes: pollInstance.likes,
              isShorts: pollInstance.isShorts,
              displayName: pollInstance.displayName || pollInstance.trimmedName.replace('@', '')
            });
          }
        } catch (e) {
          console.warn(`YouTube client: failed to update viewers/likes for ${pollKey}:`, e.message);
        }
      }, 15000); // refresh metrics every 15 seconds

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
    const poll = this.activePolls.get(channelName);
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
          const queryEndpoint = `/api/youtube/proxy?url=${encodeURIComponent(endpoint)}`;
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

            if (markDeleted && markDeleted.targetItemId) {
              const targetId = markDeleted.targetItemId;
              if (this.onMessageDeleted) {
                this.onMessageDeleted(targetId, null);
              }
            } else if (removeDeleted && removeDeleted.targetItemId) {
              const targetId = removeDeleted.targetItemId;
              if (this.onMessageDeleted) {
                this.onMessageDeleted(targetId, null);
              }
            } else if (authorMarkDeleted && authorMarkDeleted.externalChannelId) {
              const authorId = authorMarkDeleted.externalChannelId;
              if (this.onMessageDeleted) {
                this.onMessageDeleted(null, authorId);
              }
            } else if (authorRemoveDeleted && authorRemoveDeleted.externalChannelId) {
              const authorId = authorRemoveDeleted.externalChannelId;
              if (this.onMessageDeleted) {
                this.onMessageDeleted(null, authorId);
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
        if (renderer.headerText && renderer.headerText.runs) {
          renderer.headerText.runs.forEach(run => { headerText += run.text || ''; });
        }
        text = headerText || 'Joined Membership!';
        parts.push({
          type: 'text',
          content: text + (renderer.message ? ': ' : '')
        });

        let subtextText = '';
        if (renderer.headerSubtext) {
          if (renderer.headerSubtext.simpleText) {
            subtextText = renderer.headerSubtext.simpleText;
          } else if (renderer.headerSubtext.runs) {
            renderer.headerSubtext.runs.forEach(run => { subtextText += run.text || ''; });
          }
        }

        eventDetails = {
          tier: subtextText || 'Member',
          hasUserMessage: !!renderer.message,
          headerBg: this.convertYoutubeColor(renderer.headerBackgroundColor) || '#0f9d58',
          bodyBg: this.convertYoutubeColor(renderer.bodyBackgroundColor) || '#0b8043',
          authorTextColor: this.convertYoutubeColor(renderer.authorNameTextColor) || '#ffffff'
        };
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
          tier: 'Membership Gift',
          headerBg: '#0f9d58',
          bodyBg: '#0b8043',
          authorTextColor: '#ffffff'
        };
      }

      if (!renderer) return;

      // Extract message content and build parts array
      const runs = renderer.message?.runs || [];
      runs.forEach(run => {
        if (run.text) {
          text += run.text;
          parts.push({
            type: 'text',
            content: run.text
          });
        } else if (run.emoji) {
          const name = run.emoji.shortcuts?.[0] || run.emoji.emojiId || 'emoji';
          const thumbs = run.emoji.image?.thumbnails || [];
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

      if (isSystemEvent && eventType === 'subscription' && !renderer.message) {
        text = text || 'Joined Channel Membership!';
        parts.push({
          type: 'text',
          content: text
        });
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
      if (renderer.authorBadges) {
        renderer.authorBadges.forEach(b => {
          const badgeRenderer = b.liveChatAuthorBadgeRenderer;
          if (!badgeRenderer) return;
          const tooltip = (badgeRenderer.tooltip || badgeRenderer.accessibility?.accessibilityData?.label || '').toLowerCase();
          const iconType = (badgeRenderer.icon?.iconType || '').toUpperCase();
          const thumbs = badgeRenderer.customThumbnail?.thumbnails || [];
          let iconUrl = null;
          if (thumbs.length > 0) {
            iconUrl = normalizeUrl(thumbs[thumbs.length - 1]?.url || thumbs[0]?.url);
          }
          
          if (tooltip.includes('moderator')) {
            badges.push('moderator');
            if (iconUrl) badgeImages['moderator'] = iconUrl;
          } else if (tooltip.includes('owner') || tooltip.includes('broadcaster')) {
            badges.push('broadcaster');
            if (iconUrl) badgeImages['broadcaster'] = iconUrl;
          } else if (tooltip.includes('verified')) {
            badges.push('verified');
            if (iconUrl) badgeImages['verified'] = iconUrl;
          } else if (badgeRenderer.customThumbnail || tooltip.includes('member') || tooltip.includes('sponsor') || tooltip.includes('subscriber')) {
            badges.push('member');
            if (iconUrl) badgeImages['member'] = iconUrl;
          }

          // Parse Top Contributor / Leaderboard Rank (#1, #2, #3)
          if (
            tooltip.includes('top') || 
            tooltip.includes('contributor') || 
            tooltip.includes('leaderboard') || 
            tooltip.includes('rank') || 
            tooltip.includes('#') ||
            iconType.includes('TOP_') || 
            iconType.includes('RANK') ||
            iconType.includes('CROWN')
          ) {
            const rankMatch = tooltip.match(/(?:#|rank\s*|top\s*(?:fan|contributor|giver)?\s*#?)(\d+)/i) || tooltip.match(/#([1-3])/);
            if (rankMatch && rankMatch[1]) {
              const r = parseInt(rankMatch[1], 10);
              if (r >= 1 && r <= 3) {
                youtubeRank = r;
                badges.push(`rank_${r}`);
              }
            }
          }
        });
      }

      // Check if user is a bot
      const lowerUser = username.toLowerCase();
      const knownBots = ['nightbot', 'streamelements', 'wizebot', 'moobot', 'kickbot', 'botrix', 'botrixoficial', 'botrixofficial', 'streamlabs', 'fossabot', 'soundalerts', 'kbot'];
      if (knownBots.includes(lowerUser) || (lowerUser.endsWith('bot') && lowerUser.length > 3)) {
        badges.push('bot');
      }

      const color = this.getRandomColor(username);
      // Use highest-quality thumbnail (last in array is largest)
      const photoThumbnails = renderer.authorPhoto?.thumbnails;
      let avatar = photoThumbnails && photoThumbnails.length > 0 
        ? normalizeUrl(photoThumbnails[photoThumbnails.length - 1].url) 
        : null;

      const poll = this.activePolls.get(channelName);
      const isShorts = poll ? poll.isShorts : false;

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
