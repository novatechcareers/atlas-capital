'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { getCurrentAccountId, getUserStorageKey } from '@/lib/auth';
import { canAfford, formatCurrency, getStoredBalance, subscribeToBalance } from '@/lib/balance';
import { BANK_MINIMUM_WITHDRAWAL, MAX_SELF_SERVICE_WITHDRAWAL, WITHDRAWAL_ADMIN_EMAIL } from '@/lib/withdrawal';

type WithdrawalRequest = {
  id: number;
  amount: number;
  method: string;
  status: 'Fee pending' | 'Pending' | 'Approved' | 'Declined';
  walletAddress?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
};

const storageKey = 'atlas-withdrawal-requests';

export default function BankWithdrawalPage() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [balance, setBalance] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [showAdminContact, setShowAdminContact] = useState(false);

  useEffect(() => {
    const requestedAmount = new URLSearchParams(window.location.search).get('amount');
    if (requestedAmount && !amount) setAmount(requestedAmount);
  }, [amount]);

  useEffect(() => {
    setBalance(getStoredBalance());
    const unsubscribe = subscribeToBalance(setBalance);
    return unsubscribe;
  }, []);

  const numericAmount = Number(amount);
  const belowMinimum = Boolean(amount && numericAmount < BANK_MINIMUM_WITHDRAWAL);
  const canSubmit = Boolean(amount && numericAmount >= BANK_MINIMUM_WITHDRAWAL && bankName && accountName && accountNumber);
  const insufficientBalance = Boolean(amount && numericAmount > 0 && !canAfford(numericAmount));

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (belowMinimum) {
      setMessage('The minimum bank withdrawal is $1,500.00. Please enter a qualifying amount to continue.');
      return;
    }

    if (numericAmount > MAX_SELF_SERVICE_WITHDRAWAL) {
      setShowAdminContact(true);
      return;
    }

    if (!canAfford(numericAmount)) {
      setMessage('Insufficient balance. Deposit funds to top up before withdrawing.');
      return;
    }

    const userId = getCurrentAccountId();
    if (!userId) {
      setMessage('Unable to identify your account. Please sign in again.');
      return;
    }

    try {
      const response = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: numericAmount,
          currency: 'USD',
          method: 'bank',
          bankAccount: {
            bankName,
            accountName,
            accountNumber,
          },
          status: 'Fee pending',
          note: 'Bank withdrawal request submitted',
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to create bank withdrawal request');
      }

      const payload = await response.json();
      const withdrawal = payload?.withdrawal ?? null;
      if (withdrawal) {
        const localRequests = window.localStorage.getItem(getUserStorageKey(storageKey));
        const requests: WithdrawalRequest[] = localRequests ? JSON.parse(localRequests) : [];
        const nextRequests = [withdrawal, ...requests];
        window.localStorage.setItem(getUserStorageKey(storageKey), JSON.stringify(nextRequests));
        window.localStorage.setItem(getUserStorageKey('atlas-withdrawal-last-action'), JSON.stringify({ type: 'bank-request', request: withdrawal }));

        const channel = new BroadcastChannel('atlas-withdrawal-requests');
        channel.postMessage({ type: 'requests-updated', requests: nextRequests, userId });
        channel.close();

        router.push(`/dashboard/withdrawal/fee?requestId=${encodeURIComponent(String(withdrawal.id))}`);
        return;
      }
    } catch {
      setMessage('Unable to connect to the withdrawal service. Please try again.');
    }
  };

  const balanceLabel = useMemo(() => formatCurrency(balance), [balance]);

  return (
    <DashboardShell title="Bank Withdrawal" subtitle="Enter your bank account details for withdrawal review.">
      <div className="mx-auto max-w-3xl rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
        <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--primary-gold)]/10 px-5 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Bank transfer</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-white)]">Provide account details</h2>
          <p className="mt-3 text-sm text-slate-300">Bank withdrawals require a minimum amount of $1,500.00. Amounts above $4,000 require administrator assistance.</p>
        </div>

        <div className="mt-4 rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--surface)]/10 p-4 text-sm text-slate-300">
          Available balance: <span className="font-semibold text-[var(--text-white)]">{balanceLabel}</span>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Withdrawal amount</label>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
              placeholder="Enter amount"
              inputMode="decimal"
            />
            <p className="mt-2 text-sm text-slate-400">Minimum bank withdrawal: $1,500.00</p>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Bank name</label>
            <input
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
              placeholder="Enter bank name"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Account holder name</label>
            <input
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
              placeholder="Enter account holder name"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Account number</label>
            <input
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
              placeholder="Enter account number"
            />
          </div>

          {message ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm ${insufficientBalance ? 'border-rose-400/40 bg-rose-500/10 text-rose-200' : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'}`}>
              {message}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Submit bank withdrawal request
            </button>
            <Link href="/dashboard/withdrawal" className="rounded-2xl border border-[color:var(--primary-gold)]/20 px-4 py-3 text-sm text-slate-300 transition hover:bg-[color:var(--surface)]/40">
              Back
            </Link>
          </div>
        </div>
      </div>
      {showAdminContact ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[color:var(--primary-gold)]/30 bg-[color:var(--surface)] p-7 shadow-2xl">
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Contact administration</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Withdrawals above $4,000 cannot continue through self-service. Contact administration for assistance with this request.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={`mailto:${WITHDRAWAL_ADMIN_EMAIL}?subject=Withdrawal%20assistance%20request`} className="rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)]">Email admin</a>
              <button type="button" onClick={() => setShowAdminContact(false)} className="rounded-2xl border border-[color:var(--border-soft)] px-4 py-3 text-sm text-[var(--text-primary)]">Close</button>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
