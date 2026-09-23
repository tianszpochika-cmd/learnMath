import { beforeEach, describe, expect, it, vi } from "vitest";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./client", () => ({ getAppHttp: () => ({ request }) }));

import {
  actOnSuggestion,
  createRulePlan,
  projectCalendar,
  projectPlan,
  projectSuggestions,
  undoPlan,
} from "./plans";

beforeEach(() => request.mockReset());

describe("计划服务端投影", () => {
  it("空计划与未知任务状态不生成演示完成记录", () => {
    expect(projectPlan(null)).toBeNull();
    const plan = projectPlan({
      id: "p-1", revision: 8, title: "代数巩固", undoAvailable: false,
      tasks: [{ id: "t-1", title: "复习", state: "mystery", kind: "mystery" }],
    });
    expect(plan?.tasks[0]).toMatchObject({ state: "unknown", kind: "unknown" });
    expect(plan?.undoAvailable).toBe(false);
    expect(() => projectPlan({ title: "无编号计划" })).toThrow("编号");
  });

  it("建议必须带基准版本，日历只保留服务端明确计数", () => {
    expect(() => projectSuggestions([{ id: "s-1", diffs: [] }])).toThrow("基准版本");
    expect(projectSuggestions([{ id: "s-1", basePlanRevision: 7, diffs: [{ date: "周二", from: "10 题", to: "8 题" }] }])[0])
      .toMatchObject({ id: "s-1", basePlanRevision: 7, diffs: [{ from: "10 题", to: "8 题" }] });
    expect(projectCalendar([{ date: "2026-09-23", todo: 0, done: 2 }, { date: "2026-09-24" }]))
      .toEqual([{ date: "2026-09-23", todo: 0, done: 2 }, { date: "2026-09-24", todo: null, done: null }]);
    expect(() => projectCalendar({ unexpected: [] })).toThrow("列表");
  });
});

describe("计划变更请求", () => {
  it("应用建议与撤销均携带 expectedRevision，不在本地增加版本", async () => {
    request.mockResolvedValue(undefined);
    await actOnSuggestion("p-1", "s-2", "apply", 7);
    await undoPlan("p-1", 8);
    expect(request).toHaveBeenNthCalledWith(1, {
      method: "POST", path: "/api/app/v1/plans/p-1/suggestions/s-2/apply", body: { expectedRevision: 7 },
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      method: "POST", path: "/api/app/v1/plans/p-1/undo", body: { expectedRevision: 8 },
    });
    await expect(actOnSuggestion("p-1", "s-2", "apply", -1)).rejects.toThrow("计划版本");
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("规则计划只发送文档约定字段", async () => {
    request.mockResolvedValue(undefined);
    await createRulePlan(" 巩固代数 ", 30);
    expect(request).toHaveBeenCalledWith({
      method: "POST", path: "/api/app/v1/plans", body: { source: "rule", dailyMinutes: 30, goal: "巩固代数" },
    });
  });
});
