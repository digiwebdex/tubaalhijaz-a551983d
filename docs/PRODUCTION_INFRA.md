# Production Infrastructure Guide

End-to-end reference for deploying Tuba Al Hijaz in production. Covers
both the **classic VPS / PM2** workflow we use today and the new
**Docker Compose** stack.

---

## 1. Stack overview

```
                    ┌──────────────┐
        users ─────▶│   Nginx 443  │── /api/* ───▶ Node API (Express, port 4002)
                    │  (TLS, gzip) │── /uploads/* ▶ local disk / S3
                    └──────┬───────┘── /*        ─▶ Vite SPA (static dist/)
                           │
                           └──── /ws/  ───────────▶ Node API (WebSocket)
                                                   │
                                          ┌────────┴────────┐
                                          │  PostgreSQL 16  │
                                          │  Redis 7 (queues)│
                                          └─────────────────┘
```

---

## 2. Environment configuration

| File | Purpose |
|---|---|
| `.env.example` | Frontend safe defaults |
| `server/.env.example` | Full backend production template |
| `server/.env` | Real secrets (never committed; protected via `git update-index --skip-worktree`) |

Validate before boot:

```bash
node -e "require('./server/config/validateEnv')()"
```

The server also calls this on startup and **exits in production** if any
required variable (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`)
is missing.

---

## 3. Classic VPS (current production)

```bash
# pull, install, build, reload
cd /var/www/tubaalhijaz
git pull
cd server && npm ci --omit=dev && cd ..
npm ci && npm run build
pm2 reload tubaalhijaz-api    # NEVER `pm2 restart all`
```

PM2 process file: [`ecosystem.config.cjs`](../ecosystem.config.cjs)

---

## 4. Docker deployment

### Quick start

```bash
cp server/.env.example server/.env   # edit secrets
cp .env.example .env                 # frontend
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

Containers:

| Service | Port | Notes |
|---|---|---|
| `nginx` | 80/443 | Reverse proxy, SSL, gzip, websockets |
| `web` | 8080 | Vite SPA served by Nginx |
| `api` | 4002 | Express API (health: `/api/health`) |
| `postgres` | 5433 | Persistent volume `postgres_data` |
| `redis` | 6379 | Queue + cache, AOF persistence |

### SSL

Place certs under `nginx/ssl/fullchain.pem` and `nginx/ssl/privkey.pem`
then uncomment the HTTPS block in `nginx/production.conf`. For Let's
Encrypt, Certbot's standalone mode against the `nginx` container or the
host works (see existing memory: VPS Setup → "local Certbot SSL").

---

## 5. Backup & recovery

Automated nightly backups with compression + retention:

```bash
# Manual run
sudo BACKUP_DIR=/var/backups/tubaalhijaz \
     RETENTION_DAYS=14 \
     /var/www/tubaalhijaz/scripts/backup.sh

# Cron (root)
0 2 * * * /var/www/tubaalhijaz/scripts/backup.sh >> /var/log/tubaalhijaz-backup.log 2>&1
```

Restore — **prompts for confirmation** and validates archive integrity:

```bash
sudo /var/www/tubaalhijaz/scripts/restore.sh \
     /var/backups/tubaalhijaz/db/db-20260510-020000.sql.gz \
     /var/backups/tubaalhijaz/uploads/uploads-20260510-020000.tar.gz
```

The script honours the strict table restore order documented in
[Backup System](mem://features/database-backup-system).

---

## 6. Observability

- **Liveness**: `GET /api/health` (no DB hit, always cheap)
- **Readiness**: `GET /api/health/ready` (checks DB + uploads dir)
- **Admin UI**: `/admin/system-health` (auto-refresh every 15s)
- **Structured logs**: enable by adding `app.use(require('./middleware/requestLogger'))`
  in `server/index.js`. Emits one JSON line per request with
  `request_id`, `method`, `path`, `status`, `duration_ms`, `user_id`.
- **Request ID**: every response sets `x-request-id`; Nginx forwards it
  upstream and accepts it from clients for end-to-end tracing.

External monitoring: point UptimeRobot / Pingdom / Grafana Synthetic at
`https://tubaalhijaz.com/api/health` (returns 200) and
`/api/health/ready` (returns 503 if DB is down).

---

## 7. CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`:

1. **Frontend** — install, lint, vitest, `bun run build`
2. **Backend** — spin up Postgres service, `npm ci`, boot the API,
   poll `/api/health` until 200
3. **Docker** — build both images via Buildx (no push)

To enable auto-deploy on tag, add a follow-up job that runs
`ssh deploy@vps "cd /var/www/tubaalhijaz && git pull && pm2 reload tubaalhijaz-api"`
guarded by an `environment: production` GitHub environment.

---

## 8. Security hardening (already shipped)

- `helmet` security headers
- `compression` (gzip)
- `express-rate-limit` — 600/min global, 20/15min on `/api/auth/login`,
  10/10min on `/api/auth/otp`
- `trust proxy = 1` for accurate client IPs behind Nginx
- Global error handler — never leaks stack traces to clients
- `ErrorBoundary` at React root + inside `<Suspense>`

---

## 9. Roadmap (intentionally deferred)

| Item | Status | Why deferred |
|---|---|---|
| Redis-backed BullMQ queue workers | Planned | Requires refactoring `messageDispatcher` + `dueReminder`; do separately to avoid risk to live messaging. |
| Pluggable storage driver (S3/R2/Spaces) | Scaffolded in `STORAGE_DRIVER` env | Implementation lives in a future PR — current local-disk path still works. |
| Multi-tenant org isolation | Future phase | User asked to skip in this slice. |
