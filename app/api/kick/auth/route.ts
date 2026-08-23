import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import crypto from 'crypto';

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function getCanonicalOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    const host = forwardedHost.split(',')[0].trim();
    return `${forwardedProto}://${host}`;
  }

  const url = new URL(request.url);
  return url.origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const canonicalOrigin = getCanonicalOrigin(request);
  const clientId = process.env.KICK_CLIENT_ID || '';
  const redirectUri = process.env.KICK_REDIRECT_URI || url.searchParams.get('redirect_uri') || `${canonicalOrigin}/api/kick/callback`;

  const queryUserId = url.searchParams.get('user_id') || '';
  const queryEmail = url.searchParams.get('email') || '';

  const cookieStore = await cookies();
  const supabaseServer = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bwwdzkhtnaepamsfivds.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3d2R6a2h0bmFlcGFtc2ZpdmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MzUxNjMsImV4cCI6MjA5ODQxMTE2M30.60vipeZzzdplww-8fuRD_LYvQ-2oawfNm-kx2ur3So0',
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }); },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }); }
      }
    }
  );

  const { data: { user } } = await supabaseServer.auth.getUser();

  const userIdToSave = user?.id || queryUserId;
  const userEmailToSave = user?.email || queryEmail;

  // Generate PKCE code_verifier and code_challenge
  const verifierBuffer = crypto.randomBytes(32);
  const codeVerifier = base64UrlEncode(verifierBuffer);
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = base64UrlEncode(hash);

  // Encode state as base64url JSON object to survive cross-site cookie stripping
  const rawState = crypto.randomBytes(16).toString('hex');
  const stateObj = {
    s: rawState,
    v: codeVerifier,
    u: userIdToSave,
    e: userEmailToSave
  };
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');

  const scope = 'user:read chat:write events:subscribe moderation:ban moderation:chat_message:manage channel:read channel:write streamkey:read';

  const authUrl = `https://id.kick.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  const isJsonFormat = url.searchParams.get('format') === 'json';

  const response = isJsonFormat 
    ? NextResponse.json({ success: true, url: authUrl })
    : NextResponse.redirect(authUrl);

  const cookieOptions = { httpOnly: true, path: '/', maxAge: 600, sameSite: 'lax' as const, secure: true };

  // Store state, codeVerifier, user_id, and email in HTTP-only cookies
  response.cookies.set('kick_oauth_state', state, cookieOptions);
  response.cookies.set('kick_code_verifier', codeVerifier, cookieOptions);
  if (userIdToSave) response.cookies.set('kick_oauth_user_id', userIdToSave, cookieOptions);
  if (userEmailToSave) response.cookies.set('kick_oauth_user_email', userEmailToSave, cookieOptions);

  return response;
}
