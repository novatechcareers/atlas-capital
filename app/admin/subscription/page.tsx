'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { getAccountById, getSelectedAdminUserId } from '@/lib/auth';
import { formatCurrency } from '@/lib/balance';
import { getActiveSubscription, subscribeToSubscription, type ActiveSubscription, updateSubscriptionStatus, syncSubscriptionFromServer } from '@/lib/subscription';

export default function AdminSubscriptionPage() {
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [message, setMessage] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = selectedUserId ? getAccountById(selectedUserId) : null;

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedUserId(getSelectedAdminUserId()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      const timer = window.setTimeout(() => setSubscription(null), 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => setSubscription(getActiveSubscription(selectedUserId)), 0);
    const unsubscribe = subscribeToSubscription(setSubscription, selectedUserId);
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [selectedUserId]);

  const approve = async () => {
    if (!selectedUser || !subscription) return;

    try {
      const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(String(subscription.id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Active' }),
      });

      if (!res.ok) {
        setMessage('Failed to approve subscription payment.');
        return;
      }

      await syncSubscriptionFromServer(selectedUser.id);
      const latest = getActiveSubscription(selectedUser.id);
      setSubscription(latest);
      setMessage('Subscription payment approved. Premium access is now active for the selected user.');
    } catch (err) {
      setMessage('Failed to approve subscription payment.');
    }
  };

  return (
    <AdminShell title="Subscription Review" subtitle="Review the selected user’s subscription payment and approve premium access.">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Subscription administration</p>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-[var(--text-white)]">{selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}'s payment approval queue` : 'Payment approval queue'}</h2>
            <Link href="/admin/users" className="ml-2 rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-1 text-sm text-[color:var(--primary-gold)]">Choose user</Link>
          </div>
          <p className="mt-3 text-sm text-slate-400">{selectedUser ? 'Approve the payment to activate this user’s subscription and update their client page immediately.' : 'Choose a user first to review their subscription payment.'}</p>
        </div>

        {message ? <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div> : null}

        {!subscription ? (
          <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-8 text-center text-sm text-[var(--text-secondary)]">No subscription payment is awaiting review.</div>
        ) : (
          <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-slate-400">Client subscription</p>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--text-white)]">{subscription.name}</h3>
                <p className="mt-2 text-sm text-slate-300">Payment: {formatCurrency(subscription.price)}</p>
              </div>
              <span className={`rounded-full px-4 py-2 text-sm font-semibold ${subscription.status === 'Reviewing' ? 'bg-amber-500/15 text-amber-200' : 'bg-emerald-500/15 text-emerald-200'}`}>{subscription.status}</span>
            </div>
            {subscription.status === 'Reviewing' ? (
              <button type="button" onClick={approve} className="mt-6 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90">Approve subscription payment</button>
            ) : <p className="mt-6 border-t border-[color:var(--border-soft)] pt-5 text-sm text-emerald-200">Payment approved and subscription active.</p>}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
