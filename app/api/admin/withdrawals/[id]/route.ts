import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const nextStatus = body?.status;

    if (!['Fee pending', 'Pending', 'Approved', 'Declined', 'Rejected'].includes(nextStatus)) {
      return NextResponse.json({ error: 'Invalid withdrawal status.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured for withdrawals.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Load existing withdrawal request
    const { data: existing, error: fetchErr } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Withdrawal request not found.' }, { status: 404 });
    }

    const userId = existing.user_id;
    const amount = Number(existing.amount ?? 0);

    // If approving, perform server-side balance check and deduction
    if (nextStatus === 'Approved') {
      // Use DB RPC function for atomic approve-and-deduct operation
      try {
        const adminName = (body?.adminName as string) ?? 'admin';
        const { data: rpcData, error: rpcErr } = await supabase.rpc('approve_withdrawal_and_deduct', { p_withdrawal_id: Number(id), p_acting_admin: adminName });
        if (rpcErr) {
          // If the RPC raised an exception (e.g., insufficient funds), surface it
          return NextResponse.json({ error: rpcErr.message || rpcErr }, { status: 400 });
        }

        // rpcData is an array of rows returned by the function; pick first
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        return NextResponse.json({ withdrawal: { id: row?.withdrawal_id, status: row?.withdrawal_status, user_id: row?.user_id }, balance: row?.remaining_balance ?? null }, { status: 200 });
      } catch (rpcEx: any) {
        return NextResponse.json({ error: rpcEx?.message || String(rpcEx) }, { status: 500 });
      }
    }

    // Non-approve status transitions (Declined, Pending, Fee pending)
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .update({ status: nextStatus, updated_at: new Date().toISOString(), note: body?.note ?? null })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ withdrawal: data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to update withdrawal.' }, { status: 500 });
  }
}
