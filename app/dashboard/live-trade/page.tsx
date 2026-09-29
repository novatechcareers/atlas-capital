'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardShell } from '@/components/dashboard-shell';
import { getCurrentAccountId } from '@/lib/auth';
import { getTradingProfile, subscribeToTradingProfile, syncTradingProfileFromServer } from '@/lib/trading-profile';
import {
  adjustBalanceFromServer,
  formatCurrency,
  subscribeToBalance,
  syncBalanceFromServer,
} from '@/lib/balance';
import {
  addLiveTradeHistoryEntry,
  calculateLiveTradePnl,
  claimLiveTradeSettlement,
  getLiveTradePosition,
  getLiveTradePrice,
  releaseLiveTradeSettlement,
  setLiveTradePosition,
  setLiveTradePrice,
  subscribeToLiveTradeHistory,
  subscribeToLiveTradePosition,
  subscribeToLiveTradePrice,
  type LiveTradeHistoryEntry,
  type LiveTradePosition,
} from '@/lib/live-trade';

type TradeSide = 'Long' | 'Short';

type TradePosition = LiveTradePosition;

const closeDurationOptions = [
  { value: 30_000, label: '30 seconds' },
  { value: 60_000, label: '1 minute' },
  { value: 300_000, label: '5 minutes' },
  { value: 900_000, label: '15 minutes' },
];
const CLOSE_DURATION_STORAGE_KEY = 'atlas-live-trade-close-duration';

export default function LiveTradePage() {
  const [balance, setBalance] = useState(0);
  const [price, setPrice] = useState(0);
  const [priceUpdatedAt, setPriceUpdatedAt] = useState(0);
  const [tradeAmount, setTradeAmount] = useState('100');
  const [leverage, setLeverage] = useState(1);
  const [closeDuration, setCloseDuration] = useState(60_000);
  const [side, setSide] = useState<TradeSide>('Long');
  const [position, setPosition] = useState<TradePosition | null>(null);
  const [history, setHistory] = useState<LiveTradeHistoryEntry[]>([]);
  const [message, setMessage] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [outcomeMode, setOutcomeMode] = useState<'market' | 'profit' | 'loss'>('market');

  useEffect(() => {
    const storedDuration = window.localStorage.getItem(CLOSE_DURATION_STORAGE_KEY);
    const parsedDuration = Number(storedDuration);
    if (closeDurationOptions.some((option) => option.value === parsedDuration)) {
      window.setTimeout(() => setCloseDuration(parsedDuration), 0);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToBalance(setBalance);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribePrice = subscribeToLiveTradePrice((nextPrice, updatedAt) => {
      setPrice(nextPrice);
      setPriceUpdatedAt(updatedAt);
    });
    return unsubscribePrice;
  }, []);

  useEffect(() => {
    const userId = getCurrentAccountId();
    const unsubscribePosition = subscribeToLiveTradePosition(setPosition, userId);

    const unsubscribeHistory = subscribeToLiveTradeHistory(setHistory, userId);
    const cachedProfile = getTradingProfile(userId, 'live');
    if (cachedProfile?.outcomeMode) setOutcomeMode(cachedProfile.outcomeMode);
    void syncTradingProfileFromServer(userId, 'live').then((profile) => {
      if (profile?.outcomeMode) setOutcomeMode(profile.outcomeMode);
    });
    const unsubscribeProfile = subscribeToTradingProfile((profile) => {
      setOutcomeMode(profile?.outcomeMode ?? 'market');
    }, userId, 'live');
    return () => {
      unsubscribePosition();
      unsubscribeHistory();
      unsubscribeProfile();
    };
  }, []);

  const numericAmount = Number(tradeAmount.replace(/[^0-9.]/g, '')) || 0;
  const belowMinimum = numericAmount < 100;
  const amountExceedsBalance = numericAmount > balance;
  const canOpen = numericAmount >= 100 && !amountExceedsBalance && !position && price > 0;

  const unrealizedPnl = useMemo(() => {
    if (!position) return 0;
    return calculateLiveTradePnl(position, price, outcomeMode);
  }, [position, price, outcomeMode]);

  const isHighRisk = leverage >= 10;

  const openPosition = () => {
    const userId = getCurrentAccountId();
    if (!userId) return;
    if (price <= 0) {
      setMessage('Waiting for a valid live BTC/USD price. Please try again shortly.');
      return;
    }
    if (belowMinimum) {
      setMessage('Minimum trade amount is $100. Please increase the trade amount to continue.');
      return;
    }

    if (amountExceedsBalance) {
      setMessage('Insufficient balance. Please top up your account before opening this position.');
      return;
    }

    if (!canOpen) {
      setMessage('Enter a valid amount to open a trade.');
      return;
    }

    // Do not deduct balance client-side for opening a position; server is authoritative.
    void syncBalanceFromServer(userId);
    setLiveTradePrice(price);
    const nextPosition = {
      side,
      amount: numericAmount,
      leverage,
      entryPrice: price,
      currentPrice: price,
      openedAt: Date.now(),
      closeAt: Date.now() + closeDuration,
      pnl: 0,
    };
    setLiveTradePosition(nextPosition, userId);
    setPosition(nextPosition);
    setMessage(`Opened ${side} position at ${formatCurrency(price)} with ${formatCurrency(numericAmount)} and ${leverage}x leverage.`);
  };

  const closePosition = async () => {
    const userId = getCurrentAccountId();
    if (!userId || !position || isClosing) return;
    const positionToClose = position;
    if (!claimLiveTradeSettlement(positionToClose.openedAt, userId)) {
      setMessage('This trade is already being settled. Please wait a moment.');
      return;
    }

    setIsClosing(true);
    try {
      const latestProfile = await syncTradingProfileFromServer(userId, 'live');
      const activePosition = getLiveTradePosition(userId);
      if (!activePosition || activePosition.openedAt !== positionToClose.openedAt) return;

      const settlementPrice = getLiveTradePrice();
      const liveProfile = latestProfile ?? getTradingProfile(userId, 'live');
      const profit = calculateLiveTradePnl(activePosition, settlementPrice, liveProfile?.outcomeMode ?? outcomeMode);
      const nextBalance = await adjustBalanceFromServer(profit, userId);
      if (nextBalance === null) {
        setMessage('Unable to settle this trade with the account balance service. The position remains open; please try again.');
        return;
      }

      const entry: LiveTradeHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        side: activePosition.side,
        amount: activePosition.amount,
        leverage: activePosition.leverage,
        entryPrice: activePosition.entryPrice,
        exitPrice: settlementPrice,
        pnl: profit,
        openedAt: activePosition.openedAt,
        closedAt: Date.now(),
        status: 'Closed',
      };

      addLiveTradeHistoryEntry(entry, userId);
      setLiveTradePosition(null, userId);
      setPosition(null);
      setMessage(`Closed position and realized a ${profit >= 0 ? 'profit' : 'loss'} of ${formatCurrency(profit)}. The balance and trade history use this same amount.`);
    } catch {
      setMessage('Unable to close this trade. The position remains open; please try again.');
    } finally {
      releaseLiveTradeSettlement(positionToClose.openedAt, userId);
      setIsClosing(false);
    }
  };

  return (
    <DashboardShell title="Live Trade" subtitle="Monitor market activity and trade with your account balance using live market pricing.">
      <div className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Live market status</p>
              <p className="mt-2 text-3xl font-semibold text-white">BTC / USD</p>
              <p className="mt-1 text-sm text-slate-400">Current live price</p>
            </div>
            <div className="space-y-2 rounded-3xl border border-slate-700/70 bg-slate-800/70 p-4 text-right">
              <p className="text-sm text-slate-400">Available balance</p>
              <p className="text-2xl font-semibold text-white">{formatCurrency(balance)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-10">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-0 shadow-2xl shadow-black/20">
            <div className="h-[650px] w-full overflow-hidden rounded-3xl bg-black">
              <iframe
                id="tradingview_0f1e7"
                src="https://s.tradingview.com/widgetembed/?frameElementId=tradingview_0f1e7&symbol=COINBASE%3ABTCUSD&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%5D&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&showpopupbutton=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&showpopupbutton=1&locale=en&utm_source=app.expertspromarketing.com&utm_medium=widget&utm_campaign=chart&utm_term=COINBASE%3ABTCUSD"
                style={{ width: '100%', height: '100%', margin: 0, padding: 0, border: 0 }}
                frameBorder="0"
                scrolling="no"
                allowFullScreen
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Trade dashboard</p>
            <div className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-700/70 bg-slate-800/70 p-4">
                  <p className="text-sm text-slate-400">Current price</p>
                  <p className="mt-2 text-3xl font-semibold text-white">{price > 0 ? formatCurrency(price) : 'Waiting for live price…'}</p>
                  <p className="mt-1 text-xs text-slate-500">{priceUpdatedAt ? `Updated ${new Date(priceUpdatedAt).toLocaleTimeString()}` : 'Connecting to BTC/USD feed'}</p>
                </div>
                <div className="rounded-3xl border border-slate-700/70 bg-slate-800/70 p-4">
                  <p className="text-sm text-slate-400">Open position</p>
                  {position ? (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-300">{position.side} {formatCurrency(position.amount)}</p>
                      <p className="text-sm text-slate-400">Entry {formatCurrency(position.entryPrice)}</p>
                      <p className={`text-lg font-semibold ${unrealizedPnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {formatCurrency(unrealizedPnl)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No active trade</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm text-slate-400">Trade amount</label>
                  <input
                    type="text"
                    value={tradeAmount}
                    onChange={(event) => setTradeAmount(event.target.value)}
                    className="w-full rounded-2xl border border-slate-700/70 bg-slate-800/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    placeholder="USD amount"
                    min={100}
                  />
                </div>
                <div className="grid gap-2">
                    <label className="text-sm text-slate-400">Leverage</label>
                    <select
                      value={leverage}
                      onChange={(event) => setLeverage(Number(event.target.value))}
                      className="w-full rounded-2xl border border-slate-700/70 bg-slate-800/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400"
                    >
                      {[1, 2, 3, 5, 10].map((value) => (
                        <option key={value} value={value} className="bg-slate-900 text-white">
                          {value}x
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">Higher leverage increases potential profit and loss.</p>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-slate-400">Auto-close trade after</label>
                    <select
                      value={closeDuration}
                      onChange={(event) => {
                        const nextDuration = Number(event.target.value);
                        setCloseDuration(nextDuration);
                        window.localStorage.setItem(CLOSE_DURATION_STORAGE_KEY, String(nextDuration));
                      }}
                      disabled={Boolean(position)}
                      className="w-full rounded-2xl border border-slate-700/70 bg-slate-800/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {closeDurationOptions.map((option) => (
                        <option key={option.value} value={option.value} className="bg-slate-900 text-white">
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">The timer stays active if you leave this page.</p>
                  </div>
                  <div className="grid gap-2">
                    <p className="text-sm text-slate-400">Side</p>
                    <div className="flex gap-3">
                      {(['Long', 'Short'] as TradeSide[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${side === option ? 'bg-cyan-500 text-slate-900' : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700'}`}
                          onClick={() => position ? undefined : setSide(option)}
                          disabled={Boolean(position)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  {isHighRisk ? (
                    <div className="rounded-2xl border border-rose-500 bg-rose-600/10 p-4 text-sm text-rose-100">
                      <p className="font-semibold">High risk — proceed with caution</p>
                      <p className="mt-1">Using <span className="font-medium">{leverage}x</span> leverage multiplies the effect of the actual market price movement. Only trade with funds you can afford to lose.</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-500 bg-amber-500/10 p-4 text-sm text-amber-100">
                      <p className="font-semibold">Trading risk notice</p>
                      <p className="mt-1">Trading involves risk. Do not trade with funds you cannot afford to lose.</p>
                    </div>
                  )}
                </div>

                {!position ? (
                  <button
                    type="button"
                    disabled={!canOpen}
                    onClick={openPosition}
                    className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${canOpen ? 'bg-cyan-500 text-slate-900 hover:opacity-90' : 'cursor-not-allowed bg-slate-700 text-slate-400'}`}
                  >
                    Open {side} position
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closePosition}
                    disabled={isClosing}
                    className="w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isClosing ? 'Settling position…' : 'Close position'}
                  </button>
                )}
              </div>

              <div className="rounded-3xl border border-slate-700/70 bg-slate-800/70 p-4 text-sm text-slate-300">
                <p className="text-slate-400">Selected outcome</p>
                <p className="mt-2 text-sm text-slate-300">
                  {outcomeMode === 'profit' ? 'Profit is selected by the administrator.' : outcomeMode === 'loss' ? 'Loss is selected by the administrator.' : 'Result follows the actual BTC/USD price movement.'} Result = amount × leverage × percentage move × 10; the displayed price is not artificially moved.
                </p>
              </div>

              {message && (
                <div className="rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-100">
                  {message}
                </div>
              )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-0 shadow-2xl shadow-black/20">
            <div className="h-[420px] w-full overflow-hidden rounded-3xl bg-black">
              <iframe
                src="https://www.tradingview-widget.com/embed-widget/forex-cross-rates/?locale=en#%7B%22width%22%3A%22100%25%22%2C%22height%22%3A400%2C%22currencies%22%3A%5B%22BTC%22%2C%22EUR%22%2C%22USD%22%2C%22JPY%22%2C%22GBP%22%2C%22CHF%22%2C%22AUD%22%2C%22CAD%22%2C%22NZD%22%2C%22CNY%22%2C%22TRY%22%2C%22SEK%22%2C%22NOK%22%5D%2C%22colorTheme%22%3A%22dark%22%2C%22utm_source%22%3A%22app.expertspromarketing.com%22%2C%22utm_medium%22%3A%22widget%22%2C%22utm_campaign%22%3A%22forex-cross-rates%22%2C%22page-uri%22%3A%22app.expertspromarketing.com%2Flive-trade%22%7D"
                title="forex cross-rates TradingView widget"
                lang="en"
                style={{ userSelect: 'none', boxSizing: 'border-box', display: 'block', height: '100%', width: '100%' }}
                frameBorder="0"
                scrolling="no"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Trade history</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Recent live trades</h3>
              </div>
              <span className="rounded-full border border-slate-700/70 bg-slate-800/70 px-3 py-1 text-xs text-slate-300">{history.length} entries</span>
            </div>

            <div className="mt-5 space-y-3">
              {history.length ? (
                history.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-slate-700/70 bg-slate-800/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{entry.side} trade</p>
                        <p className="mt-1 text-xs text-slate-400">{new Date(entry.closedAt).toLocaleString()}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.pnl >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                        {entry.pnl >= 0 ? '+' : ''}{formatCurrency(entry.pnl)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
                      <div>
                        <span className="block text-slate-500">Amount</span>
                        <span>{formatCurrency(entry.amount)}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500">Leverage</span>
                        <span>{entry.leverage}x</span>
                      </div>
                      <div>
                        <span className="block text-slate-500">Entry / Exit</span>
                        <span>{formatCurrency(entry.entryPrice)} / {formatCurrency(entry.exitPrice)}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/50 p-6 text-sm text-slate-400">
                  No live trade history yet. Your completed trades will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
