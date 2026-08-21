'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/dashboard-shell';

const gateways = [
  { value: 'btc', label: 'Bitcoin (BTC)' },
  { value: 'usdt', label: 'Tether (USDT)' },
  { value: 'solana', label: 'Solana (SOL)' },
  { value: 'ethereum', label: 'Ethereum (ETH)' },
  { value: 'bank', label: 'Bank Transfer' },
];

const gatewayLabels: Record<string, string> = {
  btc: 'Bitcoin',
  usdt: 'USDT',
  solana: 'Solana',
  ethereum: 'Ethereum',
  bank: 'Bank',
};

export default function DepositPage() {
  const router = useRouter();
  const [amount, setAmount] = useState('500');
  const [gateway, setGateway] = useState('btc');
  const [bankCurrency, setBankCurrency] = useState('USD');
  const [isLoading, setIsLoading] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const minimumAmount = gateway === 'bank' ? 100 : 50;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!gateway || !amount || Number(amount) < minimumAmount) {
      setValidationMessage(`The minimum ${gateway === 'bank' ? 'bank transfer' : 'cryptocurrency'} deposit is $${minimumAmount}.00.`);
      return;
    }

    setValidationMessage('');

    setIsLoading(true);
    setTimeout(() => {
      const currencyQuery = gateway === 'bank' ? `&currency=${encodeURIComponent(bankCurrency)}` : '';
      router.push(`/dashboard/deposit/${gateway}?amount=${encodeURIComponent(amount)}${currencyQuery}`);
    }, 1100);
  };

  return (
    <DashboardShell title="Deposit" subtitle="Add funds to your account.">
      <div className="mx-auto max-w-4xl rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[rgba(4,16,33,0.94)] p-6 shadow-lg shadow-black/30">
        <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--primary-gold)]/10 px-5 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--primary-gold)]">Cryptocurrency automatic gateway</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-white)]">Funding methods</h2>
        </div>

        <div className="mt-6 rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)]/70 p-5">
          <p className="text-sm text-slate-300">Choose a funding method and enter the amount.</p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-300">
            <li>Minimum crypto deposit: $50.00.</li>
            <li>Minimum bank deposit: $100.00.</li>
            <li>Payment details are shown after selection.</li>
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Amount ({gateway === 'bank' ? bankCurrency : 'USD'})</label>
            <div className="flex items-center rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3">
              <span className="mr-2 text-[color:var(--primary-gold)]">{gateway === 'bank' && bankCurrency === 'BRL' ? 'R$' : '$'}</span>
              <input
                type="number"
                min={minimumAmount}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full bg-transparent text-sm text-[var(--text-white)] outline-none"
                placeholder={`Minimum ${minimumAmount}.00`}
              />
            </div>
            <p className="mt-2 text-sm text-slate-400">Minimum required for {gateway === 'bank' ? 'bank transfers' : 'cryptocurrency'}: ${minimumAmount}.00</p>
          </div>

          <div>
            {gateway === 'bank' ? (
              <>
                <label className="mb-2 block text-sm text-slate-300">Bank transfer currency</label>
                <select
                  value={bankCurrency}
                  onChange={(event) => setBankCurrency(event.target.value)}
                  className="w-full rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3 text-sm text-[var(--text-white)] outline-none"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="BRL">BRL - Brazilian Real</option>
                </select>
              </>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-300">Payment gateway</label>
            <div className="rounded-2xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)] px-4 py-3">
              <select
                value={gateway}
                onChange={(event) => setGateway(event.target.value)}
                className="w-full appearance-none bg-transparent text-sm text-[var(--text-white)] outline-none"
              >
                {gateways.map((item) => (
                  <option className="bg-[color:var(--bg-dark-navy)] text-[var(--text-white)]" key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || Number(amount) < minimumAmount}
            className="w-full rounded-2xl bg-[color:var(--primary-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--bg-dark-navy)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? `Preparing ${gatewayLabels[gateway] || 'payment'}...` : 'Next'}
          </button>

          {validationMessage ? <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{validationMessage}</p> : null}

          {isLoading ? null : null}
        </form>
      </div>

      {isLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-[color:var(--primary-gold)]/20 bg-[color:var(--bg-dark-navy)]/95 p-6 text-center shadow-[0_20px_80px_rgba(15,23,42,0.35)]">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--primary-gold)]/15 text-[color:var(--primary-gold)]">
              <svg viewBox="0 0 24 24" className="h-7 w-7 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4v4m0 8v4m8-8h-4M4 12H0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-white)]">Preparing gateway</h3>
            <p className="mt-3 text-sm text-slate-300">Your {gatewayLabels[gateway] || 'deposit'} gateway is being prepared. Please hold on while we load the next screen.</p>
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}
