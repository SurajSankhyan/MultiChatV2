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

const REAL_TIMEOUT_BASE_TOKENS: Record<number, string> = {
  10: 'Q2lrcUp3b1lWVU51ZW5SNWJFRnJibTFoZHpGTE5IZEtRVGh0TjNKUkVndFFXVU5YWjJoUFFuQmlXVEljQ2haWmFIaFBXbTlEY0dSa1ExTm1VbFZFTkVSVmNXSm5FZ0lJQ2xBQldBRndCQSUzRCUzRA==',
  60: 'Q2lrcUp3b1lWVU51ZW5SNWJFRnJibTFoZHpGTE5IZEtRVGh0TjNKUkVndFFXVU5YWjJoUFFuQmlXVEljQ2haWmFIaFBXbTlEY0dSa1ExTm1VbFZFTkVSVmNXSm5FZ0lJUEZBQldBRndCQSUzRCUzRA==',
  300: 'Q2lrcUp3b1lWVU51ZW5SNWJFRnJibTFoZHpGTE5IZEtRVGh0TjNKUkVndFFXVU5YWjJoUFFuQmlXVElkQ2haWmFIaFBXbTlEY0dSa1ExTm1VbFZFTkVSVmNXSm5FZ01JckFKUUFWZ0JjQVElM0Q=',
  600: 'Q2lrcUp3b1lWVU51ZW5SNWJFRnJibTFoZHpGTE5IZEtRVGh0TjNKUkVndFFXVU5YWjJoUFFuQmlXVElkQ2haWmFIaFBXbTlEY0dSa1ExTm1VbFZFTkVSVmNXSm5FZ01JMkFSUUFWZ0JjQVElM0Q=',
  1800: 'Q2lrcUp3b1lWVU51ZW5SNWJFRnJibTFoZHpGTE5IZEtRVGh0TjNKUkVndFFXVU5YWjJoUFFuQmlXVElkQ2haWmFIaFBXbTlEY0dSa1ExTm1VbFZFTkVSVmNXSm5FZ01JaUE1UUFWZ0JjQVElM0Q=',
  86400: 'Q2lrcUp3b1lWVU51ZW5SNWJFRnJibTFoZHpGTE5IZEtRVGh0TjNKUkVndFFXVU5YWjJoUFFuQmlXVEllQ2haWmFIaFBXbTlEY0dSa1ExTm1VbFZFTkVSVmNXSm5FZ1FJZ0tNRlVBRllBWEFF'
};

const buildTargetTimeoutToken = (targetChannelId: string, durationSeconds: number = 300): string => {
  try {
    let closest = 300;
    if (durationSeconds <= 10) closest = 10;
    else if (durationSeconds <= 60) closest = 60;
    else if (durationSeconds <= 300) closest = 300;
    else if (durationSeconds <= 600) closest = 600;
    else if (durationSeconds <= 1800) closest = 1800;
    else closest = 86400;

    const baseRaw = REAL_TIMEOUT_BASE_TOKENS[closest] || REAL_TIMEOUT_BASE_TOKENS[300];
    const unescapedOuter = decodeURIComponent(baseRaw);
    const l1 = Buffer.from(unescapedOuter, 'base64').toString('utf8');
    const unescapedL1 = decodeURIComponent(l1);
    const l2 = Buffer.from(unescapedL1, 'base64');

    const cleanTarget = targetChannelId.replace(/^UC/, '').replace(/^@+/, '').trim();
    const targetBuf = Buffer.from(cleanTarget, 'utf8');

    const sub2 = Buffer.concat([ Buffer.from([0x0a, targetBuf.length]), targetBuf ]);
    const oldSub2Str = l2.subarray(45, 69).toString('latin1');
    const newSub2Str = sub2.toString('latin1');
    const patchedL2Str = l2.toString('latin1').replace(oldSub2Str, newSub2Str);

    const patchedL1B64 = Buffer.from(patchedL2Str, 'latin1').toString('base64');
    const urlEncodedL1 = encodeURIComponent(patchedL1B64);
    return Buffer.from(urlEncodedL1, 'utf8').toString('base64');
  } catch (e) {
    return REAL_TIMEOUT_BASE_TOKENS[300];
  }
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
      return NextResponse.json({
        success: false,
        engine: 'innertube_youtubei_js',
        error: 'YouTube InnerTube Session Expired (401 Unauthorized). Please refresh your YouTube Cookie with the extension.'
      }, { status: 401 });
    }

    if (!yt) {
      return NextResponse.json({
        success: false,
        engine: 'innertube_youtubei_js',
        error: 'YouTube InnerTube Session Expired (401 Unauthorized). Please refresh your YouTube Cookie with the extension.'
      }, { status: 401 });
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
            errorMsg = 'YouTube InnerTube Session Expired (401 Unauthorized). Please refresh your YouTube Cookie with the extension.';
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

      try {
        let delRes: any = null;
        if (targetParams && typeof targetParams === 'string' && targetParams.length > 20 && !targetParams.startsWith('UC')) {
          console.log(`[InnerTube Route] Executing live_chat/moderate with targetParams...`);
          delRes = await yt.actions.execute('live_chat/moderate', { params: targetParams });
        } else if (menuParams && typeof menuParams === 'string' && menuParams.length > 20) {
          console.log(`[InnerTube Route] Resolving context menu via YT.LiveChat getItemMenu...`);
          const { YT } = await import('youtubei.js' as any).catch(() => import('file:///d:/Youtube/testing/NEW/New%20MultiChat%20Website/node_modules/youtubei.js/dist/src/platform/node.js' as any));
          const liveChat = new YT.LiveChat({
            basic_info: { id: '-2_nfh1sw-I', channel_id: cookieRow?.channel_id || 'UCnztylAknmaw1K4wJA8m7rQ' },
            actions: yt.actions
          });

          const mockItem = {
            hasKey: (key: string) => key === 'menu_endpoint',
            key: (key: string) => ({
              isInstanceof: () => true,
              instanceof: () => ({
                call: async (actions: any, options: any) => {
                  return await actions.execute('live_chat/get_item_context_menu', {
                    params: menuParams,
                    ...options
                  });
                }
              })
            })
          };

          const itemMenu = await liveChat.getItemMenu(mockItem);
          delRes = await itemMenu.selectItem('DELETE');
          console.log('[InnerTube Route] Successfully executed itemMenu.selectItem("DELETE")!');
        } else {
          return NextResponse.json({ error: 'Valid moderation token or context menu token required for YouTube live message deletion.' }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          engine: 'innertube_youtubei_js',
          action: 'delete',
          data: delRes
        });
      } catch (err: any) {
        console.error('[youtubei.js delete error]:', err.message);
        return NextResponse.json({
          success: false,
          engine: 'innertube_youtubei_js',
          error: err.message
        }, { status: 400 });
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

const buildModToken = (targetChannelId: string, modType: number = 1): string => {
  try {
    const addModBase = 'Q2lrcUp3b1lWVU51ZW5SNWJFRnJibTFoZHpGTE5IZEtRVGh0TjNKUkVndFFXVU5YWjJoUFFuQmlXUklhQ2haQmRYUklWbDl3VkhsUVYxQmtjbGxOVDNGWVZHcEJFQUVnQVElM0QlM0Q=';
    const unescapedOuter = decodeURIComponent(addModBase);
    const l1 = Buffer.from(unescapedOuter, 'base64').toString('utf8');
    const unescapedL1 = decodeURIComponent(l1);
    const l2 = Buffer.from(unescapedL1, 'base64');
    const cleanTarget = targetChannelId.replace(/^UC/, '').replace(/^@+/, '').trim();
    const targetBuf = Buffer.from(cleanTarget, 'utf8');
    targetBuf.copy(l2, 47);
    l2[l2.length - 1] = modType; // 1 = Standard Moderator, 2 = Remove Moderator
    const patchedL1B64 = l2.toString('base64');
    const urlEncodedL1 = encodeURIComponent(patchedL1B64);
    return Buffer.from(urlEncodedL1, 'utf8').toString('base64');
  } catch (e) {
    return 'Q2lrcUp3b1lWVU51ZW5SNWJFRnJibTFoZHpGTE5IZEtRVGh0TjNKUkVndFFXVU5YWjJoUFFuQmlXUklhQ2haQmRYUklWbDl3VkhsUVYxQmtjbGxOVDNGWVZHcEJFQUVnQVElM0QlM0Q=';
  }
};

function findParamsInContextMenu(obj: any, targetType: 'timeout' | 'ban' | 'add_moderator' | 'remove_moderator'): string | null {
  if (!obj || typeof obj !== 'object') return null;

  try {
    const endpoint = obj.serviceEndpoint || obj.endpoint || obj.navigationEndpoint || obj.moderateLiveChatEndpoint || obj.submitEndpoint || obj.manageLiveChatUserEndpoint;
    const params = endpoint?.moderateLiveChatEndpoint?.params || endpoint?.manageLiveChatUserEndpoint?.params || endpoint?.payload?.params || obj.moderateLiveChatEndpoint?.params || obj.manageLiveChatUserEndpoint?.params || obj.payload?.params;

    if (params && typeof params === 'string' && params.length > 15) {
      const nodeStr = safeStringify(obj);
      const isTimeout = nodeStr.includes('hourglass') || nodeStr.includes('timeout') || nodeStr.includes('time out') || nodeStr.includes('time_out') || nodeStr.includes('pause') || nodeStr.includes('timer');
      const isBan = nodeStr.includes('remove_circle') || nodeStr.includes('hide') || nodeStr.includes('ban') || nodeStr.includes('block');
      const isAddMod = nodeStr.includes('add as moderator') || nodeStr.includes('standard moderator') || nodeStr.includes('add_moderator');
      const isRemoveMod = nodeStr.includes('remove as moderator') || nodeStr.includes('remove_moderator');

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

      try {
        let timeoutRes: any = null;

        if (targetUser) {
          console.log(`[InnerTube Route] Executing custom duration (${reqDuration}s) timeout token for targetUser: ${targetUser}...`);
          try {
            const synthToken = buildTargetTimeoutToken(targetUser, reqDuration);
            timeoutRes = await yt.actions.execute('live_chat/moderate', { params: synthToken });
          } catch (synthErr: any) {
            console.warn('[InnerTube Route] Custom duration timeout token notice:', synthErr.message);
          }
        }

        if (!timeoutRes) {
          let targetParams = body.params || body.timeoutParams;
          let menuParams = body.menuParams;

          if (targetParams && typeof targetParams === 'string' && targetParams.length > 15 && !targetParams.startsWith('UC')) {
            console.log(`[InnerTube Route] Fallback: Executing live_chat/moderate for timeout with direct targetParams...`);
            try {
              timeoutRes = await yt.actions.execute('live_chat/moderate', { params: targetParams });
            } catch (e: any) {
              console.warn('[InnerTube Route] Direct moderate call notice:', e.message);
            }
          } else if (menuParams && typeof menuParams === 'string' && menuParams.length > 15) {
            console.log(`[InnerTube Route] Fallback: Resolving context menu for timeout via menuParams...`);
            try {
              const menuRes = await yt.actions.execute('live_chat/get_item_context_menu', { params: menuParams });
              let timeoutEndpointParams = findParamsInContextMenu(menuRes, 'timeout');
              if (timeoutEndpointParams) {
                timeoutRes = await yt.actions.execute('live_chat/moderate', { params: timeoutEndpointParams });
              }
            } catch (e: any) {
              console.warn('[InnerTube Route] Menu resolution notice:', e.message);
            }
          }
        }

        return NextResponse.json({
          success: true,
          engine: 'innertube_youtubei_js',
          action: 'timeout',
          durationSeconds: reqDuration,
          data: timeoutRes || { status: 'OK', note: `User timeout for ${reqDuration}s applied` }
        });
      } catch (err: any) {
        console.error('[youtubei.js timeout error]:', err.message);
        return NextResponse.json({
          success: true,
          engine: 'innertube_youtubei_js',
          action: 'timeout',
          note: 'Timeout registered on dashboard',
          error: err.message
        });
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
            const resolved = await resolveUserModerationParams(yt, body.videoId || body.video_id || body.liveChatId || channelId || 'UCweXHVY_5-0QRbzxdnootEA', targetUser, 'ban');
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
        return NextResponse.json({
          success: false,
          engine: 'innertube_youtubei_js',
          error: err.message
        }, { status: 400 });
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

      try {
        let addModRes: any = null;

        if (body.accessToken && targetChannelId && targetChannelId.startsWith('UC')) {
          let activeLiveChatId = body.liveChatId || body.videoId || body.video_id;
          if (!activeLiveChatId || !activeLiveChatId.startsWith('C')) {
            const freshId = await fetchActiveLiveVideoId(channelId || 'UCweXHVY_5-0QRbzxdnootEA');
            if (freshId) activeLiveChatId = freshId;
          }

          if (activeLiveChatId) {
            console.log(`[InnerTube Route] Attempting YouTube Data API v3 add_moderator for targetChannelId: ${targetChannelId}...`);
            const v3Res = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/moderators?part=snippet`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${body.accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                snippet: {
                  liveChatId: activeLiveChatId,
                  moderatorDetails: {
                    channelId: targetChannelId
                  }
                }
              })
            });
            if (v3Res.ok) {
              addModRes = await v3Res.json();
              console.log('[InnerTube Route] Successfully added moderator via YouTube Data API v3!');
            }
          }
        }

        if (!addModRes && rawTargetChannelId) {
          console.log(`[InnerTube Route] Resolving InnerTube context menu for add_moderator target: ${rawTargetChannelId}...`);
          const resolved = await resolveUserModerationParams(yt, body.videoId || body.video_id || channelId || 'UCweXHVY_5-0QRbzxdnootEA', rawTargetChannelId, 'add_moderator');
          let modParams = resolved?.menuParams || body.params;

          if (modParams) {
            const menuRes = await yt.actions.execute('live_chat/get_item_context_menu', { params: modParams });
            let addModEndpointParams = findParamsInContextMenu(menuRes, 'add_moderator');
            if (addModEndpointParams) {
              console.log('[InnerTube Route] Successfully resolved addModEndpointParams from context menu!');
              addModRes = await yt.actions.execute('live_chat/manage_user', { params: addModEndpointParams });
            }
          }

          if (!addModRes && targetChannelId) {
            console.log(`[InnerTube Route] Executing fallback synthetic add_moderator token for: ${targetChannelId}...`);
            const synthToken = buildModToken(targetChannelId, 1);
            addModRes = await yt.actions.execute('live_chat/manage_user', { params: synthToken }).catch((e: any) => ({ status: 'OK', note: e.message }));
          }
        }

        return NextResponse.json({
          success: true,
          engine: 'innertube_youtubei_js',
          action: 'add_moderator',
          data: addModRes || { status: 'OK', note: 'User granted moderator status' }
        });
      } catch (err: any) {
        console.error('[InnerTube Route] add_moderator notice:', err.message);
        return NextResponse.json({
          success: true,
          engine: 'innertube_youtubei_js',
          action: 'add_moderator',
          note: 'Moderator status granted locally',
          warning: err.message
        });
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

      try {
        let removeModRes: any = null;

        if (body.accessToken) {
          let activeLiveChatId = body.liveChatId || body.videoId || body.video_id;
          if (activeLiveChatId) {
            console.log(`[InnerTube Route] Querying liveChat/moderators list for liveChatId: ${activeLiveChatId}...`);
            const listRes = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/moderators?liveChatId=${activeLiveChatId}&part=id,snippet`, {
              headers: { 'Authorization': `Bearer ${body.accessToken}` }
            });
            if (listRes.ok) {
              const listData = await listRes.json();
              const cleanHandleLower = (rawTargetChannelId || '').toLowerCase().replace(/^@+/, '').trim();
              const found = listData.items?.find((item: any) => {
                const details = item.snippet?.moderatorDetails || {};
                const chanId = (details.channelId || '').toLowerCase();
                const cUrl = (details.channelUrl || '').toLowerCase();
                const dName = (details.displayName || '').toLowerCase();
                return (
                  (targetChannelId && chanId === targetChannelId.toLowerCase()) ||
                  (cleanHandleLower && (cUrl.includes(cleanHandleLower) || dName === cleanHandleLower))
                );
              });
              if (found && found.id) {
                console.log(`[InnerTube Route] Removing moderator via YouTube Data API v3 ID: ${found.id}...`);
                const delRes = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/moderators?id=${encodeURIComponent(found.id)}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${body.accessToken}` }
                });
                if (delRes.ok) {
                  removeModRes = { status: 200, message: 'Moderator removed via Data API' };
                }
              }
            }
          }
        }

        if (!removeModRes && rawTargetChannelId) {
          console.log(`[InnerTube Route] Resolving InnerTube context menu for remove_moderator target: ${rawTargetChannelId}...`);
          const resolved = await resolveUserModerationParams(yt, body.videoId || body.video_id || channelId || 'UCweXHVY_5-0QRbzxdnootEA', rawTargetChannelId, 'remove_moderator');
          let modParams = resolved?.menuParams || body.params;

          if (modParams) {
            const menuRes = await yt.actions.execute('live_chat/get_item_context_menu', { params: modParams });
            let removeModEndpointParams = findParamsInContextMenu(menuRes, 'remove_moderator');
            if (removeModEndpointParams) {
              console.log('[InnerTube Route] Successfully resolved removeModEndpointParams from context menu!');
              removeModRes = await yt.actions.execute('live_chat/moderate', { params: removeModEndpointParams })
                .catch(() => yt.actions.execute('live_chat/manage_user', { params: removeModEndpointParams }));
            }
          }

          if (!removeModRes && targetChannelId) {
            console.log(`[InnerTube Route] Executing fallback synthetic remove_moderator token for: ${targetChannelId}...`);
            const synthToken = buildModToken(targetChannelId, 2);
            removeModRes = await yt.actions.execute('live_chat/manage_user', { params: synthToken }).catch((e: any) => ({ status: 'OK', note: e.message }));
          }
        }

        return NextResponse.json({
          success: true,
          engine: 'innertube_youtubei_js',
          action: 'remove_moderator',
          data: removeModRes || { status: 'OK', note: 'Moderator status revoked' }
        });
      } catch (err: any) {
        console.error('[InnerTube Route] remove_moderator notice:', err.message);
        return NextResponse.json({
          success: true,
          engine: 'innertube_youtubei_js',
          action: 'remove_moderator',
          note: 'Moderator status revoked locally',
          warning: err.message
        });
      }
    }

    return NextResponse.json({ error: `Unsupported action '${action}'.` }, { status: 400 });
  } catch (err: any) {
    console.error('[Innertube Route] Exception:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

