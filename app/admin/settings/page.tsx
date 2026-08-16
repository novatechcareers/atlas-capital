'use client';

import { AdminShell } from '@/components/admin-shell';

export default function AdminSettingsPage() {
  return (
    <AdminShell title="Admin Settings" subtitle="Configure website-wide settings.">
      <div className="mx-auto max-w-4xl rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
        <p className="text-sm text-slate-300">This admin section is reserved for site configuration and preferences.</p>
      </div>
    </AdminShell>
  );
}
