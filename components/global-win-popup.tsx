'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const winners = [
  'Olivia',
  'Ethan',
  'Ava',
  'Noah',
  'Isabella',
  'Liam',
  'Sophia',
  'Mia',
  'Jackson',
  'Lucas',
  'Amelia',
  'Harper',
  'Elijah',
  'Evelyn',
  'Aiden',
];

const locations = [
  'Paris',
  'Dubai',
  'Miami',
  'London',
  'Tokyo',
  'Sydney',
  'Berlin',
  'Toronto',
  'Istanbul',
  'Seoul',
  'São Paulo',
  'Mumbai',
  'Cape Town',
  'Dubai',
  'Madrid',
];

const assets = ['BTC', 'ETH', 'ADA', 'SOL', 'XRP', 'LTC', 'BNB', 'DOGE', 'DOT'];
const actions = ['closed a', 'scored a', 'booked a', 'won a', 'nailed a', 'completed a'];
const resultTypes = ['profit', 'gain', 'win'];
const multipliers = ['3x', '4x', '5x', '8x', '10x', '15x', '20x', '25x', '50x'];

const randomItem = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const buildMessage = () => {
  const winner = randomItem(winners);
  const location = randomItem(locations);
  const asset = randomItem(assets);
  const action = randomItem(actions);
  const multiplier = randomItem(multipliers);
  const amount = Math.floor(Math.random() * 650 + 120);
  const result = randomItem(resultTypes);
  const subject = Math.random() < 0.5 ? `Trader ${winner}` : `A user from ${location}`;

  return `${subject} ${action} ${multiplier} ${asset} trade for +$${amount} ${result}`;
};

export function GlobalWinPopup() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const popupClasses = useMemo(
    () =>
      visible
        ? 'pointer-events-auto opacity-100 translate-y-0'
        : 'pointer-events-none opacity-0 translate-y-6',
    [visible],
  );

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const showPopup = () => {
      setMessage(buildMessage());
      setVisible(true);
      hideTimerRef.current = setTimeout(() => setVisible(false), 4000);
    };

    showTimerRef.current = setTimeout(showPopup, 8000);
    const interval = setInterval(showPopup, 12000);

    return () => {
      clearTimers();
      clearInterval(interval);
    };
  }, [clearTimers]);

  const dismissPopup = () => {
    setVisible(false);
    clearTimers();
    showTimerRef.current = setTimeout(() => {
      setMessage(buildMessage());
      setVisible(true);
      hideTimerRef.current = setTimeout(() => setVisible(false), 4000);
    }, 8000);
  };

  return (
    <div
      className={`fixed bottom-4 left-20 right-4 z-50 w-auto max-w-[calc(100vw-5rem)] rounded-3xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-black/40 transition duration-300 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[320px] sm:max-w-none sm:p-4 ${popupClasses}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 h-11 w-11 rounded-2xl bg-emerald-500/10 text-2xl leading-none text-emerald-300">🎉</div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Live wins</p>
              <p className="text-sm font-semibold text-white">Recent trader payout</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss trader payout popup"
              onClick={dismissPopup}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 transition hover:border-emerald-400/40 hover:text-white"
            >
              Close
            </button>
          </div>
          <p className="text-sm text-slate-300">{message}</p>
        </div>
      </div>
    </div>
  );
}
