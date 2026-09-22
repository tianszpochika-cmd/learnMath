// 固定端口探测：读取 config/local-ports.json，逐个探测占用（与 cloudstudy 同模式）
// 用法：node scripts/check-fixed-ports.mjs [--service <name>] [--registry-only]
// 策略：禁止自动换端口 —— 占用即失败，停掉占用进程再启动。
import net from "node:net";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(
  await readFile(path.resolve(scriptDir, "../config/local-ports.json"), "utf8")
);
const host = registry.host || "127.0.0.1";
const services = Object.entries(registry.services || {});

// 参数
const registryOnly = process.argv.includes("--registry-only");
const idx = process.argv.indexOf("--service");
const selected = idx >= 0 ? process.argv[idx + 1] : null;

// 登记校验：端口唯一、合法
const seen = new Map();
for (const [name, svc] of services) {
  if (!Number.isInteger(svc.port) || svc.port < 1 || svc.port > 65535) {
    console.error(`端口无效: ${name} -> ${svc.port}`);
    process.exit(2);
  }
  if (seen.has(svc.port)) {
    console.error(`固定端口登记重复: ${svc.port}: ${seen.get(svc.port)}, ${name}`);
    process.exit(2);
  }
  seen.set(svc.port, name);
}
if (registryOnly) {
  for (const [name, svc] of services) console.log(`REGISTERED ${svc.port} ${name}`);
  process.exit(0);
}

function isFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen({ host, port }, () => probe.close(() => resolve(true)));
  });
}

const list = selected ? services.filter(([name]) => name === selected) : services;
if (selected && list.length === 0) {
  console.error(`固定端口未登记: ${selected}`);
  process.exit(2);
}
const results = await Promise.all(
  list.map(async ([name, svc]) => ({ name, port: svc.port, free: await isFree(svc.port) }))
);
for (const r of results) console.log(`${r.free ? "FREE " : "BUSY "} ${r.port} ${r.name}`);
const busy = results.filter((r) => !r.free);
if (busy.length > 0) {
  console.error(
    `\n${busy.length} 个固定端口被占用。请停掉占用进程；禁止换端口或自动递增。`
  );
  process.exit(3);
}
