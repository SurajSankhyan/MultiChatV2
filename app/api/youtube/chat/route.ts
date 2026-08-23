import { NextResponse } from 'next/server';
import { hwSupabase, asSupabase } from '@/lib/supabase';

async function getFreshGoogleAccessToken(refreshToken: string): Promise<string | null> {
  if (!refreshToken || refreshToken.trim().startsWith('{')) return null;
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || process.env.NEXT_PUBLIC_YOUTUBE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || '';

    const params = new URLSearchParams();
    if (clientId) params.append('client_id', clientId);
    if (clientSecret) params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('grant_type', 'refresh_token');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (res.ok) {
      const data = await res.json();
      return data.access_token || null;
    } else {
      console.warn('[YouTube API Route] OAuth token refresh response error status:', res.status, await res.text());
    }
  } catch (e) {
    console.warn('[YouTube API Route] Failed refreshing Google access token:', e);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, userEmail, liveChatId, message, channelId, action, messageId } = body;

    if ((!action || action === 'send') && !message) {
      return NextResponse.json(
        { error: 'Missing required parameter: message text is required for sending.' },
        { status: 400 }
      );
    }

    if (!userId && !userEmail && !channelId) {
      return NextResponse.json(
        { error: 'User identifier (userId, userEmail, or channelId) is required to verify account.' },
        { status: 400 }
      );
    }

    // 1. Fetch channel details & refresh_token from MultiChat Supabase DB (ashezgjtjmtdchkrcuyx) for the logged in user
    let accountData: any = null;

    // 1a. Check 'Youtube' table in asSupabase (https://ashezgjtjmtdchkrcuyx.supabase.co)
    try {
      let ytQuery = asSupabase.from('Youtube').select('*');
      const userConditions: string[] = [];

      if (userId) userConditions.push(`id.eq.${userId}`);
      if (userEmail) userConditions.push(`email.eq.${userEmail}`);

      if (userConditions.length > 0) {
        ytQuery = ytQuery.or(userConditions.join(','));
      }

      const { data: ytList, error: ytErr } = await ytQuery;
      if (!ytErr && Array.isArray(ytList) && ytList.length > 0) {
        // Prioritize account row with valid channel_id (starts with UC), non-dummy channel_name, and valid cookies
        const bestRow = ytList.find((u: any) => u.channel_id && u.channel_id.startsWith('UC') && u.channel_name && u.channel_name !== '@user') ||
                        ytList.find((u: any) => u.youtube_cookie && u.youtube_cookie.includes('SAPISID=')) ||
                        ytList.find((u: any) => u.youtube_cookie || (u.youtube_refresh_token || '').includes('SAPISID=')) ||
                        ytList.find((u: any) => u.youtube_cookie || u.youtube_refresh_token || u.refresh_token) ||
                        ytList[0];
        accountData = {
          user_id: bestRow.id,
          channel_id: bestRow.channel_id,
          custom_handle: bestRow.custom_handle,
          channel_name: bestRow.channel_name,
          avatar_url: bestRow.avatar_url,
          youtube_cookie: bestRow.youtube_cookie,
          refresh_token: bestRow.youtube_cookie || bestRow.youtube_refresh_token || bestRow.refresh_token,
          access_token: bestRow.access_token
        };
      }
    } catch (e) {
      console.warn('[YouTube API Route] Error querying Youtube table in asSupabase:', e);
    }

    // 1b. Fallback check on hwSupabase profiles
    if (!accountData) {
      try {
        let profQuery = hwSupabase.from('profiles').select('*');
        const userConditions: string[] = [];
        if (userId) userConditions.push(`id.eq.${userId}`);
        if (userEmail) userConditions.push(`email.eq.${userEmail}`);

        if (userConditions.length > 0) {
          profQuery = profQuery.or(userConditions.join(','));
        }
        const { data: profList, error: profErr } = await profQuery;
        if (!profErr && Array.isArray(profList) && profList.length > 0) {
          const bestRow = profList.find((p: any) => p.youtube_cookie || p.youtube_refresh_token || p.refresh_token) || profList[0];
          accountData = {
            user_id: bestRow.id,
            channel_id: bestRow.channel_id,
            custom_handle: bestRow.custom_handle,
            channel_name: bestRow.channel_name,
            avatar_url: bestRow.avatar_url,
            youtube_cookie: bestRow.youtube_cookie,
            refresh_token: bestRow.youtube_cookie || bestRow.youtube_refresh_token || bestRow.refresh_token,
            access_token: bestRow.access_token
          };
        }
      } catch (e) {
        console.warn('[YouTube API Route] Error querying profiles table in hwSupabase:', e);
      }
    }

    if (!accountData || (!accountData.refresh_token && !accountData.youtube_cookie)) {
      try {
        const { data: allRows } = await asSupabase.from('Youtube').select('*');
        if (allRows && allRows.length > 0) {
          const bestRow = allRows.find((u: any) => u.youtube_cookie && u.youtube_cookie.includes('SAPISID=')) ||
                          allRows.find((u: any) => u.youtube_cookie || u.youtube_refresh_token) ||
                          allRows[0];
          accountData = {
            user_id: bestRow.id,
            channel_id: bestRow.channel_id,
            custom_handle: bestRow.custom_handle,
            channel_name: bestRow.channel_name,
            avatar_url: bestRow.avatar_url,
            youtube_cookie: bestRow.youtube_cookie,
            refresh_token: bestRow.youtube_cookie || bestRow.youtube_refresh_token || bestRow.refresh_token,
            access_token: bestRow.access_token
          };
        }
      } catch (e) {}
    }

    if (!accountData || (!accountData.refresh_token && !accountData.youtube_cookie)) {
      return NextResponse.json(
        { error: 'No connected YouTube channel with credentials found for your account. Please connect your YouTube account in settings.' },
        { status: 403 }
      );
    }

    // 2. Strict Security Check for sending messages: Verify target channelId matches the logged-in user's OWN connected YouTube channel!
    if ((!action || action === 'send') && channelId) {
      const targetClean = channelId.toLowerCase().replace(/^@+/, '').trim();
      const connectedChannelId = (accountData.channel_id || '').toLowerCase().trim();
      const connectedHandle = (accountData.custom_handle || '').toLowerCase().replace(/^@+/, '').trim();
      const connectedName = (accountData.channel_name || '').toLowerCase().trim();

      const isOwner = (
        targetClean === connectedChannelId ||
        targetClean === connectedHandle ||
        targetClean === connectedName
      );

      if (!isOwner) {
        return NextResponse.json(
          { error: `Security Policy Violation: You can only send chat messages to your own connected YouTube broadcast channel (@${accountData.custom_handle || accountData.channel_name || accountData.channel_id}).` },
          { status: 403 }
        );
      }
    }

    let activeAccessToken = accountData.access_token || '';

    if (!activeAccessToken && accountData.refresh_token) {
      const refreshed = await getFreshGoogleAccessToken(accountData.refresh_token);
      if (refreshed) {
        activeAccessToken = refreshed;
      }
    }

    // Direct InnerTube Engine Dispatch (100% Pure InnerTube Engine)
    try {
      const urlObj = new URL(request.url);
      const innertubeUrl = `${urlObj.origin}/api/youtube/innertube`;
      const innertubeRes = await fetch(innertubeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action || 'send',
          videoId: body.videoId || body.video_id || (liveChatId && /^[a-zA-Z0-9_-]{11}$/.test(liveChatId.trim()) ? liveChatId.trim() : undefined),
          video_id: body.videoId || body.video_id || (liveChatId && /^[a-zA-Z0-9_-]{11}$/.test(liveChatId.trim()) ? liveChatId.trim() : undefined),
          channelId: accountData.channel_id,
          userId: accountData.user_id || userId,
          userEmail: userEmail,
          accessToken: activeAccessToken,
          refreshToken: accountData.refresh_token,
          liveChatId,
          message,
          messageId,
          params: body.params || body.deleteParams || body.timeoutParams || body.banParams,
          deleteParams: body.deleteParams || body.params,
          timeoutParams: body.timeoutParams || body.params,
          banParams: body.banParams || body.params,
          menuParams: body.menuParams,
          targetChannelId: body.targetChannelId || body.username || body.displayName,
          durationSeconds: body.durationSeconds
        })
      });

      const innertubeData = await innertubeRes.json().catch(() => ({ error: 'Failed to parse InnerTube response' }));
      console.log(`[YouTube API Route] InnerTube engine dispatch result for "${action || 'send'}":`, innertubeData);

      return NextResponse.json(innertubeData, { status: innertubeRes.status });
    } catch (e: any) {
      console.error('[YouTube API Route] InnerTube dispatch exception:', e);
      return NextResponse.json({ success: false, error: e.message || 'InnerTube dispatch failed' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[YouTube API Route] Unhandled exception:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
