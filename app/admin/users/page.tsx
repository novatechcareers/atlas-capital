'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { setSelectedAdminUserId, getSelectedAdminUserId, type UserAccount } from '@/lib/auth';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return getSelectedAdminUserId();
  });

  useEffect(() => {
    async function loadUsers() {
      try {
        const response = await fetch('/api/admin/users');
        const result = await response.json();
        if (!response.ok || result?.error) {
          throw new Error(result?.error || 'Unable to load users.');
        }
        setUsers(result.users ?? []);
      } catch (error) {
        console.error('Failed to load users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, []);

  useEffect(() => {
    // update selected id from sessionStorage on mount and when storage changes
    if (typeof window !== 'undefined') setSelectedAdminId(getSelectedAdminUserId());

    const handler = (e: StorageEvent) => {
      if (e.key === 'atlas-selected-admin-user') {
        setSelectedAdminId(e.newValue);
      }
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <AdminShell title="Accounts" subtitle="Account records and access.">
      <div className="mx-auto max-w-6xl rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">User list</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Created accounts</h2>
          </div>
          <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-1 text-sm text-[color:var(--text-secondary)]">
            {users.length} users
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center text-slate-300">
            Loading accounts...
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-8 text-center text-slate-300">
            No users yet. New account registrations will appear here after sign up.
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const isSelected = user.id === selectedAdminId;
              return (
                <div
                  key={user.id}
                  className={`flex flex-col gap-3 rounded-2xl border p-4 text-left lg:flex-row lg:items-center lg:justify-between ${isSelected ? 'border-[color:var(--primary-gold)] ring-2 ring-[color:var(--primary-gold)]/20 bg-[color:var(--surface)]' : 'border-[color:var(--border-soft)] bg-[color:var(--surface)]'}`}
                >
                  <div>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">
                      {user.firstName} {user.lastName}
                      {isSelected ? <span className="ml-3 inline-flex items-center rounded-full bg-[color:var(--primary-gold)]/10 px-2 py-0.5 text-xs font-medium text-[color:var(--primary-gold)]">Selected</span> : null}
                    </p>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{user.email}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-secondary)]">
                      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">{user.status}</span>
                      <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-cyan-300">{user.role}</span>
                      <span className="rounded-full bg-slate-800 px-2 py-1">{user.country}</span>
                      <span className="rounded-full bg-slate-800 px-2 py-1">{user.phone}</span>
                    </div>

                    <div className="ml-4 flex items-center gap-2">
                      <Link href={`/admin/users/${user.id}`} className="text-sm text-[color:var(--primary-gold)] underline">View</Link>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAdminUserId(user.id);
                          setSelectedAdminId(user.id);
                          router.push(`/admin/users/${user.id}`);
                        }}
                        className="rounded-2xl bg-[color:var(--primary-gold)] px-3 py-2 text-sm font-semibold text-[color:var(--bg-dark-navy)] hover:opacity-90"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
