import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      // Return mock profile for development without Supabase
      return NextResponse.json({
        profile: {
          id: 'local-profile-1',
          user_id: userId,
          profile_type: 'balanced',
          win_rate: 45,
          loss_rate: 55,
          min_profit: 10,
          max_loss: 50,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/trading_profiles?user_id=eq.${userId}`, {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) {
      console.error('Unable to load trading profile:', await response.text());
      return NextResponse.json({ profile: null, unavailable: true });
    }

    const profiles = await response.json();
    const profile = profiles.length > 0 ? profiles[0] : null;

    return NextResponse.json({ profile });
  } catch (error) {
    if (!(error instanceof Error && error.name === 'TimeoutError')) {
      console.error('Failed to fetch trading profile:', error);
    }
    return NextResponse.json({ profile: null, unavailable: true });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const body = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const profileType = body.profileType;
    const winRate = Number(body.winRate);
    const lossRate = Number(body.lossRate);
    const minProfit = Number(body.minProfit);
    const maxLoss = Number(body.maxLoss);
    if (
      !['conservative', 'balanced', 'aggressive'].includes(profileType) ||
      ![winRate, lossRate, minProfit, maxLoss].every(Number.isFinite) ||
      winRate < 0 || winRate > 100 ||
      lossRate < 0 || lossRate > 100 ||
      Math.round((winRate + lossRate) * 100) / 100 !== 100 ||
      minProfit < 0 || minProfit > 1000 ||
      maxLoss < 0 || maxLoss > 1000
    ) {
      return NextResponse.json({ error: 'Invalid trading profile values.' }, { status: 400 });
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      // Return updated mock profile for development
      return NextResponse.json({
        profile: {
          id: body.id || 'local-profile-1',
          user_id: userId,
          profile_type: body.profileType || 'balanced',
          win_rate: body.winRate ?? 45,
          loss_rate: body.lossRate ?? 55,
          min_profit: body.minProfit ?? 10,
          max_loss: body.maxLoss ?? 50,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    }

    const updateData = {
      profile_type: body.profileType,
      win_rate: winRate,
      loss_rate: lossRate,
      min_profit: minProfit,
      max_loss: maxLoss,
      updated_at: new Date().toISOString(),
    };

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/trading_profiles?on_conflict=user_id`,
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ user_id: userId, ...updateData }),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    const updated = await response.json();
    const profile = Array.isArray(updated) ? updated[0] : updated;

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Failed to update trading profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
