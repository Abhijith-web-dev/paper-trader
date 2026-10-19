import { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../middleware/authGuard.js';
import { TradingStore } from '../services/store.js';

export const achievementRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [authGuard] }, async (req) => {
    const list = await TradingStore.getAchievements(req.user!.id);
    return list;
  });

  fastify.post('/unlock', { preHandler: [authGuard] }, async (req, reply) => {
    try {
      const { code } = req.body as any;
      if (!code) return reply.status(400).send({ error: 'Achievement code required' });
      const unlocked = await TradingStore.unlockAchievement(req.user!.id, code);
      return { success: true, achievement: unlocked };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};
