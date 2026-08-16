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
    const supabase = getServiceClient();
    if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    const [depositsRes, withdrawalsRes, verifRes, balancesRes, usersRes] = await Promise.all([
      supabase.from('deposit_requests').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('verification_requests').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('user_balances').select('*').order('updated_at', { ascending: false }).limit(20),
      supabase.from('profiles').select('id, first_name, last_name, email, role').order('created_at', { ascending: false }).limit(20),
    ]);

    return NextResponse.json({ deposits: depositsRes.data ?? [], withdrawals: withdrawalsRes.data ?? [], verifications: verifRes.data ?? [], balances: balancesRes.data ?? [], profiles: usersRes.data ?? [] }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
