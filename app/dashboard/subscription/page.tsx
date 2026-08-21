'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { getUserStorageKey } from '@/lib/auth';
import { formatCurrency, getStoredBalance, subscribeToBalance, syncBalanceFromServer } from '@/lib/balance';
import { getActiveSubscription, saveActiveSubscription, subscribeToSubscription, syncSubscriptionFromServer, type ActiveSubscription } from '@/lib/subscription';

const tiers = [
  {
    name: 'Silver',
    price: 800,
    period: '30 days trading period',
    bonus: '20% cashback bonus',
    features: ['Auto trade access', 'Priority support', 'Daily market updates'],
  },
  {
    name: 'Gold',
    price: 1500,
    period: '60 days trading period',
    bonus: '30% cashback bonus',
    features: ['Auto trade access', 'Premium analytics', 'Margin strategy alerts'],
  },
  {
    name: 'Platinum',
    price: 3000,
    period: '90 days trading period',
    bonus: '50% cashback bonus',
    features: ['Full auto trade suite', 'Dedicated account manager', 'Cashback rewards', 'Advanced premium signals'],
  },
];

type SubscriptionTier = (typeof tiers)[number];

type PurchasedSubscription = {
  id: number;
  name: string;
  price: number;
  status: 'Reviewing' | 'Active';
};

export default function SubscriptionPage() {
  const [balance, setBalance] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [subscriptions, setSubscriptions] = useState<PurchasedSubscription[]>([]);
  const [activeSubscription, setActiveSubscription] = useState<ActiveSubscription | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    setBalance(getStoredBalance());
    const unsubscribe = subscribeToBalance(setBalance);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const syncLatest = async () => {
      const latest = await syncSubscriptionFromServer();
      setActiveSubscription(latest ?? getActiveSubscription());
    };

    void syncLatest();
    const unsubscribe = subscribeToSubscription((next) => setActiveSubscription(next ?? getActiveSubscription()));
    const timer = window.setInterval(() => void syncLatest(), 2000);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(getUserStorageKey('atlas-subscriptions'));
    if (stored) {
      try {
        setSubscriptions(JSON.parse(stored));
      } catch {
        setSubscriptions([]);
      }
    }
  }, []);

  const [showDetails, setShowDetails] = useState(false);

  const handleShowDetails = (plan: SubscriptionTier) => {
    setSelectedPlan(plan);
    setMessage(null);
    setShowDetails(true);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
  };

  const currentSubscription = activeSubscription?.status === 'Rejected' ? null : activeSubscription;
  const getAmountDue = (plan: SubscriptionTier) => currentSubscription ? plan.price - currentSubscription.price : plan.price;

  const handlePurchase = async (plan: SubscriptionTier) => {
    if (isPurchasing) return;

    const amountDue = getAmountDue(plan);
    if (currentSubscription && amountDue <= 0) {
      setMessage({ type: 'error', text: 'This plan is not an upgrade from your current subscription.' });
      return;
    }

    setIsPurchasing(true);
    const serverBalance = await syncBalanceFromServer();
    setBalance(serverBalance);
    if (serverBalance < amountDue) {
      setIsPurchasing(false);
      setMessage({
        type: 'error',
        text: `Insufficient balance. Please go to deposit to top up the ${formatCurrency(amountDue)} required for this subscription payment.`,
      });
      return;
    }

    // Send to database and wait for it to complete
    try {
      const userId = await new Promise<string | null>((resolve) => {
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

      if (!userId) throw new Error('Unable to identify account.');
      {
        const response = await fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            name: plan.name,
            price: plan.price,
            amount: amountDue,
            status: 'Reviewing',
          }),
        });

        if (!response.ok) throw new Error('Unable to save subscription payment.');
        const latest = await syncSubscriptionFromServer();
        if (!latest) throw new Error('Unable to load saved subscription.');
        saveActiveSubscription(latest);
        setActiveSubscription(latest);
        const nextSubscriptions = [latest, ...subscriptions];
        setSubscriptions(nextSubscriptions as unknown as PurchasedSubscription[]);
        window.localStorage.setItem(getUserStorageKey('atlas-subscriptions'), JSON.stringify(nextSubscriptions));
      }
    } catch (err) {
      console.error('Failed to sync subscription to database:', err);
      setMessage({ type: 'error', text: 'Unable to save subscription payment. Please try again.' });
      setIsPurchasing(false);
      return;
    }

    const updatedBalance = await syncBalanceFromServer();
    setBalance(updatedBalance);
    setMessage({
      type: 'success',
      text: currentSubscription ? 'Upgrade payment received and under review.' : 'Payment received and under review.',
    });
    setShowDetails(false);
    setIsPurchasing(false);
  };

  return (
    <DashboardShell title="Subscription Plans" subtitle="Plans and account status.">
      <div className="space-y-6 relative">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Account balance</p>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--text-white)]">{formatCurrency(balance)}</h2>
            </div>
            <Link
              href="/dashboard/deposit"
              className="inline-flex rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90"
            >
              Top up balance
            </Link>
          </div>
        </div>

        {message ? (
          <div className={`rounded-3xl border px-5 py-4 text-sm ${message.type === 'error' ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
            {message.text}
          </div>
        ) : null}

        {activeSubscription?.status === 'Rejected' ? (
          <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-6 text-sm text-rose-200">Your previous subscription was reset because the duration has ended. You can choose another plan below.</div>
        ) : null}

        {currentSubscription ? (
          <div className="grid gap-8 xl:grid-cols-[1.3fr_0.95fr]">
            <div className="rounded-3xl border border-[color:var(--primary-gold)]/30 bg-[rgba(4,16,33,0.94)] p-8 shadow-lg shadow-black/30">
              <div className="flex flex-col items-center text-center">
                <div className={`flex h-24 w-24 items-center justify-center rounded-full border-2 border-[color:var(--primary-gold)] text-5xl text-[color:var(--primary-gold)] ${currentSubscription.status === 'Reviewing' ? 'animate-spin' : ''}`}>◈</div>
                <p className="mt-6 text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{currentSubscription.status === 'Reviewing' ? 'Subscription loading' : 'Subscription active'}</p>
                <h2 className="mt-3 text-3xl font-semibold text-[var(--text-white)]">{currentSubscription.name} subscription</h2>
                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">
                  {currentSubscription.status === 'Reviewing' ? 'Payment is under review.' : 'Subscription is active.'}
                </p>
                <p className="mt-6 rounded-2xl bg-[color:var(--primary-gold)]/10 px-5 py-3 text-sm font-semibold text-[color:var(--primary-gold)]">{currentSubscription.status}</p>
              </div>
            </div>
            <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
              <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Upgrade options</p>
              <p className="mt-3 text-sm text-slate-400">Available upgrades.</p>
              <div className="mt-5 space-y-3">
                {tiers.filter((tier) => tier.price > currentSubscription.price).map((tier) => (
                  <button key={tier.name} type="button" onClick={() => handleShowDetails(tier)} className="w-full rounded-2xl border border-[color:var(--primary-gold)]/30 bg-[color:var(--primary-gold)]/10 p-4 text-left transition hover:bg-[color:var(--primary-gold)]/20">
                    <span className="flex items-center justify-between gap-3"><span className="font-semibold text-[var(--text-white)]">{tier.name}</span><span className="text-[color:var(--primary-gold)]">{formatCurrency(tier.price)}</span></span>
                    <span className="mt-2 block text-xs text-slate-400">{tier.period}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {!currentSubscription ? <div className="grid gap-8 xl:grid-cols-[1.3fr_0.95fr]">
          <div className="grid gap-6 lg:grid-cols-3 items-stretch">
            {tiers.map((tier) => (
              <div key={tier.name} className="flex min-h-[440px] flex-col justify-between rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
                <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--primary-gold)]/10 px-4 py-3 text-center">
                  <h2 className="text-xl font-semibold text-[var(--text-white)]">{tier.name}</h2>
                  <p className="mt-2 text-3xl font-semibold text-[var(--text-white)]">{formatCurrency(tier.price)}</p>
                </div>

                <div className="mt-6 space-y-4 text-sm text-slate-300">
                  <div className="rounded-2xl bg-[color:var(--bg-dark-navy)]/70 px-4 py-3">{tier.period}</div>
                  <div className="rounded-2xl bg-[color:var(--bg-dark-navy)]/70 px-4 py-3">{tier.bonus}</div>
                  <div className="rounded-2xl bg-[color:var(--bg-dark-navy)]/70 px-4 py-3">Includes auto trade and cashback bonus</div>
                </div>

                <div className="mt-8 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => handleShowDetails(tier)}
                    className="w-full rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90"
                  >
                    Show details
                  </button>
                </div>
              </div>
            ))}
          </div>

          <aside className="space-y-6 rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
            <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-6">
              <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Plan details</p>
              {selectedPlan ? (
                <>
                  <h3 className="mt-4 text-2xl font-semibold text-[var(--text-white)]">{selectedPlan.name}</h3>
                  <p className="mt-2 text-sm text-slate-300">{selectedPlan.period} with premium auto trade capabilities and cashback rewards.</p>
                  <ul className="mt-4 space-y-3 text-sm text-slate-300">
                    {selectedPlan.features.map((feature) => (
                      <li key={feature} className="rounded-2xl bg-[color:var(--bg-dark-navy)]/70 px-4 py-3">{feature}</li>
                    ))}
                  </ul>
                  <div className="mt-5 flex flex-col gap-3">
                    <button
                      type="button"
                      disabled={isPurchasing}
                      onClick={() => void handlePurchase(selectedPlan)}
                      className="w-full rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90"
                    >
                      {isPurchasing ? 'Processing payment...' : currentSubscription ? `Upgrade to ${selectedPlan.name}` : `Purchase ${selectedPlan.name}`}
                    </button>
                    {balance < getAmountDue(selectedPlan) ? (
                      <Link
                        href="/dashboard/deposit"
                        className="inline-flex justify-center rounded-2xl border border-[color:var(--primary-gold)]/20 px-4 py-3 text-sm font-semibold text-[color:var(--text-white)] transition hover:bg-[color:var(--surface)]/40"
                      >
                        Top up to purchase
                      </Link>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-300">Select a subscription plan to view details, premium features, and pricing.</p>
              )}
            </div>

            <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5">
              <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Recent subscriptions</p>
              {subscriptions.length ? (
                <ul className="mt-4 space-y-3 text-sm text-slate-300">
                  {subscriptions.slice(0, 4).map((item) => (
                    <li key={item.id} className="rounded-2xl bg-[color:var(--bg-dark-navy)]/70 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span>{item.name}</span>
                        <span className="font-semibold text-[var(--text-white)]">{formatCurrency(item.price)}</span>
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[color:var(--primary-gold)]">{item.status}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-400">No recent subscription purchases.</p>
              )}
            </div>
          </aside>
        </div> : null}

        {showDetails && selectedPlan ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-3xl rounded-3xl border border-[color:var(--primary-gold)]/30 bg-[rgba(4,16,33,0.98)] p-6 shadow-2xl shadow-black/50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{selectedPlan.name} subscription</p>
                  <h2 className="mt-2 text-3xl font-semibold text-[var(--text-white)]">{formatCurrency(selectedPlan.price)}</h2>
                </div>
                <button
                  type="button"
                  onClick={handleCloseDetails}
                  className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[var(--text-white)] transition hover:bg-[color:var(--surface)]/80"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 text-sm text-slate-300">
                  <p className="font-semibold text-[var(--text-white)]">Premium features</p>
                  <ul className="mt-4 space-y-3">
                    {selectedPlan.features.map((feature) => (
                      <li key={feature} className="rounded-2xl bg-[color:var(--bg-dark-navy)]/70 px-4 py-3">{feature}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 text-sm text-slate-300">
                  <p className="font-semibold text-[var(--text-white)]">Plan details</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-[color:var(--bg-dark-navy)]/70 px-4 py-3">{selectedPlan.period}</div>
                    <div className="rounded-2xl bg-[color:var(--bg-dark-navy)]/70 px-4 py-3">{selectedPlan.bonus}</div>
                    <div className="rounded-2xl bg-[color:var(--bg-dark-navy)]/70 px-4 py-3">High premium features including auto trading, cashback bonus, and advanced analytics.</div>
                  </div>
                  <div className="mt-6 space-y-3">
                    <button
                      type="button"
                      disabled={isPurchasing}
                      onClick={() => void handlePurchase(selectedPlan)}
                      className="w-full rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isPurchasing ? 'Processing payment...' : currentSubscription ? `Upgrade to ${selectedPlan.name}` : `Purchase ${selectedPlan.name}`}
                    </button>
                    {balance < getAmountDue(selectedPlan) ? (
                      <Link
                        href="/dashboard/deposit"
                        className="inline-flex w-full justify-center rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm font-semibold text-[color:var(--text-white)] transition hover:bg-[color:var(--surface)]/40"
                      >
                        Top up balance
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
