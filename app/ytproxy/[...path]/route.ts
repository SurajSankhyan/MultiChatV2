import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { searchParams } = new URL(request.url);
  const { path } = await params;
  const subPath = path.join('/');
  const targetUrl = `https://www.youtube.com/${subPath}?${searchParams.toString()}`;
  
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', 'https://www.youtube.com/');
  headers.set('Origin', 'https://www.youtube.com');

  try {
    const res = await fetch(targetUrl, { headers });
    const html = await res.text();
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { searchParams } = new URL(request.url);
  const { path } = await params;
  const subPath = path.join('/');
  const targetUrl = `https://www.youtube.com/${subPath}?${searchParams.toString()}`;
  
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', 'https://www.youtube.com/');
  headers.set('Origin', 'https://www.youtube.com');
  headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');

  try {
    const bodyText = await request.text();
    const res = await fetch(targetUrl, { method: 'POST', headers, body: bodyText });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' }
    });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}
