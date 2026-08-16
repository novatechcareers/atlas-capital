import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return null;
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured for verification.' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const requests = (data ?? []).map((r: any) => ({ ...r, fileDataUrl: r.file_data_url ?? r.fileDataUrl ?? '' }));
    return NextResponse.json({ request: requests[0] ?? null, requests }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load verification request.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, type, fileName, fileType, fileDataUrl, status = 'Pending', reason } = body || {};

    if (!userId || !type || !fileName || !fileDataUrl) {
      return NextResponse.json({ error: 'Missing verification fields.' }, { status: 400 });
    }

    const supabase = getServiceClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured for verification.' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('verification_requests')
      .insert({
        user_id: userId,
        document_type: type,
        file_name: fileName,
        file_type: fileType ?? 'application/octet-stream',
        file_data_url: fileDataUrl,
        status,
        reason: reason ?? null,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = data ? { ...data, fileDataUrl: data.file_data_url ?? data.fileDataUrl ?? '' } : null;
    return NextResponse.json({ request: mapped }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to create verification request.' }, { status: 500 });
  }
}
