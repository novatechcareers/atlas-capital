'use client';

import { useEffect } from 'react';
import { adjustBalanceFromServer } from '@/lib/balance';
import { getCurrentAccountId } from '@/lib/auth';
import {
  addAutoTradeHistoryEntry,
  getAutoTradePurchase,
  subscribeToAutoTrade,
  syncAutoTradeFromServer,
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
      void adjustBalanceFromServer(result).then((nextBalance) => {
        if (nextBalance !== null) addAutoTradeHistoryEntry(entry);
      });
    };

    const unsubscribe = subscribeToAutoTrade((nextPurchase) => {
      purchase = nextPurchase;
    });
    const syncTimer = window.setInterval(() => {
      void syncAutoTradeFromServer(getCurrentAccountId()).then((nextPurchase) => {
        purchase = nextPurchase;
      });
    }, 2000);
    const timer = window.setInterval(createTrade, 8000);

    return () => {
      unsubscribe();
      window.clearInterval(syncTimer);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
