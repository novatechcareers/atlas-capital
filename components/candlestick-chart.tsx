'use client';

import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useEffect, useState } from 'react';

interface CandleData {
  time: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export function CandlestickChart() {
  const [data, setData] = useState<CandleData[]>([]);

  useEffect(() => {
    const initialData = Array.from({ length: 24 }, (_, i) => {
      const base = 63000 + i * 50;
      const open = base + Math.random() * 400 - 200;
      const close = base + Math.random() * 400 - 200;
      const high = Math.max(open, close) + Math.random() * 200;
      const low = Math.min(open, close) - Math.random() * 200;
      const volume = Math.floor(Math.random() * 5000) + 1000;

      return {
        time: `${String(i).padStart(2, '0')}:00`,
        open: Number(open.toFixed(2)),
        close: Number(close.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        volume,
      };
    });

    setData(initialData);

    const interval = setInterval(() => {
      setData((prev) => {
        const last = prev[prev.length - 1];
        const newOpen = last.close + (Math.random() - 0.5) * 200;
        const newClose = newOpen + (Math.random() - 0.5) * 300;
        const newHigh = Math.max(newOpen, newClose) + Math.random() * 200;
        const newLow = Math.min(newOpen, newClose) - Math.random() * 200;
        const newVolume = Math.floor(Math.random() * 5000) + 1000;

        const newCandle: CandleData = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          open: Number(newOpen.toFixed(2)),
          close: Number(newClose.toFixed(2)),
          high: Number(newHigh.toFixed(2)),
          low: Number(newLow.toFixed(2)),
          volume: newVolume,
        };

        return [...prev.slice(1), newCandle];
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const latest = data[data.length - 1];
  const priceChange = data.length ? latest.close - data[0].close : 0;
  const priceChangePercent = data.length ? (priceChange / data[0].close) * 100 : 0;
  const formattedPrice = data.length ? `$${latest.close.toFixed(2)}` : '$0.00';
  const formattedChange = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}`;

  return (
    <div className="space-y-4">
      <div className="rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-6 shadow-[0_32px_80px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex rounded-full bg-[color:var(--primary-gold)]/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.4em] text-[color:var(--primary-gold)]">
                BTC/USD
              </span>
              <span className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-1 text-xs text-[color:var(--text-secondary)]">
                Live</span>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-6">
              <div>
                <p className="text-sm text-[color:var(--text-secondary)]">Current price</p>
                <p className="text-4xl font-semibold text-[color:var(--text-primary)]">{formattedPrice}</p>
              </div>
              <div>
                <p className="text-sm text-[color:var(--text-secondary)]">Change</p>
                <p className={`text-2xl font-semibold ${priceChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {formattedChange} ({priceChangePercent.toFixed(2)}%)
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'High', value: latest?.high ?? '–' },
              { label: 'Low', value: latest?.low ?? '–' },
              { label: 'Volume', value: latest ? latest.volume.toLocaleString() : '–' },
              { label: 'Timeframe', value: '1D' },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-4 py-3 text-sm">
                <p className="text-[color:var(--text-secondary)]">{item.label}</p>
                <p className="mt-2 font-semibold text-[color:var(--text-primary)]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4 shadow-[inset_0_0_0_1px_rgba(218,183,95,0.06)]">
            <div className="flex flex-wrap items-center gap-2">
              {['1m', '15m', '1h', '1D'].map((item) => (
                <button key={item} className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface)] px-3 py-2 text-xs font-semibold text-[color:var(--text-secondary)] transition hover:border-[color:var(--primary-gold)] hover:text-[color:var(--text-primary)]">
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4 shadow-[inset_0_0_0_1px_rgba(218,183,95,0.06)]">
            <p className="text-xs text-[color:var(--text-secondary)]">Market sentiment</p>
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--text-primary)]">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Bullish
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[28px] overflow-hidden border border-[color:var(--border-soft)]">
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" vertical={false} />
              <XAxis dataKey="time" stroke="rgba(148,163,184,0.4)" tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: 'rgba(71,85,105,0.9)' }} />
              <YAxis stroke="rgba(148,163,184,0.4)" tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: 'rgba(71,85,105,0.9)' }} domain={[dataMin => dataMin - 400, dataMax => dataMax + 400]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(218, 183, 95, 0.24)',
                  borderRadius: '10px',
                  padding: '10px',
                }}
                labelStyle={{ color: '#f8fafc', fontSize: '13px' }}
                formatter={(value) => `$${Number(value).toFixed(2)}`}
              />
              <Line
                type="monotone"
                dataKey="close"
                stroke="#DAB75F"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Open', value: latest?.open ?? '–' },
            { label: 'High', value: latest?.high ?? '–' },
            { label: 'Low', value: latest?.low ?? '–' },
          ].map((item) => (
            <div key={item.label} className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4 text-sm">
              <p className="text-[color:var(--text-secondary)]">{item.label}</p>
              <p className="mt-2 font-semibold text-[color:var(--text-primary)]">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[32px] border border-[color:var(--border-soft)] bg-[color:var(--surface)] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--primary-gold)] mb-4">Volume</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.1)" vertical={false} />
            <XAxis dataKey="time" stroke="rgba(148,163,184,0.4)" tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: 'rgba(71,85,105,0.9)' }} />
            <YAxis stroke="rgba(148,163,184,0.4)" tickLine={false} axisLine={false} style={{ fontSize: '11px', fill: 'rgba(71,85,105,0.9)' }} />
            <Bar dataKey="volume" fill="rgba(218, 183, 95, 0.45)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
