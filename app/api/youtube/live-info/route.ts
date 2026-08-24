import { NextResponse } from 'next/server';

const DEFAULT_INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, max-age=0'
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}

function parsePlayerJson(json: any) {
  if (!json || json.error) return null;
  const mf = json.microformat?.playerMicroformatRenderer;
  const liveDetails = mf?.liveBroadcastDetails;
  const candidateTime = liveDetails?.actualStartTime || liveDetails?.startTimestamp || liveDetails?.scheduledStartTime || mf?.publishDate || mf?.uploadDate;
  
  let startTime: number | null = null;
  let isExact = false;
  if (candidateTime) {
    if (typeof candidateTime === 'number') {
      startTime = candidateTime < 10000000000 ? candidateTime * 1000 : candidateTime;
      isExact = !!(liveDetails?.actualStartTime || liveDetails?.startTimestamp);
    } else if (typeof candidateTime === 'string') {
      if (/^[0-9]{10,13}$/.test(candidateTime)) {
        const rawNum = parseInt(candidateTime, 10);
        startTime = rawNum < 10000000000 ? rawNum * 1000 : rawNum;
        isExact = !!(liveDetails?.actualStartTime || liveDetails?.startTimestamp);
      } else {
        const parsed = Date.parse(candidateTime);
        if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now() + 60000) {
          startTime = parsed;
          isExact = !!(liveDetails?.actualStartTime || liveDetails?.startTimestamp);
        }
      }
    }
  }

  const viewers = parseInt(json.videoDetails?.viewCount, 10) || 0;
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
    title,
    author,
    isShorts
  };
}

function parseHtmlMetadata(html: string) {
  if (!html) return null;
  const startDateMatch = html.match(/itemprop="startDate"\s+content="([^"]+)"/i) || 
                         html.match(/<meta\s+itemprop="startDate"\s+content="([^"]+)"/i) ||
                         html.match(/"startDate"\s*:\s*"([^"]+)"/i) ||
                         html.match(/"startTimestamp"\s*:\s*"([^"]+)"/i) ||
                         html.match(/"actualStartTime"\s*:\s*"([^"]+)"/i) ||
                         html.match(/itemprop="datePublished"\s+content="([^"]+)"/i) ||
                         html.match(/"publishDate"\s*:\s*"([^"]+)"/i);
  
  let startTime: number | null = null;
  let candidateTime = startDateMatch ? startDateMatch[1] : null;
  if (candidateTime) {
    const parsed = Date.parse(candidateTime);
    if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now() + 60000) {
      startTime = parsed;
    }
  }

  let viewers = 0;
  const origMatch = html.match(/"originalViewCount"\s*:\s*"([^"]+)"/);
  if (origMatch && origMatch[1]) {
    const val = parseInt(origMatch[1].replace(/[^0-9]/g, ''), 10);
    if (!isNaN(val)) viewers = val;
  }

  let title = '';
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].replace(' - YouTube', '').trim();
  }

  if (startTime) {
    const uptimeSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    return {
      success: true,
      isLive: true,
      startTime,
      isExact: true,
      startTimestamp: candidateTime,
      uptimeSeconds,
      viewers,
      title,
      author: '',
      isShorts: false
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

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36' }
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/) ||
                    html.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (match?.[1]) return match[1];
    }
  } catch (e) {}

  const proxies = [
    (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
  ];
  for (const pFn of proxies) {
    try {
      const pRes = await fetch(pFn(url));
      if (pRes.ok) {
        const html = await pRes.text();
        const match = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/) ||
                      html.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
        if (match?.[1]) return match[1];
      }
    } catch (e) {}
  }

  return null;
}

async function fetchLiveStreamInfo(videoId: string) {
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

  const endpoint = `https://www.youtube.com/youtubei/v1/player?key=${DEFAULT_INNERTUBE_KEY}`;

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://www.youtube.com',
      'Referer': 'https://www.youtube.com/'
    },
    body: JSON.stringify(payload)
  };

  // 1. Direct InnerTube POST
  try {
    const res = await fetch(endpoint, fetchOptions);
    if (res.ok) {
      const data = await res.json();
      const parsed = parsePlayerJson(data);
      if (parsed && parsed.startTime) return parsed;
    }
  } catch (e) {}

  // 2. Direct Watch page HTML GET
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
      if (parsed && parsed.startTime) return parsed;
    }
  } catch (e) {}

  // 3. Live chat HTML GET
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
      if (parsed && parsed.startTime) return parsed;
    }
  } catch (e) {}

  return null;
}

export async function GET(request: Request) {
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
