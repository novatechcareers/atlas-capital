import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateLiveTradePnl } from '../lib/live-trade.ts';

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