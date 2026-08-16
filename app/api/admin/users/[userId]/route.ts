import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(_: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase admin configuration is missing.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: data.id,
        firstName: data.first_name ?? '',
        lastName: data.last_name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        country: data.country ?? '',
        passwordHash: data.password_hash ?? '',
        role: data.role ?? 'user',
        status: data.status ?? 'pending',
        createdAt: data.created_at ?? new Date().toISOString(),
      },
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load user.' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const body = await req.json();
    const nextStatus = body?.status;

    if (!['active', 'pending', 'suspended'].includes(nextStatus)) {
      return NextResponse.json({ error: 'Invalid status value.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase admin configuration is missing.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from('profiles')
      .update({ status: nextStatus })
      .eq('id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: data.id,
        firstName: data.first_name ?? '',
        lastName: data.last_name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        country: data.country ?? '',
        passwordHash: data.password_hash ?? '',
        role: data.role ?? 'user',
        status: data.status ?? 'pending',
        createdAt: data.created_at ?? new Date().toISOString(),
      },
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to update user.' }, { status: 500 });
  }
}
