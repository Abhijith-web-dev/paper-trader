import { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../middleware/authGuard.js';
import { TradingStore } from '../services/store.js';

export const watchlistRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [authGuard] }, async (req) => {
    return await TradingStore.getWatchlists(req.user!.id);
  });

  fastify.put('/:id', { preHandler: [authGuard] }, async (req, reply) => {
    try {
      const { symbols } = req.body as any;
      if (!Array.isArray(symbols)) {
        return reply.status(400).send({ error: 'Symbols must be an array of strings' });
      }
      return await TradingStore.updateWatchlistSymbols(req.user!.id, (req.params as any).id, symbols);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};
