import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

async function scrapeYouTubeChannel(input: string) {
  try {
    const clean = input.trim();
    let url = '';
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      url = clean;
    } else if (clean.startsWith('UC')) {
      url = 'https://www.youtube.com/channel/' + clean;
    } else {
      const handle = clean.startsWith('@') ? clean : '@' + clean;
      url = 'https://www.youtube.com/' + handle;
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!res.ok) return null;
    const html = await res.text();

    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    const urlMatch = html.match(/<meta property="og:url" content="([^"]+)"/);
    const itemPropMatch = html.match(/<meta itemProp="identifier" content="(UC[a-zA-Z0-9_-]{22})"/i);
    const canonicalMatch = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/i);
    const rssMatch = html.match(/title="RSS" href="https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=(UC[a-zA-Z0-9_-]{22})"/i);
    const genericIdMatch = html.match(/(UC[a-zA-Z0-9_-]{22})/);

    const foundId = itemPropMatch?.[1] || canonicalMatch?.[1] || rssMatch?.[1] || (clean.startsWith('UC') ? clean : genericIdMatch?.[1] || '');
    const foundTitle = titleMatch ? titleMatch[1] : '';
    const foundAvatar = imageMatch ? imageMatch[1] : '';
    const channelUrl = urlMatch ? urlMatch[1] : '';

    let foundHandle = '';
    if (channelUrl.includes('/@')) {
      foundHandle = '@' + channelUrl.split('/@')[1].split('/')[0];
    } else if (clean.startsWith('@')) {
      foundHandle = clean;
    }

    if (foundTitle || foundId) {
      return {
        channelId: foundId,
        channelName: foundTitle,
        avatarUrl: foundAvatar,
        customHandle: foundHandle,
        views: 0,
        subscribers: 0
      };
    }
  } catch (err: any) {
    console.warn(`[YouTube Scrape] Failed scraping for ${input}:`, err.message);
  }
  return null;
}

async function fetchYouTubeChannel(providerToken: string, userEmail?: string, fullName?: string, userMetadata?: any) {
  // 1. Primary: Fetch via Google OAuth providerToken (mine=true)
  if (providerToken) {
    try {
      console.log('[YouTube Fetch] Fetching YouTube channel via Google OAuth token (mine=true)...');
      const res = await fetch('https://www.googleapis.com/youtube/v3/channels?mine=true&part=snippet,statistics', {
        headers: {
          Authorization: `Bearer ${providerToken}`,
          Accept: 'application/json'
        }
      });
      
      const resText = await res.text();
      if (res.ok) {
        const data = JSON.parse(resText);
        const item = data.items?.[0];
        if (item) {
          console.log(`[YouTube Fetch] SUCCESS: Found Channel ${item.snippet?.title} (ID: ${item.id})`);
          return {
            channelId: item.id,
            channelName: item.snippet?.title || '',
            customHandle: item.snippet?.customUrl || '',
            avatarUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
            views: parseInt(item.statistics?.viewCount || '0', 10),
            subscribers: parseInt(item.statistics?.subscriberCount || '0', 10)
          };
        }
      }

      // 1b. Fallback via managedByMe=true
      const resManaged = await fetch('https://www.googleapis.com/youtube/v3/channels?managedByMe=true&part=snippet,statistics', {
        headers: {
          Authorization: `Bearer ${providerToken}`,
          Accept: 'application/json'
        }
      });
      if (resManaged.ok) {
        const dataManaged = await resManaged.json();
        const itemManaged = dataManaged.items?.[0];
        if (itemManaged) {
          return {
            channelId: itemManaged.id,
            channelName: itemManaged.snippet?.title || '',
            customHandle: itemManaged.snippet?.customUrl || '',
            avatarUrl: itemManaged.snippet?.thumbnails?.high?.url || itemManaged.snippet?.thumbnails?.default?.url || '',
            views: parseInt(itemManaged.statistics?.viewCount || '0', 10),
            subscribers: parseInt(itemManaged.statistics?.subscriberCount || '0', 10)
          };
        }
      }
    } catch (err: any) {
      console.error('[YouTube Fetch] Provider token fetch error:', err.message);
    }
  }

  // 2. Candidate handle lookup via web scraper
  const emailHandle = userEmail ? userEmail.split('@')[0] : '';
  const nameHandle = fullName ? fullName.replace(/\s+/g, '').toLowerCase() : '';
  const candidates = Array.from(new Set([emailHandle, nameHandle])).filter(Boolean);

  for (const handleCandidate of candidates) {
    const scraped = await scrapeYouTubeChannel(handleCandidate);
    if (scraped && (scraped.channelId || scraped.channelName)) {
      return scraped;
    }
  }

  return null;
}

function getCanonicalOrigin(requestUrl: string): string {
  const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL;
  if (envSiteUrl && envSiteUrl.startsWith('http')) {
    return envSiteUrl.replace(/\/$/, '');
  }
  const url = new URL(requestUrl);
  let host = url.host;
  if (host.includes('--multichatpro.netlify.app')) {
    host = host.split('--')[1];
    return `${url.protocol}//${host}`;
  }
  return url.origin;
}

export async function GET(request: Request) {
  const canonicalOrigin = getCanonicalOrigin(request.url);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  const isConnectingYoutube = searchParams.get('connect_youtube') === 'true';

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { user, session }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && user) {
      const googleRefreshToken = session?.provider_refresh_token || session?.refresh_token || null;

      // 1. Fetch existing YouTube row for this user to check for filled YouTube channel details
      const { data: existingYtRow } = await supabase
        .from('Youtube')
        .select('*')
        .or(`id.eq.${user.id},email.eq.${user.email || ''}`)
        .limit(1)
        .maybeSingle();

      const existingChannelId = existingYtRow?.channel_id;
      const existingChannelName = existingYtRow?.channel_name;
      const existingCustomHandle = existingYtRow?.custom_handle;
      const existingAvatarUrl = existingYtRow?.avatar_url;
      const existingRefreshToken = existingYtRow?.youtube_refresh_token;
      const existingCookie = existingYtRow?.youtube_cookie;
      const existingViews = existingYtRow?.total_views;
      const existingSubs = existingYtRow?.subscribers;

      const hasFilledChannel = Boolean(
        (existingChannelId && existingChannelId.trim().length > 0 && !existingChannelId.startsWith('default')) ||
        (existingCustomHandle && existingCustomHandle.trim().length > 0 && existingCustomHandle !== '@creator') ||
        (existingCookie && existingCookie.trim().length > 0)
      );

      let channelIdVal: string | null = existingChannelId || null;
      let channelNameVal: string = existingChannelName || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '';
      let avatarUrlVal: string = existingAvatarUrl || user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
      let customHandleVal: string = existingCustomHandle || '@' + (user.email?.split('@')[0] || 'creator');
      let viewsVal: number = existingViews || 0;
      let subsVal: number = existingSubs || 0;

      // Attempt fetching live YouTube channel details IF connecting YouTube OR IF no filled channel exists
      if (isConnectingYoutube || !hasFilledChannel) {
        const ytChannel = await fetchYouTubeChannel(session?.provider_token || '', user.email, user.user_metadata?.full_name, user.user_metadata);
        if (ytChannel) {
          console.log(`[YouTube Fetch] Found YouTube channel: ${ytChannel.channelName} (ID: ${ytChannel.channelId})`);
          if (!existingChannelId && ytChannel.channelId) channelIdVal = ytChannel.channelId;
          if (!existingChannelName && ytChannel.channelName) channelNameVal = ytChannel.channelName;
          if (!existingAvatarUrl && ytChannel.avatarUrl) avatarUrlVal = ytChannel.avatarUrl;
          if (!existingCustomHandle && ytChannel.customHandle) customHandleVal = ytChannel.customHandle;
          if (!existingViews && ytChannel.views) viewsVal = ytChannel.views;
          if (!existingSubs && ytChannel.subscribers) subsVal = ytChannel.subscribers;
        }

        // Upsert into Central Auth 'Youtube' table (preserving existing connected details)
        const youtubePayload: any = {
          id: existingYtRow?.id || user.id,
          email: user.email || existingYtRow?.email || '',
          channel_id: existingChannelId || channelIdVal || '',
          channel_name: existingChannelName || channelNameVal,
          avatar_url: existingAvatarUrl || avatarUrlVal,
          total_views: (existingViews !== undefined && existingViews !== null && existingViews > 0) ? existingViews : viewsVal,
          subscribers: (existingSubs !== undefined && existingSubs !== null && existingSubs > 0) ? existingSubs : subsVal,
          custom_handle: existingCustomHandle || customHandleVal,
          youtube_refresh_token: existingRefreshToken || googleRefreshToken
        };

        const { error: ytErr } = await supabase
          .from('Youtube')
          .upsert(youtubePayload, { onConflict: 'id' });

        if (ytErr) {
          console.error('[Auth Callback] Error updating Youtube table:', ytErr.message);
        } else {
          console.log(`[Auth Callback] Successfully updated Youtube table (Preserved existing channel: ${hasFilledChannel})`);
        }

        // 2. Upsert into Central Auth 'profiles' table if it exists
        try {
          const profilePayload: any = {
            id: existingYtRow?.id || user.id,
            email: user.email || '',
            channel_id: existingChannelId || channelIdVal || '',
            channel_name: existingChannelName || channelNameVal,
            avatar_url: existingAvatarUrl || avatarUrlVal,
            total_views: (existingViews !== undefined && existingViews !== null && existingViews > 0) ? existingViews : viewsVal,
            subscribers: (existingSubs !== undefined && existingSubs !== null && existingSubs > 0) ? existingSubs : subsVal,
            youtube_refresh_token: existingRefreshToken || googleRefreshToken
          };

          await supabase
            .from('profiles')
            .upsert(profilePayload, { onConflict: 'id' });
        } catch (e) {}

        if (isConnectingYoutube) {
          return NextResponse.redirect(`${canonicalOrigin}${next}#youtube_connected=true`);
        }
      }

      // Check existing user
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, username')
        .eq('id', user.id)
        .maybeSingle();

      if (!existingUser || !existingUser.username) {
        return NextResponse.redirect(`${canonicalOrigin}/signup?email=${encodeURIComponent(user.email || '')}&next=${encodeURIComponent(next)}`)
      }

      const username = existingUser.username;
      const avatar = username.charAt(0).toUpperCase();
      const divider = next.includes('?') ? '&' : '?';
      const finalNext = `${next}${divider}username=${encodeURIComponent(username)}&avatar=${encodeURIComponent(avatar)}`;

      return NextResponse.redirect(`${canonicalOrigin}${finalNext}`)
    }
  }

  return NextResponse.redirect(`${canonicalOrigin}/auth/auth-code-error`)
}
