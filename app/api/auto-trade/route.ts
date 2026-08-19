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
      return NextResponse.json({ error: 'Database not configured for auto-trade.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('auto_trade_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ purchase: data ? {
      id: data.id,
      planName: data.plan_name,
      price: Number(data.price),
      status: data.status,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      activatedAt: data.activated_at ? new Date(data.activated_at).getTime() : undefined,
    } : null }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load auto trade purchase.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, planName, price, status = 'Reviewing', activatedAt } = body || {};

    if (!userId || !planName || price === undefined || price === null) {
      return NextResponse.json({ error: 'Missing auto-trade fields.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured for auto-trade.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error: balanceError } = await supabase.rpc('adjust_user_balance', {
      p_user_id: userId,
      p_delta: -Number(price),
    });
    if (balanceError) return NextResponse.json({ error: balanceError.message }, { status: 400 });

    const { data, error } = await supabase
      .from('auto_trade_purchases')
      .insert({
        user_id: userId,
        plan_name: planName,
        price: Number(price),
        status,
        activated_at: activatedAt ? new Date(activatedAt).toISOString() : null,
      })
      .select('*')
      .single();

    if (error) {
      await supabase.rpc('adjust_user_balance', { p_user_id: userId, p_delta: Number(price) });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ purchase: {
      id: data.id,
      planName: data.plan_name,
      price: Number(data.price),
      status: data.status,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      activatedAt: data.activated_at ? new Date(data.activated_at).getTime() : undefined,
    } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to create auto trade purchase.' }, { status: 500 });
  }
}
