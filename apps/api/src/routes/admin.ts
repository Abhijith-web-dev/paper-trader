import { FastifyPluginAsync } from 'fastify';
import { isFirebaseConfigured } from '../config/firebaseAdmin.js';

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/telemetry', async () => {
    return {
      status: 'operational',
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        provider: 'Firebase Firestore',
        isFirebaseConfigured,
        mode: isFirebaseConfigured ? 'production-cloud' : 'in-memory-dev'
      },
      storage: {
        provider: 'Supabase Storage',
        status: 'active'
      },
      marketData: {
        primaryEquityProvider: 'Yahoo Finance (yahoo-finance2)',
        primaryForexProvider: 'Frankfurter (European Central Bank)',
        cryptoProvider: 'CoinGecko API',
        cacheTTLSeconds: 5
      },
      features: {
        cryptoEnabled: true,
        indianEquitiesEnabled: true,
        forexEnabled: true,
        backtestingEnabled: true,
        paperTradingEnabled: true
      },
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    };
  });
};
