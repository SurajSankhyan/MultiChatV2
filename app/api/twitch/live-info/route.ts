export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, max-age=0'
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawChannel = searchParams.get('channel') || searchParams.get('login') || '';
  const login = rawChannel.toLowerCase().replace(/^[@#]+/, '').trim();

  if (!login) {
    return NextResponse.json({ success: false, error: 'Missing channel parameter' }, { status: 400, headers: corsHeaders });
  }

  // 1. Primary: Official Twitch Public Web GQL API (exact live status, viewersCount, createdAt ISO timestamp)
  try {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        query: `query($login: String!) {
          user(login: $login) {
            id
            login
            displayName
            profileImageURL(width: 150)
            stream {
              id
              title
              viewersCount
              createdAt
              type
              game {
                displayName
              }
            }
          }
        }`,
        variables: { login }
      })
    });

    if (res.ok) {
      const json = await res.json();
      const user = json?.data?.user;
      if (user) {
        const stream = user.stream;
        const isLive = Boolean(stream && stream.id && stream.type === 'live');
        const startTime = isLive && stream.createdAt ? stream.createdAt : null;
        const viewers = isLive && typeof stream.viewersCount === 'number' ? stream.viewersCount : 0;

        return NextResponse.json({
          success: true,
          isLive,
          viewers,
          startTime,
          title: isLive ? (stream.title || '') : '',
          game: isLive ? (stream.game?.displayName || '') : '',
          displayName: user.displayName || login,
          avatarUrl: user.profileImageURL || null
        }, { status: 200, headers: corsHeaders });
      }
    }
  } catch (e: any) {
    console.warn('[Twitch Live-Info API] GQL lookup failed:', e?.message);
  }

  // 2. Fallback: decapi.me (server-side, no browser CORS issues)
  try {
    const [viewerRes, uptimeRes] = await Promise.all([
      fetch(`https://decapi.me/twitch/viewercount/${encodeURIComponent(login)}`, { cache: 'no-store' }),
      fetch(`https://decapi.me/twitch/uptime/${encodeURIComponent(login)}`, { cache: 'no-store' })
    ]);
    if (viewerRes.ok && uptimeRes.ok) {
      const viewerText = (await viewerRes.text()).trim();
      const uptimeText = (await uptimeRes.text()).trim();
      const isOffline =
        viewerText.toLowerCase().includes('offline') ||
        uptimeText.toLowerCase().includes('offline') ||
        viewerText.toLowerCase().includes('error') ||
        uptimeText.toLowerCase().includes('error');

      if (!isOffline) {
        const viewers = parseInt(viewerText.replace(/[^0-9]/g, ''), 10) || 0;
        let totalMs = 0;
        const daysMatch = uptimeText.toLowerCase().match(/(\d+)\s*day/);
        const hoursMatch = uptimeText.toLowerCase().match(/(\d+)\s*hour/);
        const minutesMatch = uptimeText.toLowerCase().match(/(\d+)\s*minute/);
        const secondsMatch = uptimeText.toLowerCase().match(/(\d+)\s*second/);
        if (daysMatch) totalMs += parseInt(daysMatch[1], 10) * 86400000;
        if (hoursMatch) totalMs += parseInt(hoursMatch[1], 10) * 3600000;
        if (minutesMatch) totalMs += parseInt(minutesMatch[1], 10) * 60000;
        if (secondsMatch) totalMs += parseInt(secondsMatch[1], 10) * 1000;

        return NextResponse.json({
          success: true,
          isLive: true,
          viewers,
          startTime: new Date(Date.now() - totalMs).toISOString(),
          title: '',
          game: '',
          displayName: login,
          avatarUrl: null
        }, { status: 200, headers: corsHeaders });
      }

      return NextResponse.json({
        success: true,
        isLive: false,
        viewers: 0,
        startTime: null,
        title: '',
        game: '',
        displayName: login,
        avatarUrl: null
      }, { status: 200, headers: corsHeaders });
    }
  } catch (e: any) {
    console.warn('[Twitch Live-Info API] decapi fallback failed:', e?.message);
  }

  return NextResponse.json({ success: false, error: 'Failed to fetch Twitch live info' }, { status: 502, headers: corsHeaders });
}
