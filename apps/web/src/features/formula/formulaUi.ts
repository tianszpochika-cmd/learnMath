/**
 * 公式馆 UI 纯逻辑（16W14 · 11 号七件套 · 20 §8 BR-08 前端镜像；可单测）。
 * 权威边界：别名索引/公开摘要/小练可用性=后端 FormulaHall，本模块为展示映射（同口径）。
 */

// ---------- 七区（11 号顺序：起源/符号表/推导/条件边界/应用/家族/变形） ----------

export type SectionKey =
  | "origin"
  | "symbols"
  | "derivation"
  | "conditions"
  | "applications"
  | "family"
  | "variants";

export const FORMULA_SECTIONS: ReadonlyArray<{ key: SectionKey; label: string }> = [
  { key: "origin", label: "起源" },
  { key: "symbols", label: "符号表" },
  { key: "derivation", label: "推导" },
  { key: "conditions", label: "条件边界" },
  { key: "applications", label: "应用" },
  { key: "family", label: "家族" },
  { key: "variants", label: "变形" },
];

export interface SymbolRow {
  symbol: string;
  meaning: string;
  rangeNote: string;
}

export interface VariantRow2 {
  legal: boolean;
  expression: string;
  note: string;
}

export interface FamilyRelRow {
  toFormulaId: number;
  relType: number; // 1推广 2特例 3等价 4逆 5可组合 6常用搭配
  note: string;
}

export interface FormulaDetail {
  id: number;
  name: string;
  aliases: string[];
  latex: string;
  proofStatus: number; // 1严格 2推导 3经验 4未证
  origin: string | null;
  symbols: SymbolRow[] | null;
  hasDerivation: boolean;
  conditions: string | null;
  applications: string | null;
  family: FamilyRelRow[] | null;
  variants: VariantRow2[] | null;
}

export function sectionFromQuery(raw: unknown): SectionKey {
  if (typeof raw === "string" && FORMULA_SECTIONS.some((s) => s.key === raw)) {
    return raw as SectionKey;
  }
  return "origin";
}

function nonEmpty(v: string | null | undefined): boolean {
  return Boolean(v && v.trim());
}

/** 缺失区清单（中文名 · 空字段=待补全，BR-08）。 */
export function missingSections(f: FormulaDetail | null | undefined): string[] {
  const out: string[] = [];
  const has = (k: SectionKey): boolean => {
    const label = FORMULA_SECTIONS.find((s) => s.key === k)!.label;
    if (!f) {
      out.push(label);
      return false;
    }
    switch (k) {
      case "origin":
        if (!nonEmpty(f.origin)) out.push(label);
        return nonEmpty(f.origin);
      case "symbols":
        if (!f.symbols || f.symbols.length === 0) out.push(label);
        return Boolean(f.symbols && f.symbols.length);
      case "derivation":
        if (!f.hasDerivation) out.push(label);
        return f.hasDerivation;
      case "conditions":
        if (!nonEmpty(f.conditions)) out.push(label);
        return nonEmpty(f.conditions);
      case "applications":
        if (!nonEmpty(f.applications)) out.push(label);
        return nonEmpty(f.applications);
      case "family":
        if (!f.family || f.family.length === 0) out.push(label);
        return Boolean(f.family && f.family.length);
      case "variants":
        if (!f.variants || f.variants.length === 0) out.push(label);
        return Boolean(f.variants && f.variants.length);
    }
  };
  for (const s of FORMULA_SECTIONS) {
    has(s.key);
  }
  return out;
}

/** 单区是否有数据（Tab 上红点/叹号=待补全；有数据必须可达）。 */
export function sectionMissing(key: SectionKey, f: FormulaDetail | null | undefined): boolean {
  return missingSections(f).includes(FORMULA_SECTIONS.find((s) => s.key === key)!.label);
}

export function formulaCompleteness(f: FormulaDetail | null | undefined): number {
  const total = FORMULA_SECTIONS.length;
  const missing = missingSections(f).length;
  return Math.round(((total - missing) / total) * 100);
}

// ---------- 符号表（BR-08：至少含 含义/定义域/单位） ----------

export function symbolProblem(s: SymbolRow): string | null {
  if (!s.symbol.trim()) {
    return "符号为空";
  }
  if (!s.meaning.trim()) {
    return `缺符号含义：${s.symbol}`;
  }
  if (!s.rangeNote.trim()) {
    return `缺定义域/单位：${s.symbol}（无单位请标 无量纲）`;
  }
  return null;
}

// ---------- 条件红条（摘要=锚点 ≠ 完整条件） ----------

export interface ConditionBar {
  summary: string;
  anchor: boolean;
}

export function conditionBar(f: FormulaDetail | null | undefined): ConditionBar {
  const conditions = f?.conditions?.trim() ?? "";
  if (!conditions) {
    return { summary: "", anchor: false };
  }
  let first = conditions;
  const cut = first.indexOf("。");
  if (cut >= 0) {
    first = first.substring(0, cut + 1);
  }
  if (first.length > 50) {
    first = first.slice(0, 50) + "…";
  }
  return { summary: first, anchor: true };
}

// ---------- proof 徽标（F3 与后端同文案） ----------

export function proofBadge(status: number): string {
  switch (status) {
    case 1:
      return "✓ 严格证明";
    case 2:
      return "✓ 推导确立";
    case 3:
      return "≈ 经验拟合";
    case 4:
      return "⚑ 未证实（猜想）";
    default:
      return "？未知状态";
  }
}

export function citableAsTheorem(status: number): boolean {
  return status !== 4;
}

// ---------- 小练三型（有多少显示多少） ----------

export type DrillType = "CONDITION_JUDGE" | "VARIANT_RECOGNIZE" | "APPLICATION_MATCH";

const DRILL_LABEL: Record<DrillType, string> = {
  CONDITION_JUDGE: "条件判断",
  VARIANT_RECOGNIZE: "变形识别",
  APPLICATION_MATCH: "应用匹配",
};

export function drillTypeLabel(t: DrillType): string {
  return DRILL_LABEL[t];
}

export function drillAvailability(f: FormulaDetail | null | undefined): DrillType[] {
  const out: DrillType[] = [];
  if (nonEmpty(f?.conditions)) out.push("CONDITION_JUDGE");
  if (f?.variants && f.variants.length > 0) out.push("VARIANT_RECOGNIZE");
  if (nonEmpty(f?.applications)) out.push("APPLICATION_MATCH");
  return out;
}

// ---------- 变形与家族 ----------

export function errorVariants(f: FormulaDetail | null | undefined): VariantRow2[] {
  return (f?.variants ?? []).filter((v) => !v.legal);
}

export function legalVariants(f: FormulaDetail | null | undefined): VariantRow2[] {
  return (f?.variants ?? []).filter((v) => v.legal);
}

const REL_LABEL: Record<number, string> = {
  1: "推广",
  2: "特例",
  3: "等价",
  4: "逆",
  5: "可组合",
  6: "常用搭配",
};

export function relLabel(relType: number): string {
  return REL_LABEL[relType] ?? "关联";
}

// ---------- 别名索引（F1 题面可点） ----------

export function normalizeAlias(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

/** name + aliases 全入倒排（同后端 buildAliasIndex）。 */
export function buildAliasIndex(list: Array<{ id: number; name: string; aliases: string[] }>): Map<string, number> {
  const idx = new Map<string, number>();
  for (const f of list ?? []) {
    const nameKey = normalizeAlias(f.name);
    if (nameKey && !idx.has(nameKey)) {
      idx.set(nameKey, f.id);
    }
    for (const a of f.aliases ?? []) {
      const k = normalizeAlias(a);
      if (k && !idx.has(k)) {
        idx.set(k, f.id);
      }
    }
  }
  return idx;
}

export function lookupAlias(idx: Map<string, number>, text: string): number | null {
  if (!text || !text.trim()) {
    return null;
  }
  return idx.get(normalizeAlias(text)) ?? null;
}

// ---------- typed 深钻入口（BR-08 公式推导路由） ----------

export function formulaDeepdivePath(formulaId: number): string {
  return `/deepdive/formula/${formulaId}`;
}

/** 列表卡投影。 */
export interface FormulaCardView {
  id: number;
  name: string;
  latex: string;
  badge: string;
  citable: boolean;
  conditionLine: string;
  drillCount: number;
}

export function formulaCard(f: FormulaDetail): FormulaCardView {
  return {
    id: f.id,
    name: f.name,
    latex: f.latex,
    badge: proofBadge(f.proofStatus),
    citable: citableAsTheorem(f.proofStatus),
    conditionLine: conditionBar(f).summary,
    drillCount: drillAvailability(f).length,
  };
}
