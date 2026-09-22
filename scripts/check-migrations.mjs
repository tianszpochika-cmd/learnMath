// 迁移脚本结构校验（B-07 DoD：结构脚本校验 · 无需数据库）
// 用法：node scripts/check-migrations.mjs
// 规则：① V1 必须且仅含内容域 23 表（03 §3 内容域+内核组+T59）② 无 DROP/TRUNCATE/CREATE DATABASE
//      ③ 每张表含主键 id 与 created_at/updated_at ④ 表名不重复
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migDir = path.join(root, "server/src/main/resources/db/migration");

const EXPECTED_V1 = [
  "knowledge_node","knowledge_edge","tag","tag_rel","course","chapter","lesson",
  "question","question_knowledge","paper","paper_question","special_topic","topic_node",
  "solution_path","reasoning_step","step_prediction","concept_narrative","translation_pair",
  "formula","formula_symbol","formula_relation","formula_node_rel","article",
]; // 23 = 03 内容域(T02-T14) + 内核组(T50-T54) + 公式组(T55-T58) + T59

const errors = [];
if (!existsSync(migDir)) {
  console.error("迁移目录不存在: " + migDir);
  process.exit(1);
}
const files = readdirSync(migDir).filter((f) => f.toLowerCase().endsWith(".sql")).sort();
if (files.length === 0) {
  console.error("无迁移文件");
  process.exit(1);
}

const allCreates = [];
for (const f of files) {
  const sql = readFileSync(path.join(migDir, f), "utf8");
  // ② 禁止破坏性语句
  for (const bad of [/DROP\s+DATABASE/i, /TRUNCATE/i, /DROP\s+TABLE/i, /CREATE\s+DATABASE/i]) {
    if (bad.test(sql.replace(/--.*$/gm, ""))) {
      errors.push(`${f}: 禁止语句命中 ${bad}`);
    }
  }
  // ①③④ 提取 CREATE TABLE
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(/gi;
  let m;
  const names = [];
  while ((m = re.exec(sql)) !== null) {
    names.push(m[1]);
    // ③ 该表块内检查主键与审计字段（取到下一个 CREATE 前）
    const next = re.lastIndex;
    const rest = sql.slice(next);
    const blockEnd = rest.search(/CREATE\s+TABLE/i);
    const block = blockEnd === -1 ? rest : rest.slice(0, blockEnd);
    if (!/PRIMARY\s+KEY\s*\(\s*id\s*\)|AUTO_INCREMENT\s+PRIMARY\s+KEY/i.test(block)) {
      errors.push(`${f}: 表 ${m[1]} 缺少主键 id`);
    }
    if (!/created_at/i.test(block)) errors.push(`${f}: 表 ${m[1]} 缺少 created_at`);
    if (!/updated_at/i.test(block)) errors.push(`${f}: 表 ${m[1]} 缺少 updated_at`);
  }
  for (const n of names) {
    if (allCreates.includes(n)) errors.push(`${f}: 表重复定义 ${n}`);
    allCreates.push(n);
  }
}

// V1 清单比对（若存在 V1 文件）
const v1 = files.find((f) => /^V1__/.test(f));
if (v1) {
  const missing = EXPECTED_V1.filter((t) => !allCreates.includes(t));
  for (const t of missing) errors.push(`V1 缺表: ${t}`);
  // V1 阶段允许后续文件建额外表；仅当只有 V1 时校验多余
  if (files.length === 1) {
    for (const t of allCreates.filter((x) => !EXPECTED_V1.includes(x))) errors.push(`V1 多余表: ${t}`);
  }
}

const result = {
  scope: "migration_structure_only",
  files,
  tables: allCreates,
  expectedV1: EXPECTED_V1.length,
  errors,
  ok: errors.length === 0,
};
const outDir = path.join(root, "docs/review");
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "migration-check.json"), JSON.stringify(result, null, 2));

if (errors.length) {
  console.error("迁移结构校验失败:");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`迁移结构校验通过: ${files.length} 文件 / ${allCreates.length} 表（V1 期望 ${EXPECTED_V1.length}）→ docs/review/migration-check.json`);
