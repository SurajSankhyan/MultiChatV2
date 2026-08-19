import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KICK_DEFAULT_AVATARS } from '@/lib/kickDefaultAvatars';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bwwdzkhtnaepamsfivds.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3d2R6a2h0bmFlcGFtc2ZpdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzUxNjMsImV4cCI6MjA5ODQxMTE2M30.60vipeZzzdplww-8fuRD_LYvQ-2oawfNm-kx2ur3So0';
const supabase = createClient(supabaseUrl, supabaseKey);

const avatarCache = new Map<string, { buffer: ArrayBuffer; contentType: string; timestamp: number }>();
const userAvatarUrlCache = new Map<string, string>(); // username/userId -> files.kick.com URL

const KICK_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9'
};

function getDefaultWebpBuffer(username: string | null, userId: string | null, originalUrl?: string): Buffer | null {
  let index = 1;
  if (originalUrl && originalUrl.includes('default-avatar-')) {
    const match = originalUrl.match(/default-avatar-(\d+)/);
    if (match) {
      index = (parseInt(match[1]) % 6) || 1;
    }
  } else {
    const numId = parseInt(userId || '');
    if (numId && !isNaN(numId)) {
      index = (numId % 6) + 1;
    } else if (username) {
      let hash = 0;
      const cleanUser = username.toLowerCase();
      for (let i = 0; i < cleanUser.length; i++) {
        hash = cleanUser.charCodeAt(i) + ((hash << 5) - hash);
      }
      index = (Math.abs(hash) % 6) + 1;
    }
  }
  const b64 = KICK_DEFAULT_AVATARS[index] || KICK_DEFAULT_AVATARS[1];
  return b64 ? Buffer.from(b64, 'base64') : null;
}

async function getValidKickToken(): Promise<string | null> {
  try {
    const { data } = await supabase.from('Kick').select('*').order('updated_at', { ascending: false }).limit(1);
    if (!data || data.length === 0) return null;
    const row = data[0];
    let token = row.kick_access_token;
    const refreshToken = row.kick_refresh_token;

    if (!token && !refreshToken) return null;

    // Test current token validity
    const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    const testRes = await fetch('https://api.kick.com/public/v1/users?id=114048554', {
      headers: { ...KICK_HEADERS, 'Authorization': authHeader }
    });

    if (testRes.status === 401 && refreshToken) {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.KICK_CLIENT_ID || '01KZGGD32S5919AGF28KSKKT1J',
        client_secret: process.env.KICK_CLIENT_SECRET || 'fb569011d2a1d96acd782fd08bdf472fcfaeebd46efe6876d1fd073ead084d89',
        refresh_token: refreshToken
      });

      const refreshRes = await fetch('https://id.kick.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });

      if (refreshRes.ok) {
        const refreshJson = await refreshRes.json();
        token = refreshJson.access_token;
        const newRefreshToken = refreshJson.refresh_token || refreshToken;
        await supabase.from('Kick').update({
          kick_access_token: token,
          kick_refresh_token: newRefreshToken,
          updated_at: new Date().toISOString()
        }).eq('id', row.id);
      }
    }

    return token;
  } catch (e) {
    return null;
  }
}

async function resolveKickUserAvatarUrl(username: string | null, userId: string | null): Promise<string | null> {
  const cacheKey = (userId || username || '').toLowerCase().trim();
  if (!cacheKey) return null;
  if (userAvatarUrlCache.has(cacheKey)) {
    return userAvatarUrlCache.get(cacheKey)!;
  }

  let profilePicUrl: string | null = null;
  const targetUser = username ? username.toLowerCase().trim() : null;

  // 1. Try with OAuth token if available
  const token = await getValidKickToken();
  if (token) {
    try {
      const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

      if (userId) {
        const res = await fetch(`https://api.kick.com/public/v1/users?id=${encodeURIComponent(userId)}`, {
          headers: { ...KICK_HEADERS, 'Authorization': authHeader }
        });
        if (res.ok) {
          const json = await res.json();
          const uData = Array.isArray(json?.data) ? json.data.find((u: any) => String(u.user_id || u.id) === String(userId) || (targetUser && String(u.name || u.username || '').toLowerCase() === targetUser)) : null;
          if (uData && uData.profile_picture && !uData.profile_picture.includes('default-avatar')) {
            profilePicUrl = uData.profile_picture;
          }
        }
      }

      if (!profilePicUrl && targetUser) {
        const res = await fetch(`https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(targetUser)}`, {
          headers: { ...KICK_HEADERS, 'Authorization': authHeader }
        });
        if (res.ok) {
          const json = await res.json();
          const chData = Array.isArray(json?.data) ? json.data.find((c: any) => String(c.slug || '').toLowerCase().trim() === targetUser) : null;
          if (chData) {
            const bId = chData?.broadcaster_user_id || chData?.user_id;
            if (bId) {
              const uRes = await fetch(`https://api.kick.com/public/v1/users?id=${bId}`, {
                headers: { ...KICK_HEADERS, 'Authorization': authHeader }
              });
              if (uRes.ok) {
                const uJson = await uRes.json();
                const uData = Array.isArray(uJson?.data) ? uJson.data.find((u: any) => String(u.user_id || u.id) === String(bId) || String(u.name || u.username || '').toLowerCase() === targetUser) : null;
                if (uData && uData.profile_picture && !uData.profile_picture.includes('default-avatar')) {
                  profilePicUrl = uData.profile_picture;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      // Continue to unauthenticated fallbacks
    }
  }

  // 2. Unauthenticated Kick API v2 channel fallback
  if (!profilePicUrl && targetUser) {
    try {
      const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(targetUser)}`, {
        headers: KICK_HEADERS
      });
      if (res.ok) {
        const json = await res.json();
        const chSlug = (json?.slug || '').toLowerCase().trim();
        const uSlug = (json?.user?.username || json?.user?.slug || '').toLowerCase().trim();
        if (chSlug === targetUser || uSlug === targetUser) {
          const pic = json?.user?.profile_pic || json?.user?.profile_picture || json?.user?.avatar;
          if (pic && typeof pic === 'string' && !pic.includes('default-avatar')) {
            profilePicUrl = pic;
          }
        }
      }
    } catch (e) {}
  }

  // 3. 7TV Kick User Endpoint fallback
  if (!profilePicUrl && userId) {
    try {
      const res = await fetch(`https://7tv.io/v3/users/kick/${encodeURIComponent(userId)}`, {
        headers: { 'User-Agent': KICK_HEADERS['User-Agent'] }
      });
      if (res.ok) {
        const json = await res.json();
        const pic = json?.user?.avatar_url || json?.avatar_url;
        if (pic && typeof pic === 'string' && !pic.includes('default-avatar')) {
          profilePicUrl = pic.startsWith('//') ? `https:${pic}` : pic;
        }
      }
    } catch (e) {}
  }

  if (profilePicUrl) {
    userAvatarUrlCache.set(cacheKey, profilePicUrl);
    if (username) userAvatarUrlCache.set(username.toLowerCase().trim(), profilePicUrl);
    if (userId) userAvatarUrlCache.set(userId.trim(), profilePicUrl);
  }
  return profilePicUrl;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get('url') || searchParams.get('src') || '';
    const username = searchParams.get('username') || searchParams.get('user') || searchParams.get('slug') || '';
    const userId = searchParams.get('userId') || searchParams.get('id') || '';

    // Resolve avatar via Kick Public API if missing or placeholder
    const isDefault = !targetUrl || targetUrl.includes('default-avatar') || targetUrl.includes('kick.com/img/') || targetUrl === 'default' || targetUrl === 'null' || targetUrl === 'undefined';

    if (isDefault && (username || userId)) {
      const resolvedUrl = await resolveKickUserAvatarUrl(username, userId);
      if (resolvedUrl) {
        targetUrl = resolvedUrl;
      }
    }

    const wantsJson = searchParams.get('json') === 'true';
    if (wantsJson) {
      if (targetUrl && (targetUrl.includes('files.kick.com') || (targetUrl.startsWith('http') && !targetUrl.includes('default-avatar')))) {
        return NextResponse.json({ avatar: decodeURIComponent(targetUrl).trim() });
      }
      return NextResponse.json({ avatar: null });
    }

    // If valid remote image found, redirect browser directly to Kick CDN image for instant load
    if (targetUrl && (targetUrl.includes('files.kick.com') || (targetUrl.startsWith('http') && !targetUrl.includes('default-avatar')))) {
      targetUrl = decodeURIComponent(targetUrl).trim();
      return NextResponse.redirect(targetUrl, {
        status: 307,
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          'Vary': 'Accept, Accept-Encoding'
        }
      });
    }

    // Fallback: return bundled default WebP buffer with HTTP 200 OK for this user
    const webpBuf = getDefaultWebpBuffer(username, userId, targetUrl);
    if (webpBuf) {
      return new NextResponse(new Uint8Array(webpBuf), {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          'Vary': 'Accept, Accept-Encoding'
        }
      });
    }

    return new NextResponse('Avatar not found', { status: 404 });
  } catch (err: any) {
    const fallbackBuf = getDefaultWebpBuffer(null, null);
    if (fallbackBuf) {
      return new NextResponse(new Uint8Array(fallbackBuf), {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }
    return new NextResponse(err.message || 'Avatar proxy error', { status: 500 });
  }
}
