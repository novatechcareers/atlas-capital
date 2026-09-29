import { getCurrentAccountId, getUserStorageKey } from './auth.ts';

export type LiveTradeSide = 'Long' | 'Short';
export type LiveTradeOutcomeMode = 'market' | 'profit' | 'loss';
export const LIVE_TRADE_PAYOUT_MULTIPLIER = 10;

export type LiveTradePosition = {
  side: LiveTradeSide;
  entryPrice: number;
  currentPrice: number;
  amount: number;
  leverage: number;
  openedAt: number;
  closeAt?: number;
  stakeReserved?: boolean;
  pnl: number;
  resultMode?: LiveTradeOutcomeMode;
};

export type LiveTradeHistoryEntry = {
  id: string;
  side: LiveTradeSide;
  amount: number;
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  openedAt: number;
  closedAt: number;
  status: 'Closed' | 'Open';
};

function createHistoryId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function normalizeHistoryEntry(entry: LiveTradeHistoryEntry): LiveTradeHistoryEntry {
  return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(entry.id)
    ? entry
    : { ...entry, id: createHistoryId() };
}

export function resolveLiveTradeOutcomeMode(
  profile: { outcomeMode?: LiveTradeOutcomeMode; winRate?: number; lossRate?: number } | null | undefined,
  fallbackMode: LiveTradeOutcomeMode = 'market',
  randomSource: () => number = Math.random,
): LiveTradeOutcomeMode {
  if (profile?.outcomeMode && profile.outcomeMode !== 'market') return profile.outcomeMode;
  if (fallbackMode && fallbackMode !== 'market') return fallbackMode;

  const winRate = Number(profile?.winRate);
  const lossRate = Number(profile?.lossRate);
  if (!Number.isFinite(winRate) || !Number.isFinite(lossRate)) return fallbackMode;

  const totalWeight = Math.max(0, winRate + lossRate);
  if (totalWeight <= 0) return fallbackMode;

  const roll = randomSource() * totalWeight;
  return roll < winRate ? 'profit' : 'loss';
}

export function calculateLiveTradePnl(position: LiveTradePosition, price: number, outcomeMode: LiveTradeOutcomeMode = 'market') {
  if (!Number.isFinite(price) || !Number.isFinite(position.entryPrice) || position.entryPrice <= 0) return 0;
  const diff = position.side === 'Long' ? price - position.entryPrice : position.entryPrice - price;
  const rawPnl = (diff / position.entryPrice) * position.amount * position.leverage * LIVE_TRADE_PAYOUT_MULTIPLIER;
  const directedPnl = outcomeMode === 'profit'
    ? Math.abs(rawPnl)
    : outcomeMode === 'loss'
      ? -Math.abs(rawPnl)
      : rawPnl;
  const roundedPnl = Math.round(directedPnl * 100) / 100;
  const stake = Number.isFinite(position.amount) && position.amount > 0 ? position.amount : 0;
  return Math.max(-stake, roundedPnl);
}

export function calculateLiveTradeSettlementAmount(position: LiveTradePosition, pnl: number) {
  const reservedStake = position.stakeReserved ? Math.max(0, position.amount) : 0;
  return reservedStake + pnl;
}

export const LIVE_TRADE_HISTORY_KEY = 'atlas-live-trade-history';
export const LIVE_TRADE_HISTORY_CHANNEL = 'atlas-live-trade-history';
export const LIVE_TRADE_PRICE_KEY = 'atlas-live-trade-price';
export const LIVE_TRADE_PRICE_UPDATED_KEY = 'atlas-live-trade-price-updated';
export const LIVE_TRADE_PRICE_ERROR_KEY = 'atlas-live-trade-price-error';
export const LIVE_TRADE_PRICE_CHANNEL = 'atlas-live-trade-price';
export const LIVE_TRADE_POSITION_KEY = 'atlas-live-trade-position';
export const LIVE_TRADE_POSITION_CHANNEL = 'atlas-live-trade-position';
export const LIVE_TRADE_SIMULATION_VOLATILITY_KEY = 'atlas-live-trade-simulation-volatility';
const LIVE_TRADE_SETTLEMENT_KEY = 'atlas-live-trade-settlement';

export function claimLiveTradeSettlement(openedAt: number, userId?: string | null) {
  if (typeof window === 'undefined') return false;
  const resolvedUserId = userId ?? getCurrentAccountId();
  const key = getUserStorageKey(LIVE_TRADE_SETTLEMENT_KEY, resolvedUserId);
  try {
    const existing = JSON.parse(window.localStorage.getItem(key) ?? 'null') as { openedAt?: number; claimedAt?: number } | null;
    if (existing && Date.now() - Number(existing.claimedAt) < 30_000) return false;
    window.localStorage.setItem(key, JSON.stringify({ openedAt, claimedAt: Date.now() }));
    return true;
  } catch {
    window.localStorage.setItem(key, JSON.stringify({ openedAt, claimedAt: Date.now() }));
    return true;
  }
}

export function releaseLiveTradeSettlement(openedAt: number, userId?: string | null) {
  if (typeof window === 'undefined') return;
  const key = getUserStorageKey(LIVE_TRADE_SETTLEMENT_KEY, userId ?? getCurrentAccountId());
  try {
    const existing = JSON.parse(window.localStorage.getItem(key) ?? 'null') as { openedAt?: number } | null;
    if (existing?.openedAt === openedAt) window.localStorage.removeItem(key);
  } catch {
    window.localStorage.removeItem(key);
  }
}

export function getLiveTradePrice() {
  if (typeof window === 'undefined') return 0;

  const stored = window.localStorage.getItem(LIVE_TRADE_PRICE_KEY);
  const parsed = Number(stored);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function getLiveTradePriceUpdatedAt() {
  if (typeof window === 'undefined') return 0;
  const updatedAt = Number(window.localStorage.getItem(LIVE_TRADE_PRICE_UPDATED_KEY));
  return Number.isFinite(updatedAt) ? updatedAt : 0;
}

export function getLiveTradePriceError() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(LIVE_TRADE_PRICE_ERROR_KEY) ?? '';
}

export function shouldRefreshMarketPrice(lastMessageAt: number, now = Date.now(), staleAfterMs = 2000): boolean {
  if (!Number.isFinite(lastMessageAt) || lastMessageAt <= 0) return true;
  return now - lastMessageAt >= staleAfterMs;
}

export function getLiveTradeSimulationVolatility(): number {
  if (typeof window === 'undefined') return 8;
  const value = Number(window.localStorage.getItem(LIVE_TRADE_SIMULATION_VOLATILITY_KEY));
  if (!Number.isFinite(value) || value <= 0) return 8;
  return Math.min(30, Math.max(1, value));
}

export function setLiveTradeSimulationVolatility(value: number): number {
  if (typeof window === 'undefined') return 8;
  const normalized = Math.min(30, Math.max(1, Number.isFinite(value) ? value : 8));
  window.localStorage.setItem(LIVE_TRADE_SIMULATION_VOLATILITY_KEY, String(normalized));
  return normalized;
}

export function generateSimulatedMarketPrice(lastPrice: number, now = Date.now(), tickIndex = 0): number {
  const basePrice = Number.isFinite(lastPrice) && lastPrice > 0 ? lastPrice : 83_877.47;
  const volatility = getLiveTradeSimulationVolatility();
  const waveA = Math.sin(now / 1_200 + tickIndex * 0.6);
  const waveB = Math.cos(now / 800 + tickIndex * 1.7);
  const waveC = Math.sin(now / 5_500 + tickIndex * 2.8);
  const driftPercent = (waveA * 0.02 + waveB * 0.018 + waveC * 0.014) * volatility;
  const simulated = basePrice * (1 + driftPercent);
  return Math.round(simulated);
}

export async function fetchMarketPrice(): Promise<number> {
  if (typeof window === 'undefined') return 0;

  let serverError = 'Local quote service is unavailable.';
  try {
    const response = await fetch('/api/market-price', { cache: 'no-store' });
    const payload = await response.json();
    if (response.ok) {
      const price = Number(payload?.price ?? 0);
      if (Number.isFinite(price) && price > 0) {
        setLiveTradePriceError('');
        return Math.round(price * 100) / 100;
      }
    }
    serverError = payload?.error ?? serverError;
  } catch {
    serverError = 'Could not reach the local quote service.';
  }

  const browserProviders = [
    async () => {
      const response = await fetch('https://api.gemini.com/v1/pubticker/btcusd', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(1500),
      });
      if (!response.ok) return 0;
      const payload = await response.json();
      return Number(payload?.last ?? 0);
    },
    async () => {
      const response = await fetch('https://api.exchange.coinbase.com/products/BTC-USD/ticker', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(1500),
      });
      if (!response.ok) return 0;
      const payload = await response.json();
      return Number(payload?.price ?? 0);
    },
    async () => {
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(1500),
      });
      if (!response.ok) return 0;
      const payload = await response.json();
      return Number(payload?.price ?? 0);
    },
  ];

  const browserQuotes = await Promise.allSettled(browserProviders.map((provider) => provider()));
  const browserPrice = browserQuotes.find(
    (result): result is PromiseFulfilledResult<number> => result.status === 'fulfilled' && Number.isFinite(result.value) && result.value > 0,
  )?.value;

  if (browserPrice) {
    setLiveTradePriceError('');
    return Math.round(browserPrice * 100) / 100;
  }

  const simulatedPrice = generateSimulatedMarketPrice(getLiveTradePrice() || 83_877.47, Date.now(), 1);
  setLiveTradePriceError(`${serverError} Browser quote fallback also failed; using simulated BTC/USD movement to keep P&L honest.`);
  setLiveTradePrice(simulatedPrice);
  return Math.round(simulatedPrice * 100) / 100;
}

export function setLiveTradePriceError(error: string) {
  if (typeof window === 'undefined') return;
  if (error) window.localStorage.setItem(LIVE_TRADE_PRICE_ERROR_KEY, error);
  else window.localStorage.removeItem(LIVE_TRADE_PRICE_ERROR_KEY);
  const channel = new BroadcastChannel(LIVE_TRADE_PRICE_CHANNEL);
  channel.postMessage({ type: 'live-trade-price-updated', price: getLiveTradePrice(), updatedAt: getLiveTradePriceUpdatedAt(), error });
  channel.close();
}

export function setLiveTradePrice(value: number) {
  if (typeof window === 'undefined') return Number.isFinite(value) && value > 0 ? value : 0;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return getLiveTradePrice();
  const normalized = Math.round(parsed * 100) / 100;
  const updatedAt = Date.now();
  window.localStorage.setItem(LIVE_TRADE_PRICE_KEY, String(normalized));
  window.localStorage.setItem(LIVE_TRADE_PRICE_UPDATED_KEY, String(updatedAt));
  window.localStorage.removeItem(LIVE_TRADE_PRICE_ERROR_KEY);

  const channel = new BroadcastChannel(LIVE_TRADE_PRICE_CHANNEL);
  channel.postMessage({ type: 'live-trade-price-updated', price: normalized, updatedAt });
  channel.close();

  return normalized;
}

export function subscribeToLiveTradePrice(callback: (price: number, updatedAt: number, error: string) => void) {
  const sync = () => callback(getLiveTradePrice(), getLiveTradePriceUpdatedAt(), getLiveTradePriceError());
  sync();

  const storageHandler = (event: StorageEvent) => {
    if (!event.key || event.key === LIVE_TRADE_PRICE_KEY) sync();
  };

  const channel = new BroadcastChannel(LIVE_TRADE_PRICE_CHANNEL);
  const channelHandler = () => sync();

  window.addEventListener('storage', storageHandler);
  channel.addEventListener('message', channelHandler);

  return () => {
    window.removeEventListener('storage', storageHandler);
    channel.removeEventListener('message', channelHandler);
    channel.close();
  };
}

export function getLiveTradePosition(userId?: string | null): LiveTradePosition | null {
  if (typeof window === 'undefined') return null;

  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(LIVE_TRADE_POSITION_KEY, resolvedUserId);
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as LiveTradePosition;
    return parsed;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export async function syncLiveTradeStateFromServer(userId?: string | null) {
  if (typeof window === 'undefined') return { position: null, history: [] };

  const resolvedUserId = userId ?? getCurrentAccountId();
  if (!resolvedUserId) return { position: null, history: [] };

  try {
    const response = await fetch(`/api/live-trade?userId=${encodeURIComponent(resolvedUserId)}`);
    if (!response.ok) return { position: null, history: [] };
    const payload = await response.json();
    setLiveTradePosition(payload?.position ?? null, resolvedUserId, false);
    if (Array.isArray(payload?.history)) {
      saveLiveTradeHistory(payload.history, resolvedUserId, false);
    }
    return { position: payload?.position ?? null, history: Array.isArray(payload?.history) ? payload.history : [] };
  } catch {
    return { position: null, history: [] };
  }
}

export function setLiveTradePosition(position: LiveTradePosition | null, userId?: string | null, syncServer = true) {
  if (typeof window === 'undefined') return position;

  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(LIVE_TRADE_POSITION_KEY, resolvedUserId);
  if (!position) {
    const previousPosition = getLiveTradePosition(resolvedUserId);
    window.localStorage.removeItem(storageKey);
    const channel = new BroadcastChannel(LIVE_TRADE_POSITION_CHANNEL);
    channel.postMessage({ type: 'live-trade-position-updated', position: null, userId: resolvedUserId });
    channel.close();
    if (syncServer && resolvedUserId) {
      void fetch('/api/live-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resolvedUserId, type: 'position', position: null, openedAt: previousPosition?.openedAt }),
      }).catch(() => undefined);
    }
    return null;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(position));
  const channel = new BroadcastChannel(LIVE_TRADE_POSITION_CHANNEL);
  channel.postMessage({ type: 'live-trade-position-updated', position, userId: resolvedUserId });
  channel.close();

  if (resolvedUserId) {
    void fetch('/api/live-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resolvedUserId, type: 'position', position }),
    }).catch(() => undefined);
  }

  return position;
}

export function subscribeToLiveTradePosition(callback: (position: LiveTradePosition | null) => void, userId?: string | null) {
  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(LIVE_TRADE_POSITION_KEY, resolvedUserId);
  const sync = () => callback(getLiveTradePosition(resolvedUserId));
  sync();

  const storageHandler = (event: StorageEvent) => {
    if (event.key === storageKey) sync();
  };

  const channel = new BroadcastChannel(LIVE_TRADE_POSITION_CHANNEL);
  const channelHandler = (event: MessageEvent) => {
    if (event.data?.userId === resolvedUserId) sync();
  };

  window.addEventListener('storage', storageHandler);
  channel.addEventListener('message', channelHandler);

  return () => {
    window.removeEventListener('storage', storageHandler);
    channel.removeEventListener('message', channelHandler);
    channel.close();
  };
}

export function getLiveTradeHistory(userId?: string | null): LiveTradeHistoryEntry[] {
  if (typeof window === 'undefined') return [];

  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(LIVE_TRADE_HISTORY_KEY, resolvedUserId);
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as LiveTradeHistoryEntry[];
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
}

export function saveLiveTradeHistory(history: LiveTradeHistoryEntry[], userId?: string | null, syncServer = true) {
  if (typeof window === 'undefined') return history;

  const resolvedUserId = userId ?? getCurrentAccountId();
  const normalizedHistory = history.map(normalizeHistoryEntry);
  const storageKey = getUserStorageKey(LIVE_TRADE_HISTORY_KEY, resolvedUserId);
  window.localStorage.setItem(storageKey, JSON.stringify(normalizedHistory));
  const channel = new BroadcastChannel(LIVE_TRADE_HISTORY_CHANNEL);
  channel.postMessage({ type: 'live-trade-history-updated', history: normalizedHistory, userId: resolvedUserId });
  channel.close();

  if (resolvedUserId && syncServer) {
    void fetch('/api/live-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resolvedUserId, type: 'history', history: normalizedHistory }),
    }).catch(() => undefined);
  }

  return normalizedHistory;
}

export function addLiveTradeHistoryEntry(entry: LiveTradeHistoryEntry, userId?: string | null) {
  const resolvedUserId = userId ?? getCurrentAccountId();
  const nextHistory = [normalizeHistoryEntry(entry), ...getLiveTradeHistory(resolvedUserId).map(normalizeHistoryEntry)].slice(0, 60);
  return saveLiveTradeHistory(nextHistory, resolvedUserId);
}

export function subscribeToLiveTradeHistory(callback: (history: LiveTradeHistoryEntry[]) => void, userId?: string | null) {
  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(LIVE_TRADE_HISTORY_KEY, resolvedUserId);
  const sync = () => callback(getLiveTradeHistory(resolvedUserId));
  sync();

  const storageHandler = (event: StorageEvent) => {
    if (event.key === storageKey) sync();
  };

  const channel = new BroadcastChannel(LIVE_TRADE_HISTORY_CHANNEL);
  const channelHandler = (event: MessageEvent) => {
    if (event.data?.userId === resolvedUserId) sync();
  };

  window.addEventListener('storage', storageHandler);
  channel.addEventListener('message', channelHandler);

  return () => {
    window.removeEventListener('storage', storageHandler);
    channel.removeEventListener('message', channelHandler);
    channel.close();
  };
}
