# Deploying GFL Inventory to Coolify (Docker / VPS)

Pattern matches Mutale’s Coolify setup: one container, Coolify MySQL, env vars in the Coolify UI.

## Architecture

One Docker container serves everything on **port 4000**:

- React SPA from `dist/` (built inside the image)
- Express API at `/api/*`
- Public branch intake at `/intake`
- Uploads at `/uploads/*` (persisted volume)

MySQL runs as a **separate Coolify database resource**. The app connects via `DATABASE_URL` or `DB_*`.

```
Browser → Coolify proxy (TLS) → gfl-inventory container :4000 → Coolify MySQL
                                      ↓
                              volume: gfl_inventory_uploads → /app/uploads
```

---

## Prerequisites

- Coolify on a VPS
- Git repo connected to Coolify (branch you deploy from, e.g. `main`)
- Coolify can auto-generate a HTTPS URL for first deploy

---

## Step 1 — MySQL in Coolify

1. Coolify → **+ New** → **Database** → **MySQL**
2. After it is up, copy **internal** connection details:
   - Host (e.g. `mysql-xxxxx` — **not** the public IP)
   - Port `3306`
   - User / password
   - Database name: usually `default`

> **Important:** From inside Docker, use Coolify’s **internal** hostname for `DB_HOST`. Public IPs often fail from the app network.

Preflight (with env exported):

```bash
node scripts/coolify-preflight.mjs --test-db
```

---

## Step 2 — Docker Compose application

1. Coolify → **+ New** → **Docker Compose**
2. Connect the GFL Inventory Git repo
3. Compose file: `docker-compose.yml`
4. Service name: **`gfl-inventory`** (must match compose)

---

## Step 3 — Environment variables (Coolify UI only)

Copy from [`.env.coolify.example`](.env.coolify.example) into Coolify → **Environment Variables**.

**Do not** put secrets in `docker-compose.yml`.

| Variable | Value |
|---|---|
| `DB_HOST` | Internal MySQL hostname |
| `DB_PORT` | `3306` |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | `default` (or your database name) |
| `DATABASE_URL` | Optional single URL (overrides `DB_*` if set) |
| `APP_URL` | Coolify URL (no trailing slash) |
| `CORS_ORIGINS` | Same as `APP_URL` |
| `TRUST_PROXY` | `1` |
| `AUTH_TOKEN_SECRET` | Random 64-char hex |
| `DEFAULT_ADMIN_EMAIL` | First-boot admin (if DB empty) |
| `DEFAULT_ADMIN_PASSWORD` | Strong password (not `admin123`) |
| `DEFAULT_ADMIN_NAME` | Admin display name |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

After first deploy, set `APP_URL` + `CORS_ORIGINS` to the Coolify **Links** URL exactly, then **Redeploy**.

System settings (company name, intake form) are stored in the database after first boot — configure at `/admin/settings`.

---

## Step 4 — Volume and domain

1. Volume `gfl_inventory_uploads` → `/app/uploads` (in compose)
2. Domain: Coolify URL or custom domain
3. Proxy → container port **4000**

---

## Step 5 — Deploy

```bash
npm run deploy:coolify:check
# Optional full local build (~2 GB RAM):
npm run deploy:coolify:check:build
```

In Coolify: **Deploy**. First build usually 5–10 minutes.

Verify:

```bash
export APP_URL=https://your-coolify-generated-url.example.com
npm run deploy:coolify:verify
```

Expect:

- `/api/health` → `ok: true`
- `/api/db-test` → database connected
- `/` and `/admin/login` → SPA
- `/intake` → public branch equipment form

---

## Step 6 — Post-deploy check

```bash
docker ps | grep gfl-inventory
APP_URL=https://your-url bash scripts/coolify-postdeploy.sh <container>
```

Schema, branches, brands, product types, and default admin bootstrap run on container start if the DB needs them.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Build OOM during `vite build` | Dockerfile caps heap at 1.5 GB; VPS ≥2 GB RAM |
| `vite: command not found` | Build stage uses `npm ci --include=dev` — redeploy |
| CORS errors | `APP_URL` / `CORS_ORIGINS` must match the browser URL |
| 502 / unhealthy | Logs + internal `DB_HOST`; check `/api/health` |
| `AUTH_TOKEN_SECRET must be set` | Set in Coolify env and redeploy |
| Uploads missing after redeploy | Confirm `gfl_inventory_uploads` volume on `/app/uploads` |
| DB works from laptop, not from app | Switch `DB_HOST` from public IP to Coolify **internal** hostname |

---

## Local Docker test (optional)

```bash
docker compose build
# Uncomment ports in docker-compose.yml, then:
docker compose up
```

Local dev (without Docker) remains:

```bash
npm run server:dev   # API on :4000
npm run dev          # Vite on :5173
```
