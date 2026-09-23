import { describe, expect, it } from "vitest";
import { EXPORT_TTL_MS, NOTIFY_TABS, cancelView, exportLinkView, filterNotify, loginOutcomeText, tabUnread, totalUnread, type NotifyItem } from "./rankUi";

const NOW = Date.UTC(2026, 8, 22, 10, 0, 0);

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
