#!/bin/sh
set -e
echo "[entrypoint] 等待数据库并应用迁移…"
# 生产用 migrate deploy（只应用已生成的迁移，不改 schema）
npx prisma migrate deploy
# 首次部署可选：写入初始管理员（幂等 upsert）。设 SEED_ON_START=true 启用
if [ "$SEED_ON_START" = "true" ]; then
  echo "[entrypoint] 执行种子…"
  node dist/prisma/seed.js || echo "[entrypoint] 种子执行失败/跳过"
fi
echo "[entrypoint] 启动服务…"
exec node dist/src/index.js
