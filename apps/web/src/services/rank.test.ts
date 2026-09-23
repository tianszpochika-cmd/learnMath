import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("./client", () => ({ getAppHttp: () => ({ request }) }));

import {
  challengePath,
  joinChallenge,
  projectChallengeRank,
  projectChallenges,
  projectJoinResult,
  projectRankBoard,
  readChallengeRank,
  readChallenges,
  readRank,
} from "./rank";

beforeEach(() => { request.mockReset(); });

describe("排行投影", () => {
  it("保留服务端顺序，只展示服务端明确返回的 position、分数和段位", () => {
    const board = projectRankBoard({ items: [
      { userId: 7, displayName: "后到的记录", points: 10, position: 9, rankTierName: "青铜" },
      { userId: 8, nickname: "我", points: 20, position: "1", tierName: "白银" },
    ] }, "8");
    expect(board.rows.map((row) => row.displayName)).toEqual(["后到的记录", "我"]);
    expect(board.rows.map((row) => row.position)).toEqual([9, null]);
    expect(board.mine).toEqual({ position: null, points: 20, tier: "白银" });
  });

  it("匿名标志遮盖原昵称，缺少实名字段不生成假榜单或本人成绩", () => {
    expect(projectRankBoard({ items: [
      { userId: 1, nickname: "私密昵称", anonymous: true, position: 1 },
      { userId: 2, points: 5, position: 2 },
    ] })).toEqual({
      rows: [{ key: "1", position: 1, displayName: "匿名学员", points: null, tier: "", isSelf: false }],
      mine: null,
    });
    expect(projectRankBoard(null)).toEqual({ rows: [], mine: null });
    expect(() => projectRankBoard({ unexpected: [] })).toThrow(/格式/);
  });
});

describe("挑战投影与读回", () => {
  it("仅明确 joined=true 才认为参赛；未知状态不能推断可参赛", () => {
    expect(projectChallenges({ items: [
      { id: 12, title: "函数挑战", status: "LIVE", joined: true, attemptId: 31 },
      { id: "../admin", title: "无效" },
      { id: "c2", title: "待定", status: "queued", joined: "true" },
    ] })).toEqual([
      { id: "12", title: "函数挑战", status: "live", startsAt: "", endsAt: "", joined: true, attemptId: "31", description: "", rules: null },
      { id: "c2", title: "待定", status: "unknown", startsAt: "", endsAt: "", joined: false, attemptId: "", description: "", rules: null },
    ]);
    expect(projectJoinResult({ attemptId: "../unsafe" })).toEqual({ attemptId: "" });
  });

  it("只有服务端明确返回时限、受限辅助、交卷反馈、恢复和计分规则才开放参赛前确认", () => {
    const [complete, missing] = projectChallenges({ items: [
      { id: 1, title: "完整规则", status: "live", rules: {
        durationSeconds: 2700, assistancePolicy: "restricted", feedbackMode: "on_submit",
        resumeRule: "截止前可以继续未交卷作答", scoringRule: "只计审核客观题成绩",
      } },
      { id: 2, title: "缺恢复说明", status: "live", rules: {
        durationSeconds: 2700, assistancePolicy: "restricted", feedbackMode: "on_submit", scoringRule: "按客观分",
      } },
    ] });
    expect(complete.rules).toEqual({
      timeLimit: "45 分钟", assistance: "受限：作答中不可使用 AI、公式参考或题目深钻", feedback: "交卷后反馈",
      resume: "截止前可以继续未交卷作答", scoring: "只计审核客观题成绩",
    });
    expect(missing.rules).toBeNull();
  });

  it("赛事名次不由列表顺序推算，并保留隐私遮盖", () => {
    expect(projectChallengeRank({ rows: [
      { userId: 2, nickname: "参赛者", score: 81 },
      { userId: 3, nickname: "保密", anonymous: true, score: 92, position: 1 },
    ] }, "2")).toEqual([
      { key: "2", position: null, displayName: "参赛者", score: 81, isSelf: true },
      { key: "3", position: 1, displayName: "匿名学员", score: 92, isSelf: false },
    ]);
  });
});

describe("接口边界", () => {
  it("只请求文档列出的日榜、周榜和赛事路径", async () => {
    request.mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({ attemptId: "81" });
    await readRank("daily");
    await readRank("weekly");
    await readChallenges();
    await readChallengeRank("12");
    await joinChallenge("12");
    expect(request.mock.calls.map(([arg]) => arg)).toEqual([
      { method: "GET", path: "/api/app/v1/rank/daily" },
      { method: "GET", path: "/api/app/v1/rank/weekly" },
      { method: "GET", path: "/api/app/v1/challenges" },
      { method: "GET", path: "/api/app/v1/challenges/12/rank" },
      { method: "POST", path: "/api/app/v1/challenges/12/join" },
    ]);
    expect(() => challengePath("../admin")).toThrow();
    await expect(readRank("total" as never)).rejects.toThrow(/类型/);
  });
});
