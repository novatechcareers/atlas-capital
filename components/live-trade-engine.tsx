'use client';

import { useEffect } from 'react';
import { getCurrentAccountId } from '@/lib/auth';
import { adjustBalanceFromServer } from '@/lib/balance';
import {
  addLiveTradeHistoryEntry,
  calculateLiveTradePnl,
  calculateLiveTradeSettlementAmount,
  claimLiveTradeSettlement,
  fetchMarketPrice,
  getLiveTradePosition,
  getLiveTradePrice,
  releaseLiveTradeSettlement,
  resolveLiveTradeOutcomeMode,
  setLiveTradePosition,
  setLiveTradePrice,
  shouldRefreshMarketPrice,
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
    let marketReconnectTimer: number | null = null;
    let marketSocket: WebSocket | null = null;
    let marketSocketConnected = false;
    let storageHandler: ((event: StorageEvent) => void) | null = null;
    let started = false;
    let quoteRequestInFlight = false;
    let marketLastMessageAt = 0;
    let marketFeedIndex = 0;
    let disposed = false;
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
        if (marketSocketConnected && !shouldRefreshMarketPrice(marketLastMessageAt)) return;
        quoteRequestInFlight = true;
        try {
          const marketPrice = await fetchMarketPrice();
          if (marketPrice > 0) {
            setLiveTradePrice(marketPrice);
            marketLastMessageAt = Date.now();
          }
        } finally {
          quoteRequestInFlight = false;
        }
      };

      const scheduleMarketReconnect = () => {
        if (disposed || marketReconnectTimer !== null) return;
        marketReconnectTimer = window.setTimeout(() => {
          marketReconnectTimer = null;
          connectMarketSocket();
        }, 3000) as unknown as number;
      };

      const connectMarketSocket = () => {
        if (disposed) return;

        const feeds = [
          { name: 'Binance', url: 'wss://stream.binance.com:443/ws/btcusdt@trade' },
          { name: 'Coinbase', url: 'wss://ws-feed.exchange.coinbase.com' },
        ];
        const feed = feeds[marketFeedIndex];
        let socket: WebSocket;
        try {
          socket = new WebSocket(feed.url);
        } catch {
          marketFeedIndex = (marketFeedIndex + 1) % feeds.length;
          scheduleMarketReconnect();
          return;
        }

        marketSocket = socket;
        marketSocketConnected = false;
        socket.onopen = () => {
          if (marketSocket !== socket) return;
          marketSocketConnected = true;
          if (feed.name === 'Coinbase') {
            socket.send(JSON.stringify({
              type: 'subscribe',
              product_ids: ['BTC-USD'],
              channels: ['ticker'],
            }));
          }
        };
        socket.onmessage = (event) => {
          if (marketSocket !== socket) return;
          try {
            const payload = JSON.parse(String(event.data));
            const price = Number(feed.name === 'Binance' ? payload?.p : payload?.price);
            if (Number.isFinite(price) && price > 0) {
              marketSocketConnected = true;
              marketLastMessageAt = Date.now();
              setLiveTradePrice(price);
            }
          } catch {
            // Ignore malformed market messages and keep the stream open.
          }
        };
        socket.onerror = () => {
          marketSocketConnected = false;
          socket.close();
        };
        socket.onclose = () => {
          if (marketSocket !== socket) return;
          marketSocketConnected = false;
          marketSocket = null;
          marketFeedIndex = (marketFeedIndex + 1) % feeds.length;
          scheduleMarketReconnect();
        };
      };

      const updatePosition = () => {
        const position = getLiveTradePosition(userId);
        if (!position) return;

        const price = getLiveTradePrice();
        const effectiveOutcomeMode = position.resultMode ?? (profile?.outcomeMode && profile.outcomeMode !== 'market' ? profile.outcomeMode : 'market');
        const pnl = calculateLiveTradePnl(position, price, effectiveOutcomeMode);

        if (position.closeAt && Date.now() >= position.closeAt) {
          if (!claimLiveTradeSettlement(position.openedAt, userId)) return;
          const realizedPnl = pnl;
          void adjustBalanceFromServer(calculateLiveTradeSettlementAmount(position, realizedPnl), userId).then((nextBalance) => {
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
          resultMode: position.resultMode ?? effectiveOutcomeMode,
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
      connectMarketSocket();

      storageHandler = () => {
        const position = getLiveTradePosition(userId);
        if (!position) return;
        const price = getLiveTradePrice();
        const effectiveOutcomeMode = position.resultMode ?? (profile?.outcomeMode && profile.outcomeMode !== 'market' ? profile.outcomeMode : 'market');
        const pnl = calculateLiveTradePnl(position, price, effectiveOutcomeMode);
        setLiveTradePosition({ ...position, currentPrice: price, pnl, resultMode: position.resultMode ?? effectiveOutcomeMode }, userId);
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
      disposed = true;
      if (engineInterval) window.clearInterval(engineInterval);
      if (marketRefreshInterval) window.clearInterval(marketRefreshInterval);
      if (marketReconnectTimer !== null) window.clearTimeout(marketReconnectTimer);
      marketSocket?.close();
      if (storageHandler) window.removeEventListener('storage', storageHandler);
      window.clearInterval(poll);
      window.clearInterval(profileSyncTimer);
      unsubscribeProfile();
    };
  }, []);

  return null;
}
