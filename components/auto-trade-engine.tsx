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
import {
  getTradingProfile,
  subscribeToTradingProfile,
  syncTradingProfileFromServer,
  calculateTradeResult,
  getDefaultProfile,
  type TradingProfile,
} from '@/lib/trading-profile';

const assets = ['BTC/USD', 'ETH/USD', 'EUR/USD', 'SOL/USD'];

export function AutoTradeEngine() {
  useEffect(() => {
    let purchase: AutoTradePurchase | null = getAutoTradePurchase();
    let profile: TradingProfile | null = getTradingProfile();
    const userId = getCurrentAccountId();

    const createTrade = () => {
      if (purchase?.status !== 'Running') return;

      // Use profile if available, otherwise calculate with default 55/45 loss/profit
      let result: number;
      if (profile) {
        result = calculateTradeResult(profile);
      } else {
        // Fallback: 55% loss, 45% profit with default amounts
        const isWin = Math.random() * 100 < 45;
        result = isWin
          ? Math.round((Math.random() * 10 + 0.1) * 100) / 100
          : Math.round((Math.random() * -50 - 0.1) * 100) / 100;
      }

      const now = Date.now();
      const entry: AutoTradeHistoryEntry = {
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: now,
        asset: assets[Math.floor(Math.random() * assets.length)],
        result,
      };

      addAutoTradeHistoryEntry(entry);
      void adjustBalanceFromServer(result);
    };

    const unsubscribe = subscribeToAutoTrade((nextPurchase) => {
      purchase = nextPurchase;
    });

    const unsubscribeProfile = subscribeToTradingProfile((nextProfile) => {
      profile = nextProfile;
    }, userId);

    const syncTimer = window.setInterval(() => {
      void syncAutoTradeFromServer(userId).then((nextPurchase) => {
        purchase = nextPurchase;
      });
      void syncTradingProfileFromServer(userId).then((nextProfile) => {
        profile = nextProfile;
      });
    }, 15000);

    const timer = window.setInterval(createTrade, 8000);

    return () => {
      unsubscribe();
      unsubscribeProfile();
      window.clearInterval(syncTimer);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
