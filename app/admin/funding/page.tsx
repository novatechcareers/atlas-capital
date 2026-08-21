'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { getScopedStorageKey, getSelectedAdminUserId } from '@/lib/auth';
import { formatCurrency, setStoredBalance } from '@/lib/balance';

type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  role: string;
  status: string;
  createdAt: string;
};

export default function AdminFundingPage() {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ id: number; amount: number; note: string; createdAt: number }>>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedUserId(getSelectedAdminUserId()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const activeUserId = selectedUserId;
    if (!activeUserId) {
      setSelectedUser(null);
      setHistory([]);
      return;
    }

    const safeUserId: string = activeUserId;
    let isMounted = true;

    async function loadUser() {
      try {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(safeUserId)}`);
        const result = await response.json();
        if (!response.ok || result?.error) {
          throw new Error(result?.error || 'Unable to load selected user.');
        }

        if (isMounted) {
          setSelectedUser(result.user ?? null);
        }
      } catch {
        if (isMounted) {
          setSelectedUser(null);
        }
      }
    }

    loadUser();

    const stored = window.localStorage.getItem(getScopedStorageKey('atlas-admin-funding-history', safeUserId));
    if (stored) {
      try {
        if (isMounted) setHistory(JSON.parse(stored));
      } catch {
        if (isMounted) setHistory([]);
      }
    } else if (isMounted) {
      setHistory([]);
    }

    return () => {
      isMounted = false;
    };
  }, [selectedUserId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUserId || !selectedUser) {
      setMessage('Select an account before adding funds.');
      return;
    }

    const safeUserId: string = selectedUserId;
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;

    const nextEntry = { id: Date.now(), amount: numericAmount, note: note.trim() || 'Manual funding', createdAt: Date.now() };
    const nextHistory = [nextEntry, ...history];
    setHistory(nextHistory);
    window.localStorage.setItem(getScopedStorageKey('atlas-admin-funding-history', safeUserId), JSON.stringify(nextHistory));

    try {
      const currentBalanceResponse = await fetch(`/api/balance?userId=${encodeURIComponent(safeUserId)}`);
      const currentBalancePayload = currentBalanceResponse.ok ? await currentBalanceResponse.json() : { balance: 0 };
      const currentBalance = Number(currentBalancePayload?.balance ?? 0) || 0;
      const nextBalance = currentBalance + numericAmount;

      const balanceResponse = await fetch('/api/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: safeUserId, balance: nextBalance }),
      });
      const balancePayload = await balanceResponse.json();

      if (!balanceResponse.ok || balancePayload?.error) {
        throw new Error(balancePayload?.error || 'Database balance update failed.');
      }

      setStoredBalance(Number(balancePayload.balance ?? nextBalance), safeUserId);
      setMessage(`Account funded successfully with ${formatCurrency(numericAmount)} for ${selectedUser.firstName} ${selectedUser.lastName}.`);
      setAmount('');
      setNote('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to fund this account.');
    }
  };

  return (
    <AdminShell title="Manual Funding" subtitle="Add funds directly to the selected user account balance.">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Admin funding</p>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-[var(--text-white)]">Top up the account directly</h2>
            <Link href="/admin/users" className="ml-2 rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-1 text-sm text-[color:var(--primary-gold)]">Select account</Link>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            {selectedUser ? `Balance adjustment for ${selectedUser.firstName} ${selectedUser.lastName}.` : 'Select an account to continue.'}
          </p>
        </div>

        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-slate-300">Amount</label>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={!selectedUser}
                className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={selectedUser ? 'Enter funding amount' : 'Choose a user first'}
                inputMode="decimal"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">Note</label>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={!selectedUser}
                className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Optional note"
              />
            </div>

            {message ? <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}

            <button type="submit" disabled={!selectedUser} className="rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              Fund account
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <h3 className="text-lg font-semibold text-[var(--text-white)]">Funding history</h3>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--primary-gold)]/20">
            <table className="min-w-full divide-y divide-[color:var(--primary-gold)]/20">
              <thead className="bg-[color:var(--primary-gold)]/10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Note</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.length ? history.map((entry) => (
                  <tr key={entry.id} className="border-t border-[color:var(--primary-gold)]/10 bg-[color:var(--surface)]/40">
                    <td className="px-4 py-3 text-sm text-[var(--text-white)]">{formatCurrency(entry.amount)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{entry.note}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{new Date(entry.createdAt).toLocaleString()}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">No funding actions yet.</td>
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
