import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  
  if (!targetUrl || (!targetUrl.startsWith('https://www.youtube.com') && !targetUrl.startsWith('https://m.youtube.com') && !targetUrl.startsWith('https://youtube.com'))) {
    return new NextResponse('Invalid target URL', { status: 400 });
  }

  const isMobile = targetUrl.startsWith('https://m.youtube.com');
  const userAgent = isMobile 
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

  const headers = new Headers();
  headers.set('User-Agent', userAgent);
  headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', isMobile ? 'https://m.youtube.com/' : 'https://www.youtube.com/');
  headers.set('Cookie', 'SOCS=CAESEwgDEgk2OTM5NjU2OTIaAmVuIAEaBgiA_LyaBg; PREF=tz=UTC&f6=40000000&hl=en');

  try {
    const res = await fetch(targetUrl, { headers });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}

const DEFAULT_INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  let targetUrl = searchParams.get('url');

  if (!targetUrl || (!targetUrl.startsWith('https://www.youtube.com') && !targetUrl.startsWith('https://m.youtube.com') && !targetUrl.startsWith('https://youtube.com'))) {
    return new NextResponse('Invalid target URL', { status: 400 });
  }

  if (targetUrl.includes('youtubei/v1') && !targetUrl.includes('key=')) {
    targetUrl += (targetUrl.includes('?') ? '&' : '?') + `key=${DEFAULT_INNERTUBE_KEY}`;
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', 'https://www.youtube.com/');
  headers.set('Origin', 'https://www.youtube.com');
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

    const res = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}
