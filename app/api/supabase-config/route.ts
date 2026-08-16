import { NextResponse } from 'next/server';

export async function GET() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const loginReady = Boolean(SUPABASE_URL && ANON_KEY);
  const registrationReady = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

  if (!loginReady) {
    return NextResponse.json(
      {
        ok: false,
        loginReady: false,
        registrationReady: false,
        missingSupabaseUrl: !SUPABASE_URL,
        missingAnonKey: !ANON_KEY,
        missingServiceRoleKey: !SERVICE_ROLE_KEY,
        message: !SUPABASE_URL
          ? 'Missing NEXT_PUBLIC_SUPABASE_URL environment variable.'
          : 'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.',
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      loginReady: true,
      registrationReady,
      missingSupabaseUrl: !SUPABASE_URL,
      missingAnonKey: !ANON_KEY,
      missingServiceRoleKey: !SERVICE_ROLE_KEY,
      message: registrationReady
        ? 'Supabase is configured for database-backed authentication and registration.'
        : 'Supabase is configured for login, but registration requires the service role key.',
    },
    { status: 200 },
  );
}
