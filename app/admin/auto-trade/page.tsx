'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import {
  type AutoTradePurchase,
  subscribeToAutoTrade,
  resetAutoTrade,
  updateAutoTradeStatus,
} from '@/lib/auto-trade';
import { getSelectedAdminUserId } from '@/lib/auth';
import { formatCurrency } from '@/lib/balance';
import { useLanguage } from '@/components/language-provider';
import { translatePageText } from '@/lib/i18n';

export default function AdminAutoTradePage() {
  const { language } = useLanguage();
  const tr = (text: string) => translatePageText(language, text);
  const [purchase, setPurchase] = useState<AutoTradePurchase | null>(null);
  const [message, setMessage] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedUserId(getSelectedAdminUserId()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      const timer = window.setTimeout(() => setPurchase(null), 0);
      return () => window.clearTimeout(timer);
    }

    // Fetch from server first to ensure we see data from the database, not stale localStorage
    const syncAndSubscribe = async () => {
      try {
        const response = await fetch(`/api/auto-trade?userId=${encodeURIComponent(selectedUserId)}`);
        if (response.ok) {
          const { purchase: serverPurchase } = await response.json();
          if (serverPurchase) {
            setPurchase({
              id: serverPurchase.id,
              planName: serverPurchase.planName,
              price: Number(serverPurchase.price),
              status: serverPurchase.status,
              createdAt: serverPurchase.createdAt,
              updatedAt: serverPurchase.updatedAt,
              activatedAt: serverPurchase.activatedAt,
            });
          } else {
            setPurchase(null);
          }
        }
      } catch (err) {
        // Fall back to localStorage if server fetch fails
        setPurchase(null);
      }
    };

    void syncAndSubscribe();
    return subscribeToAutoTrade(setPurchase, selectedUserId);
  }, [selectedUserId]);

  const changeStatus = async (status: AutoTradePurchase['status'], text: string) => {
    if (!selectedUserId || !purchase) return;
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      // Update in database
      const response = await fetch(`/api/admin/auto-trade/${purchase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        const { purchase: updated } = await response.json();
        setPurchase({
          id: updated.id,
          planName: updated.planName,
          price: Number(updated.price),
          status: updated.status,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          activatedAt: updated.activatedAt,
        });
        setMessage(text);
      } else {
        setMessage('Failed to update auto-trade status.');
      }
    } catch (err) {
      console.error('Failed to update auto-trade status:', err);
      setMessage('Error updating auto-trade status.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReset = async () => {
    if (!selectedUserId || !purchase || isUpdating) return;
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/auto-trade/${encodeURIComponent(String(purchase.id))}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to reset auto-trade.');
      resetAutoTrade(selectedUserId);
      setPurchase(null);
      setMessage(tr('Auto-trade bot closed and payment selection has been restored for the client.'));
    } catch (error) {
      console.error('Failed to reset auto-trade:', error);
      setMessage('Failed to reset auto-trade.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AdminShell title="Auto Trade" subtitle="Plan payments and automation status.">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{tr('Auto-trade payment queue')}</p>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-[var(--text-white)]">{tr('Payment and bot controls')}</h2>
            <Link href="/admin/users" className="ml-2 rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-1 text-sm text-[color:var(--primary-gold)]">Select account</Link>
          </div>
          <p className="mt-3 text-sm text-slate-400">{tr('Payment and automation controls.')}</p>
        </div>

        {message ? <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div> : null}

        {!purchase ? (
          <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-8 text-center text-sm text-[var(--text-secondary)]">{tr('No auto-trade payment is awaiting review.')}</div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-slate-400">{tr('Account auto-trade plan')}</p>
                  <h3 className="mt-2 text-2xl font-semibold text-[var(--text-white)]">{purchase.planName}</h3>
                  <p className="mt-2 text-sm text-slate-300">{tr('Payment:')} {formatCurrency(purchase.price)}</p>
                </div>
                <span className={`rounded-full px-4 py-2 text-sm font-semibold ${purchase.status === 'Reviewing' ? 'bg-amber-500/15 text-amber-200' : purchase.status === 'Running' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-sky-500/15 text-sky-200'}`}>
                  {tr(purchase.status)}
                </span>
              </div>

              {purchase.status === 'Reviewing' ? (
                <button type="button" disabled={isUpdating} onClick={() => changeStatus('Unlocked', tr('Payment confirmed. Auto-trade controls are now unlocked.'))} className="mt-6 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                  {isUpdating ? `${tr('Payment received and confirmed')}...` : tr('Payment received and confirmed')}
                </button>
              ) : (
                <div className="mt-6 border-t border-[color:var(--border-soft)] pt-6">
                  <p className="text-sm font-semibold text-[var(--text-white)]">{tr('Bot controls')}</p>
                  <p className="mt-2 text-sm text-slate-400">{tr('These controls are available after payment confirmation.')}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" disabled={purchase.status === 'Running' || isUpdating} onClick={() => changeStatus('Running', tr('Auto-trade bot started.'))} className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{isUpdating ? `${tr('Start bot')}...` : tr('Start bot')}</button>
                    <button type="button" disabled={purchase.status !== 'Running' || isUpdating} onClick={() => changeStatus('Stopped', tr('Auto-trade bot stopped.'))} className="rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">{isUpdating ? `${tr('Stop bot')}...` : tr('Stop bot')}</button>
                    <button type="button" disabled={isUpdating} onClick={handleReset} className="rounded-2xl border border-amber-400/40 px-5 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/10">{isUpdating ? `${tr('Reset bot and restore payment')}...` : tr('Reset bot and restore payment')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
