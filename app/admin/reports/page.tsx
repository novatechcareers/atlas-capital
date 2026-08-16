'use client';

import { AdminShell } from '@/components/admin-shell';

export default function AdminReportsPage() {
  return (
    <AdminShell title="Admin Reports" subtitle="View site and transaction reports.">
      <div className="mx-auto max-w-4xl rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
        <p className="text-sm text-slate-300">This admin section is reserved for report viewing and analytics.</p>
      </div>
    </AdminShell>
  );
}
