# NODE TEMPLATE

Full-stack admin starter extracted from the [Mutale-coolify](https://github.com) architecture. Use it as a base for new Node/React projects that need the same UI/UX, auth, and RBAC patterns — without domain-specific features (events, shop, payments, etc.).

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | Express 5, MySQL (`mysql2`), custom JWT + PBKDF2 |
| Frontend | React 19, Vite 8, React Router 7 |
| Styling | Tailwind CSS v4, custom design tokens (`src/index.css`) |
| Icons | Lucide React |

## Folder map

```
NODE TEMPLATE/
├── server/                 # Express API
│   ├── index.js            # Boot, middleware, static SPA (prod)
│   ├── db.js               # MySQL pool
│   ├── schema.js           # ensureSchema + admin seed
│   ├── auth.js             # JWT + password hashing
│   ├── rbacService.js      # RBAC tables + permissions
│   └── routes/             # health, auth, admin
├── shared/
│   └── rbacPermissions.js  # Permission catalog + nav map
├── src/
│   ├── components/ui/      # Design system (Card, DataTable, …)
│   ├── layouts/            # AdminLayout, MainLayout
│   ├── pages/admin/        # Demo admin pages
│   └── context/            # Auth, Theme, Toast
├── TEMPLATE.md             # This file
└── docker-compose.yml
```

## Quick start

### 1. Prerequisites

- Node.js 20+
- MySQL 8+ (create an empty database, e.g. `node_template`)

### 2. Setup

```bash
cd "/Users/majormacs/Projects/NODE TEMPLATE"
cp .env.example .env
# Edit .env — set DB_* and optionally AUTH_TOKEN_SECRET
npm install
```

### 3. Run (development)

Terminal 1 — API:

```bash
npm run server:dev
```

Terminal 2 — frontend:

```bash
npm run dev
```

- Public site: http://localhost:5173
- Admin login: http://localhost:5173/admin/login

### 4. Default admin credentials

From `.env.example` (seeded on first boot if no admin exists):

| Field | Default |
|-------|---------|
| Email | `admin@template.dev` |
| Password | `admin123` |

Change these in production via `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASSWORD`.

## Demo admin pages

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard with KPI cards + demo chart |
| `/admin/items` | DataTable list (demo API data) |
| `/admin/items/new` | FormField demo form |
| `/admin/users` | Live users from MySQL |
| `/admin/settings` | Settings placeholder |
| `/admin/access-control` | RBAC catalog viewer |

## How to add a new admin page

1. **Create the page** in `src/pages/admin/YourPage.jsx` using `PageHeader`, `Card`, and `DataTable`.
2. **Register the route** in `src/App.jsx` under the `/admin` protected layout.
3. **Add a sidebar link** in `src/layouts/AdminLayout.jsx` and map its key in `shared/rbacPermissions.js` → `NAV_PERMISSION_MAP`.

Example nav entry:

```js
{ key: 'reports', name: 'Reports', to: '/admin/reports', icon: BarChart3 }
```

And permission:

```js
// shared/rbacPermissions.js
{ key: 'reports.view', name: 'View reports', group: 'General' }
// NAV_PERMISSION_MAP
reports: 'reports.view',
```

## UI components

Import from `src/components/ui`:

```jsx
import { PageHeader, Card, AdminStatCard, DataTable, FormField, StatusBadge } from '../../components/ui';
```

Patterns match Mutale-coolify:

- **List pages:** `PageHeader` → optional KPI row → `DataTable`
- **Forms:** `PageHeader` → `Card` sections → `FormField` grid → `LoadingButton`
- **Dashboard:** `AdminStatCard` grid → `Card` sections

## Backend extension

1. Add a route module under `server/routes/`.
2. Register it in `server/index.js` with `app.use('/api/admin', ...)`.
3. Add permission mapping in `server/rbacService.js` → `resolveRouteAdminPermission`.

Demo stats endpoint (already included):

```
GET /api/admin/dashboard/stats
```

Returns demo KPIs; `users` count is live from MySQL.

## Auth & RBAC

- **Login:** `POST /api/auth/login` → JWT (7-day expiry) + user session
- **Admin routes:** Bearer token in `Authorization` header
- **RBAC:** Sidebar items filtered by `hasPermission()` from `AuthContext`
- **Roles:** Seeded on boot (`super_admin`, `content_manager`, `viewer`)

Storage keys (same as Mutale):

- `mm_admin_token` — JWT
- `mm_auth_session` — admin session metadata

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DB_*` | MySQL connection |
| `PORT` | API port (default 4000) |
| `AUTH_TOKEN_SECRET` | JWT signing (required in production) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `APP_URL` | Public app URL |
| `DEFAULT_ADMIN_*` | First admin seed |

## Production build

```bash
npm run build
NODE_ENV=production npm start
```

Express serves `dist/` + `/api` on one port (same as Mutale-coolify).

## Docker

```bash
docker compose up --build
```

Configure `DB_*` and secrets via Coolify/host env — MySQL is expected as an external service.

## Relationship to Mutale-coolify

This template preserves:

- Admin shell (navy sidebar, cyan accents, dark mode)
- UI component library
- JWT + RBAC auth flow
- Single-container deploy model

It omits: events, blog, shop, payments, certificates, Zoom/Daily, TipTap, PDF generation, and other domain modules.

For full deployment guides (Coolify, cPanel), refer to the Mutale-coolify `DEPLOY_COOLIFY.md` and `DEPLOY_CPANEL.md` — the runtime model is identical.
