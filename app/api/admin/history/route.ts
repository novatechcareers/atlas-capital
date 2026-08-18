import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: Request) {
  try {
    const userId = new URL(req.url).searchParams.get('userId');
    const supabase = getServiceClient();
    if (!supabase) return NextResponse.json({ error: 'Database not configured for history.' }, { status: 500 });

    const filter = (query: any) => (userId ? query.eq('user_id', userId) : query);
    const [deposits, withdrawals, verifications, subscriptions, autoTrade, liveTrade] = await Promise.all([
      filter(supabase.from('deposit_requests').select('id,user_id,amount,currency,gateway,status,note,created_at,updated_at').order('created_at', { ascending: false }).limit(100)),
      filter(supabase.from('withdrawal_requests').select('id,user_id,amount,currency,method,status,note,created_at,updated_at').order('created_at', { ascending: false }).limit(100)),
      filter(supabase.from('verification_requests').select('id,user_id,document_type,status,reason,created_at,updated_at').order('created_at', { ascending: false }).limit(100)),
      filter(supabase.from('subscriptions').select('id,user_id,name,price,status,created_at,updated_at').order('created_at', { ascending: false }).limit(100)),
      filter(supabase.from('auto_trade_purchases').select('id,user_id,plan_name,price,status,created_at,updated_at').order('created_at', { ascending: false }).limit(100)),
      filter(supabase.from('live_trade_history').select('id,user_id,side,amount,pnl,status,created_at,closed_at').order('closed_at', { ascending: false }).limit(100)),
    ]);

    const failed = [deposits, withdrawals, verifications, subscriptions, autoTrade, liveTrade].find((result) => result.error);
    if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

    const history = [
      ...(deposits.data ?? []).map((item: any) => ({ id: `deposit-${item.id}`, userId: item.user_id, type: 'Deposit', title: `${item.gateway} deposit`, detail: `${item.currency} ${item.amount}${item.note ? ` - ${item.note}` : ''}`, status: item.status, createdAt: item.created_at })),
      ...(withdrawals.data ?? []).map((item: any) => ({ id: `withdrawal-${item.id}`, userId: item.user_id, type: 'Withdrawal', title: `${item.method} withdrawal`, detail: `${item.currency} ${item.amount}${item.note ? ` - ${item.note}` : ''}`, status: item.status, createdAt: item.created_at })),
      ...(verifications.data ?? []).map((item: any) => ({ id: `verification-${item.id}`, userId: item.user_id, type: 'Verification', title: item.document_type, detail: item.reason || 'Identity document review', status: item.status, createdAt: item.created_at })),
      ...(subscriptions.data ?? []).map((item: any) => ({ id: `subscription-${item.id}`, userId: item.user_id, type: 'Subscription', title: item.name, detail: `USD ${item.price}`, status: item.status, createdAt: item.created_at })),
      ...(autoTrade.data ?? []).map((item: any) => ({ id: `auto-trade-${item.id}`, userId: item.user_id, type: 'Auto-trade', title: item.plan_name, detail: `USD ${item.price}`, status: item.status, createdAt: item.created_at })),
      ...(liveTrade.data ?? []).map((item: any) => ({ id: `live-trade-${item.id}`, userId: item.user_id, type: 'Live trade', title: item.side, detail: `Amount ${item.amount}, P&L ${item.pnl}`, status: item.status, createdAt: item.closed_at || item.created_at })),
    ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

    return NextResponse.json({ history }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load history.' }, { status: 500 });
  }
}