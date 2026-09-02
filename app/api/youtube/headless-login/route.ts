export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { asSupabase } from '@/lib/supabase';
import { formatInnertubeCookie } from '@/lib/innertubeSession';
import { encryptCookie } from '@/lib/cryptoCookie';

async function fetchChannelMetadata(channelIdOrHandle: string) {
  try {
    if (!channelIdOrHandle) return null;
    const clean = channelIdOrHandle.trim();
    let url = '';
    if (clean.startsWith('UC')) {
      url = `https://www.youtube.com/channel/${clean}/about`;
    } else {
      const handle = clean.startsWith('@') ? clean : `@${clean}`;
      url = `https://www.youtube.com/${handle}/about`;
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!res.ok) return null;
    const html = await res.text();

    const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
    const avatarMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
    const handleMatch = html.match(/<meta property="og:url" content="https:\/\/www\.youtube\.com\/(@[a-zA-Z0-9._-]+)"/) || html.match(/"canonicalBaseUrl":"\/(@[a-zA-Z0-9._-]+)"/);
    
    const channelIdMatch = 
      html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
      html.match(/"browseId":"(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
      html.match(/<meta itemprop="identifier" content="(UC[a-zA-Z0-9_-]{22})"/)?.[1] ||
      html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})"/)?.[1];

    const parseNum = (str?: string) => {
      if (!str) return 0;
      const cleanStr = str.replace(/views|subscribers|subscriber/gi, '').trim();
      const match = cleanStr.match(/([\d.,]+)\s*([KMBkmb])?/);
      if (!match) return 0;

      let val = parseFloat(match[1].replace(/,/g, ''));
      if (isNaN(val)) return 0;

      const unit = (match[2] || '').toUpperCase();
      if (unit === 'K') val *= 1000;
      else if (unit === 'M') val *= 1000000;
      else if (unit === 'B') val *= 1000000000;

      return Math.round(val);
    };

    const subMatch = 
      html.match(/"subscriberCountText":\{[^}]*"label":"([^"]+)"/)?.[1] ||
      html.match(/"subscriberCountText":\{[^}]*"simpleText":"([^"]+)"/)?.[1] ||
      html.match(/"subscriberCountText":\{"runs":\[\{"text":"([^"]+)"\}/)?.[1] ||
      html.match(/([\d.,]+[KMBkmb]?\s+subscribers)/i)?.[1];

    const viewMatch = 
      html.match(/"viewCountText":\{[^}]*"simpleText":"([^"]+)"/)?.[1] ||
      html.match(/"viewCountText":\{"runs":\[\{"text":"([^"]+)"\}/)?.[1] ||
      html.match(/"viewCount":\s*"(\d+)"/)?.[1] ||
      html.match(/([\d.,]+\s+views)/i)?.[1];

    return {
      channelId: channelIdMatch ? channelIdMatch : (clean.startsWith('UC') ? clean : ''),
      customHandle: handleMatch ? (handleMatch[1].startsWith('@') ? handleMatch[1] : `@${handleMatch[1]}`) : (clean.startsWith('@') ? clean : `@${clean}`),
      channelName: titleMatch ? titleMatch[1] : clean,
      avatarUrl: avatarMatch ? avatarMatch[1] : '',
      totalViews: parseNum(viewMatch),
      subscribers: parseNum(subMatch)
    };
  } catch (e) {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetEmail = body.email || body.userEmail || 'cocthrushed72@gmail.com';

    console.log('[Headless Login] Launching Puppeteer Stealth browser for account setup...');

    const puppeteerModule = await import('puppeteer');
    const puppeteer = puppeteerModule.default || puppeteerModule;

    const pathModule = await import('path');
    const osModule = await import('os');
    const fsModule = await import('fs');

    // Create an isolated temporary profile directory so the window is NEVER auto-logged in
    const tempUserDataDir = fsModule.default.mkdtempSync(pathModule.default.join(osModule.default.tmpdir(), 'yt-signin-'));

    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      pathModule.default.join(osModule.default.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
    ];
    let executablePath: string | undefined = chromePaths.find(p => fsModule.default.existsSync(p));

    const launchOptions: any = {
      headless: false,
      userDataDir: tempUserDataDir,
      defaultViewport: null,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--test-type',
        '--window-size=700,800',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      ]
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
      console.log('[Headless Login] Using System Google Chrome executable:', executablePath);
    }

    const browser = await puppeteer.launch(launchOptions);

    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());

    // Evaluate stealth overrides on new documents
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      (window as any).chrome = {
        runtime: {},
        loadTimes: function() {},
        csi: function() {},
        app: {}
      };
    });

    await page.goto('https://www.youtube.com/signin', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.bringToFront().catch(() => {});

    console.log('[Headless Login] Waiting for user to complete YouTube web sign-in...');

    // Wait until user completes web sign-in and lands logged-in on YouTube
    try {
      await page.waitForFunction(
        () => !window.location.href.includes('accounts.google.com') && window.location.href.includes('youtube.com'),
        { timeout: 120000 }
      );
    } catch (err: any) {
      console.warn('[Headless Login] Window closed or timed out before completing sign-in:', err.message);
      await browser.close().catch(() => {});
      return NextResponse.json({
        success: false,
        error: 'Login window closed or timed out before completing sign-in.'
      }, { status: 400 });
    }

    console.log('[Headless Login] Navigation landed on YouTube! Mimicking human delays & movements...');

    // 1. Mimic natural post-login reading pause (2.5 - 4 seconds)
    const initialDelay = Math.floor(Math.random() * 1500) + 2500;
    await new Promise(r => setTimeout(r, initialDelay));

    // 2. Mimic human cursor movement across page
    try {
      await page.mouse.move(100, 200, { steps: 10 });
      await new Promise(r => setTimeout(r, 400));
      await page.mouse.move(300, 450, { steps: 15 });
      await new Promise(r => setTimeout(r, 600));
      await page.mouse.move(500, 300, { steps: 12 });
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {}

    // 3. Mimic natural human page scroll
    try {
      await page.evaluate(() => {
        window.scrollBy({ top: 300, behavior: 'smooth' });
      });
      await new Promise(r => setTimeout(r, 1200));
      await page.evaluate(() => {
        window.scrollBy({ top: -200, behavior: 'smooth' });
      });
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {}

    // 4. Additional natural settling delay (1.5 - 2.5 seconds)
    const settlingDelay = Math.floor(Math.random() * 1000) + 1500;
    await new Promise(r => setTimeout(r, settlingDelay));

    // Extract all cookies from browser context, prioritizing youtube.com domain cookies
    const client = await page.target().createCDPSession();
    const { cookies: cdpCookies } = await client.send('Network.getAllCookies');

    const ytCookies = cdpCookies.filter((c: any) => c.domain && c.domain.includes('youtube.com'));
    const nonYtCookies = cdpCookies.filter((c: any) => !c.domain || !c.domain.includes('youtube.com'));
    const sortedCdpCookies = [...nonYtCookies, ...ytCookies];

    const cookiePairs = sortedCdpCookies.map((c: any) => `${c.name}=${c.value}`);
    const rawCookieString = cookiePairs.join('; ');

    const formattedCookie = formatInnertubeCookie(rawCookieString) || rawCookieString;

    let channelId = '';
    let handle = '';
    let ytName = '';
    let ytAvatar = '';

    // Extract DOM identity directly from landing page without navigating to legacy /profile URL
    try {
      const domIdentity = await page.evaluate(() => {
        const html = document.documentElement.innerHTML || '';
        const handleMatch = html.match(/"handle":"(@[a-zA-Z0-9._-]+)"/) || html.match(/"canonicalBaseUrl":"\/(@[a-zA-Z0-9._-]+)"/);
        const channelIdMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
        const titleMatch = html.match(/"title":"([^"]+)"/);

        return {
          handle: handleMatch ? (handleMatch[1].startsWith('@') ? handleMatch[1] : `@${handleMatch[1]}`) : '',
          channelId: channelIdMatch ? channelIdMatch[1] : '',
          name: titleMatch ? titleMatch[1] : ''
        };
      });

      if (domIdentity?.handle && !domIdentity.handle.includes('gmail.com')) handle = domIdentity.handle;
      if (domIdentity?.channelId && !channelId) channelId = domIdentity.channelId;
      if (domIdentity?.name && !ytName) ytName = domIdentity.name;
    } catch (e) {}

    await browser.close().catch(() => {});
    let ytChannelId = channelId;
    let ytHandle = handle;

    // Inspect extracted cookie with youtubei.js across account_index 0, 1, 2, 3
    const { getInnertubeInstance } = await import('@/lib/innertubeSession');
    for (let idx = 0; idx <= 3; idx++) {
      try {
        const yt = await getInnertubeInstance(null, formattedCookie, idx);
        const info = await yt.account.getInfo();
        const accountItem: any = info?.contents?.contents?.[0];
        if (accountItem) {
          const h = accountItem.channel_handle?.text;
          const n = accountItem.account_name?.text;
          const a = accountItem.account_photo?.[0]?.url;
          const cId = accountItem.endpoint?.payload?.browseId;
          console.log(`[Headless Login] Inspected account_index ${idx}:`, { handle: h, name: n, channelId: cId });

          if (h) {
            ytHandle = h;
            if (n) ytName = n;
            if (a) ytAvatar = a;
            if (cId) ytChannelId = cId;
            // If we found a valid non-default handle, break
            if (h !== '@bunnysank' || idx === 0) break;
          }
        }
      } catch (e) {}
    }

    console.log('[Headless Login] Verified Account Identity:', { ytHandle, ytChannelId, ytName });

    // Parse DELEGATED_SESSION_ID from cookie string if missing
    const delegatedMatch = formattedCookie.match(/DELEGATED_SESSION_ID=(UC[a-zA-Z0-9_-]{22})/);
    if (!ytChannelId && delegatedMatch && delegatedMatch[1]) {
      ytChannelId = delegatedMatch[1];
      console.log('[Headless Login] Extracted channelId directly from cookie string:', ytChannelId);
    }

    // Fetch full channel metadata (channel_id, channel_name, avatar_url, total_views, subscribers, custom_handle)
    let meta = null;
    if (ytChannelId || ytHandle) {
      meta = await fetchChannelMetadata(ytChannelId || ytHandle);
      if (!meta && ytHandle) {
        meta = await fetchChannelMetadata(ytHandle);
      }
    }

    const finalChannelId = meta?.channelId || ytChannelId || '';
    const finalHandle = meta?.customHandle || (ytHandle ? (ytHandle.startsWith('@') ? ytHandle : `@${ytHandle}`) : '');
    const finalName = meta?.channelName || ytName || finalHandle;
    const finalAvatar = meta?.avatarUrl || ytAvatar || '';
    const finalViews = meta?.totalViews || 0;
    const finalSubs = meta?.subscribers || 0;

    console.log('[Headless Login] Resolved Channel Metadata:', {
      finalChannelId,
      finalHandle,
      finalName,
      finalAvatar,
      finalViews,
      finalSubs
    });

    // Match existing row by channel_id, custom_handle, or email
    const { data: rows } = await asSupabase.from('Youtube').select('*');

    let targetRow = rows?.find((r: any) => 
      (finalChannelId && r.channel_id === finalChannelId) ||
      (finalHandle && r.custom_handle?.toLowerCase().replace(/^@+/, '') === finalHandle.toLowerCase().replace(/^@+/, ''))
    );

    // Fallback: Match by body.email or body.userId prioritizing valid channel data
    if (!targetRow && rows && rows.length > 0 && body.email) {
      const emailMatches = rows.filter((r: any) => r.email?.toLowerCase() === body.email.toLowerCase());
      if (emailMatches.length > 0) {
        targetRow = emailMatches.find((r: any) => r.channel_id && r.channel_id.startsWith('UC') && r.channel_name && r.channel_name !== '@user') ||
                    emailMatches.find((r: any) => r.channel_id && r.channel_id !== 'EMPTY' && r.channel_name && r.channel_name !== '@user') ||
                    emailMatches[0];
      }
    }

    if (!targetRow && rows && rows.length > 0 && body.userId) {
      targetRow = rows.find((r: any) => r.id === body.userId);
    }

    const userEmail = (body.email && body.email.includes('@')) ? body.email : (targetRow?.email || 'cocthrushed72@gmail.com');

    // Automatically lookup official User ID from Supabase users table by email
    const { data: dbUser } = await asSupabase
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .maybeSingle();

    const officialUserId = targetRow?.id || dbUser?.id || body.userId || crypto.randomUUID();

    // Clean up any old duplicate rows for this email that do not match officialUserId or are incomplete
    if (userEmail) {
      await asSupabase
        .from('Youtube')
        .delete()
        .eq('email', userEmail)
        .neq('id', officialUserId);

      await asSupabase
        .from('Youtube')
        .delete()
        .eq('email', userEmail)
        .or('channel_id.eq.EMPTY,channel_name.eq.@user')
        .neq('id', officialUserId);
    }

    let finalCookieToSave = formatInnertubeCookie(formattedCookie) || formattedCookie;

    if (targetRow) {
      // Strict Channel Lock: Verify new login matches pre-linked channel identity on file
      const existingChannelId = targetRow.channel_id;
      const existingHandle = targetRow.custom_handle ? targetRow.custom_handle.toLowerCase().replace(/^@+/, '') : '';
      const newChannelId = finalChannelId;
      const newHandle = finalHandle ? finalHandle.toLowerCase().replace(/^@+/, '') : '';

      const hasExistingChannel = Boolean(existingChannelId || existingHandle);
      const isChannelIdMismatch = Boolean(existingChannelId && newChannelId && existingChannelId !== newChannelId);
      const isHandleMismatch = Boolean(!existingChannelId && existingHandle && newHandle && existingHandle !== newHandle);

      if (hasExistingChannel && (isChannelIdMismatch || isHandleMismatch)) {
        const existingName = targetRow.channel_name || targetRow.custom_handle || 'your linked channel';
        console.warn(`[Headless Login] Strict channel lock rejected mismatch! Existing: ${existingName}, Tried: ${finalName || finalHandle}`);
        return NextResponse.json({
          success: false,
          error: `⚠️ Account Mismatch: Your account is linked to "${existingName}". You signed in as "${finalName || finalHandle}". Please sign into YouTube as "${existingName}" in the companion window.`
        }, { status: 400 });
      }

      const encryptedToken = encryptCookie(finalCookieToSave);

      // Update existing row
      const updateData: any = {
        id: officialUserId,
        email: userEmail,
        youtube_cookie: finalCookieToSave,
        youtube_refresh_token: encryptedToken,
        pairing_code: null,
        code_expires_at: null
      };
      if (finalChannelId) updateData.channel_id = finalChannelId;
      if (finalHandle && finalHandle !== '@creator') updateData.custom_handle = finalHandle;
      if (finalName && finalName !== '@creator') updateData.channel_name = finalName;
      if (finalAvatar) updateData.avatar_url = finalAvatar;
      if (finalViews !== undefined) updateData.total_views = finalViews;
      if (finalSubs !== undefined) updateData.subscribers = finalSubs;

      await asSupabase
        .from('Youtube')
        .update(updateData)
        .eq('id', targetRow.id);

      console.log('[Headless Login] Updated existing row for:', targetRow.custom_handle || targetRow.email, 'with email:', userEmail, 'ID:', officialUserId, 'views:', finalViews, 'subs:', finalSubs);

      return NextResponse.json({
        success: true,
        handle: finalHandle || targetRow.custom_handle || '@duplicatebunnysank9',
        message: 'YouTube account connected successfully!'
      });
    }

    // Require valid handle or channelId for NEW rows (NEVER insert fake @creator)
    if (!finalHandle && !finalChannelId) {
      console.warn('[Headless Login] Could not resolve channel identity, aborting fake insert.');
      return NextResponse.json({
        success: false,
        error: 'Could not resolve connected YouTube channel identity. Please try logging in again.'
      }, { status: 400 });
    }

    const cleanHandle = finalHandle.startsWith('@') ? finalHandle : `@${finalHandle}`;

    const newPayload = {
      id: officialUserId,
      email: userEmail,
      channel_id: finalChannelId,
      channel_name: finalName || cleanHandle,
      custom_handle: cleanHandle,
      avatar_url: finalAvatar,
      total_views: finalViews,
      subscribers: finalSubs,
      youtube_cookie: finalCookieToSave,
      youtube_refresh_token: encryptCookie(finalCookieToSave),
      pairing_code: null,
      code_expires_at: null
    };

    const { error: insErr } = await asSupabase.from('Youtube').insert(newPayload);
    if (insErr) {
      console.error('[Headless Login] Error inserting new Supabase row:', insErr.message);
      return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
    } else {
      console.log('[Headless Login] Successfully inserted NEW row for connected account:', cleanHandle, 'with email:', userEmail, 'ID:', officialUserId);
    }

    return NextResponse.json({
      success: true,
      message: 'YouTube account connected successfully!',
      handle: ytHandle || handle || '@duplicatebunnysank9'
    });
  } catch (err: any) {
    console.error('[Headless Login Error]:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
