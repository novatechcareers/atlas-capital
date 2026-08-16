'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { setSession } from '@/lib/auth';
import { LanguageSelector } from '@/components/language-selector';
import { useLanguage } from '@/components/language-provider';

const countryOptions = ['United States', 'Brazil', 'United Kingdom', 'Canada', 'Germany', 'France', 'Nigeria', 'South Africa', 'India', 'United Arab Emirates', 'Australia', 'Japan', 'Singapore'];
const countryCodeOptions = [
  { country: 'United States', code: '+1' },
  { country: 'Brazil', code: '+55' },
  { country: 'United Kingdom', code: '+44' },
  { country: 'Australia', code: '+61' },
  { country: 'India', code: '+91' },
  { country: 'Nigeria', code: '+234' },
  { country: 'United Arab Emirates', code: '+971' },
  { country: 'South Africa', code: '+27' },
  { country: 'Germany', code: '+49' },
  { country: 'France', code: '+33' },
  { country: 'Japan', code: '+81' },
  { country: 'Singapore', code: '+65' },
];

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  country: 'United States',
  password: '',
  confirmPassword: '',
};

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [form, setForm] = useState(initialForm);
  const [phoneCode, setPhoneCode] = useState('+1');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [profileCreated, setProfileCreated] = useState<boolean | null>(null);
  const [profileErrorMessage, setProfileErrorMessage] = useState('');
  const [configError, setConfigError] = useState('');
  const [configChecked, setConfigChecked] = useState(false);

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  useEffect(() => {
    async function checkConfig() {
      try {
        const response = await fetch('/api/supabase-config');
        const result = await response.json();

        if (!response.ok || !result?.ok) {
          setConfigError(result?.message || 'Supabase configuration is invalid.');
          return;
        }

        if (!result.loginReady) {
          setConfigError(result?.message || 'Supabase login configuration is incomplete.');
          return;
        }

        if (!result.registrationReady) {
          setConfigError('Database-backed registration is unavailable until the service role key is configured.');
        }
      } catch (error) {
        setConfigError('Unable to validate Supabase configuration.');
      } finally {
        setConfigChecked(true);
      }
    }

    checkConfig();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setIsSuccess(false);

    if (configError) {
      setError(configError);
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          phone: `${phoneCode} ${form.phone}`.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Unable to create account.');
      }

      setSession({
        id: result.id,
        email: result.email,
        role: 'user',
        name: `${result.firstName} ${result.lastName}`,
      });
      setProfileCreated(result.profileCreated ?? false);
      setProfileErrorMessage(result.profileError ?? '');
      setIsSuccess(true);

      window.setTimeout(() => {
        router.push('/dashboard');
      }, 1200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to create account.');
      setIsSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06101f] px-4 py-10 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(218,183,95,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_30%)]">
      <div className="relative w-full max-w-2xl rounded-[2rem] border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.92)] p-8 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
        <div className="mb-8 text-center">
          <div className="flex justify-end"><LanguageSelector /></div>
          <div className="mx-auto flex h-44 w-44 items-center justify-center">
            <Image src="/image/icon.png" alt="Atlas Capital" width={176} height={176} className="h-44 w-44 object-contain" priority />
          </div>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.35em] text-[color:var(--primary-gold)]">Atlas Capital</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{t('createAccount')}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Set up your personal account to access deposits, trading, and account services.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-slate-300">{t('firstName')}</label>
              <input
                value={form.firstName}
                onChange={(event) => handleChange('firstName', event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-[color:var(--primary-gold)]/60 focus:ring-2 focus:ring-[color:var(--primary-gold)]/10"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-slate-300">{t('lastName')}</label>
              <input
                value={form.lastName}
                onChange={(event) => handleChange('lastName', event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-[color:var(--primary-gold)]/60 focus:ring-2 focus:ring-[color:var(--primary-gold)]/10"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-slate-300">{t('email')}</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-[color:var(--primary-gold)]/60 focus:ring-2 focus:ring-[color:var(--primary-gold)]/10"
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-slate-300">{t('phoneNumber')}</label>
              <div className="flex gap-3">
                <select
                  value={phoneCode}
                  onChange={(event) => setPhoneCode(event.target.value)}
                  className="w-28 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-sm text-white outline-none transition focus:border-[color:var(--primary-gold)]/60"
                >
                  {countryCodeOptions.map((option) => (
                    <option key={option.code} value={option.code} className="bg-slate-900 text-white">
                      {option.country} ({option.code})
                    </option>
                  ))}
                </select>
                <input
                  value={form.phone}
                  onChange={(event) => handleChange('phone', event.target.value)}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-[color:var(--primary-gold)]/60 focus:ring-2 focus:ring-[color:var(--primary-gold)]/10"
                  placeholder="Enter phone number"
                  required
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-slate-300">{t('country')}</label>
              <select
                value={form.country}
                onChange={(event) => handleChange('country', event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-[color:var(--primary-gold)]/60 focus:ring-2 focus:ring-[color:var(--primary-gold)]/10"
                required
              >
                {countryOptions.map((country) => (
                  <option key={country} value={country} className="bg-slate-900 text-white">
                    {country}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-slate-300">{t('password')}</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => handleChange('password', event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-[color:var(--primary-gold)]/60 focus:ring-2 focus:ring-[color:var(--primary-gold)]/10"
                placeholder="At least 6 characters with letters and numbers"
                required
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="mt-2 text-xs font-semibold text-[color:var(--primary-gold)] hover:brightness-125">
                {showPassword ? t('hidePassword') : t('showPassword')}
              </button>
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm text-slate-300">{t('confirmPassword')}</label>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(event) => handleChange('confirmPassword', event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-[color:var(--primary-gold)]/60 focus:ring-2 focus:ring-[color:var(--primary-gold)]/10"
                required
              />
              <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} className="mt-2 text-xs font-semibold text-[color:var(--primary-gold)] hover:brightness-125">
                {showConfirmPassword ? t('hidePassword') : t('showPassword')}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {!configChecked ? (
            <div className="rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-slate-200">
              {t('checkingConfiguration')}
            </div>
          ) : configError ? (
            <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {configError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || !!configError}
            className="mt-2 w-full rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? t('creatingAccount') : t('createAccount')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[color:var(--primary-gold)] hover:brightness-125">
            Sign in
          </Link>
        </p>
      </div>

      {isSuccess ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4 py-6 text-center text-white">
          <div className="w-full max-w-xl rounded-[2rem] border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.96)] p-8 shadow-2xl shadow-black/40">
            <p className="text-sm uppercase tracking-[0.35em] text-[color:var(--primary-gold)]">{t('accountCreated')}</p>
            <h2 className="mt-4 text-3xl font-semibold">{t('redirectingDashboard')}</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {t('accountCreatedMessage')}
            </p>
            {profileCreated === false && profileErrorMessage ? (
              <p className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {t('profileNotCreatedWarning')} <span className="font-semibold text-white">{profileErrorMessage}</span>
              </p>
            ) : null}
            <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-full animate-pulse bg-[color:var(--primary-gold)]" />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
