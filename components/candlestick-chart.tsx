'use client';

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useEffect, useState } from 'react';
import { subscribeToLiveTradePrice } from '@/lib/live-trade';

interface CandleData {
  bucket: number;
  time: string;
  open: number;
  close: number;
  high: number;
  low: number;
}

export function CandlestickChart() {
  const [data, setData] = useState<CandleData[]>([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [feedStatus, setFeedStatus] = useState('Connecting');

  useEffect(() => {
    return subscribeToLiveTradePrice((price, updatedAt, error) => {
      setFeedStatus(error ? 'Delayed' : price > 0 ? 'Live' : 'Connecting');
      if (!Number.isFinite(price) || price <= 0) return;

      setCurrentPrice(price);
      const bucket = Math.floor(updatedAt / 60_000) * 60_000;
      const time = new Date(bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setData((previous) => {
        const last = previous[previous.length - 1];
        if (last?.bucket === bucket) {
          return [
            ...previous.slice(0, -1),
            {
              ...last,
              close: price,
              high: Math.max(last.high, price),
              low: Math.min(last.low, price),
            },
          ];
        }

        return [
          ...previous,
          { bucket, time, open: price, close: price, high: price, low: price },
        ].slice(-24);
      });
    });
  }, []);

  const latest = data[data.length - 1];
  const priceChange = data.length ? latest.close - data[0].close : 0;
  const priceChangePercent = data.length ? (priceChange / data[0].close) * 100 : 0;
  const formattedPrice = currentPrice > 0
    ? `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'Waiting for quote';
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
                {feedStatus}</span>
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
              { label: 'High', value: latest?.high.toFixed(2) ?? '–' },
              { label: 'Low', value: latest?.low.toFixed(2) ?? '–' },
              { label: 'Timeframe', value: '1m' },
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
              <span className="rounded-full border border-[color:var(--primary-gold)] bg-[color:var(--primary-gold)]/10 px-3 py-2 text-xs font-semibold text-[color:var(--text-primary)]">
                1m
              </span>
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

    </div>
  );
}
