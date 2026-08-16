'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { loginAccount, setSession } from '@/lib/auth';
import { LanguageSelector } from '@/components/language-selector';
import { useLanguage } from '@/components/language-provider';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();
      if (!response.ok || result?.error) {
        throw new Error(result?.error || 'Invalid email or password.');
      }

      setSession({
        id: result.id,
        email: result.email,
        role: result.role,
        name: result.name,
      });

      if (result.isAdmin) {
        router.replace('/admin');
        return;
      }

      router.replace('/dashboard');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06101f] px-4 py-10 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(218,183,95,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_30%)]">
      <div className="relative w-full max-w-md rounded-[2rem] border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.92)] p-8 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
        <div className="mb-8 text-center">
          <div className="flex justify-end"><LanguageSelector /></div>
          <div className="mx-auto flex h-44 w-44 items-center justify-center">
            <Image src="/image/icon.png" alt="Atlas Capital" width={176} height={176} className="h-44 w-44 object-contain" priority />
          </div>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.35em] text-[color:var(--primary-gold)]">Atlas Capital</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{t('welcomeBack')}</h1>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm text-slate-300">{t('email')}</label>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-[color:var(--primary-gold)]/60 focus:ring-2 focus:ring-[color:var(--primary-gold)]/10"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">{t('password')}</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-[color:var(--primary-gold)]/60 focus:ring-2 focus:ring-[color:var(--primary-gold)]/10"
              placeholder="Enter your password"
              required
            />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="mt-2 text-xs font-semibold text-[color:var(--primary-gold)] hover:brightness-125">
              {showPassword ? t('hidePassword') : t('showPassword')}
            </button>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <button type="submit" disabled={isSubmitting} className="w-full rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70">
            {isSubmitting ? `${t('signIn')}...` : t('signIn')}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
          <Link href="/forgot-password" className="hover:text-[color:var(--primary-gold)]">Forgot password?</Link>
          <Link href="/register" className="font-semibold text-[color:var(--primary-gold)] hover:brightness-125">Create account</Link>
        </div>

      </div>
    </main>
  );
}
