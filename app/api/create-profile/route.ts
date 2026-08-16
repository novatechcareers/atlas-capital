import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, firstName, lastName, phone, country, email, password, role = 'user', status = 'active' } = body || {};

    if (!id || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields: id, firstName, lastName' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: 'Supabase service key or URL not configured on server' }, { status: 500 });
    }

    const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/profiles`;

    const password_hash = password ? crypto.createHash('sha256').update(password).digest('hex') : undefined;

    const payloadItem: any = {
      id,
      first_name: firstName,
      last_name: lastName,
      phone,
      country,
      role,
      status,
      created_at: new Date().toISOString(),
    };

    if (email) payloadItem.email = email;
    if (password_hash) payloadItem.password_hash = password_hash;

    const payload = [payloadItem];

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: `Supabase insert failed: ${data}` }, { status: res.status });
    }

    return NextResponse.json({ ok: true, result: JSON.parse(data) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
