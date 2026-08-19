import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryStr = searchParams.toString();
  const targetUrl = `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat${queryStr ? `?${queryStr}` : ''}`;
  
  try {
    const body = await request.json();
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    headers.set('Accept-Language', 'en-US,en;q=0.9');
    headers.set('Referer', 'https://www.youtube.com/');
    headers.set('Origin', 'https://www.youtube.com');
    headers.set('Cookie', 'SOCS=CAESEwgDEgk2OTM5NjU2OTIaAmVuIAEaBgiA_LyaBg; PREF=tz=UTC&f6=40000000&hl=en');

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}
