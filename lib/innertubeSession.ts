import { supabase } from '@/lib/supabase';

// In-memory cache for active Innertube sessions and pending auth jobs
const pendingAuthJobs = new Map<string, {
  userCode: string;
  verificationUrl: string;
  credentials: any | null;
  error: string | null;
}>();

export const innertubeCache = new Map<string, any>();

export function formatInnertubeCookie(rawCookie?: string): string | undefined {
  if (!rawCookie || typeof rawCookie !== 'string') return undefined;
  
  // Sanitize non-ASCII characters
  const sanitized = rawCookie.replace(/[^\x00-\x7F]/g, '').trim();
  const pairs = sanitized.split(';').map(p => p.trim()).filter(Boolean);
  const cookieMap = new Map<string, string>();

  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.substring(0, eqIdx).trim();
    const val = pair.substring(eqIdx + 1).trim();
    // Do NOT include fake DELEGATED_SESSION_ID values starting with UC (Channel IDs)
    if (key === 'DELEGATED_SESSION_ID' && val.startsWith('UC')) continue;
    cookieMap.set(key, val);
  }

  // Strictly keep essential authentication cookies for youtubei.js
  const essentialKeys = [
    'SAPISID',
    '__Secure-3PAPISID',
    'SID',
    'HSID',
    'SSID',
    'LOGIN_INFO',
    'APISID',
    'PREF'
  ];
  if (cookieMap.has('DELEGATED_SESSION_ID')) {
    essentialKeys.push('DELEGATED_SESSION_ID');
  }
  const cleanPairs: string[] = [];

  for (const key of essentialKeys) {
    if (cookieMap.has(key)) {
      cleanPairs.push(`${key}=${cookieMap.get(key)}`);
    }
  }

  return cleanPairs.join('; ') || undefined;
}

import { decryptCookie } from './cryptoCookie';

export async function getInnertubeInstance(credentials?: any, cookie?: string, accountIndex: number = 0) {
  const { Innertube, UniversalCache } = await import('youtubei.js');

  const decryptedCookie = (cookie && cookie.includes('=')) ? cookie : (decryptCookie(cookie) || cookie);
  const formattedCookie = formatInnertubeCookie(decryptedCookie) || decryptedCookie;
  const yt = await Innertube.create({
    cookie: formattedCookie,
    cache: new UniversalCache(false),
    generate_session_locally: true,
    account_index: accountIndex
  });

  if (formattedCookie) {
    const match = formattedCookie.match(/SAPISID=([^;\s]+)/) || formattedCookie.match(/__Secure-3PAPISID=([^;\s]+)/);
    if (match && match[1]) {
      const crypto = await import('crypto');
      const sapisid = match[1];
      const ts = Math.floor(Date.now() / 1000);
      const sha1 = crypto.createHash('sha1').update(`${ts} ${sapisid} https://www.youtube.com`).digest('hex');
      const auth = `SAPISIDHASH ${ts}_${sha1}`;

      try {
        const http = (yt.session as any)?.http;
        if (http?.headers && typeof http.headers.set === 'function') {
          http.headers.set('Authorization', auth);
          http.headers.set('Cookie', formattedCookie);
          http.headers.set('Origin', 'https://www.youtube.com');
          http.headers.set('Referer', 'https://www.youtube.com/');
        } else if (http?.headers) {
          http.headers['Authorization'] = auth;
          http.headers['Cookie'] = formattedCookie;
          http.headers['Origin'] = 'https://www.youtube.com';
          http.headers['Referer'] = 'https://www.youtube.com/';
        }
      } catch (e) {}
    }
  }

  if (credentials && (credentials.access_token || credentials.refresh_token)) {
    try {
      let activeAccess = credentials.access_token || '';
      const rToken = credentials.refresh_token || '';

      if (rToken && rToken.startsWith('1//')) {
        try {
          const clientId = credentials.client?.client_id || credentials.client_id || process.env.GOOGLE_CLIENT_ID || '';
          const clientSecret = credentials.client?.client_secret || credentials.client_secret || process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || '';

          const params = new URLSearchParams();
          if (clientId) params.append('client_id', clientId);
          if (clientSecret) params.append('client_secret', clientSecret);
          params.append('refresh_token', rToken);
          params.append('grant_type', 'refresh_token');

          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
          });

          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            if (tokenData.access_token) {
              activeAccess = tokenData.access_token;
              console.log('[Innertube Session] Successfully refreshed active access_token from Google OAuth!');
            }
          } else {
            console.error('[Innertube Session] Token refresh error status:', tokenRes.status, await tokenRes.text());
          }
        } catch (e: any) {
          console.warn('[Innertube Session] OAuth token refresh fetch warning:', e.message);
        }
      }

      if (activeAccess) {
        const formattedCreds = {
          access_token: activeAccess,
          refresh_token: rToken,
          client_id: credentials.client_id || process.env.GOOGLE_CLIENT_ID || '',
          client_secret: credentials.client_secret || process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || '',
          scope: credentials.scope || 'https://www.googleapis.com/auth/youtube',
          token_type: credentials.token_type || 'Bearer',
          expiry_date: new Date(Date.now() + 3600 * 1000).toISOString()
        };

        await yt.session.oauth.init(formattedCreds);
        try {
          const http = (yt.session as any)?.http;
          if (http?.headers && typeof http.headers.set === 'function') {
            http.headers.set('Authorization', `Bearer ${activeAccess}`);
          } else if (http?.headers) {
            http.headers['Authorization'] = `Bearer ${activeAccess}`;
          }
        } catch (e) {}
        console.log('[Innertube Session] Successfully signed in with OAuth credentials! (logged_in:', yt.session.logged_in, ')');
      }
    } catch (err: any) {
      console.warn('[Innertube Session] OAuth sign in error:', err.message);
    }
  }

  return yt;
}
