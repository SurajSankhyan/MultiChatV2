-- SQL Migration Script: Rebuild public.Kick table to link directly with public.users
-- Run this script in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new

-- 1. Drop existing Kick tables
DROP TABLE IF EXISTS public."Kick" CASCADE;
DROP TABLE IF EXISTS public.kick_accounts CASCADE;

-- 2. Create public.Kick table linked directly to public.users ID
CREATE TABLE public."Kick" (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    email TEXT,
    username TEXT UNIQUE,
    channel_id TEXT,
    chatroom_id TEXT,
    avatar_url TEXT,
    kick_access_token TEXT,
    kick_refresh_token TEXT,
    kick_cookie TEXT,
    is_connected BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create fast lookup indexes
CREATE INDEX idx_kick_email ON public."Kick"(email);
CREATE INDEX idx_kick_username ON public."Kick"(username);

-- 4. Enable Row Level Security (RLS) & Add Public Policies
ALTER TABLE public."Kick" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write on Kick" ON public."Kick";
CREATE POLICY "Allow public read/write on Kick" ON public."Kick"
    FOR ALL
    USING (true)
    WITH CHECK (true);
