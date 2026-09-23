import { describe, expect, it } from "vitest";
import { nodeErrors, projectNodes, projectPaths, validationVerdict } from "./pathAdmin";

describe("A11 path projection and gate", () => {
  it("reads server path and nodes without providing sample content", () => {
    expect(projectPaths([{ code: "P2", name: "图谱" }])?.[0]?.name).toBe("图谱");
    expect(projectNodes([{ id: 7, seq: 2, title: "待补引用", ref_type: 1, ref_id: null, unlock_rule: null }])?.[0]?.refId).toBe(0);
    expect(projectNodes({ unexpected: [] })).toBeNull();
  });
  it("blocks invalid reference and order before submitting", () => {
    const errors = nodeErrors({ title: "", refType: 0, refId: 0, seq: 0, ruleText: "bad" }, "P1");
    expect(errors).toEqual(expect.arrayContaining(["节点标题不能为空", "请输入真实资源的正整数编号", "顺序 seq 需为正整数", "解锁规则需为合法 JSON"]));
  });
  it("does not translate unknown validation JSON into approval", () => {
    expect(validationVerdict({ summary: "ok" }).passed).toBeNull();
    expect(validationVerdict({ valid: true, blockers: ["缺题"] }).passed).toBe(false);
    expect(validationVerdict({ valid: true, blockers: [] }).passed).toBe(true);
  });
});
