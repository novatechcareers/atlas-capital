import { getCurrentAccountId, getUserStorageKey } from './auth.ts';
import { getStoredLanguage } from './i18n.ts';

export const BALANCE_STORAGE_KEY = 'atlas-balance';
export const BALANCE_CHANNEL = 'atlas-balance';

export function getStoredBalance(userId?: string | null) {
  if (typeof window === 'undefined') return 0;

  const storageKey = getUserStorageKey(BALANCE_STORAGE_KEY, userId);
  const value = window.localStorage.getItem(storageKey);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function syncBalanceFromServer(userId?: string | null) {
  if (typeof window === 'undefined') return 0;

  const resolvedUserId = userId ?? getCurrentAccountId();
  if (!resolvedUserId) return 0;

  try {
    const response = await fetch(`/api/balance?userId=${encodeURIComponent(resolvedUserId)}`);
    if (!response.ok) return 0;
    const payload = await response.json();
    const nextBalance = Number(payload?.balance ?? 0);
    if (!Number.isFinite(nextBalance)) return 0;
    const normalized = Math.max(0, nextBalance);
    setStoredBalance(normalized, resolvedUserId);
    return normalized;
  } catch {
    return 0;
  }
}

export function setStoredBalance(value: number, userId?: string | null) {
  if (typeof window === 'undefined') return value;

  const normalized = Math.max(0, Number(value) || 0);
  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(BALANCE_STORAGE_KEY, resolvedUserId);
  window.localStorage.setItem(storageKey, String(normalized));

  const channel = new BroadcastChannel(BALANCE_CHANNEL);
  channel.postMessage({ type: 'balance-updated', balance: normalized, userId: resolvedUserId });
  channel.close();

  if (resolvedUserId) {
    void fetch('/api/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resolvedUserId, balance: normalized }),
    }).catch(() => undefined);
  }

  return normalized;
}

export function addToBalance(amount: number, userId?: string | null) {
  return setStoredBalance(getStoredBalance(userId) + amount, userId);
}

export async function adjustBalanceFromServer(amount: number, userId?: string | null) {
  if (typeof window === 'undefined') return null;
  const resolvedUserId = userId ?? getCurrentAccountId();
  if (!resolvedUserId || !Number.isFinite(amount)) return null;

  try {
    const response = await fetch('/api/balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: resolvedUserId, delta: amount }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const nextBalance = Number(payload?.balance);
    if (!Number.isFinite(nextBalance)) return null;
    setStoredBalance(nextBalance, resolvedUserId);
    return nextBalance;
  } catch {
    return null;
  }
}

export function subtractFromBalance(amount: number, userId?: string | null) {
  return setStoredBalance(Math.max(0, getStoredBalance(userId) - amount), userId);
}

export function canAfford(amount: number, userId?: string | null) {
  return getStoredBalance(userId) >= amount;
}

export function formatCurrency(amount: number) {
  const language = getStoredLanguage();
  return new Intl.NumberFormat(language === 'pt-BR' ? 'pt-BR' : 'en-US', {
    style: 'currency',
    currency: language === 'pt-BR' ? 'BRL' : 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function subscribeToBalance(callback: (balance: number) => void, userId?: string | null) {
  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(BALANCE_STORAGE_KEY, resolvedUserId);
  const sync = () => callback(getStoredBalance(resolvedUserId));
  sync();

  const storageHandler = (event: StorageEvent) => {
    if (event.key === storageKey) {
      sync();
    }
  };

  const channel = new BroadcastChannel(BALANCE_CHANNEL);
  const channelHandler = (event: MessageEvent) => {
    if (event.data?.userId !== resolvedUserId) return;
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
