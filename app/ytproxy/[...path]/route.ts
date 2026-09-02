export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { searchParams } = new URL(request.url);
  const { path } = await params;
  const decodedPath = (path || []).map(p => decodeURIComponent(p)).join('/');
  const queryStr = searchParams.toString();
  
  const targetUrl = `https://www.youtube.com/${decodedPath}${queryStr ? `?${queryStr}` : ''}`;
  
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
  headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('sec-ch-ua', '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"');
  headers.set('sec-ch-ua-mobile', '?0');
  headers.set('sec-ch-ua-platform', '"Windows"');
  headers.set('sec-fetch-dest', 'document');
  headers.set('sec-fetch-mode', 'navigate');
  headers.set('sec-fetch-site', 'none');
  headers.set('sec-fetch-user', '?1');
  headers.set('Referer', 'https://www.youtube.com/');
  headers.set('Cookie', 'SOCS=CAESEwgDEgk2OTM5NjU2OTIaAmVuIAEaBgiA_LyaBg; PREF=tz=UTC&f6=40000000&hl=en');

  let html = '';
  let status = 200;
  try {
    const res = await fetch(targetUrl, { cache: 'no-store', headers });
    if (res.ok) {
      html = await res.text();
      status = res.status;
    }
  } catch (err: any) {}

  if (!html) {
    const proxies = [
      (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
      (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
    ];
    for (const proxyFn of proxies) {
      try {
        const pUrl = proxyFn(targetUrl);
        const res = await fetch(pUrl, { headers });
        if (res.ok) {
          html = await res.text();
          status = res.status;
          break;
        }
      } catch (e) {}
    }
  }

  if (html) {
    return new NextResponse(html, {
      status: status,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders
      }
    });
  }

  return new NextResponse('Failed to fetch YouTube resource via proxy fallback', { 
    status: 502,
    headers: corsHeaders
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { searchParams } = new URL(request.url);
  const { path } = await params;
  const decodedPath = (path || []).map(p => decodeURIComponent(p)).join('/');
  
  // Ensure Innertube requests always have the API key
  let queryStr = searchParams.toString();
  if (decodedPath.startsWith('youtubei/v1') && !searchParams.has('key')) {
    searchParams.set('key', DEFAULT_INNERTUBE_KEY);
    queryStr = searchParams.toString();
  }
  const targetUrl = `https://www.youtube.com/${decodedPath}${queryStr ? `?${queryStr}` : ''}`;
  
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('sec-ch-ua', '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"');
  headers.set('sec-ch-ua-mobile', '?0');
  headers.set('sec-ch-ua-platform', '"Windows"');
  headers.set('Referer', 'https://www.youtube.com/');
  headers.set('Origin', 'https://www.youtube.com');
  headers.set('X-YouTube-Client-Name', '1');
  headers.set('X-YouTube-Client-Version', '2.20240404.01.00');
  headers.set('X-Origin', 'https://www.youtube.com');
  headers.set('Sec-Fetch-Mode', 'cors');
  headers.set('Sec-Fetch-Site', 'same-origin');
  headers.set('Content-Type', 'application/json');
  headers.set('Cookie', 'SOCS=CAESEwgDEgk2OTM5NjU2OTIaAmVuIAEaBgiA_LyaBg; PREF=tz=UTC&f6=40000000&hl=en');

  try {
    const incomingBody = await request.json().catch(() => ({}));
    const body = {
      ...incomingBody,
      context: {
        ...(incomingBody.context || {}),
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240404.01.00',
          hl: 'en',
          gl: 'US',
          ...(incomingBody.context?.client || {})
        }
      }
    };

    let data: any = null;
    let resStatus = 200;

    try {
      const res = await fetch(targetUrl, { cache: 'no-store', method: 'POST', headers, body: JSON.stringify(body) });
      if (res.ok) {
        data = await res.json();
        resStatus = res.status;
      }
    } catch (e) {}

    // If direct fetch failed or was blocked by YouTube on Netlify, fallback to rotating proxies
    if (!data) {
      const proxies = [
        (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
        (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
        (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`
      ];
      for (const proxyFn of proxies) {
        try {
          const pUrl = proxyFn(targetUrl);
          const pRes = await fetch(pUrl, { method: 'POST', headers, body: JSON.stringify(body) });
          if (pRes.ok) {
            data = await pRes.json();
            resStatus = pRes.status;
            break;
          }
        } catch (err) {}
      }
    }

    if (data) {
      return NextResponse.json(data, {
        status: resStatus,
        headers: corsHeaders
      });
    }

    return new NextResponse('Failed to route YouTube POST request through proxy fallbacks', { 
      status: 502,
      headers: corsHeaders
    });
  } catch (err: any) {
    return new NextResponse(err.message, { 
      status: 500,
      headers: corsHeaders
    });
  }
}
