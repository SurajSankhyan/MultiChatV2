import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'child_process';
import util from 'util';

const execFilePromise = util.promisify(execFile);
const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';

async function fetchWithCurl(url: string) {
  try {
    const { stdout } = await execFilePromise(curlBin, [
      '-s', '-L', url,
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      '-H', 'Accept: application/json',
      '-H', 'Accept-Language: en-US,en;q=0.9',
      '-H', 'Referer: https://kick.com/',
      '-H', 'Origin: https://kick.com'
    ]);
    return JSON.parse(stdout);
  } catch (err: any) {
    return null;
  }
}

async function postWithCurl(url: string, headersObj: Record<string, string>, bodyObj: any) {
  const args = ['-s', '-L', '-X', 'POST', url];
  for (const [k, v] of Object.entries(headersObj)) {
    args.push('-H', `${k}: ${v}`);
  }
  args.push('-d', JSON.stringify(bodyObj));

  try {
    const { stdout } = await execFilePromise(curlBin, args);
    let json: any = null;
    try { json = JSON.parse(stdout); } catch {}
    const isHtml = !stdout || stdout.includes('security policy') || stdout.includes('Just a moment') || stdout.includes('<!DOCTYPE');
    const isError = isHtml || json?.error || json?.errors || json?.message === 'Forbidden' || json?.message === 'Unauthorized' || json?.message === 'Unauthenticated';
    const isSuccess = !isError && !!(json && (json.data?.is_sent === true || json.data?.message_id || json.data?.id || json.id || json.message === 'OK' || json.status === 200 || json.status?.code === 200 || json.status === 'success' || json.message === 'success' || json.data?.content || json.content));
    return { ok: isSuccess, json, raw: stdout };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bwwdzkhtnaepamsfivds.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const channelInfoCache = new Map<string, { chatroomId: number; broadcasterUserId: number }>();

async function fetchKickChannelInfo(cleanChannel: string, token?: string): Promise<{ chatroomId: number | null; broadcasterUserId: number | null }> {
  if (!cleanChannel) return { chatroomId: null, broadcasterUserId: null };

  if (channelInfoCache.has(cleanChannel)) {
    return channelInfoCache.get(cleanChannel)!;
  }

  // 1. Fetch via Official Kick Public API using OAuth token if available (works 100% on serverless/cloud datacenters)
  if (token) {
    try {
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const res = await fetch(`https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(cleanChannel)}`, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const ch = data?.data?.[0] || data?.data || data;
        const bId = ch?.broadcaster_user_id ? Number(ch.broadcaster_user_id) : (ch?.user_id ? Number(ch.user_id) : null);
        if (bId) {
          const info = { chatroomId: bId, broadcasterUserId: bId };
          channelInfoCache.set(cleanChannel, info);
          return info;
        }
      }
    } catch (e) {}
  }

  // 2. Fetch live channel metadata directly from Kick API v2
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${cleanChannel}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://kick.com/',
        'Origin': 'https://kick.com'
      }
    });

    if (res.ok) {
      const data = await res.json();
      const chatroomId = data.chatroom?.id ? Number(data.chatroom.id) : null;
      const broadcasterUserId = data.user_id ? Number(data.user_id) : (data.user?.id ? Number(data.user.id) : (data.id ? Number(data.id) : null));
      if (chatroomId || broadcasterUserId) {
        const info = { chatroomId: chatroomId || broadcasterUserId || 0, broadcasterUserId: broadcasterUserId || chatroomId || 0 };
        channelInfoCache.set(cleanChannel, info);
        return info;
      }
    }
  } catch (e) {}

  // 3. Fallback to check Supabase 'Kick' table
  try {
    const { data: kickRow } = await supabase
      .from('Kick')
      .select('chatroom_id, channel_id, username')
      .ilike('username', cleanChannel)
      .maybeSingle();

    if (kickRow) {
      const cId = kickRow.chatroom_id && !isNaN(Number(kickRow.chatroom_id)) ? Number(kickRow.chatroom_id) : null;
      const bId = kickRow.channel_id && !isNaN(Number(kickRow.channel_id)) ? Number(kickRow.channel_id) : null;
      if (cId || bId) {
        return { chatroomId: cId || bId, broadcasterUserId: bId || cId };
      }
    }
  } catch (e) {}

  // 4. Secondary fallback via curl
  const curlData = await fetchWithCurl(`https://kick.com/api/v2/channels/${cleanChannel}`);
  if (curlData) {
    const chatroomId = curlData.chatroom?.id ? Number(curlData.chatroom.id) : null;
    const broadcasterUserId = curlData.user_id ? Number(curlData.user_id) : (curlData.user?.id ? Number(curlData.user.id) : (curlData.id ? Number(curlData.id) : null));
    if (chatroomId || broadcasterUserId) {
      const info = { chatroomId: chatroomId || broadcasterUserId || 0, broadcasterUserId: broadcasterUserId || chatroomId || 0 };
      channelInfoCache.set(cleanChannel, info);
      return info;
    }
  }

  // 5. Proxy fallback if serverless function is Cloudflare-blocked
  const proxies = [
    `https://corsproxy.io/?url=${encodeURIComponent(`https://kick.com/api/v2/channels/${cleanChannel}`)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://kick.com/api/v2/channels/${cleanChannel}`)}`
  ];

  for (const proxyUrl of proxies) {
    try {
      const res = await fetch(proxyUrl);
      if (res.ok) {
        const data = await res.json();
        const chatroomId = data.chatroom?.id ? Number(data.chatroom.id) : null;
        const broadcasterUserId = data.user_id ? Number(data.user_id) : (data.user?.id ? Number(data.user.id) : (data.id ? Number(data.id) : null));
        if (chatroomId || broadcasterUserId) {
          const info = { chatroomId: chatroomId || broadcasterUserId || 0, broadcasterUserId: broadcasterUserId || chatroomId || 0 };
          channelInfoCache.set(cleanChannel, info);
          return info;
        }
      }
    } catch (e) {}
  }

  return { chatroomId: null, broadcasterUserId: null };
}

async function refreshKickAccessToken(refreshToken: string, userEmail?: string): Promise<string | null> {
  if (!refreshToken) return null;
  const clientId = process.env.KICK_CLIENT_ID || '01KZGGD32S5919AGF28KSKKT1J';
  const clientSecret = process.env.KICK_CLIENT_SECRET || 'fb569011d2a1d96acd782fd08bdf472fcfaeebd46efe6876d1fd073ead084d89';

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', clientId);
    if (clientSecret) params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);

    const res = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    if (res.ok) {
      const tokenData = await res.json();
      const newAccess = tokenData.access_token;
      const newRefresh = tokenData.refresh_token || refreshToken;

      if (newAccess && userEmail) {
        try {
          await supabase.from('Kick').update({
            kick_access_token: newAccess,
            kick_refresh_token: newRefresh,
            updated_at: new Date().toISOString()
          }).eq('email', userEmail);
        } catch (e) {}
      }
      return newAccess || null;
    }
  } catch (e) {}
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'send';
    const channelSlug = body.channel || body.channelName || body.username || body.targetChannelId || '';
    const cleanChannel = (channelSlug || '').toLowerCase().replace(/^@+/, '').trim();
    const message = body.message || body.text || '';
    const reqEmail = (body.userEmail || body.email || '').toLowerCase().trim();
    const reqUserId = body.userId || body.user_id || '';
    const reqKickUser = (body.kickUser || body.senderUsername || '').toLowerCase().replace(/^@+/, '').trim();
    let kickToken = body.kickToken || body.token || body.auth_token || process.env.KICK_AUTH_TOKEN || '';
    let kickRefreshToken = body.kickRefreshToken || body.refresh_token || process.env.KICK_REFRESH_TOKEN || '';
    let kickCookie = body.kickCookie || body.cookie || process.env.KICK_COOKIE || '';
    let chatroomIdParam = body.chatroomId || body.liveChatId || '';
    let broadcasterUserIdParam = body.broadcasterUserId || body.broadcaster_user_id || null;

    let senderDbRow: any = null;

    // 1. Look up exact Kick row for requesting user's email first
    if (reqEmail) {
      try {
        const { data: userRow } = await supabase.from('Kick').select('*').eq('email', reqEmail).maybeSingle();
        if (userRow) senderDbRow = userRow;
      } catch (e) {}
    }

    // 2. Fallback lookup by user ID for sender
    if (!senderDbRow && reqUserId) {
      try {
        const { data: userRow } = await supabase.from('Kick').select('*').eq('id', reqUserId).maybeSingle();
        if (userRow) senderDbRow = userRow;
      } catch (e) {}
    }

    // 3. Fallback lookup by sender's connected Kick username
    if (!senderDbRow && reqKickUser) {
      try {
        const { data: rows } = await supabase.from('Kick').select('*').ilike('username', reqKickUser).order('updated_at', { ascending: false }).limit(1);
        if (rows && rows.length > 0) senderDbRow = rows[0];
      } catch (e) {}
    }

    // 4. Fallback lookup: query latest active connected Kick row from Supabase
    if (!senderDbRow) {
      try {
        const { data: rows } = await supabase.from('Kick').select('*').order('updated_at', { ascending: false }).limit(1);
        if (rows && rows.length > 0) senderDbRow = rows[0];
      } catch (e) {}
    }

    // Always prefer the authoritative token stored in Supabase Kick table if available
    if (senderDbRow) {
      if (senderDbRow.kick_access_token) kickToken = senderDbRow.kick_access_token;
      if (senderDbRow.kick_refresh_token) kickRefreshToken = senderDbRow.kick_refresh_token;
      if (senderDbRow.kick_cookie) kickCookie = senderDbRow.kick_cookie;
    }

    // Clean tokens of any stray whitespace or enclosing quotes
    kickToken = (kickToken || '').trim().replace(/^["']|["']$/g, '');
    kickRefreshToken = (kickRefreshToken || '').trim().replace(/^["']|["']$/g, '');

    if (!kickToken && !kickCookie) {
      return NextResponse.json({
        success: false,
        error: 'Kick Auth Token or Cookie is required to send messages on Kick. Please connect your Kick account in Settings -> Connections.'
      }, { status: 400 });
    }

    // Always resolve exact numeric IDs from channel metadata
    let numChatroomId: number | null = !isNaN(Number(chatroomIdParam)) && Number(chatroomIdParam) > 0 ? Number(chatroomIdParam) : null;
    let numBroadcasterUserId: number | null = !isNaN(Number(broadcasterUserIdParam)) && Number(broadcasterUserIdParam) > 0 ? Number(broadcasterUserIdParam) : null;

    if ((!numChatroomId || !numBroadcasterUserId) && cleanChannel) {
      const info = await fetchKickChannelInfo(cleanChannel, kickToken);
      if (!numChatroomId && info.chatroomId) numChatroomId = info.chatroomId;
      if (!numBroadcasterUserId && info.broadcasterUserId) numBroadcasterUserId = info.broadcasterUserId;
    }

    /* ================= ACTION 1: SEND MESSAGE ================= */
    if (action === 'send') {
      const finalChatroomId = numChatroomId || numBroadcasterUserId || 0;
      const finalBroadcasterId = numBroadcasterUserId || numChatroomId || 0;

      if (!finalChatroomId && !finalBroadcasterId) {
        return NextResponse.json({
          success: false,
          error: `Could not resolve numeric chatroom/broadcaster ID for Kick channel "${cleanChannel}".`
        }, { status: 400 });
      }

      console.log(`[Kick API Proxy] Posting message to Kick for ${reqEmail || 'user'} (Chatroom ID: ${finalChatroomId}, Broadcaster ID: ${finalBroadcasterId}, Channel: ${cleanChannel}): "${message}"...`);

      const sendEndpoints = [
        { 
          url: `https://api.kick.com/public/v1/chat`, 
          body: { broadcaster_user_id: Number(finalBroadcasterId), content: message, type: 'user' },
          isOfficial: true
        },
        { 
          url: `https://api.kick.com/public/v1/chat`, 
          body: { broadcaster_user_id: Number(finalBroadcasterId), content: message, type: 'bot' },
          isOfficial: true
        },
        { 
          url: `https://kick.com/api/v2/messages/send/${finalChatroomId}`, 
          body: { content: message, type: 'message' },
          isOfficial: false
        },
        { 
          url: `https://kick.com/api/v2/chatrooms/${finalChatroomId}/messages`, 
          body: { content: message },
          isOfficial: false
        }
      ];

      let lastErrorMsg = '';
      let activeToken = kickToken;
      let refreshedToken: string | null = null;

      for (let attempt = 0; attempt < 2; attempt++) {
        for (const endpoint of sendEndpoints) {
          const headers: Record<string, string> = endpoint.isOfficial ? {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': activeToken.startsWith('Bearer ') ? activeToken : `Bearer ${activeToken}`
          } : {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Referer': 'https://kick.com/',
            'Origin': 'https://kick.com',
            'Authorization': activeToken.startsWith('Bearer ') ? activeToken : `Bearer ${activeToken}`,
            ...(kickCookie ? { 'Cookie': kickCookie } : {})
          };

          try {
            const res = await fetch(endpoint.url, {
              method: 'POST',
              headers,
              body: JSON.stringify(endpoint.body)
            });

            const resText = await res.text();
            let resJson: any = null;
            try { resJson = JSON.parse(resText); } catch {}

            const isHtml = resText.includes('<html') || resText.includes('<!DOCTYPE') || resText.includes('Just a moment');
            const isSuccess = res.ok && !isHtml && resJson && !resJson.error && !resJson.errors && 
                              (resJson.data?.is_sent === true || !!resJson.data?.message_id || resJson.message === 'OK' || resJson.status === 200);

            if (isSuccess) {
              console.log(`[Kick API Proxy] Message successfully posted via endpoint: ${endpoint.url}`);
              return NextResponse.json({
                success: true,
                platform: 'kick',
                action: 'send',
                messageId: resJson?.data?.message_id || resJson?.data?.id || resJson?.id || 'kick_msg_' + Date.now(),
                chatroomId: finalChatroomId || finalBroadcasterId || undefined,
                newToken: refreshedToken || undefined,
                data: resJson || resText
              });
            }

            // Fallback via curl if node fetch gets Cloudflare-challenged or rejected
            const curlRes = await postWithCurl(endpoint.url, headers, endpoint.body);
            if (curlRes.ok) {
              console.log(`[Kick API Proxy] Message successfully posted via curl fallback: ${endpoint.url}`);
              return NextResponse.json({
                success: true,
                platform: 'kick',
                action: 'send',
                messageId: curlRes.json?.data?.message_id || curlRes.json?.data?.id || curlRes.json?.id || 'kick_msg_' + Date.now(),
                chatroomId: finalChatroomId || finalBroadcasterId || undefined,
                newToken: refreshedToken || undefined,
                data: curlRes.json || curlRes.raw
              });
            } else {
              lastErrorMsg = curlRes.json?.message || curlRes.json?.error || resJson?.message || resJson?.error || (isHtml ? 'Cloudflare challenge' : `HTTP ${res.status}: ${resText.substring(0, 100)}`);
            }
          } catch (fetchErr: any) {
            lastErrorMsg = fetchErr.message;
          }
        }

        // If initial attempt failed and we have a refresh token, auto-refresh access token!
        const tokenToRefresh = senderDbRow?.kick_refresh_token || kickRefreshToken;
        if (attempt === 0 && tokenToRefresh) {
          console.log('[Kick API Proxy] Initial token post failed, attempting OAuth refresh_token flow...');
          const freshToken = await refreshKickAccessToken(tokenToRefresh, reqEmail || senderDbRow?.email);
          if (freshToken) {
            console.log('[Kick API Proxy] Kick OAuth token refreshed successfully! Retrying send...');
            activeToken = freshToken;
            refreshedToken = freshToken;
            continue;
          }
        }
        break;
      }

      return NextResponse.json({
        success: false,
        error: `Kick Chat API notice: ${lastErrorMsg || 'Failed to post message to Kick chat. Token may be expired—please reconnect your Kick account in Settings.'}`
      }, { status: 400 });
    }

    /* ================= ACTION 2: DELETE MESSAGE ================= */
    if (action === 'delete') {
      const messageId = body.messageId || body.id;
      const targetChatroomId = numChatroomId || numBroadcasterUserId;
      if (!targetChatroomId || !messageId) {
        return NextResponse.json({ success: false, error: 'Chatroom ID and Message ID required for Kick message deletion.' }, { status: 400 });
      }

      console.log(`[Kick API Proxy] Deleting message ${messageId} in Kick chatroom ${targetChatroomId}...`);
      const delUrl = `https://kick.com/api/v2/chatrooms/${targetChatroomId}/messages/${messageId}`;
      const res = await fetch(delUrl, {
        method: 'DELETE',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Authorization': kickToken.startsWith('Bearer ') ? kickToken : `Bearer ${kickToken}`
        }
      });

      if (res.ok) {
        return NextResponse.json({ success: true, platform: 'kick', action: 'delete' });
      } else {
        return NextResponse.json({ success: false, error: `Kick message delete failed with status ${res.status}` }, { status: res.status || 400 });
      }
    }

    /* ================= ACTION 3: TIMEOUT / BAN USER ================= */
    if (action === 'timeout' || action === 'ban') {
      const targetUser = body.targetChannelId || body.targetUser || body.username || '';
      const isPermanent = action === 'ban';
      const duration = body.durationSeconds ? Math.ceil(body.durationSeconds / 60) : 5;

      console.log(`[Kick API Proxy] Executing ${action} for target: ${targetUser} on channel ${cleanChannel}...`);

      const banUrl = `https://kick.com/api/v2/channels/${cleanChannel}/bans`;
      const res = await fetch(banUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/json',
          'Authorization': kickToken.startsWith('Bearer ') ? kickToken : `Bearer ${kickToken}`
        },
        body: JSON.stringify({
          banned_user_id: targetUser,
          duration: isPermanent ? undefined : duration,
          permanent: isPermanent
        })
      });

      if (res.ok) {
        return NextResponse.json({ success: true, platform: 'kick', action });
      } else {
        return NextResponse.json({ success: false, error: `Kick ${action} failed with status ${res.status}` }, { status: res.status || 400 });
      }
    }

    return NextResponse.json({ success: false, error: `Unsupported Kick action '${action}'.` }, { status: 400 });
  } catch (err: any) {
    console.error('[Kick API Proxy] Exception:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

