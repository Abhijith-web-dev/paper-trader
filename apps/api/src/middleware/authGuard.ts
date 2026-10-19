import { FastifyRequest, FastifyReply } from 'fastify';
import { admin, isFirebaseConfigured } from '../config/firebaseAdmin.js';
import { TradingStore } from '../services/store.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      displayName: string;
      role: 'user' | 'admin';
    };
  }
}

export async function authGuard(req: FastifyRequest, reply: FastifyReply) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split('Bearer ')[1].trim();

  // If Firebase is configured with real credentials, verify via Admin SDK
  if (isFirebaseConfigured && !token.startsWith('mock_token_')) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      req.user = {
        id: decoded.uid,
        email: decoded.email || 'user@example.com',
        displayName: decoded.name || (decoded.email ? decoded.email.split('@')[0] : 'Trader'),
        role: (decoded.role as any) || 'user'
      };

      // Ensure profile exists in store
      await TradingStore.upsertUser({
        id: req.user.id,
        email: req.user.email,
        displayName: req.user.displayName,
        role: req.user.role,
        createdAt: Date.now()
      });
      return;
    } catch (err: any) {
      return reply.status(401).send({ error: `Invalid Firebase token: ${err.message}` });
    }
  }

  // Local Development / Test simulation mode:
  // Allows testing without cloud keys, e.g. "Bearer mock_token_usr_123"
  const cleanId = token.replace('mock_token_', '') || 'demo_trader_1';
  req.user = {
    id: cleanId,
    email: `${cleanId}@globaltrade.sim`,
    displayName: cleanId === 'demo_trader_1' ? 'Pro Trader' : cleanId,
    role: 'user'
  };

  await TradingStore.upsertUser({
    id: req.user.id,
    email: req.user.email,
    displayName: req.user.displayName,
    role: req.user.role,
    createdAt: Date.now()
  });
}
