-- Referral System Database Schema
-- Run this migration in Supabase SQL Editor

-- Table: referrals
-- Tracks individual referral transactions
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referral_code VARCHAR(20) NOT NULL,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID,
  order_total DECIMAL(10,2),
  commission_earned DECIMAL(10,2),
  commission_rate DECIMAL(5,2),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Table: referral_stats
-- Aggregated stats per user
CREATE TABLE IF NOT EXISTS referral_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  total_referrals INTEGER DEFAULT 0,
  successful_referrals INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0.00,
  current_tier INTEGER DEFAULT 1 CHECK (current_tier BETWEEN 1 AND 8),
  current_commission_rate DECIMAL(5,2) DEFAULT 5.00,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  pending_earnings DECIMAL(10,2) DEFAULT 0.00,
  paid_earnings DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: referral_analytics
-- Tracks individual clicks/views on referral links
CREATE TABLE IF NOT EXISTS referral_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_code VARCHAR(20) NOT NULL,
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('click', 'view', 'signup', 'purchase')),
  visitor_ip VARCHAR(45),
  user_agent TEXT,
  referrer_url TEXT,
  converted_to_sale BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referral_stats_code ON referral_stats(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_analytics_code ON referral_analytics(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_analytics_referrer ON referral_analytics(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_analytics_event ON referral_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_referral_analytics_created ON referral_analytics(created_at);

-- Row Level Security Policies

-- Enable RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_analytics ENABLE ROW LEVEL SECURITY;

-- Referrals: Users can view their own referrals
CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT
  USING (auth.uid() = referrer_id);

-- Referrals: System can insert (for tracking)
CREATE POLICY "System can insert referrals"
  ON referrals FOR INSERT
  WITH CHECK (true);

-- Referrals: System can update (for status changes)
CREATE POLICY "System can update referrals"
  ON referrals FOR UPDATE
  USING (true);

-- Referral Stats: Users can view their own stats
CREATE POLICY "Users can view own stats"
  ON referral_stats FOR SELECT
  USING (auth.uid() = user_id);

-- Referral Stats: System can manage stats
CREATE POLICY "System can manage stats"
  ON referral_stats FOR ALL
  USING (true);

-- Referral Analytics: Users can view their own analytics
CREATE POLICY "Users can view own analytics"
  ON referral_analytics FOR SELECT
  USING (auth.uid() = referrer_id);

-- Referral Analytics: System can insert analytics
CREATE POLICY "System can insert analytics"
  ON referral_analytics FOR INSERT
  WITH CHECK (true);

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_referral_stats_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_referral_stats_timestamp
  BEFORE UPDATE ON referral_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_referral_stats_timestamp();

-- Function: Initialize referral stats for new users
CREATE OR REPLACE FUNCTION initialize_referral_stats()
RETURNS TRIGGER AS $$
DECLARE
  new_code VARCHAR(20);
BEGIN
  -- Generate unique referral code
  new_code := 'SG-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM referral_stats WHERE referral_code = new_code) LOOP
    new_code := 'SG-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
  END LOOP;
  
  -- Insert initial stats
  INSERT INTO referral_stats (user_id, referral_code)
  VALUES (NEW.id, new_code);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-create referral stats on user signup
CREATE TRIGGER create_referral_stats_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_referral_stats();

COMMENT ON TABLE referrals IS 'Tracks individual referral transactions and commissions';
COMMENT ON TABLE referral_stats IS 'Aggregated referral statistics per user';
COMMENT ON TABLE referral_analytics IS 'Tracks clicks, views, and conversion events for referral links';

-- Function: Track referral events and update stats
CREATE OR REPLACE FUNCTION track_referral_event(
  p_referral_code VARCHAR(20),
  p_event_type VARCHAR(20),
  p_user_id UUID DEFAULT NULL,
  p_visitor_ip VARCHAR(45) DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer_url TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_referrer_id UUID;
  v_total_clicks INTEGER;
  v_total_views INTEGER;
  v_successful_referrals INTEGER;
  v_conversion_rate DECIMAL(5,2);
BEGIN
  -- Get referrer_id from referral_code
  SELECT user_id INTO v_referrer_id
  FROM referral_stats
  WHERE referral_code = p_referral_code;
  
  -- If referral code doesn't exist, exit
  IF v_referrer_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Insert analytics event
  INSERT INTO referral_analytics (
    referral_code,
    referrer_id,
    event_type,
    visitor_ip,
    user_agent,
    referrer_url
  ) VALUES (
    p_referral_code,
    v_referrer_id,
    p_event_type,
    p_visitor_ip,
    p_user_agent,
    p_referrer_url
  );
  
  -- Update aggregated stats based on event type
  CASE p_event_type
    WHEN 'click' THEN
      UPDATE referral_stats
      SET total_clicks = total_clicks + 1
      WHERE user_id = v_referrer_id;
      
    WHEN 'view' THEN
      UPDATE referral_stats
      SET total_views = total_views + 1
      WHERE user_id = v_referrer_id;
      
    WHEN 'signup' THEN
      UPDATE referral_stats
      SET total_referrals = total_referrals + 1
      WHERE user_id = v_referrer_id;
      
    WHEN 'purchase' THEN
      UPDATE referral_stats
      SET successful_referrals = successful_referrals + 1
      WHERE user_id = v_referrer_id;
      
      -- Mark the analytics event as converted
      UPDATE referral_analytics
      SET converted_to_sale = TRUE
      WHERE referral_code = p_referral_code
        AND event_type = 'signup'
        AND created_at = (
          SELECT MAX(created_at)
          FROM referral_analytics
          WHERE referral_code = p_referral_code
            AND event_type = 'signup'
        );
  END CASE;
  
  -- Recalculate conversion rate
  SELECT total_clicks, total_views, successful_referrals
  INTO v_total_clicks, v_total_views, v_successful_referrals
  FROM referral_stats
  WHERE user_id = v_referrer_id;
  
  -- Calculate conversion rate (successful referrals / total clicks)
  IF v_total_clicks > 0 THEN
    v_conversion_rate := (v_successful_referrals::DECIMAL / v_total_clicks::DECIMAL) * 100;
  ELSE
    v_conversion_rate := 0.00;
  END IF;
  
  -- Update conversion rate
  UPDATE referral_stats
  SET conversion_rate = v_conversion_rate
  WHERE user_id = v_referrer_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION track_referral_event TO authenticated;
GRANT EXECUTE ON FUNCTION track_referral_event TO anon;
