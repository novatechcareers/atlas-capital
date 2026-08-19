import { getCurrentAccountId, getUserStorageKey } from './auth.ts';

export type AutoTradeStatus = 'Reviewing' | 'Unlocked' | 'Running' | 'Stopped' | 'Rejected';

export type AutoTradePurchase = {
  id: string | number;
  planName: string;
  price: number;
  status: AutoTradeStatus;
  createdAt: number;
  updatedAt: number;
  activatedAt?: number;
};

export type AutoTradeHistoryEntry = {
  id: number;
  createdAt: number;
  asset: string;
  result: number;
};

export const AUTO_TRADE_STORAGE_KEY = 'atlas-auto-trade-purchase';
export const AUTO_TRADE_CHANNEL = 'atlas-auto-trade';
export const AUTO_TRADE_HISTORY_KEY = 'atlas-auto-trade-history';

export function getAutoTradePurchase(userId?: string | null): AutoTradePurchase | null {
  if (typeof window === 'undefined') return null;

  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(AUTO_TRADE_STORAGE_KEY, resolvedUserId);
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as AutoTradePurchase;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export async function syncAutoTradeFromServer(userId?: string | null) {
  if (typeof window === 'undefined') return null;

  const resolvedUserId = userId ?? getCurrentAccountId();
  if (!resolvedUserId) return null;

  try {
    const response = await fetch(`/api/auto-trade?userId=${encodeURIComponent(resolvedUserId)}`);
    if (!response.ok) return null;
    const payload = await response.json();
    const purchase = payload?.purchase ?? null;
    if (!purchase) {
      const storageKey = getUserStorageKey(AUTO_TRADE_STORAGE_KEY, resolvedUserId);
      window.localStorage.removeItem(storageKey);
      const channel = new BroadcastChannel(AUTO_TRADE_CHANNEL);
      channel.postMessage({ type: 'auto-trade-reset', userId: resolvedUserId });
      channel.close();
      return null;
    }
    const normalized = {
      id: purchase.id ?? Date.now(),
      planName: purchase.planName ?? purchase.plan_name ?? 'Starter',
      price: Number(purchase.price ?? 0),
      status: purchase.status ?? 'Reviewing',
      createdAt: purchase.createdAt ?? purchase.created_at ? new Date(purchase.created_at).getTime() : Date.now(),
      updatedAt: purchase.updatedAt ?? purchase.updated_at ? new Date(purchase.updated_at).getTime() : Date.now(),
      activatedAt: purchase.activatedAt ?? purchase.activated_at ? new Date(purchase.activated_at).getTime() : undefined,
    } as AutoTradePurchase;
    saveAutoTradePurchase(normalized, resolvedUserId);
    return normalized;
  } catch {
    return null;
  }
}

export function saveAutoTradePurchase(purchase: AutoTradePurchase, userId?: string | null) {
  if (typeof window === 'undefined') return purchase;

  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(AUTO_TRADE_STORAGE_KEY, resolvedUserId);
  window.localStorage.setItem(storageKey, JSON.stringify(purchase));
  const channel = new BroadcastChannel(AUTO_TRADE_CHANNEL);
  channel.postMessage({ type: 'auto-trade-updated', purchase, userId: resolvedUserId });
  channel.close();

  return purchase;
}

export function updateAutoTradeStatus(status: AutoTradeStatus, userId?: string | null) {
  const resolvedUserId = userId ?? getCurrentAccountId();
  const current = getAutoTradePurchase(resolvedUserId);
  if (!current) return null;

  return saveAutoTradePurchase({
    ...current,
    status,
    activatedAt: status === 'Unlocked' && !current.activatedAt ? Date.now() : current.activatedAt,
    updatedAt: Date.now(),
  }, resolvedUserId);
}

export function getAutoTradeHistory(userId?: string | null): AutoTradeHistoryEntry[] {
  if (typeof window === 'undefined') return [];

  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(AUTO_TRADE_HISTORY_KEY, resolvedUserId);
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as AutoTradeHistoryEntry[];
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
}

export function addAutoTradeHistoryEntry(entry: AutoTradeHistoryEntry, userId?: string | null) {
  if (typeof window === 'undefined') return entry;

  const resolvedUserId = userId ?? getCurrentAccountId();
  const nextHistory = [entry, ...getAutoTradeHistory(resolvedUserId)].slice(0, 50);
  window.localStorage.setItem(getUserStorageKey(AUTO_TRADE_HISTORY_KEY, resolvedUserId), JSON.stringify(nextHistory));
  const channel = new BroadcastChannel(AUTO_TRADE_CHANNEL);
  channel.postMessage({ type: 'auto-trade-history-updated', history: nextHistory, userId: resolvedUserId });
  channel.close();
  return entry;
}

export function resetAutoTrade(userId?: string | null) {
  if (typeof window === 'undefined') return;

  const resolvedUserId = userId ?? getCurrentAccountId();
  window.localStorage.removeItem(getUserStorageKey(AUTO_TRADE_STORAGE_KEY, resolvedUserId));
  const channel = new BroadcastChannel(AUTO_TRADE_CHANNEL);
  channel.postMessage({ type: 'auto-trade-reset', userId: resolvedUserId });
  channel.close();
}

export function subscribeToAutoTradeHistory(callback: (history: AutoTradeHistoryEntry[]) => void, userId?: string | null) {
  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(AUTO_TRADE_HISTORY_KEY, resolvedUserId);
  const sync = () => callback(getAutoTradeHistory(resolvedUserId));
  sync();
  const storageHandler = (event: StorageEvent) => {
    if (event.key === storageKey) sync();
  };
  const channel = new BroadcastChannel(AUTO_TRADE_CHANNEL);
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

export function subscribeToAutoTrade(callback: (purchase: AutoTradePurchase | null) => void, userId?: string | null) {
  const resolvedUserId = userId ?? getCurrentAccountId();
  const sync = () => callback(getAutoTradePurchase(resolvedUserId));
  sync();

  const storageHandler = (event: StorageEvent) => {
    if (!event.key || event.key === getUserStorageKey(AUTO_TRADE_STORAGE_KEY, resolvedUserId)) sync();
  };
  const channel = new BroadcastChannel(AUTO_TRADE_CHANNEL);
  const channelHandler = (event: MessageEvent) => {
    if (!event.data || event.data.userId !== resolvedUserId) return;
    sync();
  };

  window.addEventListener('storage', storageHandler);
  channel.addEventListener('message', channelHandler);

  return () => {
    window.removeEventListener('storage', storageHandler);
    channel.removeEventListener('message', channelHandler);
    channel.close();
  };
}
