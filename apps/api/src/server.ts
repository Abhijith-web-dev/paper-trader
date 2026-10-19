import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';
import { authRoutes } from './routes/auth.js';
import { marketRoutes } from './routes/markets.js';
import { orderRoutes } from './routes/orders.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { forexRoutes } from './routes/forex.js';
import { watchlistRoutes } from './routes/watchlists.js';
import { alertRoutes } from './routes/alerts.js';
import { backtestRoutes } from './routes/backtest.js';
import { fileRoutes } from './routes/files.js';
import { adminRoutes } from './routes/admin.js';
import { ensureStorageBuckets } from './config/supabaseStorage.js';

dotenv.config();

const port = Number(process.env.PORT || 4000);
const server = Fastify({ logger: true });

async function main() {
  await server.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  await server.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute'
  });

  await server.register(websocket);

  // Health check
  server.get('/health', async () => ({
    status: 'ok',
    service: 'globaltrade-api',
    timestamp: Date.now()
  }));

  // Register API routes under /api/v1
  await server.register(authRoutes, { prefix: '/api/v1/auth' });
  await server.register(marketRoutes, { prefix: '/api/v1/markets' });
  await server.register(orderRoutes, { prefix: '/api/v1/orders' });
  await server.register(portfolioRoutes, { prefix: '/api/v1/portfolio' });
  await server.register(forexRoutes, { prefix: '/api/v1/forex' });
  await server.register(watchlistRoutes, { prefix: '/api/v1/watchlists' });
  await server.register(alertRoutes, { prefix: '/api/v1/alerts' });
  await server.register(backtestRoutes, { prefix: '/api/v1/backtest' });
  await server.register(fileRoutes, { prefix: '/api/v1/files' });
  await server.register(adminRoutes, { prefix: '/api/v1/admin' });

  // Init Supabase storage buckets
  ensureStorageBuckets().catch(() => {});

  await server.listen({ port, host: '0.0.0.0' });
  console.log(`🚀 GlobalTrade Simulator API running on http://localhost:${port}`);
}

main().catch(err => {
  console.error('API bootstrap failure:', err);
  process.exit(1);
});
