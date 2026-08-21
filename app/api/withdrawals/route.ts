import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createWithdrawalRequest, validateWithdrawalAmount } from '@/lib/withdrawal';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured for withdrawals.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let query = supabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false });
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ withdrawals: data ?? [] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load withdrawals.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, amount, currency = 'USD', method = 'bank', walletAddress, bankAccount, status = 'Pending', note } = body || {};

    if (!userId || !amount || !method) {
      return NextResponse.json({ error: 'Missing withdrawal fields.' }, { status: 400 });
    }

    const amountError = validateWithdrawalAmount(amount, method);
    if (amountError) return NextResponse.json({ error: amountError }, { status: 400 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured for withdrawals.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const result = await createWithdrawalRequest(supabase, { userId, amount, currency, method, walletAddress, bankAccount, status, note });
    const { data, error } = result;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ withdrawal: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to create withdrawal.' }, { status: 500 });
  }
}
