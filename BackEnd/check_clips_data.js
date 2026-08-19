import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hwgwjcuaekbpvkqqxerv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3Z3dqY3VhZWticHZrcXF4ZXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMjc0MDMsImV4cCI6MjA4NDYwMzQwM30.5gdPsogDB4V8GG4GutHA8I09x9BCpqbyk0ycNDdtEfA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectClips() {
  console.log('--- FETCHING RECENT CLIPS FROM DATABASE ---');
  const { data: clips, error } = await supabase
    .from('clips')
    .select('id, video_id, timestamp_seconds, description, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching clips:', error);
  } else {
    clips.forEach((c, idx) => {
      console.log(`[${idx + 1}] ID: ${c.id}`);
      console.log(`    Video ID: ${c.video_id}`);
      console.log(`    Timestamp: ${c.timestamp_seconds}`);
      console.log(`    Desc: ${c.description}`);
      console.log(`    Created At: ${c.created_at}`);
      console.log(`    Thumbnail URL: https://i.ytimg.com/vi/${c.video_id}/mqdefault.jpg`);
    });
  }
}

inspectClips();
