#!/usr/bin/env bash
set -euo pipefail

# Post-deploy workflow for Coolify — GFL Inventory.
# Usage: APP_URL=https://your-coolify-url bash scripts/coolify-postdeploy.sh [container]

BASE="${APP_URL:-}"
CONTAINER="${1:-}"

if [ -z "$BASE" ]; then
  echo "Usage: APP_URL=https://your-coolify-url bash scripts/coolify-postdeploy.sh [container]" >&2
  exit 2
fi

echo "=== Step 1: Smoke tests ==="
export APP_URL="$BASE"
bash "$(dirname "$0")/verify-coolify-deploy.sh"

echo ""
echo "=== Step 2: DB check ==="
if [ -n "$CONTAINER" ]; then
  bash "$(dirname "$0")/coolify-seed.sh" "$CONTAINER"
else
  bash "$(dirname "$0")/coolify-seed.sh"
fi

echo ""
echo "=== Step 3: Manual checks ==="
echo "  1. Open ${BASE%/}/admin/login"
echo "  2. Log in with DEFAULT_ADMIN_* from Coolify env (or seeded user)"
echo "  3. Confirm dashboard, branches, and products load"
echo "  4. Open ${BASE%/}/intake and test branch equipment form"
echo ""
echo "Post-deploy complete."
