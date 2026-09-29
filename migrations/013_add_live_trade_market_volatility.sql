ALTER TABLE public.live_trading_profiles
  ADD COLUMN IF NOT EXISTS market_volatility DECIMAL(5, 2) NOT NULL DEFAULT 8.00
  CHECK (market_volatility >= 1 AND market_volatility <= 30);
