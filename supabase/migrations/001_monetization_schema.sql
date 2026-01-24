-- Monetization Schema Migration
-- Run this in your Supabase SQL editor to set up the required tables

-- ============================================================
-- User Profiles Table
-- ============================================================
-- Stores user subscription tier and usage tracking

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  analyses_today INT DEFAULT 0,
  analyses_reset_date DATE DEFAULT CURRENT_DATE,
  chat_messages_month INT DEFAULT 0,
  chat_reset_date DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id);

-- ============================================================
-- Saved Analyses Table (for future use)
-- ============================================================
-- Stores saved analysis results for users

CREATE TABLE IF NOT EXISTS saved_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  results JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_saved_analyses_user ON saved_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_analyses_expires ON saved_analyses(expires_at);

-- ============================================================
-- Usage Logs Table
-- ============================================================
-- Stores usage events for analytics

CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_usage_logs_user ON usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_action ON usage_logs(action);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

-- User Profiles: Users can only read/write their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Saved Analyses: Users can only access their own analyses
CREATE POLICY "Users can view own analyses" ON saved_analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses" ON saved_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses" ON saved_analyses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analyses" ON saved_analyses
  FOR DELETE USING (auth.uid() = user_id);

-- Usage Logs: Users can only view their own logs
CREATE POLICY "Users can view own logs" ON usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert logs (for backend)
CREATE POLICY "Service can insert logs" ON usage_logs
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- Trigger: Auto-create profile on user signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, tier, analyses_today, analyses_reset_date, chat_messages_month, chat_reset_date)
  VALUES (NEW.id, 'free', 0, CURRENT_DATE, 0, DATE_TRUNC('month', CURRENT_DATE)::DATE)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Trigger: Update timestamp on profile changes
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- Function: Reset daily analysis counts (call via cron or scheduled job)
-- ============================================================

CREATE OR REPLACE FUNCTION public.reset_daily_analysis_counts()
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET analyses_today = 0, analyses_reset_date = CURRENT_DATE
  WHERE analyses_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: Reset monthly chat counts (call via cron or scheduled job)
-- ============================================================

CREATE OR REPLACE FUNCTION public.reset_monthly_chat_counts()
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET chat_messages_month = 0, chat_reset_date = DATE_TRUNC('month', CURRENT_DATE)::DATE
  WHERE DATE_TRUNC('month', chat_reset_date) < DATE_TRUNC('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Grant permissions to service role for backend operations
-- ============================================================

GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON saved_analyses TO service_role;
GRANT ALL ON usage_logs TO service_role;

-- ============================================================
-- Sample data (optional - for testing)
-- ============================================================
-- Uncomment to create test data:

-- INSERT INTO user_profiles (id, tier) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'pro'),
--   ('00000000-0000-0000-0000-000000000002', 'enterprise');
