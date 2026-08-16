'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { CandlestickChart } from '@/components/candlestick-chart';
import { formatCurrency, getStoredBalance, subscribeToBalance } from '@/lib/balance';
import { getAutoTradeHistory } from '@/lib/auto-trade';

const summaryCards = [
  { label: 'BALANCE', value: undefined, subtitle: 'Live account total' },
  { label: 'PROFIT', value: undefined, subtitle: 'Auto-trade P&L history', href: '/dashboard/auto-trade' },
  { label: 'BONUS', value: undefined, subtitle: 'Referral rewards', href: '/dashboard/subscription' },
  { label: 'DEPOSITS', value: undefined, subtitle: 'Open deposit page', href: '/dashboard/deposit' },
];

const quickActions = [
  { title: 'Deposit', href: '/dashboard/deposit', style: 'bg-gradient-to-r from-[#DAB75F] via-[#C6A15B] to-[#A67D38] text-[#04111e] shadow-[0_18px_40px_rgba(218,183,95,0.22)]' },
  { title: 'Withdrawal', href: '/dashboard/withdrawal', style: 'border border-[color:var(--border-soft)] bg-[color:var(--surface)] text-[color:var(--text-primary)] shadow-[0_14px_32px_rgba(15,23,42,0.08)]' },
  { title: 'Subscribe', href: '/dashboard/subscription', style: 'bg-[color:var(--surface-elevated)] text-[color:var(--text-primary)] shadow-[0_14px_32px_rgba(15,23,42,0.08)]' },
];

const tradeTickerItems = [
  { symbol: 'AAPL', change: '+1.42%', volume: '1.2M' },
  { symbol: 'TSLA', change: '+0.81%', volume: '850k' },
  { symbol: 'BTC/USD', change: '+2.76%', volume: '3.8k' },
  { symbol: 'ETH/USD', change: '+1.44%', volume: '2.1k' },
  { symbol: 'EUR/USD', change: '+0.08%', volume: '4.6M' },
  { symbol: 'NFLX', change: '+0.55%', volume: '620k' },
];

export default function DashboardPage() {
  const [balance, setBalance] = useState(0);
  const [botProfit, setBotProfit] = useState(0);

  useEffect(() => {
    setBalance(getStoredBalance());
    const unsubscribe = subscribeToBalance(setBalance);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const syncProfit = () => {
      const total = getAutoTradeHistory().reduce((sum, entry) => sum + entry.result, 0);
      setBotProfit(Math.round(total * 100) / 100);
    };

    syncProfit();
    const timer = window.setInterval(syncProfit, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const balanceCards = useMemo(
    () =>
      summaryCards.map((card) =>
        card.label === 'BALANCE'
          ? { ...card, value: formatCurrency(balance) }
          : card.label === 'PROFIT'
            ? { ...card, value: formatCurrency(botProfit) }
          : card,
      ),
    [balance, botProfit],
  );

  return (
    <DashboardShell title="Dashboard" subtitle="Portfolio and market overview.">
      <div className="space-y-6 relative">
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 max-w-[100%] mx-auto">
          {balanceCards.map((card) => {
            const cardClasses = 'group min-w-0 rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-6 shadow-[0_32px_80px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:border-[color:var(--primary-gold)]/30';
            const cardContent = (
              <div className="h-full">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.45em] text-[color:var(--text-secondary)]">{card.label}</p>
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <p className="mt-5 text-4xl font-semibold leading-none text-[color:var(--text-primary)]">
                  {card.value ?? '—'}
                </p>
                <p className="mt-3 text-sm text-[color:var(--text-secondary)]">{card.subtitle}</p>
              </div>
            );

            return card.href ? (
              <Link key={card.label} href={card.href} className={`${cardClasses} cursor-pointer`}>
                {cardContent}
              </Link>
            ) : (
              <div key={card.label} className={cardClasses}>
                {cardContent}
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 max-w-[100%] mx-auto">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className={`rounded-full px-6 py-4 text-center text-sm font-semibold transition ${action.style}`}
            >
              {action.title}
            </Link>
          ))}
        </div>

        <div className="space-y-4 rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4 shadow-[0_24px_72px_rgba(15,23,42,0.08)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--primary-gold)]">TradeView</p>
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Streaming market momentum and stock move percentages.</p>
            </div>
            <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-[color:var(--text-secondary)]">Live</span>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] py-3">
            <div className="ticker-track flex items-center gap-8 px-4">
              {tradeTickerItems.concat(tradeTickerItems).map((item, index) => (
                <div key={`${item.symbol}-${index}`} className="flex items-center gap-3 whitespace-nowrap text-sm text-[color:var(--text-primary)]">
                  <span className="font-semibold">{item.symbol}</span>
                  <span className={`${item.change.startsWith('+') ? 'text-emerald-500' : 'text-rose-500'}`}>{item.change}</span>
                  <span className="text-[color:var(--text-secondary)]">{item.volume}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.8fr_1fr] max-w-[100%] mx-auto">
          <div>
            <CandlestickChart />
          </div>

          <div className="space-y-4">
            <div className="rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 shadow-[0_24px_72px_rgba(15,23,42,0.08)]">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--primary-gold)]">FX watch</p>
              <div className="mt-4 space-y-3">
                {[
                  { pair: 'EUR/USD', rate: '1.0824' },
                  { pair: 'GBP/USD', rate: '1.2631' },
                  { pair: 'USD/JPY', rate: '147.54' },
                ].map((item) => (
                  <div key={item.pair} className="flex items-center justify-between rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-4 py-3">
                    <span className="text-sm font-medium text-[color:var(--text-primary)]">{item.pair}</span>
                    <span className="text-sm font-semibold text-[color:var(--text-secondary)]">{item.rate}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
