import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bwwdzkhtnaepamsfivds.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

function emailToUuid(email: string): string {
  const hash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, accessToken, refreshToken, avatarUrl, userId, email, channelId, chatroomId } = body;

    let matchedUserId = userId || '';
    let targetUserEmail = email || '';
    const targetEmailClean = targetUserEmail ? targetUserEmail.trim().toLowerCase() : '';

    if (!targetEmailClean) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    if (!matchedUserId) {
      matchedUserId = emailToUuid(targetEmailClean);
    }

    const cleanName = (username || 'kick_user').toLowerCase().replace(/^@+/, '').trim();
    let finalAvatar = avatarUrl || '';

    // Fetch real profile_pic from Kick channels v2 API if missing or placeholder
    if (!finalAvatar || finalAvatar.includes('default-avatar-1.webp')) {
      try {
        const res = await fetch(`https://kick.com/api/v2/channels/${cleanName}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/122.0.0.0',
            'Accept': 'application/json'
          }
        });
        if (res.ok) {
          const chData = await res.json();
          if (chData?.user?.profile_pic) {
            finalAvatar = chData.user.profile_pic;
          }
        }
      } catch (e) {}
    }

    const kickPayload: any = {
      id: matchedUserId,
      email: targetEmailClean,
      username: username || cleanName,
      channel_id: channelId || cleanName,
      chatroom_id: chatroomId || cleanName,
      avatar_url: finalAvatar,
      kick_access_token: accessToken || '',
      is_connected: true,
      updated_at: new Date().toISOString()
    };

    if (refreshToken) {
      kickPayload.kick_refresh_token = refreshToken;
    }

    const { error: upsertErr } = await supabase.from('Kick').upsert(kickPayload, { onConflict: 'email' });
    if (upsertErr) {
      console.warn('[Kick Save API] Upsert with ID note:', upsertErr.message);
      delete kickPayload.id;
      await supabase.from('Kick').upsert(kickPayload, { onConflict: 'email' });
    } else {
      console.log(`[Kick Save API] Successfully upserted Kick row for ${targetEmailClean}!`);
    }

    return NextResponse.json({ success: true, avatarUrl: finalAvatar });
  } catch (err: any) {
    console.error('[Kick Save API] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
