'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { getScopedStorageKey, getSelectedAdminUser, getSelectedAdminUserId } from '@/lib/auth';
import { useLanguage } from '@/components/language-provider';
import { translatePageText } from '@/lib/i18n';

function formatCurrency(currency: string, amount: string) {
  const symbol = currency === 'BRL' ? 'R$' : '$';
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) return `${symbol}${amount}`;
  return `${symbol}${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTimeAgo(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
}

export default function AdminDepositPage() {
  const { language } = useLanguage();
  const tr = (text: string) => translatePageText(language, text);
  const [currency, setCurrency] = useState(() => {
    if (typeof window === 'undefined') return 'USD';
    return new URLSearchParams(window.location.search).get('currency') || 'USD';
  });
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [assigned, setAssigned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [requestMeta, setRequestMeta] = useState<{ amount: string; requestedAt: number } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    role: string;
    status: string;
    createdAt: string;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedUserId(getSelectedAdminUserId()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const activeUserId = selectedUserId;
    if (!activeUserId) {
      setSelectedUser(null);
      return;
    }

    const safeUserId: string = activeUserId;
    let isMounted = true;

    async function loadSelectedUser() {
      try {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(safeUserId)}`);
        const result = await response.json();
        if (!response.ok || result?.error) {
          throw new Error(result?.error || 'Unable to load selected user.');
        }

        if (isMounted) {
          setSelectedUser(result.user ?? null);
        }
      } catch {
        if (isMounted) {
          setSelectedUser(null);
        }
      }
    }

    loadSelectedUser();
    return () => {
      isMounted = false;
    };
  }, [selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) {
      setBankName('');
      setAccountName('');
      setAccountNumber('');
      setRequestPending(false);
      setRequestMeta(null);
      return;
    }

    async function loadBankAssignment() {
      try {
        const userId = String(selectedUserId);
        const accountResponse = await fetch(`/api/bank-accounts?userId=${encodeURIComponent(userId)}&currency=${encodeURIComponent(currency)}`);
        const accountResult = await accountResponse.json();
        if (!accountResponse.ok || accountResult?.error) {
          throw new Error(accountResult?.error || 'Unable to load bank account.');
        }

        const account = accountResult?.bankAccount ?? null;
        const hasAssignedAccount = Boolean(account);
        setBankName(account?.bank_name ?? '');
        setAccountName(account?.account_name ?? '');
        setAccountNumber(account?.account_number ?? '');

        const requestResponse = await fetch(`/api/deposit-requests?userId=${encodeURIComponent(userId)}`);
        const requestResult = await requestResponse.json();
        if (!requestResponse.ok || requestResult?.error) {
          throw new Error(requestResult?.error || 'Unable to load deposit request state.');
        }

        const pendingRequest = hasAssignedAccount
          ? null
          : (Array.isArray(requestResult?.deposits) ? requestResult.deposits : []).find(
              (entry: any) => entry.gateway === 'bank' && entry.currency === currency && (entry.status === 'Pending' || entry.status === 'Confirmed'),
            );

        setRequestPending(Boolean(pendingRequest));
        setRequestMeta(
          pendingRequest
            ? { amount: String(pendingRequest.amount ?? 0), requestedAt: new Date(pendingRequest.created_at ?? Date.now()).getTime() }
            : null,
        );
      } catch {
        setBankName('');
        setAccountName('');
        setAccountNumber('');
        setRequestPending(false);
        setRequestMeta(null);
      }
    }

    void loadBankAssignment();
    const pollTimer = window.setInterval(() => void loadBankAssignment(), 2000);
    return () => window.clearInterval(pollTimer);
  }, [currency, selectedUserId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUserId || !selectedUser || !bankName || !accountName || !accountNumber) return;
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          currency,
          bankName,
          accountName,
          accountNumber,
        }),
      });

      const result = await response.json();
      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Unable to save bank account.');
      }

      setAssigned(true);
      setRequestPending(false);
      setRequestMeta(null);
    } catch {
      setAssigned(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminShell title="Admin Deposit" subtitle="Manage premium bank account assignments for deposits.">
      <div className="mx-auto max-w-3xl rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
        <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--primary-gold)]/10 px-5 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Admin Deposit</p>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-[var(--text-white)]">Assign {currency} Bank Account</h2>
            <Link href="/admin/users" className="ml-2 rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-1 text-sm text-[color:var(--primary-gold)]">Choose user</Link>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-700/40 bg-[color:var(--bg-dark-navy)]/80 p-5 text-sm text-slate-300">
          {requestPending ? (
            <>
              <p className="font-semibold text-[color:var(--primary-gold)]">{tr('Pending request detected')}</p>
              <p className="mt-2">User requested {formatCurrency(currency, requestMeta?.amount ?? '0')}.</p>
              {requestMeta ? <p className="mt-1 text-[color:var(--text-secondary)]">Requested {formatTimeAgo(requestMeta.requestedAt)}.</p> : null}
            </>
          ) : (
            <p>{currency === 'USD' ? tr('No pending bank request for USD right now.') : `No pending bank request for ${currency} right now.`}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div>
            <label className="mb-2 block text-sm text-slate-300">{tr('Currency')}</label>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
            >
              <option value="USD">USD - US Dollar</option>
              <option value="BRL">BRL - Brazilian Reals</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">{tr('Bank name')}</label>
            <input
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
              placeholder={tr('Enter bank name')}
            />
          </div>

          <div>
              <label className="mb-2 block text-sm text-slate-300">{tr('Account holder name')}</label>
            <input
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
              placeholder={tr('Enter account holder name')}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Account number</label>
            <input
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
              placeholder={tr('Enter admin bank account number')}
            />
          </div>

          <button
            type="submit"
            disabled={!selectedUserId || !selectedUser || !bankName || !accountName || !accountNumber || isSubmitting}
            className="w-full rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Saving account…' : tr('Save bank account')}
          </button>

          {assigned ? (
            <p className="text-sm text-emerald-300">{tr('Account saved and ready for deposit users.')}</p>
          ) : null}
        </form>
      </div>
    </AdminShell>
  );
}
