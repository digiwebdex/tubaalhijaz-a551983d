# =====================================================================
# Backend Dockerfile (Node.js / Express API)
# =====================================================================
FROM node:20-alpine AS deps
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4002

# Create non-root user
RUN addgroup -S app && adduser -S app -G app

COPY --from=deps /app/node_modules ./node_modules
COPY server/ ./
RUN mkdir -p /app/uploads /app/logs && chown -R app:app /app

USER app
EXPOSE 4002
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:4002/api/health || exit 1
CMD ["node", "index.js"]
