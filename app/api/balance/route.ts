import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured for balances.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('user_balances')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ balance: Number(data?.balance ?? 0) }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load balance.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = body?.userId;
    const delta = body?.delta === undefined ? null : Number(body.delta);
    const balance = Number(body?.balance ?? 0);

    if (!userId) {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured for balances.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (delta !== null) {
      if (!Number.isFinite(delta)) {
        return NextResponse.json({ error: 'delta must be a finite number.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('adjust_user_balance', { p_user_id: userId, p_delta: delta });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ balance: Number(data ?? 0) }, { status: 200 });
    }

    const { data, error } = await supabase
      .from('user_balances')
      .upsert({ user_id: userId, balance: Math.max(0, balance), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select('*')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ balance: Number(data?.balance ?? balance) }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to update balance.' }, { status: 500 });
  }
}
