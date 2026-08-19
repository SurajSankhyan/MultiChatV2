import axios from 'axios';
import { getSupabase } from './supabase.js';

const API = 'https://www.googleapis.com/youtube/v3';

export async function getYouTubeAccessHeaders(channelId, apiKey) {
  if (!channelId) {
    return { params: { key: apiKey } };
  }

  try {
    const supabase = getSupabase();
    const { data: profile } = await supabase
      .from('profiles')
      .select('youtube_refresh_token')
      .eq('channel_id', channelId)
      .maybeSingle();

    const refreshToken = profile?.youtube_refresh_token;

    if (refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      console.log(`[YouTube API] Attempting to refresh Google Access Token for channel: ${channelId}`);
      const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      const accessToken = tokenRes.data.access_token;
      if (accessToken) {
        console.log(`[YouTube API] Successfully obtained OAuth access token for channel: ${channelId}. Using creator's quota!`);
        return {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          params: {}
        };
      }
    }
  } catch (err) {
    console.error(`[YouTube API] Failed to refresh token for channel ${channelId}, falling back to API Key:`, err.message);
  }

  // Fallback to Server API Key
  return {
    params: {
      key: apiKey
    }
  };
}

/* ================= LIVE VIDEO ================= */
export async function getLiveVideo(apiKey, channelId) {
  try {
    const accessConfig = await getYouTubeAccessHeaders(channelId, apiKey);
    
    const { data } = await axios.get(`${API}/search`, {
      ...accessConfig,
      params: {
        ...accessConfig.params,
        part: 'snippet',
        channelId,
        eventType: 'live',
        type: 'video',
        maxResults: 1
      }
    });

    return data.items?.[0]?.id?.videoId || null;
  } catch (err) {
    console.error('❌ getLiveVideo error:', err.message);
    return null;
  }
}

/* ================= STREAM DETAILS ================= */
export async function getStreamDetails(apiKey, videoId, channelId = null) {
  try {
    const accessConfig = await getYouTubeAccessHeaders(channelId, apiKey);

    const { data } = await axios.get(`${API}/videos`, {
      ...accessConfig,
      params: {
        ...accessConfig.params,
        part: 'liveStreamingDetails,snippet',
        id: videoId
      }
    });

    return data.items?.[0] || null;
  } catch (err) {
    console.error('❌ getStreamDetails error:', err.message);
    return null;
  }
}

/* ================= CHANNEL DETAILS ================= */
export async function getChannelDetails(apiKey, channelId) {
  try {
    const accessConfig = await getYouTubeAccessHeaders(channelId, apiKey);

    const { data } = await axios.get(`${API}/channels`, {
      ...accessConfig,
      params: {
        ...accessConfig.params,
        part: 'snippet,statistics',
        id: channelId
      }
    });

    return data.items?.[0] || null;
  } catch (err) {
    console.error('❌ getChannelDetails error:', err.message);
    return null;
  }
}
