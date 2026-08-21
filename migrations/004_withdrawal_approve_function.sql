-- Safe idempotent migration to create a function that atomically approves a withdrawal and deducts the user's balance

BEGIN;

DROP FUNCTION IF EXISTS public.approve_withdrawal_and_deduct(uuid, text);
DROP FUNCTION IF EXISTS public.approve_withdrawal_and_deduct(bigint, text);

CREATE OR REPLACE FUNCTION public.approve_withdrawal_and_deduct(
  p_withdrawal_id uuid,
  p_acting_admin text
)
RETURNS TABLE (
  withdrawal_id uuid,
  withdrawal_status text,
  user_id uuid,
  deducted_balance numeric,
  remaining_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  wr record;
  current_balance numeric;
  new_balance numeric;
BEGIN
  SELECT *
  INTO wr
  FROM public.withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal request % not found', p_withdrawal_id;
  END IF;

  IF wr.status = 'Approved' THEN
    SELECT COALESCE(balance, 0)
    INTO current_balance
    FROM public.user_balances
    WHERE public.user_balances.user_id = wr.user_id;

    RETURN QUERY
    SELECT wr.id, wr.status, wr.user_id, 0::numeric, current_balance;
    RETURN;
  END IF;

  INSERT INTO public.user_balances (user_id, balance, updated_at)
  VALUES (wr.user_id, 0, now())
  ON CONFLICT DO NOTHING;

  SELECT public.user_balances.balance
  INTO current_balance
  FROM public.user_balances
  WHERE public.user_balances.user_id = wr.user_id
  FOR UPDATE;

  current_balance := COALESCE(current_balance, 0);

  IF current_balance < wr.amount THEN
    RAISE EXCEPTION 'insufficient balance for user %: have %, need %',
      wr.user_id, current_balance, wr.amount;
  END IF;

  new_balance := current_balance - wr.amount;

  UPDATE public.user_balances AS ub
  SET balance = new_balance, updated_at = now()
  WHERE ub.user_id = wr.user_id;

  UPDATE public.withdrawal_requests
  SET status = 'Approved',
      updated_at = now(),
      note = CASE
        WHEN note IS NULL OR btrim(note) = '' THEN
          concat('Approved by ', p_acting_admin, ' at ', now())
        ELSE
          concat(note, ' | Approved by ', p_acting_admin, ' at ', now())
      END
  WHERE id = wr.id;

  RETURN QUERY
  SELECT wr.id, 'Approved'::text, wr.user_id, wr.amount::numeric, new_balance::numeric;
END;
$$;

SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE proname = 'approve_withdrawal_and_deduct';

COMMIT;
