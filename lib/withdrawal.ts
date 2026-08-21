export const BANK_MINIMUM_WITHDRAWAL = 1500;
export const DIGITAL_ASSET_MINIMUM_WITHDRAWAL = 2000;
export const MAX_SELF_SERVICE_WITHDRAWAL = 4000;
export const WITHDRAWAL_TRANSFER_FEE = 500;
export const WITHDRAWAL_ADMIN_EMAIL = 'workdaysupport.novatech@gmail.com';

export function getWithdrawalMinimum(method: string | undefined) {
  return method === 'bank' ? BANK_MINIMUM_WITHDRAWAL : DIGITAL_ASSET_MINIMUM_WITHDRAWAL;
}

export function validateWithdrawalAmount(amount: unknown, method: string | undefined) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return 'Withdrawal amount must be greater than zero.';
  }
  const minimum = getWithdrawalMinimum(method);
  if (numericAmount < minimum) {
    return `Minimum withdrawal is ${minimum} for ${method === 'bank' ? 'bank transfers' : 'digital assets'}.`;
  }
  if (numericAmount > MAX_SELF_SERVICE_WITHDRAWAL) {
    return 'Withdrawals above 4000 require administrator assistance.';
  }
  return null;
}

export function isValidWithdrawalStatus(status: string | undefined): boolean {
  return ['Fee pending', 'Pending', 'Approved', 'Declined', 'Rejected'].includes(String(status ?? ''));
}

export function createWithdrawalRequest(supabase: any, body: any) {
  const { userId, amount, currency = 'USD', method = 'bank', walletAddress, bankAccount, status = 'Pending', note } = body || {};

  if (!userId || !amount || !method) {
    throw new Error('Missing withdrawal fields.');
  }

  const amountError = validateWithdrawalAmount(amount, method);
  if (amountError) throw new Error(amountError);

  return supabase
    .from('withdrawal_requests')
    .insert({
      user_id: userId,
      amount: Number(amount),
      currency,
      method,
      wallet_address: walletAddress ?? null,
      bank_account: bankAccount ?? null,
      status,
      note: note ?? 'Withdrawal request submitted',
    })
    .select('*')
    .single();
}

export async function approveWithdrawalRequest(supabase: any, id: string, body: any, existing: any) {
  const nextStatus = body?.status;

  if (!isValidWithdrawalStatus(nextStatus)) {
    throw new Error('Invalid withdrawal status.');
  }

  if (nextStatus === 'Approved') {
    const adminName = (body?.adminName as string) ?? 'admin';
    const { data: rpcData, error: rpcErr } = await supabase.rpc('approve_withdrawal_and_deduct', {
      p_withdrawal_id: id,
      p_acting_admin: adminName,
    });

    if (rpcErr) {
      throw new Error(rpcErr.message || String(rpcErr));
    }

    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;

    const { data: updatedWithdrawal, error: updatedErr } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (updatedErr) {
      return {
        withdrawal: {
          id: row?.withdrawal_id ?? id,
          status: row?.withdrawal_status ?? 'Approved',
          user_id: row?.user_id ?? existing?.user_id,
          amount: Number(existing?.amount ?? 0),
          method: existing?.method,
          wallet_address: existing?.wallet_address,
          bank_account: existing?.bank_account,
          note: existing?.note,
        },
        balance: row?.remaining_balance ?? null,
      };
    }

    return { withdrawal: updatedWithdrawal, balance: row?.remaining_balance ?? null };
  }

  const { data, error } = await supabase
    .from('withdrawal_requests')
    .update({ status: nextStatus, updated_at: new Date().toISOString(), note: body?.note ?? null })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { withdrawal: data };
}
