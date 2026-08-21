import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;

  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured for notifications.' }, { status: 500 });
    }

    const result: any = {
      depositPending: false,
      verificationPending: false,
      autoTradePending: false,
      feePending: false,
      subscriptionPending: false,
    };

    if (userId) {
      // deposit (bank) pending/confirmed
      const { data: deposits } = await supabase
        .from('deposit_requests')
        .select('id,status,gateway,currency')
        .eq('user_id', userId)
        .in('status', ['Pending', 'Confirmed']);

      if (!Array.isArray(deposits) || deposits.length === 0) {
        result.depositPending = false;
      } else {
        // only consider bank gateway entries that are still Pending/Confirmed
        const depositRequests = deposits;
        if (depositRequests.length === 0) {
          result.depositPending = false;
        } else {
          const currencies = Array.from(new Set(depositRequests.map((d: any) => d.currency || 'USD')));
          const { data: accounts } = await supabase
            .from('user_bank_accounts')
            .select('currency')
            .eq('user_id', userId)
            .in('currency', currencies);

          const assignedCurrencies = Array.isArray(accounts) ? accounts.map((a: any) => a.currency) : [];

          result.depositPending = depositRequests.some((d: any) => !assignedCurrencies.includes(d.currency));
        }
      }

      // verification pending
      const { data: verifications } = await supabase.from('verification_requests').select('id,status').eq('user_id', userId).eq('status', 'Pending').limit(1);
      result.verificationPending = Array.isArray(verifications) && verifications.length > 0;

      // auto-trade purchases under review
      const { data: auto } = await supabase.from('auto_trade_purchases').select('id,status').eq('user_id', userId).eq('status', 'Reviewing').limit(1);
      result.autoTradePending = Array.isArray(auto) && auto.length > 0;

      // withdrawal fee requests
      const { data: fees } = await supabase.from('withdrawal_requests').select('id,status').eq('user_id', userId).eq('status', 'Fee pending').limit(1);
      result.feePending = Array.isArray(fees) && fees.length > 0;

      // subscription review
      const { data: subs } = await supabase.from('subscriptions').select('id,status').eq('user_id', userId).eq('status', 'Reviewing').limit(1);
      result.subscriptionPending = Array.isArray(subs) && subs.length > 0;
    }

    // If no userId provided, also compute a global "any pending" view for admin overview
    if (!userId) {
      // any bank deposit pending without an assigned account
      const { data: anyDeposits } = await supabase
        .from('deposit_requests')
        .select('id,currency,gateway,status,user_id')
        .in('status', ['Pending', 'Confirmed']);

      if (Array.isArray(anyDeposits) && anyDeposits.length > 0) {
        if (anyDeposits.length > 0) {
          const currencies = Array.from(new Set(anyDeposits.map((d: any) => d.currency || 'USD')));
          const { data: accounts } = await supabase
            .from('user_bank_accounts')
            .select('user_id,currency')
            .in('currency', currencies);

          const assignedKeys = new Set((accounts ?? []).map((a: any) => `${a.user_id}:${a.currency}`));
          result.depositPending = anyDeposits.some((d: any) => !assignedKeys.has(`${d.user_id}:${d.currency}`));
        }
      }

      // any pending verification requests
      const { data: anyVerifications } = await supabase.from('verification_requests').select('id,status').eq('status', 'Pending').limit(1);
      result.verificationPending = Array.isArray(anyVerifications) && anyVerifications.length > 0;

      // any auto-trade purchases under review
      const { data: anyAuto } = await supabase.from('auto_trade_purchases').select('id,status').eq('status', 'Reviewing').limit(1);
      result.autoTradePending = Array.isArray(anyAuto) && anyAuto.length > 0;

      // any fee requests
      const { data: anyFees } = await supabase.from('withdrawal_requests').select('id,status').eq('status', 'Fee pending').limit(1);
      result.feePending = Array.isArray(anyFees) && anyFees.length > 0;

      // any subscription reviews
      const { data: anySubs } = await supabase.from('subscriptions').select('id,status').eq('status', 'Reviewing').limit(1);
      result.subscriptionPending = Array.isArray(anySubs) && anySubs.length > 0;
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load notifications.' }, { status: 500 });
  }
}
