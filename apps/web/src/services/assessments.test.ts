import { beforeEach, describe, expect, it, vi } from "vitest";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./client", () => ({ getAppHttp: () => ({ request }) }));

import {
  projectAssessmentCatalog,
  projectAssessmentReport,
  projectAssessmentStart,
  startAssessment,
} from "./assessments";

beforeEach(() => request.mockReset());

describe("测评服务端投影", () => {
  it("可用目录仅来自返回体，没有本地样题", () => {
    expect(projectAssessmentCatalog([])).toEqual([]);
    expect(projectAssessmentCatalog({ items: [{ id: "a-1", title: "入学测评" }] }))
      .toEqual([{ id: "a-1", title: "入学测评", disabled: false }]);
    expect(() => projectAssessmentCatalog({ arbitrary: [] })).toThrow("列表");
  });

  it("开考必须得到服务端 attemptId，且不能接受非受限策略", () => {
    expect(projectAssessmentStart({ attemptId: "try-1", assistancePolicy: "restricted" }))
      .toEqual({ attemptId: "try-1" });
    expect(() => projectAssessmentStart({})).toThrow("勿重复开始");
    expect(() => projectAssessmentStart({ attemptId: "try-1", assistancePolicy: "learning" })).toThrow("受限");
  });

  it("报告缺少服务端定级时保持空态，不计算本地正确率", () => {
    expect(projectAssessmentReport({ status: "in_progress", answered: 12, wrong: 2 })).toEqual({
      level: null, status: "in_progress", dimensions: [], recommendedStart: "",
    });
    expect(projectAssessmentReport({
      status: "completed", resultLevel: 3,
      dimensions: [{ name: "代数", ratePercent: 75 }, { name: "几何" }],
      recommendedStart: "二次方程",
    })).toEqual({
      level: 3, status: "completed",
      dimensions: [{ name: "代数", ratePercent: 75 }, { name: "几何", ratePercent: null }],
      recommendedStart: "二次方程",
    });
  });
});

describe("测评开考请求", () => {
  it("使用文档路径，进入作答仅依赖返回的 attemptId", async () => {
    request.mockResolvedValue({ attemptId: "attempt-9", assistancePolicy: "restricted" });
    await expect(startAssessment("a-1")).resolves.toEqual({ attemptId: "attempt-9" });
    expect(request).toHaveBeenCalledWith({ method: "POST", path: "/api/app/v1/assessments/a-1/start" });
  });
});
