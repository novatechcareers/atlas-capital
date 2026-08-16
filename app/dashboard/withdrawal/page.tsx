'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { getUserStorageKey, getCurrentAccountId } from '@/lib/auth';
import { canAfford, formatCurrency, getStoredBalance, setStoredBalance, subscribeToBalance } from '@/lib/balance';

const coinOptions = [
  { value: 'bitcoin', label: 'Bitcoin', placeholder: 'Enter BTC wallet address' },
  { value: 'ethereum', label: 'Ethereum', placeholder: 'Enter ETH wallet address' },
  { value: 'usdt', label: 'USDT', placeholder: 'Enter TRC20 or BEP20 wallet address' },
  { value: 'shiba', label: 'Shiba Inu', placeholder: 'Enter SHIB wallet address' },
  { value: 'doge', label: 'Dogecoin', placeholder: 'Enter DOGE wallet address' },
  { value: 'cardano', label: 'Cardano', placeholder: 'Enter ADA wallet address' },
  { value: 'ripple', label: 'Ripple', placeholder: 'Enter XRP wallet address' },
];

export default function WithdrawalPage() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [withdrawalMethod, setWithdrawalMethod] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [balance, setBalance] = useState(0);
  const [requests, setRequests] = useState<Array<{ id: number; amount: number; method: string; status: 'Fee pending' | 'Pending' | 'Approved' | 'Declined'; walletAddress?: string }>>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setBalance(getStoredBalance());
    const unsubscribe = subscribeToBalance(setBalance);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const storageKey = getUserStorageKey('atlas-withdrawal-requests');
    const syncRequests = async () => {
      const userId = getCurrentAccountId();
      if (!userId) {
        setRequests([]);
        return;
      }

      try {
        const resp = await fetch(`/api/withdrawals?userId=${encodeURIComponent(userId)}`);
        if (resp.ok) {
          const payload = await resp.json();
          setRequests(Array.isArray(payload?.withdrawals) ? payload.withdrawals : []);
          return;
        }
      } catch {
        // fallback to localStorage
      }

      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        try {
          setRequests(JSON.parse(stored));
        } catch {
          setRequests([]);
        }
      } else {
        setRequests([]);
      }
    };

    syncRequests();
    const storageHandler = (event: StorageEvent) => {
      if (!event.key || event.key === storageKey) {
        syncRequests();
      }
    };

    const channel = new BroadcastChannel('atlas-withdrawal-requests');
    const channelHandler = () => syncRequests();

    window.addEventListener('storage', storageHandler);
    channel.addEventListener('message', channelHandler);

    return () => {
      window.removeEventListener('storage', storageHandler);
      channel.removeEventListener('message', channelHandler);
      channel.close();
    };
  }, []);

  const selectedCoin = coinOptions.find((option) => option.value === withdrawalMethod);
  const isCoinMethod = Boolean(selectedCoin);
  const requestedAmount = Number(amount);
  const minimumWithdrawal = withdrawalMethod === 'bank' ? 750 : 1000;
  const belowMinimum = Boolean(amount && requestedAmount < minimumWithdrawal);
  const canSubmit = Boolean(amount && Number(amount) > 0 && withdrawalMethod && (!isCoinMethod || walletAddress.trim()));
  const insufficientBalance = Boolean(amount && Number(amount) > 0 && !canAfford(requestedAmount));
  const statusCount = useMemo(() => requests.reduce<Record<string, number>>((counts, request) => {
    counts[request.status] = (counts[request.status] || 0) + 1;
    return counts;
  }, {}), [requests]);

  const handleSubmit = () => {
    if (!canSubmit) return;

    if (belowMinimum) {
      setMessage(`The minimum withdrawal for ${withdrawalMethod === 'bank' ? 'bank transfers' : 'digital assets'} is ${formatCurrency(minimumWithdrawal)}.`);
      return;
    }

    if (!canAfford(requestedAmount)) {
      setMessage('Insufficient balance. Deposit funds to top up before withdrawing.');
      return;
    }

    (async () => {
      try {
        const userId = getCurrentAccountId();
        if (!userId) {
          setMessage('Unable to identify account. Please sign in again.');
          return;
        }

        const resp = await fetch('/api/withdrawals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, amount: requestedAmount, currency: 'USD', method: withdrawalMethod, walletAddress: isCoinMethod ? walletAddress : undefined, status: 'Fee pending', note: 'User withdrawal request' }),
        });

        if (!resp.ok) {
          setMessage('Unable to submit withdrawal request. Please try again.');
          return;
        }

        const payload = await resp.json();
        const withdrawal = payload?.withdrawal;
        if (withdrawal) {
          // update local UI and balance
          const nextRequests = [withdrawal, ...requests];
          setRequests(nextRequests);
          try { window.localStorage.setItem(getUserStorageKey('atlas-withdrawal-requests'), JSON.stringify(nextRequests)); } catch {}
          setStoredBalance(balance - requestedAmount);
          const channel = new BroadcastChannel('atlas-withdrawal-requests');
          channel.postMessage({ type: 'requests-updated', requests: nextRequests, userId });
          channel.close();
          router.push(`/dashboard/withdrawal/fee?requestId=${encodeURIComponent(withdrawal.id)}`);
          return;
        }
      } catch (e) {
        // fallback to localStorage behavior
      }

      const nextRequest = {
        id: Date.now(),
        amount: requestedAmount,
        method: withdrawalMethod,
        status: 'Fee pending' as const,
        walletAddress: isCoinMethod ? walletAddress : undefined,
      };

      const nextRequests = [nextRequest, ...requests];
      setRequests(nextRequests);
      window.localStorage.setItem(getUserStorageKey('atlas-withdrawal-requests'), JSON.stringify(nextRequests));
      setStoredBalance(balance - requestedAmount);
      router.push(`/dashboard/withdrawal/fee?requestId=${nextRequest.id}`);
    })();
  };

  return (
    <DashboardShell title="Withdrawal Transaction" subtitle="Manage withdrawal requests and review the admin approval state.">
      <div className="space-y-6">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Available balance</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--text-white)]">
                Amount Available for Withdrawal: <span className="text-emerald-400">{formatCurrency(balance)}</span>
              </h2>
            </div>
            <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--primary-gold)]/10 px-4 py-3 text-sm text-slate-300">
              Home / Withdrawal Transaction / View
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <form className="space-y-6">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--primary-gold)]/10 p-5">
                <h3 className="mb-3 text-lg font-semibold text-[var(--text-white)]">Enter Amount to Withdrawal</h3>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
                  placeholder="Enter Amount"
                  inputMode="decimal"
                />
                <p className="mt-3 text-sm text-slate-400">Minimum withdrawal: $1,000 for digital assets and $750 for bank transfers. Requests remain subject to balance verification and administrative review.</p>
              </div>

              <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--primary-gold)]/10 p-5">
                <h3 className="mb-3 text-lg font-semibold text-[var(--text-white)]">Select Payment Method</h3>
                <select
                  value={withdrawalMethod}
                  onChange={(event) => {
                    setWithdrawalMethod(event.target.value);
                    if (event.target.value !== 'bank') {
                      setWalletAddress('');
                    }
                  }}
                  className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
                >
                  <option value="">--Select Withdrawal Method--</option>
                  <option value="bank">Bank Account</option>
                  <option value="bitcoin">Bitcoin</option>
                  <option value="ethereum">Ethereum</option>
                  <option value="usdt">USDT</option>
                  <option value="shiba">Shiba Inu</option>
                  <option value="doge">Doge</option>
                  <option value="cardano">Cardano</option>
                  <option value="ripple">Ripple</option>
                </select>
                <p className="mt-3 text-sm text-slate-400">Choose a supported destination. International transfer charges may apply before release.</p>
              </div>
            </div>

            {withdrawalMethod === 'bank' ? (
              <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--surface)]/10 p-5 text-sm text-slate-300">
                <p className="font-semibold text-[var(--text-white)]">Bank account withdrawal details</p>
                <p className="mt-2">Continue to the bank form to provide your account details for review.</p>
                <a href="/dashboard/withdrawal/bank" className="mt-3 inline-flex rounded-full bg-[color:var(--primary-gold)] px-4 py-2 text-sm font-semibold text-[color:var(--bg-dark-navy)]">
                  Go to bank form
                </a>
              </div>
            ) : null}

            {isCoinMethod ? (
              <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--surface)]/10 p-5">
                <h3 className="mb-3 text-lg font-semibold text-[var(--text-white)]">Wallet Address</h3>
                <label className="mb-2 block text-sm text-slate-300" htmlFor="wallet-address">
                  {selectedCoin?.label || 'Coin'} address
                </label>
                <input
                  id="wallet-address"
                  value={walletAddress}
                  onChange={(event) => setWalletAddress(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
                  placeholder={selectedCoin?.placeholder || 'Enter wallet address'}
                />
                <p className="mt-3 text-sm text-slate-400">Double-check the wallet address before submitting the request.</p>
              </div>
            ) : null}

            {message ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${message.includes('Insufficient') ? 'border-rose-400/40 bg-rose-500/10 text-rose-200' : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'}`}>
                {message}
              </div>
            ) : null}

            <div className="mx-auto max-w-2xl">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || belowMinimum}
                className="w-full rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Request Withdrawal
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h3 className="text-lg font-semibold text-[var(--text-white)]">Recent withdrawals</h3>
            <input
              className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] lg:w-72"
              placeholder="Search"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[color:var(--primary-gold)]/20">
            <table className="min-w-full divide-y divide-[color:var(--primary-gold)]/20">
              <thead className="bg-[color:var(--primary-gold)]/10">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Withdrawal Method</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Created At</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.length ? requests.map((request) => (
                  <tr key={request.id} className="border-t border-[color:var(--primary-gold)]/10 bg-[color:var(--surface)]/40">
                    <td className="px-4 py-3 text-sm text-[var(--text-white)]">{formatCurrency(request.amount)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${request.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-300' : request.status === 'Declined' ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{request.method}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{new Date(request.id).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{request.walletAddress ? request.walletAddress : '—'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                      No data available in table
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1">Pending: {statusCount.Pending || 0}</span>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1">Approved: {statusCount.Approved || 0}</span>
            <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1">Declined: {statusCount.Declined || 0}</span>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
