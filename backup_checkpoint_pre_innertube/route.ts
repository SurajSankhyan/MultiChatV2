import { NextResponse } from 'next/server';
import { hwSupabase, asSupabase } from '@/lib/supabase';

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
        // Prioritize account row with valid youtube_refresh_token
        const bestRow = ytList.find((u: any) => u.youtube_refresh_token || u.refresh_token) || ytList[0];
        accountData = {
          user_id: bestRow.id,
          channel_id: bestRow.channel_id,
          custom_handle: bestRow.custom_handle,
          channel_name: bestRow.channel_name,
          avatar_url: bestRow.avatar_url,
          refresh_token: bestRow.youtube_refresh_token || bestRow.refresh_token,
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
          const bestRow = profList.find((p: any) => p.youtube_refresh_token || p.refresh_token) || profList[0];
          accountData = {
            user_id: bestRow.id,
            channel_id: bestRow.channel_id,
            custom_handle: bestRow.custom_handle,
            channel_name: bestRow.channel_name,
            avatar_url: bestRow.avatar_url,
            refresh_token: bestRow.youtube_refresh_token || bestRow.refresh_token,
            access_token: bestRow.access_token
          };
        }
      } catch (e) {
        console.warn('[YouTube API Route] Error querying profiles table in hwSupabase:', e);
      }
    }

    if (!accountData || !accountData.refresh_token) {
      return NextResponse.json(
        { error: 'No connected YouTube channel with OAuth access found for your account. Please connect your YouTube account in settings.' },
        { status: 403 }
      );
    }

    // 2. Strict Security Check: Verify target channelId matches the logged-in user's OWN connected YouTube channel!
    if (channelId) {
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

    const refreshToken = accountData.refresh_token;
    let accessToken = accountData.access_token;

    // 2. Refresh access_token using refresh_token if necessary
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (refreshToken && clientId) {
      try {
        const tokenParams: Record<string, string> = {
          client_id: clientId,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        };
        if (clientSecret) {
          tokenParams.client_secret = clientSecret;
        }

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(tokenParams).toString()
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData.access_token) {
            accessToken = tokenData.access_token;
          }
        } else {
          const errData = await tokenRes.json().catch(() => ({}));
          console.warn('[YouTube API Route] Failed to refresh access token:', tokenRes.status, errData);
          if (tokenRes.status === 400 || tokenRes.status === 401 || errData.error === 'unauthorized_client' || errData.error === 'invalid_grant') {
            return NextResponse.json(
              { error: 'Your YouTube Google OAuth session has expired or been revoked. Please reconnect your YouTube account in MultiChat settings to enable live chat & moderation.' },
              { status: 401 }
            );
          }
        }
      } catch (tokenErr: any) {
        console.warn('[YouTube API Route] Failed to refresh access token:', tokenErr.message);
      }
    }

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unable to obtain a valid access token for the connected YouTube account. Please reconnect your account.' },
        { status: 401 }
      );
    }

    const isValidLiveChatId = (id?: string | null): boolean => {
      if (!id || typeof id !== 'string') return false;
      const trimmed = id.trim();
      if (
        trimmed.startsWith('sys-') ||
        trimmed.startsWith('LCC.') ||
        trimmed.startsWith('@') ||
        trimmed.startsWith('UC') ||
        /^[a-zA-Z0-9_-]{11}$/.test(trimmed)
      ) {
        return false;
      }
      return trimmed.length >= 20;
    };

    // Helper to fetch fresh activeLiveChatId from YouTube API or HTML scraper
    const fetchFreshLiveChatId = async (): Promise<string | null> => {
      // 1. Try liveBroadcasts API with active status (Fastest and most direct for broadcaster token)
      try {
        const broadcastRes = await fetch(
          'https://www.googleapis.com/youtube/v3/liveBroadcasts?broadcastStatus=active&broadcastType=all&part=snippet',
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (broadcastRes.ok) {
          const broadcastData = await broadcastRes.json();
          const resolved = broadcastData.items?.[0]?.snippet?.liveChatId;
          if (resolved) {
            console.log(`[YouTube API Route] Resolved activeLiveChatId via liveBroadcasts API: ${resolved}`);
            return resolved;
          }
        }
      } catch (err: any) {
        console.warn('[YouTube API Route] liveBroadcasts API error:', err.message);
      }

      // 2. Query YouTube Data API Search + Videos for active live stream of channel
      let targetUcId = accountData?.channel_id || '';
      if (!targetUcId && channelId) {
        targetUcId = await resolveChannelId(channelId);
      }

      if (targetUcId && targetUcId.startsWith('UC')) {
        try {
          console.log(`[YouTube API Route] Querying YouTube Search API for active live video of channel: ${targetUcId}`);
          const searchRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${targetUcId}&eventType=live&type=video&maxResults=1`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const foundVidId = searchData.items?.[0]?.id?.videoId;
            if (foundVidId) {
              console.log(`[YouTube API Route] Found live videoId via Search API: ${foundVidId}`);
              const vidDetailsRes = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${foundVidId}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              if (vidDetailsRes.ok) {
                const vidDetails = await vidDetailsRes.json();
                const lcId = vidDetails.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
                if (lcId) {
                  console.log(`[YouTube API Route] Resolved activeLiveChatId via YouTube Videos API: ${lcId}`);
                  return lcId;
                }
              }
            }
          }
        } catch (err: any) {
          console.warn('[YouTube API Route] Search API resolution failed:', err.message);
        }
      }

      // 3. Scrape channel /live page to extract videoId, then fetch /live_chat?v=videoId
      const targetSlug = (channelId || accountData?.custom_handle || accountData?.channel_id || '').toLowerCase().replace(/^@+/, '').trim();
      if (targetSlug) {
        try {
          const liveUrl = targetSlug.startsWith('uc')
            ? `https://www.youtube.com/channel/${targetSlug}/live`
            : `https://www.youtube.com/@${targetSlug}/live`;

          console.log(`[YouTube API Route] Scraper fetching live page: ${liveUrl}`);
          const pageRes = await fetch(liveUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }
          });
          if (pageRes.ok) {
            const html = await pageRes.text();
            
            // Check direct match
            const lcMatch = html.match(/"activeLiveChatId"\s*:\s*"([^"]+)"/) || html.match(/"liveChatId"\s*:\s*"([^"]+)"/);
            if (lcMatch && lcMatch[1]) {
              console.log(`[YouTube API Route] Resolved activeLiveChatId directly via HTML scraper: ${lcMatch[1]}`);
              return lcMatch[1];
            }

            // Extract videoId
            const vidMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/) ||
                             html.match(/watch\?v=([a-zA-Z0-9_-]{11})/) ||
                             html.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
            const extractedVidId = vidMatch?.[1];

            if (extractedVidId) {
              console.log(`[YouTube API Route] Extracted videoId "${extractedVidId}" from live page. Fetching live_chat page...`);
              const chatPageRes = await fetch(`https://www.youtube.com/live_chat?v=${extractedVidId}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
              });
              if (chatPageRes.ok) {
                const chatHtml = await chatPageRes.text();
                const chatLcMatch = chatHtml.match(/"activeLiveChatId"\s*:\s*"([^"]+)"/) || chatHtml.match(/"liveChatId"\s*:\s*"([^"]+)"/);
                if (chatLcMatch && chatLcMatch[1]) {
                  console.log(`[YouTube API Route] Successfully resolved activeLiveChatId via video live_chat page: ${chatLcMatch[1]}`);
                  return chatLcMatch[1];
                }
              }
            }
          }
        } catch (err: any) {
          console.warn('[YouTube API Route] Failed resolving activeLiveChatId via scraper:', err.message);
        }
      }

      return null;
    };

    const isLiveChatNotFoundError = (status: number, bodyText: string): boolean => {
      if (status === 404) return true;
      const lower = (bodyText || '').toLowerCase();
      return (
        lower.includes('livechatnotfound') ||
        lower.includes('live chat identified in the api request does not exist') ||
        lower.includes('chat has been deleted') ||
        lower.includes('livechatended') ||
        lower.includes('live chat is not active')
      );
    };

    // 3. Resolve activeLiveChatId for YouTube Live Chat API
    let activeChatId = liveChatId;

    if (activeChatId && /^[a-zA-Z0-9_-]{11}$/.test(activeChatId.trim())) {
      try {
        const vidUrl = `https://www.youtube.com/live_chat?v=${activeChatId.trim()}`;
        console.log(`[YouTube API Route] Resolving activeLiveChatId from video ID: ${vidUrl}`);
        const pageRes = await fetch(vidUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const lcMatch = html.match(/"activeLiveChatId"\s*:\s*"([^"]+)"/) || html.match(/"liveChatId"\s*:\s*"([^"]+)"/);
          if (lcMatch && lcMatch[1]) {
            activeChatId = lcMatch[1];
            console.log(`[YouTube API Route] Successfully resolved video ID to activeLiveChatId: ${activeChatId}`);
          }
        }
      } catch (err: any) {
        console.warn('[YouTube API Route] Failed resolving activeLiveChatId from video ID:', err.message);
      }
    }

    if (!isValidLiveChatId(activeChatId)) {
      const freshId = await fetchFreshLiveChatId();
      if (freshId) activeChatId = freshId;
    }

    // Helper to resolve handle or ID to official YouTube channel ID starting with UC
    // In-memory cache for resolved channel IDs to preserve YouTube API quota
    const channelIdCache = new Map<string, string>();

    const resolveChannelId = async (rawTarget: string): Promise<string> => {
      if (!rawTarget || typeof rawTarget !== 'string') return '';
      const cleanTarget = rawTarget.trim();
      if (cleanTarget.startsWith('UC')) return cleanTarget;

      const cleanHandle = cleanTarget.replace(/^@+/, '').toLowerCase();
      if (!cleanHandle) return '';

      if (channelIdCache.has(cleanHandle)) {
        return channelIdCache.get(cleanHandle)!;
      }

      // 1. Try HTML page fetch first (0 Google API Quota Units!)
      try {
        const handleUrl = `https://www.youtube.com/@${encodeURIComponent(cleanHandle)}`;
        const res = await fetch(handleUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/122.0.0.0' }
        });
        if (res.ok) {
          const html = await res.text();
          const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)"/) ||
                                 html.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/) ||
                                 html.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"/) ||
                                 html.match(/"browseId"\s*:\s*"(UC[a-zA-Z0-9_-]+)"/);
          if (canonicalMatch && canonicalMatch[1]) {
            console.log(`[YouTube API Route] Resolved handle @${cleanHandle} via 0-quota HTML to UC channel ID: ${canonicalMatch[1]}`);
            channelIdCache.set(cleanHandle, canonicalMatch[1]);
            return canonicalMatch[1];
          }
        }
      } catch (e) {}

      // 2. Try forHandle API (1 quota unit)
      try {
        const handleWithAt = `@${cleanHandle}`;
        const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?forHandle=${encodeURIComponent(handleWithAt)}&part=id`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.items?.[0]?.id) {
            console.log(`[YouTube API Route] Resolved handle ${handleWithAt} to UC channel ID: ${data.items[0].id}`);
            channelIdCache.set(cleanHandle, data.items[0].id);
            return data.items[0].id;
          }
        }
      } catch (e) {}

      return rawTarget;
    };

    console.log(`[YouTube API Route] Handling action "${action || 'send'}" for liveChatId: ${activeChatId}`);

    // 4. Perform Action via YouTube Live Chat API
    if (action === 'delete') {
      if (!messageId) {
        return NextResponse.json({ error: 'messageId is required to delete a message.' }, { status: 400 });
      }

      // Candidates for YouTube Data API liveChatMessage resource ID
      const candidates = [
        messageId,
        messageId.startsWith('LCC.') ? messageId : `LCC.${messageId}`,
        `LCC.EhwKGk${messageId.replace(/^ChwKGk/, '').replace(/^LCC\./, '')}`,
        `LCC.Ehw${messageId.replace(/^LCC\./, '')}`
      ];

      for (const candId of candidates) {
        if (!candId) continue;
        try {
          console.log(`[YouTube API Route] Attempting YouTube Data API delete for candidate ID: ${candId}`);
          const response = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?id=${encodeURIComponent(candId)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          if (response.ok || response.status === 204) {
            console.log(`[YouTube API Route] YouTube Data API delete succeeded for candidate ID: ${candId}`);
            return NextResponse.json({ success: true, action: 'delete' });
          }
        } catch (e: any) {
          console.warn(`[YouTube API Route] Delete candidate error for ${candId}:`, e.message);
        }
      }

      // If candidates failed, fetch liveChat/messages list from Data API and match message text
      if (!isValidLiveChatId(activeChatId)) {
        const freshId = await fetchFreshLiveChatId();
        if (freshId) activeChatId = freshId;
      }

      const messageText = body.message || '';
      if (isValidLiveChatId(activeChatId) && messageText) {
        try {
          console.log(`[YouTube API Route] Searching liveChat/messages list for single message delete matching text: "${messageText}"`);
          const listRes = await fetch(
            `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${activeChatId}&part=id,snippet,authorDetails`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (listRes.ok) {
            const listData = await listRes.json();
            const matchingItem = listData.items?.find((item: any) => {
              const itemText = item.snippet?.textMessageDetails?.messageText || item.snippet?.displayMessage || '';
              return itemText.trim() === messageText.trim();
            });
            if (matchingItem && matchingItem.id) {
              console.log(`[YouTube API Route] Found matching single message ID in Data API list: ${matchingItem.id}. Executing DELETE...`);
              const delRes = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?id=${encodeURIComponent(matchingItem.id)}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              if (delRes.ok || delRes.status === 204) {
                console.log(`[YouTube API Route] Successfully deleted single message via Data API list match: ${matchingItem.id}`);
                return NextResponse.json({ success: true, action: 'delete', matchedListId: matchingItem.id });
              }
            }
          }
        } catch (err: any) {
          console.warn('[YouTube API Route] Live chat list search delete error:', err.message);
        }
      }

      return NextResponse.json({ success: true, action: 'delete', warning: 'Message removed locally from dashboard.' });
    }

    if (action === 'timeout') {
      const { durationSeconds = 300, messageId, targetChannelId: rawTargetChannelId } = body;
      const rawTarget = rawTargetChannelId || body.username || body.displayName;
      const targetChannelId = await resolveChannelId(rawTarget);
      
      if (!isValidLiveChatId(activeChatId)) {
        const freshId = await fetchFreshLiveChatId();
        if (freshId) activeChatId = freshId;
      }

      if (!targetChannelId || !targetChannelId.startsWith('UC')) {
        return NextResponse.json({ success: true, action: 'timeout', warning: `Could not resolve target user "${rawTarget}". Timeout applied locally.` });
      }

      if (!isValidLiveChatId(activeChatId)) {
        return NextResponse.json({ success: true, action: 'timeout', warning: 'No active live chat found. Timeout applied locally.' });
      }

      console.log(`[YouTube API Route] Requesting timeout for targetChannelId: ${targetChannelId}, durationSeconds: ${durationSeconds}, liveChatId: ${activeChatId}`);
      
      const issueTimeout = async (chatId: string) => {
        return fetch(`https://www.googleapis.com/youtube/v3/liveChat/bans?part=snippet`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            snippet: {
              liveChatId: chatId,
              type: 'temporary',
              banDurationSeconds: Number(durationSeconds),
              bannedUserDetails: {
                channelId: targetChannelId
              }
            }
          })
        });
      };

      let response = await issueTimeout(activeChatId);
      let responseText = await response.text();

      if (!response.ok && isLiveChatNotFoundError(response.status, responseText)) {
        console.warn(`[YouTube API Route] Timeout failed with liveChatNotFound for "${activeChatId}". Auto-resolving fresh activeLiveChatId...`);
        const freshId = await fetchFreshLiveChatId();
        if (freshId && freshId !== activeChatId) {
          activeChatId = freshId;
          response = await issueTimeout(activeChatId);
          responseText = await response.text();
        }
      }

      if (!response.ok) {
        console.error('[YouTube API Route] Timeout failed:', response.status, responseText);
        return NextResponse.json({ success: true, action: 'timeout', warning: 'Applied timeout locally on dashboard.' });
      }

      // Also attempt to delete the message on YouTube if messageId is provided
      if (messageId && typeof messageId === 'string' && messageId.length > 5 && !messageId.startsWith('sys-')) {
        try {
          console.log(`[YouTube API Route] Also deleting message on YouTube: ${messageId}`);
          await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?id=${messageId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
        } catch (e) {
          console.warn('[YouTube API Route] Optional message deletion error during timeout:', e);
        }
      }

      return NextResponse.json({ success: true, action: 'timeout' });
    }

    if (action === 'ban') {
      const rawTarget = body.targetChannelId || body.username || body.displayName;
      const targetChannelId = await resolveChannelId(rawTarget);
      
      if (!isValidLiveChatId(activeChatId)) {
        const freshId = await fetchFreshLiveChatId();
        if (freshId) activeChatId = freshId;
      }

      if (!targetChannelId || !targetChannelId.startsWith('UC')) {
        return NextResponse.json({ success: true, action: 'ban', warning: `Could not resolve target user "${rawTarget}". Ban applied locally.` });
      }

      if (!isValidLiveChatId(activeChatId)) {
        return NextResponse.json({ success: true, action: 'ban', warning: 'No active live chat found. Ban applied locally.' });
      }

      console.log(`[YouTube API Route] Requesting permanent ban for targetChannelId: ${targetChannelId}`);
      
      const issueBan = async (chatId: string) => {
        return fetch(`https://www.googleapis.com/youtube/v3/liveChat/bans?part=snippet`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            snippet: {
              liveChatId: chatId,
              type: 'permanent',
              bannedUserDetails: {
                channelId: targetChannelId
              }
            }
          })
        });
      };

      let response = await issueBan(activeChatId);
      let responseText = await response.text();

      if (!response.ok && isLiveChatNotFoundError(response.status, responseText)) {
        console.warn(`[YouTube API Route] Ban failed with liveChatNotFound for "${activeChatId}". Auto-resolving fresh activeLiveChatId...`);
        const freshId = await fetchFreshLiveChatId();
        if (freshId && freshId !== activeChatId) {
          activeChatId = freshId;
          response = await issueBan(activeChatId);
          responseText = await response.text();
        }
      }

      if (!response.ok) {
        console.error('[YouTube API Route] Permanent ban failed:', response.status, responseText);
        if (responseText.includes('quotaExceeded')) {
          return NextResponse.json({ success: true, action: 'ban', warning: 'YouTube API daily quota limit reached. Applied ban locally.' });
        }
        return NextResponse.json({ success: true, action: 'ban', warning: 'Applied ban locally on dashboard.' });
      }
      return NextResponse.json({ success: true, action: 'ban' });
    }

    if (action === 'unban') {
      const { banId: rawBanId, targetChannelId: rawTargetChannelId } = body;
      const targetChannelId = await resolveChannelId(rawTargetChannelId || body.username);
      
      if (!isValidLiveChatId(activeChatId)) {
        const freshId = await fetchFreshLiveChatId();
        if (freshId) activeChatId = freshId;
      }

      let banId = rawBanId;
      if (!banId && targetChannelId) {
        banId = `CAESGF${targetChannelId}`;
      }

      if (banId) {
        console.log(`[YouTube API Route] Requesting unban (unhide user) for banId: ${banId}`);
        const response = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/bans?id=${encodeURIComponent(banId)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (response.ok || response.status === 204) {
          console.log(`[YouTube API Route] Successfully unbanned/unhidden user on YouTube Live Chat for banId: ${banId}`);
          return NextResponse.json({ success: true, action: 'unban' });
        } else {
          const text = await response.text();
          console.warn(`[YouTube API Route] Unban returned status ${response.status}: ${text}`);
          if (text.includes('quotaExceeded')) {
            return NextResponse.json({ success: true, action: 'unban', warning: 'YouTube API daily quota limit reached. Applied unban locally.' });
          }
        }
      }

      return NextResponse.json({ success: true, action: 'unban', warning: 'User unhidden locally on dashboard.' });
    }

    if (action === 'add_moderator') {
      const { targetChannelId: rawTargetChannelId } = body;
      const targetChannelId = await resolveChannelId(rawTargetChannelId);
      if (!targetChannelId || !targetChannelId.startsWith('UC')) {
        return NextResponse.json({ error: `Could not resolve target user "${rawTargetChannelId}" to a valid YouTube Channel ID (UC...).` }, { status: 400 });
      }
      if (!isValidLiveChatId(activeChatId)) {
        const freshId = await fetchFreshLiveChatId();
        if (freshId) activeChatId = freshId;
      }
      if (!isValidLiveChatId(activeChatId)) {
        return NextResponse.json({ error: 'No active YouTube live chat found to add moderator. Make sure your stream is live on YouTube.' }, { status: 400 });
      }
      console.log(`[YouTube API Route] Adding moderator for targetChannelId: ${targetChannelId}, liveChatId: ${activeChatId}`);

      const issueAddMod = async (chatId: string) => {
        return fetch(`https://www.googleapis.com/youtube/v3/liveChat/moderators?part=snippet`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            snippet: {
              liveChatId: chatId,
              moderatorDetails: {
                channelId: targetChannelId
              }
            }
          })
        });
      };

      let response = await issueAddMod(activeChatId);
      let responseText = await response.text();

      if (!response.ok && isLiveChatNotFoundError(response.status, responseText)) {
        console.warn(`[YouTube API Route] Add moderator failed with liveChatNotFound for "${activeChatId}". Auto-resolving fresh activeLiveChatId...`);
        const freshId = await fetchFreshLiveChatId();
        if (freshId && freshId !== activeChatId) {
          activeChatId = freshId;
          response = await issueAddMod(activeChatId);
          responseText = await response.text();
        }
      }

      if (!response.ok) {
        console.error('[YouTube API Route] Add moderator failed:', response.status, responseText);
        let errorMsg = 'Failed to add moderator on YouTube Live Chat.';
        try {
          const parsed = JSON.parse(responseText);
          if (parsed.error?.message) errorMsg = parsed.error.message;
        } catch (e) {}
        if (isLiveChatNotFoundError(response.status, responseText)) {
          errorMsg = 'No active YouTube live chat found. Make sure your stream is live on YouTube.';
        }
        if (responseText.includes('quotaExceeded')) {
          return NextResponse.json({ success: true, action: 'add_moderator', warning: 'YouTube API daily quota limit reached. Applied moderator locally.' });
        }
        return NextResponse.json({ error: errorMsg, details: responseText }, { status: response.status });
      }
      return NextResponse.json({ success: true, action: 'add_moderator' });
    }

    if (action === 'remove_moderator') {
      const { modId, targetChannelId: rawTargetChannelId } = body;
      let targetModId = modId;
      const resolvedChannelId = await resolveChannelId(rawTargetChannelId || body.username || body.displayName);

      if (!isValidLiveChatId(activeChatId)) {
        const freshId = await fetchFreshLiveChatId();
        if (freshId) activeChatId = freshId;
      }

      if (isValidLiveChatId(activeChatId)) {
        try {
          console.log(`[YouTube API Route] Querying liveChat/moderators list for liveChatId: ${activeChatId}...`);
          const listRes = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/moderators?liveChatId=${activeChatId}&part=id,snippet`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            const cleanHandleLower = (rawTargetChannelId || body.username || body.displayName || '').toLowerCase().replace(/^@+/, '').trim();
            const found = listData.items?.find((item: any) => {
              const details = item.snippet?.moderatorDetails || {};
              const chanId = (details.channelId || '').toLowerCase();
              const cUrl = (details.channelUrl || '').toLowerCase();
              const dName = (details.displayName || '').toLowerCase();
              return (
                (resolvedChannelId && chanId === resolvedChannelId.toLowerCase()) ||
                (cleanHandleLower && (cUrl.includes(cleanHandleLower) || dName === cleanHandleLower))
              );
            });
            if (found && found.id) {
              targetModId = found.id;
              console.log(`[YouTube API Route] Resolved targetModId from liveChat/moderators list: ${targetModId}`);
            }
          }
        } catch (e: any) {
          console.warn('[YouTube API Route] Error querying liveChat/moderators list:', e.message);
        }
      }

      if (!targetModId || targetModId.startsWith('UC') || targetModId.startsWith('@')) {
        return NextResponse.json({
          error: `Could not find an active moderator entry on YouTube for "${rawTargetChannelId || body.username}". Make sure the user is currently assigned as a moderator on your live stream.`
        }, { status: 400 });
      }

      console.log(`[YouTube API Route] Removing moderator with binding id: ${targetModId}`);
      const response = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/moderators?id=${encodeURIComponent(targetModId)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      if (!response.ok) {
        const text = await response.text();
        console.error('[YouTube API Route] Remove moderator failed:', response.status, text);
        return NextResponse.json({ error: text || 'Failed to remove moderator on YouTube' }, { status: response.status });
      }
      return NextResponse.json({ success: true, action: 'remove_moderator' });
    }

    // Default Action: Send message via YouTube Live Chat API
    const sendChatMessage = async (chatId: string) => {
      return fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          snippet: {
            liveChatId: chatId,
            type: 'textMessageEvent',
            textMessageDetails: {
              messageText: message
            }
          }
        })
      });
    };

    let response = await sendChatMessage(activeChatId);
    let responseText = await response.text();

    if (!response.ok && isLiveChatNotFoundError(response.status, responseText)) {
      console.warn(`[YouTube API Route] Post message failed with liveChatNotFound for liveChatId "${activeChatId}". Auto-resolving fresh activeLiveChatId...`);
      const freshId = await fetchFreshLiveChatId();
      if (freshId) {
        console.log(`[YouTube API Route] Re-sending message with fresh activeLiveChatId "${freshId}"...`);
        activeChatId = freshId;
        response = await sendChatMessage(activeChatId);
        responseText = await response.text();
      }
    }

    let result: any = {};
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      result = { rawText: responseText };
    }

    if (!response.ok) {
      console.error('[YouTube API Route] LiveChat API error status:', response.status, 'body:', responseText);
      let userError = result.error?.message || responseText || 'Failed to post message to YouTube Live Chat';
      if (responseText.includes('quotaExceeded')) {
        userError = 'YouTube API daily quota limit reached for today. Message posted locally in MultiChat feed.';
      } else if (isLiveChatNotFoundError(response.status, responseText)) {
        userError = 'No active YouTube live stream chat found for your channel. Please make sure your stream is currently live on YouTube and live chat is enabled.';
      }
      userError = userError.replace(/<[^>]*>?/gm, '').trim();
      return NextResponse.json(
        { error: userError, details: result },
        { status: response.status }
      );
    }

    console.log('[YouTube API Route] Successfully posted live chat message:', result);

    return NextResponse.json({
      success: true,
      messageId: result.id || 'sent',
      snippet: result.snippet || null
    });
  } catch (error: any) {
    console.error('[YouTube API Route] Unhandled exception:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
