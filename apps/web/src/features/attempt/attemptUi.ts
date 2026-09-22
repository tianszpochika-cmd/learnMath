/**
 * 作答/报告 UI 纯逻辑（16W08/09 · WD4 · 20 §4 BR-04/BR-07 · 16 §5 快捷键；可单测）。
 * 权威边界：判分/结算在服务端（AttemptLifecycle），本模块只做交互与展示映射。
 */

// ---------- 答题卡（WD4 右栏） ----------

export interface SheetItem {
  seq: number;
  answered: boolean;
  flagged: boolean;
}

export type CellClass = "done" | "flag" | "todo" | "cur";

/** 单元格样式：当前题 > 已答 > 标记 > 未答。 */
export function cellClass(item: SheetItem, currentSeq: number): CellClass {
  if (item.seq === currentSeq) {
    return "cur";
  }
  if (item.answered) {
    return "done";
  }
  if (item.flagged) {
    return "flag";
  }
  return "todo";
}

export interface SheetCounts {
  total: number;
  answered: number;
  flagged: number;
}

export function sheetCounts(items: SheetItem[]): SheetCounts {
  return {
    total: items.length,
    answered: items.filter((i) => i.answered).length,
    flagged: items.filter((i) => i.flagged).length,
  };
}

/** 进度文案："进度 2 / 5"。 */
export function sheetProgressLabel(c: SheetCounts): string {
  return `进度 ${c.answered} / ${c.total}`;
}

// ---------- 数学工具条（16 §5：桌面版插入光标处） ----------

/** 常用符号序（与 16W08 工具条一致）。 */
export const MATH_SYMBOLS = ["²", "√()", "/", "±", "π", "θ", "≤", "∞"] as const;

export interface InsertResult {
  value: string;
  cursor: number;
}

/** 在光标处插入符号（无光标参数 → 追加末尾）；返回新值与新光标位。 */
export function insertMath(current: string, symbol: string, cursorPos?: number): InsertResult {
  const pos = cursorPos === undefined || cursorPos < 0 || cursorPos > current.length
    ? current.length
    : cursorPos;
  const value = current.slice(0, pos) + symbol + current.slice(pos);
  return { value, cursor: pos + symbol.length };
}

// ---------- 倒计时（BR-07：服务端 deadline 为准；等于即过期） ----------

export type Tone = "ok" | "warn" | "danger" | "expired";

/** 剩余毫秒 → 展示文本（负数统一"已到期"）。 */
export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) {
    return "已到期";
  }
  const totalSec = Math.ceil(remainingMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 预警分档：≤0 过期 / <1min danger / <5min warn / 其余 ok。 */
export function countdownTone(remainingMs: number): Tone {
  if (remainingMs <= 0) {
    return "expired";
  }
  if (remainingMs < 60_000) {
    return "danger";
  }
  if (remainingMs < 300_000) {
    return "warn";
  }
  return "ok";
}

/** 剩余时长（服务端 deadline 与校准后的 now；client 只渲染差值）。 */
export function remainingMs(deadlineAtMs: number, serverNowMs: number): number {
  return deadlineAtMs - serverNowMs;
}

// ---------- 快捷键（16 §5：作答页生效，输入框内不劫持） ----------

export type KeyAction =
  | { type: "select"; index: number }
  | { type: "submit" }
  | { type: "prev" }
  | { type: "next" }
  | { type: "flag" }
  | { type: "close" }
  | { type: "search" };

export interface KeyEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  target?: { tagName?: string; isContentEditable?: boolean } | null;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTyping(target: KeyEventLike["target"]): boolean {
  if (!target) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = (target.tagName || "").toUpperCase();
  return TYPING_TAGS.has(tag);
}

/**
 * 快捷键映射。enabled=false（非作答页）→ null；
 * 输入态一律不劫持（含 Ctrl+K —— 16 §5"输入框内不劫持"）。
 */
export function keyAction(e: KeyEventLike, enabled = true): KeyAction | null {
  if (!enabled) {
    return null;
  }
  if (isTyping(e.target)) {
    return null;
  }
  const k = e.key;
  if ((e.ctrlKey || e.metaKey) && (k === "k" || k === "K")) {
    return { type: "search" };
  }
  if (k >= "1" && k <= "4") {
    return { type: "select", index: Number(k) - 1 };
  }
  switch (k) {
    case "Enter":
      return { type: "submit" };
    case "ArrowLeft":
      return { type: "prev" };
    case "ArrowRight":
      return { type: "next" };
    case "f":
    case "F":
      return { type: "flag" };
    case "Escape":
      return { type: "close" };
    default:
      return null;
  }
}

// ---------- 草稿本地化（BR-07：按 userId+attemptId 隔离；跨设备不恢复未同步内容） ----------

/** 本地草稿键（07 语义：同浏览器、分用户分卷）。 */
export function draftKey(userId: string | number, attemptId: string | number): string {
  return `lm.draft:${userId}:${attemptId}`;
}

export interface LocalDraft {
  revision: number;
  updatedAt: number;
  payload: unknown;
}

/** 脏数据/结构不符 → null（不炸页面；跨设备恢复只认服务端版本）。 */
export function safeParseDraft(raw: string | null | undefined): LocalDraft | null {
  if (!raw) {
    return null;
  }
  try {
    const d = JSON.parse(raw) as LocalDraft;
    if (!d || typeof d.revision !== "number" || typeof d.updatedAt !== "number") {
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

export type DraftRelation = "equal" | "server-newer" | "local-newer";

/** revision 关系（冲突 → UI 出两份答案让用户确认，不静默覆盖 20 §7）。 */
export function draftRelation(localRevision: number, serverRevision: number): DraftRelation {
  if (localRevision === serverRevision) {
    return "equal";
  }
  return localRevision > serverRevision ? "local-newer" : "server-newer";
}

// ---------- 交卷确认（BR-07：到期前确认；文案如实列未答） ----------

export function submitConfirmText(items: SheetItem[]): string {
  const total = items.length;
  const answered = items.filter((i) => i.answered).length;
  if (answered >= total) {
    return `全部作答完成（${total}/${total}），确认交卷？`;
  }
  const missing = items
    .filter((i) => !i.answered)
    .map((i) => i.seq)
    .slice(0, 6);
  const more = total - answered > missing.length ? "…" : "";
  return `已答 ${answered}/${total}，未答 ${total - answered} 题（${missing.join("、")}${more}），确认交卷？`;
}

// ---------- 报告：客观-自评拆分（20 §4） ----------

export interface ObjectiveView {
  main: string;
  sub: string | null;
  muted: boolean;
}

/** 客观区展示：纯解答卷 → "本卷无客观成绩"（禁 0 分/满分）。 */
export function objectiveView(earned: number, possible: number, rate: number | null): ObjectiveView {
  if (possible <= 0 || rate === null) {
    return { main: "本卷无客观成绩", sub: null, muted: true };
  }
  return {
    main: `${Math.round(rate * 100) / 100}%`,
    sub: `${earned}/${possible}`,
    muted: false,
  };
}

export type SelfValue = "unrated" | "cannot" | "partial" | "can" | "skipped";

export function selfValueLabel(v: SelfValue): string {
  switch (v) {
    case "unrated":
      return "未评";
    case "cannot":
      return "不会";
    case "partial":
      return "半会";
    case "can":
      return "会";
    case "skipped":
      return "暂不评价";
  }
}

/** 参考值（unrated/skipped → null；不会 0 / 半会 0.5 / 会 1）。 */
export function selfValueRef(v: SelfValue): number | null {
  switch (v) {
    case "cannot":
      return 0;
    case "partial":
      return 0.5;
    case "can":
      return 1;
    default:
      return null;
  }
}

/** 自评进度（skipped 算已选；unrated 阻塞 finalized 展示"继续自评"）。 */
export function selfAssessProgress(values: SelfValue[]): { answered: number; total: number; label: string; canResume: boolean } {
  const total = values.length;
  const answered = values.filter((v) => v !== "unrated").length;
  const canResume = total > 0 && answered < total;
  return {
    answered,
    total,
    label: `自评 ${answered}/${total}`,
    canResume,
  };
}

/** 自评分区文案（改评只更新自评证据，不重放客观/奖励 —— 展示注记）。 */
export function selfAssessNote(): string {
  return "改评仅更新自评证据，不影响客观成绩与奖励（BR-04）";
}
