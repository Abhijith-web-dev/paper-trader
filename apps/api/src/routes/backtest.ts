import { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../middleware/authGuard.js';
import { ProviderManager } from '@globaltrade/market-data';
import { Backtester } from '@globaltrade/trading-engine';
import { BacktestConfig } from '@globaltrade/shared';
import { TradingStore } from '../services/store.js';

const provider = new ProviderManager();

export const backtestRoutes: FastifyPluginAsync = async (fastify) => {
  // Run backtest
  fastify.post('/run', { preHandler: [authGuard] }, async (req, reply) => {
    try {
      const config = req.body as BacktestConfig;
      if (!config.symbol || !config.strategy) {
        return reply.status(400).send({ error: 'Symbol and strategy are required' });
      }

      // Fetch 180 days of historical daily candles for the backtest
      const candles = await provider.getHistoricalCandles(config.symbol, '1d', 180);
      if (!candles || candles.length < 20) {
        return reply.status(400).send({ error: `Insufficient real historical data for ${config.symbol} (found ${candles.length} candles)` });
      }

      const result = Backtester.run(config, candles);
      await TradingStore.saveBacktestResult(req.user!.id, result);
      return result;
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Get previous backtest runs
  fastify.get('/history', { preHandler: [authGuard] }, async (req) => {
    return await TradingStore.getBacktestResults(req.user!.id);
  });
};
