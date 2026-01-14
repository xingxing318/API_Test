export function safeJsonParse(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return "[]";
  }
}

export function redactHeaders(headers) {
  const out = { ...headers };
  for (const k of Object.keys(out)) {
    if (/authorization|x-api-key|api-key|apikey|token/i.test(k)) out[k] = "***";
  }
  return out;
}

export function renderTemplate(tpl, vars) {
  return String(tpl).replaceAll(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ""));
}

export function jsonGet(obj, path) {
  if (!obj || !path) return undefined;
  const parts = String(path).split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    const m = part.match(/^(\d+)$/);
    if (m) {
      cur = cur[Number(m[1])];
      continue;
    }
    cur = cur[part];
  }
  return cur;
}

export function jsonSet(obj, path, value) {
  const parts = String(path).split(".");
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    if (isLast) {
      cur[part] = value;
      return obj;
    }
    cur[part] = cur[part] ?? {};
    cur = cur[part];
  }
  return obj;
}

