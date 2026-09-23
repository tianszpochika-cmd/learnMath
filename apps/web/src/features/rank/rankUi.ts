/** 个人设置与通知展示纯逻辑；排行与赛事以服务端返回为准。 */

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
