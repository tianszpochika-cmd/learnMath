import { describe, expect, it } from "vitest";
import { checkinView, deletionView, noticeTarget, noticesView, pointsView, postView, rankView, searchView } from "./socialSystemModel";

describe("mobile social and account projections", () => {
  it("keeps missing checkin and point fields unknown rather than awarding locally", () => {
    expect(checkinView({ streak: 5 })).toMatchObject({ checked: null, streak: 5, days: [] });
    expect(pointsView({ entries: [{ amount: 3, reason: "练习" }] })).toMatchObject({ balance: null, rows: [{ amount: 3, title: "练习" }] });
    expect(pointsView({ balance: 12 })).toBeNull();
  });
  it("does not reveal moderated community posts or invent leaderboard data", () => {
    const pending = { id: 7, title: "试题", content: "内容", status: "PENDING" };
    expect(postView(pending)).toBeNull();
    expect(postView({ ...pending, status: 1, mine: true })?.status).toBe("PENDING");
    expect(postView({ ...pending, status: 2, replies: [{ id: 1, content: "待审", status: 1 }, { id: 2, content: "可见", status: 2 }] })?.replies)
      .toMatchObject([{ id: "2", content: "可见" }]);
    expect(postView({ ...pending, status: "DELETED", mine: true })).toBeNull();
    expect(rankView({ rankings: [{ id: 1, nickname: "真实姓名", points: 10 }] })?.[0].nickname).toBe("匿名同学");
    expect(rankView({})).toBeNull();
  });
  it("only navigates notifications and search results through allowlisted targets", () => {
    const rows = noticesView({ items: [
      { id: 1, title: "正常", type: 3, read: 1, link: "/community/posts/5" },
      { id: 2, title: "恶意", refType: "https://attacker.test", refId: "../../../etc" },
    ] });
    expect(rows?.length).toBe(2);
    expect(rows?.[0]).toMatchObject({ type: "community", read: true });
    expect(noticeTarget(rows![0])).toBe("/pages/social/post/index?id=5");
    expect(noticeTarget(rows![1])).toBeNull();
    expect(searchView({ results: [{ id: 3, type: "course", title: "几何" }, { id: 2, type: "question", title: "证明题" }] }))
      .toMatchObject([{ target: "/pages/learn/course/index?id=3" }, { target: null }]);
  });
  it("requires a server account state before offering cancellation", () => {
    expect(deletionView({ user: { id: 1 } }).state).toBe("unknown");
    expect(deletionView({ profile: { status: 3 } }).state).toBe("cooling");
    expect(deletionView({ accountStatus: "cancelled" }).state).toBe("active");
    expect(deletionView({ accountStatus: "pending_deletion", coolingEndsAt: "2026-10-01" }))
      .toEqual({ state: "cooling", deadline: "2026-10-01" });
  });
});
