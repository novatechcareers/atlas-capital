'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { setSelectedAdminUserId, type UserAccount } from '@/lib/auth';

export default function AdminUserDetailPage() {
  const params = useParams<{ userId: string }>();
  const [user, setUser] = useState<UserAccount | null>(null);
  const [status, setStatus] = useState<'active' | 'pending' | 'suspended'>('active');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch(`/api/admin/users/${params.userId ?? ''}`);
        const result = await response.json();
        if (!response.ok || result?.error) {
          throw new Error(result?.error || 'Unable to load account.');
        }

        const account = result.user as UserAccount | null;
        setUser(account);
        if (account) {
          setSelectedAdminUserId(account.id);
          setStatus(account.status);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    if (params.userId) {
      loadUser();
    }
  }, [params.userId]);

  if (loading) {
    return (
      <AdminShell title="Account details" subtitle="Account profile and access.">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-700 bg-[rgba(4,16,33,0.94)] p-8 text-slate-300">
          Loading account details...
        </div>
      </AdminShell>
    );
  }

  if (!user) {
    return (
      <AdminShell title="User not found" subtitle="This account could not be located.">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-700 bg-[rgba(4,16,33,0.94)] p-8 text-slate-300">
          No account found for this user ID.
        </div>
      </AdminShell>
    );
  }

  const handleStatusChange = async (nextStatus: 'active' | 'pending' | 'suspended') => {
    setStatus(nextStatus);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const result = await response.json();
      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Unable to update status.');
      }
      setUser((current) => current ? { ...current, status: nextStatus } : current);
    } catch (error) {
      console.error('Failed to update user status:', error);
      setStatus(user.status);
    }
  };

  return (
    <AdminShell title="Account details" subtitle="Account profile and access.">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Account details</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">{user.firstName} {user.lastName}</h2>
            </div>
            <div className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-2 text-sm text-[color:var(--text-secondary)]">
              {user.role}
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Basic info</p>
            <div className="mt-4 space-y-3">
              <p><span className="font-semibold text-[var(--text-primary)]">Email:</span> {user.email}</p>
              <p><span className="font-semibold text-[var(--text-primary)]">Phone:</span> {user.phone}</p>
              <p><span className="font-semibold text-[var(--text-primary)]">Country:</span> {user.country}</p>
              <p><span className="font-semibold text-[var(--text-primary)]">Created:</span> {new Date(user.createdAt).toLocaleString()}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 text-sm text-[var(--text-secondary)]">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Actions</p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-2 block text-[var(--text-primary)]">Account status</span>
                <select
                  value={status}
                  onChange={(event) => handleStatusChange(event.target.value as 'active' | 'pending' | 'suspended')}
                  className="w-full rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-4 py-3 text-[var(--text-primary)] outline-none"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="suspended">Suspended</option>
                </select>
              </label>

              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-200">
                Account is currently <span className="font-semibold">{status}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
