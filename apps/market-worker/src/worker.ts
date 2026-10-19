import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { ProviderManager } from '@globaltrade/market-data';
import { CandleInterval, MarketQuote } from '@globaltrade/shared';
import dotenv from 'dotenv';

dotenv.config();

const port = Number(process.env.MARKET_WORKER_PORT || 4001);
const provider = new ProviderManager();
const server = Fastify({ logger: true });

// Popular default tracked symbols
export const UNIVERSE = [
  'AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'GOOGL',
  'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS',
  '^GSPC', '^IXIC', '^NSEI', '^BSESN',
  'BTC-USD', 'ETH-USD', 'SOL-USD'
];

// Active websocket subscriber connections keyed by symbol
const subscriptions: Map<string, Set<any>> = new Map();

async function bootstrap() {
  await server.register(cors, { origin: '*' });
  await server.register(websocket);

  // Health endpoint
  server.get('/health', async () => ({
    status: 'ok',
    service: 'market-worker',
    timestamp: Date.now()
  }));

  // Single Quote
  server.get<{ Params: { symbol: string } }>('/quotes/:symbol', async (req, reply) => {
    try {
      const quote = await provider.getQuote(req.params.symbol);
      return quote;
    } catch (err: any) {
      return reply.status(502).send({ error: err.message });
    }
  });

  // Batch Quotes for multiple symbols
  server.get<{ Querystring: { symbols?: string } }>('/quotes', async (req, reply) => {
    const raw = req.query.symbols || UNIVERSE.join(',');
    const symbols = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

    const quotes: Record<string, MarketQuote> = {};
    const promises = symbols.map(async sym => {
      try {
        quotes[sym] = await provider.getQuote(sym);
      } catch (err: any) {
        server.log.warn(`Failed to fetch quote for ${sym}: ${err.message}`);
      }
    });

    await Promise.all(promises);
    return quotes;
  });

  // Historical Candles
  server.get<{ Params: { symbol: string }, Querystring: { interval?: string, days?: string } }>(
    '/candles/:symbol',
    async (req, reply) => {
      try {
        const interval = (req.query.interval || '1d') as CandleInterval;
        const days = Number(req.query.days || 30);
        const candles = await provider.getHistoricalCandles(req.params.symbol, interval, days);
        return candles;
      } catch (err: any) {
        return reply.status(502).send({ error: err.message });
      }
    }
  );

  // FX Rate
  server.get<{ Querystring: { base: string, quote: string } }>('/forex/rate', async (req, reply) => {
    try {
      const base = req.query.base || 'USD';
      const quote = req.query.quote || 'INR';
      return await provider.getCurrencyRate(base, quote);
    } catch (err: any) {
      return reply.status(502).send({ error: err.message });
    }
  });

  // FX Historical Rates
  server.get<{ Querystring: { base: string, quote: string, days?: string } }>('/forex/history', async (req, reply) => {
    try {
      const base = req.query.base || 'USD';
      const quote = req.query.quote || 'INR';
      const days = Number(req.query.days || 30);
      return await provider.getHistoricalFxRates(base, quote, days);
    } catch (err: any) {
      return reply.status(502).send({ error: err.message });
    }
  });

  // WebSocket for Live Ticker Streaming
  server.register(async function (fastify) {
    fastify.get('/ws/quotes', { websocket: true }, (connection, req) => {
      const subscribedSymbols: Set<string> = new Set();

      connection.on('message', (message: any) => {
        try {
          const payload = JSON.parse(message.toString());
          if (payload.action === 'SUBSCRIBE' && Array.isArray(payload.symbols)) {
            payload.symbols.forEach((s: string) => {
              const sym = s.toUpperCase();
              subscribedSymbols.add(sym);
              if (!subscriptions.has(sym)) {
                subscriptions.set(sym, new Set());
              }
              subscriptions.get(sym)!.add(connection);

              // Immediately respond with latest cached or fetched quote
              provider.getQuote(sym).then(q => {
                connection.send(JSON.stringify({ type: 'QUOTE_UPDATE', quote: q }));
              }).catch(() => {});
            });
          } else if (payload.action === 'UNSUBSCRIBE' && Array.isArray(payload.symbols)) {
            payload.symbols.forEach((s: string) => {
              const sym = s.toUpperCase();
              subscribedSymbols.delete(sym);
              subscriptions.get(sym)?.delete(connection);
            });
          }
        } catch {
          // Ignore malformed WS frames
        }
      });

      connection.on('close', () => {
        subscribedSymbols.forEach(sym => {
          subscriptions.get(sym)?.delete(connection);
        });
      });
    });
  });

  // Background broadcast loop: every 4 seconds, poll actively subscribed symbols and broadcast
  setInterval(async () => {
    const activeSymbols = Array.from(subscriptions.keys()).filter(sym => {
      const clients = subscriptions.get(sym);
      return clients && clients.size > 0;
    });

    if (activeSymbols.length === 0) return;

    for (const sym of activeSymbols) {
      try {
        const quote = await provider.getQuote(sym);
        const clients = subscriptions.get(sym);
        if (clients && clients.size > 0) {
          const payload = JSON.stringify({ type: 'QUOTE_UPDATE', quote });
          for (const client of clients) {
            try {
              client.send(payload);
            } catch {
              clients.delete(client);
            }
          }
        }
      } catch (err: any) {
        server.log.debug(`Broadcast loop error for ${sym}: ${err.message}`);
      }
    }
  }, 4000);

  await server.listen({ port, host: '0.0.0.0' });
  console.log(`🚀 Market Data Worker running on port ${port}`);
}

bootstrap().catch(err => {
  console.error('Failed to start Market Worker:', err);
  process.exit(1);
});
