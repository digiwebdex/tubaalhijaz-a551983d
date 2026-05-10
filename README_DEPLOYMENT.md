# Tuba Al Hijaz — VPS Deployment Guide

**Production domain:** https://tubaalhijaz.com (and www.)
**VPS:** Hostinger KVM @ `187.77.144.38`
**Isolated path:** `/var/www/tubaalhijaz` — never touch any other site.

---

## Stack (auto-detected)

| Layer    | Tech                                      |
|----------|-------------------------------------------|
| Frontend | React 18 + Vite + Tailwind + shadcn       |
| Backend  | Node.js + Express (`/server/index.js`)    |
| DB       | Self-hosted PostgreSQL (local socket/TCP) |
| Process  | PM2 (`tubaalhijaz-api`, port `4002`)      |
| Web      | Nginx + Certbot Let's Encrypt SSL         |

### Lovable / Supabase dependency status
- **Lovable hosting:** none. The build runs entirely on the VPS.
- **Supabase SDK:** `@supabase/supabase-js` is still in `package.json`, but `migration/migrate.sh` rewrites `src/integrations/supabase/client.ts` to re-export the **local** `@/lib/api` bridge before `npm run build`. After build, no request goes to `*.supabase.co`. The bridge has a legacy `functions` fallback that would attempt `https://<id>.supabase.co/functions/...` only if `/api/functions/<name>` returns 404 — keep all required edge functions migrated into `server/routes/` (already done for the live ones).
- **Supabase env vars:** the `VITE_SUPABASE_*` vars in `.env.example` are placeholders only; nothing reads them at runtime after migration.

---

## Admin panel

- **URL:** `https://tubaalhijaz.com/auth` (login) → `/admin` (dashboard)
- **Initial credentials:** seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `server/.env` on first migration. Change immediately after first login from **Admin → Settings → Password**.
- **Editable from admin panel** (already wired):
  CMS pages (Home / About / Privacy / Terms / Refund), Hero banners, Services, Packages, Hotels & galleries, Catering plans, Transport orders, Umrah orders, Testimonials, FAQ, Gallery (images + videos), Footer + contact info, SEO metadata, Menu visibility, Section visibility, Currency rates, PDF/invoice settings, Signature, Notification (SMS/email) settings, Wallets / Payment methods, Users & roles, Backups.

---

## Forms connected to backend

| Form                            | Endpoint                       | Stored in            |
|--------------------------------- |------------------------------- |--------------------- |
| Contact form (`ContactSection`) | `POST /api/contact`            | `contact_messages`   |
| Umrah order (`UmrahOrderDialog`)| `POST /api/umrah_orders`       | `umrah_orders`       |
| Catering order                  | `POST /api/catering_orders`    | `catering_orders`    |
| Transport order                 | `POST /api/transport_orders`   | `transport_orders`   |
| Booking (multi-step)            | `POST /api/bookings`           | `bookings`           |
| Customer OTP login              | `POST /api/auth/otp/{send,verify}` | `otp_codes` / `users` |

Each writes to PostgreSQL, fires the notification worker (SMS via BulkSMS BD, email via Resend if configured), and shows success/error toasts.

---

## Automation workflow checklist

- [x] Booking created → SMS + email to customer + admin (BulkSMS BD / Resend)
- [x] Payment completed → wallet balance trigger + ledger entry + receipt SMS
- [x] Daily due reminders → `server/services/dueReminder.js` cron
- [x] Daily summary SMS to admin → `server/services/` cron
- [x] Database backup → `server/backup-to-gdrive.sh` (cron suggested daily 03:00)
- [x] Online payment IPN → `POST /api/sslcommerz/ipn` (validates `val_id`)
- [x] Status change → SMS + email
- [ ] WhatsApp Cloud API → not configured (frontend uses `wa.me/<WHATSAPP_NUMBER>` deeplink)

---

# Deployment — Step by Step

> Run the **PowerShell** block locally, then everything below it on the VPS.

## Step 1 — Connect from Windows PowerShell

```powershell
ssh <YOUR_SSH_USER>@187.77.144.38
```

## Step 2 — Pre-migration inspection (READ-ONLY, safe to run)

```bash
ls -la /var/www
pm2 list || true
sudo ss -tulpen | grep -E ':(80|443|4002|5432)' || echo "key ports clean"
sudo ss -tulpen | grep ':4002' || echo "Port 4002 is FREE"
ls -la /etc/nginx/sites-enabled
sudo grep -R "tubaalhijaz" /etc/nginx/sites-available /etc/nginx/sites-enabled || echo "no existing tubaalhijaz nginx"
sudo systemctl status postgresql --no-pager | head -5
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='tubaalhijaz_db';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles    WHERE rolname='tubaalhijaz_user';"
node -v && npm -v && pm2 -v
```

**Decision rules:**
- If `Port 4002 is FREE` → keep `PORT=4002`. Otherwise edit `ecosystem.config.cjs` + nginx + `server/.env` to `4003` (or next free).
- If `tubaalhijaz_db` exists and is NOT yours → use `tubaalhijaz_db_new`.
- If `tubaalhijaz_user` exists and is NOT yours → use `tubaalhijaz_user_new`.
- If a PM2 process named `tubaalhijaz-api` exists from another user → rename to `tubaalhijaz-web`.

## Step 3 — Install server packages (skip any already installed)

```bash
sudo apt update
sudo apt install -y nginx postgresql postgresql-contrib certbot python3-certbot-nginx git curl
# Node 20 if not present:
node -v || (curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs)
sudo npm i -g pm2
```

## Step 4 — Create isolated project directory

```bash
sudo mkdir -p /var/www/tubaalhijaz
sudo chown -R $USER:$USER /var/www/tubaalhijaz
cd /var/www/tubaalhijaz
```

## Step 5 — Clone the repo

```bash
git clone https://github.com/digiwebdex/tubaalhijaz.git .
mkdir -p logs server/uploads
```

## Step 6 — Create database & user

```bash
sudo -u postgres psql <<SQL
CREATE USER tubaalhijaz_user WITH PASSWORD '<YOUR_DB_PASSWORD>';
CREATE DATABASE tubaalhijaz_db OWNER tubaalhijaz_user;
GRANT ALL PRIVILEGES ON DATABASE tubaalhijaz_db TO tubaalhijaz_user;
SQL

sudo -u postgres psql -d tubaalhijaz_db -f server/schema.sql
```

## Step 7 — Backend `.env`

```bash
cp server/.env.tubaalhijaz.example server/.env
nano server/.env       # fill in DATABASE_URL (URL-encode the password!),
                       # JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, SMS/email keys
```

## Step 8 — Frontend `.env` + Supabase-client swap + build

```bash
cd /var/www/tubaalhijaz
cp .env.example .env
echo "VITE_API_URL=/api" > .env

# Replace the Supabase client with the local API bridge (idempotent):
cat > src/integrations/supabase/client.ts <<'EOF'
// Production: re-exports the self-hosted API bridge.
export { supabase } from "../../lib/api";
EOF

npm install --no-audit --no-fund
npm run build
```

## Step 9 — Backend deps & start with PM2

```bash
cd /var/www/tubaalhijaz/server && npm install --no-audit --no-fund
cd /var/www/tubaalhijaz
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u $USER --hp $HOME    # run the printed sudo command
```

Verify: `curl -s http://127.0.0.1:4002/api/health` → should return JSON.

## Step 10 — Nginx (HTTP first, for Certbot)

```bash
sudo cp /var/www/tubaalhijaz/nginx/tubaalhijaz.com.conf.example /etc/nginx/sites-available/tubaalhijaz.com
# Temporarily strip the SSL server block so port 80 works for ACME:
sudo sed -i '/listen 443 ssl/,/^}/d' /etc/nginx/sites-available/tubaalhijaz.com
sudo ln -sf /etc/nginx/sites-available/tubaalhijaz.com /etc/nginx/sites-enabled/tubaalhijaz.com
sudo nginx -t && sudo systemctl reload nginx
```

## Step 11 — Issue SSL certificates

> Cloudflare proxy (orange cloud) is ON. If `--nginx` fails with HTTP-01,
> set both A records to **DNS only** (grey cloud) for ~5 min, run Certbot,
> then switch back to **Proxied**.

```bash
sudo certbot --nginx -d tubaalhijaz.com -d www.tubaalhijaz.com \
  --non-interactive --agree-tos -m admin@tubaalhijaz.com --redirect
```

Then restore the full Nginx config (with the SSL block) and reload:

```bash
sudo cp /var/www/tubaalhijaz/nginx/tubaalhijaz.com.conf.example /etc/nginx/sites-available/tubaalhijaz.com
sudo nginx -t && sudo systemctl reload nginx
```

## Step 12 — Cloudflare SSL/TLS mode

In Cloudflare dashboard → SSL/TLS → Overview → set to **Full (strict)**.
Re-enable the orange cloud on both A records if you greyed them out.

## Step 13 — Smoke tests

```bash
curl -I https://tubaalhijaz.com               # 200 + HTML
curl -I https://www.tubaalhijaz.com           # 200 + HTML
curl -s https://tubaalhijaz.com/api/health    # {"ok":true,...}
```

In a browser:
1. `https://tubaalhijaz.com/` — homepage loads, hero/services/catering/transport/gallery visible
2. `https://tubaalhijaz.com/auth` — sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
3. `https://tubaalhijaz.com/admin` — dashboard loads, edit a CMS section, refresh homepage to confirm
4. Submit the contact form → check it appears in Admin → Notifications/Leads
5. Submit a Catering order → success toast + row in `catering_orders`

## Step 14 — Logs

```bash
pm2 logs tubaalhijaz-api --lines 100
tail -f /var/www/tubaalhijaz/logs/error.log
sudo tail -f /var/log/nginx/error.log
```

## Step 15 — Troubleshooting

| Symptom                       | Fix                                                                 |
|-------------------------------|---------------------------------------------------------------------|
| 502 Bad Gateway               | `pm2 restart tubaalhijaz-api` then check `pm2 logs`                 |
| API 404 for `/api/*`          | Confirm Nginx `proxy_pass` port matches `ecosystem.config.cjs` port |
| DB auth failed                | URL-encode the password in `DATABASE_URL`                           |
| Certbot HTTP-01 fails         | Grey-cloud the Cloudflare A records, retry, then re-orange them     |
| Admin can't log in            | Re-seed: `node server/migrate-from-supabase.js --admin-only` or reset password directly in DB with `bcryptjs` |

## Step 16 — Rollback

```bash
cd /var/www/tubaalhijaz
git log --oneline -10
git checkout <previous-good-sha>
npm install && npm run build
cd server && npm install
pm2 restart tubaalhijaz-api
```

To fully remove (only if you really want to):
```bash
pm2 delete tubaalhijaz-api && pm2 save
sudo rm /etc/nginx/sites-enabled/tubaalhijaz.com /etc/nginx/sites-available/tubaalhijaz.com
sudo nginx -t && sudo systemctl reload nginx
sudo -u postgres psql -c "DROP DATABASE tubaalhijaz_db;"
sudo -u postgres psql -c "DROP USER tubaalhijaz_user;"
sudo rm -rf /var/www/tubaalhijaz
```

---

## Final deployment checklist

- [ ] Step 2 inspection completed; chosen port = `4002` (or alt)
- [ ] `/var/www/tubaalhijaz` exists and is owned by deploy user only
- [ ] `server/.env` has real `DATABASE_URL`, `JWT_SECRET`, `ADMIN_*`
- [ ] `npm run build` succeeded → `dist/` exists
- [ ] `pm2 status` shows `tubaalhijaz-api` online
- [ ] `nginx -t` passes; only `tubaalhijaz.com` symlink added
- [ ] HTTPS works on both apex + www
- [ ] Cloudflare SSL/TLS mode = Full (strict)
- [ ] Admin login works and CMS edits reflect on the live site
- [ ] At least one form submission lands in the database
