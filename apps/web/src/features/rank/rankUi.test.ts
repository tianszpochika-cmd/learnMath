import { describe, expect, it } from "vitest";
import {
  EXPORT_TTL_MS,
  NOTIFY_TABS,
  SAMPLE_LEAGUES,
  anomalyMark,
  cancelView,
  challengeCard,
  exportLinkView,
  filterNotify,
  formatDuration,
  leagueOf,
  loginOutcomeText,
  myRankView,
  tabUnread,
  totalUnread,
  weeklyRanks,
  type NotifyItem,
} from "./rankUi";

const NOW = Date.UTC(2026, 8, 22, 10, 0, 0);

describe("周榜（镜像后端：积分降序+同分时间早者）", () => {
  const entries = [
    { userId: 1, name: "甲", points: 2000, achievedAtEpochSec: 50 },
    { userId: 2, name: "乙", points: 2100, achievedAtEpochSec: 90 },
    { userId: 3, name: "丙", points: 2000, achievedAtEpochSec: 20 },
  ];

  it("排序与名次", () => {
    const ranks = weeklyRanks(entries);
    expect(ranks.map((r) => r.userId)).toEqual([2, 3, 1]);
    expect(ranks.map((r) => r.position)).toEqual([1, 2, 3]);
    expect(weeklyRanks([])).toEqual([]);
  });

  it("我的行：第 1 无差距；其余给 gap 文案；不在榜 → null", () => {
    const ranks = weeklyRanks(entries);
    const first = myRankView(ranks, 2)!;
    expect(first.position).toBe(1);
    expect(first.gapToPrev).toBeNull();
    expect(first.gapText).toBe("已是第 1 名");

    const third = myRankView(ranks, 1)!;
    expect(third.gapToPrev).toBe(0); // 同 2000
    expect(third.gapText).toContain("距第 2 名");

    expect(myRankView(ranks, 99)).toBeNull();
  });
});

describe("段位（阈值可配）", () => {
  it("min 含等号；自定义表；空表兜底", () => {
    expect(leagueOf(0)).toBe("黑铁");
    expect(leagueOf(999)).toBe("青铜");
    expect(leagueOf(1000)).toBe("白银"), "边界含等号";
    expect(leagueOf(2000)).toBe("黄金");
    expect(leagueOf(99999)).toBe("铂金");
    expect(leagueOf(1500, [{ name: "自定义A", min: 1000 }])).toBe("自定义A");
    expect(leagueOf(100, [])).toBe("—");
    expect(SAMPLE_LEAGUES.length).toBeGreaterThan(3);
  });
});

describe("赛事卡与时长异常", () => {
  it("三态按钮/徽标", () => {
    const up = challengeCard("upcoming");
    expect(up.buttonEnabled).toBe(true);
    expect(up.buttonLabel).toBe("报名参赛");
    const live = challengeCard("live");
    expect(live.buttonEnabled).toBe(false);
    expect(live.badgeClass).toBe("ok");
    const ended = challengeCard("ended");
    expect(ended.buttonEnabled).toBe(false);
    expect(ended.badgeClass).toBe("grey");
  });

  it("时长异常：低于均值 50% 标记", () => {
    // 4:31=271s vs 38:12=2292s → 271 < 1146 → 异常
    const m = anomalyMark(271, 2292);
    expect(m.flagged).toBe(true);
    expect(m.text).toContain("抽查");
    expect(anomalyMark(2000, 2292).flagged).toBe(false);
    expect(anomalyMark(1146, 2292).flagged).toBe(false), "等于阈值不算";
    expect(anomalyMark(100, 0).flagged).toBe(false);
    expect(formatDuration(271)).toBe("4:31");
    expect(formatDuration(9)).toBe("0:09");
    expect(formatDuration(-5)).toBe("0:00");
  });
});

describe("注销状态机展示（01 U-07 镜像）", () => {
  const due = NOW + 7 * 24 * 3600 * 1000;

  it("active：入口文案，无面板", () => {
    const v = cancelView("active", null, NOW);
    expect(v.showPanel).toBe(false);
    expect(v.primaryLabel).toContain("二次验证");
    expect(v.note).toContain("7 天");
    expect(loginOutcomeText("active")).toBe("");
  });

  it("pending：倒计时 + 可撤销 + 2008 拦截", () => {
    const v = cancelView("pending", due, NOW);
    expect(v.showPanel).toBe(true);
    expect(v.canCancel).toBe(true);
    expect(v.countdownText).toBe("7天0h");
    expect(v.primaryLabel).toContain("撤销注销");
    expect(v.irreversible).toBe(false);
    expect(loginOutcomeText("pending")).toContain("2008");

    // 到期瞬间 → 不可撤销
    const expired = cancelView("pending", NOW, NOW);
    expect(expired.canCancel).toBe(false);
    expect(expired.countdownText).toBe("已到期");
    expect(expired.irreversible).toBe(true);
  });

  it("anonymized：不可逆 + 2009 + 社区显示已注销", () => {
    const v = cancelView("anonymized", due, NOW + 8 * 24 * 3600 * 1000);
    expect(v.irreversible).toBe(true);
    expect(v.countdownText).toBe("已注销");
    expect(v.note).toContain("已注销用户");
    expect(loginOutcomeText("anonymized")).toContain("2009");
  });
});

describe("导出链接 7 天（01 U-06 / 02 §7）", () => {
  it("无记录/有效剩余天/过期", () => {
    expect(exportLinkView(null, NOW)).toEqual({ state: "none", daysLeftText: "暂无导出记录" });
    const created = NOW - 24 * 3600 * 1000;
    const valid = exportLinkView(created, NOW);
    expect(valid.state).toBe("valid");
    expect(valid.daysLeftText).toContain("6 天"), "ceil(6.x)=6";
    const edge = exportLinkView(NOW - EXPORT_TTL_MS + 1000, NOW);
    expect(edge.state).toBe("valid");
    expect(edge.daysLeftText).toContain("1 天");
    const expired = exportLinkView(NOW - EXPORT_TTL_MS, NOW);
    expect(expired.state).toBe("expired");
    expect(expired.daysLeftText).toContain("清理");
  });
});

describe("通知四类（04 分类镜像）", () => {
  const items: NotifyItem[] = [
    { id: 1, category: "SYSTEM", title: "协议更新", timeLabel: "刚刚", read: false },
    { id: 2, category: "SYSTEM", title: "公告", timeLabel: "昨天", read: true },
    { id: 3, category: "LEARNING", title: "每日一练就绪", timeLabel: "09:00", read: false },
    { id: 4, category: "COMMUNITY", title: "有新回复", timeLabel: "2h", read: false },
    { id: 5, category: "MODERATION", title: "帖子已通过", timeLabel: "3h", read: true },
  ];

  it("四 Tab 齐备 + 未读数按类", () => {
    expect(NOTIFY_TABS.map((t) => t.key)).toEqual(["SYSTEM", "LEARNING", "COMMUNITY", "MODERATION"]);
    expect(NOTIFY_TABS.map((t) => t.label)).toEqual(["系统", "学习", "社区", "审核"]);
    expect(tabUnread(items)).toEqual({ SYSTEM: 1, LEARNING: 1, COMMUNITY: 1, MODERATION: 0 });
    expect(totalUnread(items)).toBe(3);
    expect(totalUnread([])).toBe(0);
  });

  it("按类过滤与空态", () => {
    expect(filterNotify(items, "SYSTEM").map((n) => n.id)).toEqual([1, 2]);
    expect(filterNotify(items, "MODERATION")).toHaveLength(1);
    expect(filterNotify([], "SYSTEM")).toEqual([]);
  });
});
