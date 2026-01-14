import { jsonGet, redactHeaders, renderTemplate } from "../util/misc.js";
import { settingsStore } from "../storage/settings.js";

export function buildRequest({ provider, baseUrl, apiKey, model, prompt, timeoutMs, endpointKey }) {
  const endpoint = provider.endpoints[endpointKey];
  if (!endpoint) throw new Error(`Provider 未配置 endpoint: ${endpointKey}`);

  const vars = {
    apiKey,
    model,
    prompt,
    nowIso: new Date().toISOString(),
  };

  const base = baseUrl.replace(/\/+$/, "");
  let endpointPath = renderTemplate(endpoint.path || "", vars);
  endpointPath = normalizeEndpointPath(base, endpointPath);
  const url = new URL(base + endpointPath);
  const headers = new Headers();

  if (provider.staticHeaders) {
    for (const [k, v] of Object.entries(provider.staticHeaders)) headers.set(k, String(v));
  }

  if (endpoint.headers && typeof endpoint.headers === "object") {
    for (const [k, v] of Object.entries(endpoint.headers)) headers.set(k, renderTemplate(String(v), vars));
  }

  if (provider.auth?.type === "header") {
    headers.set(provider.auth.header, renderTemplate(provider.auth.template, vars));
  }
  if (provider.auth?.type === "query") {
    url.searchParams.set(provider.auth.query, renderTemplate(provider.auth.template, vars));
  }

  if (endpoint.query && typeof endpoint.query === "object") {
    for (const [k, v] of Object.entries(endpoint.query)) url.searchParams.set(k, renderTemplate(String(v), vars));
  }

  let body = null;
  if (endpointKey === "testCall" || endpoint.method !== "GET") {
    if (endpoint.bodyTemplate) {
      body = deepRender(endpoint.bodyTemplate, vars);
    } else if (endpointKey === "testCall") {
      body = buildDefaultBody(provider.id, { model, prompt });
    }
    if (body != null) headers.set("content-type", "application/json");
  }

  const headersRedacted = redactHeaders(Object.fromEntries(headers.entries()));

  return {
    method: endpoint.method,
    url: url.toString(),
    headers,
    headersRedacted,
    body,
    timeoutMs,
    provider,
  };
}

function normalizeEndpointPath(base, path) {
  if (!path) return "";
  const normalized = path.startsWith("/") ? path : `/${path}`;

  // 避免 baseUrl 已包含 /v1 但 path 又以 /v1 开头，导致 /v1/v1/...
  // 典型场景：用户填 https://host/xxx/v1，同时模板使用 /v1/chat/completions
  if (base.endsWith("/v1")) {
    if (normalized === "/v1") return "";
    if (normalized.startsWith("/v1/")) return normalized.slice(3);
  }
  return normalized;
}

function deepRender(value, vars) {
  if (typeof value === "string") return renderTemplate(value, vars);
  if (Array.isArray(value)) return value.map((v) => deepRender(v, vars));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepRender(v, vars);
    return out;
  }
  return value;
}

function buildDefaultBody(providerId, { model, prompt }) {
  if (providerId === "gemini") {
    return {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    };
  }
  if (providerId === "claude") {
    return {
      model,
      max_tokens: 64,
      messages: [{ role: "user", content: prompt }],
    };
  }
  // OpenAI-compatible default
  return {
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 128,
  };
}

export async function runRequest(request) {
  const settings = settingsStore.get();
  if (settings.useProxy) {
    return runRequestViaProxy(request, settings.proxyBaseUrl);
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), request.timeoutMs);
  const startedAt = performance.now();

  try {
    const res = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ? JSON.stringify(request.body) : undefined,
      signal: controller.signal,
    });

    const latencyMs = Math.round(performance.now() - startedAt);
    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const rawText = await res.text();
    const json = isJson ? safeJsonParse(rawText) : null;

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      latencyMs,
      contentType,
      rawText,
      json,
      request,
    };
  } finally {
    clearTimeout(t);
  }
}

async function runRequestViaProxy(request, proxyBaseUrl) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), request.timeoutMs);
  const startedAt = performance.now();

  try {
    const proxyUrl = new URL("/proxy", proxyBaseUrl).toString();
    const payload = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: request.body ?? null,
      timeoutMs: request.timeoutMs,
    };
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    const rawText = await res.text();
    const json = safeJsonParse(rawText);

    if (!json || typeof json !== "object") {
      return {
        ok: false,
        status: res.status,
        statusText: res.statusText,
        latencyMs,
        contentType: res.headers.get("content-type") || "",
        rawText,
        json: null,
        request,
      };
    }

    const upstreamBody = typeof json.body === "string" ? json.body : "";
    const upstreamContentType = typeof json.contentType === "string" ? json.contentType : "";
    const upstreamJson = upstreamContentType.includes("application/json") ? safeJsonParse(upstreamBody) : null;
    return {
      ok: Boolean(json.ok),
      status: Number(json.status ?? 0),
      statusText: String(json.statusText ?? ""),
      latencyMs,
      contentType: upstreamContentType,
      rawText: upstreamBody,
      json: upstreamJson,
      request,
    };
  } finally {
    clearTimeout(t);
  }
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function toPrettyResult(result) {
  const { provider } = result.request;
  const mapping = provider.mapping || {};

  const modelItems = mapping.models?.path ? extractModelItems(result.json, mapping.models) : autoExtractModelItems(result.json);
  const models = modelItems ? modelItems.map((x) => x.id) : null;
  let text = mapping.text?.path ? jsonGet(result.json, mapping.text.path) : null;
  if (text == null) text = autoExtractText(result.json);
  if (text == null) {
    const sse = tryParseSse(result.rawText);
    if (sse?.text) text = sse.text;
  }

  let usage = mapping.usage ? extractUsage(result.json, mapping.usage) : null;
  if (!usage || (usage.inputTokens == null && usage.outputTokens == null && usage.totalTokens == null)) {
    const u2 = autoExtractUsage(result.json);
    if (u2) usage = u2;
  }
  if (!usage || (usage.inputTokens == null && usage.outputTokens == null && usage.totalTokens == null)) {
    const sse = tryParseSse(result.rawText);
    if (sse?.usage) usage = sse.usage;
  }
  const requestModel = inferRequestModel(result.request);
  const pricingTable = mergePricingTables(provider);
  const rate = requestModel ? pickPricing({ model: requestModel, pricing: provider.pricing, pricingTable }) : null;
  const cost = usage && rate ? estimateCost({ usage, rate }) : null;
  const errMsg = mapping.error?.path ? jsonGet(result.json, mapping.error.path) : null;
  const hint = buildHint({ provider, result, requestModel });

  const lines = [];
  lines.push(`[HTTP] ${result.status} ${result.statusText} · ${result.latencyMs}ms`);
  lines.push(`[URL] ${result.request.url}`);
  if (!result.ok) {
    lines.push("");
    lines.push(`[错误信息] ${errMsg || "(未解析到标准错误字段)"}`);
    if (hint) lines.push(`\n[提示] ${hint}`);
  }

  if (models && Array.isArray(models)) {
    lines.push("");
    lines.push(`[模型数量] ${models.length}`);
    lines.push(
      modelItems
        .slice(0, 30)
        .map((m) => (m.meta ? `${m.id}  [${m.meta}]` : m.id))
        .join("\n"),
    );
    if (models.length > 30) lines.push(`…（仅展示前 30）`);
  }

  if (text) {
    lines.push("");
    lines.push("[响应文本]");
    lines.push(String(text));
  }

  if (usage && (usage.inputTokens || usage.outputTokens || usage.totalTokens)) {
    lines.push("");
    const input = formatTokenUsage(usage.inputTokens);
    const output = formatTokenUsage(usage.outputTokens);
    const total = formatTokenUsage(usage.totalTokens);
    lines.push(`[Usage] input=${input} output=${output} total=${total} tokens`);
  }

  if (requestModel) {
    lines.push("");
    lines.push(`[费率] ${formatRate(rate)}`);
  }

  if (cost?.total != null) {
    lines.push("");
    lines.push(`[费用估算] input=${fmtMoney(cost.input, cost.currency)} output=${fmtMoney(cost.output, cost.currency)} total=${fmtMoney(cost.total, cost.currency)}（${cost.unitLabel}）`);
  }

  if (!models && !text && result.rawText) {
    lines.push("");
    lines.push("[响应原文摘要]");
    lines.push(result.rawText.slice(0, 1200));
    if (result.rawText.length > 1200) lines.push("…（截断）");
  }

  return {
    text: lines.join("\n"),
    models: models ?? undefined,
    modelItems: modelItems ?? undefined,
    usage: usage ?? undefined,
    cost: cost ?? undefined,
  };
}

function mergePricingTables(provider) {
  const runtime = Array.isArray(provider?.pricingTableRuntime) ? provider.pricingTableRuntime : [];
  const base = Array.isArray(provider?.pricingTable) ? provider.pricingTable : [];
  return runtime.concat(base);
}

function formatRate(rate) {
  if (!rate) return "未配置（可在配置页设置 pricing/pricingTable，或先“获取模型列表”尝试自动获取）";
  const symbol = rate.currency === "USD" ? "$" : rate.currency === "CNY" ? "¥" : `${rate.currency} `;
  const unitLabel = rate.unit === "per_1k_tokens" ? "/1K tok" : "/1M tok";
  const inPart = rate.input != null ? `${symbol}${trimMoney(rate.input)}` : null;
  const outPart = rate.output != null ? `${symbol}${trimMoney(rate.output)}` : null;
  if (inPart && outPart) return `${inPart}/${outPart} ${unitLabel}`;
  if (inPart) return `${inPart} ${unitLabel}`;
  return `${outPart} ${unitLabel}`;
}

function trimMoney(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return String(v);
  return String(Math.round(v * 1e6) / 1e6);
}

function tryParseSse(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trimStart();
  if (!trimmed.startsWith("data:") && !trimmed.includes("\ndata:")) return null;

  const chunks = [];
  for (const line of rawText.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      chunks.push(JSON.parse(payload));
    } catch {
      // ignore non-json data frames
    }
  }
  if (chunks.length === 0) return null;

  const parts = [];
  let usage = null;
  for (const obj of chunks) {
    // OpenAI chat.completion.chunk
    const delta = jsonGet(obj, "choices.0.delta.content");
    if (typeof delta === "string" && delta.length) parts.push(delta);

    // Some gateways may emit final message content
    const msg = jsonGet(obj, "choices.0.message.content");
    if (typeof msg === "string" && msg.length) parts.push(msg);

    const u = autoExtractUsage(obj);
    if (u && (u.inputTokens != null || u.outputTokens != null || u.totalTokens != null)) usage = u;
  }

  const text = parts.join("");
  if (!text && !usage) return null;
  return { text: text || null, usage };
}

function buildHint({ provider, result, requestModel }) {
  const isClaude = provider?.auth?.header === "x-api-key" || Boolean(provider?.staticHeaders?.["anthropic-version"]);
  const isOpenAICompat = provider?.auth?.header === "Authorization";

  const openaiStyleError = Boolean(result?.json?.error && typeof result.json.error === "object" && typeof result.json.error.message === "string");
  const anthropicStyleError = Boolean(result?.json?.type === "error" || result?.json?.error?.type);

  if (result.status === 404 && isClaude && String(provider.endpoints?.testCall?.path || "") === "/messages") {
    return "看起来该网关不支持 /messages 路径。若它是 Claude 网关通常需要 baseURL 以 /v1 结尾（例如 …/v1），或改用网关支持的路径。";
  }

  if (result.status === 400 && isClaude && openaiStyleError) {
    return "该服务返回的是 OpenAI 兼容风格错误，可能不是 Anthropic /messages 协议。可尝试切换到“自定义（模板）”(Authorization: Bearer) 并调用 /chat/completions。";
  }

  if (result.status === 400 && isOpenAICompat && anthropicStyleError) {
    return "该服务返回的是 Anthropic/Claude 风格错误，可能需要使用 x-api-key + anthropic-version 并调用 /messages。";
  }

  if (result.status === 400 && requestModel) {
    return `请求的模型可能在该平台未开通或不支持：${requestModel}。建议先点“获取模型列表”选择列表中的模型再测。`;
  }

  return null;
}

function extractModels(json, spec) {
  const arr = jsonGet(json, spec.path);
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const item of arr) {
    const v = typeof spec.item === "string" ? jsonGet(item, spec.item) : item;
    if (typeof v === "string" && v.trim()) out.push(v.trim());
  }
  return out;
}

function extractModelItems(json, spec) {
  const arr = jsonGet(json, spec.path);
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const item of arr) {
    const rawId = typeof spec.item === "string" ? jsonGet(item, spec.item) : item;
    const id = normalizeModelId(rawId);
    if (!id) continue;
    const limits = extractTokenLimits(item);
    out.push({ id, meta: formatLimitsMeta(limits), limits, raw: item });
  }
  return out;
}

function autoExtractModelItems(json) {
  if (!json || typeof json !== "object") return null;

  // OpenAI / OpenAI-compatible: { data: [{ id: "...", ... }, ...] }
  if (Array.isArray(json.data)) {
    const out = [];
    for (const item of json.data) {
      const id = normalizeModelId(item && typeof item === "object" ? item.id : item);
      if (!id) continue;
      const limits = extractTokenLimits(item);
      out.push({ id, meta: formatLimitsMeta(limits), limits, raw: item });
    }
    return out;
  }

  // Gemini: { models: [{ name: "models/...", inputTokenLimit, outputTokenLimit, ... }, ...] }
  if (Array.isArray(json.models)) {
    const out = [];
    for (const item of json.models) {
      const id = normalizeModelId(item && typeof item === "object" ? item.name : item);
      if (!id) continue;
      const limits = extractTokenLimits(item);
      out.push({ id, meta: formatLimitsMeta(limits), limits, raw: item });
    }
    return out;
  }

  // Some gateways: { data: ["modelA", "modelB"] } or { models: ["..."] }
  if (Array.isArray(json.data) && json.data.every((x) => typeof x === "string")) return json.data.map((id) => ({ id, meta: null, limits: null, raw: id }));
  if (Array.isArray(json.models) && json.models.every((x) => typeof x === "string"))
    return json.models.map((id) => ({ id, meta: null, limits: null, raw: id }));

  return null;
}

function normalizeModelId(raw) {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  // Gemini often returns "models/xxx"
  if (s.startsWith("models/")) return s.slice("models/".length);
  return s;
}

function extractTokenLimits(raw) {
  if (!raw || typeof raw !== "object") return null;
  const get = (k) => toNumberOrNull(raw[k]);

  const context =
    get("context_length") ??
    get("contextLength") ??
    get("max_context_tokens") ??
    get("maxContextTokens") ??
    get("context_window") ??
    get("contextWindow") ??
    get("max_tokens") ??
    get("maxTokens");

  const input =
    get("max_input_tokens") ??
    get("maxInputTokens") ??
    get("input_token_limit") ??
    get("inputTokenLimit") ??
    get("prompt_token_limit") ??
    get("promptTokenLimit");

  const output =
    get("max_output_tokens") ??
    get("maxOutputTokens") ??
    get("output_token_limit") ??
    get("outputTokenLimit") ??
    get("completion_token_limit") ??
    get("completionTokenLimit");

  if (context == null && input == null && output == null) return null;
  return { context, input, output };
}

function formatLimitsMeta(limits) {
  if (!limits) return null;
  const ctx = limits.context != null ? formatTokenCount(limits.context) : null;
  const input = limits.input != null ? formatTokenCount(limits.input) : null;
  const output = limits.output != null ? formatTokenCount(limits.output) : null;
  if (input || output) {
    if (input && output) return `in ${input} / out ${output}`;
    if (input) return `in ${input}`;
    return `out ${output}`;
  }
  if (ctx) return `ctx ${ctx}`;
  return null;
}

function formatTokenCount(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return String(n);
  if (n >= 1_000_000) return `${trimZeros((n / 1_000_000).toFixed(2))}m`;
  if (n >= 10_000) return `${trimZeros((n / 1_000).toFixed(0))}k`;
  if (n >= 1_000) return `${trimZeros((n / 1_000).toFixed(1))}k`;
  return String(n);
}

function trimZeros(s) {
  return s.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function autoExtractModels(json) {
  if (!json || typeof json !== "object") return null;

  // OpenAI / OpenAI-compatible: { data: [{ id: "..." }, ...] }
  if (Array.isArray(json.data) && (json.data.length === 0 || typeof json.data[0] === "object")) {
    const out = [];
    for (const item of json.data) {
      const id = item && typeof item === "object" ? item.id : null;
      if (typeof id === "string" && id.trim()) out.push(id.trim());
    }
    return out.length ? out : [];
  }

  // Gemini: { models: [{ name: "models/..." }, ...] }
  if (Array.isArray(json.models)) {
    const out = [];
    for (const item of json.models) {
      const name = item && typeof item === "object" ? item.name : null;
      if (typeof name === "string" && name.trim()) out.push(name.trim());
    }
    return out.length ? out : [];
  }

  // Some gateways: { data: ["modelA", "modelB"] } or { models: ["..."] }
  if (Array.isArray(json.data) && json.data.every((x) => typeof x === "string")) return json.data;
  if (Array.isArray(json.models) && json.models.every((x) => typeof x === "string")) return json.models;

  return null;
}

function autoExtractText(json) {
  if (!json || typeof json !== "object") return null;

  // OpenAI chat completions
  const chat = jsonGet(json, "choices.0.message.content");
  if (typeof chat === "string" && chat.trim()) return chat;

  // OpenAI responses
  const outText = jsonGet(json, "output_text");
  if (typeof outText === "string" && outText.trim()) return outText;
  const resp = jsonGet(json, "output.0.content.0.text");
  if (typeof resp === "string" && resp.trim()) return resp;

  // Anthropic
  const claude = jsonGet(json, "content.0.text");
  if (typeof claude === "string" && claude.trim()) return claude;

  // Gemini
  const gem = jsonGet(json, "candidates.0.content.parts.0.text");
  if (typeof gem === "string" && gem.trim()) return gem;

  return null;
}

function extractUsage(json, spec) {
  const inputTokens = toNumberOrNull(jsonGet(json, spec.input));
  const outputTokens = toNumberOrNull(jsonGet(json, spec.output));
  const totalTokens = toNumberOrNull(jsonGet(json, spec.total));
  return { inputTokens, outputTokens, totalTokens };
}

function autoExtractUsage(json) {
  if (!json || typeof json !== "object") return null;

  // OpenAI chat completions
  const prompt = toNumberOrNull(jsonGet(json, "usage.prompt_tokens"));
  const completion = toNumberOrNull(jsonGet(json, "usage.completion_tokens"));
  const total = toNumberOrNull(jsonGet(json, "usage.total_tokens"));
  if (prompt != null || completion != null || total != null) return { inputTokens: prompt, outputTokens: completion, totalTokens: total };

  // OpenAI responses / Anthropic
  const input = toNumberOrNull(jsonGet(json, "usage.input_tokens"));
  const output = toNumberOrNull(jsonGet(json, "usage.output_tokens"));
  const total2 = toNumberOrNull(jsonGet(json, "usage.total_tokens"));
  if (input != null || output != null || total2 != null) return { inputTokens: input, outputTokens: output, totalTokens: total2 };

  // Gemini
  const gIn = toNumberOrNull(jsonGet(json, "usageMetadata.promptTokenCount"));
  const gOut = toNumberOrNull(jsonGet(json, "usageMetadata.candidatesTokenCount"));
  const gTotal = toNumberOrNull(jsonGet(json, "usageMetadata.totalTokenCount"));
  if (gIn != null || gOut != null || gTotal != null) return { inputTokens: gIn, outputTokens: gOut, totalTokens: gTotal };

  return null;
}

function toNumberOrNull(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function inferRequestModel(request) {
  const bodyModel = request.body?.model;
  if (typeof bodyModel === "string" && bodyModel.trim()) return bodyModel.trim();

  // Gemini: /models/{model}:generateContent
  try {
    const u = new URL(request.url);
    const m = u.pathname.match(/\/models\/([^/:]+)(?::|$)/);
    if (m && m[1]) return decodeURIComponent(m[1]);
  } catch {
    // ignore
  }
  return null;
}

function pickPricing({ model, pricing, pricingTable }) {
  const table = Array.isArray(pricingTable) ? pricingTable : [];
  if (model) {
    for (const row of table) {
      if (!row || typeof row !== "object") continue;
      const rule = String(row.match || "exact");
      const target = String(row.model || "");
      if (!target) continue;
      const ok = rule === "prefix" ? model.startsWith(target) : model === target;
      if (!ok) continue;
      return {
        currency: row.currency ?? pricing?.currency,
        unit: row.unit ?? pricing?.unit,
        input: row.input,
        output: row.output,
        matchedModel: target,
        matchedRule: rule,
        allowZero: row.allowZero ?? pricing?.allowZero,
      };
    }
  }
  if (pricing && typeof pricing === "object") {
    return { currency: pricing.currency, unit: pricing.unit, input: pricing.input, output: pricing.output, allowZero: pricing.allowZero };
  }
  return null;
}

function estimateCost({ usage, rate }) {
  const currency = String(rate.currency || "USD");
  const unit = String(rate.unit || "per_1m_tokens");
  const inputRate = toNumberOrNull(rate.input);
  const outputRate = toNumberOrNull(rate.output);
  if (inputRate == null || outputRate == null) return null;
  if (!rate.allowZero && inputRate === 0 && outputRate === 0) return null;

  const inputTokens = usage.inputTokens;
  const outputTokens = usage.outputTokens;
  if (inputTokens == null || outputTokens == null) return null;

  const scale = unit === "per_1k_tokens" ? 1000 : 1_000_000;
  const unitLabel = unit === "per_1k_tokens" ? "每 1K tokens" : "每 1M tokens";
  const input = (inputTokens * inputRate) / scale;
  const output = (outputTokens * outputRate) / scale;
  const total = input + output;

  return { currency, unit, unitLabel, input, output, total };
}

function fmtMoney(v, currency) {
  if (v == null || !Number.isFinite(v)) return "-";
  const x = Math.round(v * 1e6) / 1e6;
  return `${currency} ${x}`;
}

function formatTokenUsage(n) {
  if (n == null) return "-";
  if (typeof n !== "number" || !Number.isFinite(n)) return String(n);
  if (n < 1000) return String(n);
  return `${formatTokenCount(n)}(${n})`;
}

export function normalizeError(e) {
  if (e?.name === "AbortError") return { kind: "TIMEOUT", message: "请求超时（AbortError）" };
  if (e instanceof TypeError) return { kind: "NETWORK_OR_CORS", message: e.message || "网络错误或被 CORS 拦截" };
  return { kind: "UNKNOWN", message: String(e?.message || e) };
}
