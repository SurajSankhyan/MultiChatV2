import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bwwdzkhtnaepamsfivds.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function emailToUuid(email: string): string {
  const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function getCanonicalOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    let host = forwardedHost.split(',')[0].trim();
    if (host.includes('--')) {
      host = host.split('--')[1];
    }
    return `${forwardedProto}://${host}`;
  }

  const url = new URL(request.url);
  let host = url.host;
  if (host.includes('--')) {
    host = host.split('--')[1];
    return `${url.protocol}//${host}`;
  }
  return url.origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const canonicalOrigin = getCanonicalOrigin(request);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const cookieStore = await cookies();
  let savedState = cookieStore.get('kick_oauth_state')?.value;
  let codeVerifier = cookieStore.get('kick_code_verifier')?.value;
  let stateUserId = cookieStore.get('kick_oauth_user_id')?.value;
  let stateUserEmail = cookieStore.get('kick_oauth_user_email')?.value;

  // Unpack state payload if present
  if (state) {
    try {
      let base64 = state.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      let jsonStr = Buffer.from(base64, 'base64').toString('utf8');
      if (jsonStr.includes('%')) {
        try { jsonStr = decodeURIComponent(jsonStr); } catch (e) {}
      }
      const decodedState = JSON.parse(jsonStr);
      if (decodedState.v) codeVerifier = decodedState.v;
      if (decodedState.u) stateUserId = decodedState.u;
      if (decodedState.e) stateUserEmail = decodedState.e;
    } catch (e1) {
      try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        if (decodedState.v) codeVerifier = decodedState.v;
        if (decodedState.u) stateUserId = decodedState.u;
        if (decodedState.e) stateUserEmail = decodedState.e;
      } catch (e2) {}
    }
  }

  if (error) {
    return NextResponse.redirect(`${canonicalOrigin}/dashboard#kick_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${canonicalOrigin}/dashboard#kick_error=No_code_provided`);
  }

  const clientId = process.env.KICK_CLIENT_ID || '01KZGGD32S5919AGF28KSKKT1J';
  const clientSecret = process.env.KICK_CLIENT_SECRET || 'fb569011d2a1d96acd782fd08bdf472fcfaeebd46efe6876d1fd073ead084d89';
  const redirectUri = process.env.KICK_REDIRECT_URI || `${canonicalOrigin}/api/kick/callback`;

  try {
    // 1. Exchange authorization code for Kick tokens on server
    const tokenParams = new URLSearchParams();
    tokenParams.append('grant_type', 'authorization_code');
    tokenParams.append('client_id', clientId);
    if (clientSecret) tokenParams.append('client_secret', clientSecret);
    tokenParams.append('redirect_uri', redirectUri);
    tokenParams.append('code_verifier', codeVerifier || '');
    tokenParams.append('code', code);

    const tokenRes = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/122.0.0.0',
        'Origin': 'https://kick.com',
        'Referer': 'https://kick.com/'
      },
      body: tokenParams.toString()
    });

    const responseText = await tokenRes.text();
    let tokenData: any = {};
    try {
      tokenData = JSON.parse(responseText);
    } catch (pErr) {
      console.error('[Kick OAuth Callback] Non-JSON token response:', responseText);
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[Kick OAuth Callback] Token exchange failed:', tokenData);
      const errMsg = tokenData.message || tokenData.error_description || tokenData.error || (responseText ? responseText.slice(0, 120) : 'Token exchange failed');
      return NextResponse.redirect(`${canonicalOrigin}/dashboard#kick_error=${encodeURIComponent(errMsg)}`);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || '';

    // 2. Fetch Kick user profile
    let kickUser: any = null;
    try {
      const userRes = await fetch('https://api.kick.com/public/v1/users', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/122.0.0.0'
        }
      });
      if (userRes.ok) {
        const userText = await userRes.text();
        try {
          const userData = JSON.parse(userText);
          kickUser = userData?.data?.[0] || userData?.data || userData;
        } catch (e) {}
      }
    } catch (e) {}

    const kickUsername = kickUser?.username || kickUser?.name || kickUser?.slug || 'kick_user';
    let avatarUrl = kickUser?.profile_pic || kickUser?.profile_picture || kickUser?.avatar || kickUser?.profile_image || kickUser?.avatar_url || '';
    let channelId = kickUser?.channel?.id ? String(kickUser.channel.id) : (kickUser?.id ? String(kickUser.id) : '');
    let chatroomId = kickUser?.chatroom?.id ? String(kickUser.chatroom.id) : '';

    if (kickUsername) {
      try {
        const cleanName = kickUsername.toLowerCase().replace(/^@+/, '').trim();
        const res = await fetch(`https://kick.com/api/v2/channels/${cleanName}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/122.0.0.0',
            'Accept': 'application/json'
          }
        });
        if (res.ok) {
          const chData = await res.json();
          if (chData?.user?.profile_pic) {
            avatarUrl = chData.user.profile_pic;
          }
          if (chData?.chatroom?.id) chatroomId = String(chData.chatroom.id);
          if (chData?.id) channelId = String(chData.id);
        }
      } catch (e) {}
    }

    let matchedUserId = stateUserId || '';
    let targetUserEmail = stateUserEmail || '';
    const targetEmailClean = targetUserEmail ? targetUserEmail.trim().toLowerCase() : '';

    if (!matchedUserId && targetEmailClean) {
      matchedUserId = emailToUuid(targetEmailClean);
    }

    console.log(`[Kick OAuth Callback] Connected Kick account @${kickUsername} (access: ${accessToken.slice(0, 10)}..., refresh: ${refreshToken.slice(0, 10)}...) for ${targetEmailClean}. Saving to Supabase Kick table...`);

    // Save to Supabase Kick table with onConflict email
    if (targetEmailClean) {
      try {
        const kickPayload: any = {
          id: matchedUserId,
          email: targetEmailClean,
          username: kickUsername,
          channel_id: channelId || chatroomId || kickUsername,
          chatroom_id: chatroomId || channelId || kickUsername,
          avatar_url: avatarUrl,
          kick_access_token: accessToken,
          kick_refresh_token: refreshToken,
          is_connected: true,
          updated_at: new Date().toISOString()
        };

        const { error: upsertErr } = await supabase.from('Kick').upsert(kickPayload, { onConflict: 'email' });
        if (upsertErr) {
          console.warn('[Kick OAuth Callback] Upsert with ID note:', upsertErr.message);
          delete kickPayload.id;
          await supabase.from('Kick').upsert(kickPayload, { onConflict: 'email' });
        } else {
          console.log(`[Kick OAuth Callback] Successfully upserted Kick row for ${targetEmailClean} with refresh token!`);
        }
      } catch (dbErr: any) {
        console.warn('[Kick OAuth Callback] Database exception:', dbErr.message);
      }
    }

    // Redirect back to dashboard passing connected state parameters, access token AND refresh token
    const redirectUrl = new URL(`${canonicalOrigin}/dashboard`);
    redirectUrl.searchParams.set('kick_connected', 'true');
    redirectUrl.searchParams.set('kick_user', kickUsername);
    redirectUrl.searchParams.set('kick_token', accessToken);
    if (refreshToken) redirectUrl.searchParams.set('kick_refresh_token', refreshToken);
    if (avatarUrl) redirectUrl.searchParams.set('avatar_url', avatarUrl);
    if (targetEmailClean) redirectUrl.searchParams.set('email', targetEmailClean);
    if (matchedUserId) redirectUrl.searchParams.set('user_id', matchedUserId);

    const response = NextResponse.redirect(redirectUrl.toString());
    response.cookies.set('prochat_kick_username', kickUsername, { path: '/', maxAge: 86400 * 30 });
    response.cookies.set('prochat_kick_auth_token', accessToken, { path: '/', maxAge: 86400 * 30 });
    if (refreshToken) response.cookies.set('prochat_kick_refresh_token', refreshToken, { path: '/', maxAge: 86400 * 30 });
    if (targetEmailClean) response.cookies.set('kick_oauth_user_email', targetEmailClean, { path: '/', maxAge: 86400 * 30 });
    if (matchedUserId) response.cookies.set('kick_oauth_user_id', matchedUserId, { path: '/', maxAge: 86400 * 30 });
    return response;

  } catch (err: any) {
    console.error('[Kick OAuth Callback] Exception:', err);
    return NextResponse.redirect(`${canonicalOrigin}/dashboard#kick_error=${encodeURIComponent(err.message)}`);
  }
}
