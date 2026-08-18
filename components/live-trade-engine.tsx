'use client';

import { useEffect } from 'react';
import { getCurrentAccountId } from '@/lib/auth';
import { addToBalance } from '@/lib/balance';
import {
  addLiveTradeHistoryEntry,
  calculateLiveTradePnl,
  getLiveTradePosition,
  getLiveTradePrice,
  setLiveTradePosition,
  setLiveTradePrice,
  type LiveTradePosition,
} from '@/lib/live-trade';

export function LiveTradeEngine() {
  useEffect(() => {
    let engineInterval: number | null = null;
    let storageHandler: ((event: StorageEvent) => void) | null = null;
    let started = false;

    const startEngineForUser = (userId: string) => {
      if (!userId || started) return;
      started = true;

      const syncPrice = () => {
        const current = getLiveTradePrice();
        const shock = (Math.random() * 0.0016 - 0.0008) + (Math.random() < 0.58 ? -0.0001 : 0.0001);
        const next = Math.max(1000, Number((current * (1 + shock)).toFixed(2)) || current);
        setLiveTradePrice(next);
      };

      const updatePosition = () => {
        const position = getLiveTradePosition(userId);
        if (!position) return;

        const price = getLiveTradePrice();
        const pnl = calculateLiveTradePnl(position, price);

        if (position.closeAt && Date.now() >= position.closeAt) {
          const executionFee = Math.round(position.amount * 0.0125 * 100) / 100;
          const slippage = Math.round(Math.abs(pnl) * Math.random() * 0.08 * 100) / 100;
          const realizedPnl = Math.round((pnl - executionFee - slippage) * 100) / 100;
          addToBalance(realizedPnl, userId);
          addLiveTradeHistoryEntry({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            side: position.side,
            amount: position.amount,
            leverage: position.leverage,
            entryPrice: position.entryPrice,
            exitPrice: price,
            pnl: realizedPnl,
            openedAt: position.openedAt,
            closedAt: Date.now(),
            status: 'Closed',
          }, userId);
          setLiveTradePosition(null, userId);
          return;
        }

        const nextPosition: LiveTradePosition = {
          ...position,
          currentPrice: price,
          pnl,
        };

        setLiveTradePosition(nextPosition, userId);
      };

      engineInterval = window.setInterval(() => {
        syncPrice();
        updatePosition();
      }, 2500) as unknown as number;

      storageHandler = () => {
        const position = getLiveTradePosition(userId);
        if (!position) return;
        const price = getLiveTradePrice();
        const pnl = calculateLiveTradePnl(position, price);
        setLiveTradePosition({ ...position, currentPrice: price, pnl }, userId);
      };

      window.addEventListener('storage', storageHandler);
    };

    // Try to start immediately if a session exists, otherwise poll until a session appears
    const immediateUser = getCurrentAccountId();
    if (immediateUser) {
      (async () => {
        const current = getLiveTradePrice();
        if (!current || current < 10000) {
          try {
            // fetch a market price and set it as the base
            // @ts-ignore
            const fetched = await (await import('@/lib/live-trade')).fetchMarketPrice();
            setLiveTradePrice(fetched);
          } catch {
            // ignore errors and fall back to existing behavior
          }
        }
        startEngineForUser(immediateUser);
      })();
    }

    const poll = window.setInterval(() => {
      const userId = getCurrentAccountId();
      if (userId) {
        startEngineForUser(userId);
        window.clearInterval(poll);
      }
    }, 1000) as unknown as number;

    return () => {
      if (engineInterval) window.clearInterval(engineInterval);
      if (storageHandler) window.removeEventListener('storage', storageHandler);
      window.clearInterval(poll);
    };
  }, []);

  return null;
}
