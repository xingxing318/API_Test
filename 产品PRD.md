# API 连通性测试器（HTML 小应用）产品 PRD

版本：v0.1（草案）  
作者：Codex（按当前需求生成）  
日期：2025-12-13  

---

## 1. 背景与目标

### 1.1 背景
开发者在使用国内外大模型厂商 API 时，经常需要快速验证：
- 本地网络到目标 API 的连通性（DNS / TLS / 线路）
- API Key 是否有效、权限范围是否正确
- 可用模型列表（model id / 能力类型）
- 额度/用量（若厂商提供可查询接口）
- 费用/费率估算（基于 tokens/计费单位与价格表）

现有工具要么偏向命令行、要么只支持单一厂商，且缺少“统一配置 + 历史记录 + 结果可比对”。

### 1.2 产品目标
构建一个**本地可运行的 HTML 小应用**，提供**统一入口**来测试多家 AI 厂商/中转平台 API 的连通性与可用性，并沉淀历史请求数据与用量/费用信息，便于排障与对比。

### 1.3 成功指标（可量化）
- 5 分钟内完成任意一家厂商的“配置→连通性测试→模型列表获取→一次对话调用”
- 历史记录可检索、可导出（JSON/CSV），覆盖请求/响应/耗时/错误码
- 支持至少 9 家国内外厂商（见第 4 章），并支持“自定义/中转平台”

---

## 2. 用户与使用场景

### 2.1 目标用户
- 个人开发者、独立站/应用开发者
- 企业内部研发/运维/网络排障人员
- 需要对比不同模型/不同线路/不同中转平台可用性的用户

### 2.2 核心场景
- **场景 A：Key 校验**：新拿到 Key，想确认权限与可用模型
- **场景 B：网络排障**：本地/公司网络是否能访问目标厂商（含国外厂商）
- **场景 C：成本核算**：对一次请求的 token/用量与费用做快速估算
- **场景 D：中转对接**：通过 OpenAI 兼容的中转平台或自建网关验证对接参数

---

## 3. 产品范围（MVP 与后续）

### 3.1 MVP（v0.1 必做）
- 厂商预置：OpenAI（ChatGPT）、Gemini、Claude、智谱 GLM、DeepSeek、阿里百炼/通义千问（Qwen）、Kimi（Moonshot）、豆包/火山方舟、即梦（按自定义模板落地）
- 配置：Base URL、请求方式、鉴权方式（Header/Query）、常用默认 Header、超时、代理/中转
- 功能页：一键测试（连通性 + 模型列表 + 一次最小调用）
- 历史：保存请求与结果（脱敏 Key），支持检索与导出
- 用量/费用：解析响应中的 usage（如存在），结合本地价格表估算

### 3.2 v0.2+（可选增强）
- 多能力类型：图像/语音/视频（以厂商支持为准）
- 多环境切换：开发/生产、多 Key 管理、团队共享（加密导出）
- 对比视图：同一 prompt 多厂商并行调用与结果对比
- 诊断报告：一键生成 Markdown 报告（含网络/错误码/重试建议）

---

## 4. 厂商对接调研（文档入口 + 对接方式）

> 说明：不同厂商在“模型列表/用量查询”能力上差异较大，部分信息只能在控制台查看；产品需同时提供**预置适配**与**自定义模板**两条路径。

### 4.1 统一抽象（适配层）
每个“Provider（厂商/平台）”统一抽象为：
- `baseUrl`：API 基础地址
- `auth`：鉴权配置（Header/Query/自定义）
- `endpoints`：
  - `listModels`：获取模型列表（可选）
  - `testCall`：最小可调用请求（必选）
  - `usageOrBalance`：用量/余额/额度（可选，若厂商支持）
- `responseMapping`：将响应映射为统一结构（模型列表、usage、错误信息）
- `pricing`：本地价格表（可编辑）

### 4.2 厂商清单（建议预置项）

#### 4.2.1 OpenAI（ChatGPT）
- 文档入口：
  - OpenAI OpenAPI 规范（可机读）：https://app.stainless.com/api/spec/documented/openai/openapi.documented.yml
  - 官方 API 参考：https://platform.openai.com/docs/api-reference
- 常见默认（以官方为准）：
  - Base URL：`https://api.openai.com/v1`
  - 鉴权：`Authorization: Bearer {OPENAI_API_KEY}`
  - 模型列表：`GET /models`
  - 最小调用：`POST /responses` 或 `POST /chat/completions`
- 备注：
  - “额度/用量”通常与账号计费体系相关，可能需要另外的计费接口或控制台查看；产品应提供“自定义用量接口”配置项。

#### 4.2.2 Google Gemini
- 文档入口：https://ai.google.dev/gemini-api/docs
- 常见默认（以官方为准）：
  - Base URL：`https://generativelanguage.googleapis.com/v1beta`
  - 鉴权：Query `?key={GEMINI_API_KEY}`（也可能存在其他方式，按文档）
  - 模型列表：`GET /models`
  - 最小调用：`POST /models/{model}:generateContent`

#### 4.2.3 Anthropic Claude
- 文档入口（API Reference）：https://docs.anthropic.com/en/api/messages
- 常见默认（以官方为准）：
  - Base URL：`https://api.anthropic.com/v1`
  - 鉴权：`x-api-key: {ANTHROPIC_API_KEY}`
  - 常用 Header：`anthropic-version: {version}`
  - 最小调用：`POST /messages`
- 备注：模型列表/用量接口是否可查询以官方为准；需支持自定义模板。

#### 4.2.4 智谱 GLM（ZhipuAI / BigModel）
- 文档入口：https://open.bigmodel.cn/dev/api
- 参考可访问 API Host（返回 401 表明存在服务入口）：`https://open.bigmodel.cn/api/paas/v4/`
- 备注：
  - 具体 endpoint、签名/鉴权方式与模型 ID 以文档为准；预置项提供“官方示例模板”，并允许用户修改。

#### 4.2.5 DeepSeek
- 文档入口：https://api-docs.deepseek.com/
- 文档说明：DeepSeek API 使用 **OpenAI 兼容格式**（文档首页可见描述）
- 典型策略：
  - 直接按 OpenAI 兼容模式配置（Base URL、`Authorization: Bearer`、`/chat/completions` 等）
  - 或使用产品的“OpenAI 兼容中转”适配器
 - 文档中可见的示例地址（用于预置默认值）：`https://api.deepseek.com/v1`

#### 4.2.6 阿里百炼 / 通义千问 Qwen（Model Studio）
- 文档入口（API 参考）：https://help.aliyun.com/zh/model-studio/qwen-api-reference
- 备注：
  - 文档中出现的典型 Host（用于预置默认值，按用户所处区域选择）：
    - `https://dashscope.aliyuncs.com/`
    - `https://dashscope-intl.aliyuncs.com/`
    - `https://dashscope-finance.aliyuncs.com/`
  - 原生 API（示例）：`/api/v1/services/aigc/text-generation/generation`
  - OpenAI 兼容模式（示例）：`/compatible-mode/v1/chat/completions`
  - 产品提供“Qwen 预置模板（原生 + 兼容）+ 自定义模式”，并允许用户在 UI 中切换。

#### 4.2.7 Kimi（Moonshot）
- 文档入口：
  - 总览：https://platform.moonshot.cn/docs
  - 从 OpenAI 迁移指南（体现 OpenAI 兼容性）：https://platform.moonshot.cn/docs/guide/migrating-from-openai-to-kimi
- 文档说明：Kimi API 兼容 OpenAI 接口规范（迁移指南中明确说明）
- 文档中可见的示例地址（用于预置默认值）：`https://api.moonshot.cn/v1`

#### 4.2.8 豆包 / 火山方舟（Volcengine Ark）
- 文档入口（火山方舟文档中心）：https://www.volcengine.com/docs/82379
- 备注：
  - 火山方舟可能存在多种接入方式（平台网关/SDK/兼容模式）；产品优先用“自定义模板 + 预置常用 Header”覆盖。

#### 4.2.9 即梦 AI
- 备注：
  - 即梦可能偏向图像/视频等多模态能力，接口形态与计费维度可能不同。
  - v0.1 先以“自定义 Provider（模板）”方式纳入；后续在确认官方文档与能力范围后再做专用适配。

#### 4.2.10 中转平台（OpenRouter / 自建网关）
- 文档入口：
  - OpenRouter：https://openrouter.ai/docs/quickstart
  - LiteLLM Proxy：https://docs.litellm.ai/docs/proxy/quick_start
  - OneAPI（社区自建）：https://github.com/songquanpeng/one-api
- 典型策略：
  - 以 OpenAI 兼容方式暴露统一 endpoint（便于“模型列表/对话调用/用量解析”的通用化）
  - 产品提供“OpenAI 兼容 Provider”作为第一等公民，并允许自定义 Header（如 `HTTP-Referer`、`X-Title` 等平台要求）

---

## 附录 A：可直接落地的预置模板（v0.1）

> 说明：以下模板优先选取“可机读规范/文档中明确出现的地址与路径”。其余厂商可先走“自定义 Provider”兜底，后续再补齐专用适配。

### A.1 OpenAI（OpenAI 原生）
- `baseUrl`：`https://api.openai.com/v1`
- `auth`：Header `Authorization: Bearer {{apiKey}}`
- `listModels`：`GET {{baseUrl}}/models`
- `testCall`（推荐 responses）：
  - `POST {{baseUrl}}/responses`
  - Body（JSON）：
    ```json
    { "model": "{{model}}", "input": "{{prompt}}" }
    ```

### A.2 DeepSeek（OpenAI 兼容）
- `baseUrl`：`https://api.deepseek.com/v1`
- `auth`：Header `Authorization: Bearer {{apiKey}}`
- `listModels`：`GET {{baseUrl}}/models`（若返回 404/不支持，则在 UI 提示“手动维护模型列表”）
- `testCall`：
  - `POST {{baseUrl}}/chat/completions`
  - Body（JSON）：
    ```json
    {
      "model": "{{model}}",
      "messages": [{ "role": "user", "content": "{{prompt}}" }]
    }
    ```

### A.3 Kimi（Moonshot，OpenAI 兼容）
- `baseUrl`：`https://api.moonshot.cn/v1`
- `auth`：Header `Authorization: Bearer {{apiKey}}`
- `listModels`：`GET {{baseUrl}}/models`（若不支持则回退为手动维护）
- `testCall`：同 A.2（`/chat/completions`）

### A.4 OpenRouter（OpenAI 兼容中转）
- `baseUrl`：`https://openrouter.ai/api/v1`
- `auth`：Header `Authorization: Bearer {{apiKey}}`
- 可选 Header（由平台要求决定）：`HTTP-Referer`、`X-Title`
- `listModels`：`GET {{baseUrl}}/models`（以平台文档为准）
- `testCall`：同 A.2（`/chat/completions`）

### A.5 Gemini（原生）
- `baseUrl`：`https://generativelanguage.googleapis.com/v1beta`
- `auth`：Query `key={{apiKey}}`
- `listModels`：`GET {{baseUrl}}/models?key={{apiKey}}`
- `testCall`：
  - `POST {{baseUrl}}/models/{{model}}:generateContent?key={{apiKey}}`
  - Body（JSON）：
    ```json
    { "contents": [{ "role": "user", "parts": [{ "text": "{{prompt}}" }] }] }
    ```

### A.6 Claude（Anthropic 原生）
- `baseUrl`：`https://api.anthropic.com/v1`
- `auth`：Header `x-api-key: {{apiKey}}`
- 必要 Header（按官方文档配置）：`anthropic-version: {{var.anthropicVersion}}`
- `testCall`：
  - `POST {{baseUrl}}/messages`
  - Body（JSON）：
    ```json
    {
      "model": "{{model}}",
      "max_tokens": 64,
      "messages": [{ "role": "user", "content": "{{prompt}}" }]
    }
    ```

### A.7 Qwen（阿里百炼/Model Studio）
- 文档入口：https://help.aliyun.com/zh/model-studio/qwen-api-reference
- **兼容模式（OpenAI compatible）**：
  - `baseUrl`：`https://dashscope.aliyuncs.com/compatible-mode/v1`
  - `auth`：Header `Authorization: Bearer {{apiKey}}`
  - `testCall`：同 A.2（`/chat/completions`）
- **原生模式（DashScope）**：
  - `baseUrl`：`https://dashscope.aliyuncs.com/api/v1`
  - `testCall`：`POST {{baseUrl}}/services/aigc/text-generation/generation`（请求体按文档示例配置）

---

## 5. 需求详述（功能）

### 5.1 配置管理（配置页）
**目标**：让用户用最少步骤完成不同厂商的可调用配置，并能保存/切换。

功能点：
- Provider 选择：预置列表 + 自定义 Provider
- 基础配置：
  - `baseUrl`（可含路径）
  - `method`（GET/POST/PUT/DELETE，MVP 重点 GET/POST）
  - `timeoutMs`
  - `headers`（Key-Value 编辑器）
  - `queryParams`（Key-Value 编辑器）
  - `bodyTemplate`（JSON 编辑器，支持变量）
- 鉴权配置：
  - Header 模式：如 `Authorization: Bearer {{apiKey}}`、`x-api-key: {{apiKey}}`
  - Query 模式：如 `key={{apiKey}}`
  - 组合模式：Header + Query 并存
- 变量系统（MVP 必要）：
  - 内置：`{{apiKey}}`、`{{model}}`、`{{prompt}}`、`{{nowIso}}`
  - 用户自定义：`{{var.xxx}}`
- 价格表（本地可编辑）：
  - 每个模型的计费项（输入/输出 token 单价、或按秒/按张等）
  - 支持导入导出（JSON）

安全要求：
- Key 默认不落盘（默认仅内存），用户可勾选“加密保存”
- 加密保存：基于 WebCrypto，用户设置本地口令派生密钥进行加密
- 历史记录中永不保存明文 Key（只保存 `providerId` 引用）

### 5.2 连通性测试（功能页核心）
**目标**：用最短路径判断“网络可达 + 鉴权有效 + 业务接口可用”。

测试分层（依次执行，可单独勾选）：
1) **基础连通**：对 `baseUrl` 做一次请求（优先 `GET`，必要时用配置的 `method`）  
   输出：DNS/TLS 是否失败、HTTP 状态码、耗时、响应头（截断）
2) **模型列表**（若配置了 listModels）：拉取模型列表并渲染  
   输出：模型数量、模型 id 列表、失败原因
3) **最小调用**（必选）：用 `testCall` 模板发起一次最小请求（默认 prompt 很短）  
   输出：是否成功、响应文本/关键信息、usage、耗时、错误码与可读错误

错误归因建议（需在 UI 展示）：
- 网络不可达：DNS、超时、TLS、连接被拒绝
- CORS/浏览器限制（见第 7.1 风险）
- 认证失败：401/403（提示检查 Key、Header、区域限制）
- 参数错误：400/422（提示检查 body 模板/模型名）
- 限流：429（提示重试/更换线路/提升配额）
- 服务异常：5xx（提示稍后重试/查状态页）

### 5.3 模型列表（列表与筛选）
功能点：
- 以表格呈现：`model id`、能力类型（若可推断）、是否推荐/默认
- 搜索与筛选（前缀/包含）
- 一键设为当前测试模型
- 支持“手动添加模型”（当厂商不提供模型列表接口时）

### 5.4 用量/额度/余额（可选能力）
功能点：
- 若厂商提供 `usageOrBalance` 端点：展示余额/额度/已用量（按响应映射）
- 若无法从 API 查询：提供“控制台链接/备注”字段，允许用户手动记录

### 5.5 费用估算（费率计算）
输入：
- 本次请求返回的 `usage`（如：input/output tokens、total tokens）
- 本地价格表（按模型维度）

输出：
- 本次请求费用估算（输入/输出拆分、合计）
- 近 24h/7d/30d 历史费用汇总（基于历史记录的 usage 累加）

### 5.6 历史记录（必做）
记录字段（最小集合）：
- 时间、Provider、请求名（可编辑标签）、HTTP 方法与 URL（脱敏 Query）
- 请求头（脱敏）、请求体（可选保存，默认保存“摘要”）
- 响应状态码、耗时、响应摘要、usage、费用估算
- 错误类型归因与原始错误信息

操作：
- 列表检索：按 Provider、状态码、时间范围、关键词
- 详情查看：请求/响应原文（可复制）
- 导出：JSON（MVP），CSV（可选）
- 清理：按时间范围批量删除

---

## 6. 页面与信息架构

### 6.1 页面结构
1) **功能页（主页）**：一键测试、模型列表、最小调用、结果面板、历史快捷入口  
2) **配置页**：Provider 管理、鉴权/模板编辑、价格表、导入导出  
3) **历史页**：请求列表、筛选、详情、导出  
4) **帮助/说明页**：常见错误、CORS 说明、如何使用中转/本地代理

### 6.2 功能页布局（建议）
- 顶部：Provider 下拉 + 环境切换 + “开始测试”按钮 + “停止/取消”按钮
- 左侧：配置摘要（baseUrl、模型、超时、是否走代理）
- 中部：分步结果（连通性/模型列表/最小调用）
- 右侧：历史记录列表（最近 N 条）
- 底部：日志/原始请求响应折叠区

---

## 7. 技术方案（HTML 小应用落地建议）

### 7.1 浏览器直连的限制（关键风险）
多数厂商 API **不开放 CORS**，浏览器 `fetch` 可能直接被拦截，即使网络与 Key 没问题。

因此产品需提供两种运行模式（至少说明清楚）：
- **模式 1：浏览器直连**（能用则用，适合支持 CORS 的中转平台/自建网关）
- **模式 2：本地代理模式（推荐）**：提供一个可选的本地轻量代理（Node/Go 任意）转发请求，从而绕开 CORS，并实现更准确的网络诊断

> 本 PRD 的“HTML 小应用”指 UI 层；代理层可作为可选组件（后续实现时可提供一键启动脚本）。

### 7.2 数据存储
- 配置与历史：IndexedDB（容量更适合存历史），少量配置可用 localStorage
- Key 加密存储：WebCrypto（AES-GCM）+ PBKDF2/Argon2（实现时择一）

### 7.3 适配器/模板机制
两类 Provider：
- **预置 Provider**：内置默认 endpoint/headers/body 模板与响应映射
- **自定义 Provider**：用户定义 endpoint、方法、headers、body 模板与“usage 解析规则”（JSONPath/简单映射）

---

## 8. 关键数据结构（建议）

### 8.1 Provider 配置（示意）
- `id`、`name`、`category`（海外/国内/中转/自定义）
- `baseUrl`
- `auth`: `{ type: 'header'|'query'|'custom', keyName, template }`
- `endpoints`: `{ listModels?, testCall, usageOrBalance? }`
- `defaultHeaders`、`defaultQuery`
- `responseMapping`：`{ modelListPath?, usagePath?, textPath?, errorPath? }`
- `pricingTable`: `[{ model, unit, inputPrice, outputPrice, currency }]`

### 8.2 历史记录（示意）
- `id`、`createdAt`
- `providerId`、`model`
- `request`: `{ method, url, headersRedacted, bodySummary, bodyRaw? }`
- `response`: `{ status, latencyMs, headersSummary, bodySummary, bodyRaw? }`
- `usage`: `{ inputTokens?, outputTokens?, totalTokens?, raw? }`
- `costEstimate`: `{ currency, inputCost?, outputCost?, totalCost? }`
- `error`: `{ kind, message, raw? }`

---

## 9. 验收标准（MVP）
- 可新增并保存至少 9 个 Provider 配置（含自定义）
- 对任一 Provider 能完成一次“最小调用”并显示结果、耗时与错误归因
- 历史记录可检索与导出（JSON），导出内容不含明文 Key
- 支持至少一种“OpenAI 兼容模式”配置，能对 DeepSeek/中转平台完成调用（以用户提供可用 Key 为前提）

---

## 10. 里程碑与开发任务拆解（建议）

### 10.1 里程碑
- M1（第 1 周）：信息架构 + Provider/模板数据结构 + 功能页基础请求与结果展示
- M2（第 2 周）：历史记录 + 配置页 + 价格表与费用估算 + 导入导出
- M3（可选）：本地代理模式 + 诊断报告 + 对比视图

### 10.2 任务拆解（MVP）
- UI：功能页/配置页/历史页/帮助页
- 内核：HTTP 请求器（超时、重试、取消）、变量渲染、脱敏、日志
- 适配：预置 Provider（至少覆盖本 PRD 清单）
- 存储：IndexedDB 封装、导入导出
- 安全：Key 加密保存、历史脱敏

---

## 11. 风险与对策
- CORS 导致“看似不可达”：在帮助页明确提示，并提供本地代理方案
- 厂商接口变更/限制：以“自定义模板”兜底，预置模板可更新
- 用量/余额无法统一获取：提供“可选端点 + 手动记录”双通道
- Key 安全：默认不落盘 + 加密保存 + 历史脱敏 + 一键清空
