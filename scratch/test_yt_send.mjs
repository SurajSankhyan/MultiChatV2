import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Read .env.local
const envText = fs.readFileSync('.env.local', 'utf8');
envText.split(/\r?\n/).forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0 && !line.startsWith('#')) {
    process.env[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
  }
});

console.log('ENV Check:', {
  hasClientId: !!process.env.GOOGLE_CLIENT_ID,
  hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
});

async function runTest() {
  const supabase = createClient(
    'https://ashezgjtjmtdchkrcuyx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzaGV6Z2p0am10ZGNoa3JjdXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NTM0NjEsImV4cCI6MjA5ODMyOTQ2MX0.5-kaqg52jWFo_3nhxbYhqdl7tl9lKianNO-pql2y9-8'
  );

  const { data, error } = await supabase.from('Youtube').select('*');
  if (error || !data) {
    console.error('Supabase error:', error);
    return;
  }

  console.log('Found accounts:', data.map(a => ({
    email: a.email,
    channel_id: a.channel_id,
    custom_handle: a.custom_handle,
    hasToken: !!a.youtube_refresh_token
  })));

  const targetAcc = data.find(a => a.youtube_refresh_token);
  if (!targetAcc) {
    console.error('No account with refresh token found!');
    return;
  }

  console.log('\n--- Testing Account ---', targetAcc.email, targetAcc.channel_id, targetAcc.custom_handle);

  // 1. Refresh Access Token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: targetAcc.youtube_refresh_token,
      grant_type: 'refresh_token'
    }).toString()
  });

  const tokenData = await tokenRes.json();
  console.log('Refresh Token Response:', {
    ok: tokenRes.ok,
    status: tokenRes.status,
    hasAccessToken: !!tokenData.access_token,
    error: tokenData.error,
    error_description: tokenData.error_description
  });

  if (!tokenData.access_token) {
    return;
  }

  // 2. Fetch Channel Info via OAuth to verify authenticated user identity
  const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const channelData = await channelRes.json();
  console.log('Authenticated Channel Details (via OAuth mine=true):', {
    status: channelRes.status,
    itemCount: channelData.items?.length,
    authenticatedChannelId: channelData.items?.[0]?.id,
    authenticatedTitle: channelData.items?.[0]?.snippet?.title,
    authenticatedHandle: channelData.items?.[0]?.snippet?.customUrl
  });

  // 3. Resolve Live Stream Video & Chat ID
  const handleClean = (targetAcc.custom_handle || targetAcc.channel_id).replace('@', '');
  const liveUrl = `https://www.youtube.com/@${handleClean}/live`;
  console.log('\nFetching Live Page:', liveUrl);

  const pageRes = await fetch(liveUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });

  const html = await pageRes.text();
  const vMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
  const lcMatch = html.match(/"activeLiveChatId"\s*:\s*"([^"]+)"/) || html.match(/"liveChatId"\s*:\s*"([^"]+)"/);

  console.log('Scraped Video ID:', vMatch?.[1], 'LiveChatId:', lcMatch?.[1]);

  let liveChatId = lcMatch?.[1];
  if (!liveChatId && vMatch?.[1]) {
    const apiRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${vMatch[1]}`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const apiData = await apiRes.json();
    liveChatId = apiData.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
    console.log('API resolved activeLiveChatId:', liveChatId);
  }

  if (!liveChatId) {
    console.error('❌ Could not find active liveChatId for current stream.');
    return;
  }

  // 4. Send Message via YouTube API
  console.log('\n--- Sending Live Chat Message ---');
  console.log('Sending to liveChatId:', liveChatId);
  const endpoint1 = `https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet`;
  const endpoint2 = `https://www.googleapis.com/youtube/v3/liveChatMessages?part=snippet`;

  for (const ep of [endpoint1, endpoint2]) {
    console.log('\nTrying endpoint:', ep);
    const postRes = await fetch(ep, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        snippet: {
          liveChatId: liveChatId,
          type: 'textMessageEvent',
          textMessageDetails: {
            messageText: 'Test message from MultiChat'
          }
        }
      })
    });

    const postText = await postRes.text();
    console.log('POST Status:', postRes.status);
    console.log('POST Response Body:', postText);
  }
}

runTest();
