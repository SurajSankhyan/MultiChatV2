import { NextResponse } from 'next/server';

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryStr = searchParams.toString();
  const targetUrl = `https://www.youtube.com/live_chat${queryStr ? `?${queryStr}` : ''}`;
  
  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36');
  headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', 'https://www.youtube.com/');
  headers.set('Origin', 'https://www.youtube.com');
  headers.set('Cookie', 'SOCS=CAESEwgDEgk2OTM5NjU2OTIaAmVuIAEaBgiA_LyaBg; PREF=tz=UTC&f6=40000000&hl=en');

  try {
    const res = await fetch(targetUrl, { headers });
    const html = await res.text();
    return new NextResponse(html, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'text/html; charset=utf-8',
        ...corsHeaders
      }
    });
  } catch (err: any) {
    return new NextResponse(err.message, { 
      status: 500,
      headers: corsHeaders
    });
  }
}
