'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { getAccountById, getSelectedAdminUserId } from '@/lib/auth';
import { getStoredVerification, subscribeToVerification, updateVerification, VerificationRequest, syncVerificationFromServer } from '@/lib/verification';

export default function AdminVerifyAccountPage() {
  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = selectedUserId ? getAccountById(selectedUserId) : null;
  const [allUploads, setAllUploads] = useState<any[] | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedUserId(getSelectedAdminUserId()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setRequest(null);
      return;
    }

    setRequest(getStoredVerification(selectedUserId));
    // fetch latest from server and persist to local storage + broadcast so admin sees uploaded documents
    void (async () => {
      try {
        const serverRequest = await syncVerificationFromServer(selectedUserId);
        if (serverRequest) {
          setRequest(serverRequest);
        }
      } catch (err) {
        console.error('syncVerificationFromServer failed', err);
      }
      // load all verification rows so admin can inspect every upload
      try {
        const resp = await fetch(`/api/admin/verification?userId=${encodeURIComponent(selectedUserId)}`);
        if (resp.ok) {
          const payload = await resp.json();
          setAllUploads(Array.isArray(payload?.requests) ? payload.requests : []);
        } else {
          setAllUploads([]);
        }
      } catch (err) {
        console.error('Failed to fetch all verification uploads', err);
        setAllUploads([]);
      }
    })();

    const unsubscribe = subscribeToVerification(setRequest, selectedUserId);
    return unsubscribe;
  }, [selectedUserId]);

  const renderPreview = () => {
    if (!request) return null;
    if (request.fileType.startsWith('image/')) {
      return <img src={request.fileDataUrl} alt={request.fileName} className="max-h-80 w-full rounded-3xl object-contain" />;
    }
    return (
      <a href={request.fileDataUrl} target="_blank" rel="noreferrer" className="text-[color:var(--primary-gold)] underline">
        View uploaded document
      </a>
    );
  };

  const renderAllUploads = () => {
    if (allUploads === null) return null;
    if (!allUploads.length) return <p className="text-sm text-slate-400">No previous uploads found.</p>;

    return (
      <div className="mt-4">
        <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">All uploads</p>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {allUploads.map((u: any) => {
            const src = u.fileDataUrl ?? u.file_data_url ?? '';
            const fileType = u.file_type ?? u.fileType ?? '';
            return (
              <div key={u.id} className="rounded-2xl border border-[color:var(--border-soft)] p-2 bg-[color:var(--surface)]">
                {fileType.startsWith('image/') ? (
                  <a href={src} target="_blank" rel="noreferrer">
                    <img src={src} alt={u.file_name} className="h-28 w-full object-contain" />
                  </a>
                ) : (
                  <a href={src} target="_blank" rel="noreferrer" className="text-[color:var(--primary-gold)] underline">{u.file_name}</a>
                )}
                <p className="mt-2 text-xs text-slate-400">{new Date(u.created_at ?? u.createdAt ?? Date.now()).toLocaleString()}</p>
                <p className="text-xs text-slate-400">{u.status ?? ''}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleApprove = async () => {
    if (!request || !selectedUserId) return;

    const updatedRequest = await updateVerification({
      status: 'Approved',
      reason: undefined,
      reviewedAt: Date.now(),
    }, selectedUserId);
    if (!updatedRequest) {
      setMessage({ type: 'error', text: 'Unable to approve verification. Please try again.' });
      return;
    }
    setRequest(updatedRequest);
    setMessage({ type: 'success', text: 'Verification approved successfully.' });
  };

  const handleDecline = async () => {
    if (!request || !selectedUserId) return;
    if (!reason.trim()) {
      setMessage({ type: 'error', text: 'Please provide a reason for declining the document.' });
      return;
    }

    const updatedRequest = await updateVerification({
      status: 'Declined',
      reason: reason.trim(),
      reviewedAt: Date.now(),
    }, selectedUserId);
    if (!updatedRequest) {
      setMessage({ type: 'error', text: 'Unable to decline verification. Please try again.' });
      return;
    }
    setRequest(updatedRequest);
    setMessage({ type: 'success', text: 'Verification declined and reason recorded.' });
  };

  return (
    <AdminShell title="Identity Review" subtitle="Identity document queue.">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Verification review</p>
              <div className="mt-2 flex items-center gap-3">
                <h2 className="text-2xl font-semibold text-[var(--text-white)]">{selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}'s verification` : 'Pending account verification'}</h2>
                <Link href="/admin/users" className="ml-2 rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-1 text-sm text-[color:var(--primary-gold)]">Select account</Link>
              </div>
            </div>
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-3 text-sm text-slate-300">
              {request ? request.status : selectedUserId ? 'No verification request' : 'No user selected'}
            </div>
          </div>
        </div>

        {message ? (
          <div className={`rounded-3xl border px-5 py-4 text-sm ${message.type === 'error' ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
            {message.text}
          </div>
        ) : null}

        {!selectedUserId ? (
          <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 text-sm text-slate-300 shadow-lg shadow-black/30">
            Select an account to review identity documents.
          </div>
        ) : request ? (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6 rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
              <div className="space-y-3 text-sm text-slate-300">
                <p className="text-sm text-[color:var(--primary-gold)] uppercase tracking-[0.3em]">Document details</p>
                <p><span className="font-semibold text-[var(--text-white)]">Type:</span> {request.type}</p>
                <p><span className="font-semibold text-[var(--text-white)]">File:</span> {request.fileName}</p>
                <p><span className="font-semibold text-[var(--text-white)]">Uploaded:</span> {new Date(request.uploadedAt).toLocaleString()}</p>
                <p><span className="font-semibold text-[var(--text-white)]">Status:</span> {request.status}</p>
                {request.status === 'Declined' ? (
                  <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">Decline reason: {request.reason}</p>
                ) : null}
              </div>

              <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5">
                <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Document preview</p>
                <div className="mt-4">{renderPreview()}</div>
              </div>
            </div>

            <div className="space-y-6 rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
              <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5">
                <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Actions</p>
                <div className="mt-5 space-y-4">
                  <button
                    type="button"
                    onClick={handleApprove}
                    className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
                  >
                    Approve document
                  </button>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-[var(--text-white)]">Decline reason</label>
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      rows={4}
                      className="w-full rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
                      placeholder="Enter a reason for declining this verification"
                    />
                    <button
                      type="button"
                      onClick={handleDecline}
                      className="mt-3 w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-400"
                    >
                      Decline document
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30 text-sm text-slate-300">
            No document has been uploaded yet for verification for this selected user.
          </div>
        )}
      </div>
    </AdminShell>
  );
}
