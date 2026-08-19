import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import util from 'util';

const execFilePromise = util.promisify(execFile);

// In-memory server-side cache for Kick API responses (25-second TTL)
// Prevents Cloudflare IP rate-limits and reduces server workload by 99% for concurrent streamers
const kickApiCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 25000; // 25 seconds

async function fetchWithCurl(url: string) {
  try {
    const { stdout } = await execFilePromise('curl.exe', [
      '-s', '-L', url,
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/122.0.0.0',
      '-H', 'Accept: application/json',
      '-H', 'Accept-Language: en-US,en;q=0.9',
      '-H', 'Referer: https://kick.com/',
      '-H', 'Origin: https://kick.com'
    ]);
    return JSON.parse(stdout);
  } catch (err: any) {
    console.warn('[Kick Proxy Curl Fallback Error]:', err.message);
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { searchParams } = new URL(request.url);
  const { path } = await params;
  const subPath = path.join('/');
  const targetUrl = `https://kick.com/${subPath}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const cacheKey = targetUrl.toLowerCase();

  // 1. Return fresh cached response if available
  const cached = kickApiCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  const headers = new Headers();
  headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/122.0.0.0');
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Referer', 'https://kick.com/');
  headers.set('Origin', 'https://kick.com');

  try {
    const res = await fetch(targetUrl, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data && !data.error && (data.chatroom || data.id || data.slug || Array.isArray(data))) {
        kickApiCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return NextResponse.json(data);
      }
    }
  } catch (err: any) {
    console.warn('[Kick Proxy standard fetch failed, trying curl fallback...]:', err.message);
  }

  // 2. Fallback to curl execution if standard fetch fails or gets blocked by security policy (403 or error json)
  const fallbackData = await fetchWithCurl(targetUrl);
  if (fallbackData && !fallbackData.error) {
    kickApiCache.set(cacheKey, { data: fallbackData, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(fallbackData);
  }

  // If fallback data contains a response even if non-standard, cache it briefly (5s) to avoid spamming Kick
  if (fallbackData) {
    kickApiCache.set(cacheKey, { data: fallbackData, expiresAt: Date.now() + 5000 });
    return NextResponse.json(fallbackData);
  }

  return NextResponse.json({ error: 'Failed to fetch Kick data' }, { status: 500 });
}
