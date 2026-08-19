-- Migration v5: Add is_special column to profiles table
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/hwgwjcuaekbpvkqqxerv/sql/new

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_special BOOLEAN DEFAULT NULL;

-- Enable public read access for this column (since it's inside profiles table, policies usually allow public read)
