'use client';

import { useEffect } from 'react';
import { addToBalance } from '@/lib/balance';
import {
  addAutoTradeHistoryEntry,
  getAutoTradePurchase,
  subscribeToAutoTrade,
  type AutoTradeHistoryEntry,
  type AutoTradePurchase,
} from '@/lib/auto-trade';

const assets = ['BTC/USD', 'ETH/USD', 'EUR/USD', 'SOL/USD'];

export function AutoTradeEngine() {
  useEffect(() => {
    let purchase: AutoTradePurchase | null = getAutoTradePurchase();

    const createTrade = () => {
      if (purchase?.status !== 'Running') return;

      const result = Math.round((Math.random() * 6 - 3) * 100) / 100;
      const now = Date.now();
      const entry: AutoTradeHistoryEntry = {
        id: now,
        createdAt: now,
        asset: assets[Math.floor(Math.random() * assets.length)],
        result,
      };

      addAutoTradeHistoryEntry(entry);
      addToBalance(result);
    };

    const unsubscribe = subscribeToAutoTrade((nextPurchase) => {
      purchase = nextPurchase;
    });
    const timer = window.setInterval(createTrade, 8000);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
