ALTER TABLE public.live_trading_profiles
  ADD COLUMN IF NOT EXISTS outcome_mode TEXT NOT NULL DEFAULT 'market'
  CHECK (outcome_mode IN ('market', 'profit', 'loss'));
