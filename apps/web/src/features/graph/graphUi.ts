/**
 * 图谱与节点四卡 UI 纯逻辑（16W06/07 · WD5 · 20 §1.1 色档 / §6 §8 BR-08/BR-11；可单测）。
 * 色档优先级与后端 MasteryCalculator.colorOf **完全同口径**：
 *   筹备 > 前置锁定 > 无数据/样本不足 > 分数档（≥80 绿 / <80 黄，边界 79.99/80）。
 */

export type GraphColor = "preparing" | "locked" | "no-data" | "sample-low" | "yellow" | "green";

export interface NodeView {
  id: number;
  name: string;
  preparing: boolean;
  locked: boolean;
  score: number | null; // null = 未测量
  insufficientSample: boolean; // 1≤n<5
}

/** 色档判定（纯函数镜像，服务端为权威）。 */
export function graphColorOf(n: NodeView): GraphColor {
  if (n.preparing) {
    return "preparing";
  }
  if (n.locked) {
    return "locked";
  }
  if (n.score === null) {
    return "no-data";
  }
  if (n.insufficientSample) {
    return "sample-low";
  }
  return n.score >= 80 ? "green" : "yellow";
}

const HEX: Record<GraphColor, string> = {
  preparing: "#8B5CF6",
  locked: "#EF4444",
  "no-data": "#CBD5E1",
  "sample-low": "#CBD5E1",
  yellow: "#F59E0B",
  green: "#22C55E",
};

const LABEL: Record<GraphColor, string> = {
  preparing: "内容筹备中",
  locked: "前置锁定",
  "no-data": "尚未测量",
  "sample-low": "样本不足",
  yellow: "薄弱",
  green: "已掌握",
};

export function colorHex(c: GraphColor): string {
  return HEX[c];
}

export function colorLabel(c: GraphColor): string {
  return LABEL[c];
}

/** 图例（WD5：四档 + 筹备独立标记）。 */
export function legendItems(): Array<{ color: GraphColor; label: string }> {
  return (["green", "yellow", "locked", "no-data", "sample-low", "preparing"] as GraphColor[]).map((c) => ({
    color: c,
    label: LABEL[c],
  }));
}

/**
 * 节点徽标（BR-11：**"内容筹备中" 与 "能力锁定" 必须区分**）。
 */
export function badgeFor(n: NodeView): { text: string; tone: "violet" | "red" | "none" } {
  if (n.preparing) {
    return { text: "内容筹备中", tone: "violet" };
  }
  if (n.locked) {
    return { text: "前置锁定", tone: "red" };
  }
  return { text: "", tone: "none" };
}

// ---------- 节点四卡（BR-08：起源/现实原型/能力地图/抽象阶梯；代表题独立列后） ----------

export type CardKey = "origin" | "prototype" | "capability" | "ladder";

export const NARRATIVE_TABS: ReadonlyArray<{ key: CardKey; label: string }> = [
  { key: "origin", label: "起源" },
  { key: "prototype", label: "现实原型" },
  { key: "capability", label: "能力地图" },
  { key: "ladder", label: "抽象阶梯" },
];

export interface Narrative {
  origin?: string | null;
  prototype?: string | null;
  capability?: string | null;
  ladder?: string | null;
}

export function tabFromQuery(raw: unknown): CardKey {
  if (typeof raw === "string" && NARRATIVE_TABS.some((t) => t.key === raw)) {
    return raw as CardKey;
  }
  return "origin";
}

/** 缺失卡清单（**空字段显示待补全**；返回中文名便于直接渲染）。 */
export function missingCards(n: Narrative | null | undefined): string[] {
  const out: string[] = [];
  const has = (v: string | null | undefined): boolean => Boolean(v && v.trim());
  if (!n || !has(n.origin)) out.push("起源");
  if (!n || !has(n.prototype)) out.push("现实原型");
  if (!n || !has(n.capability)) out.push("能力地图");
  if (!n || !has(n.ladder)) out.push("抽象阶梯");
  return out;
}

export interface CardView {
  text: string;
  missing: boolean;
}

/** 单卡内容视图（缺失 → "待补全"占位；**有数据必须可达**）。 */
export function cardView(key: CardKey, n: Narrative | null | undefined): CardView {
  const value = n ? n[key] : null;
  if (!value || !value.trim()) {
    return { text: "待补全", missing: true };
  }
  return { text: value.trim(), missing: false };
}

/** 四卡完整度（0-100，管理端 completeness 同口径）。 */
export function narrativeCompleteness(n: Narrative | null | undefined): number {
  const total = 4;
  const present = total - missingCards(n).length;
  return Math.round((present / total) * 100);
}

// ---------- 检索与邻域 ----------

/** 名称过滤（trim+忽略大小写；空查询=全部）。 */
export function filterNodes<T extends { name: string }>(nodes: T[], query: string): T[] {
  const q = (query || "").trim().toLowerCase();
  if (!q) {
    return [...nodes];
  }
  return nodes.filter((n) => n.name.toLowerCase().includes(q));
}

/** 一跳邻域（定位飞入高亮：focus + 直接前后继）。 */
export function neighborSet(edges: Array<{ from: number; to: number }>, focusId: number): Set<number> {
  const out = new Set<number>([focusId]);
  for (const e of edges ?? []) {
    if (e.from === focusId) out.add(e.to);
    if (e.to === focusId) out.add(e.from);
  }
  return out;
}
