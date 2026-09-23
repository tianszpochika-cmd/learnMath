import { beforeEach, describe, expect, it, vi } from "vitest";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./client", () => ({ getAppHttp: () => ({ request }) }));
import { projectHeatmap, projectStatsOverview, readStatsHeatmap, readStatsOverview } from "./stats";

beforeEach(() => request.mockReset());

describe("统计服务端投影", () => {
  it("题量为 0 或分母未知时正确率保持空，不写成 0% 或 100%", () => {
    expect(projectStatsOverview({ week: { questions: 0, correct: 0, accuracyPercent: 100 } }).accuracyPercent).toBeNull();
    expect(projectStatsOverview({ accuracyPercent: 80 }).accuracyPercent).toBeNull();
    expect(projectStatsOverview({ weekSummary: { questions: 8, correct: 6 } }).accuracyPercent).toBe(75);
    expect(projectStatsOverview({ weekSummary: { questions: 8, correct: 9, accuracy: 100 } }).accuracyPercent).toBeNull();
  });

  it("画像 n=0 与样本数未知时不生成分数，日期缺失不填补", () => {
    const overview = projectStatsOverview({
      profile: [
        { name: "论证", attempted: 0, correct: 0, ratePercent: 100 },
        { name: "建模", attempted: 4, correct: 3 },
        { name: "迁移", ratePercent: 90 },
        { stepType: "检验", attempted: 5, correct: 4, rate: 80 },
      ],
      daily: [{ date: "2026-09-21", minutes: 20 }, { date: "2026-09-23", minutes: 0 }],
    });
    expect(overview.profile.map((entry) => entry.ratePercent)).toEqual([null, 75, null, 80]);
    expect(overview.daily.map((day) => day.date)).toEqual(["2026-09-21", "2026-09-23"]);
    expect(projectHeatmap([{ date: "2026-09-23" }])).toEqual([{ date: "2026-09-23", minutes: null, level: null }]);
  });
});

describe("统计请求路径", () => {
  it("只调用文档约定的 overview 与 heatmap 接口", async () => {
    request.mockResolvedValue([]);
    await readStatsOverview();
    await readStatsHeatmap(2026);
    expect(request).toHaveBeenNthCalledWith(1, { method: "GET", path: "/api/app/v1/stats/overview" });
    expect(request).toHaveBeenNthCalledWith(2, { method: "GET", path: "/api/app/v1/stats/heatmap", query: { year: 2026 } });
  });
});
