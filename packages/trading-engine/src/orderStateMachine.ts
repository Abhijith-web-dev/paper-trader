import { OrderStatus } from '@globaltrade/shared';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED'],
  PARTIALLY_FILLED: ['FILLED', 'CANCELLED', 'EXPIRED'],
  FILLED: [],
  CANCELLED: [],
  REJECTED: [],
  EXPIRED: []
};

export class OrderStateMachine {
  static canTransition(from: OrderStatus, to: OrderStatus): boolean {
    const allowed = VALID_TRANSITIONS[from];
    return !!allowed && allowed.includes(to);
  }

  static assertTransition(from: OrderStatus, to: OrderStatus): void {
    if (!this.canTransition(from, to)) {
      throw new Error(`Illegal order state transition from ${from} to ${to}`);
    }
  }

  static isTerminal(status: OrderStatus): boolean {
    return status === 'FILLED' || status === 'CANCELLED' || status === 'REJECTED' || status === 'EXPIRED';
  }
}
