ALTER TABLE public.live_trade_positions
  ADD COLUMN IF NOT EXISTS stake_reserved BOOLEAN NOT NULL DEFAULT FALSE;