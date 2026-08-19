import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { searchParams } = new URL(request.url);
  const { path } = await params;
  const subPath = path.join('/');
  const targetUrl = `https://api.ivr.fi/${subPath}?${searchParams.toString()}`;

  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', 'https://api.ivr.fi/');
  headers.set('Origin', 'https://api.ivr.fi');

  try {
    const res = await fetch(targetUrl, { headers });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}
