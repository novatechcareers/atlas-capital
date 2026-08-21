'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { ThemeToggle } from './theme-toggle';
import { getAutoTradePurchase } from '@/lib/auto-trade';
import { getActiveSubscription } from '@/lib/subscription';
import { clearSession, getSession, getScopedStorageKey, getSelectedAdminUser, getSelectedAdminUserId } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { LanguageSelector } from './language-selector';
import { useLanguage } from './language-provider';
import { translatePageText } from '@/lib/i18n';

const links = [
  { href: '/admin', label: 'Home', icon: '🏠' },
  { href: '/admin/deposit', label: 'Deposit admin', icon: '🏦' },
  { href: '/admin/auto-trade', label: 'Auto trade', icon: '🤖' },
  { href: '/admin/subscription', label: 'Subscriptions', icon: '◈' },
  { href: '/admin/withdrawal-fee', label: 'Withdrawal fee', icon: '💳' },
  { href: '/admin/verify-account', label: 'Verify accounts', icon: '📝' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/reports', label: 'Reports', icon: '📊' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙' },
];

export function AdminShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, t } = useLanguage();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [hasPendingVerification, setHasPendingVerification] = useState(false);
  const [hasPendingAutoTrade, setHasPendingAutoTrade] = useState(false);
  const [hasPendingFeeRequest, setHasPendingFeeRequest] = useState(false);
  const [hasPendingSubscription, setHasPendingSubscription] = useState(false);

  useEffect(() => {
    let selectionTimer: number | null = null;
    let syncSelectedUser: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      const session = getSession();
      if (!session || session.role !== 'admin') {
        router.replace('/login');
        return;
      }

      syncSelectedUser = () => setSelectedUserId(getSelectedAdminUserId());
      syncSelectedUser();
      window.addEventListener('storage', syncSelectedUser);
      selectionTimer = window.setInterval(syncSelectedUser, 1000);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      if (syncSelectedUser) window.removeEventListener('storage', syncSelectedUser);
      if (selectionTimer) window.clearInterval(selectionTimer);
    };
  }, [router]);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    let realtimeChannel: any = null;

    const checkPendingRequests = async () => {
      // only poll when the tab is active to avoid excessive server load and noisy logs
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

      const selectedUserId = getSelectedAdminUserId();
      if (!selectedUserId) {
        // no specific user selected — check global admin notifications
        try {
          const resp = await fetch('/api/admin/notifications');
          if (!resp.ok) return;
          const payload = await resp.json();
          setHasPendingRequest(Boolean(payload?.depositPending));
          setHasPendingVerification(Boolean(payload?.verificationPending));
          setHasPendingAutoTrade(Boolean(payload?.autoTradePending));
          setHasPendingFeeRequest(Boolean(payload?.feePending));
          setHasPendingSubscription(Boolean(payload?.subscriptionPending));
        } catch {
          // ignore
        }
        return;
      }

      try {
        const resp = await fetch(`/api/admin/notifications?userId=${encodeURIComponent(selectedUserId)}`);
        if (!resp.ok) {
          return;
        }
        const payload = await resp.json();
        setHasPendingRequest(Boolean(payload?.depositPending));
        setHasPendingVerification(Boolean(payload?.verificationPending));
        setHasPendingAutoTrade(Boolean(payload?.autoTradePending));
        setHasPendingFeeRequest(Boolean(payload?.feePending));
        setHasPendingSubscription(Boolean(payload?.subscriptionPending));
      } catch {
        // ignore network errors; keep previous state
      }
    };

    const update = () => { void checkPendingRequests(); };
    update();
    // use a longer interval to reduce server and console noise
    const timer = window.setInterval(update, 10000);

    // Listen for cross-tab/local events from deposit clients to update UI instantly
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('atlas-admin');
      channel.addEventListener('message', (ev) => {
        try {
          const msg = ev.data;
          if (!msg || typeof msg !== 'object') return;
          if (msg.type === 'deposit-created') {
            const selected = getSelectedAdminUserId();
            // if the created deposit is for the currently selected user (or no selection), show pending
            if (!selected || selected === msg.userId) {
              setHasPendingRequest(true);
            }
          }
        } catch (e) {
          // ignore
        }
      });
    }

    // visibilitychange: trigger immediate poll when tab becomes visible
    const onVisibility = () => { if (document.visibilityState === 'visible') void checkPendingRequests(); };
    document.addEventListener('visibilitychange', onVisibility);

    // Supabase Realtime: subscribe to table changes for the selected user and for the global admin overview.
    try {
      const supabase = getSupabase();
      const selected = getSelectedAdminUserId();
      if (supabase) {
        const globalRealtimeTables = ['deposit_requests', 'verification_requests', 'auto_trade_purchases', 'subscriptions', 'withdrawal_requests'];
        const listenToTable = (table: string, filter?: string) => {
          realtimeChannel = supabase.channel(filter ? `admin-notify-${table}-${selected ?? 'global'}` : `admin-global-notify-${table}`)
            .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
              void checkPendingRequests();
            });
          return realtimeChannel;
        };

        if (selected) {
          const selectedChannel = supabase.channel(`admin-notify-${selected}`);
          selectedChannel
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deposit_requests', filter: `user_id=eq.${selected}` }, (payload: any) => {
              const rec = payload.new || payload.record || payload;
              if (rec && (rec.status === 'Pending' || rec.status === 'Confirmed') && rec.gateway === 'bank') {
                setHasPendingRequest(true);
              }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deposit_requests', filter: `user_id=eq.${selected}` }, (payload: any) => {
              const rec = payload.new || payload.record || payload;
              if (!rec) return;
              if ((rec.status === 'Pending' || rec.status === 'Confirmed') && rec.gateway === 'bank') {
                setHasPendingRequest(true);
              } else if (rec.status === 'Approved') {
                void checkPendingRequests();
              }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'user_bank_accounts', filter: `user_id=eq.${selected}` }, () => {
              void checkPendingRequests();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_requests', filter: `user_id=eq.${selected}` }, () => {
              void checkPendingRequests();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'auto_trade_purchases', filter: `user_id=eq.${selected}` }, () => {
              void checkPendingRequests();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${selected}` }, () => {
              void checkPendingRequests();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawal_requests', filter: `user_id=eq.${selected}` }, () => {
              void checkPendingRequests();
            })
            .subscribe();
          realtimeChannel = selectedChannel;
        } else {
          const globalChannel = supabase.channel('admin-global-pending');
          globalChannel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'deposit_requests' }, () => { void checkPendingRequests(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'verification_requests' }, () => { void checkPendingRequests(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'auto_trade_purchases' }, () => { void checkPendingRequests(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => { void checkPendingRequests(); })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawal_requests' }, () => { void checkPendingRequests(); })
            .subscribe();
          realtimeChannel = globalChannel;
        }
      }
    } catch (e) {
      // ignore realtime subscribe errors (fallback to polling/BroadcastChannel)
    }

    return () => {
      window.clearInterval(timer);
      if (channel) channel.close();
      document.removeEventListener('visibilitychange', onVisibility);
      if (realtimeChannel && typeof realtimeChannel.unsubscribe === 'function') {
        try { realtimeChannel.unsubscribe(); } catch { /* ignore */ }
      }
    };
  }, []);

  const selectedUser = selectedUserId ? getSelectedAdminUser() : null;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full border-b border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 lg:w-72 lg:border-b-0 lg:border-r">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:var(--primary-gold)]/40 bg-[color:var(--primary-gold)]/10 text-3xl font-semibold text-[color:var(--primary-gold)]" aria-label="Atlas Capital A logo">
              A
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Atlas Admin</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">Operations</p>
            </div>
          </div>

          <nav className="space-y-2">
            {links.map((link) => {
              const active = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? 'bg-[color:var(--primary-gold)]/15 text-[color:var(--primary-gold)] shadow-[0_0_24px_rgba(218,183,95,0.16)]'
                      : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--primary-gold)]/10 hover:text-[color:var(--text-primary)]'
                  }`}
                >
                  <span className="text-base">{link.icon}</span>
                  <span>{t(link.label === 'Home' ? 'adminHome' : link.label === 'Deposit admin' ? 'adminDeposit' : link.label === 'Auto trade' ? 'adminAutoTrade' : link.label === 'Subscriptions' ? 'adminSubscriptions' : link.label === 'Withdrawal fee' ? 'adminFee' : link.label === 'Verify accounts' ? 'adminVerify' : link.label === 'Users' ? 'adminUsers' : link.label === 'Reports' ? 'adminReports' : 'adminSettings')}</span>
                  {link.href === '/admin/deposit' && hasPendingRequest ? (
                    <span className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  ) : null}
                  {link.href === '/admin/verify-account' && hasPendingVerification ? (
                    <span className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  ) : null}
                  {link.href === '/admin/auto-trade' && hasPendingAutoTrade ? (
                    <span className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                  ) : null}
                  {link.href === '/admin/withdrawal-fee' && hasPendingFeeRequest ? (
                    <span className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                  ) : null}
                  {link.href === '/admin/subscription' && hasPendingSubscription ? (
                    <span className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => {
              clearSession();
              router.replace('/login');
            }}
            className="mt-auto w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-left text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
          >
            Log out
          </button>
        </aside>

        <main className="flex-1 bg-[radial-gradient(circle_at_top_left,var(--hero-glow),transparent_28%)] p-5 lg:p-8">
          <header className="brand-panel-strong mb-8 flex flex-col gap-4 rounded-3xl p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{t('adminPortal')}</p>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{translatePageText(language, title)}</h1>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{translatePageText(language, subtitle)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <LanguageSelector />
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-2 text-sm text-[color:var(--text-secondary)]">
                <span className="font-semibold text-[color:var(--text-primary)]">{t('adminConsole')}</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2">
                <Image src="/logo.svg" alt="Atlas Capital logo" width={72} height={24} className="h-6 w-auto" />
                <div className="text-sm text-[color:var(--text-secondary)]">{selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : t('chooseUser')}</div>
              </div>
              <ThemeToggle />
            </div>
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}
