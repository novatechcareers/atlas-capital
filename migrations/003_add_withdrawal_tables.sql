-- Atlas Capital withdrawal and bank metadata tables

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  method text NOT NULL DEFAULT 'bank',
  wallet_address text,
  bank_account text,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Fee pending', 'Pending', 'Approved', 'Declined', 'Rejected')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'USD',
  bank_name text,
  account_name text,
  account_number text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id
  ON public.withdrawal_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status
  ON public.withdrawal_requests (status);

CREATE INDEX IF NOT EXISTS idx_user_bank_accounts_user_id
  ON public.user_bank_accounts (user_id, currency);
