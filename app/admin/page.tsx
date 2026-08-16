'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { subscribeToAutoTrade, type AutoTradePurchase } from '@/lib/auto-trade';
import { getSelectedAdminUserId } from '@/lib/auth';

type AdminNotifications = {
  depositPending: boolean;
  verificationPending: boolean;
  autoTradePending: boolean;
  feePending: boolean;
  subscriptionPending: boolean;
};

const sections = [
  { title: 'Deposit admin', href: '/admin/deposit', description: 'Handle premium bank account assignments for deposits.' },
  { title: 'Deposit review', href: '/admin/deposit-review', description: 'Review client deposit confirmations and approve them.' },
  { title: 'Auto trade', href: '/admin/auto-trade', description: 'Review auto-trade payments and control the client bot.' },
  { title: 'Subscriptions', href: '/admin/subscription', description: 'Review subscription payments and activate premium access.' },
  { title: 'Manual funding', href: '/admin/funding', description: 'Top up the account balance directly from the admin side.' },
  { title: 'Withdrawal review', href: '/admin/withdrawal', description: 'Approve or decline client withdrawal requests.' },
  { title: 'Withdrawal fee', href: '/admin/withdrawal-fee', description: 'Assign the payment account for the fixed international transfer fee.' },
  { title: 'Verify accounts', href: '/admin/verify-account', description: 'Review user documents and approve or decline verification.' },
  { title: 'Users', href: '/admin/users', description: 'Manage customer accounts and access.' },
  { title: 'Reports', href: '/admin/reports', description: 'View activity and transaction summaries.' },
  { title: 'Settings', href: '/admin/settings', description: 'Configure system-wide administration settings.' },
];

export default function AdminPage() {
  const [autoTradePurchase, setAutoTradePurchase] = useState<AutoTradePurchase | null>(null);
  const selectedUserId = getSelectedAdminUserId();
  const [notifications, setNotifications] = useState<AdminNotifications | null>(null);

  useEffect(() => {
    if (!selectedUserId) {
      setAutoTradePurchase(null);
      return;
    }

    return subscribeToAutoTrade(setAutoTradePurchase, selectedUserId);
  }, [selectedUserId]);

  useEffect(() => {
    let mounted = true;
    if (!selectedUserId) {
      setNotifications(null);
      return;
    }

    const fetchNotifications = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const resp = await fetch(`/api/admin/notifications?userId=${encodeURIComponent(selectedUserId)}`);
        if (!resp.ok) return;
        const payload = await resp.json();
        if (!mounted) return;
        setNotifications({
          depositPending: Boolean(payload?.depositPending),
          verificationPending: Boolean(payload?.verificationPending),
          autoTradePending: Boolean(payload?.autoTradePending),
          feePending: Boolean(payload?.feePending),
          subscriptionPending: Boolean(payload?.subscriptionPending),
        });
      } catch {
        // ignore
      }
    };

    // initial fetch
    fetchNotifications();

    // Poll less frequently and only when visible
    const timer = window.setInterval(() => fetchNotifications(), 10000);

    // BroadcastChannel for immediate updates from other tabs or client events
    const channel = new BroadcastChannel('atlas-admin');
    const channelHandler = (ev: MessageEvent) => {
      if (!ev?.data) return;
      // If event includes userId and matches selected user, refresh
      if (!ev.data.userId || ev.data.userId === selectedUserId) {
        void fetchNotifications();
      }
    };
    channel.addEventListener('message', channelHandler);

    // Also refresh when tab becomes visible
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') fetchNotifications();
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      mounted = false;
      window.clearInterval(timer);
      channel.removeEventListener('message', channelHandler);
      channel.close();
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [selectedUserId]);

  return (
    <AdminShell title="Admin Portal" subtitle="Central control for deposit handling and site administration.">
      <div className="mx-auto max-w-4xl space-y-6">
        {notifications && (notifications.depositPending || notifications.verificationPending || notifications.autoTradePending || notifications.feePending || notifications.subscriptionPending) ? (
          <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-200">New activity for selected user</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {notifications.depositPending ? <a href="/admin/deposit-review" className="rounded-full bg-emerald-500/10 px-3 py-1 text-amber-200">Deposit pending</a> : null}
              {notifications.verificationPending ? <a href="/admin/verify-account" className="rounded-full bg-amber-500/10 px-3 py-1 text-amber-200">Verification pending</a> : null}
              {notifications.autoTradePending ? <a href="/admin/auto-trade" className="rounded-full bg-amber-500/10 px-3 py-1 text-amber-200">Auto-trade payment</a> : null}
              {notifications.feePending ? <a href="/admin/withdrawal-fee" className="rounded-full bg-amber-500/10 px-3 py-1 text-amber-200">Fee requested</a> : null}
              {notifications.subscriptionPending ? <a href="/admin/subscription" className="rounded-full bg-amber-500/10 px-3 py-1 text-amber-200">Subscription review</a> : null}
            </div>
          </div>
        ) : null}
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Admin center</p>
          <h1 className="mt-4 text-3xl font-semibold text-[var(--text-white)]">Website administration</h1>
          <p className="mt-3 text-sm text-slate-400">Manage bank assignment flows, deposit controls, user access, and administration features from one panel.</p>
        </div>

        {autoTradePurchase?.status === 'Reviewing' ? (
          <Link href="/admin/auto-trade" className="block rounded-3xl border border-amber-400/40 bg-amber-500/10 p-6 shadow-lg shadow-amber-950/20 transition hover:bg-amber-500/15">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">Action required</p>
            <h2 className="mt-2 text-2xl font-semibold text-amber-100">Auto-trade payment awaiting approval</h2>
            <p className="mt-2 text-sm text-amber-200/80">{autoTradePurchase.planName} plan payment is stored and ready for confirmation. Open the auto-trade section to approve it.</p>
          </Link>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className="block rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-6 text-sm text-[var(--text-primary)] shadow-[0_20px_60px_rgba(15,23,42,0.08)] transition hover:-translate-y-1">
              <p className="text-xl font-semibold text-[var(--text-primary)]">{section.title}</p>
              <p className="mt-3 text-sm text-[var(--text-secondary)]">{section.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
