import { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../middleware/authGuard.js';
import { TradingStore } from '../services/store.js';
import { ProviderManager } from '@globaltrade/market-data';
import { FinancialMath, PortfolioSummary } from '@globaltrade/shared';
import { PnlCalculator } from '@globaltrade/trading-engine';

const provider = new ProviderManager();

export const portfolioRoutes: FastifyPluginAsync = async (fastify) => {
  // Get portfolio summary with live mark prices
  fastify.get('/', { preHandler: [authGuard] }, async (req) => {
    const account = await TradingStore.getVirtualAccount(req.user!.id);
    const positions = await TradingStore.getPositions(account.id);

    let totalInvestedValue = 0;
    let totalMarketValue = 0;
    let totalUnrealizedPnl = 0;
    let totalRealizedPnl = 0;

    const evaluatedPositions = await Promise.all(
      positions.map(async pos => {
        let currentPrice = pos.currentPrice;
        try {
          const q = await provider.getQuote(pos.symbol);
          currentPrice = q.price;
        } catch {
          // fallback to last known
        }

        const pnl = PnlCalculator.calculatePositionPnl(pos.quantity, pos.averageEntryPrice, currentPrice);
        const cost = FinancialMath.multiply(pos.quantity, pos.averageEntryPrice);

        totalInvestedValue = FinancialMath.add(totalInvestedValue, cost);
        totalMarketValue = FinancialMath.add(totalMarketValue, pnl.marketValue);
        totalUnrealizedPnl = FinancialMath.add(totalUnrealizedPnl, pnl.unrealizedPnl);
        totalRealizedPnl = FinancialMath.add(totalRealizedPnl, pos.realizedPnl);

        return {
          ...pos,
          currentPrice,
          marketValue: pnl.marketValue,
          unrealizedPnl: pnl.unrealizedPnl,
          unrealizedPnlPercent: pnl.unrealizedPnlPercent
        };
      })
    );

    const totalEquity = FinancialMath.add(account.availableCash, FinancialMath.add(account.reservedCash, totalMarketValue));
    const allTimePnl = FinancialMath.add(totalRealizedPnl, totalUnrealizedPnl);
    const allTimeReturnPct = account.initialBalance > 0
      ? FinancialMath.calculatePercentageChange(totalEquity, account.initialBalance)
      : 0;

    // --- Risk Analysis ---
    let topHoldingSymbol = 'NONE';
    let topHoldingWeightPercent = 0;
    const currencyExposureMap = new Map<string, number>();
    const warnings: string[] = [];

    // Cash currency exposure
    currencyExposureMap.set(account.baseCurrency, account.availableCash + account.reservedCash);

    for (const pos of evaluatedPositions) {
      const posWeight = totalEquity > 0 ? (pos.marketValue / totalEquity) * 100 : 0;
      if (posWeight > topHoldingWeightPercent) {
        topHoldingWeightPercent = FinancialMath.round(posWeight, 1);
        topHoldingSymbol = pos.symbol;
      }

      // Group currency exposure
      const cur = pos.currency || account.baseCurrency;
      const currentCurTotal = currencyExposureMap.get(cur) || 0;
      currencyExposureMap.set(cur, currentCurTotal + pos.marketValue);
    }

    if (topHoldingWeightPercent > 35) {
      warnings.push(`High concentration risk: ${topHoldingSymbol} accounts for ${topHoldingWeightPercent}% of total portfolio value.`);
    } else if (topHoldingWeightPercent > 20) {
      warnings.push(`Moderate concentration: single position ${topHoldingSymbol} exceeds 20% weighting.`);
    }

    const currencyExposures = Array.from(currencyExposureMap.entries()).map(([currency, marketValue]) => ({
      currency,
      marketValue: FinancialMath.round(marketValue, 2),
      percentage: totalEquity > 0 ? FinancialMath.round((marketValue / totalEquity) * 100, 1) : 0
    }));

    const concentrationRisk: 'LOW' | 'MODERATE' | 'HIGH' = 
      topHoldingWeightPercent > 35 ? 'HIGH' : topHoldingWeightPercent > 20 ? 'MODERATE' : 'LOW';

    const summary: PortfolioSummary = {
      accountId: account.id,
      baseCurrency: account.baseCurrency,
      totalEquity,
      availableCash: account.availableCash,
      reservedCash: account.reservedCash,
      investedValue: totalInvestedValue,
      unrealizedPnl: totalUnrealizedPnl,
      unrealizedPnlPercent: totalInvestedValue > 0 ? FinancialMath.round((totalUnrealizedPnl / totalInvestedValue) * 100, 2) : 0,
      realizedPnl: totalRealizedPnl,
      dayChange: totalUnrealizedPnl,
      dayChangePercent: allTimeReturnPct,
      positionsCount: evaluatedPositions.length,
      riskAnalysis: {
        concentrationRisk,
        topHoldingSymbol,
        topHoldingWeightPercent,
        currencyExposures,
        warnings
      }
    };

    return {
      account,
      summary,
      positions: evaluatedPositions
    };
  });

  // Get double-entry ledger transactions
  fastify.get('/ledger', { preHandler: [authGuard] }, async (req) => {
    const account = await TradingStore.getVirtualAccount(req.user!.id);
    const ledger = await TradingStore.getLedger(account.id);
    return ledger;
  });

  // Reset virtual portfolio balance
  fastify.post('/reset', { preHandler: [authGuard] }, async (req) => {
    const prefs = await TradingStore.getPreferences(req.user!.id);
    const account = await TradingStore.initializeVirtualAccount(
      req.user!.id,
      prefs.baseCurrency || 'USD',
      100000
    );
    return { success: true, account };
  });
};
