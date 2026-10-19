import { z } from 'zod';

export const PlaceOrderSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').max(20),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT']),
  quantity: z.number().positive('Quantity must be greater than zero'),
  limitPrice: z.number().positive('Limit price must be greater than zero').optional(),
  stopPrice: z.number().positive('Stop price must be greater than zero').optional(),
  idempotencyKey: z.string().min(8, 'Valid idempotency key is required')
}).refine(data => {
  if (data.type === 'LIMIT' && (!data.limitPrice || data.limitPrice <= 0)) {
    return false;
  }
  if (data.type === 'STOP' && (!data.stopPrice || data.stopPrice <= 0)) {
    return false;
  }
  if (data.type === 'STOP_LIMIT' && (!data.limitPrice || !data.stopPrice)) {
    return false;
  }
  return true;
}, {
  message: 'Appropriate price parameters must be provided for the selected order type'
});

export type PlaceOrderInput = z.infer<typeof PlaceOrderSchema>;
