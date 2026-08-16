'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { getScopedStorageKey, getSelectedAdminUser, getSelectedAdminUserId } from '@/lib/auth';
import { addToBalance, formatCurrency } from '@/lib/balance';

export default function AdminWithdrawalPage() {
  const [requests, setRequests] = useState<Array<{ id: number; amount: number; method: string; status: 'Fee pending' | 'Pending' | 'Approved' | 'Declined'; walletAddress?: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = selectedUserId ? getSelectedAdminUser() : null;

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedUserId(getSelectedAdminUserId()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setRequests([]);
      return;
    }

    const fetchRequests = async () => {
      try {
        const resp = await fetch(`/api/admin/withdrawals?userId=${encodeURIComponent(selectedUserId)}`);
        if (resp.ok) {
          const payload = await resp.json();
          setRequests(Array.isArray(payload?.withdrawals) ? payload.withdrawals : []);
          return;
        }
      } catch {
        // fallback to localStorage
      }

      const stored = window.localStorage.getItem(getScopedStorageKey('atlas-withdrawal-requests', selectedUserId));
      if (stored) {
        try {
          setRequests(JSON.parse(stored));
        } catch {
          setRequests([]);
        }
      } else {
        setRequests([]);
      }
    };

    fetchRequests();
  }, [selectedUserId]);

  const handleDecision = (id: string | number, decision: 'Approved' | 'Declined') => {
    (async () => {
      if (!selectedUserId) return;

      try {
        const resp = await fetch(`/api/admin/withdrawals/${encodeURIComponent(String(id))}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: decision }),
        });

        if (resp.ok) {
          const payload = await resp.json();
          const updated = payload?.withdrawal ?? null;
          if (updated) {
            const nextRequests = requests.map((r) => (String(r.id) === String(id) ? updated : r));
            setRequests(nextRequests);

            const channel = new BroadcastChannel('atlas-withdrawal-requests');
            channel.postMessage({ type: 'requests-updated', requests: nextRequests, userId: selectedUserId });
            channel.close();

            if (decision === 'Declined') {
              addToBalance(Number(updated.amount), selectedUserId);
            }
            return;
          }
        }
      } catch {
        // fallback to localStorage behavior below
      }

      // local fallback
      const stored = window.localStorage.getItem(getScopedStorageKey('atlas-withdrawal-requests', selectedUserId));
      const latestRequests = stored ? JSON.parse(stored) : [];
      const requestToUpdate = latestRequests.find((request: any) => String(request.id) === String(id));
      if (!requestToUpdate || requestToUpdate.status !== 'Pending') return;
      const nextRequests = latestRequests.map((request: any) => (String(request.id) === String(id) ? { ...request, status: decision } : request));
      setRequests(nextRequests);
      window.localStorage.setItem(getScopedStorageKey('atlas-withdrawal-requests', selectedUserId), JSON.stringify(nextRequests));

      const channel = new BroadcastChannel('atlas-withdrawal-requests');
      channel.postMessage({ type: 'requests-updated', requests: nextRequests, userId: selectedUserId });
      channel.close();

      if (decision === 'Declined') {
        if (requestToUpdate) {
          addToBalance(requestToUpdate.amount, selectedUserId);
        }
      }
    })();
  };

  return (
    <AdminShell title="Withdrawal Review" subtitle="Approve or decline the selected user’s withdrawal requests.">
      <div className="mx-auto max-w-5xl rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
        <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--primary-gold)]/10 px-5 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Admin review</p>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-[var(--text-white)]">{selectedUser ? `Manage ${selectedUser.firstName} ${selectedUser.lastName}'s withdrawal requests` : 'Manage withdrawal requests'}</h2>
            <Link href="/admin/users" className="ml-2 rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-1 text-sm text-[color:var(--primary-gold)]">Choose user</Link>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--primary-gold)]/20">
          <table className="min-w-full divide-y divide-[color:var(--primary-gold)]/20">
            <thead className="bg-[color:var(--primary-gold)]/10">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Method</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Destination</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.length ? requests.map((request) => (
                <tr key={request.id} className="border-t border-[color:var(--primary-gold)]/10 bg-[color:var(--surface)]/40">
                  <td className="px-4 py-3 text-sm text-[var(--text-white)]">{formatCurrency(request.amount)}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{request.method}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{request.walletAddress || 'Bank account pending'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${request.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-300' : request.status === 'Declined' ? 'bg-rose-500/15 text-rose-300' : request.status === 'Pending' ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-500/15 text-slate-300'}`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {request.status === 'Pending' ? (
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleDecision(request.id, 'Approved')} className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300">Approve</button>
                        <button type="button" onClick={() => handleDecision(request.id, 'Declined')} className="rounded-full bg-rose-500/15 px-3 py-1 text-rose-300">Decline</button>
                      </div>
                    ) : request.status === 'Fee pending' ? (
                      <span className="text-slate-400">Awaiting user confirmation</span>
                    ) : (
                      <span className="text-slate-400">Reviewed</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No withdrawal requests yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
