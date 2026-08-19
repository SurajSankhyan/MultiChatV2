import React, { useState, useEffect } from 'react';
import ChatDashboard from './components/ChatDashboard';
import OverlayView from './components/OverlayView';

const DEFAULT_SETTINGS = {
  theme: 'default',
  textSize: 15,
  chatStyle: 'default',
  showTimestamps: true,
  showIcons: true,
  showBadges: true,
  showLevelBadges: true,
  showChannelName: false,
  removeAtSymbol: false,
  alternatingBackgrounds: false,
  twitchColors: true,
  showQuickModActions: true,
  showYoutubeProfilePictures: true,
  showTwitchProfilePictures: true,
  showKickProfilePictures: true,
  randomNameColors: true,
  hideBotMessages: false,
  overlayFadeTime: 10,
  enableTts: false,
  enableSuperchatTts: false,
  ttsVolume: 50,
  ttsSpeed: 1.0,
  ttsReadUsernames: true,
  ttsVoiceName: '',
  enableMentionSound: false,
  mentionSoundVolume: 50,
  overlayCustomCss: '',
  overlayTextOutline: true,
  overlayTextShadow: 'medium',
  blocklist: [],
  youtubeChatMode: 'live'
};

const DEFAULT_CHANNELS = [];

class DashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Dashboard Error Boundary]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', color: '#f87171', background: '#18181b', borderRadius: '12px', margin: '24px', fontFamily: 'sans-serif' }}>
          <h3 style={{ color: '#ef4444', marginBottom: '8px' }}>⚠️ Dashboard Component Render Warning</h3>
          <p style={{ color: '#e4e4e7', fontSize: '14px', marginBottom: '12px' }}>An isolated error occurred while rendering chat messages. The rest of the workspace remains active.</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#09090b', padding: '12px', borderRadius: '6px', fontSize: '12px', color: '#fca5a5' }}>
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })} 
            style={{ marginTop: '16px', padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            Clear & Resume Feed
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App({ logout }) {
  const modeDemo = false;
  const [page, setPage] = useState('chat');
  const [user, setUser] = useState({ username: 'Streamer', avatar: 'S' });
  const [activeChannels, setActiveChannels] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('prochat_channels');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return DEFAULT_CHANNELS;
  });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [messages, setMessagesRaw] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('prochat_cached_chat_messages');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.slice(-200);
          }
        }
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    if (messages.length > 0) {
      try {
        const toCache = messages.filter(m => !m.isSystemEvent).slice(-200);
        localStorage.setItem('prochat_cached_chat_messages', JSON.stringify(toCache));
      } catch (e) {}
    } else {
      try {
        localStorage.removeItem('prochat_cached_chat_messages');
      } catch (e) {}
    }
  }, [messages]);

  const setMessages = React.useCallback((update) => {
    setMessagesRaw(prev => {
      const rawNext = typeof update === 'function' ? update(prev) : update;
      const seenIds = new Set();
      const next = [];
      if (Array.isArray(rawNext)) {
        for (const item of rawNext) {
          if (item && item.id) {
            if (seenIds.has(item.id)) continue;
            seenIds.add(item.id);
          }
          next.push(item);
        }
      }
      if (next.length > 2000) {
        return next.slice(-2000);
      }
      return next;
    });
  }, []);

  // Client router path sync & Preferences route handling
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash.toLowerCase();

      if (path.includes('overlay')) {
        setPage('overlay');
      } else {
        setPage('chat');
      }

      if (path.includes('preferences') || path.includes('settings') || params.get('openSettings') === 'true' || params.get('settings') === 'true' || hash.includes('preferences') || hash.includes('settings')) {
        setIsSettingsOpen(true);
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Sync settings and active channels from local storage
  useEffect(() => {
    if (modeDemo) {
      setActiveChannels([
        { id: 'demo-youtube', name: 'DemoStreamerYT', platform: 'youtube', enabled: true },
        { id: 'demo-twitch', name: 'DemoStreamerTwitch', platform: 'twitch', enabled: true },
        { id: 'demo-kick', name: 'DemoStreamerKick', platform: 'kick', enabled: true }
      ]);
    } else {
      const storedChannels = localStorage.getItem('prochat_channels');
      if (storedChannels) {
        setActiveChannels(JSON.parse(storedChannels));
      } else {
        setActiveChannels(DEFAULT_CHANNELS);
        localStorage.setItem('prochat_channels', JSON.stringify(DEFAULT_CHANNELS));
      }
    }

    const storedSettings = localStorage.getItem('prochat_settings');
    if (storedSettings) {
      setSettings(JSON.parse(storedSettings));
    } else {
      setSettings(DEFAULT_SETTINGS);
      localStorage.setItem('prochat_settings', JSON.stringify(DEFAULT_SETTINGS));
    }

    const loadUserSession = async () => {
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const { multichatSupabase } = await import('@/lib/supabase');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        let currentUser = { username: 'Streamer', avatar: 'S' };
        const storedUser = localStorage.getItem('prochat_user');
        if (storedUser) {
          currentUser = JSON.parse(storedUser);
        }

        // Always parse URL parameters first if present
        const params = new URLSearchParams(window.location.search);
        const urlUsername = params.get('username');
        const urlAvatar = params.get('avatar');
        if (urlUsername) {
          const username = decodeURIComponent(urlUsername);
          const avatar = urlAvatar ? decodeURIComponent(urlAvatar) : username.charAt(0).toUpperCase();
          currentUser = { ...currentUser, username, avatar };
          localStorage.setItem('prochat_user', JSON.stringify(currentUser));
        }

        if (session?.user) {
          let dbUsername = '';
          let dbAvatarUrl = '';

          // 1. Fetch custom username from central 'users' table
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('username')
              .eq('id', session.user.id)
              .maybeSingle();
            if (userData?.username) {
              dbUsername = userData.username;
            }
          } catch (e) {
            console.warn('Error fetching from users table:', e);
          }

          // 2. Fetch creator profile from central 'profiles' table
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('avatar_url, channel_name')
              .eq('id', session.user.id)
              .maybeSingle();
            if (profileData?.avatar_url) {
              dbAvatarUrl = profileData.avatar_url;
            }
            if (!dbUsername && profileData?.channel_name) {
              dbUsername = profileData.channel_name;
            }
          } catch (e) {
            console.warn('Error fetching from central profiles table:', e);
          }

          // 3. MultiChat DB Verification: Check user ID & email against https://ashezgjtjmtdchkrcuyx.supabase.co (Youtube table)
          let ytConnectedAccount = null;
          try {
            const { asSupabase, hwSupabase } = await import('@/lib/supabase');

            // 3a. Check 'Youtube' table in asSupabase
            if (session.user.id || session.user.email) {
              let ytRows = null;

              if (session.user.email) {
                try {
                  const res = await asSupabase.from('Youtube').select('*').eq('email', session.user.email);
                  if (res.data && res.data.length > 0) ytRows = res.data;
                } catch (e) {}
              }
              if ((!ytRows || ytRows.length === 0) && session.user.id) {
                try {
                  const res = await asSupabase.from('Youtube').select('*').eq('id', session.user.id);
                  if (res.data && res.data.length > 0) ytRows = res.data;
                } catch (e) {}
              }

              if (Array.isArray(ytRows) && ytRows.length > 0) {
                // Find any valid YouTube channel row (OAuth token, cookie, or valid handle/ID)
                const ytData = ytRows.find(u => 
                  (u.custom_handle && u.custom_handle !== '@user') ||
                  (u.channel_id && u.channel_id !== 'EMPTY') ||
                  (u.channel_name && u.channel_name !== '@user') ||
                  (u.youtube_cookie && u.youtube_cookie.trim().length > 0) ||
                  (u.refresh_token && u.refresh_token.trim().length > 0) ||
                  (u.youtube_refresh_token && u.youtube_refresh_token.trim().length > 0)
                ) || ytRows[0];

                if (ytData && (ytData.custom_handle || ytData.channel_id || ytData.channel_name)) {
                  ytConnectedAccount = {
                    channel_id: ytData.channel_id,
                    custom_handle: ytData.custom_handle,
                    channel_name: ytData.channel_name,
                    avatar_url: ytData.avatar_url,
                    refresh_token: ytData.youtube_cookie || ytData.youtube_refresh_token || ytData.refresh_token || ''
                  };
                }

                // Clean up any incomplete duplicate rows for this email
                if (session.user.email && ytData?.id) {
                  try {
                    asSupabase
                      .from('Youtube')
                      .delete()
                      .eq('email', session.user.email)
                      .neq('id', ytData.id)
                      .or('channel_id.eq.EMPTY,channel_name.eq.@user')
                      .then(() => {});
                  } catch (e) {}
                }
              }
            }

            // 3b. Fallback check on 'profiles' if needed
            if (!ytConnectedAccount && (session.user.id || session.user.email)) {
              let profData = null;
              if (session.user.email) {
                try {
                  const res = await hwSupabase.from('profiles').select('*').eq('email', session.user.email).limit(1).maybeSingle();
                  if (res.data) profData = res.data;
                } catch (e) {}
              }
              if (!profData && session.user.id) {
                try {
                  const res = await hwSupabase.from('profiles').select('*').eq('id', session.user.id).limit(1).maybeSingle();
                  if (res.data) profData = res.data;
                } catch (e) {}
              }

              if (profData && (profData.custom_handle || profData.channel_id || profData.channel_name)) {
                ytConnectedAccount = {
                  channel_id: profData.channel_id,
                  custom_handle: profData.custom_handle,
                  channel_name: profData.channel_name,
                  avatar_url: profData.avatar_url,
                  refresh_token: profData.youtube_cookie || profData.youtube_refresh_token || profData.refresh_token || ''
                };
              }
            }
          } catch (mcErr) {
            console.warn('Error verifying user against MultiChat DB:', mcErr);
          }

          const username = (urlUsername ? decodeURIComponent(urlUsername) : null) || ytConnectedAccount?.channel_name || ytConnectedAccount?.custom_handle || dbUsername || session.user.user_metadata?.username || session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Streamer';
          const avatarUrl = ytConnectedAccount?.avatar_url || dbAvatarUrl || session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '';
          
          currentUser = {
            id: session.user.id,
            email: session.user.email,
            username,
            avatar: avatarUrl || username.charAt(0).toUpperCase(),
            avatarUrl: avatarUrl || '',
            ytChannelId: ytConnectedAccount?.channel_id || null,
            ytChannelName: ytConnectedAccount?.channel_name || null,
            ytCustomHandle: ytConnectedAccount?.custom_handle || null,
            channel_name: ytConnectedAccount?.channel_name || null,
            custom_handle: ytConnectedAccount?.custom_handle || null
          };
          localStorage.setItem('prochat_user', JSON.stringify(currentUser));
          setUser(currentUser);

          // 4. Auto-connect verified YouTube channel in MultiChat activeChannels using custom_handle (@username), channel_name, or channel_id
          if (ytConnectedAccount && (ytConnectedAccount.custom_handle || ytConnectedAccount.channel_id || ytConnectedAccount.channel_name)) {
            const handleOrId = ytConnectedAccount.custom_handle || ytConnectedAccount.channel_id || ytConnectedAccount.channel_name;

            setActiveChannels(prevChannels => {
              const cleanVerified = (handleOrId || '').toLowerCase().replace('@', '').trim();
              const existingIdx = prevChannels.findIndex(ch => 
                ch.platform === 'youtube' && (
                  ch.id === ytConnectedAccount.channel_id || 
                  (ch.name && ch.name.toLowerCase().replace('@', '').trim() === cleanVerified)
                )
              );

              const verifiedChannel = {
                id: ytConnectedAccount.channel_id || handleOrId,
                name: handleOrId,
                displayName: ytConnectedAccount.channel_name || ytConnectedAccount.custom_handle || handleOrId,
                avatar: ytConnectedAccount.avatar_url || ytConnectedAccount.avatar,
                platform: 'youtube',
                enabled: true,
                verified: true,
                userId: session.user.id,
                userEmail: session.user.email
              };

              let updatedList;
              if (existingIdx >= 0) {
                updatedList = [...prevChannels];
                updatedList[existingIdx] = { ...updatedList[existingIdx], ...verifiedChannel };
              } else {
                updatedList = [verifiedChannel, ...prevChannels];
              }

              localStorage.setItem('prochat_channels', JSON.stringify(updatedList));
              return updatedList;
            });
          }

          // 5. Fetch Kick connected account for this user from central Supabase Kick table
          try {
            const { asSupabase } = await import('@/lib/supabase');
            let foundKick = false;

            const isExplicitlyDisconnected = typeof window !== 'undefined' && localStorage.getItem('prochat_kick_disconnected') === 'true';

            if (!isExplicitlyDisconnected && (session.user.id || session.user.email)) {
              let kickRows = null;
              if (session.user.email) {
                try {
                  const res = await asSupabase.from('Kick').select('*').eq('email', session.user.email);
                  if (res.data && res.data.length > 0) kickRows = res.data;
                } catch (e) {}
              }
              if ((!kickRows || kickRows.length === 0) && session.user.id) {
                try {
                  const res = await asSupabase.from('Kick').select('*').eq('id', session.user.id);
                  if (res.data && res.data.length > 0) kickRows = res.data;
                } catch (e) {}
              }

              if (Array.isArray(kickRows) && kickRows.length > 0) {
                const kickData = kickRows.find(k => k.username && k.is_connected !== false);
                if (kickData && kickData.username && kickData.is_connected !== false) {
                  foundKick = true;
                  const cleanKick = kickData.username.toLowerCase().replace(/^@+/, '').trim();
                  if (kickData.kick_access_token) {
                    localStorage.setItem('prochat_kick_auth_token', kickData.kick_access_token);
                  }
                  if (kickData.kick_refresh_token) {
                    localStorage.setItem('prochat_kick_refresh_token', kickData.kick_refresh_token);
                  }
                  localStorage.setItem('prochat_kick_username', kickData.username);

                  setActiveChannels(prev => {
                    const existingIdx = prev.findIndex(ch => 
                      ch.platform === 'kick' && (
                        ch.id === `kick_${cleanKick}` || 
                        (ch.name && ch.name.toLowerCase().replace('@', '').trim() === cleanKick)
                      )
                    );

                    const newKickCh = {
                      id: `kick_${cleanKick}`,
                      name: cleanKick,
                      displayName: kickData.username,
                      avatar: kickData.avatar_url,
                      platform: 'kick',
                      enabled: true,
                      verified: true
                    };

                    let updated;
                    if (existingIdx >= 0) {
                      updated = [...prev];
                      updated[existingIdx] = { ...updated[existingIdx], ...newKickCh };
                    } else {
                      updated = [newKickCh, ...prev];
                    }

                    localStorage.setItem('prochat_channels', JSON.stringify(updated));
                    return updated;
                  });
                }
              }
            }

            if (!foundKick) {
              const localKickToken = localStorage.getItem('prochat_kick_auth_token');
              const localKickUsername = localStorage.getItem('prochat_kick_username');

              if (localKickToken && localKickUsername && (session?.user?.id || session?.user?.email)) {
                // Auto-sync local Kick credentials to Supabase Kick table
                const cleanKick = localKickUsername.toLowerCase().replace(/^@+/, '').trim();
                const userIdVal = session.user.id;
                const userEmailVal = (session.user.email || '').toLowerCase().trim();

                const payload = {
                  id: userIdVal,
                  email: userEmailVal,
                  username: localKickUsername,
                  channel_id: cleanKick,
                  chatroom_id: cleanKick,
                  kick_access_token: localKickToken,
                  kick_refresh_token: localStorage.getItem('prochat_kick_refresh_token') || undefined,
                  is_connected: true,
                  updated_at: new Date().toISOString()
                };

                if (userIdVal && userEmailVal) {
                  asSupabase.from('users').upsert({
                    id: userIdVal,
                    email: userEmailVal,
                    username: userEmailVal.split('@')[0],
                    updated_at: new Date().toISOString()
                  }, { onConflict: 'id' }).then(() => {
                    asSupabase.from('Kick').upsert(payload, { onConflict: 'id' })
                      .then(({ error }) => {
                        if (error) console.warn('[App] Kick table sync note:', error.message);
                      });
                  });
                } else {
                  asSupabase.from('Kick').upsert(payload, { onConflict: userIdVal ? 'id' : 'email' })
                    .then(({ error }) => {
                      if (error) console.warn('[App] Kick table sync note:', error.message);
                    });
                }
              } else {
                // Clear any stale Kick token/username from previous logged in user without deleting user added channels
                localStorage.removeItem('prochat_kick_auth_token');
                localStorage.removeItem('prochat_kick_username');
              }
            }
          } catch (kErr) {
            console.warn('Error checking Kick account in Supabase:', kErr);
          }
        } else {
          setUser(currentUser);
        }

        // Clean up URL parameters if present to keep address bar clean
        if (urlUsername) {
          const newUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, newUrl);
        }
      } catch (err) {
        console.error('Error loading user session:', err);
      }
    };

    loadUserSession();
  }, []);

  // Handle URL search and hash parameters for Kick connected status
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const isKickConnected = searchParams.get('kick_connected') === 'true' || hashParams.get('kick_connected') === 'true';
      const kickUser = searchParams.get('kick_user') || hashParams.get('kick_user') || searchParams.get('kick_username') || hashParams.get('kick_username');
      const urlKickToken = searchParams.get('kick_token') || hashParams.get('kick_token');
      const urlKickRefreshToken = searchParams.get('kick_refresh_token') || hashParams.get('kick_refresh_token');
      const kickAvatar = searchParams.get('avatar_url') || hashParams.get('avatar_url') || '';
      const kickError = searchParams.get('kick_error') || hashParams.get('kick_error');

      if (kickError) {
        alert(`Kick Connection Notice: ${decodeURIComponent(kickError)}`);
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        return;
      }

      if (isKickConnected || (urlKickToken && kickUser)) {
        const kickToken = urlKickToken || localStorage.getItem('prochat_kick_auth_token') || '';
        const kickRefreshToken = urlKickRefreshToken || localStorage.getItem('prochat_kick_refresh_token') || '';
        localStorage.removeItem('prochat_kick_disconnected');
        if (kickToken) localStorage.setItem('prochat_kick_auth_token', kickToken);
        if (kickRefreshToken) localStorage.setItem('prochat_kick_refresh_token', kickRefreshToken);
        if (kickUser) localStorage.setItem('prochat_kick_username', kickUser);

        if (kickUser) {
          const cleanKick = kickUser.toLowerCase().replace(/^@+/, '').trim();
          setActiveChannels(prev => {
            const existingIdx = prev.findIndex(ch => 
              ch.platform === 'kick' && (
                ch.id === `kick_${cleanKick}` || 
                (ch.name && ch.name.toLowerCase().replace('@', '').trim() === cleanKick)
              )
            );
            const newKickCh = {
              id: `kick_${cleanKick}`,
              name: cleanKick,
              displayName: kickUser,
              avatar: kickAvatar || `https://kick.com/api/v1/channels/${cleanKick}/profile-image`,
              platform: 'kick',
              enabled: true,
              verified: true
            };
            let updated;
            if (existingIdx >= 0) {
              updated = [...prev];
              updated[existingIdx] = { ...updated[existingIdx], ...newKickCh };
            } else {
              updated = [newKickCh, ...prev];
            }
            localStorage.setItem('prochat_channels', JSON.stringify(updated));
            return updated;
          });

          // Perform client-side sync to Supabase public.Kick table with authenticated user session
          import('@/lib/supabase').then(({ asSupabase }) => {
            asSupabase.auth.getSession().then(async ({ data: { session } }) => {
              const urlEmail = searchParams.get('email') || hashParams.get('email');
              const urlUserId = searchParams.get('user_id') || hashParams.get('user_id');

              let localUser = {};
              try { localUser = JSON.parse(localStorage.getItem('prochat_user') || '{}'); } catch(e) {}

              const uId = urlUserId || session?.user?.id || localUser.id || '';
              const uEmail = (urlEmail || session?.user?.email || localUser.email || '').toLowerCase().trim();

              if (uId || uEmail) {
                let resolvedAvatar = kickAvatar || '';
                if (!resolvedAvatar) {
                  try {
                    const res = await fetch(`https://kick.com/api/v2/channels/${cleanKick}`);
                    if (res.ok) {
                      const chData = await res.json();
                      if (chData?.user?.profile_pic) resolvedAvatar = chData.user.profile_pic;
                    }
                  } catch (e) {}
                }

                // 1. Post payload to /api/kick/save API
                fetch('/api/kick/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    username: kickUser,
                    accessToken: kickToken,
                    refreshToken: kickRefreshToken,
                    avatarUrl: resolvedAvatar,
                    email: uEmail,
                    userId: uId,
                    channelId: cleanKick,
                    chatroomId: cleanKick
                  })
                }).catch(() => {});

                // 1.5. Check if another email is using uId in Kick table, re-assign old email row
                if (uId && uEmail) {
                  try {
                    const { data: mismatchRow } = await asSupabase
                      .from('Kick')
                      .select('*')
                      .eq('id', uId)
                      .neq('email', uEmail)
                      .maybeSingle();

                    if (mismatchRow && mismatchRow.email) {
                      const oldEmail = mismatchRow.email.toLowerCase().trim();
                      const newOldId = uId.slice(0, 31) + (uId.slice(-1) === '1' ? '2' : '1');

                      try {
                        await asSupabase.from('users').upsert({
                          id: newOldId,
                          email: oldEmail,
                          username: oldEmail.split('@')[0],
                          updated_at: new Date().toISOString()
                        }, { onConflict: 'id' });
                      } catch (e) {}

                      try {
                        await asSupabase.from('Kick').update({ id: newOldId }).eq('email', oldEmail);
                      } catch (e) {}
                    }
                  } catch (e) {}
                }

                // 2. Ensure user row exists in public.users to satisfy Foreign Key constraints
                if (uId && uEmail) {
                  try {
                    await asSupabase.from('users').upsert({
                      id: uId,
                      email: uEmail,
                      username: uEmail.split('@')[0],
                      updated_at: new Date().toISOString()
                    }, { onConflict: 'id' });
                  } catch (uErr) {}
                }

                if (uEmail) {
                  const payload = {
                    username: kickUser,
                    channel_id: cleanKick,
                    chatroom_id: cleanKick,
                    avatar_url: resolvedAvatar,
                    kick_access_token: kickToken || '',
                    is_connected: true,
                    email: uEmail,
                    updated_at: new Date().toISOString()
                  };
                  if (kickRefreshToken) payload.kick_refresh_token = kickRefreshToken;
                  if (uId) payload.id = uId;

                  console.log('[App] Upserting Kick table row strictly for email', uEmail);
                  const { error: upsertErr } = await asSupabase.from('Kick').upsert(payload, { onConflict: 'email' });
                  if (upsertErr) {
                    console.warn('[App] Kick upsert with ID note:', upsertErr.message);
                    delete payload.id;
                    await asSupabase.from('Kick').upsert(payload, { onConflict: 'email' });
                  }
                }
              }
            });
          }).catch(() => {});
        }

        if (isKickConnected) {
          alert(`🎉 Kick Account (@${kickUser || 'connected'}) Connected Successfully!`);
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      }
    }
  }, []);

  // Apply dashboard theme dynamically to document root
  useEffect(() => {
    if (page === 'chat' && settings.theme) {
      document.body.className = `theme-${settings.theme}`;
      document.body.style.background = 'var(--bg-dark)';
    } else if (page === 'overlay') {
      document.body.style.background = 'transparent';
    } else {
      document.body.className = 'theme-default';
      document.body.style.background = 'var(--bg-dark)';
    }

    // Apply custom accent color if set
    if (settings.accentColor) {
      document.documentElement.style.setProperty('--accent-color', settings.accentColor);
      // Generate a soft glow color
      const glowColor = settings.accentColor + '1a'; // 10% opacity hex
      document.documentElement.style.setProperty('--accent-glow', glowColor);
    } else {
      document.documentElement.style.removeProperty('--accent-color');
      document.documentElement.style.removeProperty('--accent-glow');
    }
  }, [page, settings.theme, settings.accentColor]);

  // Channels Operations
  const addChannel = (platform, name) => {
    const newChan = {
      id: Date.now(),
      platform,
      name,
      enabled: true
    };
    const nextList = [...activeChannels, newChan];
    setActiveChannels(nextList);
    localStorage.setItem('prochat_channels', JSON.stringify(nextList));
  };

  const removeChannel = (id) => {
    const nextList = activeChannels.filter(ch => ch.id !== id);
    setActiveChannels(nextList);
    localStorage.setItem('prochat_channels', JSON.stringify(nextList));
  };

  const toggleChannel = (id) => {
    const nextList = activeChannels.map(ch => 
      ch.id === id ? { ...ch, enabled: !ch.enabled } : ch
    );
    setActiveChannels(nextList);
    localStorage.setItem('prochat_channels', JSON.stringify(nextList));
  };

  const reorderChannels = (nextList) => {
    setActiveChannels(nextList);
    localStorage.setItem('prochat_channels', JSON.stringify(nextList));
  };

  // Settings operations
  const updateSettings = (newSettings) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    localStorage.setItem('prochat_settings', JSON.stringify(merged));
  };

  // Render Page Route
  const renderPage = () => {
    switch (page) {
      case 'overlay':
        return <OverlayView />;
      case 'chat':
      default:
        return (
          <ChatDashboard 
            user={user} 
            logout={logout}
            activeChannels={activeChannels}
            addChannel={addChannel}
            removeChannel={removeChannel}
            toggleChannel={toggleChannel}
            reorderChannels={reorderChannels}
            settings={settings}
            updateSettings={updateSettings}
            messages={messages}
            setMessages={setMessages}
            modeDemo={modeDemo}
          />
        );
    }
  };

  return (
    <DashboardErrorBoundary>
      {renderPage()}
    </DashboardErrorBoundary>
  );
}
