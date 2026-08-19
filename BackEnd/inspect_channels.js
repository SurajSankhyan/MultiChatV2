import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || 'https://hwgwjcuaekbpvkqqxerv.supabase.co', process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3Z3dqY3VhZWticHZrcXF4ZXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMjc0MDMsImV4cCI6MjA4NDYwMzQwM30.5gdPsogDB4V8GG4GutHA8I09x9BCpqbyk0ycNDdtEfA');

async function test() {
  const { data: profiles, error } = await supabase.from('profiles').select('channel_id, channel_name, email');
  if (error) {
    console.error('Error fetching profiles:', error);
  } else {
    console.log('All Profiles in DB:');
    profiles.forEach(p => {
      console.log(`- Name: ${p.channel_name}, Email: ${p.email}, Channel ID: ${p.channel_id}`);
    });
  }
}
test();
