import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { firstName, lastName, email, password, phone, country } = body || {};

    if (!firstName || !lastName || !email || !password || !phone || !country) {
      return NextResponse.json({ error: 'Missing required registration fields.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error:
            'Supabase registration requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Profile linking is not possible without the service role key.',
        },
        { status: 500 },
      );
    }

    const trimmedUrl = SUPABASE_URL.replace(/\/+$/, '');
    let userData: any;
    let userId: string | null = null;
    let profileData: any = null;
    let profileCreated = false;
    let profileError: string | null = null;

    const createUserRes = await fetch(`${trimmedUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { firstName, lastName, phone, country },
      }),
    });

    userData = await createUserRes.json();
    if (!createUserRes.ok) {
      return NextResponse.json({ error: userData?.message || JSON.stringify(userData) }, { status: createUserRes.status });
    }

    userId = userData?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unable to create Supabase user.' }, { status: 500 });
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    const profileRes = await fetch(`${trimmedUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify([
        {
          id: userId,
          first_name: firstName,
          last_name: lastName,
          phone,
          country,
          email,
          password_hash: passwordHash,
          role: 'user',
          status: 'pending',
        },
      ]),
    });

    const profileBody = await profileRes.json();
    if (!profileRes.ok) {
      profileError = profileBody?.message || profileBody?.error || JSON.stringify(profileBody);
    } else {
      profileCreated = true;
      profileData = profileBody;
    }

    return NextResponse.json({
      id: userId,
      email,
      firstName,
      lastName,
      phone,
      country,
      profileCreated,
      profileError,
      profile: profileData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
