import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const MAX_BODY = 2 * 1024 * 1024;

function setCors(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization,x-api-key,anthropic-version");
  res.setHeader("access-control-max-age", "86400");
}

function sendJson(res, statusCode, obj) {
  setCors(res);
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("请求体过大"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const s = Buffer.concat(chunks).toString("utf8");
      try {
        resolve(JSON.parse(s || "{}"));
      } catch (e) {
        reject(new Error("JSON 解析失败"));
      }
    });
    req.on("error", reject);
  });
}

function validateUrl(u) {
  const url = new URL(u);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("仅允许 http/https");
  return url;
}

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.url === "/health") {
      sendJson(res, 200, { ok: true, now: new Date().toISOString() });
      return;
    }
    if (req.url !== "/proxy" || req.method !== "POST") {
      sendJson(res, 404, { ok: false, error: "Not Found" });
      return;
    }

    const payload = await readJson(req);
    const url = validateUrl(payload.url);
    const method = String(payload.method || "GET").toUpperCase();
    const headersObj = payload.headers && typeof payload.headers === "object" ? payload.headers : {};
    const body = payload.body ?? null;

    const startedAt = Date.now();
    const upstreamRes = await fetch(url.toString(), {
      method,
      headers: headersObj,
      body: body == null ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const upstreamBody = await upstreamRes.text();
    const latencyMs = Date.now() - startedAt;

    sendJson(res, 200, {
      ok: upstreamRes.ok,
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      contentType: upstreamRes.headers.get("content-type") || "",
      latencyMs,
      body: upstreamBody,
    });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: String(e?.message || e) });
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`API 测试器本地代理已启动：http://${HOST}:${PORT}`);
});

