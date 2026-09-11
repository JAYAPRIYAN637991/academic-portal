# ========================================================
# VSB Engineering College Academic Portal - Multi-Stage Dockerfile
# Production-ready container image with zero-root security
# ========================================================

# --- Stage 1: Build Frontend (Vite / React / TypeScript) ---
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --silent
COPY client/ ./
RUN npm run build

# --- Stage 2: Build Backend (Express / Prisma / TypeScript) ---
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --silent
COPY server/ ./
RUN npx prisma generate
RUN npm run build

# --- Stage 3: Production Runtime ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install OpenSSL for Prisma engine compatibility on Alpine
RUN apk add --no-cache openssl

# Create non-root system user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy Server Dependencies and Compiled Output
COPY --from=server-builder /app/server/package*.json ./server/
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/prisma ./server/prisma

# Copy Compiled Frontend Assets into client/dist
COPY --from=client-builder /app/client/dist ./client/dist

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app
USER appuser

WORKDIR /app/server
EXPOSE 5000

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/health || exit 1

CMD ["npm", "run", "start:prod"]
