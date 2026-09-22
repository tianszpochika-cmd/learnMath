/**
 * 知识点管理纯逻辑（17 A03/A04 · AD5 无环校验前端镜像 · 04 admin CSV 导入；可单测）。
 * 权威边界：入库校验/成环判定在后端（KnowledgeTreeParser / GraphCycleDetector），
 * 本模块为**管理端即时预检**（提交前红框与环路径回显，语义同后端）。
 */

// ---------- CSV 导入预检（镜像后端 KnowledgeTreeParser） ----------

export interface TreeDraft {
  parentPath: string[];
  name: string;
  difficulty: number;
  description: string;
  line: number;
}

export interface CsvError {
  line: number;
  reason: string;
}

export interface CsvParseResult {
  drafts: TreeDraft[];
  errors: CsvError[];
  ok: boolean;
}

/** RFC4180 子集：双引号包裹 + "" 转义。 */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

/** 逐行解析（表头必须含 path,name；坏行不杀好行）。 */
export function parseKnowledgeCsv(csv: string): CsvParseResult {
  const drafts: TreeDraft[] = [];
  const errors: CsvError[] = [];
  if (!csv || !csv.trim()) {
    return { drafts, errors: [{ line: 1, reason: "内容为空" }], ok: false };
  }
  const lines = csv.split(/\r?\n/, -1);
  let headerDone = false;
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i];
    if (!raw.trim()) continue;
    const cols = splitCsvLine(raw);
    if (!headerDone) {
      const lower = cols.map((c) => c.trim().toLowerCase());
      const idxPath = lower.indexOf("path");
      const idxName = lower.indexOf("name");
      if (idxPath === -1 || idxName === -1) {
        return { drafts, errors: [{ line: lineNo, reason: "表头必须包含 path,name 两列" }], ok: false };
      }
      headerDone = true;
      continue;
    }
    const idxPath = 0;
    const idxName = 1;
    const idxDiff = 2;
    const idxDesc = 3;
    const pathRaw = (cols[idxPath] ?? "").trim();
    const name = (cols[idxName] ?? "").trim();
    if (!name) {
      errors.push({ line: lineNo, reason: "name 为空" });
      continue;
    }
    const segments: string[] = [];
    let pathOk = true;
    if (pathRaw) {
      for (const seg of pathRaw.split("/")) {
        const s = seg.trim();
        if (!s) {
          errors.push({ line: lineNo, reason: `path 存在空段: "${pathRaw}"` });
          pathOk = false;
          break;
        }
        if (s.length > 64) {
          errors.push({ line: lineNo, reason: `path 段超长(>64): ${s}` });
          pathOk = false;
          break;
        }
        segments.push(s);
      }
    }
    if (!pathOk) continue;
    let difficulty = 3;
    const dRaw = (cols[idxDiff] ?? "").trim();
    if (dRaw) {
      if (!/^-?\d+$/.test(dRaw)) {
        errors.push({ line: lineNo, reason: `difficulty 非整数: ${dRaw}` });
        continue;
      }
      difficulty = Number(dRaw);
      if (difficulty < 1 || difficulty > 5) {
        errors.push({ line: lineNo, reason: `difficulty 超出 1-5: ${difficulty}` });
        continue;
      }
    }
    const full = [...segments, name].join("/");
    if (seen.has(full)) {
      errors.push({ line: lineNo, reason: `重复路径: ${full}` });
      continue;
    }
    seen.add(full);
    drafts.push({
      parentPath: segments,
      name,
      difficulty,
      description: (cols[idxDesc] ?? "").trim(),
      line: lineNo,
    });
  }
  if (headerDone && drafts.length === 0 && errors.length === 0) {
    errors.push({ line: 1, reason: "无数据行" });
  }
  return { drafts, errors, ok: errors.length === 0 };
}

// ---------- 树形展示 ----------

export interface TreeNodeAdmin {
  id: number;
  parentId: number | null;
  title: string;
  status: "published" | "draft" | "offline";
  childrenCount: number;
}

export interface TreeRowView {
  id: number;
  depth: number;
  title: string;
  statusLabel: string;
  statusClass: "gr" | "warn" | "grey";
  expandable: boolean;
}

/**
 * 展开态下的可见行。
 * 规则双向：**命中父 → 整支显示（祖先强制包含）**；**命中子 → 父链回溯显示**；
 * 折叠只影响展开浏览，不排除（命中子时即便父折叠也带出父链——与 17A03 搜索语义一致）。
 */
export function treeRows(nodes: TreeNodeAdmin[], collapsed: Set<number>, query: string): TreeRowView[] {
  const q = query.trim().toLowerCase();
  const byParent = new Map<number | null, TreeNodeAdmin[]>();
  for (const n of nodes ?? []) {
    const key = n.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(n);
    byParent.set(key, list);
  }

  interface Walk {
    rows: TreeRowView[];
    matchedSomewhere: boolean;
  }

  const walk = (parent: number | null, depth: number, ancestorHit: boolean): Walk => {
    const rows: TreeRowView[] = [];
    let matchedSomewhere = false;
    for (const n of byParent.get(parent) ?? []) {
      const matched = !q || n.title.toLowerCase().includes(q);
      const includeSelf = ancestorHit || matched;
      // 无 query（浏览态）：折叠父不展开；有 query（搜索态）：穿透折叠找深命中
      const childCollapsed = collapsed.has(n.id);
      const child = q === "" && childCollapsed
        ? { rows: [] as TreeRowView[], matchedSomewhere: false }
        : walk(n.id, depth + 1, includeSelf);
      if (includeSelf || child.matchedSomewhere) {
        rows.push(toRow(n, depth));
        rows.push(...child.rows);
      }
      matchedSomewhere = matchedSomewhere || matched || child.matchedSomewhere;
    }
    return { rows, matchedSomewhere };
  };

  return walk(null, 0, false).rows;
}

function toRow(n: TreeNodeAdmin, depth: number): TreeRowView {
  const label =
    n.status === "published" ? "上架" : n.status === "draft" ? "草稿" : "下架";
  const cls = n.status === "published" ? "gr" : n.status === "draft" ? "warn" : "grey";
  return { id: n.id, depth, title: n.title, statusLabel: label, statusClass: cls, expandable: n.childrenCount > 0 };
}

export function toggleCollapsed(set: Set<number>, id: number): Set<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// ---------- AD5 无环校验前端镜像（与后端 GraphCycleDetector 同语义） ----------

export interface DepEdge {
  from: number;
  to: number;
}

export type EdgeReason = "ok" | "duplicate" | "cycle";

export interface EdgeValidation {
  ok: boolean;
  reason: EdgeReason;
  cyclePath: number[];
  message: string;
}

/** 新增边预检：自环/重复/成环（环回显 [to,…,from,to] 同后端）。 */
export function validateEdgeAdd(existing: DepEdge[], from: number, to: number): EdgeValidation {
  if (from === to) {
    return { ok: false, reason: "cycle", cyclePath: [from, from], message: `自环依赖: node=${from}` };
  }
  for (const e of existing ?? []) {
    if (e.from === from && e.to === to) {
      return { ok: false, reason: "duplicate", cyclePath: [], message: `依赖已存在: ${from} → ${to}` };
    }
  }
  const adj = new Map<number, number[]>();
  for (const e of existing ?? []) {
    const list = adj.get(e.from) ?? [];
    list.push(e.to);
    adj.set(e.from, list);
  }
  const path = reachablePath(adj, to, from); // to 能否走到 from
  if (path) {
    const cycle = [...path, to];
    return {
      ok: false,
      reason: "cycle",
      cyclePath: cycle,
      message: `图谱成环: ${cycle.join(" → ")}（3310）`,
    };
  }
  return { ok: true, reason: "ok", cyclePath: [], message: "已添加依赖（无环校验通过）" };
}

/** BFS 最短路径（from → to），返回含首尾的节点序列或 null。 */
function reachablePath(adj: Map<number, number[]>, from: number, to: number): number[] | null {
  const queue: number[][] = [[from]];
  const seen = new Set<number>([from]);
  while (queue.length) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    if (last === to) return path;
    for (const next of adj.get(last) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return null;
}

/** 全图体检：存在环 → 首个环路径（镜像后端 findExistingCycle；DFS 三色）。 */
export function findExistingCycle(edges: DepEdge[]): number[] | null {
  const adj = new Map<number, number[]>();
  const order: number[] = [];
  const seenOrder = new Set<number>();
  for (const e of edges ?? []) {
    const list = adj.get(e.from) ?? [];
    list.push(e.to);
    adj.set(e.from, list);
    if (!seenOrder.has(e.from)) {
      seenOrder.add(e.from);
      order.push(e.from);
    }
    if (!seenOrder.has(e.to)) {
      seenOrder.add(e.to);
      order.push(e.to);
    }
  }
  const visiting = new Set<number>();
  const done = new Set<number>();
  const dfs = (node: number): number[] | null => {
    if (done.has(node)) return null;
    if (visiting.has(node)) {
      const cycle: number[] = [];
      let start = false;
      for (const n of visiting) {
        if (n === node) start = true;
        if (start) cycle.push(n);
      }
      cycle.push(node);
      return cycle;
    }
    visiting.add(node);
    for (const next of adj.get(node) ?? []) {
      const c = dfs(next);
      if (c) return c;
    }
    visiting.delete(node);
    done.add(node);
    return null;
  };
  for (const n of order) {
    const c = dfs(n);
    if (c) return c;
  }
  return null;
}
