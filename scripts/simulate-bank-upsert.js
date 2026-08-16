#!/usr/bin/env node
// Simple simulation script: upsert a bank account and fetch deposit requests
// Usage: start your Next.js dev server (localhost:3000) then run `node scripts/simulate-bank-upsert.js`

const fetch = global.fetch || require('node-fetch');

async function main() {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const userId = process.env.TEST_USER_ID || '00000000-0000-0000-0000-000000000000';
  const currency = process.env.TEST_CURRENCY || 'USD';

  console.log('Simulating bank account upsert for user:', userId, 'currency:', currency);

  try {
    const upsertResp = await fetch(`${base}/api/bank-accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, currency, bankName: 'Test Bank', accountName: 'Test Account', accountNumber: '12345678' }),
    });

    const upsertJson = await upsertResp.json();
    console.log('Upsert response status:', upsertResp.status);
    console.log(JSON.stringify(upsertJson, null, 2));

    console.log('\nFetching deposit requests for the user...');
    const depositsResp = await fetch(`${base}/api/deposit-requests?userId=${encodeURIComponent(userId)}`);
    const depositsJson = await depositsResp.json();
    console.log('Deposit requests status:', depositsResp.status);
    console.log(JSON.stringify(depositsJson, null, 2));
  } catch (err) {
    console.error('Error running simulation:', err);
    process.exitCode = 1;
  }
}

main();
