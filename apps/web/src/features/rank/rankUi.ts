/**
 * 排行/挑战 + 我的·设置·通知 展示纯逻辑（16W16/17 · 02 §5.7 · 01 U-06/U-07 · 04 通知；可单测）。
 * 权威边界：结算/排名=服务端（GamificationRules.weeklyRanks 同口径）、注销/导出状态=服务端
 * （ComplianceRules），本模块只做排序投影、倒计时展示与状态机**前端镜像**。
 */

// ---------- 周榜（镜像后端：积分降序 → 同分达成时间早者靠前） ----------

export interface RankEntryUi {
  userId: number;
  name: string;
  points: number;
  achievedAtEpochSec: number;
}

export interface RankRowUi {
  position: number;
  userId: number;
  name: string;
  points: number;
}

export function weeklyRanks(entries: RankEntryUi[]): RankRowUi[] {
  const sorted = [...(entries ?? [])].sort((a, b) => {
    if (a.points !== b.points) {
      return b.points - a.points;
    }
    return a.achievedAtEpochSec - b.achievedAtEpochSec;
  });
  return sorted.map((e, i) => ({ position: i + 1, userId: e.userId, name: e.name, points: e.points }));
}

export interface MyRankView {
  position: number;
  points: number;
  gapToPrev: number | null; // 第 1 名 → null
  gapText: string;
}

export function myRankView(ranks: RankRowUi[], myId: number): MyRankView | null {
  const idx = ranks.findIndex((r) => r.userId === myId);
  if (idx < 0) {
    return null;
  }
  const me = ranks[idx];
  const prev = idx > 0 ? ranks[idx - 1] : null;
  const gap = prev ? prev.points - me.points : null;
  return {
    position: me.position,
    points: me.points,
    gapToPrev: gap,
    gapText: gap === null ? "已是第 1 名" : `距第 ${prev!.position} 名 ${gap} 分`,
  };
}

// ---------- 段位（阈值可配 · 默认表仅为样例，落库走配置） ----------

export interface LeagueRule {
  name: string;
  min: number;
}

export const SAMPLE_LEAGUES: LeagueRule[] = [
  { name: "黑铁", min: 0 },
  { name: "青铜", min: 500 },
  { name: "白银", min: 1000 },
  { name: "黄金", min: 2000 },
  { name: "铂金", min: 3500 },
];

/** 段位（min 含等号；空表 → "—"）。 */
export function leagueOf(points: number, table: LeagueRule[] = SAMPLE_LEAGUES): string {
  const list = [...(table ?? [])].sort((a, b) => a.min - b.min);
  let current = "";
  for (const rule of list) {
    if (points >= rule.min) {
      current = rule.name;
    }
  }
  return current || "—";
}

// ---------- 赛事卡 ----------

export type ChallengeStatus = "upcoming" | "live" | "ended";

export interface ChallengeCardView {
  buttonLabel: string;
  buttonEnabled: boolean;
  badgeText: string;
  badgeClass: "warn" | "ok" | "grey";
}

export function challengeCard(status: ChallengeStatus): ChallengeCardView {
  switch (status) {
    case "upcoming":
      return { buttonLabel: "报名参赛", buttonEnabled: true, badgeText: "即将开始", badgeClass: "warn" };
    case "live":
      return { buttonLabel: "进行中", buttonEnabled: false, badgeText: "48h 限时", badgeClass: "ok" };
    case "ended":
    default:
      return { buttonLabel: "已结束", buttonEnabled: false, badgeText: "已归档", badgeClass: "grey" };
  }
}

/** 时长异常（防作弊标记 01 P6-5：显著短于均值 → 抽查）。默认阈值=均值 50%。 */
export function anomalyMark(secondsSpent: number, avgSeconds: number): { flagged: boolean; text: string } {
  if (avgSeconds <= 0 || secondsSpent <= 0) {
    return { flagged: false, text: "" };
  }
  const threshold = avgSeconds * 0.5;
  if (secondsSpent < threshold) {
    return { flagged: true, text: "时长异常 → 抽查" };
  }
  return { flagged: false, text: "正常" };
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

// ---------- 注销状态机展示（01 U-07 · 20 后端 ComplianceRules 镜像） ----------

export type AccountFlowState = "active" | "pending" | "anonymized";

export interface CancelView {
  showPanel: boolean;
  canCancel: boolean;
  countdownText: string | null;
  primaryLabel: string;
  irreversible: boolean;
  note: string;
}

/** 注销面板投影：pending 显示倒计时；到期前可撤销；anonymized 不可逆。 */
export function cancelView(state: AccountFlowState, dueAtMs: number | null, nowMs: number): CancelView {
  if (state === "active") {
    return {
      showPanel: false,
      canCancel: false,
      countdownText: null,
      primaryLabel: "申请注销（需验证码二次验证）",
      irreversible: false,
      note: "冷静期 7 天，期内可撤销",
    };
  }
  if (state === "pending") {
    const remaining = (dueAtMs ?? nowMs) - nowMs;
    const canCancel = remaining > 0;
    return {
      showPanel: true,
      canCancel,
      countdownText: formatCountdownMs(remaining),
      primaryLabel: canCancel ? "撤销注销（登录即撤销）" : "已到期",
      irreversible: !canCancel,
      note: canCancel
        ? "冷静期内可撤销；普通登录会被 2008 拦截"
        : "已到期进入匿名化（不可逆）",
    };
  }
  return {
    showPanel: true,
    canCancel: false,
    countdownText: "已注销",
    primaryLabel: "已注销（不可恢复）",
    irreversible: true,
    note: "PII 已清除；社区存量内容显示「已注销用户」",
  };
}

function formatCountdownMs(ms: number): string {
  if (ms <= 0) {
    return "已到期";
  }
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  return `${days}天${hours}h`;
}

/** 登录拦截文案（镜像后端 loginDecision：2008/2009/放行）。 */
export function loginOutcomeText(state: AccountFlowState): string {
  switch (state) {
    case "active":
      return "";
    case "pending":
      return "账号注销冷静期，不可登录，请先撤销（2008）";
    case "anonymized":
      return "账号已注销（2009）";
  }
}

// ---------- 数据导出链接（01 U-06：7 天有效，02 §7 清理任务） ----------

export interface ExportLinkView {
  state: "none" | "valid" | "expired";
  daysLeftText: string;
}

export const EXPORT_TTL_MS = 7 * 24 * 3600 * 1000;

export function exportLinkView(createdAtMs: number | null, nowMs: number): ExportLinkView {
  if (createdAtMs === null) {
    return { state: "none", daysLeftText: "暂无导出记录" };
  }
  const expires = createdAtMs + EXPORT_TTL_MS;
  if (nowMs >= expires) {
    return { state: "expired", daysLeftText: "链接已失效（7 天自动清理）" };
  }
  const daysLeft = Math.ceil((expires - nowMs) / (24 * 3600 * 1000));
  return { state: "valid", daysLeftText: `链接有效 · ${daysLeft} 天后失效` };
}

// ---------- 通知四类（04 模板分类镜像） ----------

export type NotifyCat = "SYSTEM" | "LEARNING" | "COMMUNITY" | "MODERATION";

export const NOTIFY_TABS: ReadonlyArray<{ key: NotifyCat; label: string; icon: string }> = [
  { key: "SYSTEM", label: "系统", icon: "📢" },
  { key: "LEARNING", label: "学习", icon: "🎯" },
  { key: "COMMUNITY", label: "社区", icon: "💬" },
  { key: "MODERATION", label: "审核", icon: "🛡" },
];

export interface NotifyItem {
  id: number;
  category: NotifyCat;
  title: string;
  timeLabel: string;
  read: boolean;
}

/** 每类未读数（0 也显示 Tab，红点只在 >0）。 */
export function tabUnread(items: NotifyItem[]): Record<NotifyCat, number> {
  const out: Record<NotifyCat, number> = { SYSTEM: 0, LEARNING: 0, COMMUNITY: 0, MODERATION: 0 };
  for (const n of items ?? []) {
    if (!n.read) {
      out[n.category] += 1;
    }
  }
  return out;
}

export function filterNotify(items: NotifyItem[], cat: NotifyCat): NotifyItem[] {
  return (items ?? []).filter((n) => n.category === cat);
}

export function totalUnread(items: NotifyItem[]): number {
  return (items ?? []).filter((n) => !n.read).length;
}
