import { getCurrentAccountId, getUserStorageKey } from './auth';
import { setLiveTradeSimulationVolatility } from './live-trade';

export type ProfileType = 'conservative' | 'balanced' | 'aggressive';
export type TradingProfileScope = 'auto' | 'live';
export type LiveTradeOutcomeMode = 'market' | 'profit' | 'loss';

export type TradingProfile = {
  id: string;
  userId: string;
  profileType: ProfileType;
  winRate: number; // 0-100
  lossRate: number; // 0-100
  minProfit: number;
  maxLoss: number;
  marketVolatility?: number;
  outcomeMode?: LiveTradeOutcomeMode;
  createdAt: number;
  updatedAt: number;
};

export const TRADING_PROFILE_STORAGE_KEY = 'atlas-trading-profile';
export const TRADING_PROFILE_CHANNEL = 'atlas-trading-profile';

function getProfileStorageKey(scope: TradingProfileScope) {
  return scope === 'live' ? 'atlas-live-trading-profile' : TRADING_PROFILE_STORAGE_KEY;
}

function getProfileChannel(scope: TradingProfileScope) {
  return scope === 'live' ? 'atlas-live-trading-profile' : TRADING_PROFILE_CHANNEL;
}

function getProfileEndpoint(scope: TradingProfileScope) {
  return scope === 'live' ? '/api/live-trading-profile' : '/api/trading-profile';
}

// Default profiles with 55/45 loss/profit ratio
export const DEFAULT_PROFILES: Record<ProfileType, Omit<TradingProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> = {
  conservative: {
    profileType: 'conservative',
    winRate: 45, // 45% wins
    lossRate: 55, // 55% losses
    minProfit: 5,
    maxLoss: 30,
    marketVolatility: 3,
  },
  balanced: {
    profileType: 'balanced',
    winRate: 45,
    lossRate: 55,
    minProfit: 10,
    maxLoss: 50,
    marketVolatility: 8,
  },
  aggressive: {
    profileType: 'aggressive',
    winRate: 45,
    lossRate: 55,
    minProfit: 20,
    maxLoss: 100,
    marketVolatility: 15,
  },
};

export function getTradingProfile(userId?: string | null, scope: TradingProfileScope = 'auto'): TradingProfile | null {
  if (typeof window === 'undefined') return null;

  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(getProfileStorageKey(scope), resolvedUserId);
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as TradingProfile;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function saveTradingProfile(profile: TradingProfile, userId?: string | null, scope: TradingProfileScope = 'auto'): TradingProfile {
  if (typeof window === 'undefined') return profile;

  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(getProfileStorageKey(scope), resolvedUserId);
  window.localStorage.setItem(storageKey, JSON.stringify(profile));
  
  const channel = new BroadcastChannel(getProfileChannel(scope));
  channel.postMessage({ type: 'profile-updated', profile, userId: resolvedUserId });
  channel.close();

  return profile;
}

export function subscribeToTradingProfile(
  callback: (profile: TradingProfile | null) => void,
  userId?: string | null,
  scope: TradingProfileScope = 'auto'
): () => void {
  if (typeof window === 'undefined') return () => {};

  const resolvedUserId = userId ?? getCurrentAccountId();
  const channel = new BroadcastChannel(getProfileChannel(scope));

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'profile-updated' && event.data?.userId === resolvedUserId) {
      callback(event.data?.profile ?? null);
    }
  };

  channel.addEventListener('message', handleMessage);
  return () => {
    channel.removeEventListener('message', handleMessage);
    channel.close();
  };
}

export async function syncTradingProfileFromServer(userId?: string | null, scope: TradingProfileScope = 'auto'): Promise<TradingProfile | null> {
  if (typeof window === 'undefined') return null;

  const resolvedUserId = userId ?? getCurrentAccountId();
  if (!resolvedUserId) return null;

  try {
    const response = await fetch(`${getProfileEndpoint(scope)}?userId=${encodeURIComponent(resolvedUserId)}`);
    if (!response.ok) return null;

    const data = await response.json();
    const serverProfile = data?.profile;

    if (!serverProfile) {
      if (data?.unavailable) return getTradingProfile(resolvedUserId, scope);
      const storageKey = getUserStorageKey(getProfileStorageKey(scope), resolvedUserId);
      window.localStorage.removeItem(storageKey);
      return null;
    }

    const normalized: TradingProfile = {
      id: serverProfile.id,
      userId: serverProfile.user_id,
      profileType: serverProfile.profile_type,
      winRate: Number(serverProfile.win_rate),
      lossRate: Number(serverProfile.loss_rate),
      minProfit: Number(serverProfile.min_profit),
      maxLoss: Number(serverProfile.max_loss),
      marketVolatility: Number.isFinite(Number(serverProfile.market_volatility)) ? Number(serverProfile.market_volatility) : 8,
      outcomeMode: serverProfile.outcome_mode === 'profit' || serverProfile.outcome_mode === 'loss' ? serverProfile.outcome_mode : 'market',
      createdAt: new Date(serverProfile.created_at).getTime(),
      updatedAt: new Date(serverProfile.updated_at).getTime(),
    };

    saveTradingProfile(normalized, resolvedUserId, scope);
    if (scope === 'live') setLiveTradeSimulationVolatility(Number.isFinite(Number(normalized.marketVolatility)) ? Number(normalized.marketVolatility) : 8);
    return normalized;
  } catch {
    return null;
  }
}

// Calculate trade result based on profile
export function calculateTradeResult(profile: TradingProfile): number {
  const isWin = Math.random() * 100 < profile.winRate;
  
  if (isWin) {
    // Random profit between 0.1 and maxProfit
    return Math.round((Math.random() * profile.minProfit + 0.1) * 100) / 100;
  } else {
    // Random loss between -maxLoss and -0.1
    return Math.round((Math.random() * -profile.maxLoss - 0.1) * 100) / 100;
  }
}

export function calculateProfileClosePnl(grossPnl: number, profile: TradingProfile | null): number {
  const roundedGrossPnl = Math.round(grossPnl * 100) / 100;
  if (!Number.isFinite(roundedGrossPnl) || roundedGrossPnl === 0) return 0;
  if (!profile) return Math.round(grossPnl * 100) / 100;

  const limit = roundedGrossPnl > 0 ? profile.minProfit : profile.maxLoss;
  const adjusted = Math.min(Math.abs(roundedGrossPnl), Math.max(0, limit));
  return Math.sign(roundedGrossPnl) * Math.round(adjusted * 100) / 100;
}

// Get default profile for new users
export function getDefaultProfile(userId: string, profileType: ProfileType = 'balanced'): TradingProfile {
  const defaults = DEFAULT_PROFILES[profileType];
  return {
    id: `profile-${userId}-${Date.now()}`,
    userId,
    ...defaults,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
