import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured for withdrawals.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let query = supabase.from('withdrawal_requests').select('id,user_id,amount,currency,method,wallet_address,bank_account,status,note,created_at,updated_at').order('created_at', { ascending: false });
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const userIds = Array.from(new Set((data ?? []).map((item: any) => item.user_id).filter(Boolean)));
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id,first_name,last_name,email').in('id', userIds)
      : { data: [] };
    const profileMap = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
    const withdrawals = (data ?? []).map((item: any) => {
      const profile = profileMap.get(item.user_id);
      return {
        ...item,
        user_name: profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || profile.email : 'Unknown user',
      };
    });

    return NextResponse.json({ withdrawals }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load withdrawal requests.' }, { status: 500 });
  }
}
