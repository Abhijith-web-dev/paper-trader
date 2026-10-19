export type OrderSide = 'BUY' | 'SELL';

export type OrderType = 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';

export type OrderStatus = 
  | 'PENDING'
  | 'FILLED'
  | 'PARTIALLY_FILLED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED';

export interface Order {
  id: string;
  userId: string;
  accountId: string;
  symbol: string;
  exchange: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  quantity: number;
  filledQuantity: number;
  limitPrice?: number;
  stopPrice?: number;
  avgFillPrice?: number;
  fees: number;
  slippage: number;
  idempotencyKey: string;
  placedAt: number;
  filledAt?: number;
  cancelledAt?: number;
  rejectReason?: string;
}

export interface Trade {
  id: string;
  orderId: string;
  accountId: string;
  userId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  fee: number;
  executedAt: number;
}
