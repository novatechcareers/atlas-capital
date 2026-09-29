'use client';

import { useEffect } from 'react';
import { getCurrentAccountId } from '@/lib/auth';
import { adjustBalanceFromServer } from '@/lib/balance';
import {
  addLiveTradeHistoryEntry,
  calculateLiveTradePnl,
  claimLiveTradeSettlement,
  fetchMarketPrice,
  getLiveTradePosition,
  getLiveTradePrice,
  releaseLiveTradeSettlement,
  setLiveTradePosition,
  setLiveTradePrice,
  type LiveTradePosition,
} from '@/lib/live-trade';
import {
  getTradingProfile,
  subscribeToTradingProfile,
  syncTradingProfileFromServer,
  type TradingProfile,
} from '@/lib/trading-profile';

export function LiveTradeEngine() {
  useEffect(() => {
    let engineInterval: number | null = null;
    let marketRefreshInterval: number | null = null;
    let storageHandler: ((event: StorageEvent) => void) | null = null;
    let started = false;
    let quoteRequestInFlight = false;
    let profile: TradingProfile | null = getTradingProfile(undefined, 'live');
    const userId = getCurrentAccountId();

    const startEngineForUser = (userId: string) => {
      if (!userId || started) return;
      started = true;
      void syncTradingProfileFromServer(userId, 'live').then((nextProfile) => {
        if (nextProfile) profile = nextProfile;
      });

      const syncMarketPrice = async () => {
        if (quoteRequestInFlight) return;
        quoteRequestInFlight = true;
        try {
          const marketPrice = await fetchMarketPrice();
          if (marketPrice > 0) setLiveTradePrice(marketPrice);
        } finally {
          quoteRequestInFlight = false;
        }
      };

      const updatePosition = () => {
        const position = getLiveTradePosition(userId);
        if (!position) return;

        const price = getLiveTradePrice();
        const pnl = calculateLiveTradePnl(position, price, profile?.outcomeMode ?? 'market');

        if (position.closeAt && Date.now() >= position.closeAt) {
          if (!claimLiveTradeSettlement(position.openedAt, userId)) return;
          const realizedPnl = pnl;
          void adjustBalanceFromServer(realizedPnl, userId).then((nextBalance) => {
            if (nextBalance === null) return;
            const latestPosition = getLiveTradePosition(userId);
            if (!latestPosition || latestPosition.openedAt !== position.openedAt) return;
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
          }).finally(() => releaseLiveTradeSettlement(position.openedAt, userId));
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
      }, 2000) as unknown as number;

      marketRefreshInterval = window.setInterval(() => {
        void syncMarketPrice();
      }, 2000) as unknown as number;

      void syncMarketPrice();

      storageHandler = () => {
        const position = getLiveTradePosition(userId);
        if (!position) return;
        const price = getLiveTradePrice();
        const pnl = calculateLiveTradePnl(position, price, profile?.outcomeMode ?? 'market');
        setLiveTradePosition({ ...position, currentPrice: price, pnl }, userId);
      };

      window.addEventListener('storage', storageHandler);
    };

    // Start the shared market-price feed once a session exists.
    const immediateUser = getCurrentAccountId();
    if (immediateUser) {
      startEngineForUser(immediateUser);
    }

    const unsubscribeProfile = subscribeToTradingProfile((nextProfile) => {
      profile = nextProfile;
    }, userId, 'live');

    const profileSyncTimer = window.setInterval(() => {
      void syncTradingProfileFromServer(userId, 'live').then((nextProfile) => {
        profile = nextProfile;
      });
    }, 15000);

    const poll = window.setInterval(() => {
      const userId = getCurrentAccountId();
      if (userId) {
        startEngineForUser(userId);
        window.clearInterval(poll);
      }
    }, 1000) as unknown as number;

    return () => {
      if (engineInterval) window.clearInterval(engineInterval);
      if (marketRefreshInterval) window.clearInterval(marketRefreshInterval);
      if (storageHandler) window.removeEventListener('storage', storageHandler);
      window.clearInterval(poll);
      window.clearInterval(profileSyncTimer);
      unsubscribeProfile();
    };
  }, []);

  return null;
}
