import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';

import { getLiveVideo, getStreamDetails, getChannelDetails } from './youtube.js';
import { secondsToHMS } from './utils.js';
import { getSupabase } from './supabase.js';
import { fetchGameDetails, slugify } from './scraper.js';
import axios from 'axios';

/* ================== HELPER: SCHEDULED STORYBOARD RESOLVER ================== */
async function resolveAndSaveStoryboard(videoId) {
  try {
    const { data: stream, error: fetchErr } = await supabase
      .from('streams')
      .select('storyboard_spec')
      .eq('video_id', videoId)
      .maybeSingle();

    if (fetchErr) {
      console.error(`[Scheduled Resolver] Failed to check DB status for ${videoId}:`, fetchErr.message);
      return;
    }

    if (stream && stream.storyboard_spec) {
      console.log(`[Scheduled Resolver] Stream ${videoId} already has storyboard spec. Skipping.`);
      return;
    }

    console.log(`[Scheduled Resolver] Attempting to resolve storyboard spec and game tag for stream: ${videoId}`);
    const metadata = await fetchGameDetails(videoId, '', '');
    
    // Storyboard Resolution
    const spec = metadata.storyboardSpec || null;
    if (spec) {
      const { error: updateErr } = await supabase
        .from('streams')
        .update({ storyboard_spec: spec })
        .eq('video_id', videoId);

      if (updateErr) {
        console.error(`[Scheduled Resolver] Failed to save storyboard spec for ${videoId}:`, updateErr.message);
      } else {
        console.log(`[Scheduled Resolver] Successfully resolved and saved storyboard spec for ${videoId}`);
      }
    } else {
      console.warn(`[Scheduled Resolver] No storyboard spec resolved yet for ${videoId}`);
    }

    // Game Tag Resolution & Self-Healing Backfill
    if (metadata.name) {
      const gameIdTag = slugify(metadata.name);
      const { error: gameErr } = await supabase.from('games').upsert({
        id: gameIdTag,
        game_title: metadata.title,
        game_poster: metadata.poster
      });
      
      if (!gameErr) {
        const { error: clipsUpdateErr } = await supabase
          .from('clips')
          .update({ game_id_tag: gameIdTag })
          .eq('video_id', videoId)
          .is('game_id_tag', null);
          
        if (!clipsUpdateErr) {
          console.log(`[Scheduled Resolver] Successfully backfilled game tag (${gameIdTag}) for stream clips of video: ${videoId}`);
        }
      }
    }
  } catch (err) {
    console.error(`[Scheduled Resolver] Error resolving ${videoId}:`, err.message);
  }
}

/* ================== LIVE STREAM METADATA CACHE ================== */
const liveCache = new Map(); // key: channelId, value: { videoId, actualStartTime, details, expiresAt }

/* ================== ENV SETUP ================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local dev support (Render injects env automatically)
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('ENV CHECK →', {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'LOADED' : 'MISSING',
  CHANNEL_ID: process.env.CHANNEL_ID
});

/* ================== APP SETUP ================== */
const app = express();
const supabase = getSupabase();

/* ================== CORS ================== */
app.use(
  cors({
    origin: (origin, callback) => {
      // Nightbot / server-to-server / file:// protocol
      if (!origin || origin === 'null') return callback(null, true);

      // Allow local development and extensions
      if (
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1') ||
        origin.startsWith('chrome-extension://')
      ) {
        return callback(null, true);
      }

      // Allow Netlify
      if (origin.endsWith('.netlify.app')) {
        return callback(null, true);
      }

      return callback(new Error('CORS blocked'));
    },
    methods: ['GET', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  })
);

app.use(express.json());

/* ================== ROUTES ================== */
app.get('/', (req, res) => {
  res.status(200).send('StreamClips Hub API is running.');
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is awake' });
});

/* ================== DEBUG LOGGING ================== */
function logAndSend(res, message, status = 200, extra = {}) {
  console.log(`[Response ${status}] ${message}`, extra);
  res.status(status).send(message);
}

/* 🔹 NIGHTBOT — SAVE CLIP */
app.get('/api/clip', async (req, res) => {
  try {
    const text = req.query.text;
    const user = req.query.user;
    const mod = req.query.mod;
    const member = req.query.member;
    const userlevel = req.query.userlevel || req.query.userLevel;
    const channelId = req.query.channelId || req.query.channelid;
    const streamerId = req.query.streamerId || req.query.streamerid;

    // Short-circuit if this is a keep-alive monitor ping (no user specified) or explicit ping query
    if (req.query.ping === 'true' || !user) {
      console.log('[Ping] Keep-alive ping received. Server is awake.');
      return res.status(200).send('StreamClips Hub API is awake.');
    }

    const targetChannelId = (streamerId || process.env.CHANNEL_ID)?.trim();

    console.log('Incoming clip request:', {
      streamerIdReceived: streamerId,
      envChannelId: process.env.CHANNEL_ID,
      resolvedTargetChannelId: targetChannelId
    });

    if (!targetChannelId) {
      return logAndSend(res, '❌ Error: Streamer channel ID not configured or provided', 200, { query: req.query });
    }

    /* ---------- VERIFY REGISTRATION ---------- */
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('channel_id', targetChannelId)
      .limit(1)
      .maybeSingle();

    if (profileErr) {
      console.error('❌ REGISTRATION CHECK ERROR:', profileErr);
    }

    if (targetChannelId !== process.env.CHANNEL_ID && !profile) {
      return logAndSend(res, '❌ Error: Channel not registered! Sign up and link your YouTube Channel ID at https://yt-time.netlify.app to start clipping.', 200, { query: req.query, targetChannelId });
    }

    const profileId = profile ? profile.id : null;

    /* ---------- CHECK LIVE & CACHE ---------- */
    let videoId = null;
    let actualStartTime = null;
    let details = null;

    const cacheEntry = liveCache.get(targetChannelId);
    if (cacheEntry && Date.now() < cacheEntry.expiresAt) {
      videoId = cacheEntry.videoId;
      actualStartTime = cacheEntry.actualStartTime;
      details = cacheEntry.details;
      console.log(`[Cache Hit] Using cached stream metadata for channel ${targetChannelId}. Video ID: ${videoId}`);
    }

    if (!videoId || !actualStartTime) {
      console.log(`[Cache Miss] Querying YouTube API for channel ${targetChannelId}...`);
      const apiKey = process.env.YOUTUBE_API_KEY;
      
      videoId = await getLiveVideo(apiKey, targetChannelId);
      if (!videoId) {
        // Cache the "not live" status for 1 minute to prevent spamming queries
        liveCache.set(targetChannelId, {
          videoId: null,
          actualStartTime: null,
          details: null,
          expiresAt: Date.now() + 1 * 60 * 1000
        });
        return logAndSend(res, '❌ Stream is not live', 200, { query: req.query, targetChannelId });
      }

      details = await getStreamDetails(apiKey, videoId, targetChannelId);
      actualStartTime = details?.liveStreamingDetails?.actualStartTime || null;

      if (!actualStartTime) {
        return logAndSend(res, '⚠️ Stream is not currently live or start time is missing.', 200);
      }

      // Cache the resolved stream metadata for 2 minutes
      liveCache.set(targetChannelId, {
        videoId,
        actualStartTime,
        details,
        expiresAt: Date.now() + 2 * 60 * 1000
      });
      console.log(`[Cache Populated] Saved metadata for video ${videoId} of channel ${targetChannelId} for 2 mins.`);
    }

    /* ---------- TIMESTAMP (WITH DELAY) ---------- */
    const CLIP_DELAY_SECONDS = 40; 
    const startTime = new Date(actualStartTime);
    const now = new Date();

    let seconds = Math.floor((now - startTime) / 1000);
    seconds = Math.max(0, seconds - CLIP_DELAY_SECONDS);
    const hms = secondsToHMS(seconds);

    /* ---------- ROLE DETECTION ---------- */
    let role = 'everyone';
    if (userlevel && ['owner', 'moderator', 'subscriber', 'regular', 'everyone'].includes(userlevel.toLowerCase())) {
      role = userlevel.toLowerCase();
    } else {
      // Fallback mapping based on boolean flags
      const isMod = ['true', '1', 'yes'].includes(String(mod).toLowerCase());
      const isMember = ['true', '1', 'yes'].includes(String(member).toLowerCase());
      if (isMod) role = 'moderator';
      else if (isMember) role = 'subscriber';
    }

    /* ---------- PROFILE URL ---------- */
    const profileUrl = channelId
      ? `https://www.youtube.com/channel/${channelId}`
      : user
        ? `https://www.youtube.com/${user}`
        : '';

    /* ---------- SPAM & DUPLICATION PREVENTION ---------- */
    if (role === 'everyone' || role === 'subscriber' || role === 'regular') {
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
      const { data: recentClips, error: recentErr } = await supabase
        .from('clips')
        .select('id')
        .eq('video_id', videoId)
        .eq('profile_id', profileId)
        .gt('created_at', thirtySecondsAgo)
        .limit(1);

      if (recentErr) {
        console.error('❌ DUPLICATE CHECK ERROR:', recentErr);
      }

      if (recentClips && recentClips.length > 0) {
        return logAndSend(res, '⚠️ A clip was already saved for this stream in the last 30 seconds. Cooldown active.', 200);
      }
    }

    /* ---------- SAVE TO SUPABASE ---------- */
    const safeDesc = text && text.trim() ? text.trim().slice(0, 200) : null;

    // Send response back to Nightbot immediately so it resolves well within the 5-second timeout
    logAndSend(res, `✅ Clip saved at ${hms}`, 200, { query: req.query, targetChannelId, videoId, hms });

    // Perform database operations, web scraping, and profile updates asynchronously in the background
    (async () => {
      try {
        // 1. Fetch game details and storyboard spec
        let storyboardSpec = null;
        let gameIdTag = null;
        try {
          const tagsStr = Array.isArray(details.snippet.tags) ? details.snippet.tags.join(' ') : '';
          const combinedSearchText = [
            details.snippet.description || '',
            tagsStr,
            text || ''
          ].join(' ');

          const metadata = await fetchGameDetails(
            videoId,
            details.snippet.title,
            combinedSearchText
          );
          storyboardSpec = metadata.storyboardSpec || null;

          if (metadata.name) {
            gameIdTag = slugify(metadata.name);
            const { error: gameErr } = await supabase.from('games').upsert({
              id: gameIdTag,
              game_title: metadata.title,
              game_poster: metadata.poster
            });
            if (gameErr) {
              console.error('❌ GAMES UPSERT ERROR:', gameErr);
            } else {
              // Also backfill this resolved game tag to any existing clips of the same stream that have null game_id_tag
              const { error: backfillErr } = await supabase
                .from('clips')
                .update({ game_id_tag: gameIdTag })
                .eq('video_id', videoId)
                .is('game_id_tag', null);
              if (backfillErr) {
                console.error('❌ CLIPS GAME TAG BACKFILL ERROR:', backfillErr.message);
              } else {
                console.log(`[GameScraper] Successfully backfilled game tag (${gameIdTag}) to prior clips of stream: ${videoId}`);
              }
            }
          } else {
            console.log(`[GameScraper] No official game details found for ${videoId}. Skipping games table entry.`);
          }
        } catch (gameFetchErr) {
          console.error('❌ FETCH/SAVE GAME DETAILS/STORYBOARD ERROR:', gameFetchErr);
        }
        
        // 2. Save stream details once (prevents duplicate text storage)
        let finalStoryboardSpec = storyboardSpec;
        if (!finalStoryboardSpec) {
          try {
            const { data: existingStream } = await supabase
              .from('streams')
              .select('storyboard_spec')
              .eq('video_id', videoId)
              .maybeSingle();
            if (existingStream && existingStream.storyboard_spec) {
              finalStoryboardSpec = existingStream.storyboard_spec;
            }
          } catch (fetchSpecErr) {
            console.error('⚠️ Failed to check existing storyboard spec:', fetchSpecErr.message);
          }
        }

        const { error: streamErr } = await supabase.from('streams').upsert({
          video_id: videoId,
          video_title: details.snippet.title,
          storyboard_spec: finalStoryboardSpec
        }, { onConflict: 'video_id' });

        if (streamErr) {
          console.error('❌ STREAMS UPSERT ERROR:', streamErr);
        }

        // 3. Save clip referencing the video_id and game_id_tag
        const { error: clipErr } = await supabase.from('clips').insert({
          video_id: videoId,
          timestamp_seconds: seconds,
          description: safeDesc, 
          username: user || 'unknown',     
          user_role: role,
          profile_id: profileId,
          game_id_tag: gameIdTag
        });

        if (clipErr) {
          console.error('❌ CLIPS INSERT ERROR:', clipErr);
        }

        // Schedule automatic background resolvers if storyboard_spec is still null
        if (!finalStoryboardSpec) {
          console.log(`[Storyboard Scheduler] Scheduling background storyboard resolution for video ${videoId}...`);
          setTimeout(() => resolveAndSaveStoryboard(videoId), 1 * 60 * 1000);  // 1 min
          setTimeout(() => resolveAndSaveStoryboard(videoId), 3 * 60 * 1000);  // 3 mins
          setTimeout(() => resolveAndSaveStoryboard(videoId), 5 * 60 * 1000);  // 5 mins
        }

        /* ---------- AUTO-CLEANUP OF OLD UNSTARRED CLIPS ---------- */
        try {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const { error: cleanupErr } = await supabase
            .from('clips')
            .delete()
            .eq('is_favorite', false)
            .lt('created_at', thirtyDaysAgo);
            
          if (cleanupErr) {
            console.error('❌ AUTO-CLEANUP DATABASE ERROR:', cleanupErr);
          }
        } catch (cleanupErr) {
          console.error('❌ AUTO-CLEANUP ERROR:', cleanupErr);
        }

        /* ---------- AUTOPICK & UPDATE CREATOR PROFILE ---------- */
        try {
          const channelDetails = await getChannelDetails(
            process.env.YOUTUBE_API_KEY,
            targetChannelId
          );

          if (channelDetails) {
            await supabase
              .from('profiles')
              .update({ 
                channel_name: channelDetails.snippet.title,
                avatar_url: channelDetails.snippet.thumbnails.medium?.url || channelDetails.snippet.thumbnails.default?.url,
                total_views: parseInt(channelDetails.statistics?.viewCount || 0, 10)
              })
              .eq('channel_id', targetChannelId);
          }
        } catch (profileUpdateErr) {
          console.error('❌ PROFILE UPDATE ERROR:', profileUpdateErr);
        }
      } catch (backgroundErr) {
        console.error('❌ BACKGROUND OPERATIONS ERROR:', backgroundErr);
      }
    })();

  } catch (err) {
    console.error('❌ SAVE CLIP ERROR:', err);
    logAndSend(res, '❌ Error saving clip', 200, { query: req.query, error: err.message });
  }
});

/* 🔹 FETCH ALL CLIPS (Requires streamerId) */
app.get('/api/clips', async (req, res) => {
  try {
    const { streamerId } = req.query;

    if (!streamerId) {
      return res.status(400).json({ error: 'Missing streamerId query parameter' });
    }

    const { data, error } = await supabase
      .from('clips')
      .select('*, profiles!inner(channel_id), streams(video_title)')
      .eq('profiles.channel_id', streamerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);

    // Trigger storyboard and game tag backfill in the background
    backfillStoryboardSpecs();
  } catch (err) {
    console.error('❌ FETCH CLIPS ERROR:', err);
    res.status(500).json([]);
  }
});

/* 🔹 DELETE CLIP (ADMIN — frontend gated) */
app.delete('/api/clip/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('clips')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('❌ DELETE ERROR:', err);
    res.status(500).json({ success: false });
  }
});

/* 🔹 EDIT CLIP TITLE (ADMIN ✏️ — DESCRIPTION ONLY) */
app.patch('/api/clip/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ success: false });
    }

    const { error } = await supabase
      .from('clips')
      .update({ description })
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('❌ UPDATE ERROR:', err);
    res.status(500).json({ success: false });
  }
});

/* 🔹 REFRESH CREATORS DIRECTORY VIEW COUNTS FROM YOUTUBE API */
app.get('/api/creators/refresh-views', async (req, res) => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('channel_id')
      .not('channel_id', 'is', null);

    if (error) throw error;
    if (!profiles || profiles.length === 0) {
      return res.json({ success: true, updated: 0, views: {}, creators: {} });
    }

    const channelIds = profiles.map(p => p.channel_id).filter(Boolean);
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      console.warn('⚠️ YOUTUBE_API_KEY is not configured on the backend server.');
      return res.status(400).json({ error: 'YOUTUBE_API_KEY is not configured on the backend server.' });
    }

    const creatorsMap = {};
    const viewsMap = {};
    const chunks = [];
    for (let i = 0; i < channelIds.length; i += 50) {
      chunks.push(channelIds.slice(i, i + 50));
    }

    for (const chunk of chunks) {
      const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: {
          part: 'snippet,statistics',
          id: chunk.join(','),
          key: apiKey
        }
      });
      const items = response.data.items || [];
      for (const item of items) {
        const views = parseInt(item.statistics?.viewCount || 0, 10);
        const subscribers = parseInt(item.statistics?.subscriberCount || 0, 10);
        const name = item.snippet?.title || '';
        const avatar = item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '';
        
        creatorsMap[item.id] = { views, subscribers, name, avatar };
        viewsMap[item.id] = views;
      }
    }

    // Update in database in the background/foreground
    let updatedCount = 0;
    for (const [channelId, info] of Object.entries(creatorsMap)) {
      try {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ 
            channel_name: info.name,
            avatar_url: info.avatar,
            total_views: info.views,
            subscribers: info.subscribers
          })
          .eq('channel_id', channelId);
        if (!updateErr) updatedCount++;
      } catch (dbErr) {
        console.error(`Failed to update DB views for channel ${channelId}:`, dbErr.message);
      }
    }

    res.json({ success: true, updated: updatedCount, views: viewsMap, creators: creatorsMap });
  } catch (err) {
    console.error('❌ refresh-views error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
/* 🔹 RESOLVE YOUTUBE HANDLE OR CHANNEL ID */
app.get('/api/resolve-channel', async (req, res) => {
  try {
    const { identifier } = req.query;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ success: false, error: 'Identifier is required.' });
    }

    let input = identifier.trim();
    
    // Remove query params if any
    input = input.split('?')[0].trim();

    // Parse URL if it is a full youtube link
    if (input.includes('youtube.com') || input.includes('youtu.be')) {
      const channelMatch = input.match(/\/channel\/(UC[a-zA-Z0-9_-]{22})/);
      if (channelMatch) {
        input = channelMatch[1];
      } else {
        const handleMatch = input.match(/\/(@[a-zA-Z0-9_.-]+)/);
        if (handleMatch) {
          input = handleMatch[1];
        } else {
          const parts = input.split('/');
          const lastPart = parts[parts.length - 1];
          if (lastPart) {
            input = lastPart;
          }
        }
      }
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'YouTube API Key is not configured on the backend.' });
    }

    let params = {
      part: 'snippet,statistics',
      key: apiKey
    };

    // If it starts with UC and has length 24, treat as channel ID
    if (input.startsWith('UC') && input.length === 24) {
      params.id = input;
    } else {
      // Treat as handle
      let handle = input;
      if (!handle.startsWith('@')) {
        handle = '@' + handle;
      }
      params.forHandle = handle;
    }

    const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', { params });
    const item = response.data.items?.[0];

    if (!item) {
      return res.json({ success: false, error: 'YouTube channel not found. Please check your Channel ID or Handle.' });
    }

    const channelId = item.id;
    const name = item.snippet?.title || '';
    const avatar = item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '';
    const views = parseInt(item.statistics?.viewCount || 0, 10);
    const subscribers = parseInt(item.statistics?.subscriberCount || 0, 10);
    const customHandle = item.snippet?.customUrl || '';

    res.json({
      success: true,
      channelId,
      name,
      avatar,
      views,
      subscribers,
      customHandle
    });
  } catch (err) {
    console.error('❌ resolve-channel error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


/* 🔹 CORS-BYPASSING IMAGE PROXY ENDPOINT FOR COLOR EXTRACTION */
app.get('/api/avatar-proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).send('URL query parameter is required.');
    }
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.send(response.data);
  } catch (err) {
    console.error('❌ avatar-proxy error:', err.message);
    res.status(500).send(err.message);
  }
});


/* 🔹 SECURE RLS-BYPASSING YOUTUBE LINKING ENDPOINT */
app.post('/api/link-youtube', async (req, res) => {
  try {
    const { userId, email, providerToken, refreshToken } = req.body;
    if (!userId || !providerToken) {
      return res.status(400).json({ success: false, error: 'userId and providerToken are required.' });
    }

    console.log(`[Backend YouTube Link] Fetching channel for user: ${userId}`);
    const ytRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: {
        part: 'snippet,statistics',
        mine: true
      },
      headers: {
        Authorization: `Bearer ${providerToken}`
      }
    });

    console.log('[DEBUG] ytRes.data:', JSON.stringify(ytRes.data));
    const item = ytRes.data.items?.[0];
    if (!item) {
      console.log(`[Backend YouTube Link] No YouTube channel found for this token for user ${userId}`);
      return res.json({ success: false, error: 'No YouTube channel found for this Google account.' });
    }

    // Securely retrieve the Google refresh token from auth.identities via RPC function
    let googleRefreshToken = refreshToken || null;
    if (!googleRefreshToken) {
      console.log(`[Backend YouTube Link] Querying auth.identities via RPC for user: ${userId}`);
      const { data: dbRefreshToken, error: rpcErr } = await supabase
        .rpc('get_google_refresh_token', { target_user_id: userId });

      if (rpcErr) {
        console.warn('[Backend YouTube Link] RPC get_google_refresh_token error:', rpcErr.message);
      } else if (dbRefreshToken) {
        console.log('[Backend YouTube Link] Successfully retrieved refresh token from DB!');
        googleRefreshToken = dbRefreshToken;
      }
    }

    console.log(`[Backend YouTube Link] Found channel: "${item.snippet?.title}". Upserting to profiles...`);
    const { error: upsertErr } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: email || '',
        channel_id: item.id,
        channel_name: item.snippet?.title || '',
        custom_handle: item.snippet?.customUrl || '',
        avatar_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
        total_views: parseInt(item.statistics?.viewCount || 0, 10),
        subscribers: parseInt(item.statistics?.subscriberCount || 0, 10),
        role: 'creator',
        youtube_refresh_token: googleRefreshToken || null
      }, { onConflict: 'id' });

    if (upsertErr) {
      console.error('[Backend YouTube Link] DB Upsert error:', upsertErr.message);
      return res.status(500).json({ success: false, error: upsertErr.message });
    }

    console.log(`[Backend YouTube Link] Successfully linked channel: "${item.snippet?.title}" to user ${userId}`);
    res.json({ success: true, channelName: item.snippet?.title });
  } catch (err) {
    console.error('❌ link-youtube error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


/* 🔹 DIAGNOSTIC ROUTE TO TEST YOUTUBE API RAW RESPONSE */
app.get('/api/test-youtube', async (req, res) => {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const ids = 'UCweXHVY_5-0QRbzxdnootEA,UCnztylAknmaw1K4wJA8m7rQ';
    const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: {
        part: 'statistics',
        id: ids,
        key: apiKey
      }
    });
    res.json(response.data);
  } catch (err) {
    console.error('❌ test-youtube error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


/* 🔹 CACHE STORYBOARD SPEC IN DATABASE */
app.post('/api/storyboard', async (req, res) => {
  try {
    const { videoId, storyboardSpec } = req.body;
    if (!videoId || !storyboardSpec) {
      return res.status(400).json({ error: 'videoId and storyboardSpec are required' });
    }

    const { error } = await supabase
      .from('streams')
      .upsert({
        video_id: videoId,
        storyboard_spec: storyboardSpec
      }, { onConflict: 'video_id' });

    if (error) {
      console.warn(`[Storyboard] Failed to cache spec in DB for ${videoId}:`, error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[Storyboard] Successfully cached spec for ${videoId} in DB`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ POST storyboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});


/* 🔹 FETCH STORYBOARD SPEC DYNAMICALLY (WITH DATABASE CACHING) */
app.get('/api/storyboard', async (req, res) => {
  try {
    const videoId = req.query.videoId;
    if (!videoId) {
      return res.status(400).json({ error: 'videoId query parameter is required' });
    }

    // 1. Check if we already have the spec cached in Supabase streams table
    const { data: stream, error: streamErr } = await supabase
      .from('streams')
      .select('storyboard_spec')
      .eq('video_id', videoId)
      .maybeSingle();

    if (!streamErr && stream && stream.storyboard_spec) {
      console.log(`[Storyboard] Retrieved cached spec for ${videoId} from DB`);
      return res.json({ storyboardSpec: stream.storyboard_spec });
    }

    // 2. If not cached, return null immediately to unblock frontend and fetch/cache in background
    console.log(`[Storyboard] Spec cache miss for ${videoId}. Unblocking frontend and fetching in background...`);
    res.json({ storyboardSpec: null });

    // Background fetch & cache execution
    (async () => {
      try {
        const metadata = await fetchGameDetails(videoId, '', '');
        const storyboardSpec = metadata.storyboardSpec || null;
        if (storyboardSpec) {
          const { error: updateErr } = await supabase
            .from('streams')
            .update({ storyboard_spec: storyboardSpec })
            .eq('video_id', videoId);
          if (updateErr) {
            console.warn(`[Storyboard] Failed to cache spec in DB for ${videoId} in background:`, updateErr.message);
          } else {
            console.log(`[Storyboard] Successfully cached spec for ${videoId} in DB (background)`);
          }
        }
      } catch (bgErr) {
        console.error(`[Storyboard] Background cache failed for ${videoId}:`, bgErr.message);
      }
    })();
  } catch (err) {
    console.error('❌ storyboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* 🔹 AUTOMATIC MIGRATION: BACKFILL CUSTOM HANDLES FOR LEGACY PROFILES */
async function backfillCustomHandles() {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ YOUTUBE_API_KEY is not defined, skipping custom handle backfill.');
      return;
    }

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, channel_id, channel_name, custom_handle');

    if (error) {
      console.error('❌ Failed to fetch profiles for backfill:', error.message);
      return;
    }

    const profilesToBackfill = profiles.filter(p => !p.custom_handle || p.custom_handle.trim() === '');
    if (profilesToBackfill.length === 0) {
      console.log('✅ All profiles have custom_handle set. No backfill needed.');
      return;
    }

    console.log(`🔄 Backfilling custom_handle for ${profilesToBackfill.length} profiles...`);

    for (const profile of profilesToBackfill) {
      if (!profile.channel_id) continue;
      try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
          params: {
            part: 'snippet',
            id: profile.channel_id,
            key: apiKey
          }
        });
        
        const item = response.data.items?.[0];
        const customUrl = item?.snippet?.customUrl || '';
        
        if (customUrl) {
          const { error: updateErr } = await supabase
            .from('profiles')
            .update({ custom_handle: customUrl })
            .eq('id', profile.id);
            
          if (updateErr) {
            console.error(`❌ Failed to update handle for ${profile.channel_name}:`, updateErr.message);
          } else {
            console.log(`✅ Successfully backfilled custom_handle "${customUrl}" for ${profile.channel_name}`);
          }
        }
      } catch (err) {
        console.error(`❌ Error backfilling handle for ${profile.channel_name}:`, err.message);
      }
    }
  } catch (err) {
    console.error('❌ Error during backfillCustomHandles:', err.message);
  }
}

/* 🔹 AUTOMATIC MIGRATION: BACKFILL STORYBOARD SPECS FOR LEGACY STREAMS */
async function backfillStoryboardSpecs() {
  try {
    // Only backfill streams created in the last 3 days to avoid spamming YouTube with unresolvable legacy/deleted/private streams
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: streams, error: fetchErr } = await supabase
      .from('streams')
      .select('video_id')
      .is('storyboard_spec', null)
      .gt('created_at', threeDaysAgo);

    if (fetchErr) {
      console.error('❌ Failed to fetch streams for storyboard backfill:', fetchErr.message);
      return;
    }

    if (!streams || streams.length === 0) {
      return;
    }

    console.log(`[Storyboard Backfill] Resolving storyboard specs for ${streams.length} streams...`);

    // Process all streams with NULL storyboard specs directly (enables live resolution)
    for (const stream of streams) {
      const videoId = stream.video_id;

      try {
        console.log(`[Storyboard Backfill] Resolving storyboard spec and game tag for stream: ${videoId}`);
        const metadata = await fetchGameDetails(videoId, '', '');
        
        // 1. Storyboard Spec Resolution
        const spec = metadata.storyboardSpec || null;
        if (spec) {
          const { error: updateErr } = await supabase
            .from('streams')
            .update({ storyboard_spec: spec })
            .eq('video_id', videoId);

          if (updateErr) {
            console.error(`[Storyboard Backfill] Failed to save storyboard spec for ${videoId}:`, updateErr.message);
          } else {
            console.log(`[Storyboard Backfill] Successfully backfilled storyboard spec for ${videoId}`);
          }
        } else {
          console.warn(`[Storyboard Backfill] No storyboard spec resolved for ${videoId}`);
        }

        // 2. Game Tag Resolution & Self-Healing Backfill to Clips
        if (metadata.name) {
          const gameIdTag = slugify(metadata.name);
          const { error: gameErr } = await supabase.from('games').upsert({
            id: gameIdTag,
            game_title: metadata.title,
            game_poster: metadata.poster
          });
          
          if (!gameErr) {
            const { error: clipsUpdateErr } = await supabase
              .from('clips')
              .update({ game_id_tag: gameIdTag })
              .eq('video_id', videoId)
              .is('game_id_tag', null);
              
            if (!clipsUpdateErr) {
              console.log(`[Storyboard Backfill] Successfully backfilled game tag (${gameIdTag}) for stream clips of video: ${videoId}`);
            } else {
              console.error(`[Storyboard Backfill] Failed to update clips game tag:`, clipsUpdateErr.message);
            }
          } else {
            console.error(`[Storyboard Backfill] Failed to upsert game details:`, gameErr.message);
          }
        } else {
          console.log(`[Storyboard Backfill] No official game details resolved for ${videoId}`);
        }
      } catch (err) {
        console.error(`[Storyboard Backfill] Error backfilling ${videoId}:`, err.message);
      }
      // Small pause between scrapes to protect rate limits
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  } catch (err) {
    console.error('❌ storyboard backfill error:', err.message);
  }
}

/* ================== SERVER ================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  backfillCustomHandles();
  backfillStoryboardSpecs();
  
  // Periodically backfill storyboard specs for finished streams every 5 minutes
  setInterval(backfillStoryboardSpecs, 5 * 60 * 1000);
});
