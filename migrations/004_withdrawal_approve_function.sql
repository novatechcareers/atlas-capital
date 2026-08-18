-- Safe idempotent migration to create a function that atomically approves a withdrawal and deducts the user's balance

BEGIN;

DROP FUNCTION IF EXISTS public.approve_withdrawal_and_deduct(bigint, text);

CREATE OR REPLACE FUNCTION public.approve_withdrawal_and_deduct(p_withdrawal_id uuid, p_acting_admin text)
RETURNS TABLE(
  withdrawal_id uuid,
  withdrawal_status text,
  user_id uuid,
  deducted_balance numeric,
  remaining_balance numeric
) AS $$
DECLARE
  wr RECORD;
  ub RECORD;
  new_balance numeric;
BEGIN
  -- Lock the withdrawal row to avoid concurrent approvals
  SELECT * INTO wr
  FROM public.withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal request % not found', p_withdrawal_id;
  END IF;

  IF wr.status = 'Approved' THEN
    RETURN QUERY SELECT wr.id, wr.status, wr.user_id, 0::numeric, (SELECT balance FROM public.user_balances WHERE user_id = wr.user_id);
    RETURN;
  END IF;

  -- Lock or create the user's balance row
  SELECT * INTO ub FROM public.user_balances WHERE user_id = wr.user_id FOR UPDATE;
  IF NOT FOUND THEN
    -- If balance row doesn't exist, treat as zero
    INSERT INTO public.user_balances(user_id, balance, updated_at)
    VALUES (wr.user_id, 0, now())
    RETURNING * INTO ub;
  END IF;

  IF ub.balance < wr.amount THEN
    RAISE EXCEPTION 'insufficient balance for user %: have %, need %', wr.user_id, ub.balance, wr.amount;
  END IF;

  new_balance := ub.balance - wr.amount;

  -- Update balance
  UPDATE public.user_balances SET balance = new_balance, updated_at = now() WHERE user_id = wr.user_id;

  -- Update withdrawal request to Approved and add admin note
  UPDATE public.withdrawal_requests
  SET status = 'Approved', updated_at = now(), note = concat(coalesce(note, ''), ' | Approved by ', p_acting_admin, ' at ', now())
  WHERE id = wr.id;

  RETURN QUERY SELECT wr.id, 'Approved'::text, wr.user_id, wr.amount::numeric, new_balance::numeric;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
