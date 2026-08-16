import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? 'admin@atlascapital.com';
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'Admin@123!';

    if (normalizedEmail === String(adminEmail).trim().toLowerCase() && String(password) === adminPassword) {
      return NextResponse.json({
        id: 'admin-system',
        email: adminEmail,
        name: 'Atlas Admin',
        role: 'admin',
        isAdmin: true,
      });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // @ts-ignore
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error || !data?.user) {
      return NextResponse.json({ error: error?.message || 'Invalid credentials.' }, { status: 401 });
    }

    const user = data.user;
    let profileRole: 'user' | 'admin' = 'user';
    let userName = user.user_metadata?.firstName && user.user_metadata?.lastName
      ? `${user.user_metadata.firstName} ${user.user_metadata.lastName}`
      : (user.email as string) ?? 'User';

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, first_name, last_name')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileError && profileData) {
        profileRole = profileData.role === 'admin' ? 'admin' : 'user';
        const firstName = profileData.first_name ?? '';
        const lastName = profileData.last_name ?? '';
        const profileName = [firstName, lastName].filter(Boolean).join(' ').trim();
        if (profileName) {
          userName = profileName;
        }
      }
    } catch {
      profileRole = 'user';
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: userName,
      role: profileRole,
      isAdmin: profileRole === 'admin',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
