import { getSupabase } from './supabase.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = getSupabase();

async function check() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, channel_id, channel_name, email, total_views');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Profiles with total_views:', data);
  }
}
check();
