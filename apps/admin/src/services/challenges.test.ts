import { beforeEach, describe, expect, it, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("./client", () => ({ getAdminHttp: () => ({ request }) }));
import { checkChallengePaper, challengeDraftIssues, projectChallengeRecords, projectPaperGate, readChallengeRecords, saveChallenge } from "./challenges";

beforeEach(() => request.mockReset());

describe("挑战赛服务端边界", () => {
  it("试卷关键审核字段缺失时不宣称题池可用", () => {
    expect(projectPaperGate({ purpose: "challenge", feedbackMode: "on_submit", assistancePolicy: "restricted" }).checked).toBe(false);
    expect(projectPaperGate({ purpose: "challenge", feedbackMode: "on_submit", assistancePolicy: "restricted",
      subjectiveCount: 0, unreviewedCount: 0, publicFamilyCount: 0, exposedFamilyCount: 0,
      questionCount: 10, eligibleFamilyCount: 12 }).checked).toBe(true);
    expect(projectPaperGate({ purpose: "challenge", feedbackMode: "on_submit", assistancePolicy: "restricted",
      subjectiveCount: 1, unreviewedCount: 0, publicFamilyCount: 0, exposedFamilyCount: 0,
      questionCount: 10, eligibleFamilyCount: 12 }).blockers).toContain("解答题数量为 1，需先排除");
    expect(projectPaperGate({ purpose: "challenge", feedbackMode: "on_submit", assistancePolicy: "restricted",
      subjectiveCount: 0, unreviewedCount: 0, publicFamilyCount: 0, exposedFamilyCount: 0,
      questionCount: 10, eligibleFamilyCount: 7 }).checked).toBe(false);
  });

  it("监控只显示服务端返回的名次、分数和异常标记", () => {
    expect(projectChallengeRecords({ items: [
      { id: 1, displayName: "学员甲", score: 85, durationSeconds: 820, anomalyFlag: true },
      { id: 2, nickname: "学员乙", score: 92, rankNo: 1, anomalyFlag: false },
    ] })).toEqual([
      { id: "1", position: null, displayName: "学员甲", score: 85, durationSeconds: 820, anomalyFlag: true, reviewStatus: "" },
      { id: "2", position: 1, displayName: "学员乙", score: 92, durationSeconds: null, anomalyFlag: false, reviewStatus: "" },
    ]);
  });

  it("PATCH 只保存配置，不通过状态字段假装发布；记录与试卷核对走文档路径", async () => {
    const draft = { id: "4", title: "秋季挑战", status: "draft", paperId: "8", startsAt: "2026-10-01T10:00:00", endsAt: "2026-10-02T10:00:00",
      revision: 3, feedbackMode: "on_submit", assistancePolicy: "restricted" };
    expect(challengeDraftIssues(draft)).toEqual([]);
    request.mockResolvedValueOnce({}).mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({});
    await saveChallenge(draft);
    await readChallengeRecords("4");
    await checkChallengePaper("8");
    expect(request.mock.calls.map(([arg]) => arg)).toEqual([
      { method: "PATCH", path: "/api/admin/v1/challenges/4", body: {
        title: "秋季挑战", paperId: "8", startAt: "2026-10-01T10:00:00", endAt: "2026-10-02T10:00:00", expectedRevision: 3,
      } },
      { method: "GET", path: "/api/admin/v1/challenges/4/records" },
      { method: "GET", path: "/api/admin/v1/papers/8" },
    ]);
  });
});
