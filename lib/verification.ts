import { getCurrentAccountId, getUserStorageKey } from './auth';

export const VERIFICATION_STORAGE_KEY = 'atlas-verification-request';
export const VERIFICATION_CHANNEL = 'atlas-verification';

export type VerificationStatus = 'Pending' | 'Approved' | 'Declined';

export type VerificationRequest = {
  id: string | number;
  type: string;
  fileName: string;
  fileType: string;
  fileDataUrl: string;
  status: VerificationStatus;
  reason?: string;
  uploadedAt: number;
  reviewedAt?: number;
};

function normalizeVerificationRequest(payload: any): VerificationRequest | null {
  if (!payload) return null;

  return {
    id: payload.id ?? Date.now(),
    type: payload.type ?? payload.document_type ?? 'Unknown Document',
    fileName: payload.fileName ?? payload.file_name ?? 'verification-document',
    fileType: payload.fileType ?? payload.file_type ?? 'application/octet-stream',
    fileDataUrl: payload.fileDataUrl ?? payload.file_data_url ?? '',
    status: payload.status ?? 'Pending',
    reason: payload.reason ?? undefined,
    uploadedAt: payload.uploadedAt ?? payload.created_at ? new Date(payload.created_at).getTime() : Date.now(),
    reviewedAt: payload.reviewedAt ?? payload.updated_at ? new Date(payload.updated_at).getTime() : undefined,
  };
}

function persistVerificationToStorage(request: VerificationRequest, userId?: string | null) {
  if (typeof window === 'undefined') return request;

  const resolvedUserId = userId ?? getCurrentAccountId();
  const storageKey = getUserStorageKey(VERIFICATION_STORAGE_KEY, resolvedUserId);
  window.localStorage.setItem(storageKey, JSON.stringify(request));

  const channel = new BroadcastChannel(VERIFICATION_CHANNEL);
  channel.postMessage({ type: 'verification-updated', request, userId: resolvedUserId });
  channel.close();

  return request;
}

export async function syncVerificationFromServer(userId?: string | null) {
  if (typeof window === 'undefined') return null;

  const resolvedUserId = userId ?? getCurrentAccountId();
  if (!resolvedUserId) return null;

  try {
    const response = await fetch(`/api/verification?userId=${encodeURIComponent(resolvedUserId)}`);
    if (!response.ok) {
      window.localStorage.removeItem(getUserStorageKey(VERIFICATION_STORAGE_KEY, resolvedUserId));
      return null;
    }
    const payload = await response.json();
    const request = normalizeVerificationRequest(payload?.request ?? payload?.requests?.[0] ?? null);
    if (!request) return null;
    persistVerificationToStorage(request, resolvedUserId);
    return request;
  } catch {
    window.localStorage.removeItem(getUserStorageKey(VERIFICATION_STORAGE_KEY, resolvedUserId));
    return null;
  }
}

export function getStoredVerification(userId?: string | null): VerificationRequest | null {
  if (typeof window === 'undefined') return null;

  const storageKey = getUserStorageKey(VERIFICATION_STORAGE_KEY, userId ?? getCurrentAccountId());
  const stored = window.localStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as VerificationRequest;
  } catch {
    return null;
  }
}

export async function saveStoredVerification(request: VerificationRequest, userId?: string | null) {
  if (typeof window === 'undefined') return request;

  const resolvedUserId = userId ?? getCurrentAccountId();
  const nextRequest = persistVerificationToStorage(request, resolvedUserId);

  if (!resolvedUserId) return nextRequest;

  try {
    const response = await fetch('/api/verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: resolvedUserId,
        type: request.type,
        fileName: request.fileName,
        fileType: request.fileType,
        fileDataUrl: request.fileDataUrl,
        status: request.status,
        reason: request.reason,
      }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const serverRequest = normalizeVerificationRequest(payload?.request ?? null);
    return serverRequest ? persistVerificationToStorage(serverRequest, resolvedUserId) : null;
  } catch {
    return null;
  }

}

export async function updateVerification(update: Partial<VerificationRequest>, userId?: string | null) {
  const resolvedUserId = userId ?? getCurrentAccountId();
  const current = getStoredVerification(resolvedUserId);
  if (!current) return null;

  const next = { ...current, ...update };

  if (!resolvedUserId) return next;

  const recordId = typeof current.id === 'string' && current.id.includes('-') ? current.id : null;
  const requestUrl = recordId ? `/api/admin/verification/${encodeURIComponent(String(recordId))}` : `/api/verification?userId=${encodeURIComponent(resolvedUserId)}`;

  if (recordId) {
    try {
      const response = await fetch(requestUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next.status, reason: next.reason ?? null }),
      });
      if (!response.ok) return null;
      const payload = await response.json();
      const serverRequest = normalizeVerificationRequest(payload?.request ?? null);
      return serverRequest ? persistVerificationToStorage(serverRequest, resolvedUserId) : null;
    } catch {
      return null;
    }
  } else {
    try {
      const response = await fetch(requestUrl);
      if (!response.ok) return null;
      const payload = await response.json();
      const latest = normalizeVerificationRequest(payload?.request ?? payload?.requests?.[0] ?? null);
      if (!latest) return null;
      const updateResponse = await fetch(`/api/admin/verification/${encodeURIComponent(String(latest.id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next.status, reason: next.reason ?? null }),
      });
      if (!updateResponse.ok) return null;
      const updatePayload = await updateResponse.json();
      const serverRequest = normalizeVerificationRequest(updatePayload?.request ?? null);
      return serverRequest ? persistVerificationToStorage(serverRequest, resolvedUserId) : null;
    } catch {
      return null;
    }
  }
}

export function subscribeToVerification(callback: (request: VerificationRequest | null) => void, userId?: string | null) {
  const resolvedUserId = userId ?? getCurrentAccountId();
  const sync = () => callback(getStoredVerification(resolvedUserId));
  sync();

  const storageHandler = (event: StorageEvent) => {
    if (!event.key) return;
    const storageKey = getUserStorageKey(VERIFICATION_STORAGE_KEY, resolvedUserId);
    if (event.key === storageKey) {
      sync();
    }
  };

  const channel = new BroadcastChannel(VERIFICATION_CHANNEL);
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
