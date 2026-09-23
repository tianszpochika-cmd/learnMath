import { describe, expect, it } from "vitest";
import { projectAssessmentReport, projectAssessmentStart, projectCalendar, projectEntry, projectPath, projectPlan, projectSuggestions, validId } from "./pathPlan";
import { projectFormula, projectFormulas, projectReport, projectStats } from "./resource";

describe("移动端路径与计划投影", () => {
  it("保留服务端路径锁态和真实难度，不能从未知状态推断可进入", () => {
    const path = projectPath({ name: "阶梯", nodes: [{ id: 12, title: "一次方程", knowledgeName: "方程", difficulty: 2, status: "available" }, { id: 13, title: "晋级", status: "pending" }] }, "P4");
    expect(path.nodes[0]).toMatchObject({ id: "12", group: "方程", level: "L2", status: "available" });
    expect(path.nodes[1].status).toBe("unknown");
  });
  it("节点入口须带可识别类型与编号", () => {
    expect(projectEntry({ resource: { type: "lesson", id: 9 } })).toMatchObject({ type: "lesson", id: "9" });
    expect(() => projectEntry({ resource: { type: "paper" } })).toThrow();
    expect(() => validId("../other")).toThrow();
  });
  it("测评缺受限策略或作答编号时拒绝进入", () => {
    expect(projectAssessmentStart({ attemptId: 21, assistancePolicy: "restricted" })).toEqual({ attemptId: "21" });
    expect(() => projectAssessmentStart({ attemptId: 21 })).toThrow();
    expect(() => projectAssessmentStart({ assistancePolicy: "restricted" })).toThrow();
  });
  it("报告仅接受合法定级和维度百分比", () => {
    expect(projectAssessmentReport({ level: 3, dimensions: [{ name: "推理", ratePercent: 105 }] })).toMatchObject({ level: "3", dimensions: [{ percent: null }] });
    expect(() => projectAssessmentReport({ unrelated: true })).toThrow();
  });
  it("计划只按服务端返回状态展示，未给版本不允许应用", () => {
    const plan = projectPlan({ id: 4, tasks: [{ id: 5, title: "练习", status: "absent" }, { id: 6, status: "completed" }] });
    expect(plan?.revision).toBeNull();
    expect(plan?.tasks.map(task => task.status)).toEqual(["absent", "completed"]);
  });
  it("建议保留基准版本和逐项差异，缺差异为空而非伪造", () => {
    expect(projectSuggestions({ items: [{ id: "s1", basePlanRevision: 4, diffs: [{ date: "2026-09-24", from: "20 分钟", to: "30 分钟" }] }] })[0]).toMatchObject({ basePlanRevision: 4, diffs: [{ from: "20 分钟", to: "30 分钟" }] });
    expect(projectSuggestions([{ id: "s2", basePlanRevision: 4 }])[0].diffs).toEqual([]);
    expect(() => projectSuggestions([{ id: "s3" }])).toThrow();
  });
  it("日历拒绝不合法日期标签", () => {
    expect(projectCalendar([{ date: "2026-09-23", todo: 2 }])[0].todo).toBe(2);
    expect(() => projectCalendar([{ date: "tomorrow" }])).toThrow();
  });
});

describe("移动端报告与公式投影", () => {
  it("统计没有服务端值时不生成指标", () => {
    expect(projectStats({ summary: {}, timeTrend: [] }).metrics).toEqual([]);
    expect(() => projectStats(null)).toThrow();
  });
  it("周报没有点评时保持空白而非生成 AI 文案", () => {
    expect(projectReport({ id: 1, summary: { duration: 12 } })).toMatchObject({ commentary: "", suggestions: [] });
    expect(() => projectReport({ unrelated: true })).toThrow();
  });
  it("公式只开放服务端声明可用的小练类型", () => {
    const formula = projectFormula({ id: 7, name: "定理", conditionsSummary: "x>0", availableDrillTypes: ["condition", "unknown"] }, []);
    expect(formula.conditions).toBe("x>0");
    expect(formula.drillTypes).toEqual(["condition"]);
    expect(projectFormula({ id: 7 }, null).drillTypes).toEqual([]);
  });
  it("公式列表缺编号即报错，证明状态不本地推测", () => {
    expect(projectFormulas([{ id: 1, name: "公式" }])[0].proofStatus).toBeNull();
    expect(() => projectFormulas([{ name: "缺编号" }])).toThrow();
  });
});
