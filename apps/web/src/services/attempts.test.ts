import { describe, expect, it } from "vitest";
import { attemptPath, projectAttempt, serverRemainingMs } from "./attempts";

describe("作答投影与服务端时间", () => {
  it("不为缺失题面、截止时间或判分生成示例数据", () => {
    const view = projectAttempt({ id: "42", items: [{ seq: 1, questionId: "9" }] });
    expect(view.items).toEqual([]);
    expect(view.deadlineAt).toBe("");
    expect(view.objectiveRate).toBeNull();
  });

  it("保留服务端题号、状态和客观判分", () => {
    const view = projectAttempt({ id: "42", state: "finalized", revision: 3, serverNow: "2026-09-23T04:00:00Z", deadlineAt: "2026-09-23T04:01:00Z", items: [
      { seq: 2, questionId: 10, stem: "2+2=?", options: [{ key: "A", text: "4" }], submitted: true, judgement: "correct" },
      { seq: 1, questionId: 9, stem: "1+1=?", draft: "2" },
    ], objective: { earned: 1, possible: 2, rate: 50 } });
    expect(view.items.map((item) => item.seq)).toEqual([1, 2]);
    expect(view.items[1]?.judgement).toBe("correct");
    expect(view.objectiveRate).toBe(50);
    expect(serverRemainingMs(view.serverNow, view.deadlineAt, 15_000)).toBe(45_000);
  });

  it("非法作答编号不能拼入请求路径", () => {
    expect(() => attemptPath("../admin")).toThrow();
    expect(serverRemainingMs("", "2026-09-23T04:01:00Z", 0)).toBeNull();
  });

  it("只按服务端明确的策略和锁定标志开放作答，缺选项 key 禁答", () => {
    const view = projectAttempt({ state: "in_progress", revision: 2, feedbackMode: "on_submit", items: [
      { seq: 1, stem: "选择", type: "single_choice", options: [{ text: "甲" }], locked: false },
      { seq: 2, stem: "选择", type: "single_choice", options: [{ key: "A", text: "甲" }] },
      { seq: 3, stem: "计算", type: "free_answer", answer: "标准答案", locked: false, submitted: true, judgement: "correct" },
    ] });
    expect(view.status).toBe("in_progress");
    expect(view.feedbackMode).toBe("on_submit");
    expect(view.revisionKnown).toBe(true);
    expect(view.items[0]).toMatchObject({ options: [], optionError: true, locked: false });
    expect(view.items[1]).toMatchObject({ optionError: false, locked: true });
    expect(view.items[2]?.draft).toBe("");
    expect(view.items[2]?.judgement).toBeNull();
    expect(projectAttempt({ feedbackMode: "unknown", items: [{ seq: 1, stem: "?", locked: false }] }).feedbackMode).toBeNull();
  });
});
