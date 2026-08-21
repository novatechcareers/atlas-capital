'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { getSelectedAdminUserId } from '@/lib/auth';

type HistoryEntry = { id: string; userId: string; type: string; title: string; detail: string; status: string; createdAt: string };

export default function AdminReportsPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const userId = getSelectedAdminUserId();
    const loadHistory = async () => {
      try {
        const response = await fetch(userId ? `/api/admin/history?userId=${encodeURIComponent(userId)}` : '/api/admin/history');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Unable to load history.');
        setHistory(Array.isArray(payload?.history) ? payload.history : []);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Unable to load history.');
      }
    };
    void loadHistory();
  }, []);

  return (
    <AdminShell title="Reports" subtitle="Account activity and transaction history.">
      <div className="mx-auto max-w-6xl space-y-6">
        {message ? <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{message}</div> : null}
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">General history</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-white)]">Account activity</h2>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-[color:var(--primary-gold)]/20">
            <table className="min-w-full divide-y divide-[color:var(--primary-gold)]/20">
              <thead className="bg-[color:var(--primary-gold)]/10"><tr><th className="px-4 py-3 text-left text-sm text-slate-300">Type</th><th className="px-4 py-3 text-left text-sm text-slate-300">Event</th><th className="px-4 py-3 text-left text-sm text-slate-300">Detail</th><th className="px-4 py-3 text-left text-sm text-slate-300">Status</th><th className="px-4 py-3 text-left text-sm text-slate-300">Date</th></tr></thead>
              <tbody>{history.length ? history.map((entry) => <tr key={entry.id} className="border-t border-[color:var(--primary-gold)]/10"><td className="px-4 py-3 text-sm text-[color:var(--primary-gold)]">{entry.type}</td><td className="px-4 py-3 text-sm text-[var(--text-white)]">{entry.title}</td><td className="px-4 py-3 text-sm text-slate-300">{entry.detail}</td><td className="px-4 py-3 text-sm text-slate-300">{entry.status}</td><td className="whitespace-nowrap px-4 py-3 text-sm text-slate-400">{new Date(entry.createdAt).toLocaleString()}</td></tr>) : <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No history found.</td></tr>}</tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
