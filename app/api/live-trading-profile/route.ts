import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json({
        profile: {
          id: 'local-live-profile',
          user_id: userId,
          profile_type: 'balanced',
          win_rate: 45,
          loss_rate: 55,
          min_profit: 10,
          max_loss: 50,
          outcome_mode: 'market',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    }

    const response = await fetch(`${url}/rest/v1/live_trading_profiles?user_id=eq.${encodeURIComponent(userId)}&select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      console.error('Unable to load live-trade profile:', await response.text());
      return NextResponse.json({ profile: null, unavailable: true });
    }
    const rows = await response.json();
    const profile = rows[0] ?? null;
    if (profile && !('outcome_mode' in profile)) {
      profile.outcome_mode = Number(profile.win_rate) === 100
        ? 'profit'
        : Number(profile.win_rate) === 0
          ? 'loss'
          : 'market';
    }
    return NextResponse.json({ profile });
  } catch (error) {
    if (!(error instanceof Error && error.name === 'TimeoutError')) {
      console.error('Failed to fetch live-trade profile:', error);
    }
    return NextResponse.json({ profile: null, unavailable: true });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get('userId');
    const body = await request.json();
    const profileType = body.profileType;
    const winRate = Number(body.winRate);
    const lossRate = Number(body.lossRate);
    const minProfit = Number(body.minProfit);
    const maxLoss = Number(body.maxLoss);
    const outcomeMode = body.outcomeMode;

    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    if (
      !['conservative', 'balanced', 'aggressive'].includes(profileType) ||
      ![winRate, lossRate, minProfit, maxLoss].every(Number.isFinite) ||
      winRate < 0 || winRate > 100 ||
      lossRate < 0 || lossRate > 100 ||
      Math.round((winRate + lossRate) * 100) / 100 !== 100 ||
      minProfit < 0 || minProfit > 1000 ||
      maxLoss < 0 || maxLoss > 1000
      || (outcomeMode !== undefined && !['market', 'profit', 'loss'].includes(outcomeMode))
    ) {
      return NextResponse.json({ error: 'Invalid live-trade profile values.' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const now = new Date().toISOString();
    if (!url || !key) {
      return NextResponse.json({
        profile: {
          id: body.id || 'local-live-profile',
          user_id: userId,
          profile_type: profileType,
          win_rate: winRate,
          loss_rate: lossRate,
          min_profit: minProfit,
          max_loss: maxLoss,
          outcome_mode: outcomeMode ?? 'market',
          created_at: now,
          updated_at: now,
        },
      });
    }

    const endpoint = `${url}/rest/v1/live_trading_profiles?on_conflict=user_id`;
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    };
    const baseProfile = {
      user_id: userId,
      profile_type: profileType,
      win_rate: winRate,
      loss_rate: lossRate,
      min_profit: minProfit,
      max_loss: maxLoss,
      updated_at: now,
    };

    let response = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(4000),
      body: JSON.stringify({ ...baseProfile, ...(outcomeMode === undefined ? {} : { outcome_mode: outcomeMode }) }),
    });

    if (!response.ok) {
      const databaseError = await response.text();
      const outcomeColumnMissing = outcomeMode !== undefined &&
        databaseError.includes('outcome_mode') &&
        (databaseError.toLowerCase().includes('column') || databaseError.includes('PGRST204'));

      if (!outcomeColumnMissing) {
        console.error('Failed to update live-trade profile:', databaseError);
        const migrationRequired = databaseError.includes('live_trading_profiles') &&
          /does not exist|schema cache|could not find/i.test(databaseError);
        return NextResponse.json({
          error: migrationRequired ? 'Apply database migration 010 to create live_trading_profiles.' : 'Failed to update live-trade profile.',
          detail: databaseError.slice(0, 300),
        }, { status: migrationRequired ? 503 : 500 });
      }

      const fallbackWinRate = outcomeMode === 'profit' ? 100 : outcomeMode === 'loss' ? 0 : winRate;
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(4000),
        body: JSON.stringify({
          ...baseProfile,
          win_rate: fallbackWinRate,
          loss_rate: 100 - fallbackWinRate,
        }),
      });
      if (!response.ok) {
        const fallbackError = await response.text();
        console.error('Failed to save live-trade outcome fallback:', fallbackError);
        const migrationRequired = fallbackError.includes('live_trading_profiles');
        return NextResponse.json({
          error: migrationRequired ? 'Apply database migration 010 to create live_trading_profiles.' : 'Failed to save live-trade outcome.',
          detail: fallbackError.slice(0, 300),
        }, { status: 500 });
      }
    }

    const rows = await response.json();
    const profile = Array.isArray(rows) ? rows[0] : rows;
    if (profile && outcomeMode !== undefined) profile.outcome_mode = outcomeMode;
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Live-trade settings database timed out. Please retry.' }, { status: 503 });
    }
    console.error('Failed to update live-trade profile:', error);
    return NextResponse.json({ error: 'Failed to update live-trade profile.' }, { status: 500 });
  }
}