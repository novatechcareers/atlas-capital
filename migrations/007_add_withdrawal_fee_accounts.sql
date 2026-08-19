CREATE TABLE IF NOT EXISTS public.withdrawal_fee_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  reference text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_fee_accounts_user_id
  ON public.withdrawal_fee_accounts (user_id);