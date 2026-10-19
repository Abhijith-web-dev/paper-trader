import { FastifyPluginAsync } from 'fastify';
import { ProviderManager } from '@globaltrade/market-data';
import { CandleInterval, Instrument } from '@globaltrade/shared';

const provider = new ProviderManager();

export const INSTRUMENTS: Instrument[] = [
  // US Equities
  { id: 'inst_aapl', symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', country: 'US', assetClass: 'EQUITY', quoteCurrency: 'USD', providerSymbol: 'AAPL', isActive: true },
  { id: 'inst_msft', symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', country: 'US', assetClass: 'EQUITY', quoteCurrency: 'USD', providerSymbol: 'MSFT', isActive: true },
  { id: 'inst_nvda', symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', country: 'US', assetClass: 'EQUITY', quoteCurrency: 'USD', providerSymbol: 'NVDA', isActive: true },
  { id: 'inst_tsla', symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ', country: 'US', assetClass: 'EQUITY', quoteCurrency: 'USD', providerSymbol: 'TSLA', isActive: true },
  { id: 'inst_amzn', symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ', country: 'US', assetClass: 'EQUITY', quoteCurrency: 'USD', providerSymbol: 'AMZN', isActive: true },
  { id: 'inst_googl', symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', country: 'US', assetClass: 'EQUITY', quoteCurrency: 'USD', providerSymbol: 'GOOGL', isActive: true },
  
  // Indian Equities
  { id: 'inst_reliance', symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd.', exchange: 'NSE', country: 'IN', assetClass: 'EQUITY', quoteCurrency: 'INR', providerSymbol: 'RELIANCE.NS', isActive: true },
  { id: 'inst_tcs', symbol: 'TCS.NS', name: 'Tata Consultancy Services', exchange: 'NSE', country: 'IN', assetClass: 'EQUITY', quoteCurrency: 'INR', providerSymbol: 'TCS.NS', isActive: true },
  { id: 'inst_infy', symbol: 'INFY.NS', name: 'Infosys Limited', exchange: 'NSE', country: 'IN', assetClass: 'EQUITY', quoteCurrency: 'INR', providerSymbol: 'INFY.NS', isActive: true },
  { id: 'inst_hdfc', symbol: 'HDFCBANK.NS', name: 'HDFC Bank Limited', exchange: 'NSE', country: 'IN', assetClass: 'EQUITY', quoteCurrency: 'INR', providerSymbol: 'HDFCBANK.NS', isActive: true },
  
  // Global Indices
  { id: 'inst_sp500', symbol: '^GSPC', name: 'S&P 500', exchange: 'NYSE', country: 'US', assetClass: 'INDEX', quoteCurrency: 'USD', providerSymbol: '^GSPC', isActive: true },
  { id: 'inst_nasdaq', symbol: '^IXIC', name: 'NASDAQ Composite', exchange: 'NASDAQ', country: 'US', assetClass: 'INDEX', quoteCurrency: 'USD', providerSymbol: '^IXIC', isActive: true },
  { id: 'inst_nifty', symbol: '^NSEI', name: 'Nifty 50', exchange: 'NSE', country: 'IN', assetClass: 'INDEX', quoteCurrency: 'INR', providerSymbol: '^NSEI', isActive: true },
  { id: 'inst_sensex', symbol: '^BSESN', name: 'BSE SENSEX', exchange: 'BSE', country: 'IN', assetClass: 'INDEX', quoteCurrency: 'INR', providerSymbol: '^BSESN', isActive: true },
  
  // Crypto
  { id: 'inst_btc', symbol: 'BTC-USD', name: 'Bitcoin', exchange: 'CRYPTO', country: 'GLOBAL', assetClass: 'CRYPTO', quoteCurrency: 'USD', providerSymbol: 'BTC-USD', isActive: true },
  { id: 'inst_eth', symbol: 'ETH-USD', name: 'Ethereum', exchange: 'CRYPTO', country: 'GLOBAL', assetClass: 'CRYPTO', quoteCurrency: 'USD', providerSymbol: 'ETH-USD', isActive: true },
  { id: 'inst_sol', symbol: 'SOL-USD', name: 'Solana', exchange: 'CRYPTO', country: 'GLOBAL', assetClass: 'CRYPTO', quoteCurrency: 'USD', providerSymbol: 'SOL-USD', isActive: true }
];

export const marketRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all instruments with optional filter
  fastify.get('/instruments', async (req) => {
    const { exchange, assetClass, search } = req.query as any;
    let list = INSTRUMENTS;

    if (exchange) {
      list = list.filter(i => i.exchange.toUpperCase() === exchange.toUpperCase());
    }
    if (assetClass) {
      list = list.filter(i => i.assetClass.toUpperCase() === assetClass.toUpperCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
    }

    return list;
  });

  // Get specific quote
  fastify.get<{ Params: { symbol: string } }>('/quotes/:symbol', async (req, reply) => {
    try {
      const quote = await provider.getQuote(req.params.symbol);
      return quote;
    } catch (err: any) {
      return reply.status(502).send({ error: err.message });
    }
  });

  // Get multiple quotes
  fastify.get<{ Querystring: { symbols?: string } }>('/quotes', async (req) => {
    const syms = req.query.symbols 
      ? req.query.symbols.split(',').map(s => s.trim().toUpperCase())
      : ['AAPL', 'NVDA', 'MSFT', 'RELIANCE.NS', '^NSEI', '^GSPC', 'BTC-USD'];

    const quotes: Record<string, any> = {};
    await Promise.all(
      syms.map(async s => {
        try {
          quotes[s] = await provider.getQuote(s);
        } catch {
          // fallback
        }
      })
    );
    return quotes;
  });

  // Get historical candles
  fastify.get<{ Params: { symbol: string }, Querystring: { interval?: string, days?: string } }>(
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
};
