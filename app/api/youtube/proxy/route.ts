export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { asSupabase } from '@/lib/supabase';
import { decryptCookie } from '@/lib/cryptoCookie';
import { formatInnertubeCookie } from '@/lib/innertubeSession';


const DEFAULT_INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, max-age=0'
};


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
    console.warn('[Proxy API] Failed to fetch cookie from DB:', e.message);
  }
  return userCookie || process.env.YOUTUBE_COOKIE;
}

function extractChannelFromUrl(url: string): string | null {
  try {
    const match = url.match(/youtube\.com\/@([^/?]+)/) || url.match(/youtube\.com\/channel\/([^/?]+)/);
    if (match && match[1]) return match[1];
  } catch(e) {}
  return null;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  
  if (!targetUrl || (!targetUrl.startsWith('https://www.youtube.com') && !targetUrl.startsWith('https://m.youtube.com') && !targetUrl.startsWith('https://youtube.com'))) {
    return new NextResponse('Invalid target URL', { status: 400, headers: corsHeaders });
  }

  const isMobile = targetUrl.startsWith('https://m.youtube.com');
  const userAgent = isMobile 
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

  const headers = new Headers();
  headers.set('User-Agent', userAgent);
  headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', isMobile ? 'https://m.youtube.com/' : 'https://www.youtube.com/');
  const channel = extractChannelFromUrl(targetUrl);
  const dbCookie = await fetchUserCookieFromDB(channel);
  if (dbCookie) headers.set('Cookie', dbCookie);
  else headers.set('Cookie', 'SOCS=CAESEwgDEgk2OTM5NjU2OTIaAmVuIAEaBgiA_LyaBg; PREF=tz=UTC&f6=40000000&hl=en');

  try {
    const res = await fetch(targetUrl, { headers, cache: 'no-store' });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'text/html; charset=utf-8',
        ...corsHeaders
      }
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  let targetUrl = searchParams.get('url');

  if (!targetUrl || (!targetUrl.startsWith('https://www.youtube.com') && !targetUrl.startsWith('https://m.youtube.com') && !targetUrl.startsWith('https://youtube.com'))) {
    return new NextResponse('Invalid target URL', { status: 400, headers: corsHeaders });
  }

  if (targetUrl.includes('youtubei/v1') && !targetUrl.includes('key=')) {
    targetUrl += (targetUrl.includes('?') ? '&' : '?') + `key=${DEFAULT_INNERTUBE_KEY}`;
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', 'https://www.youtube.com/');
  headers.set('Origin', 'https://www.youtube.com');
  headers.set('X-YouTube-Client-Name', '1');
  headers.set('X-YouTube-Client-Version', '2.20250201.01.00');
  headers.set('X-Origin', 'https://www.youtube.com');
  headers.set('Sec-Fetch-Mode', 'cors');
  headers.set('Sec-Fetch-Site', 'same-origin');
  const channel = extractChannelFromUrl(targetUrl);
  const dbCookie = await fetchUserCookieFromDB(channel);
  if (dbCookie) headers.set('Cookie', dbCookie);
  else headers.set('Cookie', 'SOCS=CAESEwgDEgk2OTM5NjU2OTIaAmVuIAEaBgiA_LyaBg; PREF=tz=UTC&f6=40000000&hl=en');

  try {
    const incomingBody = await request.json().catch(() => ({}));
    const body = {
      ...incomingBody,
      context: {
        ...(incomingBody.context || {}),
        client: {
          clientName: 'WEB',
          clientVersion: '2.20250201.01.00',
          hl: 'en',
          gl: 'US',
          ...(incomingBody.context?.client || {})
        }
      }
    };

    const res = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(body) });
    let data = await res.json();
    
    // --- DELTA FILTERING OPTIMIZATION ---
    // Strip massive unnecessary YouTube tracking/framework data to save bandwidth (~90% reduction)
    if (targetUrl.includes('get_live_chat')) {
      if (data.frameworkUpdates) delete data.frameworkUpdates;
      if (data.responseContext) delete data.responseContext;
      if (data.trackingParams) delete data.trackingParams;
      if (data.mutations) delete data.mutations;
      
      const actions = data.continuationContents?.liveChatContinuation?.actions;
      if (actions) {
        data.continuationContents.liveChatContinuation.actions = actions.map((action: any) => {
          if (action.addChatItemAction?.item) {
            const itemKey = Object.keys(action.addChatItemAction.item)[0];
            const item = action.addChatItemAction.item[itemKey];
            if (item) {
              // Delete heavy accessibility and tracking nodes that the frontend parser ignores
              delete item.contextMenuEndpoint;
              delete item.contextMenuAccessibility;
              delete item.trackingParams;
            }
          }
          return action;
        });
      }
    }
    // ------------------------------------

    return NextResponse.json(data, {
      status: res.status,
      headers: corsHeaders
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500, headers: corsHeaders });
  }
}
