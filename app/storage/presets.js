import { safeJsonParse, safeJsonStringify } from "../util/misc.js";

const KEY = "apiTester.presets.v1";
const MAX = 60;

function load() {
  const raw = localStorage.getItem(KEY);
  const data = safeJsonParse(raw);
  if (!Array.isArray(data)) return [];
  return data;
}

function save(items) {
  localStorage.setItem(KEY, safeJsonStringify(items));
}

function normalizePreset(p) {
  const title = String(p?.title || "").trim();
  const providerId = String(p?.providerId || "").trim();
  const baseUrl = String(p?.baseUrl || "").trim();
  const connectMode = p?.connectMode === "proxy" ? "proxy" : "direct";
  const proxyBaseUrl = String(p?.proxyBaseUrl || "").trim();
  const model = String(p?.model || "").trim();
  const timeoutMs = Number(p?.timeoutMs);
  const prompt = String(p?.prompt || "").trim();
  const updatedAt = Number(p?.updatedAt || Date.now());
  const createdAt = Number(p?.createdAt || updatedAt);
  const id = String(p?.id || crypto.randomUUID());

  return {
    id,
    createdAt,
    updatedAt,
    title,
    providerId,
    baseUrl,
    connectMode,
    proxyBaseUrl,
    model,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : null,
    prompt,
  };
}

function fingerprint(p) {
  const obj = normalizePreset(p);
  return JSON.stringify({
    title: obj.title,
    providerId: obj.providerId,
    baseUrl: obj.baseUrl,
    connectMode: obj.connectMode,
    proxyBaseUrl: obj.proxyBaseUrl,
    model: obj.model,
    timeoutMs: obj.timeoutMs,
    prompt: obj.prompt,
  });
}

export const presetsStore = {
  list() {
    const items = load()
      .map(normalizePreset)
      .sort((a, b) => (a.updatedAt || 0) - (b.updatedAt || 0));
    // newest first for UI
    return items.slice().reverse();
  },
  upsert(preset) {
    const next = normalizePreset(preset);
    const sig = fingerprint(next);
    const items = load().map(normalizePreset);
    const idx = items.findIndex((it) => fingerprint(it) === sig);
    if (idx >= 0) {
      const cur = items[idx];
      items.splice(idx, 1);
      items.push({ ...cur, ...next, id: cur.id, createdAt: cur.createdAt, updatedAt: Date.now() });
    } else {
      items.push({ ...next, updatedAt: Date.now(), createdAt: next.createdAt || Date.now() });
    }
    while (items.length > MAX) items.shift();
    save(items);
  },
  update(id, preset) {
    const next = normalizePreset({ ...preset, id });
    const items = load().map(normalizePreset);
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) {
      items.push({ ...next, updatedAt: Date.now(), createdAt: next.createdAt || Date.now() });
    } else {
      const cur = items[idx];
      items.splice(idx, 1);
      items.push({ ...cur, ...next, id: cur.id, createdAt: cur.createdAt, updatedAt: Date.now() });
    }
    while (items.length > MAX) items.shift();
    save(items);
  },
  delete(id) {
    const items = load().map(normalizePreset);
    const next = items.filter((x) => x?.id !== id);
    save(next);
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};
