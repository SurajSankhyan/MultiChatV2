-- Supabase SQL Migration - Game Normalization & Optimization
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/hwgwjcuaekbpvkqqxerv/sql/new

-- 1. Rename existing games table to games_old
ALTER TABLE games RENAME TO games_old;

-- 2. Create the new normalized games table
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY, -- Slug format e.g. "call-of-duty-mobile"
  game_title TEXT NOT NULL,
  game_poster TEXT
);

-- 3. Add game_id_tag column to clips table
ALTER TABLE clips ADD COLUMN IF NOT EXISTS game_id_tag TEXT REFERENCES games(id) ON DELETE SET NULL;

-- 4. Enable Row Level Security (RLS) on new games table
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for public access (anon/authenticated)
CREATE POLICY "Allow public read on games" ON games FOR SELECT USING (true);
CREATE POLICY "Allow public insert on games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on games" ON games FOR UPDATE USING (true);

-- 6. Migrate existing game data into the new table (slugifying game_name)
INSERT INTO games (id, game_title, game_poster)
SELECT DISTINCT ON (LOWER(REGEXP_REPLACE(REGEXP_REPLACE(game_name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')))
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(game_name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')) as id,
  game_title,
  game_poster
FROM games_old
ON CONFLICT (id) DO NOTHING;

-- 7. Update clips to set game_id_tag by joining with games_old
UPDATE clips
SET game_id_tag = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(games_old.game_name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
FROM games_old
WHERE clips.video_id = games_old.video_id;

-- 8. Drop the old games table
DROP TABLE games_old;
