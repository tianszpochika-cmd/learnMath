import { describe, expect, it } from "vitest";
import { deepdivePaths, feedbackText } from "./deepdiveProjection";

describe("deepdive protected projection", () => {
  it("rejects an uncontracted response envelope and never exposes a prediction answer", () => {
    expect(deepdivePaths({ paths: [] })).toBeNull();
    const paths = deepdivePaths([{
      id: 7, title: "因式分解", quality: 1, view: 1, chainVersion: 3,
      steps: [{
        id: 71, seq: 1, content: "分解式子", warrant: "等价变形", motive: "观察结构",
        warrant_nodes: [9], prediction: { mode: 2, stem: "下一步依据？", options: ["A", "B"], answer: "B" },
      }],
    }]);
    expect(paths?.[0]?.steps[0]?.prediction).toEqual({ mode: 2, stem: "下一步依据？", options: ["A", "B"] });
    expect(JSON.stringify(paths)).not.toContain('"answer"');
  });

  it("requires a complete chain step before displaying it", () => {
    expect(deepdivePaths([{ id: 1, title: "解法", steps: [{ seq: 1, content: "步骤" }] }])).toBeNull();
    expect(deepdivePaths([])).toEqual([]);
    expect(feedbackText({ correct: true, answer: "B" })).toBeNull();
    expect(feedbackText("  服务端点评  ")).toBe("服务端点评");
    expect(deepdivePaths([{ id: 1, title: "解法", steps: [{ id: 2, seq: 1, content: "步骤", prediction: { mode: 4, stem: "为什么？" } }] }])?.[0]?.steps[0]?.prediction)
      .toEqual({ mode: 4, stem: "为什么？", options: [] });
  });
});
