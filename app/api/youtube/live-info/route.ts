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

  // 1. Direct fetch
  try {
    const res = await fetch(endpoint, fetchOptions);
    if (res.ok) {
      const data = await res.json();
      const parsed = parsePlayerJson(data);
      if (parsed) return parsed;
    }
  } catch (e) {}

  // 2. Rotating proxy fallback
  const proxies = [
    (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
  ];

  for (const proxyFn of proxies) {
    try {
      const pUrl = proxyFn(endpoint);
      const res = await fetch(pUrl, fetchOptions);
      if (res.ok) {
        const data = await res.json();
        const parsed = parsePlayerJson(data);
        if (parsed) return parsed;
      }
    } catch (e) {}
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId') || searchParams.get('v') || searchParams.get('video_id');

  if (!videoId) {
    return NextResponse.json({ success: false, error: 'videoId parameter is required' }, { status: 400, headers: corsHeaders });
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
    const videoId = body.videoId || body.video_id || body.v;

    if (!videoId) {
      return NextResponse.json({ success: false, error: 'videoId is required in body' }, { status: 400, headers: corsHeaders });
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
