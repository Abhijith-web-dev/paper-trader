# Deployment & Self-Hosting Guide: GlobalTrade Simulator

## 1. Local Development Mode

Start all services locally using pnpm:
```bash
# 1. Install dependencies
pnpm install

# 2. Build packages
pnpm -r run build

# 3. Start Market Worker (Port 4001)
pnpm --filter @globaltrade/market-worker dev

# 4. Start Core API (Port 4000)
pnpm --filter @globaltrade/api dev

# 5. Start Frontend (Port 5173)
pnpm --filter @globaltrade/web dev
```

## 2. Docker & Docker Compose Production Deployment

Build and orchestrate the unified container stack:
```bash
docker compose up -d --build
```

### Services Initialized:
1. `web`: Nginx serving the compiled React 19 application on port 80.
2. `api`: Node.js Fastify API server on port 4000.
3. `market-worker`: Market data ingestion engine on port 4001.

## 3. Environment Variables Configuration

Copy `.env.example` to `.env`:
```env
PORT=4000
MARKET_WORKER_PORT=4001
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```
