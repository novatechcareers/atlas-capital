'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { getAccountById, getSelectedAdminUserId } from '@/lib/auth';
import { formatCurrency } from '@/lib/balance';
import { subscribeToSubscription, type ActiveSubscription } from '@/lib/subscription';

export default function AdminSubscriptionPage() {
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [message, setMessage] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
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

    // Fetch from server first to ensure we see data from the database, not stale localStorage
    const syncAndSubscribe = async () => {
      try {
        const response = await fetch(`/api/subscriptions?userId=${encodeURIComponent(selectedUserId)}`);
        if (response.ok) {
          const { subscriptions } = await response.json();
          const reviewing = Array.isArray(subscriptions) ? subscriptions.find((s: any) => s.status === 'Reviewing') : null;
          if (reviewing) {
            setSubscription({
              id: reviewing.id,
              name: reviewing.name,
              price: Number(reviewing.price),
              status: reviewing.status,
              createdAt: reviewing.created_at ? new Date(reviewing.created_at).getTime() : Date.now(),
              updatedAt: reviewing.updated_at ? new Date(reviewing.updated_at).getTime() : Date.now(),
            });
          } else {
            setSubscription(null);
          }
        }
      } catch (err) {
        setSubscription(null);
      }
    };

    void syncAndSubscribe();
    return subscribeToSubscription(setSubscription, selectedUserId);
  }, [selectedUserId]);

  const approve = async () => {
    if (!subscription) return;
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(String(subscription.id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Active' }),
      });

      if (!res.ok) {
        setMessage('Failed to approve subscription payment.');
        setIsUpdating(false);
        return;
      }

      const { subscription: updated } = await res.json();
      setSubscription({
        id: updated.id,
        name: updated.name,
        price: Number(updated.price),
        status: updated.status,
        createdAt: updated.created_at ? new Date(updated.created_at).getTime() : Date.now(),
        updatedAt: updated.updated_at ? new Date(updated.updated_at).getTime() : Date.now(),
      });
      setMessage('Subscription payment approved. Premium access is now active for the selected user.');
    } catch (err) {
      console.error('Failed to approve subscription:', err);
      setMessage('Failed to approve subscription payment.');
    } finally {
      setIsUpdating(false);
    }
  };

  const reject = async () => {
    if (!subscription || isUpdating) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(String(subscription.id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Rejected' }),
      });

      if (!res.ok) {
        setMessage('Failed to reject subscription payment.');
        return;
      }

      const { subscription: updated } = await res.json();
      setSubscription({
        id: updated.id,
        name: updated.name,
        price: Number(updated.price),
        status: updated.status,
        createdAt: updated.created_at ? new Date(updated.created_at).getTime() : Date.now(),
        updatedAt: updated.updated_at ? new Date(updated.updated_at).getTime() : Date.now(),
      });
      setMessage('Subscription payment rejected.');
    } catch (err) {
      console.error('Failed to reject subscription:', err);
      setMessage('Failed to reject subscription payment.');
    } finally {
      setIsUpdating(false);
    }
  };

  const resetSubscription = async () => {
    if (!subscription || isUpdating) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(String(subscription.id))}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        setMessage('Failed to reset subscription.');
        return;
      }

      setSubscription(null);
      setMessage('Subscription reset. The selected user can submit a new payment review.');
    } catch (err) {
      console.error('Failed to reset subscription:', err);
      setMessage('Failed to reset subscription.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AdminShell title="Subscription Review" subtitle="Subscription payment queue.">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Subscription administration</p>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-[var(--text-white)]">{selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}'s payment approval queue` : 'Payment approval queue'}</h2>
            <Link href="/admin/users" className="ml-2 rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-1 text-sm text-[color:var(--primary-gold)]">Select account</Link>
          </div>
          <p className="mt-3 text-sm text-slate-400">{selectedUser ? 'Reviewing payment for the selected account.' : 'Select an account to view payment activity.'}</p>
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
              <span className={`rounded-full px-4 py-2 text-sm font-semibold ${subscription.status === 'Reviewing' ? 'bg-amber-500/15 text-amber-200' : subscription.status === 'Rejected' ? 'bg-rose-500/15 text-rose-200' : 'bg-emerald-500/15 text-emerald-200'}`}>{subscription.status}</span>
            </div>
            {subscription.status === 'Reviewing' ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" disabled={isUpdating} onClick={approve} className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{isUpdating ? 'Updating...' : 'Approve subscription payment'}</button>
                <button type="button" disabled={isUpdating} onClick={reject} className="rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">Reject payment</button>
              </div>
            ) : (
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[color:var(--border-soft)] pt-5">
                <button type="button" disabled={isUpdating} onClick={resetSubscription} className="w-full rounded-2xl border border-slate-500 bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">{isUpdating ? 'Resetting...' : 'Reset subscription'}</button>
                {subscription.status === 'Rejected' ? <p className="text-sm text-rose-200">Payment rejected.</p> : <p className="text-sm text-emerald-200">Payment approved and subscription active.</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
