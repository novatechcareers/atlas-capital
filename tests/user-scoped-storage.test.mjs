import test from 'node:test';
import assert from 'node:assert/strict';

const makeStorage = () => {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
};

const originalWindow = globalThis.window;

const setupStorage = () => {
  globalThis.window = { localStorage: makeStorage(), addEventListener() {}, removeEventListener() {} };
};

const cleanup = () => {
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
};

test('auto-trade purchase is stored per user account', async () => {
  setupStorage();
  try {
    const { saveAutoTradePurchase, getAutoTradePurchase } = await import('../lib/auto-trade.ts');

    saveAutoTradePurchase({
      id: 1,
      planName: 'Starter',
      price: 300,
      status: 'Reviewing',
      createdAt: 100,
      updatedAt: 100,
    }, 'user-1');

    assert.equal(getAutoTradePurchase('user-1')?.planName, 'Starter');
    assert.equal(getAutoTradePurchase('user-2'), null);
  } finally {
    cleanup();
  }
});

test('balance subscriptions only receive the selected user balance', async () => {
  setupStorage();
  const channels = [];
  globalThis.BroadcastChannel = class {
    constructor() {
      this.listeners = [];
      channels.push(this);
    }
    postMessage(message) {
      for (const channel of channels) {
        for (const listener of channel.listeners) listener({ data: message });
      }
    }
    addEventListener(type, listener) {
      if (type === 'message') this.listeners.push(listener);
    }
    removeEventListener() {}
    close() {}
  };

  try {
    const { addToBalance, subscribeToBalance } = await import('../lib/balance.ts');
    const userOneValues = [];
    const userTwoValues = [];
    const stopOne = subscribeToBalance((value) => userOneValues.push(value), 'user-1');
    const stopTwo = subscribeToBalance((value) => userTwoValues.push(value), 'user-2');

    addToBalance(1500, 'user-1');

    assert.equal(userOneValues.at(-1), 1500);
    assert.equal(userTwoValues.at(-1), 0);
    stopOne();
    stopTwo();
  } finally {
    cleanup();
    delete globalThis.BroadcastChannel;
  }
});

test('live trade positions and history are isolated per user account', async () => {
  setupStorage();
  globalThis.BroadcastChannel = class {
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    close() {}
  };
  try {
    const { getLiveTradePosition, setLiveTradePosition, getLiveTradeHistory, addLiveTradeHistoryEntry } = await import('../lib/live-trade.ts');
    setLiveTradePosition({
      side: 'Long',
      entryPrice: 100,
      currentPrice: 100,
      amount: 100,
      leverage: 1,
      openedAt: 1,
      pnl: 0,
    }, 'user-1');

    addLiveTradeHistoryEntry({
      id: 'trade-1',
      side: 'Long',
      amount: 100,
      leverage: 1,
      entryPrice: 100,
      exitPrice: 110,
      pnl: 10,
      openedAt: 1,
      closedAt: 2,
      status: 'Closed',
    }, 'user-1');

    assert.ok(getLiveTradePosition('user-1'));
    assert.equal(getLiveTradePosition('user-2'), null);
    assert.equal(getLiveTradeHistory('user-1').length, 1);
    assert.equal(getLiveTradeHistory('user-2').length, 0);
  } finally {
    cleanup();
    delete globalThis.BroadcastChannel;
  }
});

test('balance and auto-trade helpers can sync from API payloads for a specific user', async () => {
  setupStorage();
  globalThis.fetch = async (url) => {
    const endpoint = String(url);
    if (endpoint.includes('/api/balance')) {
      return {
        ok: true,
        json: async () => ({ balance: 4200 }),
      };
    }
    if (endpoint.includes('/api/auto-trade')) {
      return {
        ok: true,
        json: async () => ({ purchase: { id: 99, planName: 'Pro', price: 500, status: 'Running', createdAt: 10, updatedAt: 10 } }),
      };
    }
    return { ok: false, json: async () => ({}) };
  };

  try {
    const { syncBalanceFromServer, getStoredBalance } = await import('../lib/balance.ts');
    const { syncAutoTradeFromServer, getAutoTradePurchase } = await import('../lib/auto-trade.ts');

    await syncBalanceFromServer('user-42');
    await syncAutoTradeFromServer('user-42');

    assert.equal(getStoredBalance('user-42'), 4200);
    assert.equal(getAutoTradePurchase('user-42')?.planName, 'Pro');
    assert.equal(getAutoTradePurchase('user-99'), null);
  } finally {
    cleanup();
    delete globalThis.fetch;
  }
});
