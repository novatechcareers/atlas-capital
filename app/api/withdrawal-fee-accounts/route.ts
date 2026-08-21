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
    if (!userId) return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    const supabase = getServiceClient();
    if (!supabase) return NextResponse.json({ error: 'Database not configured for withdrawal fee accounts.' }, { status: 500 });
    const { data, error } = await supabase.from('withdrawal_fee_accounts').select('*').eq('user_id', userId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ account: data ?? null }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load withdrawal fee account.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, bankName, accountName, accountNumber, reference } = body || {};
    if (!userId || !bankName || !accountName || !accountNumber || !reference) {
      return NextResponse.json({ error: 'Missing withdrawal fee account details.' }, { status: 400 });
    }
    const supabase = getServiceClient();
    if (!supabase) return NextResponse.json({ error: 'Database not configured for withdrawal fee accounts.' }, { status: 500 });
    const { data, error } = await supabase.from('withdrawal_fee_accounts').upsert({
      user_id: userId,
      bank_name: String(bankName).trim(),
      account_name: String(accountName).trim(),
      account_number: String(accountNumber).trim(),
      reference: String(reference).trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ account: data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to save withdrawal fee account.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = new URL(req.url).searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    const supabase = getServiceClient();
    if (!supabase) return NextResponse.json({ error: 'Database not configured for withdrawal fee accounts.' }, { status: 500 });
    const { error } = await supabase.from('withdrawal_fee_accounts').delete().eq('user_id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to reset withdrawal fee account.' }, { status: 500 });
  }
}