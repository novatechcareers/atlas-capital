import { getCurrentAccountId, getUserStorageKey } from './auth.ts';

export type LiveTradeSide = 'Long' | 'Short';

export type LiveTradePosition = {
  side: LiveTradeSide;
  entryPrice: number;
  currentPrice: number;
  amount: number;
  leverage: number;
  openedAt: number;
  closeAt?: number;
  pnl: number;
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

export function calculateLiveTradePnl(position: LiveTradePosition, price: number) {
  const diff = position.side === 'Long' ? price - position.entryPrice : position.entryPrice - price;
  const rawPnl = (diff / position.entryPrice) * position.amount * position.leverage;
  const maximumLoss = position.amount;
  const maximumProfit = position.amount * 0.5;
  return Math.round(Math.max(-maximumLoss, Math.min(maximumProfit, rawPnl)) * 100) / 100;
}

export const LIVE_TRADE_HISTORY_KEY = 'atlas-live-trade-history';
export const LIVE_TRADE_HISTORY_CHANNEL = 'atlas-live-trade-history';
export const LIVE_TRADE_PRICE_KEY = 'atlas-live-trade-price';
export const LIVE_TRADE_PRICE_CHANNEL = 'atlas-live-trade-price';
export const LIVE_TRADE_POSITION_KEY = 'atlas-live-trade-position';
export const LIVE_TRADE_POSITION_CHANNEL = 'atlas-live-trade-position';

export function getLiveTradePrice() {
  if (typeof window === 'undefined') return 68940;

  const stored = window.localStorage.getItem(LIVE_TRADE_PRICE_KEY);
  const parsed = Number(stored);
  return Number.isFinite(parsed) ? parsed : 68940;
}

export async function fetchMarketPrice(): Promise<number> {
  if (typeof window === 'undefined') return 68940;

  try {
    const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    if (!resp.ok) return 68940;
    const data = await resp.json();
    const price = Number(data?.bitcoin?.usd ?? NaN);
    if (Number.isFinite(price) && price > 0) return Math.round(price * 100) / 100;
    return 68940;
  } catch {
    return 68940;
  }
}

export function setLiveTradePrice(value: number) {
  if (typeof window === 'undefined') return value;

  const normalized = Math.max(1000, Number(value) || 68940);
  window.localStorage.setItem(LIVE_TRADE_PRICE_KEY, String(normalized));

  const channel = new BroadcastChannel(LIVE_TRADE_PRICE_CHANNEL);
  channel.postMessage({ type: 'live-trade-price-updated', price: normalized });
  channel.close();

  return normalized;
}

export function subscribeToLiveTradePrice(callback: (price: number) => void) {
  const sync = () => callback(getLiveTradePrice());
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
    if (payload?.position) {
      setLiveTradePosition(payload.position, resolvedUserId);
    }
    if (Array.isArray(payload?.history)) {
      saveLiveTradeHistory(payload.history, resolvedUserId);
    }
    return { position: payload?.position ?? null, history: Array.isArray(payload?.history) ? payload.history : [] };
  } catch {
    return { position: null, history: [] };
  }
}

export function setLiveTradePosition(position: LiveTradePosition | null, userId?: string | null) {
  if (typeof window === 'undefined') return position;

  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(LIVE_TRADE_POSITION_KEY, resolvedUserId);
  if (!position) {
    window.localStorage.removeItem(storageKey);
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

export function saveLiveTradeHistory(history: LiveTradeHistoryEntry[], userId?: string | null) {
  if (typeof window === 'undefined') return history;

  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(LIVE_TRADE_HISTORY_KEY, resolvedUserId);
  window.localStorage.setItem(storageKey, JSON.stringify(history));
  const channel = new BroadcastChannel(LIVE_TRADE_HISTORY_CHANNEL);
  channel.postMessage({ type: 'live-trade-history-updated', history, userId: resolvedUserId });
  channel.close();

  if (resolvedUserId) {
    void fetch('/api/live-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resolvedUserId, type: 'history', history }),
    }).catch(() => undefined);
  }

  return history;
}

export function addLiveTradeHistoryEntry(entry: LiveTradeHistoryEntry, userId?: string | null) {
  const resolvedUserId = userId ?? getCurrentAccountId();
  const nextHistory = [entry, ...getLiveTradeHistory(resolvedUserId)].slice(0, 60);
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
