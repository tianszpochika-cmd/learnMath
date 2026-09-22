import { describe, expect, it } from "vitest";
import {
  chapterSummary,
  completionHint,
  completionReward,
  completionStage,
  flattenVisible,
  lockLabel,
  optionMark,
  pathCenterRows,
  quizSummary,
  toggleExpand,
  visibleToStudent,
  type TreeNode,
} from "./courseTree";

const chapter = (id: number, status: TreeNode["status"] = "published"): TreeNode => ({
  id,
  parentId: null,
  title: `章${id}`,
  status,
});
const lesson = (id: number, parentId: number, extra: Partial<TreeNode> = {}): TreeNode => ({
  id,
  parentId,
  title: `课${id}`,
  status: "published",
  isLesson: true,
  ...extra,
});

describe("树展开与可见性（16W03）", () => {
  it("折叠切换幂等：加入→移除→再加入", () => {
    let s = new Set<number>();
    s = toggleExpand(s, 5);
    expect(s.has(5)).toBe(true);
    s = toggleExpand(s, 5);
    expect(s.has(5)).toBe(false);
    expect(toggleExpand(new Set([7]), 7).has(7)).toBe(false);
  });

  it("学生端仅见 published：草稿章连同子课隐藏", () => {
    const nodes = [chapter(1), lesson(11, 1), chapter(2, "draft"), lesson(21, 2), chapter(3, "offline")];
    expect(visibleToStudent(chapter(1))).toBe(true);
    expect(visibleToStudent(chapter(2, "draft"))).toBe(false);
    const flat = flattenVisible(nodes, new Set());
    expect(flat.map((f) => f.node.id)).toEqual([1, 11]), "草稿章2/21、下架章3 整支隐藏";
    expect(flat[0].depth).toBe(0);
    expect(flat[1].depth).toBe(1);
  });

  it("折叠父节点 → 子节点不展开", () => {
    const nodes = [chapter(1), lesson(11, 1), lesson(12, 1)];
    expect(flattenVisible(nodes, new Set([1])).map((f) => f.node.id)).toEqual([1]);
    expect(flattenVisible(nodes, new Set()).map((f) => f.node.id)).toEqual([1, 11, 12]);
  });

  it("多根与嵌套深度", () => {
    const nodes: TreeNode[] = [
      chapter(1),
      { id: 11, parentId: 1, title: "子章", status: "published" },
      lesson(111, 11),
      chapter(2),
    ];
    const flat = flattenVisible(nodes, new Set());
    expect(flat.map((f) => `${f.depth}:${f.node.id}`)).toEqual(["0:1", "1:11", "2:111", "0:2"]);
  });
});

describe("锁态与摘要", () => {
  it("锁标签：有原因用原因，无原因兜 3311", () => {
    expect(lockLabel({ id: 1, parentId: null, title: "x", status: "published" }).locked).toBe(false);
    expect(lockLabel({ id: 1, parentId: null, title: "x", status: "published", locked: true, lockReason: "前置：判别式掌握 ≥80" }).text).toBe("前置：判别式掌握 ≥80");
    expect(lockLabel({ id: 1, parentId: null, title: "x", status: "published", locked: true }).text).toContain("3311");
  });

  it("摘要与百分比（复用 home 口径）", () => {
    expect(chapterSummary({ lessons: 8, done: 5, accuracy: 83.4 })).toBe("8 课时 · 已完成 5 · 正确率 83%");
    expect(chapterSummary({ lessons: 8, done: 5 })).toBe("8 课时 · 已完成 5");
    expect(chapterSummary({ lessons: 0, done: 0, accuracy: 0 })).toBe("0 课时 · 已完成 0 · 正确率 0%");
  });

  it("六路径行齐备且路线有效", () => {
    const rows = pathCenterRows();
    expect(rows.map((r) => r.code)).toEqual(["P1", "P2", "P3", "P4", "P5", "P6"]);
    for (const r of rows) {
      expect(r.route.startsWith("/")).toBe(true);
    }
    expect(rows[0].route).toBe("/paths/course/1");
    expect(rows[1].route).toBe("/graph");
  });
});

describe("课时完成展示（20 §2 BR-02 前端镜像）", () => {
  const base = { readConfirmed: false, policy: "practice_required" as const, answeredAll: false, rate: -1, alreadyCompleted: false };

  it("五态矩阵与服务端同构", () => {
    expect(completionStage({ ...base })).toBe("not-read");
    expect(completionStage({ ...base, readConfirmed: true })).toBe("practice-pending");
    expect(completionStage({ ...base, readConfirmed: true, answeredAll: true, rate: 79.9 })).toBe("practice-pending");
    expect(completionStage({ ...base, readConfirmed: true, answeredAll: true, rate: 80 })).toBe("practice-pass");
    expect(completionStage({ ...base, readConfirmed: true, policy: "read_only" })).toBe("read-only-done");
    expect(completionStage({ ...base, alreadyCompleted: true })).toBe("already");
  });

  it("提示语关键句式", () => {
    expect(completionHint("not-read")).toContain("read_completed");
    expect(completionHint("practice-pending", { answered: 2, total: 5, rate: 40 })).toBe(
      "阅读已记录，完成随堂练后继续（2/5，正确率 40% < 80%）",
    );
    expect(completionHint("practice-pending")).toContain("阅读已记录"), "无明细也不空窗";
    expect(completionHint("read-only-done")).toContain("不代表掌握");
    expect(completionHint("already")).toContain("幂等");
    expect(completionHint("practice-pass")).toContain("随堂练达标");
  });

  it("奖励展示：仅首次完成 +10", () => {
    expect(completionReward("practice-pass")).toBe(10);
    expect(completionReward("read-only-done")).toBe(10);
    expect(completionReward("already")).toBe(0);
    expect(completionReward("not-read")).toBe(0);
    expect(completionReward("practice-pending")).toBe(0);
  });
});

describe("随堂练展示（右栏）", () => {
  const q = { stem: "1+1=?", options: ["1", "2", "3"], answerIndex: 1 };

  it("作答后标记：对项 right、错选 wrong、未答空白", () => {
    expect(optionMark(q, 1, true)).toBe("right");
    expect(optionMark(q, 0, true)).toBe("wrong");
    expect(optionMark(q, 0, false)).toBe("");
  });

  it("达标汇总：全答且≥80%；无题护栏", () => {
    expect(quizSummary(5, 5, 4)).toEqual({ label: "5/5 · 正确率 80%", passed: true });
    expect(quizSummary(5, 5, 3).passed).toBe(false);
    expect(quizSummary(4, 5, 4).passed).toBe(false), "未答齐不算达标";
    expect(quizSummary(0, 0, 0)).toEqual({ label: "无客观题", passed: false });
  });
});
