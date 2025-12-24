-- ============================================
-- STEP 8: Fix ai_chat_sessions policies
-- ============================================

DROP POLICY IF EXISTS "Users can view own sessions" ON ai_chat_sessions;
CREATE POLICY "Users can view own sessions" ON ai_chat_sessions
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own sessions" ON ai_chat_sessions;
CREATE POLICY "Users can insert own sessions" ON ai_chat_sessions
FOR INSERT TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own sessions" ON ai_chat_sessions;
CREATE POLICY "Users can update own sessions" ON ai_chat_sessions
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete own sessions" ON ai_chat_sessions;
CREATE POLICY "Users can delete own sessions" ON ai_chat_sessions
FOR DELETE TO authenticated
USING (user_id = (SELECT auth.uid()));

-- ============================================
-- STEP 9: Fix ai_chat_messages policies
-- ============================================

DROP POLICY IF EXISTS "Users can view own messages" ON ai_chat_messages;
CREATE POLICY "Users can view own messages" ON ai_chat_messages
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM ai_chat_sessions 
        WHERE ai_chat_sessions.id = ai_chat_messages.session_id 
        AND ai_chat_sessions.user_id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS "Users can insert own messages" ON ai_chat_messages;
CREATE POLICY "Users can insert own messages" ON ai_chat_messages
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM ai_chat_sessions 
        WHERE ai_chat_sessions.id = ai_chat_messages.session_id 
        AND ai_chat_sessions.user_id = (SELECT auth.uid())
    )
);

-- Verify
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('ai_chat_sessions', 'ai_chat_messages')
ORDER BY tablename, policyname;
