#!/usr/bin/env bash
# 一条命令：构建前端 → 起单服务（Fastify 托管 web/dist + 全部案例 API），把全部案例串起来。
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
(cd "$DIR/web" && npm ci --silent && npm run build)
(cd "$DIR/server" && npm ci --silent && exec node --experimental-sqlite app.ts)
