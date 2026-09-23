import { describe, expect, it } from "vitest";
import { graphData, graphNode, layoutGraph, practiceAttemptId, publishedNarrative, verifiedColor } from "./graphProjection";

describe("graph evidence projection", () => {
  it("keeps missing unlock and sample fields unverified", () => {
    const node = graphNode({ id: 2, name: "因式分解", score: 92 });
    expect(node).not.toBeNull();
    expect(verifiedColor(node!)).toBe("unverified");
    expect(verifiedColor(graphNode({ id: 2, name: "因式分解", score: 92, locked: false, preparing: false, insufficientSample: true })!))
      .toBe("sample-low");
  });

  it("positions only returned nodes and retains only real edges between them", () => {
    const graph = graphData({ nodes: [{ id: 1, name: "A" }, { id: 2, name: "B" }], edges: [{ from_id: 1, to_id: 2 }, { from_id: 2, to_id: 9 }] });
    expect(graph?.edges).toEqual([{ from: 1, to: 2 }]);
    expect(layoutGraph(graph!.nodes).nodes.map((node) => node.name)).toEqual(["A", "B"]);
    expect(graphData({ nodes: [], edges: [{ from_id: 1, to_id: 2 }] })).toEqual({ nodes: [], edges: [] });
  });

  it("never renders unpublished draft cards or navigates without a real attempt", () => {
    expect(publishedNarrative({ origin: "工作稿内容", publishedVersion: 0 })).toBeNull();
    expect(publishedNarrative({ publishedVersion: 2, published_snapshot: { origin: "已发布起源" } })?.cards.origin).toBe("已发布起源");
    expect(practiceAttemptId({ id: 9001 })).toBeNull();
    expect(practiceAttemptId({ attemptId: 9001 })).toBe(9001);
  });
});
