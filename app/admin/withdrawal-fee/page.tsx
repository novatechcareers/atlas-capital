'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { getScopedStorageKey, getSelectedAdminUserId, type UserAccount } from '@/lib/auth';
import { WITHDRAWAL_TRANSFER_FEE } from '@/lib/withdrawal';

type FeeMeta = {
  requestId: string | number;
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
  const [accountType, setAccountType] = useState<'bank' | 'wallet'>('bank');
  const [message, setMessage] = useState('');
  const [feePaymentSent, setFeePaymentSent] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedUserId(getSelectedAdminUserId()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null);
      return;
    }

    let active = true;
    const loadSelectedUser = async () => {
      try {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(selectedUserId)}`);
        const payload = await response.json();
        if (!response.ok || !payload?.user) throw new Error(payload?.error || 'Unable to load selected user.');
        if (active) setSelectedUser(payload.user as UserAccount);
      } catch (error) {
        console.error('Failed to load selected withdrawal-fee user:', error);
        if (active) setSelectedUser(null);
      }
    };

    void loadSelectedUser();
    const timer = window.setInterval(() => void loadSelectedUser(), 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedUserId]);

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
      let serverStateLoaded = false;
      try {
        const response = await fetch(`/api/admin/withdrawals?userId=${encodeURIComponent(selectedUserId!)}`);
        if (response.ok) {
          const payload = await response.json();
          const withdrawals = Array.isArray(payload?.withdrawals) ? payload.withdrawals : [];
          const feeRequest = withdrawals.find((withdrawal: any) => String(withdrawal.note ?? '').includes('Fee account requested by user'));
          const feePayment = withdrawals.find((withdrawal: any) => String(withdrawal.note ?? '').includes('Fee payment reported by user') && !String(withdrawal.note ?? '').includes('Fee payment confirmed by admin'));
          setRequested(Boolean(feeRequest));
          setFeePaymentSent(Boolean(feePayment));
          if (feeRequest) {
            setMeta({ requestId: feeRequest.id, amount: WITHDRAWAL_TRANSFER_FEE, createdAt: new Date(feeRequest.created_at ?? Date.now()).getTime() });
          }
          serverStateLoaded = true;
        }
      } catch {
        // fall back to local state when the database is unavailable
      }

      if (!serverStateLoaded) {
        setRequested(window.localStorage.getItem(scopedRequestKey) === 'true');
        setFeePaymentSent(Boolean(window.localStorage.getItem(scopedSentKey)));
      }
      const storedMeta = window.localStorage.getItem(scopedMetaKey);
      if (storedMeta && !serverStateLoaded) {
        try {
          setMeta(JSON.parse(storedMeta) as FeeMeta);
        } catch {
          setMeta(null);
        }
      }

      try {
        const resp = await fetch(`/api/withdrawal-fee-accounts?userId=${encodeURIComponent(selectedUserId!)}`);
        if (resp.ok) {
          const payload = await resp.json();
          const account = payload?.account ?? null;
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
    const pollTimer = window.setInterval(() => void fetchAccount(), 2000);
    const channelHandler = (event: MessageEvent) => {
      if (!event.data || event.data.userId !== selectedUserId) return;
      fetchAccount();
    };
    window.addEventListener('storage', fetchAccount);
    channel.addEventListener('message', channelHandler);
    return () => {
      window.clearInterval(pollTimer);
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
    void (async () => {
      try {
        const resp = await fetch('/api/withdrawal-fee-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedUser.id, bankName: accountType === 'wallet' ? 'Digital wallet' : account.bankName, accountName: account.accountName, accountNumber: account.accountNumber, reference: account.reference }),
        });
        const payload = await resp.json();
        if (!resp.ok) throw new Error(payload?.error || 'Unable to assign payment account.');
        const saved = payload?.account ?? account;
        const channel = new BroadcastChannel('atlas-withdrawal-fee');
        channel.postMessage({ type: 'fee-account-assigned', account: saved, userId: selectedUser.id });
        channel.close();
        setMessage('Payment account details assigned and sent to the selected user’s withdrawal fee page.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to assign payment account.');
      }
    })();
  };

  const handleResetAccount = async () => {
    if (!selectedUserId) return;
    try {
      const response = await fetch(`/api/withdrawal-fee-accounts?userId=${encodeURIComponent(selectedUserId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to reset fee account.');
      setBankName('');
      setAccountName('');
      setAccountNumber('');
      setReference('');
      setMessage('Withdrawal fee account reset.');
    } catch {
      setMessage('Unable to reset withdrawal fee account.');
    }
  };

  const handleConfirmFeePayment = async () => {
    if (!meta || !selectedUser) return;
    try {
      const response = await fetch(`/api/admin/withdrawals/${encodeURIComponent(String(meta.requestId))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Pending', note: 'Fee payment confirmed by admin' }),
      });
      if (!response.ok) throw new Error('Unable to confirm fee payment.');
    } catch {
      setMessage('Unable to confirm fee payment. Please try again.');
      return;
    }
    window.localStorage.setItem(getScopedStorageKey(confirmedKey, selectedUserId), String(meta.requestId));
    window.localStorage.removeItem(getScopedStorageKey(sentKey, selectedUserId));
    const channel = new BroadcastChannel('atlas-withdrawal-fee');
    channel.postMessage({ type: 'fee-payment-confirmed', requestId: meta.requestId, userId: selectedUser.id });
    channel.close();
    setFeePaymentSent(false);
    setMessage('Fee payment confirmed.');
  };

  return (
    <AdminShell title="Withdrawal Fee" subtitle="Transfer fee account assignments.">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">International transfer fee</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-white)]">{selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}'s fee account` : `Fixed fee: $${WITHDRAWAL_TRANSFER_FEE.toFixed(2)}`}</h2>
          <div className="mt-2 flex items-center gap-3">
          <p className="mt-3 text-sm text-slate-400">{selectedUser ? 'Payment details for the selected account.' : 'Select an account to manage payment details.'}</p>
            <Link href="/admin/users" className="ml-2 rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-1 text-sm text-[color:var(--primary-gold)]">Select account</Link>
          </div>
        </div>

        {!selectedUser ? (
          <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 text-sm text-[var(--text-secondary)]">Select an account to manage this fee request.</div>
        ) : requested ? (
          <div className="rounded-3xl border border-amber-400/40 bg-amber-500/10 p-5 text-sm text-amber-100">
            <p className="font-semibold">Account generation requested</p>
            {meta ? <p className="mt-2">{selectedUser?.firstName} {selectedUser?.lastName} requested a ${WITHDRAWAL_TRANSFER_FEE.toFixed(2)} fee on {new Date(meta.createdAt).toLocaleString()}.</p> : null}
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
            <label className="mb-2 block text-sm text-slate-300">Payment destination</label>
            <select value={accountType} onChange={(event) => setAccountType(event.target.value as 'bank' | 'wallet')} className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-white outline-none">
              <option value="bank">Bank account</option>
              <option value="wallet">Digital wallet</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">{accountType === 'wallet' ? 'Wallet label' : 'Bank or payment institution'}</label>
            <input value={bankName} onChange={(event) => setBankName(event.target.value)} className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-white outline-none" placeholder={accountType === 'wallet' ? 'Wallet name or network' : 'Institution name'} />
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
          <button type="button" onClick={handleResetAccount} className="w-full rounded-2xl border border-rose-400/40 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/10">Reset assigned payment account</button>
        </form>
      </div>
    </AdminShell>
  );
}
