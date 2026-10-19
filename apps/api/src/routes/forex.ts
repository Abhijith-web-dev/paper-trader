import { FastifyPluginAsync } from 'fastify';
import { ProviderManager } from '@globaltrade/market-data';
import { FinancialMath } from '@globaltrade/shared';

const provider = new ProviderManager();

export const forexRoutes: FastifyPluginAsync = async (fastify) => {
  // Get FX Rate
  fastify.get<{ Querystring: { base?: string, quote?: string } }>('/rate', async (req, reply) => {
    try {
      const base = (req.query.base || 'USD').toUpperCase();
      const quote = (req.query.quote || 'INR').toUpperCase();
      const rate = await provider.getCurrencyRate(base, quote);
      return rate;
    } catch (err: any) {
      return reply.status(502).send({ error: err.message });
    }
  });

  // Calculate currency conversion with educational spread simulation
  fastify.post('/convert', async (req, reply) => {
    try {
      const { amount, from, to, includeSpread } = req.body as any;
      const amt = Number(amount) || 1;
      const base = (from || 'USD').toUpperCase();
      const quote = (to || 'INR').toUpperCase();

      const rateObj = await provider.getCurrencyRate(base, quote);
      const effectiveRate = includeSpread 
        ? FinancialMath.multiply(rateObj.rate, 0.998) // Simulated 0.2% interbank spread
        : rateObj.rate;

      const convertedAmount = FinancialMath.round(FinancialMath.multiply(amt, effectiveRate), 4);

      return {
        sourceAmount: amt,
        fromCurrency: base,
        toCurrency: quote,
        convertedAmount,
        exchangeRate: rateObj.rate,
        effectiveRate,
        timestamp: rateObj.timestamp,
        provider: rateObj.source,
        isDelayed: rateObj.isDelayed
      };
    } catch (err: any) {
      return reply.status(502).send({ error: err.message });
    }
  });

  // Historical FX rate series for charts
  fastify.get<{ Querystring: { base?: string, quote?: string, days?: string } }>('/history', async (req, reply) => {
    try {
      const base = (req.query.base || 'USD').toUpperCase();
      const quote = (req.query.quote || 'INR').toUpperCase();
      const days = Number(req.query.days || 30);
      return await provider.getHistoricalFxRates(base, quote, days);
    } catch (err: any) {
      return reply.status(502).send({ error: err.message });
    }
  });
};
