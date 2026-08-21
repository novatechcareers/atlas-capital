-- Atlas Capital verification and subscription tables

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_data_url text NOT NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Declined')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  status text NOT NULL DEFAULT 'Reviewing' CHECK (status IN ('Reviewing', 'Active', 'Rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id
  ON public.verification_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_verification_requests_status
  ON public.verification_requests (status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions (status);
