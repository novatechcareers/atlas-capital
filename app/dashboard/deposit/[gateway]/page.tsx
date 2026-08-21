'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';
import { getCurrentAccountId } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { useLanguage } from '@/components/language-provider';
import { translatePageText } from '@/lib/i18n';

const currencySymbols: Record<string, string> = {
  USD: '$',
  BRL: 'R$',
};

function formatCountdown(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatCurrency(currency: string, amount: string) {
  const symbol = currencySymbols[currency] ?? '';
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) return `${symbol}${amount}`;
  return `${symbol}${numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const gatewayConfig: Record<
  string,
  { title: string; subtitle: string; address: string; note: string; action: string; rate?: number; symbol?: string }
> = {
  btc: {
    title: 'Bitcoin Deposit',
    subtitle: 'Send the exact amount to the BTC wallet below.',
    address: '',
    note: 'Use BTC only. Confirm the exact amount to avoid delays.',
    action: 'Copy BTC address',
    rate: 30000,
    symbol: 'BTC',
  },
  usdt: {
    title: 'USDT Deposit',
    subtitle: 'Send USDT to the TRC20 address below.',
    address: '',
    note: 'Use USDT only. Ensure TRC20 network compatibility.',
    action: 'Copy USDT address',
    rate: 1,
    symbol: 'USDT',
  },
  solana: {
    title: 'Solana Deposit',
    subtitle: 'Send SOL to the wallet below.',
    address: '',
    note: 'Use SOL only. Do not send other tokens to this address.',
    action: 'Copy Solana address',
    rate: 25,
    symbol: 'SOL',
  },
  ethereum: {
    title: 'Ethereum Deposit',
    subtitle: 'Send ETH to the wallet below.',
    address: '',
    note: 'Use ETH only. Confirm the network before sending.',
    action: 'Copy ETH address',
    rate: 1800,
    symbol: 'ETH',
  },
  bank: {
    title: 'Bank Transfer',
    subtitle: 'Bank deposit requests open a separate account page.',
    address: 'Bank details are provided on the next page.',
    note: 'Bank payment setup is handled separately.',
    action: 'Bank details',
  },
};

export default function GatewayDepositPage({ params }: { params: Promise<{ gateway: string }> }) {
  const searchParams = useSearchParams();
  const { language } = useLanguage();
  const tr = (text: string) => translatePageText(language, text);
  const [copied, setCopied] = useState(false);
  const [bankCurrency, setBankCurrency] = useState('USD');
  const [bankDetails, setBankDetails] = useState<{ accountNumber: string; bankName: string; accountName: string; expiry?: number } | null>(null);
  const [requestMeta, setRequestMeta] = useState<{ amount: string; requestedAt: number } | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [expiryLeft, setExpiryLeft] = useState<string | null>(null);
  const [depositSubmitted, setDepositSubmitted] = useState(false);
  const [accountExpiresAt, setAccountExpiresAt] = useState<number | null>(null);
  const [depositStatus, setDepositStatus] = useState<'Pending' | 'Confirmed' | 'Approved' | null>(null);
  const [depositHistory, setDepositHistory] = useState<Array<{ id: string; amount: number; currency: string; gateway: string; status: string; note: string | null; created_at: string }>>([]);
  const resolvedParams = use(params);
  const gateway = resolvedParams.gateway;
  const amount = searchParams.get('amount') ?? '';
  useEffect(() => {
    const requestedCurrency = searchParams.get('currency');
    if (gateway === 'bank' && (requestedCurrency === 'USD' || requestedCurrency === 'BRL')) {
      setBankCurrency(requestedCurrency);
    }
  }, [gateway, searchParams]);
  const minimumAmount = gateway === 'bank' ? 100 : 50;
  const amountIsValid = Number.isFinite(Number(amount)) && Number(amount) >= minimumAmount;

  const config = gatewayConfig[gateway];
  const isManagedGateway = gateway === 'bank' || Boolean(config?.symbol);
  const managedCurrency = gateway === 'bank' ? bankCurrency : config?.symbol ?? '';
  const managedGateway = gateway === 'bank' ? 'bank' : gateway;

  useEffect(() => {
    const userId = getCurrentAccountId();
    if (!userId || !gateway) {
      setDepositSubmitted(false);
      setDepositStatus(null);
      setDepositHistory([]);
      return;
    }

    async function syncDepositStatus() {
      try {
        const resolvedUserId = String(userId);
        const response = await fetch(`/api/deposit-requests?userId=${encodeURIComponent(resolvedUserId)}`);
        const result = await response.json();
        if (!response.ok || result?.error) {
          throw new Error(result?.error || 'Unable to load deposit requests.');
        }

        const entries = Array.isArray(result?.deposits) ? result.deposits : [];
        setDepositHistory(entries);

        const matches = entries.filter(
          (entry: any) => String(entry.amount) === String(Number(amount || 0)) && String(entry.gateway) === String(gateway),
        );
        const paymentConfirmation = matches.find((entry: any) => entry.status === 'Confirmed' || entry.status === 'Approved');

        if (paymentConfirmation) {
          setDepositSubmitted(true);
          setDepositStatus(paymentConfirmation.status);
        } else if (amount) {
          setDepositSubmitted(false);
          setDepositStatus(matches[0]?.status === 'Pending' ? null : matches[0]?.status ?? null);
        } else {
          setDepositSubmitted(false);
          setDepositStatus(null);
        }
      } catch {
        setDepositSubmitted(false);
        setDepositStatus(null);
        setDepositHistory([]);
      }
    }

    void syncDepositStatus();

    let realtimeChannel: any = null;
    try {
      const supabase = getSupabase();
      if (supabase) {
        realtimeChannel = supabase
          .channel(`deposit-history-${userId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'deposit_requests', filter: `user_id=eq.${userId}` }, () => {
            void syncDepositStatus();
          })
          .subscribe();
      }
    } catch {
      // realtime is optional here; the fetch refresh is enough as a fallback
    }

    return () => {
      try {
        if (realtimeChannel && typeof realtimeChannel.unsubscribe === 'function') realtimeChannel.unsubscribe();
      } catch {}
    };
  }, [amount, gateway]);

  useEffect(() => {
    if (!isManagedGateway) {
      setBankDetails(null);
      setRequestMeta(null);
      setPendingRequest(false);
      setShowRequestModal(false);
      setExpiryLeft(null);
      return;
    }

    const userId = getCurrentAccountId();
    if (!userId) {
      setBankDetails(null);
      setRequestMeta(null);
      setPendingRequest(false);
      setShowRequestModal(false);
      setExpiryLeft(null);
      return;
    }

    async function syncBankState() {
      try {
        const resolvedUserId = String(userId);
        const accountResponse = await fetch(`/api/bank-accounts?userId=${encodeURIComponent(resolvedUserId)}&currency=${encodeURIComponent(managedCurrency)}`);
        const accountResult = await accountResponse.json();
        const account = accountResult?.bankAccount ?? null;

        const hasAssignedAccount = Boolean(account);

        if (hasAssignedAccount) {
          setBankDetails({
            accountNumber: account.account_number ?? '',
            bankName: account.bank_name ?? '',
            accountName: account.account_name ?? '',
          });
          setPendingRequest(false);
          setShowRequestModal(false);
          setExpiryLeft(null);
        } else {
          setBankDetails(null);
        }

        const requestResponse = await fetch(`/api/deposit-requests?userId=${encodeURIComponent(resolvedUserId)}`);
        const requestResult = await requestResponse.json();
        if (!requestResponse.ok || requestResult?.error) {
          throw new Error(requestResult?.error || 'Unable to load deposit requests.');
        }

        const pendingRequest = hasAssignedAccount
          ? null
          : (Array.isArray(requestResult?.deposits) ? requestResult.deposits : []).find(
              (entry: any) => entry.gateway === managedGateway && entry.currency === managedCurrency && (entry.status === 'Pending' || entry.status === 'Confirmed'),
            );

        const hasRequest = Boolean(pendingRequest);
        setPendingRequest(hasRequest);
        setShowRequestModal(hasRequest);
        setRequestMeta(
          pendingRequest
            ? { amount: String(pendingRequest.amount ?? amount), requestedAt: new Date(pendingRequest.created_at ?? Date.now()).getTime() }
            : null,
        );
      } catch {
        setBankDetails(null);
        setRequestMeta(null);
        setPendingRequest(false);
        setShowRequestModal(false);
        setExpiryLeft(null);
      }
    }

    void syncBankState();
    const pollTimer = window.setInterval(() => void syncBankState(), 2000);

    let realtimeChannel: any = null;
    try {
      const supabase = getSupabase();
      const resolvedUserId = String(userId);
      if (supabase && resolvedUserId) {
        realtimeChannel = supabase
          .channel(`deposit-assign-${resolvedUserId}-${managedCurrency}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'user_bank_accounts', filter: `user_id=eq.${resolvedUserId},currency=eq.${managedCurrency}` }, (payload: any) => {
            // when an account is inserted/updated/deleted for this user+currency, refresh bank state
            void syncBankState();
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'deposit_requests', filter: `user_id=eq.${resolvedUserId}` }, (payload: any) => {
            // deposit requests changed for this user; refresh pending/requests state
            void syncBankState();
          })
          .subscribe();
      }
    } catch (e) {
      // ignore realtime errors; syncBankState will still poll on load
    }

    return () => {
      window.clearInterval(pollTimer);
      try {
        if (realtimeChannel && typeof realtimeChannel.unsubscribe === 'function') realtimeChannel.unsubscribe();
      } catch {}
    };
  }, [amount, bankCurrency, gateway, isManagedGateway, managedCurrency, managedGateway]);

  useEffect(() => {
    if (!isManagedGateway) return;
    const userId = getCurrentAccountId();
    if (!userId || !managedCurrency) return;
    const expiryKey = `atlas-deposit-account-expiry-${userId}-${managedCurrency}`;
    let timer: number | null = null;

    const resetWhenExpired = async () => {
      const expiresAt = Number(window.localStorage.getItem(expiryKey) ?? 0);
      if (!expiresAt) return;
      if (expiresAt <= Date.now()) {
        await fetch(`/api/bank-accounts?userId=${encodeURIComponent(userId)}&currency=${encodeURIComponent(managedCurrency)}`, { method: 'DELETE' });
        window.localStorage.removeItem(expiryKey);
        setAccountExpiresAt(null);
        setBankDetails(null);
        return;
      }
      setAccountExpiresAt(expiresAt);
      timer = window.setTimeout(() => void resetWhenExpired(), expiresAt - Date.now());
    };

    void resetWhenExpired();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [isManagedGateway, managedCurrency]);

  const handleCopy = async () => {
    if (!bankDetails?.accountNumber) return;

    try {
      await navigator.clipboard.writeText(bankDetails.accountNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleRequestPaymentAccount = async () => {
    if (!amountIsValid) return;
    const userId = getCurrentAccountId();
    if (!userId) return;

    try {
      const response = await fetch('/api/deposit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount,
          currency: managedCurrency,
          gateway: managedGateway,
          status: 'Pending',
          note: `${managedCurrency} deposit address requested for ${amount}`,
        }),
      });

      const result = await response.json();
      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Unable to create bank request.');
      }

      setPendingRequest(true);
      setShowRequestModal(true);
      setRequestMeta({ amount, requestedAt: Date.now() });
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const ch = new BroadcastChannel('atlas-admin');
          ch.postMessage({ type: 'deposit-created', userId, gateway: managedGateway, currency: managedCurrency });
          ch.close();
        }
      } catch {
        // ignore
      }
    } catch {
      setPendingRequest(false);
      setShowRequestModal(false);
    }
  };

  const handleDepositConfirmation = async () => {
    if (!amountIsValid) return;
    const userId = getCurrentAccountId();
    if (!userId) return;

    try {
      const response = await fetch('/api/deposit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount,
          currency: gateway === 'bank' ? bankCurrency : 'USD',
          gateway: managedGateway,
          status: 'Confirmed',
          note: `Deposit confirmation for ${amount}`,
        }),
      });

      const result = await response.json();
      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Unable to submit deposit confirmation.');
      }

      setDepositSubmitted(true);
      setDepositStatus('Confirmed');
      if (isManagedGateway) {
        const expiresAt = Date.now() + 5 * 60 * 1000;
        const expiryKey = `atlas-deposit-account-expiry-${userId}-${managedCurrency}`;
        window.localStorage.setItem(expiryKey, String(expiresAt));
        setAccountExpiresAt(expiresAt);
        window.setTimeout(async () => {
          await fetch(`/api/bank-accounts?userId=${encodeURIComponent(userId)}&currency=${encodeURIComponent(managedCurrency)}`, { method: 'DELETE' });
          window.localStorage.removeItem(expiryKey);
          setAccountExpiresAt(null);
          setBankDetails(null);
        }, 5 * 60 * 1000);
      }
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const ch = new BroadcastChannel('atlas-admin');
          ch.postMessage({ type: 'deposit-created', userId, gateway: managedGateway, currency: managedCurrency });
          ch.close();
        }
      } catch {
        // ignore
      }
    } catch {
      setDepositSubmitted(false);
      setDepositStatus(null);
    }
  };

  const coinAmount = useMemo(() => {
    if (!config?.rate || config.symbol === 'USDT') {
      return config?.symbol === 'USDT' ? `${amount} USDT` : null;
    }

    const value = Number(amount) / config.rate;
    if (Number.isNaN(value)) return null;

    return `${value.toFixed(6)} ${config.symbol}`;
  }, [amount, config]);

  return (
    <DashboardShell title="Deposit" subtitle={`Complete your ${config?.title || 'deposit'} gateway.`}>
      <div className="mx-auto max-w-4xl rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
        <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--primary-gold)]/10 px-5 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{tr('Gateway ready')}</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-white)]">{config?.title || 'Unknown gateway'}</h2>
        </div>

        <div className="mt-6 rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--surface)]/5 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text-white)]">Recent deposit history</h3>
            <span className="text-xs uppercase tracking-[0.25em] text-[color:var(--primary-gold)]">DB synced</span>
          </div>

          {depositHistory.length ? (
            <div className="overflow-hidden rounded-2xl border border-[color:var(--primary-gold)]/20">
              <table className="min-w-full divide-y divide-[color:var(--primary-gold)]/20">
                <thead className="bg-[color:var(--primary-gold)]/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-slate-300">Gateway</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-slate-300">Amount</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-slate-300">Status</th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-slate-300">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--primary-gold)]/10 bg-[color:var(--bg-dark-navy)]/70">
                  {depositHistory.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 text-sm text-[var(--text-white)] capitalize">{entry.gateway}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-white)]">{formatCurrency(entry.currency, String(entry.amount))}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-white)]">
                        <span className="rounded-full border border-[color:var(--primary-gold)]/30 bg-[color:var(--primary-gold)]/10 px-2 py-1 text-[10px] uppercase tracking-[0.22em] text-[color:var(--primary-gold)]">{entry.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{new Date(entry.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--primary-gold)]/30 bg-[color:var(--bg-dark-navy)]/80 px-4 py-5 text-sm text-slate-400">
              No deposit requests have been created yet for this account.
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)]/70 p-5">
          <p className="text-sm text-slate-300">{config?.subtitle || 'Select a valid payment gateway and try again.'}</p>
          <p className="mt-2 text-sm font-medium text-[color:var(--primary-gold)]">Minimum deposit: ${minimumAmount.toFixed(2)}.</p>
          <div className="mt-4 rounded-3xl border border-[color:var(--primary-gold)]/15 bg-[color:var(--surface)]/10 px-4 py-4">
            <p className="text-sm text-slate-300">{tr('Selected amount')}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--text-white)]">${amount}</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--surface)]/5 p-5">
          {gateway === 'bank' ? (
            <>
              <div className="rounded-3xl border border-[color:var(--primary-gold)]/15 bg-[color:var(--bg-dark-navy)]/90 p-5">
                <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{tr('Bank transfer currency')}</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <select
                    value={bankCurrency}
                    onChange={(event) => setBankCurrency(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="BRL">BRL - Brazilian Reals</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleRequestPaymentAccount}
                    disabled={!amountIsValid || pendingRequest || Boolean(bankDetails)}
                    className="rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {tr('Request bank account')}
                  </button>
                </div>
                {pendingRequest ? (
                  <div className="mt-4 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    {tr('Request is pending. Waiting for the admin to assign bank details.')}
                    {requestMeta ? <span className="block mt-2 text-[color:var(--text-secondary)]">Requested amount: {formatCurrency(bankCurrency, requestMeta.amount)}</span> : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 rounded-3xl border border-[color:var(--primary-gold)]/15 bg-[color:var(--surface)]/10 p-5">
                <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{tr('Premium bank details')}</p>
                <p className="mt-3 text-sm text-slate-300">{gateway === 'bank' ? tr('This is the premium bank section. Once an admin assigns the account, it will show here.') : `Once an admin assigns the ${config?.symbol} address, it will show here.`}</p>
                {bankDetails ? (
                  <div className="mt-4 rounded-3xl bg-[color:var(--bg-dark-navy)] px-4 py-4 text-[var(--text-white)] shadow-[0_12px_40px_rgba(15,23,42,0.18)]">
                    <p className="text-sm text-[color:var(--primary-gold)]">{tr('Bank name')}</p>
                    <p className="mt-2 break-all text-lg font-semibold">{bankDetails.bankName || '—'}</p>
                    <p className="mt-4 text-sm text-[color:var(--primary-gold)]">{tr('Account name')}</p>
                    <p className="mt-2 text-lg font-semibold">{bankDetails.accountName || '—'}</p>
                    <p className="mt-4 text-sm text-[color:var(--primary-gold)]">{tr('Account number')}</p>
                    <p className="mt-2 break-all text-lg font-semibold">{bankDetails.accountNumber}</p>
                    <p className="mt-1 text-sm text-slate-400">Transfer in {bankCurrency} using these details.</p>
                    {expiryLeft ? <p className="mt-2 text-sm text-emerald-200">Expires in {expiryLeft}</p> : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-dashed border-[color:var(--primary-gold)]/30 bg-[color:var(--bg-dark-navy)]/80 px-4 py-4 text-sm text-slate-400">
                    {tr('Bank account not assigned yet. Tap request and the admin will generate it.')}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="rounded-3xl border border-[color:var(--primary-gold)]/15 bg-[color:var(--bg-dark-navy)]/90 p-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{config?.symbol} deposit address</p>
                  <p className="mt-2 text-sm text-slate-400">Choose this coin and request an address from administration.</p>
                </div>
                <button
                  type="button"
                  onClick={handleRequestPaymentAccount}
                  disabled={pendingRequest || Boolean(bankDetails) || !amountIsValid}
                  className="mt-4 rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bankDetails ? 'Address assigned' : pendingRequest ? 'Address requested' : `Request ${config?.symbol} address`}
                </button>
                {pendingRequest && !bankDetails ? <p className="mt-3 text-sm text-amber-200">Waiting for admin to assign the requested {config?.symbol} address.</p> : null}
                {bankDetails ? (
                  <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-4">
                    <p className="text-sm text-emerald-200">Assigned {config?.symbol} address</p>
                    <p className="mt-2 break-all text-base font-semibold text-[var(--text-white)]">{bankDetails.accountNumber}</p>
                    <button type="button" onClick={handleCopy} className="mt-3 rounded-xl bg-[color:var(--primary-gold)] px-3 py-2 text-sm font-semibold text-[color:var(--bg-dark-navy)]">{copied ? 'Copied' : 'Copy address'}</button>
                    {accountExpiresAt ? <p className="mt-2 text-xs text-slate-400">Address resets five minutes after confirmation.</p> : null}
                  </div>
                ) : null}
              </div>

              {coinAmount ? (
                <div className="mt-4 rounded-3xl border border-[color:var(--primary-gold)]/15 bg-[color:var(--primary-gold)]/10 px-4 py-4">
                  <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Estimated amount</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--text-white)]">{coinAmount}</p>
                  <p className="mt-2 text-sm text-slate-400">Based on the current gateway rate.</p>
                </div>
              ) : null}
            </>
          )}

          {bankDetails ? (
            <div className="mt-6 rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--surface)]/10 p-5">
              <p className="text-sm font-semibold text-[var(--text-white)]">{gateway === 'bank' ? tr('Have you completed the bank transfer?') : tr('Have you sent the money')}</p>
              <p className="mt-2 text-sm text-slate-400">{tr('Notify the admin after sending the money so the deposit can be reviewed and approved.')}</p>
              <button
                type="button"
                onClick={handleDepositConfirmation}
                disabled={depositSubmitted || !amountIsValid}
                className="mt-4 rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {depositSubmitted ? tr('Confirmation sent') : tr('I have sent the money')}
              </button>
              {depositStatus ? (
                <div className="mt-3 rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)]/80 px-4 py-3 text-sm text-slate-300">
                  <span className="font-semibold text-[var(--text-white)]">{tr('Status:')}</span> {depositStatus}
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="mt-4 text-sm text-slate-400">{config?.note || 'No gateway details available.'}</p>
        </div>

        {showRequestModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,8,20,0.8)] backdrop-blur-sm">
            <div className="mx-4 max-w-xl rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.98)] p-6 shadow-xl shadow-black/50">
              <p className="text-xs uppercase tracking-[0.35em] text-[color:var(--primary-gold)]">{tr('Bank request pending')}</p>
              <h3 className="mt-4 text-2xl font-semibold text-[var(--text-white)]">{tr('Waiting for admin assignment')}</h3>
              <p className="mt-3 text-sm text-slate-300">{tr('Your bank transfer request is active. This screen will stay open until bank details are provided.')}</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-3 w-3 animate-pulse rounded-full bg-[color:var(--primary-gold)]" />
                <p className="text-sm text-[var(--text-secondary)]">Waiting for admin response …</p>
              </div>
              {bankDetails ? (
                <div className="mt-6 rounded-3xl border border-[color:var(--primary-gold)]/15 bg-[color:var(--surface)]/10 p-4">
                  <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Assigned details</p>
                  <p className="mt-3 text-sm text-slate-300">Bank: {bankDetails.bankName || '—'}</p>
                  <p className="mt-2 text-sm text-slate-300">Account name: {bankDetails.accountName || '—'}</p>
                  <p className="mt-2 text-sm text-slate-300">Account number: {bankDetails.accountNumber}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
