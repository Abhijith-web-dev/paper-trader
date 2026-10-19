# Multi-stage production build for GlobalTrade Simulator
FROM node:22-alpine AS base
RUN npm install -g pnpm@11.9.0
WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/

RUN pnpm install --frozen-lockfile || pnpm install
RUN pnpm -r run build

# Web server stage
FROM nginx:alpine AS web
COPY --from=base /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# API server stage
FROM node:22-alpine AS api
WORKDIR /app
COPY --from=base /app ./
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]

# Market Worker stage
FROM node:22-alpine AS market-worker
WORKDIR /app
COPY --from=base /app ./
EXPOSE 4001
CMD ["node", "apps/market-worker/dist/worker.js"]
