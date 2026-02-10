# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_EMBEDDED_WEBAPP_URL
ARG NEXT_PUBLIC_WEBAPP_ENVIRONMENT
ARG NEXT_PUBLIC_USAGE_DASHBOARD_ID
ARG NEXT_PUBLIC_USAGE_DASHBOARD_DOMAIN
ARG NEXT_PUBLIC_PENDO_API_KEY

ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_EMBEDDED_WEBAPP_URL=$NEXT_PUBLIC_EMBEDDED_WEBAPP_URL
ENV NEXT_PUBLIC_WEBAPP_ENVIRONMENT=$NEXT_PUBLIC_WEBAPP_ENVIRONMENT
ENV NEXT_PUBLIC_USAGE_DASHBOARD_ID=$NEXT_PUBLIC_USAGE_DASHBOARD_ID
ENV NEXT_PUBLIC_USAGE_DASHBOARD_DOMAIN=$NEXT_PUBLIC_USAGE_DASHBOARD_DOMAIN
ENV NEXT_PUBLIC_PENDO_API_KEY=$NEXT_PUBLIC_PENDO_API_KEY

RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# copying only relevant files from the previous build stage. 
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./ 
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
