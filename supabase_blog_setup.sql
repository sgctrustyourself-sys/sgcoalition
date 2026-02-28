-- ============================================
-- BLOG POSTS SYSTEM SETUP (GOVERNANCE + COMMUNITY)
-- ============================================

-- 1. Create the posts table
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    excerpt TEXT,
    author TEXT NOT NULL,
    author_id TEXT, -- Wallet address or UUID
    category TEXT NOT NULL CHECK (category IN ('update', 'community', 'announcement', 'drop', 'idea')),
    cover_image TEXT,
    tags TEXT[],
    is_published BOOLEAN DEFAULT false,
    upvote_power NUMERIC DEFAULT 0,
    downvote_power NUMERIC DEFAULT 0,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create comments table
CREATE TABLE IF NOT EXISTS public.post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- Wallet address
    user_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create interaction/voting table
CREATE TABLE IF NOT EXISTS public.post_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- Wallet address
    vote_type INTEGER CHECK (vote_type IN (1, -1)), -- 1 for upvote, -1 for downvote
    weight NUMERIC NOT NULL DEFAULT 0, -- SGCoin balance at time of voting
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id)
);

-- 4. Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Posts
DROP POLICY IF EXISTS "Public can view published posts" ON public.posts;
CREATE POLICY "Public can view published posts" ON public.posts FOR SELECT TO public USING (is_published = true);

DROP POLICY IF EXISTS "Anyone can submit ideas" ON public.posts;
CREATE POLICY "Anyone can submit ideas" ON public.posts FOR INSERT TO public WITH CHECK (category = 'idea');

DROP POLICY IF EXISTS "Admins can manage everything" ON public.posts;
CREATE POLICY "Admins can manage everything" ON public.posts FOR ALL TO public USING (true);

-- Comments
DROP POLICY IF EXISTS "Public can view comments" ON public.post_comments;
CREATE POLICY "Public can view comments" ON public.post_comments FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Anyone can comment" ON public.post_comments;
CREATE POLICY "Anyone can comment" ON public.post_comments FOR INSERT TO public WITH CHECK (true);

-- Votes
DROP POLICY IF EXISTS "Public can view votes" ON public.post_votes;
CREATE POLICY "Public can view votes" ON public.post_votes FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Anyone can vote" ON public.post_votes;
CREATE POLICY "Anyone can vote" ON public.post_votes FOR ALL TO public USING (true);

-- 6. Function to update post counters on weighted vote
CREATE OR REPLACE FUNCTION handle_post_vote_weighted()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.vote_type = 1) THEN
            UPDATE public.posts SET upvote_power = upvote_power + NEW.weight WHERE id = NEW.post_id;
        ELSE
            UPDATE public.posts SET downvote_power = downvote_power + NEW.weight WHERE id = NEW.post_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.vote_type = 1) THEN
            UPDATE public.posts SET upvote_power = upvote_power - OLD.weight WHERE id = OLD.post_id;
        ELSE
            UPDATE public.posts SET downvote_power = downvote_power - OLD.weight WHERE id = OLD.post_id;
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.vote_type = 1 AND NEW.vote_type = -1) THEN
            UPDATE public.posts 
            SET upvote_power = upvote_power - OLD.weight,
                downvote_power = downvote_power + NEW.weight 
            WHERE id = NEW.post_id;
        ELSIF (OLD.vote_type = -1 AND NEW.vote_type = 1) THEN
            UPDATE public.posts 
            SET downvote_power = downvote_power - OLD.weight,
                upvote_power = upvote_power + NEW.weight 
            WHERE id = NEW.post_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_post_vote_weighted
    AFTER INSERT OR UPDATE OR DELETE ON public.post_votes
    FOR EACH ROW EXECUTE PROCEDURE handle_post_vote_weighted();

-- 7. Auto-update updated_at handle
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
