# JoyMarketing CRM — 后端服务

Node + TypeScript + Express + Prisma(PostgreSQL)。实现见 `BACKEND_DESIGN.md`。

## 当前进度
已完成（可运行的核心骨架）：
- ✅ 工程脚手架、配置、错误处理、统一 `/api` 前缀
- ✅ **数据模型**（Prisma schema，含敏感字段加密列、飞书连接配置与消息表）
- ✅ **安全基础**：bcrypt 密码哈希、JWT(httpOnly cookie)、AES-256-GCM 字段加密、撞单算法、审计日志、登录限频、helmet/CORS
- ✅ **auth 模块**：login/logout/me/impersonate(代理访问鉴权)/change-password
- ✅ **opportunities 模块**：列表(按角色过滤)/撞单预检/创建(服务端二次撞单+事务+加密)/改阶段(自动锁定)/解密联系人(限角色+审计)
- ✅ 种子脚本

- ✅ **channels 模块**：列表(统计+关联账号)/建渠道(事务+渠道账号+京东经理账号)/改信息/启停(联动账号)/补建账号/删除(有数据拒绝)
- ✅ **users 模块**：列表(销售带统计)/创建(角色越权校验)/更新(改密改邮箱)/启停/删除(有数据拒绝)
- ✅ **notifications 模块**：本人通知/高优事项/标记已读
- ✅ **logs 模块**：只读、分页筛选、限管理类角色
- ✅ **保护期自动释放 + 到期提醒**（`src/jobs/autoRelease.ts`，开发内置定时器，生产换京东云定时任务）
- ✅ **飞书群消息长连接**：官方 SDK WebSocket 接收、凭证鉴权、加密存储、消息幂等入库与按权限查询

- ✅ **续期/举证/进展**：申请续期、批准/拒绝(+30天)、举证审核通过/驳回、进展上报；释放/冻结/删除商机；均带站内通知 + 审计

待补（上线后迭代，非阻断）：
- ⬜ OSS 直传签名、刷新令牌 + Redis 黑名单、找回密码邮件、导出接口

## 本地运行
```bash
cd server
cp .env.example .env          # 填 DATABASE_URL / JWT_SECRET / FIELD_ENC_KEY
npm install
npm run prisma:generate
npm run prisma:migrate        # 建表
npm run seed                  # 写初始账号
npm run dev                   # http://localhost:3000/api
```
前端 `npm run dev`（5173）通过 Vite 代理 `/api` → 后端 3000，即可联调。

## 飞书连接器

可在 Web 端“连接器 → 飞书 → 范围设置”配置 App ID / App Secret，也可使用 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 环境变量。数据库中只保存 App Secret 的 AES-256-GCM 密文。

飞书开发者后台需要：

- 启用“使用长连接接收事件”。
- 添加 `im.message.receive_v1`（接收消息 v2.0）事件。
- 开通 `im:message.group_msg` 以及查询群和用户名称所需权限，发布应用版本并将机器人加入目标群。

对 Harness Agent 提供的数据入口：`GET /api/integrations/feishu/messages?limit=50`，返回当前用户有权访问的群名称、群 ID、消息内容、时间和发送人。

## 生成密钥
```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# FIELD_ENC_KEY（32 字节 hex）
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 安全要点（已落地）
- 密码仅存 bcrypt 哈希；JWT 走 httpOnly+Secure+SameSite cookie
- 联系人姓名/联系方式 AES-256-GCM 加密入库，解密接口限报备人/管理员且记审计
- 权限用「真实登录角色」判断，代理访问不提升权限，每次代理记日志
- 所有写操作审计日志记真实 IP/UA；列表按角色服务端过滤
- 撞单检测在事务内二次执行，防并发重复报备

## 扩展新模块（模板）
1. `src/modules/<name>/<name>.routes.ts`：建 `Router()`，`router.use(requireAuth)`，按需 `requireRole(...)`
2. zod 校验入参 → prisma 读写 → `writeLog(req, {...})` 记审计 → 返回
3. 在 `src/index.ts` `app.use('/api/<name>', <name>Router)`
