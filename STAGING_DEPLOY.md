# JoyMarketing CRM — 预发环境部署说明

预发环境用于在生产发布前做业务验收。当前建议先复用同一台京东云 ECS，用独立目录、独立数据库 volume 和独立端口隔离生产。

当前预发主库为 MySQL 8；历史 PostgreSQL 数据卷仅在迁移和回滚窗口内由 `legacy-db` 挂载，不对外开放端口。首次迁移完成后，迁移脚本检测到 MySQL 已有租户数据会自动跳过重复导入。

## 环境划分

| 环境 | 分支 | 服务器目录 | 访问地址 | Compose 项目名 |
| --- | --- | --- | --- | --- |
| 生产 | `main` | `/opt/aicrm` | `http://117.72.47.155` | `aicrm` |
| 预发 | `staging` | `/opt/aicrm-staging` | `http://117.72.47.155:8080` | `aicrm-staging` |

## 一次性搭建

```bash
cd /opt
git clone https://github.com/aifounderopc/aicrm.git aicrm-staging
cd /opt/aicrm-staging
git checkout -b staging origin/main

cp .env.staging.example .env.staging
vim .env.staging
```

需要在 `.env.staging` 中重点修改：

```bash
DB_PASSWORD=预发数据库强密码
JWT_SECRET=随机生成的长密钥
FIELD_ENC_KEY=64位hex密钥
CORS_ORIGINS=http://117.72.47.155:8080
COOKIE_SECURE=false
SEED_ON_START=true
WEB_PORT=8080
```

生成密钥：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

启动预发：

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml -p aicrm-staging up -d --build
docker compose --env-file .env.staging -f docker-compose.staging.yml -p aicrm-staging logs -f api
```

首次种子数据写入成功后，将 `.env.staging` 改为：

```bash
SEED_ON_START=false
```

然后重启：

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml -p aicrm-staging up -d
```

## 日常发布流程

本地开发完成后：

```bash
git checkout staging
git merge main
git push origin staging
```

服务器部署预发：

```bash
cd /opt/aicrm-staging
git fetch origin
git checkout staging
git pull --ff-only origin staging
docker compose --env-file .env.staging -f docker-compose.staging.yml -p aicrm-staging up -d --build
```

验证通过后再发布生产：

```bash
git checkout main
git merge staging
git push origin main
```

## 验收清单

- 可以登录预发环境
- 报备商机成功
- 撞单拦截生效
- 商机详情页字段、联系人权限、举证截图正常
- 渠道账号和直客销售账号权限隔离正常
- 管理后台核心操作正常
- API 健康检查正常

```bash
curl http://117.72.47.155:8080/api/health
```

## 常用运维命令

```bash
# 查看容器
docker compose --env-file .env.staging -f docker-compose.staging.yml -p aicrm-staging ps

# 查看日志
docker compose --env-file .env.staging -f docker-compose.staging.yml -p aicrm-staging logs -f api
docker compose --env-file .env.staging -f docker-compose.staging.yml -p aicrm-staging logs -f web

# 停止预发
docker compose --env-file .env.staging -f docker-compose.staging.yml -p aicrm-staging down

# 删除预发数据库 volume，仅在确认不要数据时执行
docker compose --env-file .env.staging -f docker-compose.staging.yml -p aicrm-staging down -v
```

## 注意事项

- 预发和生产必须使用不同的 `DB_PASSWORD`、`JWT_SECRET`、`FIELD_ENC_KEY`。
- 预发不要直接使用生产数据库。
- MySQL 使用 `utf8mb4` 字符集；迁移确认和回滚窗口结束前，不要删除 `pgdata_staging` 历史卷和迁移前 SQL 备份。
- 若京东云安全组未放行 `8080`，需要在控制台允许入站 TCP `8080`。
- 后续绑定域名后，可以把预发切到 `https://staging.yourdomain.com`，同时将 `COOKIE_SECURE=true`。
