export const providersBase = [
  {
    id: "openai",
    name: "OpenAI（ChatGPT）",
    baseUrl: "https://api.openai.com/v1",
    auth: { type: "header", header: "Authorization", template: "Bearer {{apiKey}}" },
    endpoints: {
      listModels: { method: "GET", path: "/models" },
      testCall: { method: "POST", path: "/chat/completions" },
    },
    defaults: {
      model: "gpt-4o-mini",
      prompt: "你好，请回复 'pong'。",
      timeoutMs: 15000,
    },
    pricing: {
      currency: "USD",
      unit: "per_1m_tokens",
      input: null,
      output: null,
    },
    mapping: {
      models: { path: "data", item: "id" },
      text: { path: "choices.0.message.content" },
      usage: {
        input: "usage.prompt_tokens",
        output: "usage.completion_tokens",
        total: "usage.total_tokens",
      },
      error: { path: "error.message" },
    },
  },
  {
    id: "deepseek",
    name: "DeepSeek（OpenAI 兼容）",
    baseUrl: "https://api.deepseek.com/v1",
    auth: { type: "header", header: "Authorization", template: "Bearer {{apiKey}}" },
    endpoints: {
      listModels: { method: "GET", path: "/models" },
      testCall: { method: "POST", path: "/chat/completions" },
    },
    defaults: { model: "deepseek-chat", prompt: "你好，请回复 'pong'。", timeoutMs: 15000 },
    pricing: { currency: "USD", unit: "per_1m_tokens", input: null, output: null },
    mapping: {
      models: { path: "data", item: "id" },
      text: { path: "choices.0.message.content" },
      usage: {
        input: "usage.prompt_tokens",
        output: "usage.completion_tokens",
        total: "usage.total_tokens",
      },
      error: { path: "error.message" },
    },
  },
  {
    id: "kimi",
    name: "Kimi（Moonshot，OpenAI 兼容）",
    baseUrl: "https://api.moonshot.cn/v1",
    auth: { type: "header", header: "Authorization", template: "Bearer {{apiKey}}" },
    endpoints: {
      listModels: { method: "GET", path: "/models" },
      testCall: { method: "POST", path: "/chat/completions" },
    },
    defaults: { model: "moonshot-v1-8k", prompt: "你好，请回复 'pong'。", timeoutMs: 15000 },
    pricing: { currency: "CNY", unit: "per_1m_tokens", input: null, output: null },
    mapping: {
      models: { path: "data", item: "id" },
      text: { path: "choices.0.message.content" },
      usage: {
        input: "usage.prompt_tokens",
        output: "usage.completion_tokens",
        total: "usage.total_tokens",
      },
      error: { path: "error.message" },
    },
  },
  {
    id: "openrouter",
    name: "OpenRouter（中转，OpenAI 兼容）",
    baseUrl: "https://openrouter.ai/api/v1",
    auth: { type: "header", header: "Authorization", template: "Bearer {{apiKey}}" },
    endpoints: {
      listModels: { method: "GET", path: "/models" },
      testCall: { method: "POST", path: "/chat/completions" },
    },
    defaults: { model: "openai/gpt-4o-mini", prompt: "你好，请回复 'pong'。", timeoutMs: 20000 },
    pricing: { currency: "USD", unit: "per_1m_tokens", input: null, output: null },
    mapping: {
      models: { path: "data", item: "id" },
      text: { path: "choices.0.message.content" },
      usage: {
        input: "usage.prompt_tokens",
        output: "usage.completion_tokens",
        total: "usage.total_tokens",
      },
      error: { path: "error.message" },
    },
  },
  {
    id: "gemini",
    name: "Gemini（原生）",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    auth: { type: "query", query: "key", template: "{{apiKey}}" },
    endpoints: {
      listModels: { method: "GET", path: "/models" },
      testCall: { method: "POST", path: "/models/{{model}}:generateContent" },
    },
    defaults: { model: "gemini-1.5-flash", prompt: "你好，请回复 'pong'。", timeoutMs: 20000 },
    pricing: { currency: "USD", unit: "per_1m_tokens", input: null, output: null },
    mapping: {
      models: { path: "models", item: "name" },
      text: { path: "candidates.0.content.parts.0.text" },
      error: { path: "error.message" },
    },
  },
  {
    id: "claude",
    name: "Claude（Anthropic 原生）",
    baseUrl: "https://api.anthropic.com/v1",
    auth: { type: "header", header: "x-api-key", template: "{{apiKey}}" },
    staticHeaders: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    endpoints: {
      testCall: { method: "POST", path: "/messages" },
    },
    defaults: { model: "claude-3-5-sonnet-20241022", prompt: "你好，请回复 'pong'。", timeoutMs: 20000 },
    pricing: { currency: "USD", unit: "per_1m_tokens", input: null, output: null },
    mapping: {
      text: { path: "content.0.text" },
      usage: {
        input: "usage.input_tokens",
        output: "usage.output_tokens",
        total: "usage.total_tokens",
      },
      error: { path: "error.message" },
    },
  },
  {
    id: "custom-claude",
    name: "自定义（Claude/Anthropic 模板）",
    baseUrl: "https://example.com/v1",
    auth: { type: "header", header: "x-api-key", template: "{{apiKey}}" },
    staticHeaders: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    endpoints: {
      testCall: { method: "POST", path: "/messages" },
    },
    defaults: { model: "claude-3-5-sonnet-20241022", prompt: "你好，请回复 'pong'。", timeoutMs: 20000 },
    pricing: { currency: "USD", unit: "per_1m_tokens", input: null, output: null },
    mapping: {
      text: { path: "content.0.text" },
      usage: {
        input: "usage.input_tokens",
        output: "usage.output_tokens",
        total: "usage.total_tokens",
      },
      error: { path: "error.message" },
    },
  },
  {
    id: "qwen-compatible",
    name: "阿里百炼 Qwen（兼容模式）",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    auth: { type: "header", header: "Authorization", template: "Bearer {{apiKey}}" },
    endpoints: {
      listModels: { method: "GET", path: "/models" },
      testCall: { method: "POST", path: "/chat/completions" },
    },
    defaults: { model: "qwen-turbo", prompt: "你好，请回复 'pong'。", timeoutMs: 20000 },
    pricing: { currency: "CNY", unit: "per_1m_tokens", input: null, output: null },
    mapping: {
      text: { path: "choices.0.message.content" },
      usage: {
        input: "usage.prompt_tokens",
        output: "usage.completion_tokens",
        total: "usage.total_tokens",
      },
      error: { path: "error.message" },
    },
  },
  {
    id: "qwen-native",
    name: "阿里百炼 Qwen（原生 DashScope）",
    baseUrl: "https://dashscope.aliyuncs.com/api/v1",
    auth: { type: "header", header: "Authorization", template: "Bearer {{apiKey}}" },
    endpoints: {
      testCall: {
        method: "POST",
        path: "/services/aigc/text-generation/generation",
        bodyTemplate: {
          model: "{{model}}",
          input: { prompt: "{{prompt}}" },
          parameters: { result_format: "message" },
        },
      },
    },
    defaults: { model: "qwen-turbo", prompt: "你好，请回复 'pong'。", timeoutMs: 20000 },
    pricing: { currency: "CNY", unit: "per_1m_tokens", input: null, output: null },
    mapping: {
      text: { path: "output.choices.0.message.content" },
      usage: {
        input: "usage.input_tokens",
        output: "usage.output_tokens",
        total: "usage.total_tokens",
      },
      error: { path: "message" },
    },
  },
  {
    id: "zhipu",
    name: "智谱 GLM（模板）",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    auth: { type: "header", header: "Authorization", template: "Bearer {{apiKey}}" },
    endpoints: {
      testCall: { method: "POST", path: "/chat/completions" },
    },
    defaults: { model: "glm-4", prompt: "你好，请回复 'pong'。", timeoutMs: 20000 },
    pricing: { currency: "CNY", unit: "per_1m_tokens", input: null, output: null },
    mapping: {
      text: { path: "choices.0.message.content" },
      usage: {
        input: "usage.prompt_tokens",
        output: "usage.completion_tokens",
        total: "usage.total_tokens",
      },
      error: { path: "error.message" },
    },
  },
  {
    id: "doubao-ark",
    name: "豆包/火山方舟（模板）",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    auth: { type: "header", header: "Authorization", template: "Bearer {{apiKey}}" },
    endpoints: {
      testCall: { method: "POST", path: "/chat/completions" },
    },
    defaults: { model: "doubao-lite-4k", prompt: "你好，请回复 'pong'。", timeoutMs: 20000 },
    pricing: { currency: "CNY", unit: "per_1m_tokens", input: null, output: null },
    mapping: {
      text: { path: "choices.0.message.content" },
      usage: {
        input: "usage.prompt_tokens",
        output: "usage.completion_tokens",
        total: "usage.total_tokens",
      },
      error: { path: "error.message" },
    },
  },
  {
    id: "jimeng",
    name: "即梦 AI（模板）",
    baseUrl: "https://example.com",
    auth: { type: "header", header: "Authorization", template: "Bearer {{apiKey}}" },
    endpoints: {
      testCall: { method: "POST", path: "/chat/completions" },
    },
    defaults: { model: "", prompt: "你好，请回复 'pong'。", timeoutMs: 20000 },
    pricing: { currency: "CNY", unit: "per_1m_tokens", input: null, output: null },
    mapping: { error: { path: "error.message" } },
  },
  {
    id: "custom",
    name: "自定义（模板）",
    baseUrl: "https://example.com/v1",
    auth: { type: "header", header: "Authorization", template: "Bearer {{apiKey}}" },
    endpoints: {
      listModels: { method: "GET", path: "/models" },
      testCall: { method: "POST", path: "/chat/completions" },
    },
    defaults: { model: "", prompt: "你好，请回复 'pong'。", timeoutMs: 15000 },
    pricing: { currency: "USD", unit: "per_1m_tokens", input: null, output: null },
    mapping: { error: { path: "error.message" } },
  },
];
