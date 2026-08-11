import http from "node:http";
import { collectTargets } from "./core.mjs";

const host = "127.0.0.1";
const port = Number(process.env.PRICESCOPE_COLLECTOR_PORT || 8787);

function reply(response, status, data) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "http://127.0.0.1:4173",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  response.end(JSON.stringify(data));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") return reply(response, 204, {});
  if (request.method === "GET" && request.url === "/api/health") return reply(response, 200, { status: "ok", service: "pricescope-collector" });
  if (request.method !== "POST" || request.url !== "/api/collect") return reply(response, 404, { error: "not_found" });

  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 100_000) request.destroy();
  });
  request.on("end", async () => {
    try {
      const payload = JSON.parse(body || "{}");
      if (!Array.isArray(payload.targets) || payload.targets.length < 1) return reply(response, 400, { error: "请提供至少一个采集目标" });
      const results = await collectTargets(payload.targets, { delayMs: 1200 });
      return reply(response, 200, { results, summary: { total: results.length, success: results.filter((item) => item.status === "success").length } });
    } catch (error) {
      return reply(response, 500, { error: error.message });
    }
  });
});

server.listen(port, host, () => {
  process.stdout.write(`价策 AI 采集服务：http://${host}:${port}\n`);
});
