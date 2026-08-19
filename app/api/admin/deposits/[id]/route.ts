import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const nextStatus = body?.status;

    if (!['Pending', 'Confirmed', 'Approved'].includes(nextStatus)) {
      return NextResponse.json({ error: 'Invalid deposit status.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured for deposits.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const note = nextStatus === 'Confirmed' ? 'Marked confirmed by admin' : nextStatus === 'Approved' ? 'Approved by admin' : null;
    const { data: existing, error: existingError } = await supabase
      .from('deposit_requests')
      .select('user_id,amount,status')
      .eq('id', id)
      .single();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

    const updatePayload: any = { status: nextStatus, updated_at: new Date().toISOString() };
    if (note) updatePayload.note = note;

    const { data, error } = await supabase
      .from('deposit_requests')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (nextStatus === 'Approved' && existing.status !== 'Approved') {
      const { error: balanceError } = await supabase.rpc('adjust_user_balance', {
        p_user_id: existing.user_id,
        p_delta: Number(existing.amount),
      });
      if (balanceError) {
        await supabase.from('deposit_requests').update({ status: existing.status, updated_at: new Date().toISOString() }).eq('id', id);
        return NextResponse.json({ error: balanceError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ deposit: data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to update deposit.' }, { status: 500 });
  }
}
