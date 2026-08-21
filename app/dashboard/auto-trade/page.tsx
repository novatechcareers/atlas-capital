 'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { canAfford, formatCurrency, getStoredBalance, subscribeToBalance, syncBalanceFromServer } from '@/lib/balance';
import {
  type AutoTradePurchase,
  getAutoTradePurchase,
  getAutoTradeHistory,
  type AutoTradeHistoryEntry,
  saveAutoTradePurchase,
  subscribeToAutoTrade,
  subscribeToAutoTradeHistory,
  syncAutoTradeFromServer,
} from '@/lib/auto-trade';
import { useLanguage } from '@/components/language-provider';
import { translatePageText } from '@/lib/i18n';

const plans = [
  {
    name: 'Starter',
    price: 300,
    duration: '3 days',
    features: ['Basic bot access', 'Daily trade alerts', 'Risk control setup'],
  },
  {
    name: 'Pro',
    price: 500,
    duration: '7 days',
    features: ['All Starter tools', 'Advanced automation rules', 'Priority signal delivery'],
  },
  {
    name: 'Elite',
    price: 1000,
    duration: '12 days',
    features: ['All Pro features', 'VIP strategy customization', 'Performance analytics'],
  },
];

export default function AutoTradePage() {
  const { language } = useLanguage();
  const tr = (text: string) => translatePageText(language, text);
  const [balance, setBalance] = useState(0);
  const [purchase, setPurchase] = useState<AutoTradePurchase | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<(typeof plans)[number] | null>(null);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<AutoTradeHistoryEntry[]>([]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    setBalance(getStoredBalance());
    return subscribeToBalance(setBalance);
  }, []);

  useEffect(() => {
    const syncLatest = async () => {
      const latest = await syncAutoTradeFromServer();
      setPurchase(latest ?? getAutoTradePurchase());
    };

    void syncLatest();
    const unsubscribe = subscribeToAutoTrade((next) => setPurchase(next ?? getAutoTradePurchase()));
    const timer = window.setInterval(() => void syncLatest(), 2000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAutoTradeHistory(setHistory);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!purchase) return;

    if (purchase.status === 'Reviewing') {
      setMessage(tr('Payment under review.'));
    } else if (purchase.status === 'Running') {
      setMessage(tr('Payment confirmed. Auto trade is active.'));
    } else if (purchase.status === 'Unlocked') {
      setMessage(tr('Payment confirmed. Auto trade is ready.'));
    } else if (purchase.status === 'Stopped') {
      setMessage(tr('Your auto-trade bot is currently stopped.'));
    }
  }, [purchase]);

  const handlePurchase = async () => {
    if (!selectedPlan) return;
    if (!canAfford(selectedPlan.price)) {
      setMessage(tr('Insufficient balance. Please top up your account before purchasing an auto-trade plan.'));
      return;
    }

    const now = Date.now();
    const nextPurchase: AutoTradePurchase = {
      id: now,
      planName: selectedPlan.name,
      price: selectedPlan.price,
      status: 'Reviewing',
      createdAt: now,
      updatedAt: now,
    };

    // Send to database and wait for it to complete
    try {
      const userId = await new Promise<string | null>((resolve) => {
        // Get current user ID from session storage
        if (typeof window !== 'undefined') {
          const session = window.sessionStorage?.getItem('atlas-session');
          if (session) {
            try {
              resolve(JSON.parse(session)?.id || null);
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });

      if (userId) {
        const response = await fetch('/api/auto-trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            planName: selectedPlan.name,
            price: selectedPlan.price,
            status: 'Reviewing',
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || 'Unable to save auto-trade purchase.');
        }

        // Sync from server to get the canonical database record
        const latest = await syncAutoTradeFromServer();
        if (!latest) throw new Error('Unable to load the saved auto-trade purchase.');
        saveAutoTradePurchase(latest);
        setPurchase(latest);
      }
    } catch (err) {
      console.error('Failed to sync auto-trade to database:', err);
      setMessage(tr('Unable to save your auto-trade purchase. Please try again.'));
      return;
    }

    await syncBalanceFromServer();
    setSelectedPlan(null);
    setMessage(tr('Payment received and under review.'));
  };

  const planDays = purchase?.planName === 'Starter' ? 3 : purchase?.planName === 'Pro' ? 7 : 12;
  const expiresAt = purchase?.activatedAt ? purchase.activatedAt + planDays * 24 * 60 * 60 * 1000 : 0;
  const remainingDays = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000))) : planDays;
  const botIsReady = purchase?.status === 'Unlocked' || purchase?.status === 'Running' || purchase?.status === 'Stopped';
  const totalProfit = useMemo(() => history.reduce((total, entry) => total + entry.result, 0), [history]);

  return (
    <DashboardShell title="Auto Trade" subtitle="Plans and automation status.">
      <div className="space-y-6">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.92)] p-5 shadow-lg shadow-black/30">
          <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{tr('Available balance')}</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--text-white)]">{formatCurrency(balance)}</p>
        </div>

        {message ? <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div> : null}

        {botIsReady ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-[color:var(--primary-gold)]/30 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-full border-2 border-[color:var(--primary-gold)] text-3xl ${purchase?.status === 'Running' ? 'animate-spin' : ''}`}>⚙</div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{purchase?.status === 'Running' ? tr('Bot active') : tr('Bot ready')}</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[var(--text-white)]">{purchase?.planName} auto trade</h2>
                  </div>
                </div>
                <div className="rounded-2xl bg-[color:var(--primary-gold)]/10 px-5 py-4 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{tr('Time remaining')}</p>
                      <p className="mt-1 text-3xl font-semibold text-[color:var(--primary-gold)]">{remainingDays} {tr('days')}</p>
                </div>
              </div>
              <p className="mt-5 text-sm text-slate-300">{tr('The bot is controlled by the administrator. Your plan status and countdown are saved across refreshes.')}</p>
            </div>

            <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{tr('Bot P&L history')}</p>
                  <p className={`mt-2 text-3xl font-semibold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(totalProfit)}</p>
                </div>
                    <span className="text-sm text-slate-400">{history.length} {tr('recorded trades')}</span>
              </div>
              <div className="mt-5 space-y-3">
                {history.length ? history.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-[color:var(--surface-elevated)] px-4 py-3 text-sm">
                    <span className="text-slate-300">{entry.asset} <span className="text-slate-500">{new Date(entry.createdAt).toLocaleTimeString()}</span></span>
                    <span className={entry.result >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{entry.result >= 0 ? '+' : ''}{formatCurrency(entry.result)}</span>
                  </div>
                )) : <p className="text-sm text-slate-400">{tr('No bot trades have been recorded yet.')}</p>}
              </div>
            </div>
          </div>
        ) : null}

        {!botIsReady ? <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => {
          const isPurchased = purchase?.planName === plan.name;
          return (
          <div key={plan.name} className={`relative rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.92)] p-6 shadow-lg shadow-black/30 ${isPurchased ? 'cursor-not-allowed opacity-80' : ''}`}>
            {isPurchased ? <div className="absolute left-[-2.5rem] top-8 w-[calc(100%+5rem)] rotate-[-12deg] bg-[color:var(--primary-gold)] px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.25em] text-[color:var(--bg-dark-navy)]">{tr('Payment')} {purchase.status === 'Reviewing' ? tr('under review') : tr(purchase.status)}</div> : null}
            <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{tr(plan.duration)}</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--text-white)]">{plan.name}</h2>
            <p className="mt-4 text-sm text-slate-400">{tr('A premium automation package designed for steady growth and transparent reporting.')}</p>
                <p className="mt-6 text-4xl font-semibold text-[var(--text-white)]">{formatCurrency(plan.price)}</p>
            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              {plan.features.map((feature) => (
                <li key={feature} className="rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-3">{tr(feature)}</li>
              ))}
            </ul>
            <button
              type="button"
              disabled={isPurchased}
              onClick={() => setSelectedPlan(plan)}
              className="mt-6 w-full rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
                  {isPurchased ? tr('Plan purchased') : tr('Select plan')}
            </button>
          </div>
          );
        })}
        </div> : null}

        {selectedPlan ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-3xl border border-[color:var(--primary-gold)]/30 bg-[rgba(4,16,33,0.98)] p-6 shadow-2xl">
                  <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{tr('Auto-trade payment')}</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--text-white)]">{selectedPlan.name} plan</h2>
                  <p className="mt-3 text-sm text-slate-300">{tr('Payment:')} {formatCurrency(selectedPlan.price)} {tr('After payment, admin approval is required before the bot starts.')}</p>
                  {!canAfford(selectedPlan.price) ? <p className="mt-4 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-200">{tr('Insufficient balance. Please top up before continuing.')}</p> : null}
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setSelectedPlan(null)} className="w-full rounded-2xl border border-slate-700 px-4 py-3 text-sm text-slate-300">{tr('Cancel')}</button>
                <button type="button" onClick={handlePurchase} className="w-full rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)]">{tr('Pay and submit')}</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
