// 工具链基线校验：读取 config/toolchain-baseline.json，核对 node/pnpm/java 版本（与 cloudstudy 同模式）
// 用法：node scripts/check-toolchain.mjs
// 政策 versionDrift=fail：版本不符即失败，不警告放行。
import { readFileSync, existsSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(path.join(root, "config/toolchain-baseline.json"), "utf8"));
const errors = [];

// Node（process.versions.node 即本进程版本 = 当前激活的 nvm 版本）
const nodeCur = process.versions.node;
if (nodeCur !== cfg.node.requiredVersion) {
  errors.push(`node 版本漂移: 需要 ${cfg.node.requiredVersion}，当前 ${nodeCur}（执行 nvm use 见 .nvmrc）`);
}

// pnpm
let pnpmCur = "missing";
try {
  pnpmCur = execSync("pnpm --version", { encoding: "utf8" }).trim();
} catch {}
if (pnpmCur !== cfg.pnpm.requiredVersion) {
  errors.push(`pnpm 版本漂移: 需要 ${cfg.pnpm.requiredVersion}，当前 ${pnpmCur}`);
}

// java：spawnSync 捕获 stderr（java -version 输出到 stderr）
const jr = spawnSync("java", ["-version"], { encoding: "utf8" });
const jOut = `${jr.stderr || ""}${jr.stdout || ""}`;
if (jr.error || !jOut) {
  if (cfg.policy.missingRuntime === "fail") errors.push("java 未找到（JAVA_HOME 需指向 JDK 25）");
} else {
  const major = Number((jOut.match(/version "(\d+)/) || [])[1] || 0);
  if (major && major !== cfg.java.requiredMajor) {
    errors.push(`java 版本漂移: 需要 ${cfg.java.requiredMajor}，当前 ${major}`);
  }
}

// 各端 pom 基线：模块通过父 POM（learnmath-server）继承 starter-parent，故校验 parent 声明
for (const svc of cfg.backendServices) {
  const pom = path.join(root, "server", svc, "pom.xml");
  if (!existsSync(pom)) {
    errors.push(`${svc}: 缺少 pom.xml`);
    continue;
  }
  const xml = readFileSync(pom, "utf8");
  if (!xml.includes("<parent>") || !xml.includes("<artifactId>learnmath-server</artifactId>")) {
    errors.push(`${svc}: 缺少 learnmath-server 父 POM 继承`);
  }
}
const parent = path.join(root, "server", "pom.xml");
if (existsSync(parent)) {
  const xml = readFileSync(parent, "utf8");
  if (!xml.includes("spring-boot-starter-parent") || !xml.includes(`<version>${cfg.spring.bootVersion}</version>`)) {
    errors.push(`父 POM 必须以 spring-boot-starter-parent ${cfg.spring.bootVersion} 为 parent`);
  }
  if (!xml.includes("enforce-java-25")) {
    errors.push("父 POM 缺少 Java 25 Maven Enforcer 约束");
  }
}

if (errors.length) {
  console.error("工具链基线校验失败（versionDrift=fail）:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(
  `工具链基线通过: node ${nodeCur} / pnpm ${pnpmCur} / java ${cfg.java.requiredMajor} / boot ${cfg.spring.bootVersion}`
);
console.log("基线来源: cloudstudy（开发机已验证 · S1）");
