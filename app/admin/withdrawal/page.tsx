'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { getScopedStorageKey, getSelectedAdminUser, getSelectedAdminUserId } from '@/lib/auth';
import { formatCurrency } from '@/lib/balance';

export default function AdminWithdrawalPage() {
  const [requests, setRequests] = useState<Array<{ id: string | number; amount: number; method: string; status: 'Fee pending' | 'Pending' | 'Approved' | 'Declined'; walletAddress?: string; wallet_address?: string; user_name?: string; bank_account?: { bankName?: string; accountName?: string; accountNumber?: string; bank_name?: string; account_name?: string; account_number?: string } }>>([]);
  const [viewRequest, setViewRequest] = useState<typeof requests[number] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
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
    const pollTimer = window.setInterval(fetchRequests, 2000);
    return () => window.clearInterval(pollTimer);
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
            return;
          }
        }
        const errorPayload = await resp.json().catch(() => null);
        setMessage(errorPayload?.error || 'Unable to update withdrawal status in Supabase.');
      } catch {
        // Supabase is authoritative for withdrawal decisions.
        setMessage('Unable to connect to Supabase. Withdrawal status was not changed.');
      }
      return;
    })();
  };

  return (
    <AdminShell title="Withdrawal Review" subtitle="Withdrawal request queue.">
      <div className="mx-auto max-w-5xl rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
        <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--primary-gold)]/10 px-5 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Admin review</p>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-[var(--text-white)]">{selectedUser ? `Manage ${selectedUser.firstName} ${selectedUser.lastName}'s withdrawal requests` : 'Manage withdrawal requests'}</h2>
            <Link href="/admin/users" className="ml-2 rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-1 text-sm text-[color:var(--primary-gold)]">Select account</Link>
          </div>
        </div>

        {message ? <div className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{message}</div> : null}

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
                  <td className="px-4 py-3 text-sm text-[var(--text-white)]"><span className="block font-semibold">{formatCurrency(request.amount)}</span><span className="text-xs text-slate-500">{request.user_name}</span></td>
                  <td className="px-4 py-3 text-sm text-slate-300">{request.method}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{request.walletAddress || request.wallet_address || request.bank_account?.accountNumber || request.bank_account?.account_number || 'Bank account pending'} <button type="button" onClick={() => setViewRequest(request)} className="ml-2 text-[color:var(--primary-gold)] underline">View</button></td>
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
      {viewRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[color:var(--primary-gold)]/30 bg-[color:var(--surface)] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold text-[var(--text-primary)]">Withdrawal destination</h2><button type="button" onClick={() => setViewRequest(null)} className="text-sm text-slate-400">Close</button></div>
            <p className="mt-4 text-sm text-slate-400">User: <span className="text-[var(--text-primary)]">{viewRequest.user_name}</span></p>
            <p className="mt-2 text-sm text-slate-400">Method: <span className="text-[var(--text-primary)]">{viewRequest.method}</span></p>
            {viewRequest.walletAddress || viewRequest.wallet_address ? <p className="mt-4 break-all rounded-2xl bg-slate-950/40 p-4 text-sm text-[var(--text-primary)]">Wallet: {viewRequest.walletAddress || viewRequest.wallet_address}</p> : null}
            {viewRequest.bank_account ? <div className="mt-4 space-y-2 rounded-2xl bg-slate-950/40 p-4 text-sm text-[var(--text-primary)]"><p>Bank: {viewRequest.bank_account.bankName || viewRequest.bank_account.bank_name}</p><p>Account name: {viewRequest.bank_account.accountName || viewRequest.bank_account.account_name}</p><p>Account number: {viewRequest.bank_account.accountNumber || viewRequest.bank_account.account_number}</p></div> : null}
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
