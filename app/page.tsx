'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '../components/theme-toggle';
import { LanguageSelector } from '../components/language-selector';
import { useLanguage } from '../components/language-provider';
import { SUPPORT_EMAIL } from '@/lib/auth';

export default function Home() {
  const { t } = useLanguage();
  

  const countries = [
    'United States',
    'Brazil',
    'United Kingdom',
    'Canada',
    'Germany',
    'France',
    'Nigeria',
    'South Africa',
    'India',
    'United Arab Emirates',
    'Australia',
    'Japan',
    'Singapore',
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,var(--hero-glow),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_20%)] px-6 py-10 sm:px-8 lg:px-12">
      <div className="absolute left-1/2 top-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[rgba(201,169,97,0.12)] blur-3xl" />
      <div className="absolute right-0 top-40 h-[280px] w-[280px] rounded-full bg-[rgba(34,211,238,0.12)] blur-3xl" />
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <header className="relative z-10 flex flex-col gap-4 rounded-[3rem] bg-[color:var(--surface)]/96 px-5 py-6 shadow-[0_28px_90px_rgba(15,23,42,0.15)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-28 w-28 items-center justify-center rounded-[2.5rem] bg-[color:var(--bg-dark-navy)] shadow-[0_34px_90px_rgba(0,0,0,0.2)]">
              <Image src="/image/icon.png" alt="Atlas Capital" width={88} height={88} className="object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[color:var(--primary-gold)]">Atlas Capital</p>
              <p className="text-sm text-[color:var(--text-secondary)]">{t('tradingAccountsWealth')}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <LanguageSelector />
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-elevated)]"
            >
              {t('signIn')}
            </Link>
          </div>
        </header>

        <section className="relative z-10 grid gap-8 rounded-[3rem] bg-[color:var(--surface)]/96 p-8 shadow-[0_36px_90px_rgba(15,23,42,0.14)] lg:grid-cols-[1.4fr_0.95fr] lg:p-10">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[color:var(--primary-gold)]">
                {t('eliteTradingPlatform')}
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-[color:var(--text-primary)] sm:text-6xl">
                {t('heroTitle')}
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[color:var(--text-secondary)]">
                {t('heroSubtitle')}
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary-gold)] px-8 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-95"
              >
                {t('joinNow')}
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-soft)] px-8 py-3 text-sm font-semibold text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-elevated)]"
              >
                {t('explorePlatform')}
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: t('livePortfolioInsights') },
                { label: t('secureAccountControl') },
                { label: t('fastTradeExecution') },
              ].map((feature) => (
                <div key={feature.label} className="rounded-[2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-5 py-4 text-sm text-[color:var(--text-secondary)] shadow-sm">
                  {feature.label}
                </div>
              ))}
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{t('countriesWeServe')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {countries.map((c) => (
                  <span key={c} className="rounded-full bg-[color:var(--surface-elevated)] px-3 py-1 text-xs text-[color:var(--text-secondary)]">{c}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.5rem] border border-[color:var(--border-soft)] bg-[color:var(--bg-dark-navy)]/95 p-8 text-white shadow-[0_36px_90px_rgba(15,23,42,0.18)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[color:var(--primary-gold)] via-transparent to-[color:var(--primary-gold)] opacity-70" />
            <div className="relative space-y-6">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-[color:var(--primary-gold)]">{t('portfolioSnapshot')}</p>
                <p className="mt-4 text-4xl font-semibold">$184,320</p>
                <p className="text-sm text-[color:var(--text-secondary)]">{t('inDailyGrowth')}</p>
              </div>

              <div className="grid gap-4 rounded-[2rem] bg-[rgba(255,255,255,0.04)] p-5">
                {[
                  { label: 'BTC', value: '+8.2%', tone: 'text-emerald-400' },
                  { label: 'ETH', value: '+4.1%', tone: 'text-emerald-400' },
                  { label: 'NASDAQ', value: '-1.3%', tone: 'text-rose-400' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-4">
                    <span className="font-medium text-white">{item.label}</span>
                    <span className={`${item.tone} font-semibold`}>{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-[2rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-5 py-4">
                <p className="text-sm uppercase tracking-[0.35em] text-[color:var(--primary-gold)]">{t('marketPulse')}</p>
                <div className="mt-3 grid gap-3 text-sm text-[color:var(--text-secondary)] sm:grid-cols-2">
                  <div>
                    <p className="font-semibold text-white">{t('smartPortfolio')}</p>
                    <p>{t('realTimeSignals')}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-white">{t('highSpeedTrades')}</p>
                    <p>{t('secureExecution')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="relative z-10 mt-6 rounded-[20px] bg-[color:var(--surface-elevated)]/90 p-6 text-sm text-[color:var(--text-secondary)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{t('contactSupport')}</p>
              <p className="mt-1">{SUPPORT_EMAIL} — {t('supportHours')}</p>
            </div>

            <div className="flex gap-4">
              <Link href="/register" className="rounded-full bg-[color:var(--primary-gold)] px-4 py-2 font-semibold text-[color:var(--bg-dark-navy)]">{t('joinNow')}</Link>
              <Link href="/login" className="rounded-full border border-[color:var(--border-soft)] px-4 py-2">{t('signIn')}</Link>
            </div>
          </div>
        </footer>


        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[3rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/94 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <p className="text-sm uppercase tracking-[0.35em] text-[color:var(--primary-gold)]">{t('trustedByLeadingTraders')}</p>
            <h2 className="mt-4 text-3xl font-semibold text-[color:var(--text-primary)] sm:text-4xl">{t('growWithConfidence')}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--text-secondary)]">
              {t('trustedByCopy')}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                { label: t('secureInfrastructure'), value: '99.99%' },
                { label: t('assetChoice'), value: '120+' },
                { label: t('launchInMinutes'), value: '4 min' },
                { label: t('platformOverview'), value: '+24/7' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[2rem] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-5 py-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">{stat.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-[color:var(--text-primary)]">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[3rem] border border-[color:var(--border-soft)] bg-[color:var(--surface)]/94 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <div className="rounded-[2.5rem] border border-[color:var(--border-soft)] bg-[color:var(--bg-dark-navy)]/95 p-8 text-white shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
              <p className="text-sm uppercase tracking-[0.35em] text-[color:var(--primary-gold)]">Atlas Pulse</p>
              <h3 className="mt-4 text-3xl font-semibold">{t('platformMomentum')}</h3>
              <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">{t('platformMomentumCopy')}</p>

              <div className="mt-8 space-y-4">
                {[
                  { title: t('realTimeSignals'), detail: t('platformSignalsCopy') },
                  { title: t('highSpeedTrades'), detail: t('platformTradesCopy') },
                ].map((item) => (
                  <div key={item.title} className="rounded-[1.75rem] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-5">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 rounded-[3rem] bg-[color:var(--bg-dark-navy)]/95 px-8 py-10 text-white shadow-[0_36px_90px_rgba(15,23,42,0.22)] sm:px-10">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.35em] text-[color:var(--primary-gold)]">{t('platformConfidence')}</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight">{t('readyToStart')}</h2>
              <p className="mt-4 text-base leading-7 text-[rgba(255,255,255,0.75)]">{t('readyToStartCopy')}</p>
            </div>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-[color:var(--primary-gold)] px-8 py-4 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-95"
            >
              {t('joinNow')}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
