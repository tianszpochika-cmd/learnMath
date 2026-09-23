import { describe, expect, it } from "vitest";
import { projectWrongbook } from "./wrongbook";

describe("错题证据投影", () => {
  it("空响应不造题、到期日或断链", () => {
    expect(projectWrongbook({}).rows).toEqual([]);
    expect(projectWrongbook({ items: [{ questionId: 12, title: "题目" }] }).rows[0]).toMatchObject({ dueDays: null, breakStatus: "none", evidence: null });
  });

  it("保留服务端四态证据与原解法步骤快照", () => {
    const page = projectWrongbook({ total: 1, items: [{ questionId: 12, title: "题目", dueDays: -1, breakStatus: "observed", breakEvidence: { solutionPathId: 77, chainVersion: 2, minimalChainSteps: [1, 3] } }] });
    expect(page.rows[0]?.evidence).toEqual({ solutionPathId: 77, chainVersion: 2, minimalChainSteps: [1, 3], warrantNodeSnapshot: [], stepDetails: [] });
    expect(page.rows[0]?.breakStatus).toBe("observed");
    expect(page.total).toBe(1);
  });

  it("保留服务端给出的依据节点和步骤正文，不把步骤编号冒充正文", () => {
    const page = projectWrongbook({ items: [{ id: 1, breakEvidence: {
      solutionPathId: 2, chainVersion: 3, warrantNodeSnapshot: [8, 9],
      minimalChainSteps: [{ id: 4, content: "由等式性质移项" }, { id: 5 }],
    } }] });
    expect(page.rows[0]?.evidence).toMatchObject({ minimalChainSteps: [4, 5], warrantNodeSnapshot: [8, 9], stepDetails: [{ id: 4, content: "由等式性质移项" }] });
  });
});
