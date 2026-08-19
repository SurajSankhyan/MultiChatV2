import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryStr = searchParams.toString();
  const targetUrl = `https://www.youtube.com/youtubei/v1/player${queryStr ? `?${queryStr}` : ''}`;
  
  try {
    const incomingBody = await request.json();
    
    // Ensure MWEB client context is used to bypass cloud IP bot checks and extract true startTimestamp
    const body = {
      ...incomingBody,
      context: {
        ...(incomingBody.context || {}),
        client: {
          ...(incomingBody.context?.client || {}),
          clientName: 'MWEB',
          clientVersion: '2.20240404.01.00',
          hl: 'en',
          gl: 'US'
        }
      }
    };

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');
    headers.set('Accept-Language', 'en-US,en;q=0.9');
    headers.set('Referer', 'https://www.youtube.com/');
    headers.set('Origin', 'https://www.youtube.com');
    headers.set('X-YouTube-Client-Name', '2');
    headers.set('X-YouTube-Client-Version', '2.20240404.01.00');

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return new NextResponse(err.message, { status: 500 });
  }
}
