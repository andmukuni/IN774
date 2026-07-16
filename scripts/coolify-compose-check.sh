#!/usr/bin/env bash
set -euo pipefail

# Validate docker-compose.yml and optionally build the image locally.
# Usage: bash scripts/coolify-compose-check.sh [--build]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Checking Coolify Docker Compose setup..."
echo ""

for f in Dockerfile docker-compose.yml .dockerignore DEPLOY_COOLIFY.md; do
  if [ -f "$f" ]; then
    echo "  OK    $f exists"
  else
    echo "  FAIL  $f missing" >&2
    exit 1
  fi
done

if grep -q 'gfl-inventory:' docker-compose.yml; then
  echo "  OK    service name is gfl-inventory"
else
  echo "  FAIL  docker-compose.yml must define service 'gfl-inventory'" >&2
  exit 1
fi

if grep -q 'gfl_inventory_uploads:/app/uploads' docker-compose.yml; then
  echo "  OK    gfl_inventory_uploads volume mounted at /app/uploads"
else
  echo "  FAIL  uploads volume not configured" >&2
  exit 1
fi

if grep -q '"4000"' docker-compose.yml; then
  echo "  OK    port 4000 exposed"
else
  echo "  WARN  port 4000 not found in compose" >&2
fi

if grep -q 'HEALTHCHECK' Dockerfile && grep -q '/api/health' Dockerfile; then
  echo "  OK    Dockerfile healthcheck on /api/health"
else
  echo "  WARN  Dockerfile healthcheck missing" >&2
fi

if command -v docker >/dev/null 2>&1; then
  echo ""
  echo "Docker available — validating compose config..."
  docker compose config -q
  echo "  OK    docker compose config valid"

  if [ "${1:-}" = "--build" ]; then
    echo ""
    echo "Building image (this may take several minutes)..."
    docker compose build
    echo "  OK    docker compose build succeeded"
  fi
else
  echo ""
  echo "  SKIP  Docker not installed locally — compose file validated manually"
  echo "        Coolify server will run the build on deploy"
fi

echo ""
echo "Compose check passed."
