import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || 'https://hwgwjcuaekbpvkqqxerv.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3Z3dqY3VhZWticHZrcXF4ZXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMjc0MDMsImV4cCI6MjA4NDYwMzQwM30.5gdPsogDB4V8GG4GutHA8I09x9BCpqbyk0ycNDdtEfA';
const supabase = createClient(url, key);

async function test() {
  console.log('--- TESTING REFRESH LOGIC ---');
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('channel_id, channel_name');

    if (error) throw error;
    console.log('Registered channels in DB:', profiles);

    const channelIds = profiles.map(p => p.channel_id).filter(Boolean);
    console.log('Channel IDs:', channelIds);

    // Let's use a dummy api key if YOUTUBE_API_KEY is not set
    // wait, does the user have YOUTUBE_API_KEY set? Let's check.
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.warn('YOUTUBE_API_KEY is not set. Cannot query YouTube API.');
      return;
    }

    const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: {
        part: 'statistics',
        id: channelIds.join(','),
        key: apiKey
      }
    });

    const items = response.data.items || [];
    console.log('YouTube API response items count:', items.length);
    items.forEach(item => {
      console.log(`Channel ${item.id} stats:`, item.statistics);
    });

    // Try to update Supabase
    for (const item of items) {
      const views = parseInt(item.statistics?.viewCount || 0, 10);
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ total_views: views })
        .eq('channel_id', item.id);
      
      if (updateErr) {
        console.error(`Error updating channel ${item.id}:`, updateErr);
      } else {
        console.log(`Successfully updated channel ${item.id} with ${views} views`);
      }
    }
  } catch (err) {
    console.error('Test failed:', err);
  }
}

test();
