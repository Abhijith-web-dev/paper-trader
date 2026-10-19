import { FinancialMath, LedgerEntry, LedgerTransactionType, VirtualAccount } from '@globaltrade/shared';

export interface LedgerUpdateResult {
  updatedAccount: VirtualAccount;
  ledgerEntry: LedgerEntry;
}

export class LedgerAccounting {
  static createInitialDeposit(
    account: VirtualAccount,
    idempotencyKey: string
  ): LedgerUpdateResult {
    const entry: LedgerEntry = {
      id: `led_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      accountId: account.id,
      userId: account.userId,
      type: 'INITIAL_DEPOSIT',
      amount: account.initialBalance,
      balanceAfter: account.initialBalance,
      idempotencyKey,
      description: `Initial virtual deposit of ${account.baseCurrency} ${account.initialBalance}`,
      timestamp: Date.now()
    };

    return {
      updatedAccount: {
        ...account,
        availableCash: account.initialBalance,
        reservedCash: 0,
        updatedAt: Date.now()
      },
      ledgerEntry: entry
    };
  }

  static holdFundsForOrder(
    account: VirtualAccount,
    notionalHoldAmount: number,
    orderId: string,
    idempotencyKey: string
  ): LedgerUpdateResult {
    if (account.availableCash < notionalHoldAmount) {
      throw new Error(`Insufficient funds: required ${notionalHoldAmount}, available ${account.availableCash}`);
    }

    const newAvailable = FinancialMath.subtract(account.availableCash, notionalHoldAmount);
    const newReserved = FinancialMath.add(account.reservedCash, notionalHoldAmount);

    const entry: LedgerEntry = {
      id: `led_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      accountId: account.id,
      userId: account.userId,
      type: 'ORDER_HOLD',
      amount: -notionalHoldAmount,
      balanceAfter: newAvailable,
      referenceId: orderId,
      idempotencyKey,
      description: `Reserved funds for order ${orderId}`,
      timestamp: Date.now()
    };

    return {
      updatedAccount: {
        ...account,
        availableCash: newAvailable,
        reservedCash: newReserved,
        updatedAt: Date.now()
      },
      ledgerEntry: entry
    };
  }

  static releaseFundsForOrder(
    account: VirtualAccount,
    notionalHoldAmount: number,
    orderId: string,
    idempotencyKey: string
  ): LedgerUpdateResult {
    const releaseAmount = Math.min(account.reservedCash, notionalHoldAmount);
    const newReserved = FinancialMath.subtract(account.reservedCash, releaseAmount);
    const newAvailable = FinancialMath.add(account.availableCash, releaseAmount);

    const entry: LedgerEntry = {
      id: `led_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      accountId: account.id,
      userId: account.userId,
      type: 'ORDER_RELEASE',
      amount: releaseAmount,
      balanceAfter: newAvailable,
      referenceId: orderId,
      idempotencyKey,
      description: `Released reserved funds for cancelled order ${orderId}`,
      timestamp: Date.now()
    };

    return {
      updatedAccount: {
        ...account,
        availableCash: newAvailable,
        reservedCash: newReserved,
        updatedAt: Date.now()
      },
      ledgerEntry: entry
    };
  }

  static applyBuyFill(
    account: VirtualAccount,
    totalCost: number,
    wasReserved: boolean,
    orderId: string,
    idempotencyKey: string
  ): LedgerUpdateResult {
    let newAvailable = account.availableCash;
    let newReserved = account.reservedCash;

    if (wasReserved) {
      newReserved = FinancialMath.subtract(newReserved, totalCost);
      if (newReserved < 0) {
        newAvailable = FinancialMath.add(newAvailable, newReserved);
        newReserved = 0;
      }
    } else {
      if (newAvailable < totalCost) {
        throw new Error(`Insufficient available funds for execution: need ${totalCost}, have ${newAvailable}`);
      }
      newAvailable = FinancialMath.subtract(newAvailable, totalCost);
    }

    const entry: LedgerEntry = {
      id: `led_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      accountId: account.id,
      userId: account.userId,
      type: 'BUY_EXECUTION',
      amount: -totalCost,
      balanceAfter: newAvailable,
      referenceId: orderId,
      idempotencyKey,
      description: `Executed buy fill for order ${orderId}`,
      timestamp: Date.now()
    };

    return {
      updatedAccount: {
        ...account,
        availableCash: newAvailable,
        reservedCash: newReserved,
        updatedAt: Date.now()
      },
      ledgerEntry: entry
    };
  }

  static applySellFill(
    account: VirtualAccount,
    netProceeds: number,
    orderId: string,
    idempotencyKey: string
  ): LedgerUpdateResult {
    const newAvailable = FinancialMath.add(account.availableCash, netProceeds);

    const entry: LedgerEntry = {
      id: `led_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      accountId: account.id,
      userId: account.userId,
      type: 'SELL_EXECUTION',
      amount: netProceeds,
      balanceAfter: newAvailable,
      referenceId: orderId,
      idempotencyKey,
      description: `Executed sell fill for order ${orderId}`,
      timestamp: Date.now()
    };

    return {
      updatedAccount: {
        ...account,
        availableCash: newAvailable,
        updatedAt: Date.now()
      },
      ledgerEntry: entry
    };
  }
}
