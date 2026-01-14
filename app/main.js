import { renderProviderOptions, getSelectedProviderId } from "./ui/providers.js";
import { initTabs } from "./ui/tabs.js";
import { providerStore } from "./storage/providers.js";
import { buildRequest, runRequest, toPrettyResult, normalizeError } from "./net/request.js";
import { historyStore } from "./storage/history.js";
import { settingsStore } from "./storage/settings.js";
import { presetsStore } from "./storage/presets.js";
import { favoriteModelsStore } from "./storage/favoriteModels.js";

const els = {
  providerSelect: document.getElementById("providerSelect"),
  baseUrl: document.getElementById("baseUrl"),
  apiKey: document.getElementById("apiKey"),
  apiKeyHint: document.getElementById("apiKeyHint"),
  connectMode: document.getElementById("connectMode"),
  proxyBaseUrl: document.getElementById("proxyBaseUrl"),
  model: document.getElementById("model"),
  timeoutMs: document.getElementById("timeoutMs"),
  prompt: document.getElementById("prompt"),
  btnTest: document.getElementById("btnTest"),
  btnPing: document.getElementById("btnPing"),
  btnListModels: document.getElementById("btnListModels"),
  btnFullTest: document.getElementById("btnFullTest"),
  result: document.getElementById("result"),
  modelList: document.getElementById("modelList"),
  modelCount: document.getElementById("modelCount"),
  modelFilter: document.getElementById("modelFilter"),
  providerJson: document.getElementById("providerJson"),
  providerJsonHint: document.getElementById("providerJsonHint"),
  btnSaveProvider: document.getElementById("btnSaveProvider"),
  btnResetProvider: document.getElementById("btnResetProvider"),
  btnExportProviders: document.getElementById("btnExportProviders"),
  importProvidersFile: document.getElementById("importProvidersFile"),
  btnSaveToHistory: document.getElementById("btnSaveToHistory"),
  btnAddCard: document.getElementById("btnAddCard"),
  btnClearCards: document.getElementById("btnClearCards"),
  cardList: document.getElementById("cardList"),
  cardEditDialog: document.getElementById("cardEditDialog"),
  cardEditDialogTitle: document.getElementById("cardEditDialogTitle"),
  btnCloseCardEdit: document.getElementById("btnCloseCardEdit"),
  btnSaveCardEdit: document.getElementById("btnSaveCardEdit"),
  cardTitle: document.getElementById("cardTitle"),
  cardProvider: document.getElementById("cardProvider"),
  cardBaseUrl: document.getElementById("cardBaseUrl"),
  cardConnectMode: document.getElementById("cardConnectMode"),
  cardProxyBaseUrl: document.getElementById("cardProxyBaseUrl"),
  cardModel: document.getElementById("cardModel"),
  cardTimeoutMs: document.getElementById("cardTimeoutMs"),
  cardPrompt: document.getElementById("cardPrompt"),
  modelChipList: document.getElementById("modelChipList"),
  btnAddModel: document.getElementById("btnAddModel"),
  btnClearModels: document.getElementById("btnClearModels"),
  modelEditDialog: document.getElementById("modelEditDialog"),
  modelEditDialogTitle: document.getElementById("modelEditDialogTitle"),
  btnCloseModelEdit: document.getElementById("btnCloseModelEdit"),
  btnSaveModelEdit: document.getElementById("btnSaveModelEdit"),
  modelNameInput: document.getElementById("modelNameInput"),
  historyList: document.getElementById("historyList"),
  historySummary: document.getElementById("historySummary"),
  btnExportHistory: document.getElementById("btnExportHistory"),
  btnClearHistory: document.getElementById("btnClearHistory"),
  historyQuery: document.getElementById("historyQuery"),
  historyProviderFilter: document.getElementById("historyProviderFilter"),
  historyDialog: document.getElementById("historyDialog"),
  historyDialogBody: document.getElementById("historyDialogBody"),
  btnCloseHistoryDialog: document.getElementById("btnCloseHistoryDialog"),
  btnCopyHistoryJson: document.getElementById("btnCopyHistoryJson"),
  btnDeleteHistoryItem: document.getElementById("btnDeleteHistoryItem"),
};

let lastRun = null;
let lastModels = [];
let providers = providerStore.getProviders();
let historyDialogItemId = null;
let editingPresetId = null;
let editingModelId = null;
let draggingCardId = null;
let draggingModelId = null;

function setResult(text) {
  els.result.textContent = text;
}

function getProvider() {
  const id = getSelectedProviderId(els.providerSelect);
  return providers.find((p) => p.id === id) ?? providers[0];
}

function getProviderNameById(providerId) {
  const p = providers.find((x) => x.id === providerId);
  return p?.name || providerId || "未知 Provider";
}

function syncProviderToForm() {
  const provider = getProvider();
  els.baseUrl.value = provider.baseUrl;
  els.timeoutMs.value = String(provider.defaults.timeoutMs ?? 15000);
  els.prompt.value = provider.defaults.prompt ?? "你好，请回复 'pong'。";
  if (!els.model.value) els.model.value = provider.defaults.model ?? "";
  els.providerJson.value = JSON.stringify(provider, null, 2);
  els.providerJsonHint.textContent = providerStore.getProviderOverride(provider.id)
    ? "当前 Provider 使用了本地覆盖配置（已保存）。"
    : "当前 Provider 使用内置默认配置。";
}

function syncSettingsToForm() {
  const s = settingsStore.get();
  els.connectMode.value = s.useProxy ? "proxy" : "direct";
  els.proxyBaseUrl.value = s.proxyBaseUrl;
  els.proxyBaseUrl.disabled = !s.useProxy;
}

function capturePresetFromForm() {
  const provider = getProvider();
  const baseUrl = els.baseUrl.value.trim();
  const connectMode = els.connectMode?.value === "proxy" ? "proxy" : "direct";
  const proxyBaseUrl = els.proxyBaseUrl.value.trim();
  const model = els.model.value.trim();
  const prompt = els.prompt.value.trim();
  const timeoutMs = Number(els.timeoutMs.value || provider.defaults.timeoutMs || 15000);
  return {
    providerId: provider.id,
    baseUrl,
    connectMode,
    proxyBaseUrl,
    model,
    timeoutMs,
    prompt,
  };
}

function applyPresetToForm(p) {
  const exists = providers.some((x) => x.id === p.providerId);
  if (!exists) {
    setResult(`该记录的 Provider 不存在：${p.providerId}（可能已被你删除/覆盖配置）。`);
    return;
  }

  els.providerSelect.value = p.providerId;
  syncProviderToForm();

  els.baseUrl.value = String(p.baseUrl || "");
  els.model.value = String(p.model || "");
  els.timeoutMs.value = p.timeoutMs != null ? String(p.timeoutMs) : els.timeoutMs.value;
  els.prompt.value = String(p.prompt || "");

  const useProxy = p.connectMode === "proxy";
  const proxyBaseUrl = String(p.proxyBaseUrl || "http://127.0.0.1:8787");
  settingsStore.set({ useProxy, proxyBaseUrl });
  syncSettingsToForm();

  els.apiKey.value = "";
  syncApiKeyHint();
  setResult("已加载数字卡片配置；请再输入对应的 API Key 后使用。");
}

function openCardEditDialog(preset, mode = "edit") {
  if (!preset) return;
  editingPresetId = mode === "edit" ? preset.id || null : null;
  renderProviderOptions(els.cardProvider, providers);
  if (preset.providerId) els.cardProvider.value = preset.providerId;
  els.cardTitle.value = preset.title || "";
  els.cardBaseUrl.value = preset.baseUrl || "";
  els.cardConnectMode.value = preset.connectMode === "proxy" ? "proxy" : "direct";
  els.cardProxyBaseUrl.value = preset.proxyBaseUrl || "";
  els.cardProxyBaseUrl.disabled = els.cardConnectMode.value !== "proxy";
  els.cardModel.value = preset.model || "";
  els.cardTimeoutMs.value = preset.timeoutMs != null ? String(preset.timeoutMs) : "";
  els.cardPrompt.value = preset.prompt || "";
  if (els.cardEditDialogTitle) {
    els.cardEditDialogTitle.textContent = mode === "edit" ? "编辑数字卡片" : "新增数字卡片";
  }
  if (typeof els.cardEditDialog.showModal === "function") els.cardEditDialog.showModal();
}

function closeCardEditDialog() {
  editingPresetId = null;
  if (els.cardEditDialog?.open) els.cardEditDialog.close();
}

function openModelEditDialog(model, mode = "create") {
  editingModelId = mode === "edit" ? model?.id || null : null;
  els.modelNameInput.value = model?.name || "";
  if (els.modelEditDialogTitle) {
    els.modelEditDialogTitle.textContent = mode === "edit" ? "编辑常用模型" : "新增常用模型";
  }
  if (typeof els.modelEditDialog.showModal === "function") els.modelEditDialog.showModal();
}

function closeModelEditDialog() {
  editingModelId = null;
  if (els.modelEditDialog?.open) els.modelEditDialog.close();
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

function capturePresetFromCardDialog() {
  const title = els.cardTitle.value.trim();
  const providerId = getSelectedProviderId(els.cardProvider);
  const baseUrl = els.cardBaseUrl.value.trim();
  const connectMode = els.cardConnectMode.value === "proxy" ? "proxy" : "direct";
  const proxyBaseUrl = els.cardProxyBaseUrl.value.trim();
  const model = els.cardModel.value.trim();
  const prompt = els.cardPrompt.value.trim();
  const timeoutMs = Number(els.cardTimeoutMs.value || 15000);
  return {
    title,
    providerId,
    baseUrl,
    connectMode,
    proxyBaseUrl,
    model,
    timeoutMs,
    prompt,
  };
}

function buildCardPresetFromForm() {
  const provider = getProvider();
  const baseUrl = els.baseUrl.value.trim();
  const connectMode = els.connectMode?.value === "proxy" ? "proxy" : "direct";
  const proxyBaseUrl = els.proxyBaseUrl.value.trim();
  const model = els.model.value.trim();
  const prompt = els.prompt.value.trim();
  const timeoutMs = Number(els.timeoutMs.value || provider.defaults.timeoutMs || 15000);
  const providerName = getProviderNameById(provider.id);
  const title = suggestCardTitle(providerName, baseUrl);
  return {
    title,
    providerId: provider.id,
    baseUrl,
    connectMode,
    proxyBaseUrl,
    model,
    timeoutMs,
    prompt,
  };
}

function suggestCardTitle(providerName, baseUrl) {
  if (!baseUrl) return providerName || "未命名";
  try {
    const u = new URL(baseUrl);
    return `${providerName || "API"} · ${u.host}`;
  } catch {
    return providerName || "未命名";
  }
}

function renderPresets() {
  if (!els.cardList) return;
  const items = presetsStore.list();
  els.cardList.innerHTML = "";
  if (items.length === 0) {
    els.cardList.innerHTML = `<div class="muted">暂无数字卡片</div>`;
    return;
  }

  for (const [idx, it] of items.slice(0, 60).entries()) {
    const wrap = document.createElement("div");
    wrap.className = "config-card";
    wrap.dataset.id = it.id;
    wrap.setAttribute("draggable", "true");

    const providerName = getProviderNameById(it.providerId);
    const baseUrl = it.baseUrl || "-";
    const model = it.model || "-";
    const proxy = it.connectMode === "proxy" ? it.proxyBaseUrl || "-" : "-";
    const connectLabel = it.connectMode === "proxy" ? `本地代理 (${proxy})` : "浏览器直连";
    const timeout = it.timeoutMs != null ? `${it.timeoutMs}ms` : "-";
    const prompt = it.prompt ? shortText(it.prompt, 40) : "-";
    const number = String(idx + 1).padStart(2, "0");

    const title = it.title || providerName || "未命名";
    const subtitle = `${providerName} · ${baseUrl}`;

    wrap.innerHTML = `
      <div class="config-card__top">
        <div class="config-card__num">${escapeHtml(number)}</div>
        <div class="config-card__actions">
          <button class="btn btn--tiny" data-action="edit">编辑</button>
          <button class="btn btn--danger btn--tiny" data-action="delete">删除</button>
        </div>
      </div>
      <div class="config-card__title">${escapeHtml(title)}</div>
      <div class="config-card__subtitle">${escapeHtml(subtitle)}</div>
      <div class="config-card__rows">
        <div class="config-card__row">
          <div class="config-card__label">Base</div>
          <div class="config-card__value" title="${escapeHtml(baseUrl)}">${escapeHtml(baseUrl)}</div>
        </div>
        <div class="config-card__row">
          <div class="config-card__label">模型</div>
          <div class="config-card__value" title="${escapeHtml(model)}">${escapeHtml(model)}</div>
        </div>
        <div class="config-card__row">
          <div class="config-card__label">连接</div>
          <div class="config-card__value" title="${escapeHtml(connectLabel)}">${escapeHtml(connectLabel)}</div>
        </div>
        <div class="config-card__row">
          <div class="config-card__label">超时</div>
          <div class="config-card__value">${escapeHtml(timeout)}</div>
        </div>
        <div class="config-card__row">
          <div class="config-card__label">提示</div>
          <div class="config-card__value" title="${escapeHtml(it.prompt || "")}">${escapeHtml(prompt)}</div>
        </div>
      </div>
      <div class="config-card__hint">点击卡片可一键回填</div>
    `;

    wrap.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("button");
      const action = btn?.getAttribute?.("data-action");
      if (action === "delete") {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("确定要删除这条参数记录吗？")) return;
        presetsStore.delete(it.id);
        renderPresets();
        return;
      }
      if (action === "edit") {
        e.preventDefault();
        e.stopPropagation();
        openCardEditDialog(it);
        return;
      }
      applyPresetToForm(it);
    });

    wrap.addEventListener("dragstart", (e) => {
      draggingCardId = it.id;
      wrap.classList.add("is-dragging");
      if (e.dataTransfer) {
        e.dataTransfer.setData("text/plain", it.id);
        e.dataTransfer.effectAllowed = "move";
      }
    });
    wrap.addEventListener("dragend", () => {
      draggingCardId = null;
      wrap.classList.remove("is-dragging");
    });

    els.cardList.appendChild(wrap);
  }
}

function renderFavoriteModels() {
  if (!els.modelChipList) return;
  const items = favoriteModelsStore.list();
  els.modelChipList.innerHTML = "";
  if (items.length === 0) {
    els.modelChipList.innerHTML = `<div class="muted">暂无常用模型</div>`;
    return;
  }

  for (const it of items) {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.dataset.id = it.id;
    chip.setAttribute("draggable", "true");
    chip.innerHTML = `
      <span>${escapeHtml(it.name)}</span>
      <span class="chip__actions">
        <button class="chip__button" data-action="edit">编辑</button>
        <button class="chip__button chip__button--danger" data-action="delete">删除</button>
      </span>
    `;
    chip.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("button");
      const action = btn?.getAttribute?.("data-action");
      if (action === "delete") {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm("确定要删除这个常用模型吗？")) return;
        favoriteModelsStore.delete(it.id);
        renderFavoriteModels();
        return;
      }
      if (action === "edit") {
        e.preventDefault();
        e.stopPropagation();
        openModelEditDialog(it, "edit");
        return;
      }
      applyModelFromChip(it.name);
    });
    chip.addEventListener("dragstart", (e) => {
      draggingModelId = it.id;
      chip.classList.add("is-dragging");
      if (e.dataTransfer) {
        e.dataTransfer.setData("text/plain", it.id);
        e.dataTransfer.effectAllowed = "move";
      }
    });
    chip.addEventListener("dragend", () => {
      draggingModelId = null;
      chip.classList.remove("is-dragging");
    });
    els.modelChipList.appendChild(chip);
  }
}

function applyModelFromChip(name) {
  const value = String(name || "").trim();
  if (!value) return;
  els.model.value = value;
  copyToClipboard(value);
  setResult("已填充并复制模型名称到剪贴板。");
}

function reorderIds(ids, draggedId, targetId) {
  const list = ids.slice();
  const from = list.indexOf(draggedId);
  if (from < 0) return list;
  list.splice(from, 1);
  if (!targetId) {
    list.push(draggedId);
    return list;
  }
  const to = list.indexOf(targetId);
  if (to < 0) {
    list.push(draggedId);
    return list;
  }
  list.splice(to, 0, draggedId);
  return list;
}

function syncApiKeyHint() {
  const apiKey = (els.apiKey.value || "").trim();
  const provider = getProvider();
  if (!els.apiKeyHint) return;
  if (!apiKey) {
    els.apiKeyHint.textContent = "";
    return;
  }
  if (apiKey.startsWith("sk-ant-") && provider.auth?.header !== "x-api-key") {
    els.apiKeyHint.textContent =
      "检测到 Claude/Anthropic 风格的 Key（sk-ant-）。建议选择“Claude（Anthropic 原生）/ 自定义（Claude 模板）”，并确保使用 x-api-key + anthropic-version。";
    return;
  }
  if (apiKey.startsWith("sk-") && provider.auth?.header === "x-api-key") {
    els.apiKeyHint.textContent =
      "当前 Provider 使用 x-api-key 鉴权；如果你接入的是 OpenAI 兼容网关，通常应使用 Authorization: Bearer。";
    return;
  }
  els.apiKeyHint.textContent = "";
}

function normalizeModelItems(models) {
  if (!Array.isArray(models)) return [];
  if (models.length === 0) return [];
  if (typeof models[0] === "string") return models.map((id) => ({ id, meta: null }));
  if (models[0] && typeof models[0] === "object" && typeof models[0].id === "string") return models;
  return [];
}

function pickPricingForModel(provider, modelId) {
  const runtimeTable = Array.isArray(provider?.pricingTableRuntime) ? provider.pricingTableRuntime : [];
  const table = runtimeTable.concat(Array.isArray(provider?.pricingTable) ? provider.pricingTable : []);
  const defaults = provider?.pricing && typeof provider.pricing === "object" ? provider.pricing : null;

  let best = null;
  for (const row of table) {
    if (!row || typeof row !== "object") continue;
    const rule = String(row.match || "exact");
    const target = String(row.model || "");
    if (!target) continue;
    const ok = rule === "prefix" ? modelId.startsWith(target) : modelId === target;
    if (!ok) continue;
    const score = rule === "exact" ? 10_000 + target.length : target.length;
    if (!best || score > best.score) best = { row, score };
  }

  const base = best?.row ?? defaults;
  if (!base) return null;

  const currency = String(base.currency || "USD");
  const unit = String(base.unit || "per_1m_tokens");
  const input = toNumberOrNull(base.input);
  const output = toNumberOrNull(base.output);
  const allowZero = Boolean(base.allowZero);
  if (!allowZero && input === 0 && output === 0) return null;
  if (input == null && output == null) return null;
  return { currency, unit, input, output };
}

function formatRate(rate) {
  if (!rate) return "—";
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
  // 展示用，最多 6 位小数
  const s = String(Math.round(v * 1e6) / 1e6);
  return s;
}

function toNumberOrNull(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function renderModels(models) {
  const items = normalizeModelItems(models);
  lastModels = items;
  const filter = (els.modelFilter.value || "").trim().toLowerCase();
  const filtered = filter ? items.filter((m) => m.id.toLowerCase().includes(filter)) : items;
  els.modelCount.textContent = String(filtered.length);
  els.modelList.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "model-item";
    empty.innerHTML = `<div class="model-id muted">暂无模型</div><div class="model-meta"></div><div class="model-rate"></div><div></div>`;
    els.modelList.appendChild(empty);
    return;
  }

  const provider = getProvider();
  for (const m of filtered.slice(0, 300)) {
    const row = document.createElement("div");
    row.className = "model-item";
    const left = document.createElement("div");
    left.className = "model-id";
    left.textContent = m.id;

    const meta = document.createElement("div");
    meta.className = "model-meta muted";
    meta.textContent = m.meta ? m.meta : "";

    const rate = document.createElement("div");
    rate.className = "model-rate";
    rate.textContent = formatRate(pickPricingForModel(provider, m.id));

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "设为当前";
    btn.addEventListener("click", () => {
      els.model.value = m.id;
    });
    row.appendChild(left);
    row.appendChild(meta);
    row.appendChild(rate);
    row.appendChild(btn);
    els.modelList.appendChild(row);
  }
}

function renderHistory() {
  const items = applyHistoryFilters(historyStore.list());
  renderHistorySummary(items);
  els.historyList.innerHTML = "";
  if (items.length === 0) {
    els.historyList.innerHTML = `<div class="muted">暂无历史记录</div>`;
    return;
  }

  for (const item of items) {
    const wrap = document.createElement("div");
    wrap.className = "history-item";
    const ts = new Date(item.createdAt).toLocaleString();
    const status = item.response?.status ?? "-";
    const title = `${item.providerId} ${item.request?.method ?? ""} ${item.request?.url ?? ""}`;
    wrap.innerHTML = `
      <div class="history-item__top">
        <div class="history-item__title">${escapeHtml(ts)} · ${escapeHtml(title)}</div>
        <div class="history-item__status">${escapeHtml(String(status))}</div>
      </div>
      <div class="history-item__body">${escapeHtml(item.summary ?? "")}</div>
    `;
    wrap.addEventListener("click", () => openHistoryDialog(item));
    els.historyList.appendChild(wrap);
  }
}

function renderHistorySummary(items) {
  if (!els.historySummary) return;
  const total = items.length;
  let costTotal = 0;
  let currency = null;
  let costCount = 0;
  for (const it of items) {
    const c = it.costEstimate?.total;
    const cur = it.costEstimate?.currency;
    if (typeof c === "number" && Number.isFinite(c) && cur) {
      if (!currency) currency = cur;
      if (currency === cur) {
        costTotal += c;
        costCount++;
      }
    }
  }
  if (!currency || costCount === 0) {
    els.historySummary.textContent = `共 ${total} 条记录（费用估算：未配置或不可用）`;
    return;
  }
  const rounded = Math.round(costTotal * 1e6) / 1e6;
  els.historySummary.textContent = `共 ${total} 条记录 · 费用估算合计：${currency} ${rounded}（仅汇总同币种且可估算的 ${costCount} 条）`;
}

function applyHistoryFilters(items) {
  const q = (els.historyQuery?.value || "").trim().toLowerCase();
  const providerId = els.historyProviderFilter?.value || "";
  return items.filter((it) => {
    if (providerId && it.providerId !== providerId) return false;
    if (!q) return true;
    const hay = [
      it.providerId,
      it.request?.url,
      it.request?.method,
      it.summary,
      it.response?.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function openHistoryDialog(item) {
  historyDialogItemId = item.id ?? null;
  els.historyDialogBody.textContent = JSON.stringify(item, null, 2);
  if (typeof els.historyDialog.showModal === "function") els.historyDialog.showModal();
}

function closeHistoryDialog() {
  historyDialogItemId = null;
  if (els.historyDialog?.open) els.historyDialog.close();
}

async function copyHistoryJson() {
  const text = els.historyDialogBody.textContent || "";
  try {
    await navigator.clipboard.writeText(text);
    setResult("已复制历史 JSON 到剪贴板。");
  } catch {
    setResult("复制失败：当前浏览器可能不允许 clipboard API。");
  }
}

function deleteHistoryItem() {
  if (!historyDialogItemId) return;
  if (!confirm("确定要删除这条历史记录吗？")) return;
  historyStore.delete(historyDialogItemId);
  closeHistoryDialog();
  renderHistory();
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortText(text, maxLen) {
  const raw = String(text || "");
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, Math.max(0, maxLen - 3))}...`;
}

async function onTest() {
  els.btnTest.disabled = true;
  els.btnSaveToHistory.disabled = true;
  lastRun = null;
  setResult("请求中…");

  const provider = getProvider();
  const baseUrl = els.baseUrl.value.trim();
  const apiKey = els.apiKey.value.trim();
  const model = els.model.value.trim();
  const prompt = els.prompt.value.trim();
  const timeoutMs = Number(els.timeoutMs.value || provider.defaults.timeoutMs || 15000);

  try {
    const request = buildRequest({
      provider,
      baseUrl,
      apiKey,
      model,
      prompt,
      timeoutMs,
      endpointKey: "testCall",
    });

    let result = await runRequest(request);
    let pretty = toPrettyResult(result);

    // 常见第三方 Claude 网关：用户填了 .../xxx 但实际需要 .../xxx/v1/messages
    if (
      result.status === 404 &&
      isClaudeLikeProvider(provider) &&
      !baseUrl.replace(/\/+$/, "").endsWith("/v1") &&
      String(provider.endpoints.testCall?.path || "") === "/messages"
    ) {
      const fallbackBaseUrl = `${baseUrl.replace(/\/+$/, "")}/v1`;
      const fallbackReq = buildRequest({
        provider,
        baseUrl: fallbackBaseUrl,
        apiKey,
        model,
        prompt,
        timeoutMs,
        endpointKey: "testCall",
      });
      result = await runRequest(fallbackReq);
      pretty = toPrettyResult(result);
      pretty.text = `${pretty.text}\n\n[提示] 已自动尝试追加 /v1：${fallbackReq.url}`;
    }

    // 常见第三方 OpenAI 兼容网关：/chat/completions 不支持，但支持 /responses
    if (shouldTryResponsesFallback({ provider, baseUrl, result })) {
      const fallbackProvider = {
        ...provider,
        endpoints: { ...provider.endpoints, testCall: { method: "POST", path: "/responses" } },
      };
      const fallbackReq = buildRequest({
        provider: fallbackProvider,
        baseUrl,
        apiKey,
        model,
        prompt,
        timeoutMs,
        endpointKey: "testCall",
      });
      // 覆盖为 responses 体
      fallbackReq.body = { model, input: prompt, max_output_tokens: 128 };
      result = await runRequest(fallbackReq);
      pretty = toPrettyResult(result);
      pretty.text = `${pretty.text}\n\n[提示] 已自动尝试改用 /responses：${fallbackReq.url}`;
    }

    setResult(pretty.text);

    lastRun = {
      id: crypto.randomUUID(),
      providerId: provider.id,
      createdAt: Date.now(),
      request: { method: request.method, url: request.url, headersRedacted: request.headersRedacted, body: request.body ?? null },
      response: {
        status: result.status,
        latencyMs: result.latencyMs,
        contentType: result.contentType,
        bodySnippet: (result.rawText || "").slice(0, 2000),
      },
      usage: pretty.usage ?? null,
      costEstimate: pretty.cost ?? null,
      summary: pretty.text.slice(0, 1200),
    };
    els.btnSaveToHistory.disabled = false;
  } catch (e) {
    const err = normalizeError(e);
    setResult(`[错误]\n${err.kind}\n${err.message}`);
  } finally {
    els.btnTest.disabled = false;
  }
}

async function onListModels() {
  els.btnListModels.disabled = true;
  setResult("获取模型列表中…");
  renderModels([]);
  els.btnSaveToHistory.disabled = true;
  lastRun = null;

  const provider = getProvider();
  const candidates = [];
  if (provider.endpoints.listModels) {
    candidates.push({ ...provider, endpoints: { ...provider.endpoints } });
  } else {
    // 兜底：尽量用 OpenAI 兼容的 /models；若第三方把 v1 放在路径里，再试 /v1/models
    candidates.push({ ...provider, endpoints: { ...provider.endpoints, listModels: { method: "GET", path: "/models" } } });
    candidates.push({ ...provider, endpoints: { ...provider.endpoints, listModels: { method: "GET", path: "/v1/models" } } });
  }

  const baseUrl = els.baseUrl.value.trim();
  const apiKey = els.apiKey.value.trim();
  const timeoutMs = Number(els.timeoutMs.value || provider.defaults.timeoutMs || 15000);

  try {
    let final = null;
    for (const p of candidates) {
      const request = buildRequest({
        provider: p,
        baseUrl,
        apiKey,
        model: els.model.value.trim(),
        prompt: els.prompt.value.trim(),
        timeoutMs,
        endpointKey: "listModels",
      });
      const result = await runRequest(request);
      const pretty = toPrettyResult(result);

      // 成功且解析出模型，或明确不是 404（避免无意义重试）
      const models = pretty.models ?? [];
      const hasModels = Array.isArray(models) && models.length > 0;
      final = { request, result, pretty };
      if (result.ok && hasModels) break;
      if (result.status !== 404) break;
    }

    if (!final) throw new Error("模型列表请求未执行");
    const { request, result, pretty } = final;
    // 尝试从平台定价接口补齐费率（若存在）
    const pricingTableRuntime = await tryFetchPricingTableRuntime({ provider, baseUrl, apiKey, timeoutMs });
    if (pricingTableRuntime) {
      const ref = providers.find((p) => p.id === provider.id);
      if (ref) ref.pricingTableRuntime = pricingTableRuntime;
    }

    renderModels(pretty.modelItems ?? pretty.models ?? []);
    setResult(pretty.text);
    lastRun = {
      id: crypto.randomUUID(),
      providerId: provider.id,
      createdAt: Date.now(),
      request: { method: request.method, url: request.url, headersRedacted: request.headersRedacted, body: null },
      response: {
        status: result.status,
        latencyMs: result.latencyMs,
        contentType: result.contentType,
        bodySnippet: (result.rawText || "").slice(0, 2000),
      },
      costEstimate: pretty.cost ?? null,
      summary: pretty.text.slice(0, 1200),
    };
    els.btnSaveToHistory.disabled = false;
  } catch (e) {
    const err = normalizeError(e);
    setResult(`[错误]\n${err.kind}\n${err.message}`);
  } finally {
    els.btnListModels.disabled = false;
  }
}

async function tryFetchPricingTableRuntime({ provider, baseUrl, apiKey, timeoutMs }) {
  if (!apiKey) return null;

  // 仅在已知平台上自动尝试（避免对未知平台乱撞接口）
  const origin = safeOrigin(baseUrl);
  if (!origin) return null;

  const candidates = [];

  // VectorEngine：/v1/models/pricing（需 Bearer token）
  if (origin === "https://api.vectorengine.ai") {
    candidates.push({ method: "GET", url: `${baseUrl.replace(/\/+$/, "")}/models/pricing`, authHeader: "Authorization", authTemplate: "Bearer {{apiKey}}" });
    // 有些网关把 v1 放在根域名下
    candidates.push({ method: "GET", url: `${origin}/v1/models/pricing`, authHeader: "Authorization", authTemplate: "Bearer {{apiKey}}" });
  }

  if (candidates.length === 0) return null;

  for (const c of candidates) {
    try {
      const headers = new Headers();
      headers.set("accept", "application/json");
      headers.set(c.authHeader, c.authTemplate.replace("{{apiKey}}", apiKey));
      const request = {
        method: c.method,
        url: c.url,
        headers,
        headersRedacted: { [c.authHeader]: "***" },
        body: null,
        timeoutMs,
        provider,
      };
      const res = await runRequest(request);
      if (!res.ok || !res.json) continue;
      const table = parsePricingJsonToTable(res.json);
      if (table && table.length) return table;
    } catch {
      // ignore
    }
  }
  return null;
}

function safeOrigin(baseUrl) {
  try {
    const u = new URL(baseUrl);
    return u.origin;
  } catch {
    return null;
  }
}

function parsePricingJsonToTable(json) {
  const data = json?.data ?? json;
  const rows = [];

  // array form
  if (Array.isArray(data)) {
    for (const item of data) {
      const model = item?.model || item?.id || item?.name;
      const row = parseOnePricingRow(model, item);
      if (row) rows.push(row);
    }
    return rows;
  }

  // object map form: { "modelA": {...}, "modelB": {...} }
  if (data && typeof data === "object") {
    for (const [k, v] of Object.entries(data)) {
      const model = typeof k === "string" ? k : null;
      const row = parseOnePricingRow(model, v);
      if (row) rows.push(row);
    }
  }

  return rows;
}

function parseOnePricingRow(model, raw) {
  if (!model || typeof model !== "string") return null;
  if (!raw || typeof raw !== "object") return null;

  const currency = String(raw.currency || raw.ccy || raw.unit_currency || raw.money || "USD").toUpperCase();
  const unit = String(raw.unit || raw.per || raw.price_unit || "per_1m_tokens");

  // 注意：避免使用 raw.in / raw.out（部分环境可能把 in/out 视作关键字导致解析失败）
  const input = toNumberOrNull(
    raw.input ??
      raw.prompt ??
      raw["in"] ??
      raw.input_price ??
      raw.prompt_price ??
      raw.inputPrice,
  );
  const output = toNumberOrNull(
    raw.output ??
      raw.completion ??
      raw["out"] ??
      raw.output_price ??
      raw.completion_price ??
      raw.outputPrice,
  );
  if (input == null && output == null) return null;

  // runtime 表视为“明确配置”，允许 0 值展示
  return { match: "exact", model: model.trim(), currency: currency === "RMB" ? "CNY" : currency, unit, input, output, allowZero: true };
}

async function onPing() {
  els.btnPing.disabled = true;
  setResult("连通性测试中…");
  els.btnSaveToHistory.disabled = true;
  lastRun = null;

  const provider = getProvider();
  const baseUrl = els.baseUrl.value.trim();
  const apiKey = els.apiKey.value.trim();
  const timeoutMs = Number(els.timeoutMs.value || provider.defaults.timeoutMs || 15000);

  try {
    const pingPath = provider.endpoints.listModels?.path ? provider.endpoints.listModels.path : "";
    const request = buildRequest({
      provider: {
        ...provider,
        endpoints: { ...provider.endpoints, ping: { method: "GET", path: pingPath } },
      },
      baseUrl,
      apiKey,
      model: els.model.value.trim(),
      prompt: els.prompt.value.trim(),
      timeoutMs,
      endpointKey: "ping",
    });
    const result = await runRequest(request);
    const pretty = toPrettyResult(result);
    setResult(pretty.text);
    lastRun = {
      id: crypto.randomUUID(),
      providerId: provider.id,
      createdAt: Date.now(),
      request: { method: request.method, url: request.url, headersRedacted: request.headersRedacted, body: null },
      response: {
        status: result.status,
        latencyMs: result.latencyMs,
        contentType: result.contentType,
        bodySnippet: (result.rawText || "").slice(0, 2000),
      },
      costEstimate: pretty.cost ?? null,
      summary: pretty.text.slice(0, 1200),
    };
    els.btnSaveToHistory.disabled = false;
  } catch (e) {
    const err = normalizeError(e);
    setResult(`[错误]\n${err.kind}\n${err.message}`);
  } finally {
    els.btnPing.disabled = false;
  }
}

async function onFullTest() {
  els.btnFullTest.disabled = true;
  els.btnSaveToHistory.disabled = true;
  lastRun = null;
  renderModels([]);

  const provider = getProvider();
  const baseUrl = els.baseUrl.value.trim();
  const apiKey = els.apiKey.value.trim();
  const model = els.model.value.trim();
  const prompt = els.prompt.value.trim();
  const timeoutMs = Number(els.timeoutMs.value || provider.defaults.timeoutMs || 15000);

  const sections = [];
  try {
    // 1) ping
    try {
      const pingPath = provider.endpoints.listModels?.path ? provider.endpoints.listModels.path : "";
      const pingReq = buildRequest({
        provider: { ...provider, endpoints: { ...provider.endpoints, ping: { method: "GET", path: pingPath } } },
        baseUrl,
        apiKey,
        model,
        prompt,
        timeoutMs,
        endpointKey: "ping",
      });
      const pingRes = await runRequest(pingReq);
      sections.push("=== 基础连通 ===\n" + toPrettyResult(pingRes).text);
    } catch (e) {
      const err = normalizeError(e);
      sections.push(`=== 基础连通 ===\n[错误]\n${err.kind}\n${err.message}`);
    }

    // 2) list models (optional)
    if (provider.endpoints.listModels) {
      try {
        const listReq = buildRequest({ provider, baseUrl, apiKey, model, prompt, timeoutMs, endpointKey: "listModels" });
        const listRes = await runRequest(listReq);
        const pretty = toPrettyResult(listRes);
        renderModels(pretty.modelItems ?? pretty.models ?? []);
        sections.push("=== 模型列表 ===\n" + pretty.text);
      } catch (e) {
        const err = normalizeError(e);
        sections.push(`=== 模型列表 ===\n[错误]\n${err.kind}\n${err.message}`);
      }
    } else {
      sections.push("=== 模型列表 ===\n(该 Provider 未配置模型列表接口)");
    }

    // 3) test call
    try {
      let callReq = buildRequest({ provider, baseUrl, apiKey, model, prompt, timeoutMs, endpointKey: "testCall" });
      let callRes = await runRequest(callReq);
      let pretty = toPrettyResult(callRes);

      if (
        callRes.status === 404 &&
        isClaudeLikeProvider(provider) &&
        !baseUrl.replace(/\/+$/, "").endsWith("/v1") &&
        String(provider.endpoints.testCall?.path || "") === "/messages"
      ) {
        const fallbackBaseUrl = `${baseUrl.replace(/\/+$/, "")}/v1`;
        callReq = buildRequest({ provider, baseUrl: fallbackBaseUrl, apiKey, model, prompt, timeoutMs, endpointKey: "testCall" });
        callRes = await runRequest(callReq);
        pretty = toPrettyResult(callRes);
        pretty.text = `${pretty.text}\n\n[提示] 已自动尝试追加 /v1：${callReq.url}`;
      }

      if (shouldTryResponsesFallback({ provider, baseUrl, result: callRes })) {
        const fallbackProvider = { ...provider, endpoints: { ...provider.endpoints, testCall: { method: "POST", path: "/responses" } } };
        callReq = buildRequest({ provider: fallbackProvider, baseUrl, apiKey, model, prompt, timeoutMs, endpointKey: "testCall" });
        callReq.body = { model, input: prompt, max_output_tokens: 128 };
        callRes = await runRequest(callReq);
        pretty = toPrettyResult(callRes);
        pretty.text = `${pretty.text}\n\n[提示] 已自动尝试改用 /responses：${callReq.url}`;
      }

      sections.push("=== 最小调用 ===\n" + pretty.text);
      lastRun = {
        id: crypto.randomUUID(),
        providerId: provider.id,
        createdAt: Date.now(),
        request: {
          method: callReq.method,
          url: callReq.url,
          headersRedacted: callReq.headersRedacted,
          body: callReq.body ?? null,
        },
        response: {
          status: callRes.status,
          latencyMs: callRes.latencyMs,
          contentType: callRes.contentType,
          bodySnippet: (callRes.rawText || "").slice(0, 2000),
        },
        usage: pretty.usage ?? null,
        costEstimate: pretty.cost ?? null,
        summary: sections.join("\n\n").slice(0, 1200),
      };
      els.btnSaveToHistory.disabled = false;
    } catch (e) {
      const err = normalizeError(e);
      sections.push(`=== 最小调用 ===\n[错误]\n${err.kind}\n${err.message}`);
    }

    setResult(sections.join("\n\n"));
  } finally {
    els.btnFullTest.disabled = false;
  }
}

function isClaudeLikeProvider(provider) {
  return provider?.auth?.header === "x-api-key" || Boolean(provider?.staticHeaders?.["anthropic-version"]);
}

function isOpenAICompatChatProvider(provider) {
  return provider?.auth?.header === "Authorization" && String(provider?.endpoints?.testCall?.path || "") === "/chat/completions";
}

function shouldTryResponsesFallback({ provider, baseUrl, result }) {
  if (!isOpenAICompatChatProvider(provider)) return false;
  if (baseUrl.includes("/responses") || baseUrl.includes("/chat/completions")) return false;
  if (result.status !== 404 && result.status !== 400 && result.status !== 405) return false;
  const msg = result?.json?.error?.message;
  if (typeof msg === "string" && /暂不支持|not supported|unsupported|unknown endpoint/i.test(msg)) return true;
  if (result.status === 404) return true;
  return false;
}

function onSaveHistory() {
  if (!lastRun) return;
  historyStore.add(lastRun);
  renderHistory();
  els.btnSaveToHistory.disabled = true;
}

function download(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function onProviderJsonInput() {
  const raw = els.providerJson.value;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") throw new Error("必须是 JSON 对象");
    els.providerJsonHint.textContent = "JSON 格式正确（未保存）。";
  } catch (e) {
    els.providerJsonHint.textContent = `JSON 格式错误：${String(e?.message || e)}`;
  }
}

function reloadProviders(keepProviderId) {
  providers = providerStore.getProviders();
  renderProviderOptions(els.providerSelect, providers);
  if (keepProviderId && providers.some((p) => p.id === keepProviderId)) {
    els.providerSelect.value = keepProviderId;
  }
  syncProviderToForm();
  syncHistoryProviderFilterOptions();
}

function onSaveProvider() {
  const providerId = getSelectedProviderId(els.providerSelect);
  try {
    const obj = JSON.parse(els.providerJson.value);
    providerStore.saveProvider(obj);
    reloadProviders(obj.id);
    setResult(`已保存 Provider：${obj.id}`);
  } catch (e) {
    const msg = String(e?.message || e);
    els.providerJsonHint.textContent = `保存失败：${msg}`;
    setResult(`保存失败：${msg}`);
    reloadProviders(providerId);
  }
}

function onResetProvider() {
  const providerId = getSelectedProviderId(els.providerSelect);
  providerStore.resetProvider(providerId);
  reloadProviders(providerId);
  setResult(`已恢复默认 Provider：${providerId}`);
}

function onExportProviders() {
  const data = providerStore.exportOverrides();
  download(
    `api-test-providers-${new Date().toISOString().slice(0, 19).replaceAll(":", "")}.json`,
    JSON.stringify(data, null, 2),
  );
}

async function onImportProvidersFile(file) {
  const providerId = getSelectedProviderId(els.providerSelect);
  try {
    const text = await file.text();
    const obj = JSON.parse(text);
    providerStore.importOverrides(obj);
    reloadProviders(providerId);
    setResult("已导入 Provider 配置。");
  } catch (e) {
    const msg = String(e?.message || e);
    setResult(`导入失败：${msg}`);
  } finally {
    els.importProvidersFile.value = "";
  }
}

function onExportHistory() {
  const data = historyStore.list().slice().reverse();
  download(`api-test-history-${new Date().toISOString().slice(0, 19).replaceAll(":", "")}.json`, JSON.stringify(data, null, 2));
}

function onClearHistory() {
  if (!confirm("确定要清空历史记录吗？")) return;
  historyStore.clear();
  renderHistory();
}

function wireEvents() {
  els.providerSelect.addEventListener("change", () => {
    syncProviderToForm();
    syncApiKeyHint();
    renderModels([]);
    setResult("已切换 Provider。");
  });
  els.apiKey.addEventListener("input", syncApiKeyHint);
  els.modelFilter.addEventListener("input", () => renderModels(lastModels));
  els.btnTest.addEventListener("click", onTest);
  els.btnPing.addEventListener("click", onPing);
  els.btnListModels.addEventListener("click", onListModels);
  els.btnFullTest.addEventListener("click", onFullTest);
  els.btnSaveToHistory.addEventListener("click", onSaveHistory);
  els.btnAddCard?.addEventListener("click", () => {
    const preset = buildCardPresetFromForm();
    openCardEditDialog(preset, "create");
  });
  els.btnClearCards?.addEventListener("click", () => {
    if (!confirm("确定要清空所有数字卡片吗？")) return;
    presetsStore.clear();
    renderPresets();
    setResult("已清空所有数字卡片。");
  });
  els.btnExportHistory.addEventListener("click", onExportHistory);
  els.btnClearHistory.addEventListener("click", onClearHistory);
  els.historyQuery?.addEventListener("input", renderHistory);
  els.historyProviderFilter?.addEventListener("change", renderHistory);
  els.btnCloseHistoryDialog?.addEventListener("click", closeHistoryDialog);
  els.btnCopyHistoryJson?.addEventListener("click", () => void copyHistoryJson());
  els.btnDeleteHistoryItem?.addEventListener("click", deleteHistoryItem);
  els.btnCloseCardEdit?.addEventListener("click", closeCardEditDialog);
  els.btnSaveCardEdit?.addEventListener("click", () => {
    const preset = capturePresetFromCardDialog();
    if (!preset.title) {
      setResult("卡片标题为空，未保存修改。");
      return;
    }
    if (!preset.baseUrl) {
      setResult("Base URL 为空，未保存修改。");
      return;
    }
    if (editingPresetId) {
      presetsStore.update(editingPresetId, preset);
      setResult("已更新数字卡片（不含 API Key）。");
    } else {
      presetsStore.upsert(preset);
      setResult("已新增数字卡片（不含 API Key）。");
    }
    renderPresets();
    closeCardEditDialog();
  });
  els.cardConnectMode?.addEventListener("change", () => {
    els.cardProxyBaseUrl.disabled = els.cardConnectMode.value !== "proxy";
  });
  els.btnAddModel?.addEventListener("click", () => {
    openModelEditDialog({ name: "" }, "create");
  });
  els.btnClearModels?.addEventListener("click", () => {
    if (!confirm("确定要清空所有常用模型吗？")) return;
    favoriteModelsStore.clear();
    renderFavoriteModels();
    setResult("已清空所有常用模型。");
  });
  els.btnCloseModelEdit?.addEventListener("click", closeModelEditDialog);
  els.btnSaveModelEdit?.addEventListener("click", () => {
    const name = els.modelNameInput.value.trim();
    if (!name) {
      setResult("模型名称为空，未保存。");
      return;
    }
    if (editingModelId) {
      favoriteModelsStore.update(editingModelId, name);
      setResult("已更新常用模型。");
    } else {
      favoriteModelsStore.upsert(name);
      setResult("已新增常用模型。");
    }
    renderFavoriteModels();
    closeModelEditDialog();
  });
  els.cardList?.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  els.cardList?.addEventListener("drop", (e) => {
    e.preventDefault();
    const draggedId = draggingCardId || e.dataTransfer?.getData?.("text/plain");
    if (!draggedId) return;
    const target = e.target?.closest?.(".config-card");
    const targetId = target?.dataset?.id || null;
    const ids = presetsStore.list().map((it) => it.id);
    const next = reorderIds(ids, draggedId, targetId);
    if (next.join() === ids.join()) return;
    presetsStore.reorder(next);
    renderPresets();
    setResult("已更新卡片排序。");
  });
  els.modelChipList?.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  els.modelChipList?.addEventListener("drop", (e) => {
    e.preventDefault();
    const draggedId = draggingModelId || e.dataTransfer?.getData?.("text/plain");
    if (!draggedId) return;
    const target = e.target?.closest?.(".chip");
    const targetId = target?.dataset?.id || null;
    const ids = favoriteModelsStore.list().map((it) => it.id);
    const next = reorderIds(ids, draggedId, targetId);
    if (next.join() === ids.join()) return;
    favoriteModelsStore.reorder(next);
    renderFavoriteModels();
    setResult("已更新常用模型排序。");
  });

  els.connectMode?.addEventListener("change", () => {
    const useProxy = els.connectMode.value === "proxy";
    const proxyBaseUrl = els.proxyBaseUrl.value.trim() || "http://127.0.0.1:8787";
    settingsStore.set({ useProxy, proxyBaseUrl });
    syncSettingsToForm();
  });
  els.proxyBaseUrl?.addEventListener("change", () => {
    const proxyBaseUrl = els.proxyBaseUrl.value.trim() || "http://127.0.0.1:8787";
    settingsStore.set({ proxyBaseUrl });
    syncSettingsToForm();
  });

  els.providerJson.addEventListener("input", onProviderJsonInput);
  els.btnSaveProvider.addEventListener("click", onSaveProvider);
  els.btnResetProvider.addEventListener("click", onResetProvider);
  els.btnExportProviders.addEventListener("click", onExportProviders);
  els.importProvidersFile.addEventListener("change", () => {
    const f = els.importProvidersFile.files?.[0];
    if (f) void onImportProvidersFile(f);
  });
}

function syncHistoryProviderFilterOptions() {
  if (!els.historyProviderFilter) return;
  els.historyProviderFilter.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "全部 Provider";
  els.historyProviderFilter.appendChild(optAll);
  for (const p of providers) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    els.historyProviderFilter.appendChild(opt);
  }
}

function init() {
  initTabs();
  renderProviderOptions(els.providerSelect, providers);
  syncProviderToForm();
  syncSettingsToForm();
  syncApiKeyHint();
  wireEvents();
  syncHistoryProviderFilterOptions();
  renderHistory();
  renderPresets();
  renderFavoriteModels();
  renderModels([]);
  setResult("就绪。请选择厂商并开始测试。");
}

init();
