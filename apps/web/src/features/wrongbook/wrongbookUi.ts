/**
 * 错题本与断链展示（16W10 · 20 §5 BR-05 前端镜像；可单测）。
 * 权威边界：断链状态机/证据存取在后端 BreakEvidence，本模块只做徽标、快照回放与补救展示。
 */

// ---------- 断链四状态徽标 ----------

export type BreakStatus = "none" | "unlocated" | "suggested" | "observed" | "self_reported";

export interface BreakBadge {
  text: string;
  tone: "grey" | "amber" | "red" | "blue" | "none";
}

export function breakBadge(status: BreakStatus): BreakBadge {
  switch (status) {
    case "unlocated":
      return { text: "尚未定位", tone: "grey" };
    case "suggested":
      return { text: "可能卡在这里，待确认", tone: "amber" };
    case "observed":
      return { text: "预测答错 · 已定位", tone: "red" };
    case "self_reported":
      return { text: "我的自报", tone: "blue" };
    case "none":
    default:
      return { text: "", tone: "none" };
  }
}

/** 是否作确定断言（suggested/unlocated 不确定；BR-05）。 */
export function deterministic(status: BreakStatus): boolean {
  return status === "observed" || status === "self_reported";
}

/** 是否计入推理画像（仅 observed；BR-05：AI 建议与自报不计）。 */
export function countsInProfile(status: BreakStatus): boolean {
  return status === "observed";
}

export function profileNote(status: BreakStatus): string {
  return countsInProfile(status) ? "计入推理画像" : "不计入推理画像";
}

// ---------- 证据快照展示（链重排/下架后回放原解法） ----------

export interface BreakEvidenceView {
  solutionPathId: number | null;
  chainVersion: number | null;
  minimalChainSteps: number[];
}

/** 快照可回放（有链 id 且有最小步骤）。 */
export function snapshotDisplayable(e: BreakEvidenceView | null): boolean {
  return Boolean(e && e.solutionPathId !== null && e.minimalChainSteps.length > 0);
}

/** 步骤串："S1 → S2 → S3"。 */
export function chainPreview(steps: number[]): string {
  if (!steps || steps.length === 0) {
    return "";
  }
  return steps.map((s) => `S${s}`).join(" → ");
}

/** 跨版本提示：版本不同 → 只显示快照、禁跳新版本同 seq（BR-05）。 */
export function versionNote(e: BreakEvidenceView | null, currentVersion: number): string | null {
  if (!e || e.chainVersion === null) {
    return null;
  }
  if (e.chainVersion === currentVersion) {
    return null;
  }
  return `链已更新（v${e.chainVersion} → v${currentVersion}）：显示原解法步骤说明，不跳转新版本同 seq`;
}

// ---------- 补救推荐（如实数量 · 期望上限 2） ----------

export interface RemedialPlanView {
  count: number;
  startButton: boolean;
  message: string;
}

export function remediationPlan(availableExercises: number, hasPublishedContent: boolean): RemedialPlanView {
  const available = Math.max(0, availableExercises);
  if (available >= 2) {
    return { count: 2, startButton: true, message: "开始 2 题" };
  }
  if (available > 0) {
    return {
      count: available,
      startButton: true,
      message: `开始 ${available} 题（同知识点仅 ${available} 题）`,
    };
  }
  if (hasPublishedContent) {
    return {
      count: 0,
      startButton: false,
      message: "暂无可用练习：先读已发布概念/公式内容，稍后复习（0 题如实展示）",
    };
  }
  return { count: 0, startButton: false, message: "暂无可用内容，请稍后复习" };
}

// ---------- AI 不可用降级（不等待 AI 才提交） ----------

export interface AiFallback {
  headline: string;
  actions: string[];
}

export function aiUnavailableFallback(): AiFallback {
  return {
    headline: "尚未定位（AI 未启用/失败，无需等待即可提交）",
    actions: ["选错因标签", "手选解法步骤", "自报断点", "同知识点练习"],
  };
}

// ---------- 错题列表筛选与到期 ----------

export interface WrongItem {
  id: number;
  title: string;
  node: string;
  wrongCount: number;
  dueDays: number; // <0 逾期 / 0 今天 / >0 未来
  mastered: boolean;
  breakStatus: BreakStatus;
}

export type WrongTab = "all" | "due" | "unmastered" | "has-break";

export function filterWrong(list: WrongItem[], tab: WrongTab): WrongItem[] {
  const src = list ?? [];
  switch (tab) {
    case "due":
      return src.filter((i) => i.dueDays <= 0 && !i.mastered);
    case "unmastered":
      return src.filter((i) => !i.mastered);
    case "has-break":
      return src.filter((i) => i.breakStatus !== "none");
    case "all":
    default:
      return [...src];
  }
}

/** 到期文案（09-L3：到期今天 / 逾期 / N 天后）。 */
export function dueText(dueDays: number): string {
  if (dueDays < 0) {
    return `已逾期 ${-dueDays} 天`;
  }
  if (dueDays === 0) {
    return "到期今天";
  }
  return `${dueDays} 天后到期`;
}

/** 行内断链详情是否展示（有非 none 断链状态）。 */
export function showBreakDetail(status: BreakStatus): boolean {
  return status !== "none";
}
