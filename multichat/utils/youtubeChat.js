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
      (url) => `https://proxy.cors.sh/${url}`,
      (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`
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
    // Check if it matches YouTube channel ID format: starts with UC/uc and is 24 chars
    if (/^uc[a-zA-Z0-9_-]{22}$/i.test(trimmed)) {
      return `https://www.youtube.com/channel/${trimmed}/live`;
    }
    // Otherwise assume it's a handle or username slug
    const cleanSlug = trimmed.replace('@', '');
    return `https://www.youtube.com/@${cleanSlug}/live`;
  }

  // Helper to fetch from url trying local proxy first, and falling back to CORS proxies
  async fetchWithProxyFallback(url) {
    const isValidYoutubeHtml = (text) => {
      if (!text || typeof text !== 'string' || text.length < 500) return false;
      if (text.includes('google.com/sorry') || text.includes('<title>Sorry...</title>') || text.includes('consent.youtube.com/m?')) {
        return false;
      }
      return text.includes('ytInitialData') || text.includes('ytcfg') || text.includes('youtube.com') || text.includes('isLive') || text.includes('watch?v=');
    };

    // 1. Try local proxy first
    if (url.startsWith('https://www.youtube.com')) {
      const localProxyUrl = this.mapToLocalProxy(url);
      try {
        console.log(`YouTube client: trying local proxy: ${localProxyUrl}`);
        const res = await fetch(localProxyUrl);
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
        const res2 = await fetch(queryProxyUrl);
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
    let lastError = null;
    for (let i = 0; i < this.proxies.length; i++) {
      const proxiedUrl = this.proxies[i](url);
      try {
        console.log(`YouTube client: trying public proxy index ${i} for ${url}`);
        const res = await fetch(proxiedUrl);
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

  parseViewersFromHtml(html) {
    if (!html) return null;
    
    // 1. Try originalViewCount first (most accurate raw count of concurrent viewers)
    const origMatch = html.match(/"originalViewCount"\s*:\s*"([^"]+)"/);
    if (origMatch && origMatch[1]) {
      const val = parseInt(origMatch[1].replace(/[^0-9]/g, ''), 10);
      if (!isNaN(val)) {
        console.log(`YouTube client: parsed originalViewCount: ${val}`);
        return val;
      }
    }
    
    // 2. Try shortViewCountText (e.g. 4.1k watching)
    const shortIdx = html.indexOf('"shortViewCountText"');
    if (shortIdx !== -1) {
      const sub = html.substring(shortIdx, shortIdx + 300);
      const runTextMatch = sub.match(/"text"\s*:\s*"([^"]+)"/);
      if (runTextMatch && runTextMatch[1]) {
        const text = runTextMatch[1].toLowerCase();
        if (text.includes('k')) {
          const val = parseFloat(text.replace(/[^0-9.]/g, ''));
          return isNaN(val) ? null : Math.round(val * 1000);
        } else if (text.includes('m')) {
          const val = parseFloat(text.replace(/[^0-9.]/g, ''));
          return isNaN(val) ? null : Math.round(val * 1000000);
        } else {
          const val = parseInt(text.replace(/[^0-9]/g, ''), 10);
          return isNaN(val) ? null : val;
        }
      }
    }
    
    // 3. Try fallback from standard viewCount text
    const viewCountIdx = html.indexOf('"viewCountText"');
    if (viewCountIdx !== -1) {
      const sub = html.substring(viewCountIdx, viewCountIdx + 300);
      const match = sub.match(/"(text|simpleText)"\s*:\s*"([^"]+)"/);
      if (match && match[2]) {
        const text = match[2].toLowerCase();
        const val = parseInt(text.replace(/[^0-9]/g, ''), 10);
        return isNaN(val) ? null : val;
      }
    }
    
    return null;
  }

  parseLikesFromHtml(html) {
    if (!html) return null;
    
    // 1. Direct likeCount (standard in YouTube live streams)
    const countMatch = html.match(/"likeCount"\s*:\s*"([0-9.,KMBkmb]+)"/i) || html.match(/"likeCount"\s*:\s*([0-9]+)/i);
    if (countMatch && countMatch[1]) {
      const text = String(countMatch[1]).toLowerCase().replace(/,/g, '');
      if (text.includes('k')) {
        const val = parseFloat(text.replace(/[^0-9.]/g, ''));
        return isNaN(val) ? null : Math.round(val * 1000);
      } else if (text.includes('m')) {
        const val = parseFloat(text.replace(/[^0-9.]/g, ''));
        return isNaN(val) ? null : Math.round(val * 1000000);
      } else {
        const val = parseInt(text.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(val)) return val;
      }
    }

    // 2. Accessibility label
    const labelMatch = html.match(/"label"\s*:\s*"([0-9.,KMBkmb]+)\s+likes?"/i) || 
                       html.match(/"accessibilityData"\s*:\s*\{"label"\s*:\s*"([0-9.,KMBkmb]+)\s+likes?"\}/i) ||
                       html.match(/"label"\s*:\s*"[Ll]ike (?:this video )?along with ([0-9.,KMBkmb]+) other people"/i) ||
                       html.match(/"accessibilityData"\s*:\s*\{"label"\s*:\s*"[Ll]ike (?:this video )?along with ([0-9.,KMBkmb]+) other people"/i) ||
                       html.match(/"defaultText"\s*:\s*\{"accessibility"\s*:\s*\{"accessibilityData"\s*:\s*\{"label"\s*:\s*"([0-9.,KMBkmb]+)\s+likes?"\}\}/i);
    if (labelMatch && labelMatch[1]) {
      const text = labelMatch[1].toLowerCase().replace(/,/g, '');
      if (text.includes('k')) {
        const val = parseFloat(text.replace(/[^0-9.]/g, ''));
        return isNaN(val) ? null : Math.round(val * 1000);
      } else if (text.includes('m')) {
        const val = parseFloat(text.replace(/[^0-9.]/g, ''));
        return isNaN(val) ? null : Math.round(val * 1000000);
      } else {
        const val = parseInt(text.replace(/[^0-9]/g, ''), 10);
        return isNaN(val) ? null : val;
      }
    }

    // 3. Fallback to likes numeric
    const rawLikes = html.match(/"likes"\s*:\s*([0-9]+)/);
    if (rawLikes && rawLikes[1]) {
      const val = parseInt(rawLikes[1], 10);
      if (!isNaN(val)) return val;
    }

    return null;
  }

  parseStartTimestamp(html) {
    if (!html) return null;

    const matches = [
      ...html.matchAll(/"(startTimestamp|actualStartTime|scheduledStartTime|publishDate|uploadDate|startDate)"\s*:\s*"([^"]+)"/gi)
    ];
    for (const m of matches) {
      const str = m[2];
      if (/^[0-9]{10,13}$/.test(str)) {
        const rawNum = parseInt(str, 10);
        return rawNum < 10000000000 ? rawNum * 1000 : rawNum;
      }
      const parsed = Date.parse(str);
      if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now() + 60000) {
        return parsed;
      }
    }

    return null;
  }

  extractLiveVideoId(html) {
    if (!html) return null;
    
    // Check if the stream is live via common YouTube indicators
    const isLive = html.includes('"isLive":true') || 
                   html.includes('"isLiveContent":true') ||
                   html.includes('"isLiveNow":true') ||
                   html.includes('"liveStreamability"') ||
                   html.includes('"activeLiveChatId"') ||
                   html.includes('liveChatRenderer') ||
                   html.includes('watch?v=');
    if (!isLive) return null;
    
    // 1. Try canonical URL watch?v=
    const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="[^"]*watch\?v=([a-zA-Z0-9_-]{11})"/);
    if (canonicalMatch && canonicalMatch[1]) {
      return canonicalMatch[1];
    }
    
    // 2. Try liveStreamabilityRenderer videoId
    const liveStreamMatch = html.match(/"liveStreamabilityRenderer"\s*:\s*\{\s*"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
    if (liveStreamMatch && liveStreamMatch[1]) {
      return liveStreamMatch[1];
    }

    // 3. Try watchEndpoint / currentVideoEndpoint videoId
    const endpointMatch = html.match(/"watchEndpoint"\s*:\s*\{\s*"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
    if (endpointMatch && endpointMatch[1]) {
      return endpointMatch[1];
    }
    
    // 4. Fallback to general videoId in the page if we are sure it's live
    const videoIdMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
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

        // Extract live stream start timestamp and viewer/like count if present in HTML
        let startTimestamp = null;
        if (pageHtml) {
          startTimestamp = this.parseStartTimestamp(pageHtml);
          if (startTimestamp) {
            console.log(`YouTube client: found startTimestamp: ${startTimestamp}`);
          }
          this.resolvedViewers = this.parseViewersFromHtml(pageHtml);
          this.resolvedLikes = this.parseLikesFromHtml(pageHtml);
        }
        this.resolvedStartTimestamp = startTimestamp; // store temporarily

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

      // Check if it is a Shorts live stream directly from page HTML
      let isShorts = false;
      if (pageHtml) {
        isShorts = pageHtml.includes('/shorts/') || 
                   pageHtml.includes('#shorts') || 
                   pageHtml.toLowerCase().includes('vertical stream') || 
                   pageHtml.includes('reelPlayerHeaderRenderer');
      }

      // Extract Innertube API parameters directly from the live broadcast page
      let { apiKey, clientVersion, continuationToken, liveChatId } = this.extractInnertubeParams(pageHtml);

      // If tokens weren't in main page HTML or chatMode is specific, try fetching live chat page
      if (!apiKey || !continuationToken) {
        try {
          const chatPageUrl = `https://www.youtube.com/live_chat?v=${videoId}`;
          console.log(`YouTube client: fetching live chat page for additional tokens: ${chatPageUrl}`);
          const chatHtml = await this.fetchWithProxyFallback(chatPageUrl);
          if (chatHtml) {
            const chatParams = this.extractInnertubeParams(chatHtml);
            if (!apiKey && chatParams.apiKey) apiKey = chatParams.apiKey;
            if (!continuationToken && chatParams.continuationToken) continuationToken = chatParams.continuationToken;
            if (!clientVersion && chatParams.clientVersion) clientVersion = chatParams.clientVersion;
            if (!liveChatId && chatParams.liveChatId) liveChatId = chatParams.liveChatId;
          }
        } catch (e) {
          console.warn("YouTube client: live_chat fallback fetch error:", e.message);
        }
      }

      if (!apiKey || !continuationToken) {
        console.log(`YouTube client: channel ${pollKey} has no active live chat tokens. Transitioning to offline polling.`);
        this.onStatus(pollKey, 'offline');
        this.setupOfflinePoll(trimmedName, chatMode);
        return;
      }

      console.log(`YouTube client: connected to stream ${videoId} with clientVersion: ${clientVersion}`);

      const currentViewers = this.resolvedViewers !== null ? this.resolvedViewers : null;
      const currentLikes = this.resolvedLikes !== null ? this.resolvedLikes : null;
      this.resolvedViewers = null; // reset
      this.resolvedLikes = null;

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
        startTimestamp: this.resolvedStartTimestamp || null,
        isShorts,
        displayName: resolvedDisplayName,
        trimmedName: trimmedName,
        chatMode,
        viewers: currentViewers,
        likes: currentLikes,
        isPolling: false,
        retryCount: 0
      };
      this.resolvedStartTimestamp = null; // reset

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
            let startTimestamp = this.parseStartTimestamp(html);
            const resolvedViewers = this.parseViewersFromHtml(html);
            const resolvedLikes = this.parseLikesFromHtml(html);

            if (resolvedViewers !== null) {
              pollInstance.viewers = resolvedViewers;
            }
            if (resolvedLikes !== null) {
              pollInstance.likes = resolvedLikes;
            }

            this.onStatus(pollKey, 'connected', { 
              startTime: startTimestamp || pollInstance.startTimestamp,
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
            const publicProxyUrl = `https://proxy.cors.sh/${endpoint}`;
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
          nextToken = contData.timedContinuationData?.continuation ||
                      contData.invalidationContinuationData?.continuation ||
                      contData.liveChatReplayContinuationData?.continuation;
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
        rawTimestamp: Date.now(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
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
