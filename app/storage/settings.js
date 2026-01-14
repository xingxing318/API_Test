import { safeJsonParse, safeJsonStringify } from "../util/misc.js";

const KEY = "apiTester.settings.v1";

const DEFAULTS = {
  useProxy: false,
  proxyBaseUrl: "http://127.0.0.1:8787",
};

function load() {
  const raw = localStorage.getItem(KEY);
  const obj = safeJsonParse(raw);
  if (!obj || typeof obj !== "object") return { ...DEFAULTS };
  return { ...DEFAULTS, ...obj };
}

function save(next) {
  localStorage.setItem(KEY, safeJsonStringify(next));
}

export const settingsStore = {
  get() {
    return load();
  },
  set(patch) {
    const cur = load();
    const next = { ...cur, ...patch };
    save(next);
    return next;
  },
  reset() {
    save({ ...DEFAULTS });
  },
};

