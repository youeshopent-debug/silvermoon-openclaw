import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PID_PATH = path.join(__dirname, "..", "main.pid");

const startTime = Date.now();
let healthStatus = { status: "ok", uptime: 0 };

export function getHealth() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  return {
    status: healthStatus.status,
    uptime,
    pid: process.pid,
    memory: process.memoryUsage(),
    version: "2026.5.27",
  };
}

export function setHealth(newStatus) {
  healthStatus = { ...healthStatus, ...newStatus };
}

// 启动健康检查 HTTP 端点（端口 +1）
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || "18792", 10);

export function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(getHealth()));
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });
  server.listen(HEALTH_PORT, () => {
    console.log(`[watchdog] Health server on :${HEALTH_PORT}`);
  });
  return server;
}

// PID 文件管理
export function writePid() {
  fs.writeFileSync(PID_PATH, String(process.pid), "utf-8");
  process.on("exit", () => {
    try { fs.unlinkSync(PID_PATH); } catch {}
  });
}

// 自动启动
writePid();
startHealthServer();
