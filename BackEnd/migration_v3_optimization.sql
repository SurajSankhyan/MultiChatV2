-- Migration v3: Storage Optimization & Schema Tuning
-- Run this script in your Supabase SQL Editor: https://supabase.com/dashboard/project/hwgwjcuaekbpvkqqxerv/sql/new

-- 1. Drop redundant columns to reclaim storage space
ALTER TABLE clips DROP COLUMN IF EXISTS user_profile_url;
ALTER TABLE streams DROP COLUMN IF EXISTS thumbnail;
ALTER TABLE clips DROP COLUMN IF EXISTS blocked; -- Pointless/unused column

-- 2. Optimize data types for bounded columns (saving space and enforcing limits)
-- YouTube video IDs are always exactly 11 characters
ALTER TABLE clips ALTER COLUMN video_id TYPE VARCHAR(11);
ALTER TABLE streams ALTER COLUMN video_id TYPE VARCHAR(11);

-- YouTube Channel IDs are always exactly 24 characters (starting with "UC")
ALTER TABLE profiles ALTER COLUMN channel_id TYPE VARCHAR(24);

-- Enforce reasonable size limits on other columns
ALTER TABLE games ALTER COLUMN id TYPE VARCHAR(50);
ALTER TABLE clips ALTER COLUMN game_id_tag TYPE VARCHAR(50);
ALTER TABLE clips ALTER COLUMN user_role TYPE VARCHAR(20);
