-- 1. Create Tables
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add image_url column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_chat_messages' AND column_name = 'image_url') THEN
        ALTER TABLE ai_chat_messages ADD COLUMN image_url TEXT;
    END IF;
END $$;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_updated_at ON ai_chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id ON ai_chat_messages(session_id);

-- 4. Enable RLS
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- 5. Table Policies (Drop existing to avoid conflicts if re-running)
DROP POLICY IF EXISTS "Users can view own sessions" ON ai_chat_sessions;
CREATE POLICY "Users can view own sessions" ON ai_chat_sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON ai_chat_sessions;
CREATE POLICY "Users can insert own sessions" ON ai_chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON ai_chat_sessions;
CREATE POLICY "Users can update own sessions" ON ai_chat_sessions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON ai_chat_sessions;
CREATE POLICY "Users can delete own sessions" ON ai_chat_sessions FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own messages" ON ai_chat_messages;
CREATE POLICY "Users can view own messages" ON ai_chat_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM ai_chat_sessions WHERE ai_chat_sessions.id = ai_chat_messages.session_id AND ai_chat_sessions.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can insert own messages" ON ai_chat_messages;
CREATE POLICY "Users can insert own messages" ON ai_chat_messages FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM ai_chat_sessions WHERE ai_chat_sessions.id = ai_chat_messages.session_id AND ai_chat_sessions.user_id = auth.uid())
);

-- 6. Storage Setup
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage Policies
DROP POLICY IF EXISTS "Authenticated users can upload chat images" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat images" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'chat-images' AND auth.uid() = owner );

DROP POLICY IF EXISTS "Authenticated users can view chat images" ON storage.objects;
CREATE POLICY "Authenticated users can view chat images" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'chat-images' );

DROP POLICY IF EXISTS "Public can view chat images" ON storage.objects;
CREATE POLICY "Public can view chat images" ON storage.objects FOR SELECT TO public USING ( bucket_id = 'chat-images' );
