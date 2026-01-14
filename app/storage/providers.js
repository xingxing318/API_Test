import { safeJsonParse, safeJsonStringify } from "../util/misc.js";
import { providersBase } from "../providers.js";

const KEY = "apiTester.providerOverrides.v1";

function loadOverrides() {
  const raw = localStorage.getItem(KEY);
  const data = safeJsonParse(raw);
  if (!data || typeof data !== "object") return {};
  return data;
}

function saveOverrides(map) {
  localStorage.setItem(KEY, safeJsonStringify(map));
}

function validateProvider(p) {
  if (!p || typeof p !== "object") return "Provider 必须是对象";
  if (!p.id || typeof p.id !== "string") return "Provider 缺少 id";
  if (!p.name || typeof p.name !== "string") return "Provider 缺少 name";
  if (!p.baseUrl || typeof p.baseUrl !== "string") return "Provider 缺少 baseUrl";
  if (!p.endpoints || typeof p.endpoints !== "object") return "Provider 缺少 endpoints";
  if (!p.endpoints.testCall) return "Provider 缺少 endpoints.testCall";
  if (!p.endpoints.testCall.method || !p.endpoints.testCall.path) return "endpoints.testCall 需要 method/path";
  return null;
}

export const providerStore = {
  getProviders() {
    const overrides = loadOverrides();
    const byId = new Map();
    for (const p of providersBase) byId.set(p.id, p);
    for (const [id, override] of Object.entries(overrides)) {
      if (override && typeof override === "object" && override.id === id) byId.set(id, override);
    }
    return Array.from(byId.values());
  },
  getProviderOverride(id) {
    const overrides = loadOverrides();
    const v = overrides[id];
    return v && typeof v === "object" ? v : null;
  },
  saveProvider(provider) {
    const err = validateProvider(provider);
    if (err) throw new Error(err);
    const overrides = loadOverrides();
    overrides[provider.id] = provider;
    saveOverrides(overrides);
  },
  resetProvider(id) {
    const overrides = loadOverrides();
    delete overrides[id];
    saveOverrides(overrides);
  },
  exportOverrides() {
    return loadOverrides();
  },
  importOverrides(obj) {
    if (!obj || typeof obj !== "object") throw new Error("导入内容必须是 JSON 对象");
    const merged = {};
    for (const [id, p] of Object.entries(obj)) {
      if (!p || typeof p !== "object") continue;
      const err = validateProvider(p);
      if (err) throw new Error(`Provider(${id}) 校验失败：${err}`);
      merged[id] = p;
    }
    saveOverrides(merged);
  },
};

