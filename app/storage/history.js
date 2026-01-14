import { safeJsonParse, safeJsonStringify } from "../util/misc.js";

const KEY = "apiTester.history.v1";
const MAX = 200;

function load() {
  const raw = localStorage.getItem(KEY);
  const data = safeJsonParse(raw);
  if (!Array.isArray(data)) return [];
  return data;
}

function save(items) {
  localStorage.setItem(KEY, safeJsonStringify(items));
}

export const historyStore = {
  list() {
    return load().slice().reverse();
  },
  add(item) {
    const items = load();
    items.push({ id: item.id ?? crypto.randomUUID(), ...item });
    while (items.length > MAX) items.shift();
    save(items);
  },
  delete(id) {
    const items = load();
    const next = items.filter((x) => x?.id !== id);
    save(next);
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};
