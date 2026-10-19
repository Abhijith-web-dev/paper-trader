import { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../middleware/authGuard.js';
import { TradingStore } from '../services/store.js';
import { CreateJournalEntrySchema } from '@globaltrade/shared';

export const journalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', { preHandler: [authGuard] }, async (req) => {
    const { accountId } = req.query as any;
    const entries = await TradingStore.getJournalEntries(req.user!.id, accountId);
    return entries;
  });

  fastify.post('/', { preHandler: [authGuard] }, async (req, reply) => {
    try {
      const parsed = CreateJournalEntrySchema.parse(req.body);
      const account = await TradingStore.getVirtualAccount(req.user!.id);
      
      const entry = await TradingStore.createJournalEntry(req.user!.id, {
        accountId: account.id,
        symbol: parsed.symbol,
        strategyTag: parsed.strategyTag,
        entryRationale: parsed.entryRationale,
        intendedRiskAmount: parsed.intendedRiskAmount,
        targetProfitAmount: parsed.targetProfitAmount,
        orderId: parsed.orderId,
        postTradeReview: parsed.postTradeReview,
        lessonLearned: parsed.lessonLearned
      });

      // Unlock gamified achievement
      await TradingStore.unlockAchievement(req.user!.id, 'JOURNAL_LOGGED');

      return reply.status(201).send(entry);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
};
