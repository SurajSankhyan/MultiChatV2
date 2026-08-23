import { NextResponse } from 'next/server';

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
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const canonicalOrigin = getCanonicalOrigin(request);
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${canonicalOrigin}/api/youtube/callback`;
  
  if (!clientId) {
    return NextResponse.json(
      { success: false, error: 'GOOGLE_CLIENT_ID is missing in environment variables.' },
      { status: 500 }
    );
  }

  const scopes = [
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent select_account');

  return NextResponse.redirect(authUrl.toString());
}
