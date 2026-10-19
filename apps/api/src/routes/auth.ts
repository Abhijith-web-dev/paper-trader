import { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../middleware/authGuard.js';
import { TradingStore } from '../services/store.js';
import { UpdatePreferencesSchema } from '@globaltrade/shared';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/me', { preHandler: [authGuard] }, async (req) => {
    const user = req.user!;
    const profile = await TradingStore.getUser(user.id);
    const preferences = await TradingStore.getPreferences(user.id);
    const account = await TradingStore.getVirtualAccount(user.id);

    return {
      user: profile || user,
      preferences,
      account
    };
  });

  fastify.post('/preferences', { preHandler: [authGuard] }, async (req, reply) => {
    try {
      const parsed = UpdatePreferencesSchema.partial().parse(req.body);
      const updated = await TradingStore.updatePreferences(req.user!.id, parsed);
      return updated;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Onboarding initialization endpoint
  fastify.post('/onboarding', { preHandler: [authGuard] }, async (req, reply) => {
    try {
      const { baseCurrency, initialBalance, experienceLevel } = req.body as any;
      const currency = baseCurrency || 'USD';
      const balance = Number(initialBalance) || 100000;

      await TradingStore.updatePreferences(req.user!.id, {
        baseCurrency: currency,
        experienceLevel: experienceLevel || 'BEGINNER'
      });

      const account = await TradingStore.initializeVirtualAccount(req.user!.id, currency, balance);
      return { success: true, account };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};
