import { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../middleware/authGuard.js';
import { TradingStore } from '../services/store.js';
import { CreateAlertSchema } from '@globaltrade/shared';

export const alertRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [authGuard] }, async (req) => {
    return await TradingStore.getAlerts(req.user!.id);
  });

  fastify.post('/', { preHandler: [authGuard] }, async (req, reply) => {
    try {
      const input = CreateAlertSchema.parse(req.body);
      return await TradingStore.createAlert(req.user!.id, input.symbol, input.targetPrice, input.condition);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};
