# 开发 TODO（逐项交付）

> 目标：一个本地可运行的 HTML 小应用，用于测试多家 AI 厂商/中转平台 API 连通性、模型列表、最小调用、用量与费用估算，并保存历史记录。

## 0. 约定
- UI：纯静态（`index.html` + ESM JS），不依赖构建工具
- 存储：先用 `localStorage`（后续可切到 IndexedDB）
- 安全：历史记录不保存明文 API Key；Key 默认仅在本次会话内存中
- 兼容：优先支持 OpenAI 兼容接口（DeepSeek/Kimi/OpenRouter/自建中转）

## 1. 项目骨架（本次交付）
- [x] 新增 `index.html`（基础布局：功能/配置/历史/帮助）
- [x] 新增 `app/` 目录（模块化：UI/请求/存储/Provider）
- [x] 新增最小可运行：能打开页面、切换 Provider、输入 Key、点击“测试”得到错误/成功结果

## 2. Provider 预置与配置页
- [x] 预置 Provider：OpenAI、DeepSeek、Kimi、OpenRouter、Gemini、Claude、Qwen(兼容/原生)、智谱（模板）、豆包/方舟（模板）、即梦（模板）
- [x] 配置项：Base URL、鉴权方式（Header/Query）、默认 Header、超时、模型名（以 Provider JSON 编辑为主）
- [ ] 高级：自定义 endpoint（模型列表/最小调用/余额用量）

## 3. 连通性测试与模型列表
- [x] 基础连通测试（GET baseUrl，展示状态码/耗时）
- [x] 模型列表获取与渲染（可搜索/一键设为当前模型）
- [x] 最小调用（短 prompt），展示耗时、状态码、响应摘要、usage（能解析则展示）

## 4. 历史记录与导入导出
- [x] 历史记录列表（筛选：Provider/关键字）
- [x] 详情页（点击条目弹窗查看 JSON，支持复制/删除单条）
- [x] 导出 JSON、清空

## 5. 用量解析与费率估算
- [x] 解析常见 usage（OpenAI compatible / Claude / Qwen 原生）
- [x] 本地价格表（按模型/输入输出单价），可编辑与导入导出（通过 Provider JSON 的 pricing/pricingTable + 配置导入导出）
- [x] 本次费用 + 汇总费用（基于 Provider.pricing 与历史记录汇总）

## 6. 可选：本地代理绕过 CORS
- [x] 提供本地代理（Node）转发，支持自定义 Header/方法/body
- [x] UI 一键切换“直连/代理”，并提示 CORS 风险
