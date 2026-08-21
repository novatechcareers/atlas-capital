import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const currency = searchParams.get('currency');

    if (!userId || !currency) {
      return NextResponse.json({ error: 'userId and currency are required.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured for bank account records.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('user_bank_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('currency', currency)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bankAccount: data ?? null }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load bank account.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, currency, gateway = 'bank', bankName, accountName, accountNumber } = body || {};

    if (!userId || !currency || !bankName || !accountName || !accountNumber) {
      return NextResponse.json({ error: 'Missing bank account details.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured for bank account records.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('user_bank_accounts')
      .upsert(
        {
          user_id: userId,
          currency,
          bank_name: String(bankName).trim(),
          account_name: String(accountName).trim(),
          account_number: String(accountNumber).trim(),
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,currency' },
      )
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mark related deposit_requests rows to indicate admin assigned bank details by updating note/updated_at.
    try {
      await supabase
        .from('deposit_requests')
        .update({ note: `Bank assigned: ${String(bankName).trim()}`, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('currency', currency)
        .eq('gateway', gateway)
        .in('status', ['Pending', 'Confirmed']);
    } catch {
      // best-effort; ignore errors here to avoid blocking bank account save
    }

    return NextResponse.json({ bankAccount: data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to save bank account.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const currency = searchParams.get('currency');
    if (!userId || !currency) {
      return NextResponse.json({ error: 'userId and currency are required.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured for bank account records.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase
      .from('user_bank_accounts')
      .delete()
      .eq('user_id', userId)
      .eq('currency', currency);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to reset payment account.' }, { status: 500 });
  }
}
