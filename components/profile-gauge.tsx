'use client';

import { useEffect, useState } from 'react';
import type { TradingProfile, ProfileType, TradingProfileScope } from '@/lib/trading-profile';
import { getTradingProfile, saveTradingProfile, DEFAULT_PROFILES, syncTradingProfileFromServer, getDefaultProfile } from '@/lib/trading-profile';

interface ProfileGaugeProps {
  userId: string | null;
  onProfileChange?: (profile: TradingProfile) => void;
  editable?: boolean;
  scope?: TradingProfileScope;
}

export function ProfileGauge({ userId, onProfileChange, editable = false, scope = 'auto' }: ProfileGaugeProps) {
  const [profile, setProfile] = useState<TradingProfile | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [outcomeError, setOutcomeError] = useState('');

  useEffect(() => {
    if (!userId) return;
    const stored = getTradingProfile(userId, scope) ?? getDefaultProfile(userId);
    setProfile(stored);
    void syncTradingProfileFromServer(userId, scope).then((latest) => {
      if (latest) setProfile(latest);
    });
  }, [userId, scope]);

  const handleProfileTypeChange = async (newType: ProfileType) => {
    if (!userId || !profile || isUpdating) return;
    setIsUpdating(true);

    try {
      const defaults = DEFAULT_PROFILES[newType];
      const updated: TradingProfile = {
        ...profile,
        ...defaults,
        updatedAt: Date.now(),
      };

      // Update in database
      const endpoint = scope === 'live' ? '/api/live-trading-profile' : '/api/trading-profile';
      const response = await fetch(`${endpoint}?userId=${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: profile.id,
          profileType: newType,
          winRate: defaults.winRate,
          lossRate: defaults.lossRate,
          minProfit: defaults.minProfit,
          maxLoss: defaults.maxLoss,
        }),
      });
      if (!response.ok) throw new Error('Unable to save trading profile.');

      setProfile(updated);
      saveTradingProfile(updated, userId, scope);
      onProfileChange?.(updated);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleValueChange = async (field: keyof Pick<TradingProfile, 'winRate' | 'lossRate' | 'minProfit' | 'maxLoss'>, value: number) => {
    if (!userId || !profile || isUpdating) return;
    setIsUpdating(true);

    try {
      const nextWinRate = field === 'winRate' ? Math.min(100, Math.max(0, value)) : profile.winRate;
      const nextLossRate = field === 'lossRate' ? Math.min(100, Math.max(0, value)) : profile.lossRate;
      const updated: TradingProfile = {
        ...profile,
        [field]: value,
        winRate: field === 'winRate' ? nextWinRate : 100 - nextLossRate,
        lossRate: field === 'lossRate' ? nextLossRate : 100 - nextWinRate,
        minProfit: field === 'minProfit' ? Math.min(1000, Math.max(0, value)) : profile.minProfit,
        maxLoss: field === 'maxLoss' ? Math.min(1000, Math.max(0, value)) : profile.maxLoss,
        updatedAt: Date.now(),
      };

      const endpoint = scope === 'live' ? '/api/live-trading-profile' : '/api/trading-profile';
      const response = await fetch(`${endpoint}?userId=${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: profile.id,
          profileType: profile.profileType,
          winRate: updated.winRate,
          lossRate: updated.lossRate,
          minProfit: updated.minProfit,
          maxLoss: updated.maxLoss,
        }),
      });
      if (!response.ok) throw new Error('Unable to save trading profile value.');

      setProfile(updated);
      saveTradingProfile(updated, userId, scope);
      onProfileChange?.(updated);
    } catch (err) {
      console.error('Failed to update value:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLiveOutcomeChange = async (outcomeMode: 'profit' | 'loss') => {
    if (!userId || !profile || isUpdating) return;
    setIsUpdating(true);
    setOutcomeError('');

    try {
      const updated: TradingProfile = { ...profile, outcomeMode, updatedAt: Date.now() };
      const response = await fetch(`/api/live-trading-profile?userId=${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: profile.id,
          profileType: profile.profileType,
          winRate: profile.winRate,
          lossRate: profile.lossRate,
          minProfit: profile.minProfit,
          maxLoss: profile.maxLoss,
          outcomeMode,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || 'Unable to update live-trade outcome.');
      }

      setProfile(updated);
      saveTradingProfile(updated, userId, 'live');
      onProfileChange?.(updated);
    } catch (error) {
      console.error('Failed to update live-trade outcome:', error);
      setOutcomeError(error instanceof Error ? error.message : 'Unable to update live-trade outcome.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!profile) return null;

  const winPercentage = profile.winRate;
  const lossPercentage = profile.lossRate;

  return (
    <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--surface-elevated)] p-6">
      <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{scope === 'live' ? 'Live Trade Outcome Controls' : 'Auto-Trade Outcome Controls'}</p>
      {editable ? <p className="mt-2 text-sm text-[color:var(--text-secondary)]">These settings apply only to {scope === 'live' ? 'live trade' : 'auto trade'} for the selected account.</p> : null}
      
      {/* Profile Type Selector */}
      {editable && scope !== 'live' && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowAdjustments((visible) => !visible)}
            className="rounded-lg border border-[color:var(--primary-gold)]/50 px-3 py-2 text-sm font-semibold text-[color:var(--primary-gold)]"
          >
            {showAdjustments ? 'Hide adjustments' : 'Adjust profit and loss'}
          </button>
        {showAdjustments && <div className="mt-3 flex gap-2">
          {(Object.keys(DEFAULT_PROFILES) as ProfileType[]).map((type) => (
            <button
              key={type}
              onClick={() => handleProfileTypeChange(type)}
              disabled={isUpdating}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                profile.profileType === type
                  ? 'bg-[color:var(--primary-gold)] text-[color:var(--bg-dark-navy)]'
                  : 'border border-[color:var(--border-soft)] text-[color:var(--text-secondary)] hover:border-[color:var(--primary-gold)]'
              } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {scope === 'live' ? (
          <>
            <p className="text-sm text-[color:var(--text-secondary)]">Choose the result direction. The amount is calculated from trade amount × leverage × actual BTC/USD percentage movement × 10. The displayed price is not adjusted.</p>
            {editable ? <div className="grid grid-cols-2 gap-3">
              {(['profit', 'loss'] as const).map((outcome) => (
                <button
                  key={outcome}
                  type="button"
                  onClick={() => void handleLiveOutcomeChange(outcome)}
                  disabled={isUpdating}
                  aria-pressed={(profile.outcomeMode ?? 'market') === outcome}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold capitalize transition disabled:cursor-wait disabled:opacity-60 ${(profile.outcomeMode ?? 'market') === outcome ? outcome === 'profit' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-slate-950' : 'border border-[color:var(--border-soft)] text-[color:var(--text-secondary)] hover:border-[color:var(--primary-gold)]'}`}
                >
                  {outcome === 'profit' ? 'Profit' : 'Loss'}
                </button>
              ))}
            </div> : <p className="font-semibold capitalize text-[color:var(--text-primary)]">{profile.outcomeMode ?? 'market'}</p>}
            {outcomeError ? <p role="alert" className="text-sm text-rose-300">{outcomeError}</p> : null}
          </>
        ) : null}

        {/* Win/Loss Gauge */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[color:var(--text-secondary)]">Win Rate</span>
            <span className="text-[color:var(--primary-gold)]">{winPercentage.toFixed(2)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${winPercentage}%` }}
            />
          </div>
          {editable && (
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={winPercentage}
              onChange={(e) => handleValueChange('winRate', Number(e.target.value))}
              disabled={isUpdating}
              className="w-full mt-2"
            />
          )}
        </div>

        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[color:var(--text-secondary)]">Loss Rate</span>
            <span className="text-red-400">{lossPercentage.toFixed(2)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-300"
              style={{ width: `${lossPercentage}%` }}
            />
          </div>
          {editable && (
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={lossPercentage}
              onChange={(e) => handleValueChange('lossRate', Number(e.target.value))}
              disabled={isUpdating}
              className="w-full mt-2"
            />
          )}
        </div>

        {editable && scope !== 'live' && (
          <>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[color:var(--text-secondary)]">Min Profit</span>
                <span>${profile.minProfit.toFixed(2)}</span>
              </div>
              <label className="sr-only" htmlFor={`trade-profit-cap-${scope}`}>Minimum profit</label>
              <input
                id={`trade-profit-cap-${scope}`}
                type="number"
                min="0"
                max="1000"
                step="5"
                value={profile.minProfit}
                onChange={(e) => handleValueChange('minProfit', Number(e.target.value))}
                disabled={isUpdating}
                className="w-full px-3 py-2 rounded-lg bg-[color:var(--bg-dark-navy)] border border-[color:var(--border-soft)] text-[color:var(--text-primary)]"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[color:var(--text-secondary)]">Max Loss</span>
                <span>${profile.maxLoss.toFixed(2)}</span>
              </div>
              <label className="sr-only" htmlFor={`trade-loss-cap-${scope}`}>Maximum loss</label>
              <input
                id={`trade-loss-cap-${scope}`}
                type="number"
                min="0"
                max="1000"
                step="5"
                value={profile.maxLoss}
                onChange={(e) => handleValueChange('maxLoss', Number(e.target.value))}
                disabled={isUpdating}
                className="w-full px-3 py-2 rounded-lg bg-[color:var(--bg-dark-navy)] border border-[color:var(--border-soft)] text-[color:var(--text-primary)]"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
