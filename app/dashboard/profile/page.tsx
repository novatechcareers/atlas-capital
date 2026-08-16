'use client';

import { ChangeEvent, useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { getAccountById, getSession, getUserStorageKey } from '@/lib/auth';
import { subscribeToVerification, VerificationRequest } from '@/lib/verification';

type ProfileState = {
  name: string;
  email: string;
  phone: string;
  country: string;
  dateOfBirth: string;
  occupation: string;
  address: string;
};

const PROFILE_STORAGE_KEY = 'atlas-profile-data';
const PROFILE_LOCK_KEY = 'atlas-profile-locked';

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileState>({
    name: 'New user',
    email: '',
    phone: '',
    country: '',
    dateOfBirth: '',
    occupation: 'Trader',
    address: '123 Market Street',
  });
  const [photoName, setPhotoName] = useState('No photo selected');
  const [photoUrl, setPhotoUrl] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const session = getSession();
      const account = session ? getAccountById(session.id) : null;
      if (session) {
        setProfile((current) => ({
          ...current,
          name: session.name,
          email: session.email,
          phone: account?.phone || current.phone,
          country: account?.country || current.country,
        }));
      }

      const storedProfile = window.localStorage.getItem(getUserStorageKey(PROFILE_STORAGE_KEY));
      const storedLock = window.localStorage.getItem(getUserStorageKey(PROFILE_LOCK_KEY));

      if (storedProfile) {
        try {
          setProfile(JSON.parse(storedProfile));
        } catch {
          // ignore invalid stored profile
        }
      }

      if (storedLock === 'true') {
        setHasSavedProfile(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToVerification(setVerificationRequest);
    return unsubscribe;
  }, []);

  useEffect(() => {
    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [photoUrl]);

  const canEdit = !hasSavedProfile;

  const verificationStatus = verificationRequest?.status ?? 'Not requested';
  const isVerified = verificationRequest?.status === 'Approved';

  const handleProfileChange = (field: keyof ProfileState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setProfile((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const nextUrl = URL.createObjectURL(file);
      setPhotoUrl(nextUrl);
      setPhotoName(file.name);
    }
  };

  const saveProfile = () => {
    window.localStorage.setItem(getUserStorageKey(PROFILE_STORAGE_KEY), JSON.stringify(profile));
    window.localStorage.setItem(getUserStorageKey(PROFILE_LOCK_KEY), 'true');
    setHasSavedProfile(true);
    setShowModal(false);
  };

  const initials = profile.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <DashboardShell
      title="Profile"
      subtitle="Manage your profile details, upload your photo, and contact support for password help."
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 text-center shadow-lg shadow-black/30">
            <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)]">
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-full w-full text-[color:var(--primary-gold)]" fill="currentColor">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              )}
            </div>
            <h2 className="mt-4 text-xl font-semibold text-[var(--text-white)]">{profile.name}</h2>
            <p className="mt-1 text-sm text-slate-400">{profile.email}</p>
            <div className="mt-5 space-y-2 text-sm text-slate-300">
              <div className="rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-3">Role: user</div>
              <div className="rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-3">Joined: 3 days ago</div>
              <div className="rounded-2xl bg-[color:var(--primary-gold)]/10 px-3 py-3">Status: active</div>
              <div className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 ${isVerified ? 'bg-emerald-500/15 text-emerald-200' : verificationStatus === 'Pending' ? 'bg-yellow-500/15 text-yellow-200' : verificationStatus === 'Declined' ? 'bg-red-500/15 text-red-200' : 'bg-slate-700 text-slate-300'}`}>
                {isVerified ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-slate-950">✓</span> : null}
                Verify account: {isVerified ? 'Verified' : verificationStatus}
              </div>
            </div>
            <div className="mt-6 rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--bg-dark-navy)] p-4 text-left text-sm text-slate-300">
              <p className="font-medium text-[var(--text-white)]">Profile photo</p>
              <p className="mt-2 text-sm text-slate-400">Upload a profile picture to replace the generic icon.</p>
              <label className={`mt-4 inline-flex cursor-pointer items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition hover:opacity-90 ${canEdit ? 'bg-[color:var(--primary-gold)] text-[color:var(--bg-dark-navy)]' : 'cursor-not-allowed bg-slate-700 text-slate-400'}`}>
                Choose photo
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={!canEdit}
                  onChange={handlePhotoUpload}
                />
              </label>
              <p className="mt-3 text-xs text-slate-500">{photoName}</p>
              {!canEdit && (
                <p className="mt-2 text-xs text-slate-500">Profile editing is locked after the first update.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Profile details</p>
                <button
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${canEdit ? 'bg-[color:var(--primary-gold)] text-[color:var(--bg-dark-navy)] hover:opacity-90' : 'cursor-not-allowed bg-slate-700 text-slate-400'}`}
                  onClick={() => canEdit && setShowModal(true)}
                  disabled={!canEdit}
                >
                  Edit profile
                </button>
              </div>

              <div className="mt-6 space-y-4 text-sm text-slate-300">
                <div className="grid gap-2 sm:grid-cols-2">
                  <span className="font-medium text-[var(--text-white)]">Full name</span>
                  <span>{profile.name}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <span className="font-medium text-[var(--text-white)]">Email</span>
                  <span>{profile.email}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <span className="font-medium text-[var(--text-white)]">Phone</span>
                  <span>{profile.phone}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <span className="font-medium text-[var(--text-white)]">Country</span>
                  <span>{profile.country}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <span className="font-medium text-[var(--text-white)]">Date of birth</span>
                  <span>{profile.dateOfBirth}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <span className="font-medium text-[var(--text-white)]">Occupation</span>
                  <span>{profile.occupation}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <span className="font-medium text-[var(--text-white)]">Address</span>
                  <span>{profile.address}</span>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--bg-dark-navy)] p-4 text-sm text-slate-300">
                {hasSavedProfile ? (
                  <p className="text-emerald-400">Profile has been edited once and editing is now locked.</p>
                ) : (
                  <p className="text-slate-400">You can update your profile once. After saving, further edits will be disabled.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
              <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Security</p>
              <div className="mt-6 space-y-4 text-sm text-slate-300">
                <div className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--bg-dark-navy)] p-4">
                  <p className="font-medium text-[var(--text-white)]">Password reset</p>
                  <p className="mt-3 text-sm text-slate-400">
                    To reset your password, contact admin support by email at{' '}
                    <a href="mailto:workdaysupport.novatech@gmail.com" className="text-[color:var(--primary-gold)] underline">
                      workdaysupport.novatech@gmail.com
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.98)] p-6 shadow-xl shadow-black/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-[var(--text-white)]">Edit profile</p>
                <p className="mt-2 text-sm text-slate-400">Fill in your details once. This form can only be submitted one time.</p>
              </div>
              <button
                type="button"
                className="rounded-2xl border border-[color:var(--border-soft)] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/5"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-slate-300">Full name</label>
                <input
                  className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)]"
                  value={profile.name}
                  onChange={handleProfileChange('name')}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Email</label>
                <input
                  className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)]"
                  value={profile.email}
                  onChange={handleProfileChange('email')}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Phone</label>
                <input
                  className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)]"
                  value={profile.phone}
                  onChange={handleProfileChange('phone')}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Country</label>
                <input
                  className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)]"
                  value={profile.country}
                  onChange={handleProfileChange('country')}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Date of birth</label>
                <input
                  type="date"
                  className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)]"
                  value={profile.dateOfBirth}
                  onChange={handleProfileChange('dateOfBirth')}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-slate-300">Occupation</label>
                <input
                  className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)]"
                  value={profile.occupation}
                  onChange={handleProfileChange('occupation')}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm text-slate-300">Address</label>
                <input
                  className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)]"
                  value={profile.address}
                  onChange={handleProfileChange('address')}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-2xl border border-[color:var(--border-soft)] px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90"
                onClick={saveProfile}
              >
                Save profile
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
