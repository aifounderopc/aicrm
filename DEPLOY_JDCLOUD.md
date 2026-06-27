# JoyMarketing CRM — 京东云部署指南

两种部署形态，按团队成熟度选：
- **方案 A：单台云主机 + docker-compose**（最快上线，含自托管 PostgreSQL）
- **方案 B：容器服务 + RDS/Redis/OSS**（生产推荐，托管中间件、可弹性伸缩）

构建产物：`Dockerfile`（前端 Nginx）、`server/Dockerfile`（后端）、`docker-compose.yml`、`nginx.conf`。

---

## 一、准备（两方案通用）

1. **域名 + 备案**：面向公网必须 ICP 备案；准备 `crm.yourdomain.com`。
2. **HTTPS 证书**：京东云「SSL 证书服务」签发，或上传已有证书。
3. **生成密钥**（务必用强随机，勿提交仓库）：
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # FIELD_ENC_KEY (32字节)
   ```
4. 复制 `.env.deploy.example` → `.env`，填写上面密钥、`DB_PASSWORD`、`CORS_ORIGINS=https://crm.yourdomain.com`、`COOKIE_SECURE=true`。

---

## 方案 A：单台云主机 + docker-compose（快速上线）

适合试运行 / 小规模。京东云「云主机 ECS」一台（建议 2C4G 起）+ 安装 Docker。

```bash
# 1. 云主机安装 docker / compose（Ubuntu 示例）
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker

# 2. 拉代码、配置
git clone <你的仓库> && cd ai-crm
cp .env.deploy.example .env && vim .env   # 填密钥/密码/域名，首次 SEED_ON_START=true

# 3. 构建并启动（db + api + web）
docker compose up -d --build

# 4. 查看日志，确认迁移与启动
docker compose logs -f api    # 应看到 prisma migrate deploy + “API 已启动”
```

- 前端在 80 端口；用京东云「负载均衡 SLB」或 Nginx 终止 HTTPS 后回源到 :80。
- 首次起来后，把 `.env` 的 `SEED_ON_START` 改回 `false`，`docker compose up -d` 重启 api。
- **首登强制改密**：种子账号 `must_change_pwd=true`，登录后引导改密（前端可后续加强制改密页）。

> 安全组：只放行 80/443，**不要**对公网开放 5432。

---

## 方案 B：京东云容器服务 + 托管中间件（生产推荐）

### 1. 中间件
- **RDS for PostgreSQL**：建实例 + 库 `joycrm`，记下私网连接串。
- **Redis**（可选，后续刷新令牌/黑名单/登录计数用）。
- **OSS**：举证截图/合同文件桶（私有读写 + 直传签名）。
- **KMS**：托管 `FIELD_ENC_KEY` 的信封加密密钥。

### 2. 镜像仓库（京东云 容器镜像服务 CR）
```bash
# 登录 CR
docker login <your-registry>.jcr.service.jdcloud.com -u <user>
# 构建并推送（在项目根目录）
docker build -t <registry>/joycrm-web:1.0 .
docker build -t <registry>/joycrm-api:1.0 ./server
docker push <registry>/joycrm-web:1.0
docker push <registry>/joycrm-api:1.0
```

### 3. 数据库迁移（首次）
在一台能连 RDS 的机器执行（或用 api 镜像跑一次性 Job）：
```bash
DATABASE_URL="postgresql://user:pwd@<rds-host>:5432/joycrm" npx prisma migrate deploy
# 写初始管理员（仅首次）
DATABASE_URL=... node dist/prisma/seed.js
```

### 4. 部署到容器服务（JCS / K8s）
- **api Deployment**：镜像 `joycrm-api`，环境变量 `DATABASE_URL`(指 RDS)、`JWT_SECRET`、`FIELD_ENC_KEY`、`CORS_ORIGINS`、`COOKIE_SECURE=true`、`NODE_ENV=production`；副本 ≥2；健康检查 `GET /api/health`。
- **web Deployment**：镜像 `joycrm-web`；`nginx.conf` 里 `proxy_pass http://api:3000` 改为 api 的 Service 名/地址。
- **Service + Ingress/SLB**：web 暴露 80，前面挂 **SLB + HTTPS 证书**；**WAF** 接在入口。
- 密钥用 **K8s Secret / 京东云密钥管理** 注入，不写进镜像。

### 5. 定时任务（保护期自动释放）
当前内置在 api 进程里（每小时跑）。多副本会重复执行——生产建议二选一：
- 用京东云「定时任务/EventBridge」定时调用一个受保护的内部接口触发 `runAutoRelease`；或
- 单独跑一个单副本 CronJob 容器执行释放逻辑。
（多副本下先把 api 内置定时器关掉，避免重复释放。）

---

## 二、上线后验收（对应 LAUNCH_CHECKLIST.md 第七节）
- [ ] 两个销售账号互不可见对方商机
- [ ] 同名客户报备被服务端撞单拦截
- [ ] 渠道账号看不到内部字段（阶段/报备人）
- [ ] 子管理员越权被拒（渠道管理员不能管销售账号）
- [ ] 改 localStorage / 直接打接口无法越权
- [ ] 保护期到期次日自动释放
- [ ] 联系人非授权角色看不到明文
- [ ] HTTPS 生效、cookie 为 httpOnly+Secure
- [ ] 登录失败限频生效

## 三、运维
- **备份**：RDS 自动备份 + 定期恢复演练；OSS 版本化。
- **监控告警**：云监控接口错误率/延迟、异常登录、慢查询。
- **日志**：操作审计在 `operation_logs` 表；应用日志接日志服务。
- **回滚**：镜像打版本 tag，出问题切回上一个 tag。

---

### 速记：最小上线路径
1. 备案域名 + HTTPS 证书
2. 建 RDS、生成密钥、填 `.env`
3. 推镜像 → `prisma migrate deploy` → 部署 api + web
4. SLB+HTTPS+WAF 接入口
5. 跑验收清单 → 灰度 → 全量
