export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getInnertubeInstance, formatInnertubeCookie } from '@/lib/innertubeSession';
import { asSupabase } from '@/lib/supabase';
import { decryptCookie } from '@/lib/cryptoCookie';

const DEFAULT_INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

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
    likes: parseInt(json.videoDetails?.likeCount, 10) || 0,
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
  const origMatch = html.match(/"originalViewCount"\s*:\s*"([^"]+)"/);
  if (origMatch && origMatch[1]) {
    const val = parseInt(origMatch[1].replace(/[^0-9]/g, ''), 10);
    if (!isNaN(val)) viewers = val;
  } else {
    const shortViewMatch = html.match(/"viewCount"\s*:\s*"([^"]+)"/);
    if (shortViewMatch && shortViewMatch[1]) {
      const val = parseInt(shortViewMatch[1].replace(/[^0-9]/g, ''), 10);
      if (!isNaN(val)) viewers = val;
    }
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

async function fetchUserCookieFromDB(channel: string | null): Promise<string | undefined> {
  let userCookie = undefined;
  try {
    const { data: rows } = await asSupabase
      .from('Youtube')
      .select('youtube_cookie, custom_handle, channel_id');

    if (rows && rows.length > 0) {
      let cookieRow: any = null;
      if (channel) {
        const cleanMod = channel.toLowerCase().replace(/^@+/, '').trim();
        cookieRow = rows.find((r: any) =>
          ((r.channel_id || '').toLowerCase().trim() === cleanMod ||
           (r.custom_handle || '').toLowerCase().replace(/^@+/, '').trim() === cleanMod) &&
          (r.youtube_cookie || '').includes('SAPISID=')
        );
      }
      if (!cookieRow) {
        cookieRow = rows.find((r: any) => (r.youtube_cookie || '').includes('SAPISID=')) || rows[0];
      }

      if (cookieRow?.youtube_cookie) {
        const rawCookie = cookieRow.youtube_cookie;
        const decryptedCookie = rawCookie.includes('=') ? rawCookie : (decryptCookie(rawCookie) || rawCookie);
        userCookie = formatInnertubeCookie(decryptedCookie) || decryptedCookie;
      }
    }
  } catch (e: any) {
    console.warn('[Live-Info API] Failed to fetch cookie from DB:', e.message);
  }
  return userCookie || process.env.YOUTUBE_COOKIE;
}

async function resolveLiveVideoId(channelOrHandle: string, cookie?: string): Promise<string | null> {
  if (!channelOrHandle) return null;
  const clean = channelOrHandle.replace(/^@+/, '').trim();
  const url = clean.toLowerCase().startsWith('uc')
    ? `https://www.youtube.com/channel/${clean}/live`
    : `https://www.youtube.com/@${clean}/live`;

  // 1. Direct fetch
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36' }
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/) ||
                    html.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (match?.[1]) return match[1];
    }
  } catch (e) {}

  // 2. InnerTube youtubei.js search / channel lookup
  try {
    const yt = await getInnertubeInstance(undefined, cookie);
    const searchRes = await yt.search(clean, { type: 'video' });
    const liveVideo: any = searchRes.videos?.find((v: any) => v.is_live);
    if (liveVideo?.id) {
      return liveVideo.id;
    }
  } catch (e) {}

  return null;
}

export async function fetchLiveStreamInfo(videoId: string, cookie?: string) {
  if (!videoId) return null;

  // 1. Primary: InnerTube Engine via youtubei.js (Best for Netlify & Datacenter Serverless)
  try {
    const yt = await getInnertubeInstance(undefined, cookie);
    const basicInfo = await yt.getBasicInfo(videoId);
    if (basicInfo && basicInfo.basic_info) {
      const bi = basicInfo.basic_info as any;
      const candidateTime = bi.start_timestamp;
      const { startTime, isExact } = parseCandidateTimestamp(candidateTime);

      const viewers = typeof bi.view_count === 'number' ? bi.view_count : (parseInt(bi.view_count, 10) || 0);
      const likes = typeof bi.like_count === 'number' ? bi.like_count : (parseInt(bi.like_count, 10) || 0);
      const isLive = bi.is_live !== false || bi.is_live_content || !bi.duration;
      const title = bi.title || '';
      const author = bi.author || bi.channel?.name || '';
      const isShorts = !!(bi.is_shorts || (bi.embed?.width && bi.embed?.height && bi.embed.height > bi.embed.width));

      const uptimeSeconds = startTime ? Math.max(0, Math.floor((Date.now() - startTime) / 1000)) : null;

      if (startTime || isLive) {
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
    console.warn('[Live-Info API] youtubei.js getBasicInfo notice:', err.message);
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
        context: { client },
        videoId
      };
      const res = await fetch(endpoint, {
        cache: 'no-store',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://www.youtube.com',
          'Referer': 'https://www.youtube.com/'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = parsePlayerJson(data);
        if (parsed && (parsed.startTime || parsed.isLive)) {
          return parsed;
        }
      }
    } catch (e) {}
  }

  // 3. Tertiary: Watch page HTML GET
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const watchRes = await fetch(watchUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (watchRes.ok) {
      const html = await watchRes.text();
      const parsed = parseHtmlMetadata(html);
      if (parsed) return parsed;
    }
  } catch (e) {}

  // 4. Quaternary: Live chat HTML GET
  try {
    const chatUrl = `https://www.youtube.com/live_chat?v=${videoId}`;
    const chatRes = await fetch(chatUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (chatRes.ok) {
      const html = await chatRes.text();
      const parsed = parseHtmlMetadata(html);
      if (parsed) return parsed;
    }
  } catch (e) {}

  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let videoId = searchParams.get('videoId') || searchParams.get('v') || searchParams.get('video_id');
    const channel = searchParams.get('channel') || searchParams.get('handle') || searchParams.get('channelId');

    const cookie = await fetchUserCookieFromDB(channel);

    if (!videoId && channel) {
      videoId = await resolveLiveVideoId(channel, cookie);
    }

    if (!videoId) {
      return NextResponse.json({ success: false, error: 'videoId or channel parameter is required' }, { status: 400, headers: corsHeaders });
    }

    const info = await fetchLiveStreamInfo(videoId, cookie);
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

    const cookie = await fetchUserCookieFromDB(channel);

    if (!videoId && channel) {
      videoId = await resolveLiveVideoId(channel, cookie);
    }

    if (!videoId) {
      return NextResponse.json({ success: false, error: 'videoId or channel is required in body' }, { status: 400, headers: corsHeaders });
    }

    const info = await fetchLiveStreamInfo(videoId, cookie);
    if (!info) {
      return NextResponse.json({ success: false, error: 'Failed to fetch live stream info' }, { status: 404, headers: corsHeaders });
    }

    return NextResponse.json(info, { status: 200, headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
