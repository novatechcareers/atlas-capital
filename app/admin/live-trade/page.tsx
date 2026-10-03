'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { ProfileGauge } from '@/components/profile-gauge';
import { getSelectedAdminUserId } from '@/lib/auth';
import { getLiveTradeSimulationVolatility, setLiveTradeSimulationVolatility } from '@/lib/live-trade';
import { getTradingProfile, syncTradingProfileFromServer } from '@/lib/trading-profile';

export default function AdminLiveTradePage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [marketVolatility, setMarketVolatility] = useState(8);
  const volatilityPresets = [
    { label: 'Calm', value: 3 },
    { label: 'Normal', value: 8 },
    { label: 'Aggressive', value: 15 },
    { label: 'Extreme', value: 24 },
  ];

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const userId = getSelectedAdminUserId();
      setSelectedUserId(userId);

      if (!userId) {
        setMarketVolatility(getLiveTradeSimulationVolatility());
        return;
      }

      const profile = await syncTradingProfileFromServer(userId, 'live');
      const serverVolatility = Number(profile?.marketVolatility);
      setMarketVolatility(Number.isFinite(serverVolatility) ? serverVolatility : getLiveTradeSimulationVolatility());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleVolatilityChange = async (value: number) => {
    const nextValue = setLiveTradeSimulationVolatility(value);
    setMarketVolatility(nextValue);

    const userId = getSelectedAdminUserId();
    if (!userId) return;

    try {
      const currentProfile = getTradingProfile(userId, 'live') ?? (await syncTradingProfileFromServer(userId, 'live')) ?? {
        id: `live-profile-${userId}`,
        userId,
        profileType: 'balanced',
        winRate: 45,
        lossRate: 55,
        minProfit: 10,
        maxLoss: 50,
        marketVolatility: nextValue,
        outcomeMode: 'market',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await fetch(`/api/live-trading-profile?userId=${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentProfile.id,
          profileType: currentProfile.profileType,
          winRate: currentProfile.winRate,
          lossRate: currentProfile.lossRate,
          minProfit: currentProfile.minProfit,
          maxLoss: currentProfile.maxLoss,
          marketVolatility: nextValue,
          outcomeMode: currentProfile.outcomeMode ?? 'market',
        }),
      });
    } catch {
      // Ignore persistence failures here; local state remains active for demo use.
    }
  };

  return (
    <AdminShell title="Live Trade" subtitle="Configure live-trade profit and loss settings independently from auto trade.">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--surface-elevated)] p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Market volatility</p>
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="text-sm text-[color:var(--text-secondary)]">Range</span>
            <span className="rounded-full border border-[color:var(--primary-gold)]/40 bg-[color:var(--bg-dark-navy)] px-3 py-1 text-sm font-semibold text-[color:var(--primary-gold)]">{marketVolatility.toFixed(1)}x</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {volatilityPresets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleVolatilityChange(preset.value)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  Math.abs(marketVolatility - preset.value) < 0.1
                    ? 'border-[color:var(--primary-gold)] bg-[color:var(--primary-gold)] text-[color:var(--bg-dark-navy)]'
                    : 'border-[color:var(--border-soft)] text-[color:var(--text-secondary)] hover:border-[color:var(--primary-gold)]'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="1"
            max="30"
            step="0.5"
            value={marketVolatility}
            onChange={(event) => handleVolatilityChange(Number(event.target.value))}
            className="mt-4 w-full"
            aria-label="Live market volatility range"
          />
          <p className="mt-3 text-sm text-[color:var(--text-secondary)]">
            Increase this to make the demo market swing more aggressively. Lower values keep the price calmer and more stable.
          </p>
        </div>

        {!selectedUserId ? (
          <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-6 text-sm text-[color:var(--text-secondary)]">
            Select an account to manage its live-trade outcomes.
          </div>
        ) : (
          <ProfileGauge key={selectedUserId} userId={selectedUserId} editable scope="live" />
        )}
      </div>
    </AdminShell>
  );
}