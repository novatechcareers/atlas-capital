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

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'Unlocked') {
      updateData.activated_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('auto_trade_purchases')
      .update(updateData)
      .eq('id', id)
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
    console.error('[auto-trade PATCH] Error:', error);
    return NextResponse.json({ error: error?.message || 'Unable to update auto-trade status.' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.from('auto_trade_purchases').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to reset auto-trade.' }, { status: 500 });
  }
}
