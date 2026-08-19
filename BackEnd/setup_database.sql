-- Setup Games Table in Supabase
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/hwgwjcuaekbpvkqqxerv/sql/new

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY, -- Slug format e.g. "call-of-duty-mobile"
  game_title TEXT NOT NULL,
  game_poster TEXT
);

-- Add game_id_tag column to clips table referencing games
ALTER TABLE clips ADD COLUMN IF NOT EXISTS game_id_tag TEXT REFERENCES games(id) ON DELETE SET NULL;

-- Add is_hidden column to clips table
ALTER TABLE clips ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT NULL;

-- Convert any existing 'false' values to NULL to reclaim storage space
UPDATE clips SET is_hidden = NULL WHERE is_hidden = false;

-- Add total_views column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_views BIGINT DEFAULT 0;

-- Enable Row Level Security (RLS)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read on games" ON games;
DROP POLICY IF EXISTS "Allow public insert on games" ON games;
DROP POLICY IF EXISTS "Allow public update on games" ON games;

-- Create policies for public access (anon/authenticated)
CREATE POLICY "Allow public read on games" ON games
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert on games" ON games
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on games" ON games
  FOR UPDATE USING (true);

-- Add storyboard_spec column to streams table
ALTER TABLE streams ADD COLUMN IF NOT EXISTS storyboard_spec TEXT DEFAULT NULL;

-- Add subscribers column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscribers BIGINT DEFAULT 0;
