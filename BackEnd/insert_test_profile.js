import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL || 'https://hwgwjcuaekbpvkqqxerv.supabase.co';
const key = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3Z3dqY3VhZWticHZrcXF4ZXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMjc0MDMsImV4cCI6MjA4NDYwMzQwM30.5gdPsogDB4V8GG4GutHA8I09x9BCpqbyk0ycNDdtEfA';
const supabase = createClient(url, key);

async function run() {
  console.log('--- INSERTING MRBEAST TEST PROFILE ---');
  // We use a random UUID for authentication ID
  const testId = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
  
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: testId,
      email: 'mrbeast_test@youtube.com',
      channel_id: 'UCX6OQ3DkcsbYNE6H8uQQuVA', // MrBeast channel ID
      channel_name: 'MrBeast Test',
      role: 'creator'
    }, { onConflict: 'id' });
    
  if (error) {
    console.error('Error inserting test profile:', error);
  } else {
    console.log('Successfully inserted MrBeast test profile in Supabase!');
  }
}

run();
