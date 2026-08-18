import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body || {};

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing auto-trade ID or status.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('auto_trade_purchases')
      .update({
        status,
        updated_at: new Date().toISOString(),
        activated_at: status === 'Unlocked' ? new Date().toISOString() : undefined,
      })
      .eq('id', Number(id))
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      purchase: {
        id: data.id,
        planName: data.plan_name,
        price: Number(data.price),
        status: data.status,
        createdAt: new Date(data.created_at).getTime(),
        updatedAt: new Date(data.updated_at).getTime(),
        activatedAt: data.activated_at ? new Date(data.activated_at).getTime() : undefined,
      },
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to update auto-trade status.' }, { status: 500 });
  }
}
