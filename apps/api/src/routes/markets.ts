import { FastifyPluginAsync } from 'fastify';
import { ProviderManager } from '@globaltrade/market-data';
import { CandleInterval, Instrument, MarketCoverageInfo } from '@globaltrade/shared';

const provider = new ProviderManager();

export const INSTRUMENTS: Instrument[] = [
  // US Equities (NASDAQ / NYSE)
  { id: 'inst_aapl', symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', country: 'US', assetClass: 'EQUITY', quoteCurrency: 'USD', providerSymbol: 'AAPL', isActive: true },
  { id: 'inst_msft', symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', country: 'US', assetClass: 'EQUITY', quoteCurrency: 'USD', providerSymbol: 'MSFT', isActive: true },
  { id: 'inst_nvda', symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', country: 'US', assetClass: 'EQUITY', quoteCurrency: 'USD', providerSymbol: 'NVDA', isActive: true },
  { id: 'inst_tsla', symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ', country: 'US', assetClass: 'EQUITY', quoteCurrency: 'USD', providerSymbol: 'TSLA', isActive: true },
  { id: 'inst_amzn', symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ', country: 'US', assetClass: 'EQUITY', quoteCurrency: 'USD', providerSymbol: 'AMZN', isActive: true },
  { id: 'inst_googl', symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', country: 'US', assetClass: 'EQUITY', quoteCurrency: 'USD', providerSymbol: 'GOOGL', isActive: true },
  
  // Indian Equities (NSE / BSE)
  { id: 'inst_reliance', symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd.', exchange: 'NSE', country: 'IN', assetClass: 'EQUITY', quoteCurrency: 'INR', providerSymbol: 'RELIANCE.NS', isActive: true },
  { id: 'inst_tcs', symbol: 'TCS.NS', name: 'Tata Consultancy Services', exchange: 'NSE', country: 'IN', assetClass: 'EQUITY', quoteCurrency: 'INR', providerSymbol: 'TCS.NS', isActive: true },
  { id: 'inst_infy', symbol: 'INFY.NS', name: 'Infosys Limited', exchange: 'NSE', country: 'IN', assetClass: 'EQUITY', quoteCurrency: 'INR', providerSymbol: 'INFY.NS', isActive: true },
  { id: 'inst_hdfc', symbol: 'HDFCBANK.NS', name: 'HDFC Bank Limited', exchange: 'NSE', country: 'IN', assetClass: 'EQUITY', quoteCurrency: 'INR', providerSymbol: 'HDFCBANK.NS', isActive: true },

  // UK Equities (LSE)
  { id: 'inst_shel', symbol: 'SHEL.L', name: 'Shell plc', exchange: 'LSE', country: 'UK', assetClass: 'EQUITY', quoteCurrency: 'GBP', providerSymbol: 'SHEL.L', isActive: true },
  { id: 'inst_azn', symbol: 'AZN.L', name: 'AstraZeneca PLC', exchange: 'LSE', country: 'UK', assetClass: 'EQUITY', quoteCurrency: 'GBP', providerSymbol: 'AZN.L', isActive: true },
  { id: 'inst_hsba', symbol: 'HSBA.L', name: 'HSBC Holdings plc', exchange: 'LSE', country: 'UK', assetClass: 'EQUITY', quoteCurrency: 'GBP', providerSymbol: 'HSBA.L', isActive: true },

  // European Equities (Euronext / DAX)
  { id: 'inst_asml', symbol: 'ASML.AS', name: 'ASML Holding N.V.', exchange: 'EURONEXT', country: 'EU', assetClass: 'EQUITY', quoteCurrency: 'EUR', providerSymbol: 'ASML.AS', isActive: true },
  { id: 'inst_sap', symbol: 'SAP.DE', name: 'SAP SE', exchange: 'EURONEXT', country: 'EU', assetClass: 'EQUITY', quoteCurrency: 'EUR', providerSymbol: 'SAP.DE', isActive: true },

  // Japanese Equities (TSE)
  { id: 'inst_toyota', symbol: '7203.T', name: 'Toyota Motor Corp.', exchange: 'TSE', country: 'JP', assetClass: 'EQUITY', quoteCurrency: 'JPY', providerSymbol: '7203.T', isActive: true },
  { id: 'inst_sony', symbol: '6758.T', name: 'Sony Group Corp.', exchange: 'TSE', country: 'JP', assetClass: 'EQUITY', quoteCurrency: 'JPY', providerSymbol: '6758.T', isActive: true },

  // Australian Equities (ASX)
  { id: 'inst_bhp', symbol: 'BHP.AX', name: 'BHP Group Limited', exchange: 'ASX', country: 'AU', assetClass: 'EQUITY', quoteCurrency: 'AUD', providerSymbol: 'BHP.AX', isActive: true },
  { id: 'inst_cba', symbol: 'CBA.AX', name: 'Commonwealth Bank of Australia', exchange: 'ASX', country: 'AU', assetClass: 'EQUITY', quoteCurrency: 'AUD', providerSymbol: 'CBA.AX', isActive: true },
  
  // Global Indices
  { id: 'inst_sp500', symbol: '^GSPC', name: 'S&P 500', exchange: 'NYSE', country: 'US', assetClass: 'INDEX', quoteCurrency: 'USD', providerSymbol: '^GSPC', isActive: true },
  { id: 'inst_nasdaq', symbol: '^IXIC', name: 'NASDAQ Composite', exchange: 'NASDAQ', country: 'US', assetClass: 'INDEX', quoteCurrency: 'USD', providerSymbol: '^IXIC', isActive: true },
  { id: 'inst_nifty', symbol: '^NSEI', name: 'Nifty 50', exchange: 'NSE', country: 'IN', assetClass: 'INDEX', quoteCurrency: 'INR', providerSymbol: '^NSEI', isActive: true },
  { id: 'inst_ftse', symbol: '^FTSE', name: 'FTSE 100', exchange: 'LSE', country: 'UK', assetClass: 'INDEX', quoteCurrency: 'GBP', providerSymbol: '^FTSE', isActive: true },
  { id: 'inst_nikkei', symbol: '^N225', name: 'Nikkei 225', exchange: 'TSE', country: 'JP', assetClass: 'INDEX', quoteCurrency: 'JPY', providerSymbol: '^N225', isActive: true },
  
  // Crypto
  { id: 'inst_btc', symbol: 'BTC-USD', name: 'Bitcoin', exchange: 'CRYPTO', country: 'GLOBAL', assetClass: 'CRYPTO', quoteCurrency: 'USD', providerSymbol: 'BTC-USD', isActive: true },
  { id: 'inst_eth', symbol: 'ETH-USD', name: 'Ethereum', exchange: 'CRYPTO', country: 'GLOBAL', assetClass: 'CRYPTO', quoteCurrency: 'USD', providerSymbol: 'ETH-USD', isActive: true },
  { id: 'inst_sol', symbol: 'SOL-USD', name: 'Solana', exchange: 'CRYPTO', country: 'GLOBAL', assetClass: 'CRYPTO', quoteCurrency: 'USD', providerSymbol: 'SOL-USD', isActive: true }
];

export const MARKET_COVERAGE: MarketCoverageInfo[] = [
  {
    exchange: 'NASDAQ',
    name: 'NASDAQ Stock Market',
    country: 'United States',
    currency: 'USD',
    timezone: 'America/New_York (UTC-4 / UTC-5)',
    marketHours: '09:30 - 16:00 EST (Pre-market 04:00 - 09:30, After-hours 16:00 - 20:00)',
    supportedOrderTypes: ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'],
    dataProvider: 'Yahoo Finance (Direct Query2 API)',
    dataFreshness: 'REAL_TIME',
    historicalDepth: 'Intraday (1m, 5m), Daily up to 10+ years',
    limitations: 'Delayed by ~15s outside peak hours; volume indicates consolidated tape',
    sampleTickers: ['AAPL', 'MSFT', 'NVDA', 'TSLA']
  },
  {
    exchange: 'NSE',
    name: 'National Stock Exchange of India',
    country: 'India',
    currency: 'INR',
    timezone: 'Asia/Kolkata (UTC+5:30)',
    marketHours: '09:15 - 15:30 IST (Pre-open 09:00 - 09:08)',
    supportedOrderTypes: ['MARKET', 'LIMIT', 'STOP'],
    dataProvider: 'Yahoo Finance (.NS mapping)',
    dataFreshness: 'REAL_TIME',
    historicalDepth: 'Daily, Weekly, Monthly up to 5+ years',
    limitations: 'After-hours quotes display closing auction mark price',
    sampleTickers: ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS']
  },
  {
    exchange: 'LSE',
    name: 'London Stock Exchange',
    country: 'United Kingdom',
    currency: 'GBP',
    timezone: 'Europe/London (UTC+0 / UTC+1)',
    marketHours: '08:00 - 16:30 GMT',
    supportedOrderTypes: ['MARKET', 'LIMIT'],
    dataProvider: 'Yahoo Finance (.L mapping)',
    dataFreshness: 'REAL_TIME',
    historicalDepth: 'Daily up to 5+ years',
    limitations: 'Quotes priced in pence/pounds according to exchange convention',
    sampleTickers: ['SHEL.L', 'AZN.L', 'HSBA.L', '^FTSE']
  },
  {
    exchange: 'EURONEXT',
    name: 'Euronext & Deutsche Börse XETRA',
    country: 'European Union',
    currency: 'EUR',
    timezone: 'Europe/Paris (UTC+1 / UTC+2)',
    marketHours: '09:00 - 17:30 CET',
    supportedOrderTypes: ['MARKET', 'LIMIT', 'STOP'],
    dataProvider: 'Yahoo Finance (.AS / .DE mapping)',
    dataFreshness: 'REAL_TIME',
    historicalDepth: 'Daily up to 5+ years',
    limitations: 'Pan-European composite cross-listings normalized to primary home venue',
    sampleTickers: ['ASML.AS', 'SAP.DE']
  },
  {
    exchange: 'TSE',
    name: 'Tokyo Stock Exchange',
    country: 'Japan',
    currency: 'JPY',
    timezone: 'Asia/Tokyo (UTC+9)',
    marketHours: '09:00 - 11:30, 12:30 - 15:30 JST (Lunch recess)',
    supportedOrderTypes: ['MARKET', 'LIMIT'],
    dataProvider: 'Yahoo Finance (.T mapping)',
    dataFreshness: 'REAL_TIME',
    historicalDepth: 'Daily up to 5+ years',
    limitations: 'JPY integer quoting precision; lunch break auction pauses session',
    sampleTickers: ['7203.T', '6758.T', '^N225']
  },
  {
    exchange: 'ASX',
    name: 'Australian Securities Exchange',
    country: 'Australia',
    currency: 'AUD',
    timezone: 'Australia/Sydney (UTC+10 / UTC+11)',
    marketHours: '10:00 - 16:00 AEST',
    supportedOrderTypes: ['MARKET', 'LIMIT'],
    dataProvider: 'Yahoo Finance (.AX mapping)',
    dataFreshness: 'REAL_TIME',
    historicalDepth: 'Daily up to 5+ years',
    limitations: 'Session closes with staggered closing single price auction',
    sampleTickers: ['BHP.AX', 'CBA.AX']
  },
  {
    exchange: 'FOREX',
    name: 'Global Interbank Foreign Exchange',
    country: 'Global',
    currency: 'Multi-Currency',
    timezone: 'Continuous 24/5 (Mon Sydney - Fri New York)',
    marketHours: '24 Hours / 5 Days a week',
    supportedOrderTypes: ['INDICATIVE_CONVERT'],
    dataProvider: 'Frankfurter API / European Central Bank',
    dataFreshness: 'REAL_TIME',
    historicalDepth: 'Daily ECB time series since 1999',
    limitations: 'Reference mid-market rates; educational 0.2% retail spread simulated',
    sampleTickers: ['USD/INR', 'EUR/USD', 'GBP/USD', 'USD/JPY']
  },
  {
    exchange: 'CRYPTO',
    name: 'Decentralized Spot Crypto Markets',
    country: 'Global',
    currency: 'USD',
    timezone: 'Continuous 24/7/365',
    marketHours: '24 Hours / 7 Days a week (No market holidays)',
    supportedOrderTypes: ['MARKET', 'LIMIT'],
    dataProvider: 'CoinGecko API (Global Volume-Weighted)',
    dataFreshness: 'REAL_TIME',
    historicalDepth: 'Up to 365 days',
    limitations: 'Aggregated volume-weighted average price across top global liquidity venues',
    sampleTickers: ['BTC-USD', 'ETH-USD', 'SOL-USD']
  }
];

export const marketRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all instruments with optional filter
  fastify.get('/instruments', async (req) => {
    const { exchange, assetClass, country, search } = req.query as any;
    let list = INSTRUMENTS;

    if (exchange) {
      list = list.filter(i => i.exchange.toUpperCase() === exchange.toUpperCase());
    }
    if (assetClass) {
      list = list.filter(i => i.assetClass.toUpperCase() === assetClass.toUpperCase());
    }
    if (country) {
      list = list.filter(i => i.country.toUpperCase() === country.toUpperCase());
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
    }

    return list;
  });

  // Get Market Coverage Directory
  fastify.get('/coverage', async () => {
    return MARKET_COVERAGE;
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
      : ['AAPL', 'NVDA', 'RELIANCE.NS', 'SHEL.L', '7203.T', '^NSEI', '^GSPC', 'BTC-USD'];

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
