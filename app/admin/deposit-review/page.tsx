'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { getScopedStorageKey, getSelectedAdminUser, getSelectedAdminUserId } from '@/lib/auth';
import { formatCurrency, syncBalanceFromServer } from '@/lib/balance';

type DepositReviewItem = {
  id: number;
  amount: number;
  gateway: string;
  status: 'Pending' | 'Confirmed' | 'Approved';
  note?: string;
  createdAt: number;
};

export default function AdminDepositReviewPage() {
  const [items, setItems] = useState<DepositReviewItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = selectedUserId ? getSelectedAdminUser() : null;

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedUserId(getSelectedAdminUserId()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const activeUserId = selectedUserId;
    if (!activeUserId) {
      setItems([]);
      return;
    }

    async function loadItems() {
      try {
        const userId = String(activeUserId);
        const response = await fetch(`/api/deposit-requests?userId=${encodeURIComponent(userId)}`);
        const result = await response.json();
        if (!response.ok || result?.error) {
          throw new Error(result?.error || 'Unable to load deposit requests.');
        }

        const itemsFromServer = Array.isArray(result?.deposits) ? result.deposits : [];
        setItems(
          itemsFromServer.map((item: any) => ({
            id: item.id,
            amount: Number(item.amount ?? 0),
            gateway: item.gateway ?? 'Unknown',
            status: item.status ?? 'Pending',
            note: item.note ?? '',
            createdAt: new Date(item.created_at ?? Date.now()).getTime(),
          })),
        );
      } catch {
        setItems([]);
      }
    }

    void loadItems();
  }, [selectedUserId]);

  const handleApprove = async (id: string | number) => {
    if (!selectedUserId) return;

    try {
      const response = await fetch(`/api/admin/deposits/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Approved' }),
      });

      const result = await response.json();
      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Unable to approve deposit.');
      }

      const itemToApprove = items.find((item) => String(item.id) === String(id));
      if (itemToApprove) void syncBalanceFromServer(selectedUserId);

      setItems((current) => current.map((item) => (String(item.id) === String(id) ? { ...item, status: 'Approved' } : item)));
    } catch {
      setItems((current) => current);
    }
  };

  const handleConfirm = async (id: string | number) => {
    if (!selectedUserId) return;

    try {
      const response = await fetch(`/api/admin/deposits/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Confirmed' }),
      });

      const result = await response.json();
      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Unable to confirm deposit.');
      }

      setItems((current) => current.map((item) => (String(item.id) === String(id) ? { ...item, status: 'Confirmed' } : item)));
    } catch {
      setItems((current) => current);
    }
  };

  const statusCounts = items.reduce(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    { Pending: 0, Confirmed: 0, Approved: 0 } as Record<'Pending' | 'Confirmed' | 'Approved', number>,
  );

  return (
    <AdminShell title="Deposit Review" subtitle="Review the selected user’s payment confirmations and approve funding.">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Deposit queue</p>
              <div className="mt-2 flex items-center gap-3">
                <h2 className="text-2xl font-semibold text-[var(--text-white)]">{selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}'s deposits` : 'Pending deposit confirmations'}</h2>
                <Link href="/admin/users" className="ml-2 rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-1 text-sm text-[color:var(--primary-gold)]">Select account</Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['Pending', 'Confirmed', 'Approved'] as const).map((key) => (
                <div key={key} className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 text-sm text-slate-300">
                  <p className="text-[color:var(--text-white)] font-semibold">{key}</p>
                  <p className="mt-2 text-2xl font-semibold text-[color:var(--primary-gold)]">{statusCounts[key]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <div className="overflow-hidden rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--surface)]">
            <table className="min-w-full divide-y divide-[color:var(--primary-gold)]/20">
              <thead className="bg-[color:var(--primary-gold)]/10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Gateway</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Note</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.length ? items.map((item) => (
                  <tr key={item.id} className="border-t border-[color:var(--primary-gold)]/10 bg-[color:var(--surface)]/40">
                    <td className="px-4 py-3 text-sm text-[var(--text-white)]">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{item.gateway}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${item.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-300' : item.status === 'Confirmed' ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{item.note || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      {item.status === 'Pending' ? (
                        <button type="button" onClick={() => handleConfirm(item.id)} className="rounded-full bg-sky-500/15 px-3 py-1 text-sky-300 transition hover:bg-sky-500/20">
                          Mark confirmed
                        </button>
                      ) : item.status === 'Confirmed' ? (
                        <button type="button" onClick={() => handleApprove(item.id)} className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300 transition hover:bg-emerald-500/20">
                          Approve funding
                        </button>
                      ) : (
                        <span className="text-slate-400">Approved</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No deposit confirmations yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
