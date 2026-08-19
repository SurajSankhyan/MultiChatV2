import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { searchParams } = new URL(request.url);
  const { path } = await params;
  const decodedPath = (path || []).map(p => decodeURIComponent(p)).join('/');
  const queryStr = searchParams.toString();
  
  const targetUrl = `https://www.youtube.com/${decodedPath}${queryStr ? `?${queryStr}` : ''}`;
  
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', 'https://www.youtube.com/');
  headers.set('Cookie', 'SOCS=CAESEwgDEgk2OTM5NjU2OTIaAmVuIAEaBgiA_LyaBg; PREF=tz=UTC&f6=40000000&hl=en');

  try {
    const res = await fetch(targetUrl, { headers });
    const html = await res.text();
    return new NextResponse(html, {
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
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', 'https://www.youtube.com/');
  headers.set('Origin', 'https://www.youtube.com');
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

    const res = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}
