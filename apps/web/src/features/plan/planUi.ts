/**
 * 测评与计划 UI 纯逻辑（16W11/12 · 02 §5.6 · 20 §10 BR-10 前端镜像；可单测）。
 * 权威边界：档位推进=AssessmentEngine（服务端）、建议 apply/undo=PlanSuggestions（服务端 3011）。
 * 本模块只做提示渲染、日历聚合、diff 展示与按钮可用性。
 */

// ---------- 测评（16W11） ----------

export const ASSESS_CAP = 25;
export const START_LEVEL = 2;
export const MAX_LEVEL = 5;
export const MIN_LEVEL = 1;
export const UP_STREAK = 3;
export const DOWN_WRONG = 2;

export interface AssessState {
  level: number;
  consecutiveCorrect: number;
  wrongInLevel: number;
  answered: number;
}

/** 定级标签（钳 1..5，与后端 levelLabel 同口径）。 */
export function levelLabel(level: number): string {
  const l = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
  return `L${l}`;
}

/** 升降提示（客户端只提示，服务端 step 权威）。
 *  语义：连对中 → 再 N 题升档；有错 → 再 N 题降档（可并列）；都无 → 保持节奏。 */
export function adaptiveHint(s: AssessState): string {
  if (s.level >= MAX_LEVEL) {
    return "已达档 5 → 答完即出定级";
  }
  if (s.answered >= ASSESS_CAP) {
    return `答满 ${ASSESS_CAP} 题 → 出定级`;
  }
  const upNeed = UP_STREAK - s.consecutiveCorrect;
  const downNeed = DOWN_WRONG - s.wrongInLevel;
  const parts: string[] = [];
  if (s.consecutiveCorrect > 0 && upNeed > 0) {
    parts.push(`再连对 ${upNeed} 题升档 ${levelLabel(s.level + 1)}`);
  }
  if (s.wrongInLevel > 0 && downNeed > 0) {
    parts.push(`再错 ${downNeed} 题降档 ${levelLabel(s.level - 1)}`);
  }
  if (parts.length === 0) {
    parts.push(`保持节奏（当前 ${levelLabel(s.level)}）`);
  }
  return parts.join(" · ");
}

export function assessProgress(answered: number, cap = ASSESS_CAP): { percent: number; label: string } {
  const percent = cap <= 0 ? 0 : Math.round((answered / cap) * 100);
  return { percent: Math.min(100, percent), label: `第 ${Math.min(answered + 1, cap)}/${cap} 题` };
}

export interface AssessReportInput {
  level: number;
  answered: number;
  wrongTotal: number;
  accuracy: number | null; // 纯未答 → null
  reachedCeiling: boolean;
  hitQuestionCap: boolean;
}

export interface AssessReportView {
  headline: string;
  reasons: string[];
  accuracyText: string;
}

/** 报告视图：定级 headline + 终止原因 + 正确率（null → "—"）。 */
export function assessmentReportView(r: AssessReportInput): AssessReportView {
  const reasons: string[] = [];
  if (r.reachedCeiling) {
    reasons.push("达到档位上限（档 5）");
  }
  if (r.hitQuestionCap) {
    reasons.push(`答满 ${ASSESS_CAP} 题`);
  }
  if (reasons.length === 0 && r.answered > 0) {
    reasons.push("按服务端终止规则结算");
  }
  return {
    headline: `定级 ${levelLabel(r.level)}`,
    reasons,
    accuracyText: r.accuracy === null ? "—" : `${Math.round(r.accuracy)}%`,
  };
}

/** 维度得分（0 条 → "—"，镜像后端 null 语义）。 */
export function dimRateText(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate)}%`;
}

// ---------- 计划日历（16W12） ----------

export interface DayCell {
  day: number | null; // null = 补位（上/下月空白）
  inMonth: boolean;
}

/** 月矩阵（周一起始；6 行 × 7 列恒定，避免抖动）。 */
export function monthMatrix(year: number, month: number): DayCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // 周一起始
  const cells: DayCell[] = [];
  for (let i = 0; i < offset; i++) {
    cells.push({ day: null, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({ day: null, inMonth: false });
    if (cells.length >= 42) {
      break;
    }
  }
  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export interface DayTasks {
  todo: number;
  done: number;
}

/** 日格样式：有任务描边；全完成实心（纯阅读自报完成也计入展示）。 */
export function dayCellClass(tasks: DayTasks | undefined): "" | "has" | "alldone" {
  if (!tasks || tasks.todo + tasks.done === 0) {
    return "";
  }
  if (tasks.todo === 0 && tasks.done > 0) {
    return "alldone";
  }
  return "has";
}

// ---------- 计划任务行（BR-10 五态展示） ----------

export type TaskUiState = "todo" | "completed" | "skipped" | "absent" | "rescheduled";

export interface TaskRowUi {
  id: number;
  title: string;
  kind: "objective" | "reading";
  state: TaskUiState;
}

export function taskStateView(t: TaskRowUi): { icon: string; label: string; cls: string } {
  switch (t.state) {
    case "completed":
      return { icon: "✓", label: "已完成", cls: "done" };
    case "skipped":
      return { icon: "⏭", label: "已跳过（不计缺席序列）", cls: "muted" };
    case "rescheduled":
      return { icon: "⇄", label: "已改期（不计缺席序列）", cls: "muted" };
    case "absent":
      return { icon: "✕", label: "缺席", cls: "absent" };
    case "todo":
    default:
      return { icon: "○", label: t.kind === "objective" ? "待办（完成须服务端事件确认）" : "待办（阅读可自报）", cls: "todo" };
  }
}

/** 复选框行为：客观任务只能发起校验（BR-10：自报不入完成）。 */
export function checkboxAction(t: TaskRowUi): "request-confirm" | "self-report" | "none" {
  if (t.state !== "todo") {
    return "none";
  }
  return t.kind === "objective" ? "request-confirm" : "self-report";
}

// ---------- 建议 diff（BR-10 · DR-10 前端） ----------

export type SuggestionKind =
  | "REDUCE"
  | "RETEST"
  | "ACCELERATE"
  | "EVIDENCE_INSUFFICIENT"
  | "CALIBRATION"
  | "NONE";

export interface SuggestionDiff {
  dateLabel: string; // "周一" 或 具体日期
  target: string; // 任务/对象
  from: string;
  to: string;
  reason: string;
}

export interface SuggestionUi {
  kind: SuggestionKind;
  basePlanRevision: number;
  diffs: SuggestionDiff[];
  windowKey: string;
}

const KIND_META: Record<SuggestionKind, { title: string; tone: "amber" | "blue" | "green" | "grey" }> = {
  REDUCE: { title: "建议减少时长或改期", tone: "amber" },
  RETEST: { title: "建议复测 / 补先修", tone: "amber" },
  ACCELERATE: { title: "建议加速", tone: "green" },
  EVIDENCE_INSUFFICIENT: { title: "证据不足，暂不建议", tone: "grey" },
  CALIBRATION: { title: "校准推荐起点（待确认）", tone: "blue" },
  NONE: { title: "无建议", tone: "grey" },
};

export interface SuggestionCard {
  title: string;
  tone: string;
  diffLines: string[];
}

/** 建议卡片渲染（diff 逐条：日期 目标 从→到（原因））。 */
export function suggestionCard(s: SuggestionUi): SuggestionCard {
  const meta = KIND_META[s.kind] ?? KIND_META.NONE;
  return {
    title: meta.title,
    tone: meta.tone,
    diffLines: s.diffs.map((d) => `${d.dateLabel} ${d.target}：${d.from} → ${d.to}（${d.reason}）`),
  };
}

export type ApplyState = "ready" | "conflict-3011" | "dismissed" | "no-op";

/** 应用态（镜像后端 apply：版本匹配/冲突 3011 返回新旧差异/dismissed 窗口静默/无可应用）。 */
export function applyState(s: SuggestionUi, currentRevision: number, dismissedWindows: Set<string>): ApplyState {
  if (dismissedWindows.has(s.windowKey)) {
    return "dismissed";
  }
  if (s.basePlanRevision !== currentRevision) {
    return "conflict-3011";
  }
  if (s.kind === "NONE" || s.kind === "EVIDENCE_INSUFFICIENT") {
    return "no-op";
  }
  return "ready";
}

/** 3011 冲突横幅（返回新旧差异 → 展示）。 */
export function conflictBanner(s: SuggestionUi, currentRevision: number): string {
  return `计划已被修改（建议基于 v${s.basePlanRevision}，当前 v${currentRevision}）——请查看差异后确认`;
}

/** 本地条件只能进一步收窄按钮；服务端显式许可仍是必要条件。 */
export function undoEnabled(revisionAtApply: number, currentRevision: number, hasNewEvidence: boolean, serverAllowed = false): boolean {
  return serverAllowed && revisionAtApply === currentRevision && !hasNewEvidence;
}

/** 校准建议可见性（placement=pending 且首次 ≥10 条有效证据；不自动覆盖）。 */
export function calibrationVisible(placementPending: boolean, eligibleEvidence: number): boolean {
  return placementPending && eligibleEvidence >= 10;
}

export function calibrationCopy(): string {
  return "确认后更新推荐起点（不自动覆盖手动任务）";
}
