#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v go >/dev/null 2>&1; then
  echo "Go is required. Install from https://go.dev/dl/ or: brew install go"
  exit 1
fi

go mod tidy
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o GFLPresence.exe .

echo "Built agent/GFLPresence.exe ($(du -h GFLPresence.exe | cut -f1))"
