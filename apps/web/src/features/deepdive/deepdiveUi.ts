/**
 * 深钻三区 UI 纯逻辑（16W05 · WD3 · E2 双分支 · 20 §8 typed 路由；可单测）。
 * 权威边界：判分/预测后端=DeepDrillDomain（Java），本模块为前端渲染映射。
 */

// ---------- 五玩 Tab ----------

export type DeepMode = "read" | "predict" | "dual" | "multi" | "ai";

export const DEEP_MODES: ReadonlyArray<{ key: DeepMode; label: string }> = [
  { key: "read", label: "通读" },
  { key: "predict", label: "预测" },
  { key: "dual", label: "顺逆" },
  { key: "multi", label: "多解" },
  { key: "ai", label: "AI" },
];

/** query.mode 合法化（非法/缺省 → read）。 */
export function modeFromQuery(raw: unknown): DeepMode {
  if (typeof raw === "string" && DEEP_MODES.some((m) => m.key === raw)) {
    return raw as DeepMode;
  }
  return "read";
}

export function modeIndex(mode: DeepMode): number {
  const i = DEEP_MODES.findIndex((m) => m.key === mode);
  return i < 0 ? 0 : i;
}

// ---------- 步卡 ↔ 右栏联动（WD3） ----------

export interface DeepStep {
  seq: number;
  typeLabel: string;
  content: string;
  warrant: string;
  warrantNodes: string[];
  motive: string;
  offRamp: string;
}

export interface RailData {
  warrant: string;
  nodes: string[];
  motive: string;
  offRamp: string;
}

/** 选中步 → 右栏三层（依据/动机/岔路）。 */
export function railOf(step: DeepStep | null): RailData {
  if (!step) {
    return { warrant: "（未选择步骤）", nodes: [], motive: "", offRamp: "" };
  }
  return {
    warrant: step.warrant,
    nodes: [...step.warrantNodes],
    motive: step.motive,
    offRamp: step.offRamp,
  };
}

/** 选中态：seq 不存在 → 回退首步（保持右栏非空）。 */
export function selectStep(steps: DeepStep[], seq: number): DeepStep | null {
  const found = steps.find((s) => s.seq === seq);
  if (found) {
    return found;
  }
  return steps.length > 0 ? steps[0] : null;
}

// ---------- 预测（E2 双分支渲染态） ----------

export type PredKind = "PICK" | "SUBJECTIVE";

export interface PredState {
  kind: PredKind;
  answered: boolean;
  selectedIndex: number;
  correctIndex: number;
}

export type PredBranch = "idle" | "right" | "wrong" | "self";

/** 分支渲染：客观=右/错；主观恒 self（对照参考后自报，不自动判）。 */
export function predictionBranch(s: PredState): PredBranch {
  if (s.kind === "SUBJECTIVE") {
    return s.answered ? "self" : "idle";
  }
  if (!s.answered) {
    return "idle";
  }
  return s.selectedIndex === s.correctIndex ? "right" : "wrong";
}

export interface PredFeedback {
  headline: string;
  body: string;
  offRamp?: string;
}

/**
 * 点评文案（双分支；与后端 DeepDrillDomain.judgeObjective/judgeSubjective 句式一致）。
 */
export function predictionFeedback(s: PredState, opts: {
  reinforce: string;
  wrongBridge: string;
  offRamp: string;
  reference: string;
}): PredFeedback {
  const branch = predictionBranch(s);
  switch (branch) {
    case "right":
      return { headline: "✓ 完全正确", body: opts.reinforce };
    case "wrong":
      return { headline: "点评（错）", body: opts.wrongBridge, offRamp: opts.offRamp };
    case "self":
      return {
        headline: "自评参考（不自动判分）",
        body: `对照参考：${opts.reference} —— 请自评（不会/半会/会）。此反馈不计入推理画像。`,
      };
    case "idle":
    default:
      return { headline: "", body: "" };
  }
}

/** 选项作答后的单元格标记。 */
export function predOptionMark(s: PredState, i: number): "" | "right" | "wrong" | "sel" {
  if (s.kind !== "PICK") {
    return "";
  }
  if (s.answered) {
    if (i === s.correctIndex) return "right";
    if (i === s.selectedIndex) return "wrong";
    return "";
  }
  return i === s.selectedIndex ? "sel" : "";
}

// ---------- 顺逆双画布对齐（同色步对齐） ----------

export interface AlignStep {
  id: string;
  label: string;
}

export interface AlignPair {
  forward: AlignStep;
  backward: AlignStep | null;
  matched: boolean;
}

/** 按共享 id 对齐（保 forward 序；无对应 → null）。 */
export function alignPairs(forward: AlignStep[], backward: AlignStep[]): AlignPair[] {
  const byId = new Map(backward.map((b) => [b.id, b]));
  return (forward ?? []).map((f) => {
    const b = byId.get(f.id) ?? null;
    return { forward: f, backward: b, matched: b !== null };
  });
}

export function alignRatio(pairs: AlignPair[]): number {
  if (pairs.length === 0) {
    return 0;
  }
  return Math.round((pairs.filter((p) => p.matched).length / pairs.length) * 100);
}

/** 同色标记：对齐成功对共用色序号（未对齐 → 灰）。 */
export function pairColorIndex(pairs: AlignPair[], index: number): number | null {
  if (index < 0 || index >= pairs.length) {
    return null;
  }
  return pairs[index].matched ? index % 6 : null;
}

// ---------- 多解对比表 ----------

export interface Variant {
  id: string;
  name: string;
  stepCount: number;
  trick: "低" | "中" | "高";
  calcLoad: "小" | "中" | "大";
  applicable: string;
  isGeneral?: boolean;
}

export interface VariantRow {
  id: string;
  name: string;
  stepText: string;
  trick: string;
  calcLoad: string;
  applicable: string;
}

export function variantRows(variants: Variant[]): VariantRow[] {
  return (variants ?? []).map((v) => ({
    id: v.id,
    name: v.name + (v.isGeneral ? "（通法）" : ""),
    stepText: `${v.stepCount} 步`,
    trick: v.trick,
    calcLoad: v.calcLoad,
    applicable: v.applicable,
  }));
}

const TRICK_RANK: Record<Variant["trick"], number> = { 低: 0, 中: 1, 高: 2 };

/** 最快解：步数少优先，同步数技巧低者优先（稳定）。 */
export function fastestVariant(variants: Variant[]): Variant | null {
  const list = [...(variants ?? [])];
  if (list.length === 0) {
    return null;
  }
  list.sort((a, b) => a.stepCount - b.stepCount || TRICK_RANK[a.trick] - TRICK_RANK[b.trick]);
  return list[0];
}

/** 通法总结句（10 §2：判别式完全平方→优先因式分解，否则求根公式保底）。 */
export function generalTip(): string {
  return "首项系数为 1 且判别式为完全平方 → 优先因式分解（最快）；否则求根公式是保底通法。";
}

// ---------- typed 路由（20 §8：/deepdive/{type}/{id}，防 id 碰撞） ----------

export type SubjectType = "question" | "formula";

export function deepdivePath(type: string, id: string | number): string {
  const t = type === "formula" ? "formula" : "question";
  return `/deepdive/${t}/${id}`;
}

/** 非法 type 兜底（→ 题目型）；旧无型路由重定向目标同源。 */
export function normalizeSubjectType(raw: unknown): SubjectType {
  return raw === "formula" ? "formula" : "question";
}
