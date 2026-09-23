import { describe, expect, it } from "vitest";
import { chainIssues, projectChain, serializeChain } from "./chainAdmin";

const fixture = { paths: [{ id: 9, title: "通法", quality: 2, working_revision: 3, steps: [
  { id: 11, seq: 1, step_type: 8, content: "选工具", warrant: "定义", warrant_nodes: [4], motive: "观察条件", off_ramp: "", edge_from: [] },
  { id: 12, seq: 2, step_type: 3, content: "变形", warrant: "恒等式", warrant_nodes: [5], motive: "化简", off_ramp: "", edge_from: [1] },
] }] };

describe("A12 chain editor projection", () => {
  it("keeps dependency identity after sequence reorder", () => {
    const document = projectChain(fixture)!;
    const path = document.paths[0]!;
    expect(path.steps[1]?.dependsOn).toEqual([11]);
    path.steps.reverse();
    path.steps[0]!.dependsOn = [];
    path.steps[1]!.dependsOn = [12];
    const serialized = serializeChain(document, [path]) as typeof fixture;
    expect(serialized.paths[0]?.steps[1]?.edge_from).toEqual([1]);
    expect(serialized.paths[0]?.steps[1]?.id).toBe(11);
  });
  it("flags orphan, missing warrant nodes and forward dependency", () => {
    const path = projectChain(fixture)!.paths[0]!;
    path.steps[1]!.dependsOn = [];
    path.steps[1]!.warrantNodes = [];
    expect(chainIssues(path.steps)).toEqual(expect.arrayContaining(["第 2 步缺少入边", "第 2 步未挂知识点"]));
    path.steps[1]!.dependsOn = [11];
    path.steps[0]!.dependsOn = [12];
    expect(chainIssues(path.steps)).toContain("第 1 步依赖自身或后继步骤");
  });
  it("rejects chain data when a dependency points to an unknown seq", () => {
    expect(projectChain({ paths: [{ id: 1, steps: [{ id: 3, seq: 1, step_type: 1, edge_from: [2] }] }] })).toBeNull();
  });
});
