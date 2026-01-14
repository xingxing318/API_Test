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
  return { id, name, createdAt, updatedAt };
}

export const favoriteModelsStore = {
  list() {
    const items = load()
      .map(normalize)
      .filter((it) => it.name);
    return items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
  upsert(name) {
    const next = normalize({ name });
    const items = load().map(normalize);
    const idx = items.findIndex((it) => it.name.toLowerCase() === next.name.toLowerCase());
    if (idx >= 0) {
      const cur = items[idx];
      items.splice(idx, 1);
      items.push({ ...cur, name: next.name, updatedAt: Date.now() });
    } else {
      items.push({ ...next, updatedAt: Date.now(), createdAt: next.createdAt || Date.now() });
    }
    while (items.length > MAX) items.shift();
    save(items);
  },
  update(id, name) {
    const nextName = String(name || "").trim();
    if (!nextName) return;
    const items = load().map(normalize);
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    const cur = items[idx];
    items.splice(idx, 1);
    items.push({ ...cur, name: nextName, updatedAt: Date.now() });
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
};
