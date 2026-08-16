import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured for live trade.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [{ data: positionData, error: positionError }, { data: historyData, error: historyError }] = await Promise.all([
      supabase
        .from('live_trade_positions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('live_trade_history')
        .select('*')
        .eq('user_id', userId)
        .order('closed_at', { ascending: false })
        .limit(30),
    ]);

    if (positionError) {
      return NextResponse.json({ error: positionError.message }, { status: 500 });
    }

    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 500 });
    }

    return NextResponse.json({
      position: positionData ? {
        side: positionData.side,
        entryPrice: Number(positionData.entry_price),
        currentPrice: Number(positionData.current_price),
        amount: Number(positionData.amount),
        leverage: Number(positionData.leverage),
        openedAt: new Date(positionData.opened_at).getTime(),
        closeAt: positionData.closed_at ? new Date(positionData.closed_at).getTime() : undefined,
        pnl: Number(positionData.pnl),
      } : null,
      history: (historyData ?? []).map((entry: any) => ({
        id: entry.id,
        side: entry.side,
        amount: Number(entry.amount),
        leverage: Number(entry.leverage),
        entryPrice: Number(entry.entry_price),
        exitPrice: Number(entry.exit_price),
        pnl: Number(entry.pnl),
        openedAt: new Date(entry.opened_at).getTime(),
        closedAt: new Date(entry.closed_at).getTime(),
        status: entry.status,
      })),
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to load live trade data.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, type, position, history } = body || {};

    if (!userId || !type) {
      return NextResponse.json({ error: 'userId and type are required.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Database not configured for live trade.' }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (type === 'position' && position) {
      const { data, error } = await supabase
        .from('live_trade_positions')
        .upsert({
          user_id: userId,
          side: position.side,
          entry_price: Number(position.entryPrice),
          current_price: Number(position.currentPrice),
          amount: Number(position.amount),
          leverage: Number(position.leverage),
          pnl: Number(position.pnl ?? 0),
          opened_at: new Date(position.openedAt).toISOString(),
          closed_at: position.closeAt ? new Date(position.closeAt).toISOString() : null,
          status: position.closeAt ? 'Closed' : 'Open',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .select('*')
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ position: data ? {
        side: data.side,
        entryPrice: Number(data.entry_price),
        currentPrice: Number(data.current_price),
        amount: Number(data.amount),
        leverage: Number(data.leverage),
        openedAt: new Date(data.opened_at).getTime(),
        closeAt: data.closed_at ? new Date(data.closed_at).getTime() : undefined,
        pnl: Number(data.pnl),
      } : null }, { status: 200 });
    }

    if (type === 'history' && Array.isArray(history)) {
      const rows = history.map((entry: any) => ({
        user_id: userId,
        side: entry.side,
        amount: Number(entry.amount),
        leverage: Number(entry.leverage),
        entry_price: Number(entry.entryPrice),
        exit_price: Number(entry.exitPrice),
        pnl: Number(entry.pnl),
        opened_at: new Date(entry.openedAt).toISOString(),
        closed_at: new Date(entry.closedAt).toISOString(),
        status: entry.status ?? 'Closed',
      }));

      const { data, error } = await supabase
        .from('live_trade_history')
        .upsert(rows, { onConflict: 'id' })
        .select('*');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ history: data ?? [] }, { status: 200 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unable to save live trade data.' }, { status: 500 });
  }
}
