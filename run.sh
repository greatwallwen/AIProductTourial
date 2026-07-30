#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
MODE="${1:-prod}"

cd "$ROOT/code"

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "Node.js 24 or newer is required." >&2
  exit 1
fi

if [ ! -f node_modules/next/package.json ]; then
  npm ci --ignore-scripts --no-audit --no-fund
fi

case "$MODE" in
  dev)
    npm run dev
    ;;
  rebuild)
    npm run build
    npm run start
    ;;
  prod)
    if [ ! -f app/.next/BUILD_ID ]; then
      npm run build
    fi
    npm run start
    ;;
  *)
    echo "Usage: ./run.sh [prod|dev|rebuild]" >&2
    exit 2
    ;;
esac

