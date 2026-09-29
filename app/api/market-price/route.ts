import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const providers = [
  {
    name: 'Gemini',
    url: 'https://api.gemini.com/v1/pubticker/btcusd',
    readPrice: (payload: any) => Number(payload?.last ?? 0),
  },
  {
    name: 'Coinbase',
    url: 'https://api.exchange.coinbase.com/products/BTC-USD/ticker',
    readPrice: (payload: any) => Number(payload?.price ?? 0),
  },
  {
    name: 'Binance',
    url: 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
    readPrice: (payload: any) => Number(payload?.price ?? 0),
  },
];

export async function GET() {
  const results = await Promise.all(providers.map(async (provider) => {
    try {
      const response = await fetch(provider.url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(1800),
      });
      if (!response.ok) return { name: provider.name, error: `HTTP ${response.status}` };

      const payload = await response.json();
      const price = provider.readPrice(payload);
      if (!Number.isFinite(price) || price <= 0) return { name: provider.name, error: 'Invalid quote' };
      return { name: provider.name, price: Math.round(price * 100) / 100 };
    } catch (error) {
      return {
        name: provider.name,
        error: error instanceof Error ? error.message : 'Network request failed',
      };
    }
  }));

  const successfulQuote = results.find((result): result is { name: string; price: number } => 'price' in result);
  if (successfulQuote) {
    return NextResponse.json(
      { price: successfulQuote.price, provider: successfulQuote.name, updatedAt: Date.now() },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }

  return NextResponse.json({
    error: 'BTC/USD quote providers are unreachable from this server.',
    providers: results,
  }, {
    status: 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}