import { getCurrentAccountId, getUserStorageKey } from './auth';

export type SubscriptionStatus = 'Reviewing' | 'Active' | 'Rejected';

export type ActiveSubscription = {
  id: string | number;
  name: string;
  price: number;
  status: SubscriptionStatus;
  createdAt: number;
  updatedAt: number;
};

export const SUBSCRIPTION_STORAGE_KEY = 'atlas-active-subscription';
export const SUBSCRIPTION_CHANNEL = 'atlas-subscription';

function normalizeSubscription(payload: any): ActiveSubscription | null {
  if (!payload) return null;

  return {
    id: payload.id ?? Date.now(),
    name: payload.name ?? 'Premium',
    price: Number(payload.price ?? 0),
    status: payload.status === 'Active' || payload.status === 'Rejected' ? payload.status : 'Reviewing',
    createdAt: payload.createdAt ?? payload.created_at ? new Date(payload.created_at).getTime() : Date.now(),
    updatedAt: payload.updatedAt ?? payload.updated_at ? new Date(payload.updated_at).getTime() : Date.now(),
  };
}

function persistSubscriptionToStorage(subscription: ActiveSubscription, userId?: string | null) {
  if (typeof window === 'undefined') return subscription;

  const safeUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(SUBSCRIPTION_STORAGE_KEY, safeUserId);
  window.localStorage.setItem(storageKey, JSON.stringify(subscription));

  const channel = new BroadcastChannel(SUBSCRIPTION_CHANNEL);
  channel.postMessage({ type: 'subscription-updated', subscription, userId: safeUserId });
  channel.close();

  return subscription;
}

export async function syncSubscriptionFromServer(userId?: string | null) {
  if (typeof window === 'undefined') return null;

  const resolvedUserId = userId ?? getCurrentAccountId();
  if (!resolvedUserId) return null;

  try {
    const response = await fetch(`/api/subscriptions?userId=${encodeURIComponent(resolvedUserId)}`);
    if (!response.ok) return null;
    const payload = await response.json();
    const subscription = normalizeSubscription(payload?.subscriptions?.[0] ?? null);
    if (!subscription) return null;
    persistSubscriptionToStorage(subscription, resolvedUserId);
    return subscription;
  } catch {
    return null;
  }
}

export function getActiveSubscription(userId?: string | null): ActiveSubscription | null {
  if (typeof window === 'undefined') return null;
  const storageKey = getUserStorageKey(SUBSCRIPTION_STORAGE_KEY, userId ?? getCurrentAccountId());
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as ActiveSubscription;
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

export function saveActiveSubscription(subscription: ActiveSubscription, userId?: string | null) {
  if (typeof window === 'undefined') return subscription;
  const safeUserId = userId ?? getCurrentAccountId();
  const nextSubscription = persistSubscriptionToStorage(subscription, safeUserId);

  return nextSubscription;
}

export function updateSubscriptionStatus(status: SubscriptionStatus, userId?: string | null) {
  const resolvedUserId = userId ?? getCurrentAccountId();
  const current = getActiveSubscription(resolvedUserId);
  if (!current) return null;

  const next = { ...current, status, updatedAt: Date.now() };
  persistSubscriptionToStorage(next, resolvedUserId);

  if (!resolvedUserId) return next;

  const recordId = typeof current.id === 'string' && current.id.includes('-') ? current.id : null;
  const requestUrl = recordId ? `/api/admin/subscriptions/${encodeURIComponent(String(recordId))}` : `/api/subscriptions?userId=${encodeURIComponent(resolvedUserId)}`;

  if (recordId) {
    void fetch(requestUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next.status }),
    }).then(async (response) => {
      if (!response.ok) return;
      const payload = await response.json();
      const serverSubscription = normalizeSubscription(payload?.subscription ?? null);
      if (serverSubscription) {
        persistSubscriptionToStorage(serverSubscription, resolvedUserId);
      }
    }).catch(() => undefined);
  } else {
    void fetch(requestUrl)
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json();
        const latest = normalizeSubscription(payload?.subscriptions?.[0] ?? null);
        if (!latest) return;
        void fetch(`/api/admin/subscriptions/${encodeURIComponent(String(latest.id))}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next.status }),
        }).catch(() => undefined);
      })
      .catch(() => undefined);
  }

  return next;
}

export function subscribeToSubscription(callback: (subscription: ActiveSubscription | null) => void, userId?: string | null) {
  const resolvedUserId = userId ?? getCurrentAccountId();
  const sync = () => callback(getActiveSubscription(resolvedUserId));
  sync();
  const storageHandler = (event: StorageEvent) => {
    if (!event.key) return;
    const storageKey = getUserStorageKey(SUBSCRIPTION_STORAGE_KEY, resolvedUserId);
    if (event.key === storageKey) sync();
  };
  const channel = new BroadcastChannel(SUBSCRIPTION_CHANNEL);
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
