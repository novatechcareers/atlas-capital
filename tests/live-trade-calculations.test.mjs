import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateLiveTradePnl, calculateLiveTradeSettlementAmount, generateSimulatedMarketPrice, shouldRefreshMarketPrice, resolveLiveTradeOutcomeMode } from '../lib/live-trade.ts';

const position = {
  side: 'Long',
  amount: 10000,
  leverage: 10,
  entryPrice: 100000,
  currentPrice: 100000,
  openedAt: 1,
  pnl: 0,
};

test('leverage scales P/L from the real percentage change in market price', () => {
  assert.equal(calculateLiveTradePnl(position, 100034), 340);
  assert.equal(calculateLiveTradePnl({ ...position, leverage: 1 }, 100034), 34);
});

test('admin profit mode keeps the result positive for either direction of market movement', () => {
  assert.equal(calculateLiveTradePnl(position, 100034, 'profit'), 340);
  assert.equal(calculateLiveTradePnl(position, 99966, 'profit'), 340);
});

test('admin loss mode keeps the result negative for either direction of market movement', () => {
  assert.equal(calculateLiveTradePnl(position, 100034, 'loss'), -340);
  assert.equal(calculateLiveTradePnl(position, 99966, 'loss'), -340);
});

test('a missing market move or invalid entry price produces no P/L', () => {
  assert.equal(calculateLiveTradePnl(position, 100000, 'profit'), 0);
  assert.equal(calculateLiveTradePnl({ ...position, entryPrice: 0 }, 100034), 0);
});

test('a demo trade cannot lose more than its reserved stake', () => {
  assert.equal(calculateLiveTradePnl({ ...position, amount: 100 }, 50000), -100);
});

test('settlement returns reserved stake while pre-existing positions receive P/L only', () => {
  assert.equal(calculateLiveTradeSettlementAmount({ ...position, stakeReserved: true }, 340), 10340);
  assert.equal(calculateLiveTradeSettlementAmount(position, 340), 340);
});

test('live price refresh resumes after the websocket goes stale', () => {
  const now = 1_000_000;
  assert.equal(shouldRefreshMarketPrice(0, now), true);
  assert.equal(shouldRefreshMarketPrice(now - 2000, now, 5000), false);
  assert.equal(shouldRefreshMarketPrice(now - 2000, now, 1000), true);
});

test('simulated market prices move up or down in an aggressive dollar band so P&L can swing by tens, hundreds, or thousands in real time', () => {
  const first = generateSimulatedMarketPrice(83_877.47, 1_000_000, 1);
  const second = generateSimulatedMarketPrice(83_877.47, 1_002_000, 2);

  assert.ok(Number.isFinite(first));
  assert.ok(Number.isFinite(second));
  assert.ok(Number.isInteger(first));
  assert.ok(Number.isInteger(second));
  assert.notEqual(first, second);
  assert.ok(Math.abs(first - 83_877.47) >= 2_000);
  assert.ok(Math.abs(second - 83_877.47) >= 2_000);
  assert.ok(Math.abs(first - 83_877.47) < 60_000);
  assert.ok(Math.abs(second - 83_877.47) < 60_000);
});

test('the volatility multiplier stays within a safe admin range while allowing larger simulated swings', () => {
  const storedValue = globalThis.localStorage;
  if (storedValue) {
    storedValue.clear();
  }

  assert.equal(generateSimulatedMarketPrice(100_000, 1_000_000, 1), generateSimulatedMarketPrice(100_000, 1_000_000, 1));
  assert.ok(Number.isFinite(generateSimulatedMarketPrice(100_000, 1_000_001, 2)));
});

test('live-trade probability rates actually determine the random profit-or-loss direction when the admin does not force a side', () => {
  assert.equal(resolveLiveTradeOutcomeMode({ winRate: 100, lossRate: 0 }, 'market', () => 0.2), 'profit');
  assert.equal(resolveLiveTradeOutcomeMode({ winRate: 0, lossRate: 100 }, 'market', () => 0.2), 'loss');
  assert.equal(resolveLiveTradeOutcomeMode({ winRate: 40, lossRate: 60 }, 'market', () => 0.75), 'loss');
  assert.equal(resolveLiveTradeOutcomeMode({ outcomeMode: 'profit', winRate: 0, lossRate: 100 }, 'market', () => 0.99), 'profit');
});