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
  const order = Number.isFinite(Number(p?.order)) ? Number(p.order) : null;

  return {
    id,
    createdAt,
    updatedAt,
    order,
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
    const items = load().map(normalizePreset);
    const hasOrder = items.length > 0 && items.every((it) => Number.isFinite(it.order));
    if (hasOrder) return items.slice().sort((a, b) => a.order - b.order);
    return items.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
  upsert(preset) {
    const next = normalizePreset(preset);
    const sig = fingerprint(next);
    const items = load().map(normalizePreset);
    const hasOrder = items.length > 0 && items.every((it) => Number.isFinite(it.order));
    const maxOrder = hasOrder ? Math.max(...items.map((it) => it.order)) : -1;
    const idx = items.findIndex((it) => fingerprint(it) === sig);
    if (idx >= 0) {
      const cur = items[idx];
      items.splice(idx, 1);
      items.push({
        ...cur,
        ...next,
        id: cur.id,
        createdAt: cur.createdAt,
        updatedAt: Date.now(),
        order: cur.order ?? (hasOrder ? maxOrder + 1 : null),
      });
    } else {
      items.push({
        ...next,
        updatedAt: Date.now(),
        createdAt: next.createdAt || Date.now(),
        order: hasOrder ? maxOrder + 1 : null,
      });
    }
    while (items.length > MAX) items.shift();
    save(items);
  },
  update(id, preset) {
    const next = normalizePreset({ ...preset, id });
    const items = load().map(normalizePreset);
    const hasOrder = items.length > 0 && items.every((it) => Number.isFinite(it.order));
    const maxOrder = hasOrder ? Math.max(...items.map((it) => it.order)) : -1;
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) {
      items.push({
        ...next,
        updatedAt: Date.now(),
        createdAt: next.createdAt || Date.now(),
        order: hasOrder ? maxOrder + 1 : null,
      });
    } else {
      const cur = items[idx];
      items.splice(idx, 1);
      items.push({
        ...cur,
        ...next,
        id: cur.id,
        createdAt: cur.createdAt,
        updatedAt: Date.now(),
        order: cur.order ?? (hasOrder ? maxOrder + 1 : null),
      });
    }
    while (items.length > MAX) items.shift();
    save(items);
  },
  reorder(ids) {
    const items = load().map(normalizePreset);
    const map = new Map(items.map((it) => [it.id, it]));
    const ordered = [];
    for (const id of ids) {
      const hit = map.get(id);
      if (hit) ordered.push(hit);
      map.delete(id);
    }
    for (const rest of map.values()) ordered.push(rest);
    const next = ordered.map((it, idx) => ({ ...it, order: idx, updatedAt: Date.now() }));
    save(next);
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
