'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';
import { subscribeToBalance, syncBalanceFromServer } from '@/lib/balance';
import { clearSession, getSession, type AuthSession } from '@/lib/auth';
import { formatLocalizedCurrency, translatePageText } from '@/lib/i18n';
import { LanguageSelector } from './language-selector';
import { useLanguage } from './language-provider';
import { useEffect, useMemo, useState } from 'react';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: '⌂' },
  { href: '/dashboard/auto-trade', label: 'Auto Trade', icon: '⚙' },
  { href: '/dashboard/deposit', label: 'Deposit', icon: '⬆' },
  { href: '/dashboard/withdrawal', label: 'Withdrawal', icon: '⬇' },
  { href: '/dashboard/subscription', label: 'Subscription', icon: '◈' },
  { href: '/dashboard/verify-account', label: 'Verify Account', icon: '✓' },
  { href: '/dashboard/profile', label: 'Profile', icon: '◌' },
  { href: '/dashboard/live-trade', label: 'Live Trade', icon: '↗' },
];

export function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, t } = useLanguage();
  const [balance, setBalance] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession) {
      router.replace('/login');
      return;
    }

    setSession(currentSession);

    const unsubscribe = subscribeToBalance(setBalance);
    void syncBalanceFromServer(currentSession.id).then((nextBalance) => {
      if (typeof nextBalance === 'number' && Number.isFinite(nextBalance)) {
        setBalance(nextBalance);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [router]);

  const balanceLabel = useMemo(() => formatLocalizedCurrency(balance, language), [balance, language]);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] overflow-x-hidden">
      <div className="flex min-h-screen flex-col lg:flex-row">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden"
        />
      )}

      <aside className={`fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 overflow-y-auto transition-transform duration-300 lg:static lg:z-auto lg:w-72 lg:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="mb-8 flex items-center gap-1">
            <Image src="/image/icon.png" alt="Atlas Capital icon" width={96} height={96} className="h-24 w-24 object-contain" />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Atlas</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">Capital</p>
            </div>
          </div>

          <nav className="space-y-2">
            {links.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== '/dashboard' && pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? 'bg-[color:var(--primary-gold)]/15 text-[color:var(--primary-gold)] shadow-[0_0_24px_rgba(218,183,95,0.16)]'
                      : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--primary-gold)]/10 hover:text-[color:var(--text-primary)]'
                  }`}
                >
                  <span className="text-base">{link.icon}</span>
                  <span>{t(link.label === 'Dashboard' ? 'dashboard' : link.label === 'Auto Trade' ? 'autoTrade' : link.label === 'Deposit' ? 'deposit' : link.label === 'Withdrawal' ? 'withdrawal' : link.label === 'Subscription' ? 'subscription' : link.label === 'Verify Account' ? 'verifyAccount' : link.label === 'Profile' ? 'profile' : 'liveTrade')}</span>
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
            className="mt-auto hidden w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-left text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 lg:block"
          >
            Log out
          </button>
        </aside>

        <main className="min-h-screen min-w-0 flex-1 bg-[radial-gradient(circle_at_top_left,var(--hero-glow),transparent_28%)] p-3 sm:p-6 lg:p-8">
          <header className="brand-panel-strong mb-6 flex min-w-0 flex-col gap-4 rounded-3xl p-4 sm:mb-8 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <button
                type="button"
                aria-label="Open navigation"
                onClick={() => setMobileNavOpen(true)}
                className="mb-4 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2 text-lg text-[color:var(--text-primary)] lg:hidden"
              >
                ☰
              </button>
              <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{t('clientPortal')}</p>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">{translatePageText(language, title)}</h1>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{translatePageText(language, subtitle)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <LanguageSelector />
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-2 text-sm text-[color:var(--text-secondary)]">
                {t('balance')}: <span className="font-semibold text-[color:var(--text-primary)]">{balanceLabel}</span>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2">
                <Image src="/logo.svg" alt="Atlas Capital logo" width={72} height={24} className="h-6 w-auto" />
                <div className="text-sm text-[color:var(--text-secondary)]">{session?.name ?? t('newUser')}</div>
              </div>
              <ThemeToggle />
              <button
                type="button"
                onClick={() => {
                  clearSession();
                  router.replace('/login');
                }}
                className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
              >
                {t('logout')}
              </button>
            </div>
          </header>

          {children}
        </main>
      </div>
    </div>
  );
}
