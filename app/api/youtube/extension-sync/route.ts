export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { asSupabase, hwSupabase } from '@/lib/supabase';
import { formatInnertubeCookie, innertubeCache } from '@/lib/innertubeSession';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cookie, sapisid, handle, channelId, channelName } = body;

    if (!cookie || !sapisid) {
      return NextResponse.json(
        { success: false, error: 'Missing SAPISID session cookie in sync payload.' },
        { status: 400 }
      );
    }

    console.log(`[Extension Sync] Received YouTube cookie sync request. Handle: "${handle || ''}", ChannelId: "${channelId || ''}"`);

    // Format cookie string so SAPISID is at position 0 for youtubei.js regex matching
    const formattedCookie = formatInnertubeCookie(cookie) || cookie;

    // Evict old cached InnerTube instances so new cookie is used immediately
    innertubeCache.clear();

    // Candidates array to test if provided by extension, otherwise fallback to primary formattedCookie
    const candidatesToTest: string[] = Array.isArray(body.cookieCandidates) && body.cookieCandidates.length > 0
      ? body.cookieCandidates.map((c: string) => formatInnertubeCookie(c) || c)
      : [formattedCookie];

    let validatedCookie = formattedCookie;
    let detectedHandle = handle;
    let detectedEmail = body.userEmail;

    try {
      const crypto = await import('crypto');
      const { Innertube } = await import('youtubei.js');

      for (const cand of candidatesToTest) {
        try {
          const yt = await Innertube.create({ cookie: cand, generate_session_locally: true });
          const match = cand.match(/SAPISID=([^;\s]+)/) || cand.match(/__Secure-3PAPISID=([^;\s]+)/);
          if (match && match[1]) {
            const sapisid = match[1];
            const ts = Math.floor(Date.now() / 1000);
            const sha1 = crypto.createHash('sha1').update(ts + ' ' + sapisid + ' https://www.youtube.com').digest('hex');
            (yt.session.http as any).headers = {
              ...((yt.session.http as any).headers || {}),
              Authorization: 'SAPISIDHASH ' + ts + '_' + sha1,
              Cookie: cand,
              Origin: 'https://www.youtube.com',
              Referer: 'https://www.youtube.com/'
            };
          }

          let info: any = null;
          let liveChat: any = null;
          try {
            info = await yt.getInfo('Y0xtloAwxzI');
            if (info) liveChat = await info.getLiveChat();
          } catch (lcErr) {}

          if (liveChat) {
            const testRes = await liveChat.sendMessage('StreamClips sync verification').catch(() => null);
            if (testRes) {
              console.log('[Extension Sync] Verified working candidate passed chat test! Candidate SAPISID:', match?.[1]);
              validatedCookie = cand;
              const accountInfo: any = await yt.account.getInfo().catch(() => null);
              if (accountInfo?.contents?.contents?.[0]) {
                const item = accountInfo.contents.contents[0];
                if (item.channel_handle?.text) detectedHandle = item.channel_handle.text;
                if (item.account_byline?.text && item.account_byline.text.includes('@')) detectedEmail = item.account_byline.text;
              }
              break; // Stop at first verified working candidate
            }
          }
        } catch (candErr: any) {
          console.warn('[Extension Sync] Candidate validation notice:', candErr.message);
        }
      }
    } catch (e: any) {
      console.warn('[Extension Sync] InnerTube validation exception:', e.message);
    }

    // 1. Update ONLY the matching row in asSupabase 'Youtube' table so each user gets their own cookie
    let updatedCount = 0;
    try {
      const { data: rows } = await asSupabase
        .from('Youtube')
        .select('id, email, channel_id, custom_handle, channel_name, youtube_refresh_token')
        .limit(20);

      if (rows && rows.length > 0) {
        let targetRow = null;

        // 1. Check user-selected email or detected email matches first
        const emailToMatch = (body.userEmail || detectedEmail || '').toLowerCase().trim();
        if (emailToMatch) {
          const emailMatches = rows.filter((r: any) => (r.email || '').toLowerCase().trim() === emailToMatch);
          if (emailMatches.length > 0) {
            targetRow = emailMatches.find((r: any) => r.channel_id && r.channel_id.startsWith('UC') && r.channel_name && r.channel_name !== '@user') ||
                        emailMatches.find((r: any) => r.channel_id && r.channel_id !== 'EMPTY' && r.channel_name && r.channel_name !== '@user') ||
                        emailMatches[0];
          }
        }

        // 2. Check user-selected handle from extension dropdown
        if (!targetRow && handle) {
          const cleanHandle = handle.toLowerCase().replace(/^@+/, '').trim();
          targetRow = rows.find((r: any) => (r.custom_handle || '').toLowerCase().replace(/^@+/, '').trim() === cleanHandle);
        }

        // 3. Check channelId
        if (!targetRow && channelId) {
          targetRow = rows.find((r: any) => (r.channel_id || '').toLowerCase().trim() === channelId.toLowerCase().trim());
        }

        // 4. Fallback to detected handle from cookie
        if (!targetRow && detectedHandle) {
          const cleanHandle = detectedHandle.toLowerCase().replace(/^@+/, '').trim();
          targetRow = rows.find((r: any) => (r.custom_handle || '').toLowerCase().replace(/^@+/, '').trim() === cleanHandle);
        }

        if (!targetRow && rows && rows.length === 1) {
          targetRow = rows[0];
        }

        if (targetRow) {
          const finalCookieToSave = formatInnertubeCookie(validatedCookie) || validatedCookie;

          const updateData: any = {
            youtube_refresh_token: finalCookieToSave
          };
          if (channelId && channelId !== 'EMPTY') updateData.channel_id = channelId;
          if (handle && handle !== '@user') updateData.custom_handle = handle.startsWith('@') ? handle : `@${handle}`;
          if (channelName && channelName !== '@user') updateData.channel_name = channelName;

          const { error } = await asSupabase
            .from('Youtube')
            .update(updateData)
            .eq('id', targetRow.id);

          if (!error) {
            updatedCount++;
            console.log(`[Extension Sync] Successfully updated Youtube row ${targetRow.id} (Email: ${targetRow.email}, Handle: ${targetRow.custom_handle}) with new synced cookies!`);
            
            // Clean up any other dummy/duplicate rows for this email
            if (targetRow.email) {
              await asSupabase
                .from('Youtube')
                .delete()
                .eq('email', targetRow.email)
                .neq('id', targetRow.id)
                .or('channel_id.eq.EMPTY,channel_name.eq.@user');
            }
          }
        } else {
          // Only insert a new row if we have actual valid channel information
          const targetEmail = body.userEmail || detectedEmail;
          if (targetEmail && (channelId || handle)) {
            const cleanHandle = (handle || detectedHandle || '').startsWith('@') ? (handle || detectedHandle) : `@${handle || detectedHandle || 'user'}`;
            const finalCookieToSave = formatInnertubeCookie(validatedCookie) || validatedCookie;

            const newRowPayload = {
              id: crypto.randomUUID(),
              email: targetEmail,
              channel_id: channelId || '',
              custom_handle: cleanHandle,
              channel_name: channelName || cleanHandle,
              youtube_refresh_token: finalCookieToSave
            };

            const { error: insErr } = await asSupabase.from('Youtube').insert(newRowPayload);
            if (!insErr) {
              updatedCount++;
              console.log(`[Extension Sync] Inserted NEW Youtube row for handle ${cleanHandle} (Email: ${targetEmail})`);
            }
          }
        }
      }
    } catch (e: any) {
      console.warn('[Extension Sync] Error updating asSupabase Youtube table:', e.message);
    }

    // 2. Fallback update hwSupabase profiles table
    try {
      const { data: profs } = await hwSupabase
        .from('profiles')
        .select('id, channel_id, custom_handle')
        .limit(10);

      if (profs && profs.length > 0) {
        let targetProf = profs[0];
        if (channelId) {
          const match = profs.find((p: any) => (p.channel_id || '').toLowerCase() === channelId.toLowerCase());
          if (match) targetProf = match;
        }

        const { error } = await hwSupabase
          .from('profiles')
          .update({ youtube_refresh_token: formattedCookie })
          .eq('id', targetProf.id);

        if (!error) {
          updatedCount++;
          console.log('[Extension Sync] Successfully updated profiles row in hwSupabase:', targetProf.id);
        }
      }
    } catch (e: any) {
      console.warn('[Extension Sync] Error updating hwSupabase profiles table:', e.message);
    }

    return NextResponse.json({
      success: true,
      message: 'YouTube InnerTube session cookies successfully synced to StreamClips database!',
      handle: handle || null,
      channelId: channelId || null,
      channelName: channelName || null,
      updatedCount
    });
  } catch (err: any) {
    console.error('[Extension Sync] Exception:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
