CREATE TABLE IF NOT EXISTS public.live_trading_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_type TEXT NOT NULL DEFAULT 'balanced' CHECK (profile_type IN ('conservative', 'balanced', 'aggressive')),
  win_rate DECIMAL(5, 2) NOT NULL DEFAULT 45.00 CHECK (win_rate >= 0 AND win_rate <= 100),
  loss_rate DECIMAL(5, 2) NOT NULL DEFAULT 55.00 CHECK (loss_rate >= 0 AND loss_rate <= 100),
  min_profit DECIMAL(10, 2) NOT NULL DEFAULT 10.00 CHECK (min_profit >= 0 AND min_profit <= 1000),
  max_loss DECIMAL(10, 2) NOT NULL DEFAULT 50.00 CHECK (max_loss >= 0 AND max_loss <= 1000),
  outcome_mode TEXT NOT NULL DEFAULT 'market' CHECK (outcome_mode IN ('market', 'profit', 'loss')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.live_trading_profiles
  ADD COLUMN IF NOT EXISTS outcome_mode TEXT NOT NULL DEFAULT 'market'
  CHECK (outcome_mode IN ('market', 'profit', 'loss'));

CREATE INDEX IF NOT EXISTS idx_live_trading_profiles_user_id
  ON public.live_trading_profiles (user_id);

ALTER TABLE public.live_trading_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own live trading profile" ON public.live_trading_profiles;
DROP POLICY IF EXISTS "Users can update own live trading profile" ON public.live_trading_profiles;
DROP POLICY IF EXISTS "Service role has full access to live trading profiles" ON public.live_trading_profiles;

CREATE POLICY "Users can view own live trading profile" ON public.live_trading_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own live trading profile" ON public.live_trading_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to live trading profiles" ON public.live_trading_profiles
  FOR ALL USING (true)
  WITH CHECK (true);