-- Atlas Capital profile migration
-- This table is used by the app's Supabase auth flow and the admin portal.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  phone text,
  country text,
  email text,
  password_hash text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique
  ON public.profiles (lower(email));

CREATE INDEX IF NOT EXISTS idx_profiles_role_status
  ON public.profiles (role, status);

-- Keep profile rows in sync with Supabase Auth registrations.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, phone, country, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'firstName', ''),
    COALESCE(NEW.raw_user_meta_data->>'lastName', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', ''),
    NEW.email,
    'user',
    'pending'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    country = COALESCE(EXCLUDED.country, public.profiles.country);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Seed a test user only if an auth user already exists with the same email.
INSERT INTO public.profiles (id, first_name, last_name, phone, country, email, password_hash, role, status)
SELECT
  u.id,
  'Test',
  'User',
  '+15551234567',
  'US',
  u.email,
  encode(digest('Password123!', 'sha256'), 'hex'),
  'user',
  'active'
FROM auth.users u
WHERE u.email = 'test@example.com'
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  country = EXCLUDED.country,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  status = EXCLUDED.status;

-- Seed an admin profile only if an auth user already exists with that email.
INSERT INTO public.profiles (id, first_name, last_name, phone, country, email, password_hash, role, status)
SELECT
  u.id,
  'Atlas',
  'Admin',
  '+15550000000',
  'US',
  u.email,
  encode(digest('Admin@123!', 'sha256'), 'hex'),
  'admin',
  'active'
FROM auth.users u
WHERE u.email = 'admin@atlascapital.com'
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  phone = EXCLUDED.phone,
  country = EXCLUDED.country,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  status = EXCLUDED.status;

SELECT * FROM public.profiles ORDER BY created_at DESC LIMIT 20;
