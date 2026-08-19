-- Atomic balance adjustment used by deposits, purchases, and trade settlement.

CREATE OR REPLACE FUNCTION public.adjust_user_balance(p_user_id uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance numeric;
  next_balance numeric;
BEGIN
  INSERT INTO public.user_balances (user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO current_balance
  FROM public.user_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  next_balance := current_balance + p_delta;
  IF next_balance < 0 THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  UPDATE public.user_balances
  SET balance = next_balance, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN next_balance;
END;
$$;