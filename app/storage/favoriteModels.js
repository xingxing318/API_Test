import { safeJsonParse, safeJsonStringify } from "../util/misc.js";

const KEY = "apiTester.favoriteModels.v1";
const MAX = 120;

function load() {
  const raw = localStorage.getItem(KEY);
  const data = safeJsonParse(raw);
  if (!Array.isArray(data)) return [];
  return data;
}

function save(items) {
  localStorage.setItem(KEY, safeJsonStringify(items));
}

function normalize(item) {
  const name = String(item?.name || "").trim();
  const updatedAt = Number(item?.updatedAt || Date.now());
  const createdAt = Number(item?.createdAt || updatedAt);
  const id = String(item?.id || crypto.randomUUID());
  const order = Number.isFinite(Number(item?.order)) ? Number(item.order) : null;
  return { id, name, createdAt, updatedAt, order };
}

export const favoriteModelsStore = {
  list() {
    const items = load()
      .map(normalize)
      .filter((it) => it.name);
    const hasOrder = items.length > 0 && items.every((it) => Number.isFinite(it.order));
    if (hasOrder) return items.slice().sort((a, b) => a.order - b.order);
    return items.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
  upsert(name) {
    const next = normalize({ name });
    const items = load().map(normalize);
    const hasOrder = items.length > 0 && items.every((it) => Number.isFinite(it.order));
    const maxOrder = hasOrder ? Math.max(...items.map((it) => it.order)) : -1;
    const idx = items.findIndex((it) => it.name.toLowerCase() === next.name.toLowerCase());
    if (idx >= 0) {
      const cur = items[idx];
      items.splice(idx, 1);
      items.push({
        ...cur,
        name: next.name,
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
  update(id, name) {
    const nextName = String(name || "").trim();
    if (!nextName) return;
    const items = load().map(normalize);
    const hasOrder = items.length > 0 && items.every((it) => Number.isFinite(it.order));
    const maxOrder = hasOrder ? Math.max(...items.map((it) => it.order)) : -1;
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    const cur = items[idx];
    items.splice(idx, 1);
    items.push({
      ...cur,
      name: nextName,
      updatedAt: Date.now(),
      order: cur.order ?? (hasOrder ? maxOrder + 1 : null),
    });
    save(items);
  },
  delete(id) {
    const items = load().map(normalize);
    const next = items.filter((x) => x?.id !== id);
    save(next);
  },
  clear() {
    localStorage.removeItem(KEY);
  },
  reorder(ids) {
    const items = load().map(normalize);
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
};
