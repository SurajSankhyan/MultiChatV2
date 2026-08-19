-- Table definition for storing connected YouTube channel credentials in MultiChat DB
CREATE TABLE IF NOT EXISTS public.youtube_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT,
    avatar_url TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_channel UNIQUE (user_id, channel_id)
);

-- Index for fast user verification lookups
CREATE INDEX IF NOT EXISTS idx_youtube_accounts_user ON public.youtube_accounts(user_id, user_email);

-- Enable RLS (Row Level Security) if needed
ALTER TABLE public.youtube_accounts ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access for authenticated / service operations if policies are enabled
CREATE POLICY "Allow service and user operations" ON public.youtube_accounts
    FOR ALL
    USING (true)
    WITH CHECK (true);
