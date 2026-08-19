import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;

  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 });
  if (!apiKey) return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });

  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`);
    const data = await res.json();
    const actualStartTime = data.items?.[0]?.liveStreamingDetails?.actualStartTime;
    return NextResponse.json({ actualStartTime: actualStartTime || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
