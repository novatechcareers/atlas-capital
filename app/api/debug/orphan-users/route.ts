import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  try {
    const supabase = getServiceClient();
    if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    // collect user_ids referenced in key tables
    const tables = ['deposit_requests', 'withdrawal_requests', 'verification_requests', 'auto_trade_purchases'];
    const sets: Set<string> = new Set();

    for (const table of tables) {
      const { data } = await supabase.from(table).select('user_id').limit(1000);
      if (Array.isArray(data)) data.forEach((r: any) => { if (r?.user_id) sets.add(r.user_id); });
    }

    const referenced = Array.from(sets);
    if (referenced.length === 0) return NextResponse.json({ referenced: [], orphaned: [] }, { status: 200 });

    // get profiles for these ids
    const { data: profiles } = await supabase.from('profiles').select('id,email,first_name,last_name').in('id', referenced).limit(200);
    const presentIds = Array.isArray(profiles) ? profiles.map((p: any) => p.id) : [];
    const orphaned = referenced.filter((id) => !presentIds.includes(id));

    return NextResponse.json({ referencedCount: referenced.length, referenced, presentCount: presentIds.length, orphaned }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
