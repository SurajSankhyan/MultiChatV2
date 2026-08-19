import { NextResponse } from 'next/server';
import { asSupabase } from '@/lib/supabase';
import { innertubeCache } from '@/lib/innertubeSession';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    console.error('[OAuth Callback] Authorization error or code missing:', error);
    return NextResponse.redirect(new URL('/?error=oauth_cancelled', request.url));
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = 'http://localhost:5000/api/youtube/callback';

    if (!clientId || !clientSecret) {
      throw new Error('Missing Google OAuth credentials in environment variables.');
    }

    console.log('[OAuth Callback] Exchanging code for refresh token...');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.refresh_token) {
      console.error('[OAuth Callback] Token exchange failed:', tokenData);
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
    }

    const { refresh_token, access_token, expires_in } = tokenData;
    console.log('[OAuth Callback] Successfully received OAuth token! (refresh_token present:', Boolean(refresh_token), ')');

    let channelHandle = '';
    let channelName = '';
    let channelId = '';
    let avatarUrl = '';
    let userEmail = '';

    // 1. Fetch user email directly from Google UserInfo API
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        userEmail = userInfo.email || '';
        avatarUrl = userInfo.picture || '';
        console.log('[OAuth Callback] Google UserInfo email:', userEmail);
      }
    } catch (e: any) {
      console.warn('[OAuth Callback] UserInfo fetch warning:', e.message);
    }

    // 2. Fetch channel metadata directly from YouTube Data API
    try {
      const chanRes = await fetch('https://www.googleapis.com/youtube/v3/channels?mine=true&part=snippet', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      if (chanRes.ok) {
        const chanData = await chanRes.json();
        if (chanData.items && chanData.items.length > 0) {
          const snippet = chanData.items[0].snippet;
          channelId = chanData.items[0].id || '';
          channelName = snippet.title || '';
          channelHandle = snippet.customUrl || '';
          if (snippet.thumbnails?.high?.url) avatarUrl = snippet.thumbnails.high.url;
          console.log('[OAuth Callback] YouTube Channel metadata:', { channelId, channelName, channelHandle });
        }
      }
    } catch (e: any) {
      console.warn('[OAuth Callback] YouTube Channels API fetch warning:', e.message);
    }

    // Fallback to InnerTube account inspection if needed
    if (!channelHandle || !userEmail) {
      try {
        const { Innertube } = await import('youtubei.js');
        const yt = await Innertube.create();
        if (refresh_token) {
          await yt.session.oauth.init({
            access_token,
            refresh_token,
            scope: 'https://www.googleapis.com/auth/youtube',
            token_type: 'Bearer',
            expiry_date: new Date(Date.now() + (expires_in || 3600) * 1000).toISOString()
          });
          const accountInfo: any = await yt.account.getInfo().catch(() => null);
          if (accountInfo?.contents?.contents?.[0]) {
            const item = accountInfo.contents.contents[0];
            if (!channelName) channelName = item.account_name?.text || '';
            if (!channelHandle) channelHandle = item.channel_handle?.text || '';
            if (!userEmail && item.account_byline?.text?.includes('@')) userEmail = item.account_byline.text;
            if (!avatarUrl) avatarUrl = item.account_photo?.[0]?.url || '';
          }
        }
      } catch (e: any) {
        console.warn('[OAuth Callback] InnerTube account inspection warning:', e.message);
      }
    }

    // Clear old cached instances so fresh OAuth session is loaded
    innertubeCache.clear();

    // Match target row in Supabase 'Youtube' table
    const { data: rows } = await asSupabase
      .from('Youtube')
      .select('id, email, channel_id, custom_handle, channel_name')
      .limit(20);

    let targetRow = null;

    if (rows && rows.length > 0) {
      if (userEmail) {
        targetRow = rows.find((r: any) => (r.email || '').toLowerCase().trim() === userEmail.toLowerCase().trim());
      }
      if (!targetRow && channelHandle) {
        const cleanHandle = channelHandle.toLowerCase().replace(/^@+/, '').trim();
        targetRow = rows.find((r: any) => (r.custom_handle || '').toLowerCase().replace(/^@+/, '').trim() === cleanHandle);
      }
      if (!targetRow && channelId) {
        targetRow = rows.find((r: any) => (r.channel_id || '').toLowerCase().trim() === channelId.toLowerCase().trim());
      }
      if (!targetRow) {
        targetRow = rows.find((r: any) => (r.email || '').includes('cocthrushed72') || (r.custom_handle || '').includes('duplicatebunnysank9')) || rows[0];
      }
    }

    if (targetRow) {
      const updateData: any = {};
      if (refresh_token && refresh_token.startsWith('1//')) {
        updateData.youtube_refresh_token = refresh_token;
      }
      if (channelHandle) updateData.custom_handle = channelHandle;
      if (channelName) updateData.channel_name = channelName;
      if (avatarUrl) updateData.avatar_url = avatarUrl;
      if (channelId) updateData.channel_id = channelId;

      await asSupabase
        .from('Youtube')
        .update(updateData)
        .eq('id', targetRow.id);

      console.log(`[OAuth Callback] Updated Youtube row ${targetRow.id} (Email: ${userEmail || targetRow.email}, Handle: ${channelHandle || targetRow.custom_handle})! Saved OAuth refresh_token? ${Boolean(updateData.youtube_refresh_token)}`);
    }

    const redirectPath = `/?connected=true&handle=${encodeURIComponent(channelHandle || '@duplicatebunnysank9')}`;
    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (e: any) {
    console.error('[OAuth Callback] Exception:', e);
    return NextResponse.redirect(new URL('/?error=server_error', request.url));
  }
}
