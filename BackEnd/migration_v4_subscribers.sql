-- Add subscribers column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscribers BIGINT DEFAULT 0;
