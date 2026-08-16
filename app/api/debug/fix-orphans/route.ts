import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(req: Request) {
  try {
    const ALLOW = process.env.ALLOW_FIX_ORPHANS === 'true';
    if (!ALLOW) return NextResponse.json({ error: 'fix-orphans disabled; set ALLOW_FIX_ORPHANS=true to enable' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : null;

    const supabase = getServiceClient();
    if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

    // If no ids provided, compute orphaned ids
    let orphaned: string[] = ids ?? [];
    if (!orphaned || orphaned.length === 0) {
      const resp = await supabase.rpc(''); // no-op placeholder
      // fallback: reuse the orphan detection logic
      const tables = ['deposit_requests', 'withdrawal_requests', 'verification_requests', 'auto_trade_purchases'];
      const sets: Set<string> = new Set();
      for (const table of tables) {
        const { data } = await supabase.from(table).select('user_id').limit(1000);
        if (Array.isArray(data)) data.forEach((r: any) => { if (r?.user_id) sets.add(r.user_id); });
      }
      const referenced = Array.from(sets);
      if (referenced.length === 0) return NextResponse.json({ created: [] }, { status: 200 });
      const { data: profiles } = await supabase.from('profiles').select('id').in('id', referenced).limit(200);
      const presentIds = Array.isArray(profiles) ? profiles.map((p: any) => p.id) : [];
      orphaned = referenced.filter((id) => !presentIds.includes(id));
    }

    const created: any[] = [];
    for (const uid of orphaned) {
      // try to fetch auth user metadata via admin API
      let email = null;
      let first_name = null;
      let last_name = null;
      try {
        // @ts-ignore
        const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(uid);
        if (!authErr && authUser?.user) {
          email = authUser.user.email ?? null;
          first_name = authUser.user.user_metadata?.firstName ?? null;
          last_name = authUser.user.user_metadata?.lastName ?? null;
        }
      } catch {
        // ignore
      }

      const now = new Date().toISOString();
      const insert = {
        id: uid,
        email: email ?? `user+${uid.slice(0,8)}@example.local`,
        first_name: first_name ?? 'Unknown',
        last_name: last_name ?? 'User',
        role: 'user',
        status: 'active',
        created_at: now,
      } as any;

      const { data, error } = await supabase.from('profiles').insert(insert).select('*').single();
      if (error) {
        // if conflict, skip
        continue;
      }
      created.push(data);
    }

    return NextResponse.json({ created }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
