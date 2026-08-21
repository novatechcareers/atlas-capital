'use client';

import { useEffect, useRef, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { getStoredVerification, saveStoredVerification, subscribeToVerification, syncVerificationFromServer, VerificationRequest } from '@/lib/verification';

const documentTypes = [
  { value: 'passport', label: 'Passport' },
  { value: 'driver_license', label: 'Driver License' },
  { value: 'national_id', label: 'National ID' },
  { value: 'utility_bill', label: 'Utility Bill' },
];

export default function VerifyAccountPage() {
  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [docType, setDocType] = useState(documentTypes[0].value);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadRequest = async () => {
      const latest = await syncVerificationFromServer();
      setRequest(latest ?? getStoredVerification());
    };

    void loadRequest();
    const unsubscribe = subscribeToVerification(setRequest);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  }, [selectedFile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setMessage(null);
  };

  const handleUpload = async () => {
    if (isUploading) return;
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Please select a document to upload.' });
      return;
    }

    if (!previewUrl) {
      setMessage({ type: 'error', text: 'Unable to read the selected file. Please try another file.' });
      return;
    }

    const request: VerificationRequest = {
      id: Date.now(),
      type: documentTypes.find((option) => option.value === docType)?.label ?? 'Unknown Document',
      fileName: selectedFile.name,
      fileType: selectedFile.type,
      fileDataUrl: previewUrl,
      status: 'Pending',
      uploadedAt: Date.now(),
    };

    setIsUploading(true);
    try {
      const savedRequest = await saveStoredVerification(request);
      if (!savedRequest) {
        setMessage({ type: 'error', text: 'Unable to upload your document. Please try again.' });
        return;
      }
      setRequest(savedRequest);
      setMessage({ type: 'success', text: 'Document submitted for identity review.' });
    } finally {
      setIsUploading(false);
    }
  };

  const renderStatus = () => {
    if (!request) return null;
    if (request.status === 'Approved') {
      return (
        <div className="flex items-center gap-4 rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-sm font-semibold text-emerald-200">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl text-slate-950" aria-label="Verified">✓</span>
          <div>
            <p className="text-lg">Verified account</p>
            <p className="mt-1 text-sm font-normal text-emerald-200/80">Your identity document was approved by administration.</p>
          </div>
        </div>
      );
    }

    if (request.status === 'Declined') {
      return (
        <div className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-200">
          Document declined by admin: {request.reason || 'No reason provided.'}
        </div>
      );
    }

    return (
      <div className="rounded-3xl border border-[color:var(--primary-gold)]/30 bg-[color:var(--surface)] p-4 text-sm text-slate-300">
        Verification is pending review.
      </div>
    );
  };

  return (
    <DashboardShell title="Identity Verification" subtitle="Identity document status.">
      <div className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
        <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--primary-gold)]/10 px-5 py-4">
          <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Account verification</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-white)]">Upload Verification Document</h2>
        </div>

        {request ? renderStatus() : null}

        {request?.status === 'Approved' ? (
          <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6 text-center text-sm text-emerald-100">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl font-bold text-slate-950">✓</div>
            <p className="mt-4 text-lg font-semibold">Verification complete</p>
            <p className="mt-2 text-sm text-emerald-200/80">Document uploads are disabled because your account is already verified.</p>
          </div>
        ) : (
        <div className="grid gap-4 rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)]/70 p-6">
          <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
            <div>
              <label className="mb-2 block text-sm text-slate-300">Document type</label>
              <select
                value={docType}
                onChange={(event) => setDocType(event.target.value)}
                className="w-full rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
              >
                {documentTypes.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[color:var(--bg-dark-navy)] text-[var(--text-white)]">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">Upload document</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="w-full rounded-2xl border border-dashed border-[color:var(--primary-gold)]/25 bg-[color:var(--bg-dark-navy)] px-4 py-4 text-sm text-slate-300 outline-none"
              />
            </div>
          </div>

          {previewUrl ? (
            <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-4">
              <p className="mb-3 text-sm text-[color:var(--primary-gold)]">Preview</p>
              {selectedFile?.type.startsWith('image/') ? (
                <img src={previewUrl} alt="Document preview" className="h-72 w-full rounded-3xl object-contain" />
              ) : (
                <a href={previewUrl} target="_blank" rel="noreferrer" className="text-[color:var(--primary-gold)] underline">
                  View uploaded document
                </a>
              )}
            </div>
          ) : null}

          {message ? (
            <div className={`rounded-3xl border px-4 py-4 text-sm ${message.type === 'error' ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
              {message.text}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || !previewUrl || isUploading}
            className="mt-3 w-full rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90"
          >
            {isUploading ? 'Uploading...' : 'Upload Document for Verification'}
          </button>
        </div>
        )}
      </div>
    </DashboardShell>
  );
}
