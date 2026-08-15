# Scale X AI 销售伙伴 Harness

该服务使用官方 `deepseek-harness-sdk==0.1.0rc6` 启动持久化 Harness 运行时，并通过内部 HTTP 向 CRM API 提供普通调用与 SSE 流式调用。

## 组成

- `prompts/soul.md`：Agent 身份、表达方式、可信边界与安全原则。
- `prompts/harness.md`：数据优先级、业务能力边界、飞书结构化协议和回答规范。
- `prompts/opportunity-detail-memory.md`：对所有商机统一生效的详情字段与推进时间线业务记忆。
- `cordis.yml`：最小权限 Harness 组合，仅启用 DeepSeek 模型、Agent spine、JSONL 会话持久化和检查点；不启用 shell、文件系统、技能或子 Agent。
- `app.py`：将 Harness 的 `assistant/chunk` 会话事件转换为 SSE。

## 数据流

1. 飞书长连接消息先写入 `feishu_messages`。
2. CRM 后台任务调用 Harness 生成结构化结果；模型不可用时使用确定性规则降级。
3. 结果幂等写入 `sales_signals`。
4. 高置信匹配只允许补齐低风险字段、向 `progress_reports` 追加带飞书来源的 AI 记录。
5. 签约、交付、关闭、释放、合同金额和联系人等高影响字段永不自动写入。
6. 右侧对话窗由 CRM API 按当前身份过滤数据，再交给 Harness 流式回答。

## 环境变量

- `DEEPSEEK_API_KEY`：必填；缺失时结构化与对话使用规则模式。
- `DEEPSEEK_BASE_URL`：默认 `https://api.deepseek.com`。
- `DSH_MODEL`：默认 `deepseek-v4-flash`。
- `DSH_SESSION_ROOT`：Harness JSONL 会话目录。
