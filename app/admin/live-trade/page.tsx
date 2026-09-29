'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { ProfileGauge } from '@/components/profile-gauge';
import { getSelectedAdminUserId } from '@/lib/auth';

export default function AdminLiveTradePage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedUserId(getSelectedAdminUserId()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <AdminShell title="Live Trade" subtitle="Configure live-trade profit and loss settings independently from auto trade.">
      <div className="mx-auto max-w-5xl space-y-6">
        {!selectedUserId ? (
          <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-6 text-sm text-[color:var(--text-secondary)]">
            Select an account to manage its live-trade outcomes.
          </div>
        ) : (
          <ProfileGauge key={selectedUserId} userId={selectedUserId} editable scope="live" />
        )}
      </div>
    </AdminShell>
  );
}