-- AI Chat Sessions Table
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Chat Messages Table
CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_updated_at ON ai_chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_session_id ON ai_chat_messages(session_id);

-- Enable RLS
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_chat_sessions
CREATE POLICY "Users can view own sessions"
    ON ai_chat_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
    ON ai_chat_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON ai_chat_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
    ON ai_chat_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for ai_chat_messages
CREATE POLICY "Users can view own messages"
    ON ai_chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM ai_chat_sessions
            WHERE ai_chat_sessions.id = ai_chat_messages.session_id
            AND ai_chat_sessions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own messages"
    ON ai_chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM ai_chat_sessions
            WHERE ai_chat_sessions.id = ai_chat_messages.session_id
            AND ai_chat_sessions.user_id = auth.uid()
        )
    );
