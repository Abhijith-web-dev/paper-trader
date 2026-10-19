import { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../middleware/authGuard.js';
import { PlaceOrderSchema } from '@globaltrade/shared';
import { TradingStore } from '../services/store.js';
import { ProviderManager } from '@globaltrade/market-data';

const provider = new ProviderManager();

export const orderRoutes: FastifyPluginAsync = async (fastify) => {
  // Place order
  fastify.post('/', { preHandler: [authGuard] }, async (req, reply) => {
    try {
      const input = PlaceOrderSchema.parse(req.body);
      const quote = await provider.getQuote(input.symbol);
      const result = await TradingStore.placeOrder(req.user!.id, input, quote);
      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Cancel order
  fastify.post<{ Params: { id: string } }>('/:id/cancel', { preHandler: [authGuard] }, async (req, reply) => {
    try {
      const cancelled = await TradingStore.cancelOrder(req.params.id, req.user!.id);
      return cancelled;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Get active and past orders
  fastify.get('/', { preHandler: [authGuard] }, async (req) => {
    const account = await TradingStore.getVirtualAccount(req.user!.id);
    const orders = await TradingStore.getOrders(account.id);
    return orders;
  });
};
