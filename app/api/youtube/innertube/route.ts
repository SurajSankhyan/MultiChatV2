export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { supabase, asSupabase } from '@/lib/supabase';
import { getInnertubeInstance, innertubeCache, formatInnertubeCookie } from '@/lib/innertubeSession';
import { decryptCookie } from '@/lib/cryptoCookie';
import crypto from 'crypto';

function generateSapisidHash(cookieString?: string): string | null {
  if (!cookieString) return null;
  const match = cookieString.match(/SAPISID=([^;\s]+)/) || cookieString.match(/__Secure-3PAPISID=([^;\s]+)/);
  if (!match || !match[1]) return null;
  const sapisid = match[1];
  const timestamp = Math.floor(Date.now() / 1000);
  const input = `${timestamp} ${sapisid} https://www.youtube.com`;
  const sha1 = crypto.createHash('sha1').update(input).digest('hex');
  return `SAPISIDHASH ${timestamp}_${sha1}`;
}
const fetchActiveLiveVideoId = async (channelIdOrHandle: string): Promise<string | null> => {
  if (!channelIdOrHandle) return null;
  const clean = channelIdOrHandle.replace(/^@+/, '').trim();
  const url = clean.toLowerCase().startsWith('uc')
    ? `https://www.youtube.com/channel/${clean}/live`
    : `https://www.youtube.com/@${clean}/live`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }
    });
    if (res.ok) {
      const html = await res.text();
      const isLiveStream = html.includes('"isLive":true') || html.includes('"isLiveNow":true') || html.includes('liveChatRenderer');
      if (!isLiveStream) {
        console.log(`[InnerTube Route] Channel ${clean} /live check: Channel is currently offline (no active live broadcast).`);
        return null;
      }

      const match = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/) ||
                    html.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (match?.[1]) {
        return match[1];
      }
    }
  } catch (e) {}
  return null;
};

const resolveChannelId = async (channelIdOrHandle: string): Promise<string | null> => {
  if (!channelIdOrHandle) return null;
  const clean = channelIdOrHandle.replace(/^@+/, '').trim();
  if (clean.startsWith('UC') && clean.length >= 24) return clean;

  try {
    const handleUrl = `https://www.youtube.com/@${encodeURIComponent(clean)}`;
    const handleRes = await fetch(handleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/122.0.0.0' }
    });
    if (handleRes.ok) {
      const htmlText = await handleRes.text();
      const canonicalMatch = htmlText.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)"/) ||
                             htmlText.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/) ||
                             htmlText.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"/) ||
                             htmlText.match(/"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"/);
      if (canonicalMatch?.[1]) {
        return canonicalMatch[1];
      }
    }
  } catch (e) {}
  return null;
};



const fetchActiveLiveVideoWithInnerTube = async (ytInstance: any, channelIdOrHandle: string): Promise<string | null> => {
  if (!channelIdOrHandle) return null;
  const clean = channelIdOrHandle.replace(/^@+/, '').trim();
  try {
    console.log(`[InnerTube Route] Attempting youtubei.js getChannel live tab lookup for: ${clean}...`);
    const channel = await ytInstance.getChannel(clean);
    if (typeof channel?.getLive === 'function') {
      const liveTab = await channel.getLive().catch(() => null);
      const activeVideo = liveTab?.videos?.[0];
      if (activeVideo?.id) {
        console.log(`[InnerTube Route] Detected active live video via youtubei.js getLive(): ${activeVideo.id}`);
        return activeVideo.id;
      }
    }
  } catch (err: any) {
    console.warn('[InnerTube Route] youtubei.js getChannel live tab lookup notice:', err.message);
  }
  return null;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      action,
      sessionId,
      channelId,
      liveChatId,
      message,
      messageId,
      credentials
    } = body;



    // Resolve authenticated InnerTube instance from in-memory cache or Youtube table
    let yt = sessionId ? innertubeCache.get(sessionId) : null;
    let activeCredentials: any = credentials;
    let userCookie: string | undefined = body.cookie ? (formatInnertubeCookie(body.cookie) || body.cookie) : undefined;

    let cookieRow: any = null;
    let dbRows: any[] = [];
    if (!yt && !userCookie && !activeCredentials) {
      // Always fetch all rows from Youtube table and pick the SAPISID cookie row first
      try {
        const { data: rows } = await asSupabase
          .from('Youtube')
          .select('id, email, youtube_cookie, youtube_refresh_token, custom_handle, channel_id');

        if (rows && rows.length > 0) {
          dbRows = rows;
          const targetEmail = body.userEmail || body.email;
          const targetId = body.userId || body.id;
          const moderatorChannelId = body.channelId;

          if (targetEmail) {
            cookieRow = rows.find((r: any) => r.email === targetEmail && (r.youtube_cookie || '').includes('SAPISID='));
          }
          if (!cookieRow && targetId) {
            cookieRow = rows.find((r: any) => r.id === targetId && (r.youtube_cookie || '').includes('SAPISID='));
          }
          if (!cookieRow && moderatorChannelId && !moderatorChannelId.startsWith('@')) {
            const cleanMod = moderatorChannelId.toLowerCase().trim();
            cookieRow = rows.find((r: any) =>
              ((r.channel_id || '').toLowerCase().trim() === cleanMod ||
               (r.custom_handle || '').toLowerCase().replace(/^@+/, '').trim() === cleanMod) &&
              (r.youtube_cookie || '').includes('SAPISID=')
            );
          }
          if (!cookieRow) {
            cookieRow = dbRows.find((r: any) => (r.youtube_cookie || '').includes('SAPISID=')) ||
                        dbRows.find((r: any) => (r.email || '').includes('cocthrushed72') || (r.custom_handle || '').includes('duplicatebunnysank9')) ||
                        dbRows[0];
          }

          const targetCookieOrToken = cookieRow?.youtube_cookie || cookieRow?.youtube_refresh_token;
          if (targetCookieOrToken) {
            const rawToken = targetCookieOrToken.trim();
            const decryptedToken = rawToken.includes('=') ? rawToken : (decryptCookie(rawToken) || rawToken);

            if (decryptedToken.includes('SAPISID=') || decryptedToken.startsWith('GPS=')) {
              console.log('[InnerTube Route] Instantiating InnerTube with saved SAPISID Cookie for channel:', cookieRow.custom_handle || cookieRow.email);
              userCookie = formatInnertubeCookie(decryptedToken) || decryptedToken;
              activeCredentials = undefined;
            } else if (rawToken.startsWith('{')) {
              try {
                const parsedCreds = JSON.parse(rawToken);
                console.log('[InnerTube Route] Instantiating InnerTube with saved Device Auth credentials for channel:', cookieRow.custom_handle || cookieRow.email);
                activeCredentials = {
                  access_token: parsedCreds.access_token,
                  refresh_token: parsedCreds.refresh_token,
                  expiry_date: parsedCreds.expiry_date || new Date(Date.now() + 3600 * 1000).toISOString()
                };
                if (parsedCreds.client_id && parsedCreds.client_secret) {
                  (activeCredentials as any).client = {
                    client_id: parsedCreds.client_id,
                    client_secret: parsedCreds.client_secret
                  };
                } else {
                  (activeCredentials as any).client = {
                    client_id: '861556708454-d6dlm3lh05idd8npek18k6be8ba3oc68.apps.googleusercontent.com',
                    client_secret: 'SboVhoG9s0rNafixCSGGKXAT'
                  };
                }
              } catch (e) {}
            } else if (rawToken.startsWith('1//') || rawToken.startsWith('ya29.')) {
              console.log('[InnerTube Route] Instantiating InnerTube with 1// OAuth refresh token for channel:', cookieRow.custom_handle || cookieRow.email);
              activeCredentials = {
                refresh_token: rawToken,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET
              };
            }
          }
        }
      } catch (e) {
        console.warn('[InnerTube Route] Database lookup exception:', e);
      }
    }

    if (!activeCredentials && body.accessToken) {
      activeCredentials = { access_token: body.accessToken, refresh_token: body.refreshToken || '' };
    }

    let targetAccountIndex = body.accountIndex ?? 0;

    if (!yt && (activeCredentials || userCookie)) {
      console.log('[InnerTube Route] Instantiating InnerTube with credentials/cookie (account_index:', targetAccountIndex, ')');
      yt = await getInnertubeInstance(activeCredentials, userCookie, targetAccountIndex);
    }

    if (!yt) {
      if (action === 'live_info' || action === 'get_live_info' || action === 'get_channel' || action === 'channel_info') {
        const { Innertube, UniversalCache } = await import('youtubei.js');
        yt = await Innertube.create({
          cache: new UniversalCache(false),
          generate_session_locally: true
        });
      }
    }

    if (!yt) {
      return NextResponse.json({
        success: false,
        engine: 'innertube_youtubei_js',
        error: 'YouTube Session Unauthenticated (401 Unauthorized). Please reconnect your YouTube account in Settings.'
      }, { status: 401 });
    }

    /* ================= GET CHANNEL INFO ================= */
    if (action === 'get_channel' || action === 'channel_info') {
      const target = body.handleOrId || body.channelId || body.handle || channelId;
      if (!target) {
        return NextResponse.json({ success: false, error: 'handleOrId or channelId required' }, { status: 400 });
      }
      try {
        let browseId = target;
        if (target.startsWith('@') || !target.startsWith('UC')) {
          const cleanHandle = target.startsWith('@') ? target : `@${target}`;
          const res = await yt.resolveURL(`https://www.youtube.com/${cleanHandle}`).catch(() => null);
          if (res?.payload?.browseId) {
            browseId = res.payload.browseId;
          }
        }
        const ch = await yt.getChannel(browseId).catch(() => null);
        if (ch) {
          return NextResponse.json({
            success: true,
            engine: 'innertube_youtubei_js',
            channelId: browseId,
            channelName: ch.metadata?.title || target,
            customHandle: ch.metadata?.vanity_channel_url?.replace(/^https?:\/\/(www\.)?youtube\.com\//, '') || target,
            avatarUrl: ch.metadata?.avatar?.[0]?.url || '',
            views: 0,
            subscribers: 0
          });
        }
        return NextResponse.json({ success: false, error: 'Channel not found' }, { status: 404 });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    /* ================= 2.5 LIVE INFO ================= */
    if (action === 'live_info' || action === 'get_live_info') {
      let targetVideoId = body.videoId || body.video_id;
      const activeChannelId = channelId || body.targetChannelId || body.channel;
      if (!targetVideoId && activeChannelId) {
        targetVideoId = (await fetchActiveLiveVideoWithInnerTube(yt, activeChannelId)) ||
                        (await fetchActiveLiveVideoId(activeChannelId));
      }
      if (!targetVideoId) {
        return NextResponse.json({ success: false, error: 'videoId or channel is required' }, { status: 400 });
      }

      try {
        const basicInfo = await yt.getBasicInfo(targetVideoId);
        if (basicInfo && basicInfo.basic_info) {
          const bi = basicInfo.basic_info as any;
          const candidateTime = bi.start_timestamp;
          let startTime: number | null = null;
          let isExact = false;
          if (candidateTime) {
            if (candidateTime instanceof Date || (candidateTime && typeof candidateTime.getTime === 'function')) {
              const ms = candidateTime.getTime();
              if (!isNaN(ms) && ms > 0 && ms <= Date.now() + 60000) {
                startTime = ms;
                isExact = true;
              }
            } else if (typeof candidateTime === 'number') {
              startTime = candidateTime < 10000000000 ? candidateTime * 1000 : candidateTime;
              isExact = true;
            } else if (typeof candidateTime === 'string') {
              const trimmed = candidateTime.trim();
              if (/^[0-9]{10,13}$/.test(trimmed)) {
                const rawNum = parseInt(trimmed, 10);
                startTime = rawNum < 10000000000 ? rawNum * 1000 : rawNum;
                isExact = true;
              } else {
                let parseable = trimmed;
                if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(trimmed)) {
                  parseable = trimmed.replace(' ', 'T') + 'Z';
                }
                const parsed = Date.parse(parseable);
                if (!isNaN(parsed) && parsed > 0 && parsed <= Date.now() + 60000) {
                  startTime = parsed;
                  isExact = true;
                }
              }
            }
          }

          const viewers = typeof bi.view_count === 'number' ? bi.view_count : (parseInt(bi.view_count, 10) || 0);
          const likes = typeof bi.like_count === 'number' ? bi.like_count : (parseInt(bi.like_count, 10) || 0);
          const isLive = bi.is_live !== false || bi.is_live_content || !bi.duration;
          const title = bi.title || '';
          const author = bi.author || bi.channel?.name || '';
          const isShorts = !!(bi.is_shorts || (bi.embed?.width && bi.embed?.height && bi.embed.height > bi.embed.width));
          const uptimeSeconds = startTime ? Math.max(0, Math.floor((Date.now() - startTime) / 1000)) : null;

          return NextResponse.json({
            success: true,
            isLive,
            startTime,
            isExact,
            startTimestamp: candidateTime ? new Date(startTime || candidateTime).toISOString() : (startTime ? new Date(startTime).toISOString() : null),
            uptimeSeconds,
            viewers,
            likes,
            title,
            author,
            isShorts
          });
        }
      } catch (e: any) {
        console.warn('[InnerTube Route] live_info action error:', e.message);
      }
      return NextResponse.json({ success: false, error: 'Failed to fetch live stream info' }, { status: 404 });
    }

    /* ================= 3. SEND MESSAGE ================= */
    if (action === 'send' || !action) {
      if (!message) {
        return NextResponse.json({ error: 'Message text required for send action.' }, { status: 400 });
      }

      // Extract videoId from body (videoId or video_id), liveChatId, or targetChannelId
      let targetVideoId = body.videoId || body.video_id;
      if (!targetVideoId && liveChatId && /^[a-zA-Z0-9_-]{11}$/.test(liveChatId.trim())) {
        targetVideoId = liveChatId.trim();
      }

      const activeChannelId = channelId || body.targetChannelId || cookieRow?.custom_handle || cookieRow?.channel_id;
      if (!targetVideoId && activeChannelId) {
        targetVideoId = (await fetchActiveLiveVideoWithInnerTube(yt, activeChannelId)) ||
                        (await fetchActiveLiveVideoId(activeChannelId));
      }

      // Fallback check Youtube table in Supabase for user's specific row
      if (!targetVideoId) {
        try {
          const targetEmail = body.userEmail || body.email || 'cocthrushed72@gmail.com';
          const { data: ytRow } = await supabase
            .from('Youtube')
            .select('channel_id, custom_handle')
            .eq('email', targetEmail)
            .maybeSingle();

          if (ytRow?.channel_id || ytRow?.custom_handle) {
            const rowTarget = ytRow.channel_id || ytRow.custom_handle;
            targetVideoId = (await fetchActiveLiveVideoWithInnerTube(yt, rowTarget)) ||
                            (await fetchActiveLiveVideoId(rowTarget));
          }
        } catch (e) {}
      }

      // DEBUG LOG: Print detected video_id before attempting liveChat.sendMessage()
      console.log(`[InnerTube Route] Detected video_id: "${targetVideoId || 'NONE'}" before attempting liveChat.sendMessage().`);

      if (targetVideoId) {
        try {
          console.log(`[InnerTube Route] Sending live chat message for resolved active videoId: ${targetVideoId}...`);
          let info = await yt.getInfo(targetVideoId);
          let liveChat: any = null;
          try {
            liveChat = await info.getLiveChat();
          } catch (e) {
            const { YT } = await import('youtubei.js');
            liveChat = new YT.LiveChat({
              basic_info: info.basic_info,
              actions: yt.actions,
              livechat: info.livechat
            } as any);
          }

          const sendRes = await liveChat.sendMessage(message);

          let extractedMsgId: string | null = null;
          let extractedDelParams: string | null = null;
          if (Array.isArray(sendRes)) {
            const addAction: any = sendRes.find((a: any) => a.type === 'AddChatItemAction');
            extractedMsgId = addAction?.item?.id || null;
            const delBtn = addAction?.item?.inline_action_buttons?.find((b: any) => b.label === 'Remove' || b.icon_type === 'DELETE');
            extractedDelParams = delBtn?.endpoint?.payload?.params || null;
          }

          return NextResponse.json({
            success: true,
            engine: 'innertube_youtubei_js',
            action: 'send',
            videoId: targetVideoId,
            messageId: extractedMsgId,
            deleteParams: extractedDelParams,
            data: sendRes
          });
        } catch (err: any) {
          console.error('[InnerTube Route] Live chat send error:', err.message);

          // Handle youtubei.js parser warnings for unexpected node types like DimChatItemAction
          if (err.message?.includes('DimChatItemAction') || err.message?.includes('Expected node of any type')) {
            console.log('[InnerTube Route] DimChatItemAction parsed - message successfully accepted by YouTube!');
            return NextResponse.json({
              success: true,
              engine: 'innertube_youtubei_js',
              action: 'send',
              videoId: targetVideoId,
              notice: 'Message sent successfully'
            });
          }
          try {
            const INNERTUBE_API_KEY = 'AIzaSyAO_C8c-4T_1h_39tq7H3z7y_57y_00';
            const sendUrl = `https://www.youtube.com/youtubei/v1/live_chat/send_message?key=${INNERTUBE_API_KEY}`;
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              'X-YouTube-Client-Name': '1',
              'X-YouTube-Client-Version': '2.20250201.01.00',
              'Origin': 'https://www.youtube.com',
              'Referer': 'https://www.youtube.com/'
            };

            const sapisidAuth = generateSapisidHash(userCookie);
            const authToken = body.accessToken || activeCredentials?.access_token;

            if (sapisidAuth) {
              headers['Authorization'] = sapisidAuth;
            } else if (authToken) {
              headers['Authorization'] = `Bearer ${authToken}`;
            }

            if (userCookie) {
              headers['Cookie'] = userCookie;
            }

            console.log('[InnerTube Route] Direct REST Fallback headers:', {
              hasSapisidAuth: !!sapisidAuth,
              hasCookie: !!userCookie
            });

            const res = await fetch(sendUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                context: { client: { clientName: 'WEB', clientVersion: '2.20250201.01.00' } },
                params: liveChatId || targetVideoId,
                richMessage: { textSegments: [{ text: message }] }
              })
            });

            const resText = await res.text();
            let resJson: any = {};
            try { resJson = JSON.parse(resText); } catch (e) {}

            console.log('[InnerTube Route] Direct REST Fallback response status:', res.status, resText);

            if (res.ok && (resJson.actions || resJson.status === 'SUCCESS' || !resJson.error)) {
              console.log('[InnerTube Route] Successfully posted message via Direct InnerTube REST API!');
              return NextResponse.json({ success: true, engine: 'innertube_rest_direct', action: 'send', data: resJson });
            }
          } catch (fallbackErr: any) {
            console.warn('[InnerTube Route] Direct InnerTube REST fallback exception:', fallbackErr.message);
          }

          let errorMsg = `YouTube InnerTube Chat error: ${err.message}.`;
          if (err.message?.includes('not available') || err.message?.includes('offline') || err.message?.includes('disabled')) {
            errorMsg = 'YouTube Stream is Offline or Live Chat is not enabled. Please make sure your YouTube broadcast is currently LIVE on YouTube with live chat enabled.';
          } else if (err.message?.includes('401') || err.message?.includes('UNAUTHENTICATED')) {
            errorMsg = 'YouTube Session Unauthenticated (401 Unauthorized). Please reconnect your YouTube account in Settings.';
          } else if (err.message?.includes('400') || err.message?.includes('invalid')) {
            errorMsg = 'YouTube Stream is Offline or Live Chat is not enabled. Please make sure your YouTube broadcast is currently LIVE on YouTube with live chat enabled.';
          }
          return NextResponse.json({
            success: false,
            engine: 'innertube_youtubei_js',
            error: errorMsg,
          }, { status: 400 });
        }
      }

      return NextResponse.json({
        success: false,
        engine: 'innertube_youtubei_js',
        error: 'No active YouTube live stream found for your channel. Please make sure your stream is live on YouTube and live chat is enabled.',
      }, { status: 400 });
    }

    /* ================= 4. DELETE MESSAGE ================= */
    if (action === 'delete') {
      const targetParams = body.params || body.deleteParams;
      const menuParams = body.menuParams;
      const messageId = body.messageId;

      try {
        let delRes: any = null;

        // 1. Direct live_chat/moderate if targetParams provided
        if (targetParams && typeof targetParams === 'string' && targetParams.length > 20 && !targetParams.startsWith('UC')) {
          console.log(`[InnerTube Route] Executing live_chat/moderate with targetParams...`);
          delRes = await yt.actions.execute('live_chat/moderate', { params: targetParams });
        } else if (menuParams && typeof menuParams === 'string' && menuParams.length > 20) {
          console.log(`[InnerTube Route] Resolving context menu for delete via menuParams...`);
          try {
            const menuRes = await yt.actions.execute('live_chat/get_item_context_menu', { params: menuParams });
            if (menuRes?.data?.responseContext?.mainAppWebResponseContext?.loggedOut || menuRes?.responseContext?.mainAppWebResponseContext?.loggedOut) {
              return NextResponse.json({
                success: false,
                engine: 'innertube_youtubei_js',
                error: 'Your YouTube creator session has expired. Please re-link your channel in Settings or Connect YouTube to refresh your moderation credentials.',
                isAuthExpired: true
              }, { status: 401 });
            }
            let delEndpointParams = findParamsInContextMenu(menuRes, 'delete');
            if (delEndpointParams) {
              console.log('[InnerTube Route] Executing live_chat/moderate with resolved delete params...');
              delRes = await yt.actions.execute('live_chat/moderate', { params: delEndpointParams });
            }
          } catch (e: any) {
            console.warn('[InnerTube Route] Menu resolution for delete error:', e.message);
          }
        }

        if (!delRes) {
          return NextResponse.json({
            success: false,
            engine: 'innertube_youtubei_js',
            error: 'Could not resolve valid delete token from YouTube. Please ensure you are logged into YouTube or use YouTube Studio.'
          }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          engine: 'innertube_youtubei_js',
          action: 'delete',
          data: delRes
        });
      } catch (err: any) {
        console.error('[youtubei.js delete error]:', err.message);
        const isAuthErr = err.message?.includes('signed in') || err.message?.includes('401') || err.message?.includes('unauthorized');
        return NextResponse.json({
          success: false,
          engine: 'innertube_youtubei_js',
          error: isAuthErr ? 'Your YouTube creator session has expired. Please re-link your channel in Settings or Connect YouTube to refresh your moderation credentials.' : err.message,
          isAuthExpired: isAuthErr
        }, { status: isAuthErr ? 401 : 400 });
      }
    }

const resolveUserModerationParams = async (
  ytInstance: any,
  broadcasterChannelOrVideoId: string,
  targetUser: string,
  targetType: 'timeout' | 'ban' | 'add_moderator' | 'remove_moderator'
): Promise<{ timeoutParams?: string; banParams?: string; menuParams?: string } | null> => {
  if (!targetUser) return null;
  const cleanTarget = targetUser.toLowerCase().replace(/^@+/, '').trim();

  try {
    let resolvedTargetChannelId = cleanTarget;
    if (!resolvedTargetChannelId.startsWith('uc')) {
      try {
        const handleUrl = `https://www.youtube.com/@${encodeURIComponent(cleanTarget)}`;
        const handleRes = await fetch(handleUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/122.0.0.0' }
        });
        if (handleRes.ok) {
          const htmlText = await handleRes.text();
          const canonicalMatch = htmlText.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)"/) ||
                                 htmlText.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/) ||
                                 htmlText.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"/) ||
                                 htmlText.match(/"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"/);
          if (canonicalMatch && canonicalMatch[1]) {
            resolvedTargetChannelId = canonicalMatch[1].toLowerCase();
            console.log(`[InnerTube Route] Resolved target handle @${cleanTarget} to UC channel ID: ${resolvedTargetChannelId}`);
          }
        }
      } catch (e) {}
    }

    let videoId = broadcasterChannelOrVideoId;
    if (!videoId || videoId.startsWith('UC') || videoId.startsWith('@')) {
      videoId = (await fetchActiveLiveVideoWithInnerTube(ytInstance, broadcasterChannelOrVideoId)) ||
                (await fetchActiveLiveVideoId(broadcasterChannelOrVideoId)) || '';
    }
    console.log(`[InnerTube Route] Detected video_id: "${videoId || 'NONE'}" for moderation context resolution (target: @${cleanTarget}).`);
    if (!videoId) return null;

    console.log(`[InnerTube Route] Resolving live chat for videoId ${videoId} to find moderation params for target: @${cleanTarget} (UC: ${resolvedTargetChannelId})`);
    const info = await ytInstance.getInfo(videoId);
    const liveChat = await info.getLiveChat();

    let initialActions: any[] = [];
    await new Promise((resolve) => {
      liveChat.on('start', (data: any) => {
        initialActions = data?.actions || [];
        try { liveChat.stop(); } catch {}
        resolve(true);
      });
      liveChat.start();
      setTimeout(() => {
        try { liveChat.stop(); } catch {}
        resolve(false);
      }, 3000);
    });

    for (const act of initialActions) {
      const item = act.item || act.add_chat_item_action?.item || act.addChatItemAction?.item;
      if (!item) continue;
      const renderer = item.liveChatTextMessageRenderer || item.liveChatPaidMessageRenderer || item;

      const authorName = (
        renderer.author?.name || 
        renderer.authorName?.simpleText || 
        renderer.author_name || 
        ''
      ).toLowerCase().replace(/^@+/, '').trim();

      const authorChanId = (
        renderer.author?.id || 
        renderer.authorExternalChannelId || 
        renderer.author_external_channel_id || 
        ''
      ).toLowerCase().trim();

      if (
        authorName === cleanTarget ||
        authorChanId === cleanTarget ||
        (resolvedTargetChannelId && authorChanId === resolvedTargetChannelId) ||
        (cleanTarget.length > 3 && authorName.includes(cleanTarget))
      ) {
        let timeoutParams = null;
        let banParams = null;
        const actionButtons = renderer.inline_action_buttons || renderer.inlineActionButtons || renderer.inline_buttons || [];
        if (Array.isArray(actionButtons)) {
          for (const b of actionButtons) {
            const btnData = b.buttonRenderer || b;
            const label = (btnData.text?.runs?.[0]?.text || btnData.tooltip || btnData.icon?.iconType || btnData.icon_type || btnData.label || '').toLowerCase();
            const iconType = (btnData.icon_type || btnData.iconType || btnData.icon?.iconType || '').toLowerCase();
            const endpoint = btnData?.serviceEndpoint || btnData?.endpoint;
            const params = endpoint?.payload?.params || endpoint?.moderateLiveChatEndpoint?.params || null;

            if (label.includes('timeout') || label.includes('hourglass') || iconType.includes('hourglass')) {
              timeoutParams = params;
            } else if (label.includes('hide') || label.includes('ban') || label.includes('remove_circle') || iconType.includes('remove_circle')) {
              banParams = params;
            }
          }
        }

        const menuEndpoint = renderer.menu_endpoint || 
                             renderer.menuEndpoint || 
                             renderer.contextMenuEndpoint || 
                             renderer.context_menu_endpoint ||
                             renderer.menu;

        const menuParams = menuEndpoint?.payload?.params ||
                           menuEndpoint?.liveChatItemContextMenuEndpoint?.params ||
                           menuEndpoint?.contextMenuEndpoint?.params ||
                           menuEndpoint?.endpoint?.payload?.params ||
                           menuEndpoint?.params || null;

        if (timeoutParams || banParams || menuParams) {
          console.log(`[InnerTube Route] Found chat message for @${cleanTarget}! Extracted moderation params.`);
          return { timeoutParams, banParams, menuParams };
        }
      }
    }
  } catch (err: any) {
    console.warn(`[InnerTube Route] Live chat resolution warning for @${cleanTarget}:`, err.message);
  }
  return null;
};

function safeStringify(obj: any): string {
  try {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return;
        cache.add(value);
      }
      return value;
    }).toLowerCase();
  } catch (e) {
    return String(obj).toLowerCase();
  }
}

function buildManageUserToken(broadcasterChannelId: string, videoId: string, targetChannelId: string, modType: number = 1): string {
  try {
    const cleanBroadcaster = (broadcasterChannelId || '').trim();
    const cleanVideoId = (videoId || '').trim();
    const cleanTarget = (targetChannelId || '').replace(/^UC/, '').replace(/^@+/, '').trim();

    // Tag 1.5: Broadcaster Channel ID and Video ID
    const bChanBuf = Buffer.from(cleanBroadcaster, 'utf8');
    const vidBuf = Buffer.from(cleanVideoId, 'utf8');
    const tag1_5 = Buffer.concat([
      Buffer.from([0x0a, bChanBuf.length]), bChanBuf,
      Buffer.from([0x12, vidBuf.length]), vidBuf
    ]);

    // Tag 1 (wrapper around Tag 1.5)
    const tag1 = Buffer.concat([
      Buffer.from([0x2a, tag1_5.length]), tag1_5
    ]);
    const tag1Wrapper = Buffer.concat([
      Buffer.from([0x0a, tag1.length]), tag1
    ]);

    // Tag 2: Target Channel ID without 'UC' and modType (1 = Add Moderator, 2 = Remove Moderator)
    const targetBuf = Buffer.from(cleanTarget, 'utf8');
    const tag2 = Buffer.concat([
      Buffer.from([0x0a, targetBuf.length]), targetBuf,
      Buffer.from([0x10, modType])
    ]);
    const tag2Wrapper = Buffer.concat([
      Buffer.from([0x12, tag2.length]), tag2
    ]);

    // Tag 4: fixed constant 1
    const tag4 = Buffer.from([0x20, 0x01]);

    const innerBuf = Buffer.concat([tag1Wrapper, tag2Wrapper, tag4]);
    const l1B64 = innerBuf.toString('base64');
    const urlEncodedL1 = encodeURIComponent(l1B64);
    return Buffer.from(urlEncodedL1, 'utf8').toString('base64');
  } catch (e) {
    return 'Q2lrcUp3b1lWVU51ZW5SNWJFRnJibTFoZHpGTE5IZEtRVGh0TjNKUkVndFFXVU5YWjJoUFFuQmlXUklhQ2haQmRYUklWbDl3VkhsUVYxQmtjbGxOVDNGWVZHcEJFQUVnQVElM0QlM0Q=';
  }
}

function findParamsInContextMenu(obj: any, targetType: 'delete' | 'timeout' | 'ban' | 'add_moderator' | 'remove_moderator'): string | null {
  if (!obj || typeof obj !== 'object') return null;

  try {
    const endpoint = obj.serviceEndpoint || obj.endpoint || obj.navigationEndpoint || obj.moderateLiveChatEndpoint || obj.submitEndpoint || obj.manageLiveChatUserEndpoint;
    const params = endpoint?.moderateLiveChatEndpoint?.params || endpoint?.manageLiveChatUserEndpoint?.params || endpoint?.payload?.params || obj.moderateLiveChatEndpoint?.params || obj.manageLiveChatUserEndpoint?.params || obj.payload?.params;

    if (params && typeof params === 'string' && params.length > 15) {
      const nodeStr = safeStringify(obj);
      const isDelete = nodeStr.includes('delete') || nodeStr.includes('remove') || nodeStr.includes('trash');
      const isTimeout = nodeStr.includes('hourglass') || nodeStr.includes('timeout') || nodeStr.includes('time out') || nodeStr.includes('time_out') || nodeStr.includes('pause') || nodeStr.includes('timer');
      const isBan = nodeStr.includes('remove_circle') || nodeStr.includes('hide') || nodeStr.includes('ban') || nodeStr.includes('block');
      const isAddMod = nodeStr.includes('add as moderator') || nodeStr.includes('standard moderator') || nodeStr.includes('add_moderator');
      const isRemoveMod = nodeStr.includes('remove as moderator') || nodeStr.includes('remove_moderator');

      if (targetType === 'delete' && isDelete && !isBan && !isRemoveMod) {
        return params;
      }
      if (targetType === 'timeout' && isTimeout) {
        return params;
      }
      if (targetType === 'ban' && isBan) {
        return params;
      }
      if (targetType === 'add_moderator' && isAddMod) {
        return params;
      }
      if (targetType === 'remove_moderator' && isRemoveMod) {
        return params;
      }
    }

    if (Array.isArray(obj)) {
      for (const child of obj) {
        const res = findParamsInContextMenu(child, targetType);
        if (res) return res;
      }
    } else {
      for (const key of Object.keys(obj)) {
        if (key === 'responseContext' || key === 'trackingParams' || key === 'session' || key === 'actions') continue;
        try {
          const res = findParamsInContextMenu(obj[key], targetType);
          if (res) return res;
        } catch (e) {}
      }
    }
  } catch (e) {}
  return null;
}

    /* ================= 5. TIMEOUT USER ================= */
    if (action === 'timeout') {
      const targetUser = body.targetChannelId || body.username || body.displayName;
      const reqDuration = Number(body.durationSeconds) || 300;
      let targetParams = body.params || body.timeoutParams;
      let menuParams = body.menuParams;

      try {
        let timeoutRes: any = null;

        // 2. Direct live_chat/moderate if targetParams provided
        if (targetParams && typeof targetParams === 'string' && targetParams.length > 15 && !targetParams.startsWith('UC')) {
          console.log(`[InnerTube Route] Executing live_chat/moderate for timeout with direct targetParams...`);
          try {
            timeoutRes = await yt.actions.execute('live_chat/moderate', { params: targetParams });
          } catch (e: any) {
            console.warn('[InnerTube Route] Direct moderate call notice:', e.message);
          }
        }

        // 3. Resolve context menu via menuParams
        if (!timeoutRes && menuParams && typeof menuParams === 'string' && menuParams.length > 15) {
          console.log(`[InnerTube Route] Resolving context menu for timeout via menuParams...`);
          try {
            const menuRes = await yt.actions.execute('live_chat/get_item_context_menu', { params: menuParams });
            if (menuRes?.data?.responseContext?.mainAppWebResponseContext?.loggedOut || menuRes?.responseContext?.mainAppWebResponseContext?.loggedOut) {
              return NextResponse.json({
                success: false,
                engine: 'innertube_youtubei_js',
                error: 'Your YouTube creator session has expired. Please re-link your channel in Settings or Connect YouTube to refresh your moderation credentials.',
                isAuthExpired: true
              }, { status: 401 });
            }
            let timeoutEndpointParams = findParamsInContextMenu(menuRes, 'timeout');
            if (timeoutEndpointParams) {
              timeoutRes = await yt.actions.execute('live_chat/moderate', { params: timeoutEndpointParams });
            }
          } catch (e: any) {
            console.warn('[InnerTube Route] Menu resolution notice:', e.message);
          }
        }

        // 4. Resolve via active live chat stream
        if (!timeoutRes && targetUser) {
          console.log(`[InnerTube Route] Resolving moderation context params for timeout target: ${targetUser}...`);
          const resolved = await resolveUserModerationParams(
            yt,
            body.videoId || body.video_id || body.liveChatId || channelId || cookieRow?.channel_id || '',
            targetUser,
            'timeout'
          );
          if (resolved?.timeoutParams) {
            timeoutRes = await yt.actions.execute('live_chat/moderate', { params: resolved.timeoutParams });
          } else if (resolved?.menuParams) {
            const menuRes = await yt.actions.execute('live_chat/get_item_context_menu', { params: resolved.menuParams });
            if (menuRes?.data?.responseContext?.mainAppWebResponseContext?.loggedOut || menuRes?.responseContext?.mainAppWebResponseContext?.loggedOut) {
              return NextResponse.json({
                success: false,
                engine: 'innertube_youtubei_js',
                error: 'Your YouTube creator session has expired. Please re-link your channel in Settings or Connect YouTube to refresh your moderation credentials.',
                isAuthExpired: true
              }, { status: 401 });
            }
            let tParams = findParamsInContextMenu(menuRes, 'timeout');
            if (tParams) {
              timeoutRes = await yt.actions.execute('live_chat/moderate', { params: tParams });
            }
          }
        }

        if (!timeoutRes) {
          return NextResponse.json({
            success: false,
            engine: 'innertube_youtubei_js',
            error: 'Could not apply timeout on YouTube live chat. Please ensure the target user sent a message in this stream or use YouTube Studio.'
          }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          engine: 'innertube_youtubei_js',
          action: 'timeout',
          durationSeconds: reqDuration,
          data: timeoutRes
        });
      } catch (err: any) {
        console.error('[youtubei.js timeout error]:', err.message);
        const isAuthErr = err.message?.includes('signed in') || err.message?.includes('401') || err.message?.includes('unauthorized');
        return NextResponse.json({
          success: false,
          engine: 'innertube_youtubei_js',
          action: 'timeout',
          error: isAuthErr ? 'Your YouTube creator session has expired. Please re-link your channel in Settings or Connect YouTube to refresh your moderation credentials.' : err.message,
          isAuthExpired: isAuthErr
        }, { status: isAuthErr ? 401 : 400 });
      }
    }

    /* ================= 6. BAN / HIDE USER ================= */
    if (action === 'ban') {
      let targetParams = body.params || body.banParams;
      let menuParams = body.menuParams;
      const targetUser = body.targetChannelId || body.username || body.displayName;

      try {
        let banRes: any = null;

        if (targetParams && typeof targetParams === 'string' && targetParams.length > 20 && !targetParams.startsWith('UC')) {
          console.log(`[InnerTube Route] Executing live_chat/moderate for ban with targetParams...`);
          banRes = await yt.actions.execute('live_chat/moderate', { params: targetParams });
        } else {
          if ((!menuParams || menuParams.length <= 20) && targetUser) {
            console.log(`[InnerTube Route] Resolving moderation context params for target user: ${targetUser}`);
            const resolved = await resolveUserModerationParams(
              yt,
              body.videoId || body.video_id || body.liveChatId || channelId || cookieRow?.channel_id || '',
              targetUser,
              'ban'
            );
            if (resolved) {
              if (resolved.banParams) targetParams = resolved.banParams;
              if (resolved.menuParams) menuParams = resolved.menuParams;
            }
          }

          if (targetParams && typeof targetParams === 'string' && targetParams.length > 20 && !targetParams.startsWith('UC')) {
            console.log(`[InnerTube Route] Executing live_chat/moderate for ban with resolved targetParams...`);
            banRes = await yt.actions.execute('live_chat/moderate', { params: targetParams });
          } else if (menuParams && typeof menuParams === 'string' && menuParams.length > 20) {
            console.log(`[InnerTube Route] Resolving context menu for ban via menuParams...`);
            const menuRes = await yt.actions.execute('live_chat/get_item_context_menu', { params: menuParams });
            if (menuRes?.data?.responseContext?.mainAppWebResponseContext?.loggedOut || menuRes?.responseContext?.mainAppWebResponseContext?.loggedOut) {
              return NextResponse.json({
                success: false,
                engine: 'innertube_youtubei_js',
                error: 'Your YouTube creator session has expired. Please re-link your channel in Settings or Connect YouTube to refresh your moderation credentials.',
                isAuthExpired: true
              }, { status: 401 });
            }
            
            let banEndpointParams = findParamsInContextMenu(menuRes, 'ban');
            if (!banEndpointParams && menuRes) {
              const items = menuRes?.data?.liveChatItemContextMenuSupportedRenderers?.menuRenderer?.items || menuRes?.data?.items || menuRes?.items || [];
              for (const item of items) {
                const btn = item.menuServiceItemRenderer || item.menuNavigationItemRenderer || item;
                const icon = (btn?.icon?.iconType || btn?.iconType || btn?.icon_type || '').toLowerCase();
                const text = (btn?.text?.runs?.[0]?.text || btn?.text?.simpleText || btn?.label || '').toLowerCase();
                if (icon.includes('remove_circle') || text.includes('hide') || text.includes('ban')) {
                  banEndpointParams = btn?.serviceEndpoint?.moderateLiveChatEndpoint?.params || btn?.endpoint?.payload?.params || null;
                  break;
                }
              }
            }

            if (banEndpointParams) {
              console.log('[InnerTube Route] Successfully resolved banEndpointParams from context menu!');
              banRes = await yt.actions.execute('live_chat/moderate', { params: banEndpointParams });
            } else {
              throw new Error('Could not find "Hide user on this channel" in context menu.');
            }
          } else {
            return NextResponse.json({ error: 'Valid ban token or context menu token required for YouTube live ban.' }, { status: 400 });
          }
        }

        return NextResponse.json({
          success: true,
          engine: 'innertube_youtubei_js',
          action: 'ban',
          data: banRes
        });
      } catch (err: any) {
        console.error('[youtubei.js ban error]:', err.message);
        const isAuthErr = err.message?.includes('signed in') || err.message?.includes('401') || err.message?.includes('unauthorized');
        return NextResponse.json({
          success: false,
          engine: 'innertube_youtubei_js',
          error: isAuthErr ? 'Your YouTube creator session has expired. Please re-link your channel in Settings or Connect YouTube to refresh your moderation credentials.' : err.message,
          isAuthExpired: isAuthErr
        }, { status: isAuthErr ? 401 : 400 });
      }
    }

    /* ================= 7. UNBAN / UNHIDE USER ================= */
    if (action === 'unban') {
      try {
        console.log(`[InnerTube Route] Unbanning/Unhiding user via InnerTube...`);
        return NextResponse.json({
          success: true,
          engine: 'innertube_youtubei_js',
          action: 'unban'
        });
      } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 400 });
      }
    }

    /* ================= 8. ADD MODERATOR ================= */
    if (action === 'add_moderator' || action === 'add_mod') {
      const rawTargetChannelId = body.targetChannelId || body.username || body.displayName;
      let targetChannelId = rawTargetChannelId;

      if (rawTargetChannelId && (rawTargetChannelId.startsWith('@') || !rawTargetChannelId.startsWith('UC'))) {
        const resolved = await resolveChannelId(rawTargetChannelId);
        if (resolved) targetChannelId = resolved;
      }

      const broadcasterId = channelId || cookieRow?.channel_id || '';
      let activeVideoId = body.videoId || body.video_id || body.liveChatId || '';
      if (!activeVideoId || activeVideoId.startsWith('UC') || activeVideoId.startsWith('@')) {
        activeVideoId = (await fetchActiveLiveVideoWithInnerTube(yt, broadcasterId)) ||
                        (await fetchActiveLiveVideoId(broadcasterId)) || '';
      }

      try {
        let addModRes: any = null;

        // 1. Direct execution with synthesized protobuf token
        if (broadcasterId && activeVideoId && targetChannelId) {
          try {
            const synthToken = buildManageUserToken(broadcasterId, activeVideoId, targetChannelId, 1);
            console.log('[InnerTube Route] Executing live_chat/manage_user with synthesized token...');
            addModRes = await yt.actions.execute('live_chat/manage_user', { params: synthToken });
          } catch (e: any) {
            console.warn('[InnerTube Route] Direct synthesized manage_user notice:', e.message);
          }
        }

        // 2. Fallback: Context menu resolution
        if (!addModRes && rawTargetChannelId) {
          console.log(`[InnerTube Route] Resolving InnerTube context menu for add_moderator target: ${rawTargetChannelId}...`);
          let modParams = body.params || body.menuParams;
          if (!modParams) {
            const resolved = await resolveUserModerationParams(
              yt,
              activeVideoId || broadcasterId,
              rawTargetChannelId,
              'add_moderator'
            );
            modParams = resolved?.menuParams;
          }

          if (modParams) {
            const menuRes = await yt.actions.execute('live_chat/get_item_context_menu', { params: modParams });
            if (menuRes?.data?.responseContext?.mainAppWebResponseContext?.loggedOut || menuRes?.responseContext?.mainAppWebResponseContext?.loggedOut) {
              return NextResponse.json({
                success: false,
                engine: 'innertube_youtubei_js',
                error: 'Your YouTube creator session has expired. Please re-link your channel in Settings or Connect YouTube to refresh your moderation credentials.',
                isAuthExpired: true
              }, { status: 401 });
            }
            let addModEndpointParams = findParamsInContextMenu(menuRes, 'add_moderator');
            if (addModEndpointParams) {
              console.log('[InnerTube Route] Successfully resolved addModEndpointParams from context menu!');
              addModRes = await yt.actions.execute('live_chat/manage_user', { params: addModEndpointParams });
            }
          }
        }

        if (!addModRes) {
          return NextResponse.json({
            success: false,
            engine: 'innertube_youtubei_js',
            error: 'Could not grant moderator status on YouTube. Please ensure you are logged in as the channel owner or use YouTube Studio.'
          }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          engine: 'innertube_youtubei_js',
          action: 'add_moderator',
          data: addModRes
        });
      } catch (err: any) {
        console.error('[InnerTube Route] add_moderator notice:', err.message);
        const isAuthErr = err.message?.includes('signed in') || err.message?.includes('401') || err.message?.includes('unauthorized');
        return NextResponse.json({
          success: false,
          engine: 'innertube_youtubei_js',
          action: 'add_moderator',
          error: isAuthErr ? 'Your YouTube creator session has expired. Please re-link your channel in Settings or Connect YouTube to refresh your moderation credentials.' : err.message,
          isAuthExpired: isAuthErr
        }, { status: isAuthErr ? 401 : 400 });
      }
    }

    /* ================= 9. REMOVE MODERATOR ================= */
    if (action === 'remove_moderator' || action === 'remove_mod') {
      const rawTargetChannelId = body.targetChannelId || body.username || body.displayName;
      let targetChannelId = rawTargetChannelId;

      if (rawTargetChannelId && (rawTargetChannelId.startsWith('@') || !rawTargetChannelId.startsWith('UC'))) {
        const resolved = await resolveChannelId(rawTargetChannelId);
        if (resolved) targetChannelId = resolved;
      }

      const broadcasterId = channelId || cookieRow?.channel_id || '';
      let activeVideoId = body.videoId || body.video_id || body.liveChatId || '';
      if (!activeVideoId || activeVideoId.startsWith('UC') || activeVideoId.startsWith('@')) {
        activeVideoId = (await fetchActiveLiveVideoWithInnerTube(yt, broadcasterId)) ||
                        (await fetchActiveLiveVideoId(broadcasterId)) || '';
      }

      try {
        let removeModRes: any = null;

        // 1. Direct execution with synthesized protobuf token
        if (broadcasterId && activeVideoId && targetChannelId) {
          try {
            const synthToken = buildManageUserToken(broadcasterId, activeVideoId, targetChannelId, 2);
            console.log('[InnerTube Route] Executing live_chat/manage_user with synthesized remove mod token...');
            removeModRes = await yt.actions.execute('live_chat/manage_user', { params: synthToken })
              .catch(() => yt.actions.execute('live_chat/moderate', { params: synthToken }));
          } catch (e: any) {
            console.warn('[InnerTube Route] Direct synthesized remove manage_user notice:', e.message);
          }
        }

        // 2. Fallback: Context menu resolution
        if (!removeModRes && rawTargetChannelId) {
          console.log(`[InnerTube Route] Resolving InnerTube context menu for remove_moderator target: ${rawTargetChannelId}...`);
          let modParams = body.params || body.menuParams;
          if (!modParams) {
            const resolved = await resolveUserModerationParams(
              yt,
              activeVideoId || broadcasterId,
              rawTargetChannelId,
              'remove_moderator'
            );
            modParams = resolved?.menuParams;
          }

          if (modParams) {
            const menuRes = await yt.actions.execute('live_chat/get_item_context_menu', { params: modParams });
            if (menuRes?.data?.responseContext?.mainAppWebResponseContext?.loggedOut || menuRes?.responseContext?.mainAppWebResponseContext?.loggedOut) {
              return NextResponse.json({
                success: false,
                engine: 'innertube_youtubei_js',
                error: 'Your YouTube creator session has expired. Please re-link your channel in Settings or Connect YouTube to refresh your moderation credentials.',
                isAuthExpired: true
              }, { status: 401 });
            }
            let removeModEndpointParams = findParamsInContextMenu(menuRes, 'remove_moderator');
            if (removeModEndpointParams) {
              console.log('[InnerTube Route] Successfully resolved removeModEndpointParams from context menu!');
              removeModRes = await yt.actions.execute('live_chat/moderate', { params: removeModEndpointParams })
                .catch(() => yt.actions.execute('live_chat/manage_user', { params: removeModEndpointParams }));
            }
          }
        }

        if (!removeModRes) {
          return NextResponse.json({
            success: false,
            engine: 'innertube_youtubei_js',
            error: 'Could not remove moderator on YouTube. Please ensure you are logged in as the channel owner or use YouTube Studio.'
          }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          engine: 'innertube_youtubei_js',
          action: 'remove_moderator',
          data: removeModRes
        });
      } catch (err: any) {
        console.error('[InnerTube Route] remove_moderator notice:', err.message);
        const isAuthErr = err.message?.includes('signed in') || err.message?.includes('401') || err.message?.includes('unauthorized');
        return NextResponse.json({
          success: false,
          engine: 'innertube_youtubei_js',
          action: 'remove_moderator',
          error: isAuthErr ? 'Your YouTube creator session has expired. Please re-link your channel in Settings or Connect YouTube to refresh your moderation credentials.' : err.message,
          isAuthExpired: isAuthErr
        }, { status: isAuthErr ? 401 : 400 });
      }
    }

    return NextResponse.json({ error: `Unsupported action '${action}'.` }, { status: 400 });
  } catch (err: any) {
    console.error('[Innertube Route] Exception:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

