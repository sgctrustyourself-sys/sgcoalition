-- Referral System - Update Migration
-- This adds only the missing pieces (analytics table and RPC function)

-- Table: referral_analytics (if not exists)
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

-- Add missing columns to referral_stats if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referral_stats' AND column_name='total_clicks') THEN
    ALTER TABLE referral_stats ADD COLUMN total_clicks INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referral_stats' AND column_name='total_views') THEN
    ALTER TABLE referral_stats ADD COLUMN total_views INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='referral_stats' AND column_name='conversion_rate') THEN
    ALTER TABLE referral_stats ADD COLUMN conversion_rate DECIMAL(5,2) DEFAULT 0.00;
  END IF;
END $$;

-- Indexes for referral_analytics
CREATE INDEX IF NOT EXISTS idx_referral_analytics_code ON referral_analytics(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_analytics_referrer ON referral_analytics(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_analytics_event ON referral_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_referral_analytics_created ON referral_analytics(created_at);

-- Enable RLS on referral_analytics
ALTER TABLE referral_analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Users can view own analytics" ON referral_analytics;
DROP POLICY IF EXISTS "System can insert analytics" ON referral_analytics;

-- Referral Analytics: Users can view their own analytics
CREATE POLICY "Users can view own analytics"
  ON referral_analytics FOR SELECT
  USING (auth.uid() = referrer_id);

-- Referral Analytics: System can insert analytics
CREATE POLICY "System can insert analytics"
  ON referral_analytics FOR INSERT
  WITH CHECK (true);

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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION track_referral_event TO authenticated;
GRANT EXECUTE ON FUNCTION track_referral_event TO anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Referral system analytics migration completed successfully!';
END $$;
