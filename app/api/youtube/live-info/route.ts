import { NextResponse } from 'next/server';
import { getInnertubeInstance } from '@/lib/innertubeSession';

const DEFAULT_INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

// Server-side persistent in-memory cache for live stream start times
const START_TIME_SERVER_CACHE = new Map<string, { startTime: number; isExact: boolean; cachedAt: number }>();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}

function parseCandidateTimestamp(candidateTime: any): { startTime: number | null; isExact: boolean } {
  if (!candidateTime) return { startTime: null, isExact: false };

  if (candidateTime instanceof Date || (candidateTime && typeof candidateTime.getTime === 'function')) {
    const ms = candidateTime.getTime();
    if (!isNaN(ms) && ms > 0 && ms <= Date.now() + 60000) {
      return { startTime: ms, isExact: true };
    }
  }

  if (typeof candidateTime === 'number') {
    const ms = candidateTime < 10000000000 ? candidateTime * 1000 : candidateTime;
    return { startTime: ms, isExact: true };
  }

  if (typeof candidateTime === 'string') {
    const trimmed = candidateTime.trim();
    if (/^[0-9]{10,13}$/.test(trimmed)) {
      const rawNum = parseInt(trimmed, 10);
      const ms = rawNum < 10000000000 ? rawNum * 1000 : rawNum;
      return { startTime: ms, isExact: true };
    }

    let parseable = trimmed;
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      parseable = trimmed.replace(' ', 'T') + 'Z';
    }
    const parsed = Date.parse(parseable);
    if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now() + 60000) {
      return { startTime: parsed, isExact: true };
    }
  }

  return { startTime: null, isExact: false };
}

function parsePlayerJson(json: any) {
  if (!json || json.error) return null;
  const mf = json.microformat?.playerMicroformatRenderer;
  const liveDetails = mf?.liveBroadcastDetails;
  const candidateTime = liveDetails?.actualStartTime || liveDetails?.startTimestamp;
  
  const { startTime, isExact } = parseCandidateTimestamp(candidateTime);

  let viewers = 0;
  const runs = json.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer?.viewCount?.videoViewCountRenderer?.viewCount?.runs;
  if (runs && runs[0]?.text) {
    const run0 = runs[0].text;
    const run1 = runs[1]?.text || '';
    if (run1.toLowerCase().includes('watching') || run0.toLowerCase().includes('watching')) {
      const parsed = parseInt(run0.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsed) && parsed > 0) viewers = parsed;
    }
  }
  const likes = parseInt(json.videoDetails?.likeCount, 10) || 0;
  const isLive = !!json.videoDetails?.isLive || !!json.videoDetails?.isLiveContent || liveDetails?.isLiveNow !== false;
  const title = json.videoDetails?.title || '';
  const author = json.videoDetails?.author || '';

  let isShorts = false;
  const formats = json.streamingData?.adaptiveFormats || json.streamingData?.formats || [];
  for (const fmt of formats) {
    if (fmt.width && fmt.height && fmt.height > fmt.width) {
      isShorts = true;
      break;
    }
  }

  const uptimeSeconds = startTime ? Math.max(0, Math.floor((Date.now() - startTime) / 1000)) : null;

  return {
    success: true,
    isLive,
    startTime,
    isExact,
    startTimestamp: candidateTime || (startTime ? new Date(startTime).toISOString() : null),
    uptimeSeconds,
    viewers,
    likes,
    title,
    author,
    isShorts
  };
}

function parseHtmlMetadata(html: string) {
  if (!html || typeof html !== 'string') return null;
  
  const startDateMatch = html.match(/itemprop="startDate"\s+content="([^"]+)"/i) || 
                         html.match(/<meta\s+itemprop="startDate"\s+content="([^"]+)"/i) ||
                         html.match(/"actualStartTime"\s*:\s*"([^"]+)"/i) ||
                         html.match(/"startTimestamp"\s*:\s*"([^"]+)"/i) ||
                         html.match(/"startDate"\s*:\s*"([^"]+)"/i);
  
  let candidateTime = startDateMatch ? startDateMatch[1] : null;
  let { startTime, isExact } = parseCandidateTimestamp(candidateTime);

  let viewers = 0;
  const watchingMatch = html.match(/"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([0-9,.]+)"\s*\}\s*,\s*\{\s*"text"\s*:\s*"\s*watching/i) ||
                        html.match(/"text"\s*:\s*"([0-9,.]+)\s*watching\s*now"/i) ||
                        html.match(/"viewCount"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([0-9,.]+)"\s*\}\s*,\s*\{\s*"text"\s*:\s*"\s*watching/i);
  if (watchingMatch && watchingMatch[1]) {
    viewers = parseInt(watchingMatch[1].replace(/[^0-9]/g, ''), 10) || 0;
  }

  let likes = 0;
  const likeMatch = html.match(/"likeCount"\s*:\s*"([0-9.,KMBkmb]+)"/i) || html.match(/"likeCount"\s*:\s*([0-9]+)/i);
  if (likeMatch && likeMatch[1]) {
    const text = String(likeMatch[1]).toLowerCase().replace(/,/g, '');
    if (text.includes('k')) likes = Math.round(parseFloat(text.replace(/[^0-9.]/g, '')) * 1000);
    else if (text.includes('m')) likes = Math.round(parseFloat(text.replace(/[^0-9.]/g, '')) * 1000000);
    else likes = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
  }

  let title = '';
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].replace(' - YouTube', '').trim();
  }

  const isLive = html.includes('"isLive":true') || html.includes('"isLiveNow":true') || html.includes('liveChatRenderer') || html.includes('itemprop="startDate"');

  let isShorts = false;
  const formatMatches = [...html.matchAll(/"width"\s*:\s*(\d+)\s*,\s*"height"\s*:\s*(\d+)/g)];
  for (const m of formatMatches) {
    const w = parseInt(m[1], 10);
    const h = parseInt(m[2], 10);
    if (w > 0 && h > 0 && h > w) {
      isShorts = true;
      break;
    }
  }

  if (startTime) {
    const uptimeSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    return {
      success: true,
      isLive: true,
      startTime,
      isExact: isExact || true,
      startTimestamp: candidateTime || new Date(startTime).toISOString(),
      uptimeSeconds,
      viewers,
      likes,
      title,
      author: '',
      isShorts
    };
  }

  if (isLive || viewers > 0 || title) {
    return {
      success: true,
      isLive: isLive || true,
      startTime: null,
      isExact: false,
      startTimestamp: null,
      uptimeSeconds: null,
      viewers,
      likes,
      title,
      author: '',
      isShorts
    };
  }

  return null;
}

async function resolveLiveVideoId(channelOrHandle: string): Promise<string | null> {
  if (!channelOrHandle) return null;
  const clean = channelOrHandle.replace(/^@+/, '').trim();
  const url = clean.toLowerCase().startsWith('uc')
    ? `https://www.youtube.com/channel/${clean}/live`
    : `https://www.youtube.com/@${clean}/live`;

  // 1. Direct fetch with redirect tracking
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36' }
    });
    if (res.ok) {
      const finalUrl = res.url || '';
      const urlMatch = finalUrl.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (urlMatch?.[1]) return urlMatch[1];
      const html = await res.text();
      const match = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/) ||
                    html.match(/watch\?v=([a-zA-Z0-9_-]{11})/) ||
                    html.match(/canonical"\s+href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/);
      if (match?.[1]) return match[1];
    }
  } catch (e) {}

  // 2. InnerTube URL resolution
  try {
    const yt = await getInnertubeInstance();
    const nav: any = await yt.resolveURL(url).catch(() => null);
    if (nav?.payload?.videoId) return nav.payload.videoId;
    if (nav?.payload?.browseId) {
      const ch = await yt.getChannel(nav.payload.browseId).catch(() => null);
      const liveTab: any = await ch?.getLiveStreams().catch(() => null);
      if (liveTab?.videos?.[0]?.id) return liveTab.videos[0].id;
    }
  } catch (e) {}

  // 3. Search fallback
  try {
    const yt = await getInnertubeInstance();
    const searchRes = await yt.search(clean, { type: 'video' });
    const liveVideo: any = searchRes.videos?.find((v: any) => v.is_live);
    if (liveVideo?.id) {
      return liveVideo.id;
    }
  } catch (e) {}

  return null;
}

export async function fetchLiveStreamInfo(videoId: string) {
  if (!videoId) return null;

  // Check server-side cache for this videoId
  const cachedStart = videoId ? START_TIME_SERVER_CACHE.get(videoId) : null;

  // 1. Primary: InnerTube Engine via youtubei.js getInfo
  try {
    const yt = await getInnertubeInstance();
    const info = await yt.getInfo(videoId);
    if (info && info.basic_info) {
      const bi = info.basic_info as any;
      const candidateTime = bi.start_timestamp;
      let { startTime, isExact } = parseCandidateTimestamp(candidateTime);

      if (!startTime && cachedStart && (Date.now() - cachedStart.cachedAt < 24 * 60 * 60 * 1000)) {
        startTime = cachedStart.startTime;
        isExact = cachedStart.isExact;
      }

      if (startTime && videoId) {
        START_TIME_SERVER_CACHE.set(videoId, { startTime, isExact: !!isExact, cachedAt: Date.now() });
      }

      let liveViewers = 0;
      const pi = info.primary_info as any;
      if (pi?.view_count?.original_view_count !== undefined && pi?.view_count?.original_view_count !== null) {
        liveViewers = typeof pi.view_count.original_view_count === 'number' 
          ? pi.view_count.original_view_count 
          : (parseInt(String(pi.view_count.original_view_count).replace(/[^0-9]/g, ''), 10) || 0);
      } else if (pi?.view_count?.view_count?.text) {
        const text = String(pi.view_count.view_count.text);
        if (text.toLowerCase().includes('watching')) {
          const match = text.match(/([0-9,.]+)/);
          if (match) {
            liveViewers = parseInt(match[1].replace(/,/g, ''), 10) || 0;
          }
        }
      } else if (pi?.view_count?.short_view_count?.text) {
        const text = String(pi.view_count.short_view_count.text);
        if (text.toLowerCase().includes('watching')) {
          const match = text.match(/([0-9,.]+)/);
          if (match) {
            liveViewers = parseInt(match[1].replace(/,/g, ''), 10) || 0;
          }
        }
      }

      const viewers = liveViewers > 0 ? liveViewers : 0;
      const likes = typeof bi.like_count === 'number' ? bi.like_count : (parseInt(bi.like_count, 10) || 0);
      const isLive = bi.is_live !== false || bi.is_live_content || !bi.duration;
      const title = bi.title || '';
      const author = bi.author || bi.channel?.name || '';
      const isShorts = !!(bi.is_shorts || (bi.embed?.width && bi.embed?.height && bi.embed.height > bi.embed.width));

      const uptimeSeconds = startTime ? Math.max(0, Math.floor((Date.now() - startTime) / 1000)) : null;

      if (startTime || isLive || viewers > 0) {
        return {
          success: true,
          isLive,
          startTime,
          isExact: isExact || !!bi.start_timestamp,
          startTimestamp: candidateTime ? new Date(startTime || candidateTime).toISOString() : (startTime ? new Date(startTime).toISOString() : null),
          uptimeSeconds,
          viewers,
          likes,
          title,
          author,
          isShorts
        };
      }
    }
  } catch (err: any) {
    console.warn('[Live-Info API] youtubei.js getInfo notice:', err.message);
  }

  // 2. Secondary: InnerTube REST POST with multiple client contexts (WEB_EMBEDDED_PLAYER, WEB, TVHTML5)
  const clientConfigs = [
    { clientName: 'WEB', clientVersion: '2.20240404.01.00', hl: 'en', gl: 'US' },
    { clientName: 'WEB_EMBEDDED_PLAYER', clientVersion: '1.20240404.01.00', hl: 'en', gl: 'US' },
    { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0', hl: 'en', gl: 'US' }
  ];

  for (const client of clientConfigs) {
    try {
      const endpoint = `https://www.youtube.com/youtubei/v1/player?key=${DEFAULT_INNERTUBE_KEY}`;
      const payload = {
        context: {
          client,
          thirdParty: { embedUrl: `https://www.youtube.com/watch?v=${videoId}` }
        },
        videoId
      };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          'X-YouTube-Client-Name': client.clientName === 'WEB' ? '1' : '56',
          'X-YouTube-Client-Version': client.clientVersion
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = parsePlayerJson(data);
        if (parsed) {
          if (!parsed.startTime && cachedStart && (Date.now() - cachedStart.cachedAt < 24 * 60 * 60 * 1000)) {
            parsed.startTime = cachedStart.startTime;
            parsed.isExact = cachedStart.isExact;
            parsed.uptimeSeconds = Math.max(0, Math.floor((Date.now() - cachedStart.startTime) / 1000));
          }
          if (parsed.startTime && videoId) {
            START_TIME_SERVER_CACHE.set(videoId, { startTime: parsed.startTime, isExact: !!parsed.isExact, cachedAt: Date.now() });
          }
          if (parsed.startTime || parsed.isLive) {
            return parsed;
          }
        }
      }
    } catch (e) {}
  }

  // 3. Tertiary: Watch page HTML GET
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const watchRes = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (watchRes.ok) {
      const html = await watchRes.text();
      const parsed = parseHtmlMetadata(html);
      if (parsed) {
        if (!parsed.startTime && cachedStart && (Date.now() - cachedStart.cachedAt < 24 * 60 * 60 * 1000)) {
          parsed.startTime = cachedStart.startTime;
          parsed.isExact = cachedStart.isExact;
          parsed.uptimeSeconds = Math.max(0, Math.floor((Date.now() - cachedStart.startTime) / 1000));
        }
        if (parsed.startTime && videoId) {
          START_TIME_SERVER_CACHE.set(videoId, { startTime: parsed.startTime, isExact: !!parsed.isExact, cachedAt: Date.now() });
        }
        return parsed;
      }
    }
  } catch (e) {}

  // 4. Quaternary: Live chat HTML GET
  try {
    const chatUrl = `https://www.youtube.com/live_chat?v=${videoId}`;
    const chatRes = await fetch(chatUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (chatRes.ok) {
      const html = await chatRes.text();
      const parsed = parseHtmlMetadata(html);
      if (parsed) {
        if (!parsed.startTime && cachedStart && (Date.now() - cachedStart.cachedAt < 24 * 60 * 60 * 1000)) {
          parsed.startTime = cachedStart.startTime;
          parsed.isExact = cachedStart.isExact;
          parsed.uptimeSeconds = Math.max(0, Math.floor((Date.now() - cachedStart.startTime) / 1000));
        }
        if (parsed.startTime && videoId) {
          START_TIME_SERVER_CACHE.set(videoId, { startTime: parsed.startTime, isExact: !!parsed.isExact, cachedAt: Date.now() });
        }
        return parsed;
      }
    }
  } catch (e) {}

  // 5. Last resort: If we have cached start time, return live metadata with cached start time
  if (cachedStart && (Date.now() - cachedStart.cachedAt < 24 * 60 * 60 * 1000)) {
    const uptimeSeconds = Math.max(0, Math.floor((Date.now() - cachedStart.startTime) / 1000));
    return {
      success: true,
      isLive: true,
      startTime: cachedStart.startTime,
      isExact: cachedStart.isExact,
      startTimestamp: new Date(cachedStart.startTime).toISOString(),
      uptimeSeconds,
      viewers: 0,
      likes: 0,
      title: '',
      author: '',
      isShorts: false
    };
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let videoId = searchParams.get('videoId') || searchParams.get('v') || searchParams.get('video_id');
    const channel = searchParams.get('channel') || searchParams.get('handle') || searchParams.get('channelId');

    if (!videoId && channel) {
      videoId = await resolveLiveVideoId(channel);
    }

    if (!videoId) {
      return NextResponse.json({ success: false, error: 'videoId or channel parameter is required' }, { status: 400, headers: corsHeaders });
    }

    const info = await fetchLiveStreamInfo(videoId);
    if (!info) {
      return NextResponse.json({ success: false, error: 'Failed to fetch live stream info' }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(info, { status: 200, headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let videoId = body.videoId || body.video_id || body.v;
    const channel = body.channel || body.handle || body.channelId;

    if (!videoId && channel) {
      videoId = await resolveLiveVideoId(channel);
    }

    if (!videoId) {
      return NextResponse.json({ success: false, error: 'videoId or channel is required in body' }, { status: 400, headers: corsHeaders });
    }

    const info = await fetchLiveStreamInfo(videoId);
    if (!info) {
      return NextResponse.json({ success: false, error: 'Failed to fetch live stream info' }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(info, { status: 200, headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
