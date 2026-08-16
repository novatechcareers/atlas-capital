-- Atlas Capital balance and trading tables

CREATE TABLE IF NOT EXISTS public.user_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.auto_trade_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name text NOT NULL,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  status text NOT NULL DEFAULT 'Reviewing' CHECK (status IN ('Reviewing', 'Unlocked', 'Running', 'Stopped', 'Rejected')),
  activated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_trade_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('Long', 'Short')),
  entry_price numeric(12,2) NOT NULL,
  current_price numeric(12,2) NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  leverage numeric(8,2) NOT NULL DEFAULT 1,
  pnl numeric(12,2) NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.live_trade_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('Long', 'Short')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  leverage numeric(8,2) NOT NULL DEFAULT 1,
  entry_price numeric(12,2) NOT NULL,
  exit_price numeric(12,2) NOT NULL,
  pnl numeric(12,2) NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'Closed' CHECK (status IN ('Closed', 'Open')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_balances_user_id ON public.user_balances (user_id);
CREATE INDEX IF NOT EXISTS idx_auto_trade_purchases_user_id ON public.auto_trade_purchases (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_trade_purchases_status ON public.auto_trade_purchases (status);
CREATE INDEX IF NOT EXISTS idx_live_trade_positions_user_id ON public.live_trade_positions (user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_trade_history_user_id ON public.live_trade_history (user_id, closed_at DESC);
