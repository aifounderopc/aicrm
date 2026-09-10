# JoyMarketing CRM — 后端 API 与数据表设计

> 目标：把现有纯前端原型（Zustand + localStorage）平滑迁移为「后端集中存储 + 鉴权 + 字段加密 + 审计」的可上线系统。
> 设计严格对应现有 `src/types/index.ts` 与 `src/store/index.ts` 的方法，前端只需把 `useStore` 的各 action 改成调用对应 API。

技术栈建议（京东云）：
- 后端：Node.js (NestJS / Express) 或 Java(Spring Boot)，本文以 REST 描述，GraphQL 亦可
- 数据库：MySQL 8（京东云 RDS MySQL）
- 缓存/会话：Redis（JWT 黑名单、登录限频）
- 对象存储：京东云 OSS（举证截图、合同文件，**不要再用 base64 存库**）
- 密钥：京东云 KMS 托管字段加密密钥

---

## 一、数据表设计

### 1. `users`（账号）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK / UUID | 主键 |
| name | VARCHAR(64) | 姓名 |
| email | VARCHAR(128) UNIQUE | 登录邮箱，唯一索引 |
| password_hash | VARCHAR(255) | **bcrypt/argon2 加盐哈希，绝不明文** |
| role | ENUM | `admin/channel_admin/sales_admin/sales/channel` |
| channel_id | FK→channels.id NULL | 渠道/京东经理账号关联渠道 |
| is_jd_manager | BOOL | 京东渠道经理账号标记 |
| group_name | VARCHAR(64) NULL | 销售组别 |
| disabled | BOOL default false | 停用 |
| must_change_pwd | BOOL default true | 首次登录强制改密 |
| created_at / updated_at | DATETIME | |

索引：`email` 唯一；`(role)`、`(channel_id)`。

### 2. `channels`（渠道伙伴）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | PK | |
| name | VARCHAR(128) | 渠道简称 |
| full_name | VARCHAR(255) | 公司全称（必填） |
| contact_name | VARCHAR(64) | 渠道联系人 |
| phone | VARCHAR(32) NULL | |
| jd_manager_name | VARCHAR(64) NULL | 京东渠道经理姓名 |
| status | ENUM(active/disabled) | |
| created_at | DATETIME | |

### 3. `opportunities`（商机）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | PK | |
| customer_name | VARCHAR(128) | 客户名称 |
| company_name | VARCHAR(255) NULL | |
| industry | VARCHAR(32) | |
| source | ENUM(direct/channel) | |
| channel_id | FK NULL | |
| channel_name / channel_manager_name | VARCHAR | 冗余快照 |
| sa_owner_id / sales_owner_id | FK→users.id | 报备人 |
| stage | ENUM(reporting/signing/delivery/signed/released) | |
| reported_at / updated_at | DATETIME | |
| release_at | DATETIME | 保护到期（reporting/signing 有效） |
| locked_permanently | BOOL | **signed/delivery=true；signing=false** |
| amount_range | ENUM(under5/5to10/10to20/20to50/above50) | |
| first_contact_date | DATE | |
| requirement_description | TEXT | |
| contract_no / signed_date / signed_amount / contract_file_key | | 签约信息，contract_file_key 指向 OSS |
| is_frozen / frozen_reason | | 冻结 |
| release_reason / released_by / released_at | | 释放 |
| is_subsidiary / parent_company_name | | 子公司标记 |
| customer_name_norm | VARCHAR(128) | **撞单检测用的归一化名（去后缀/城市），建索引** |
| created_at | DATETIME | |

索引：`(customer_name_norm, industry)` 撞单查询；`(sales_owner_id)`；`(stage)`；`(release_at)` 定时释放扫描。

### 4. `opportunity_contacts`（商机联系人 — 敏感）
| 字段 | 类型 | 说明 |
|------|------|------|
| opportunity_id | FK PK | 1:1 |
| level | ENUM(决策层/执行层/技术评估层) | |
| department | VARCHAR(64) | |
| contact_types | JSON / SET | phone/email/wechat |
| enc_name | VARBINARY | **字段级 AES-256-GCM 密文**（KMS 数据密钥） |
| enc_contact | VARBINARY | 同上 |
| phone_hash | CHAR(64) | SHA-256，用于跨商机查重，不可逆 |

> 真正实现「AES-256 加密存储」：写入时用 KMS 数据密钥加密 enc_name/enc_contact；仅 `报备人 / 管理员审核` 角色调用解密接口时返回明文，且每次解密记审计。

### 5. `evidence_files`（举证）
| id, opportunity_id FK, name, oss_key, size, status(pending/approved/rejected), reject_reason, uploaded_by, uploaded_at |

### 6. `progress_reports`（进展）/ 7. `renewal_requests`（续期）/ 8. `notifications`（通知）
字段直接对应现有 `ProgressReport`/`RenewalRequest`/`Notification` 类型，外键到 opportunity / user。

### 9. `operation_logs`（审计日志 — 只追加，不可改删）
| id, actor_id FK, actor_name, action, detail, target_type, target_id, **ip(真实)**, **user_agent(真实)**, created_at |
> 由**后端**写入，前端无写权限；IP/UA 从请求中取，不再写死 `127.0.0.1`。

---

## 二、API 端点（对应现有 store 方法）

> 统一约定：JSON；鉴权用 `Authorization: Bearer <JWT>`；所有写操作后端记审计日志；所有返回的数据**已按当前用户角色过滤/脱敏**。

### 认证 `/auth`
| store 方法 | HTTP | 说明 |
|------|------|------|
| `login(email,password)` | `POST /auth/login` | 校验哈希；返回 JWT(含 userId/role/exp)；失败计数+限频 |
| `logout()` | `POST /auth/logout` | JWT 加入 Redis 黑名单 |
| `switchUser(userId)` | `POST /auth/impersonate` | **后端校验**：admin 任意；channel_admin 仅 channel；sales_admin 仅 sales。返回带 `actAs` 的新 JWT，审计记录 |
| — | `POST /auth/change-password` | 用户自助改密（旧密码校验 + 强度校验） |
| — | `POST /auth/forgot-password` / `reset` | 找回密码（邮件令牌） |
| — | `GET /auth/me` | 当前用户信息（替代前端 currentUser） |

### 商机 `/opportunities`
| store 方法 | HTTP |
|------|------|
| 列表（含权限过滤：销售只见自己，admin 全量） | `GET /opportunities?stage=&q=&page=` |
| 详情 | `GET /opportunities/:id` |
| `detectCollision()` | `POST /opportunities/check-collision` （报备前预检，返回 collision/similar/crossIndustry） |
| `addOpportunity()` | `POST /opportunities` （**服务端再次撞单检测**，原子事务，防并发重复报备） |
| `updateStage()` | `PATCH /opportunities/:id/stage` （signed/delivery 自动 locked_permanently=true） |
| `releaseOpportunity()` | `POST /opportunities/:id/release` |
| `freezeOpportunity()` | `POST /opportunities/:id/freeze` |
| `deleteOpportunity()` | `DELETE /opportunities/:id` |
| 解密联系人 | `GET /opportunities/:id/contact`（仅 owner/admin，KMS 解密 + 审计） |

### 举证 `/evidence`
| `approveEvidence/rejectEvidence` | `POST /opportunities/:id/evidence/:fid/approve` \| `/reject` |
| 上传 | `POST /opportunities/:id/evidence`（先取 OSS 直传签名 `GET /oss/presign`，前端直传，再回传 oss_key） |

### 续期 / 进展
| `requestRenewal` | `POST /opportunities/:id/renewals` |
| `approveRenewal/rejectRenewal` | `POST /renewals/:rid/approve` \| `/reject` |
| `addProgressReport` | `POST /opportunities/:id/progress` |

### 通知 `/notifications`
| 列表（仅本人） | `GET /notifications` |
| `markNotificationRead` | `PATCH /notifications/:id/read`、`POST /notifications/read-all` |

### 渠道 `/channels`（渠道管理员/超管）
| `addChannel(c,account,jdAccount)` | `POST /channels`（事务：建渠道 + 渠道账号 + 京东经理账号） |
| `updateChannel` | `PATCH /channels/:id` |
| `toggleChannel` | `POST /channels/:id/toggle`（同时停用关联账号） |
| `createChannelAccount` | `POST /channels/:id/account` |
| `updateChannelAccount` | `PATCH /users/:id`（复用用户更新） |
| `deleteChannel` | `DELETE /channels/:id`（有商机数据则拒绝） |

### 用户/管理员 `/users`
| `createUser` | `POST /users`（角色越权校验：sales_admin 只能建 sales 等） |
| `updateUser` | `PATCH /users/:id` |
| `toggleUserDisabled` | `POST /users/:id/toggle` |
| `deleteUser` | `DELETE /users/:id`（有商机则拒绝） |
| 列表 | `GET /users?role=` |

### 日志 `/logs`（管理类角色）
| 列表（分页+筛选） | `GET /logs?actor=&action=&from=&to=` |

### 定时任务（替代前端 `processAutoReleases`）
- 后端 **cron 每日**：扫描 `release_at < now AND stage∈(reporting,signing) AND NOT locked_permanently` → 置 released，写日志，发通知。
- 即将到期（≤7天）→ 生成提醒通知。

---

## 三、安全基线 checklist（必做）
- [ ] 密码 bcrypt/argon2 哈希；传输全程 HTTPS；登录失败限频 + 锁定
- [ ] JWT 设过期（如 2h）+ 刷新令牌；logout 黑名单；敏感操作二次校验
- [ ] **所有鉴权与数据过滤在后端**；前端角色判断仅用于 UI
- [ ] 联系人 enc_name/enc_contact 字段级 AES-256-GCM（KMS 管理密钥），解密接口限角色 + 审计
- [ ] 审计日志只追加、真实 IP/UA、前端无写权限
- [ ] 文件走 OSS 直传 + 病毒扫描 + 访问签名；不再 base64 入库
- [ ] 服务端二次校验所有输入（邮箱唯一、密码强度、必填、金额范围）
- [ ] 商机报备/改阶段加行级锁或唯一约束，防并发重复
- [ ] 接口限流（网关）、SQL 参数化（防注入）、CORS 白名单、安全响应头

---

## 四、前端迁移路径（最小改动）
1. 新建 `src/api/` 数据层，封装上述端点（fetch/axios + 统一错误处理 + 注入 JWT）。
2. 把 `useStore` 的每个 action 改为「调用 API → 用返回结果 set 本地缓存」；保留 store 作为**视图状态/缓存**，不再作为数据源。
3. `currentUser` 改为 `GET /auth/me` 拉取；`authUserId`/JWT 存 `httpOnly cookie`（优于 localStorage）。
4. 列表页改为服务端分页 + 查询参数；导出走后端生成（带权限与导出审计）。
5. 删除 `seed.ts` 注入，改由后端数据库种子脚本初始化。

> 类型可直接复用 `src/types/index.ts`：把 `password` 从 User 移除（前端永不持有），`Contact.encryptedName/encryptedContact` 改为「仅在解密接口返回时存在」。
