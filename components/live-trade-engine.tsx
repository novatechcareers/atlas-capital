'use client';

import { useEffect } from 'react';
import { getCurrentAccountId } from '@/lib/auth';
import { adjustBalanceFromServer } from '@/lib/balance';
import {
  addLiveTradeHistoryEntry,
  calculateLiveTradePnl,
  fetchMarketPrice,
  getLiveTradePosition,
  getLiveTradePrice,
  setLiveTradePosition,
  setLiveTradePrice,
  type LiveTradePosition,
} from '@/lib/live-trade';

export function LiveTradeEngine() {
  useEffect(() => {
    let engineInterval: number | null = null;
    let marketPriceInterval: number | null = null;
    let storageHandler: ((event: StorageEvent) => void) | null = null;
    let started = false;

    const startEngineForUser = (userId: string) => {
      if (!userId || started) return;
      started = true;

      const syncMarketPrice = async () => {
        const marketPrice = await fetchMarketPrice();
        if (marketPrice > 0) setLiveTradePrice(marketPrice);
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
          void adjustBalanceFromServer(realizedPnl, userId).then((nextBalance) => {
            if (nextBalance === null) return;
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
          });
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
        updatePosition();
      }, 2500) as unknown as number;

      marketPriceInterval = window.setInterval(() => {
        void syncMarketPrice();
      }, 15_000) as unknown as number;

      void syncMarketPrice();

      storageHandler = () => {
        const position = getLiveTradePosition(userId);
        if (!position) return;
        const price = getLiveTradePrice();
        const pnl = calculateLiveTradePnl(position, price);
        setLiveTradePosition({ ...position, currentPrice: price, pnl }, userId);
      };

      window.addEventListener('storage', storageHandler);
    };

    // Start the shared market-price feed once a session exists.
    const immediateUser = getCurrentAccountId();
    if (immediateUser) {
      startEngineForUser(immediateUser);
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
      if (marketPriceInterval) window.clearInterval(marketPriceInterval);
      if (storageHandler) window.removeEventListener('storage', storageHandler);
      window.clearInterval(poll);
    };
  }, []);

  return null;
}
