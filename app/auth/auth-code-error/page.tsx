'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

async function fetchYouTubeChannelClient(providerToken: string, userEmail?: string, fullName?: string) {
  const emailHandle = userEmail ? userEmail.split('@')[0] : '';
  const nameHandle = fullName ? fullName.replace(/\s+/g, '').toLowerCase() : '';
  const candidates = Array.from(new Set([emailHandle, nameHandle])).filter(Boolean);

  for (const candidate of candidates) {
    try {
      const res = await fetch('/api/youtube/innertube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_channel',
          handleOrId: candidate
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.channelId) {
          return {
            channelId: data.channelId,
            channelName: data.channelName,
            customHandle: data.customHandle,
            avatarUrl: data.avatarUrl,
            views: 0,
            subscribers: 0
          };
        }
      }
    } catch (err: any) {
      console.warn('[YouTube Fetch Client] InnerTube lookup notice:', err.message);
    }
  }
  return null;
}

export default function AuthCodeErrorPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Extracting YouTube channel details...');

  useEffect(() => {
    const handleAuthFallback = async () => {
      try {
        const supabase = createClient();
        
        // 1. Extract hash fragment from URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);

        // 2. Get current session
        const { data: { session } } = await supabase.auth.getSession();

        const providerToken = hashParams.get('provider_token') || session?.provider_token || hashParams.get('access_token');
        const providerRefreshToken = hashParams.get('provider_refresh_token') || 
                                     session?.provider_refresh_token || 
                                     hashParams.get('refresh_token') ||
                                     session?.refresh_token;

        const user = session?.user;

        if (user) {
          setStatus('Checking existing YouTube channel profile...');
          const email = user.email || '';
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0];

          // 1. Fetch existing YouTube row for this user
          const { data: existingYtRow } = await supabase
            .from('Youtube')
            .select('*')
            .or(`id.eq.${user.id},email.eq.${email}`)
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
          
          let channelIdVal = existingChannelId || '';
          let channelNameVal = existingChannelName || fullName;
          let avatarUrlVal = existingAvatarUrl || user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
          let customHandleVal = existingCustomHandle || '@' + (email.split('@')[0] || 'creator');
          let viewsVal = existingViews || 0;
          let subsVal = existingSubs || 0;

          if (providerToken && !hasFilledChannel) {
            const ytChannel = await fetchYouTubeChannelClient(providerToken, email, fullName);
            if (ytChannel) {
              if (!existingChannelId && ytChannel.channelId) channelIdVal = ytChannel.channelId;
              if (!existingChannelName && ytChannel.channelName) channelNameVal = ytChannel.channelName;
              if (!existingAvatarUrl && ytChannel.avatarUrl) avatarUrlVal = ytChannel.avatarUrl;
              if (!existingCustomHandle && ytChannel.customHandle) customHandleVal = ytChannel.customHandle;
              if (!existingViews && ytChannel.views) viewsVal = ytChannel.views;
              if (!existingSubs && ytChannel.subscribers) subsVal = ytChannel.subscribers;
            }
          }

          setStatus('Saving to Central Auth Youtube & profiles tables...');

          const payload = {
            id: existingYtRow?.id || user.id,
            email: email || existingYtRow?.email || '',
            channel_id: existingChannelId || channelIdVal,
            channel_name: existingChannelName || channelNameVal,
            avatar_url: existingAvatarUrl || avatarUrlVal,
            total_views: (existingViews !== undefined && existingViews !== null && existingViews > 0) ? existingViews : viewsVal,
            subscribers: (existingSubs !== undefined && existingSubs !== null && existingSubs > 0) ? existingSubs : subsVal,
            custom_handle: existingCustomHandle || customHandleVal,
            youtube_refresh_token: existingRefreshToken || providerRefreshToken || null
          };

          // 1. Upsert Central Auth 'Youtube' table
          const { error: ytErr } = await supabase
            .from('Youtube')
            .upsert(payload, { onConflict: 'id' });

          if (ytErr) {
            console.error('[Auth Fallback] Failed saving to Youtube table:', ytErr.message);
          } else {
            console.log(`[Auth Fallback] Successfully updated Youtube table (Preserved channel: ${hasFilledChannel})`);
          }

          // 2. Upsert 'profiles' table
          try {
            await supabase
              .from('profiles')
              .upsert(payload, { onConflict: 'id' });
          } catch (e) {}
        }

        // Redirect back to dashboard
        router.replace('/dashboard#youtube_connected=true');
      } catch (err: any) {
        console.error('[Auth Fallback] Exception:', err.message);
        router.replace('/dashboard');
      }
    };

    handleAuthFallback();
  }, [router]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0a0b14',
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        padding: '36px 48px',
        borderRadius: '20px',
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: '#10b981',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px auto'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <h2 style={{ marginBottom: '8px', fontSize: '20px', fontWeight: 700 }}>Completing YouTube Connection</h2>
        <p style={{ color: '#a1a1aa', fontSize: '14px' }}>{status}</p>
      </div>
    </div>
  );
}
