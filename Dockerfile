# =====================================================================
# Frontend Dockerfile (multi-stage)
# Builds the Vite SPA and serves it as static files via the Node API,
# OR can be served standalone behind Nginx (see docker-compose.prod.yml).
# =====================================================================

# ---- Stage 1: build ----
FROM node:20-alpine AS builder
WORKDIR /app

# Use bun if lockfile present, else npm
COPY package.json bun.lock* package-lock.json* ./
RUN if [ -f bun.lock ]; then \
      npm install -g bun && bun install --frozen-lockfile; \
    else \
      npm ci; \
    fi

COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Stage 2: runtime (static via nginx) ----
FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
