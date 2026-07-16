#!/usr/bin/env bash
set -euo pipefail

# Verify DB connectivity inside the running Coolify container.
# Usage: bash scripts/coolify-seed.sh [container_name_or_id]

CONTAINER="${1:-}"
if [ -z "$CONTAINER" ]; then
  CONTAINER=$(docker ps --format '{{.Names}}' | grep -iE 'gfl-inventory|gfl_inventory|formgfl' | head -1 || true)
fi

if [ -z "$CONTAINER" ]; then
  echo "No GFL Inventory container found. Usage: bash scripts/coolify-seed.sh <container>" >&2
  echo "Running containers:" >&2
  docker ps --format 'table {{.Names}}\t{{.Status}}' >&2
  exit 1
fi

echo "Using container: $CONTAINER"
echo ""

echo "→ DB connectivity"
docker exec "$CONTAINER" node -e "
import pool, { testConnection } from './server/db.js';
const info = await testConnection();
console.log('Connected:', info);
const [[{ users }]] = await pool.query('SELECT COUNT(*) AS users FROM users');
const [[{ branches }]] = await pool.query('SELECT COUNT(*) AS branches FROM branches');
const [[{ products }]] = await pool.query('SELECT COUNT(*) AS products FROM products');
console.log('Users:', users, '| Branches:', branches, '| Products:', products);
await pool.end();
"

echo ""
echo "Schema/bootstrap runs automatically on container start (server/schema.js)."
echo "Done. Log in at /admin/login with DEFAULT_ADMIN_* from Coolify env."
