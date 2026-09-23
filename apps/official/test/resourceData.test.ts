import { describe, expect, it } from "vitest";
import { formulaProofStatus, resourceFormulaId, resourceNeighbor, resourcePublished, resourceSlug } from "../components/ResourceData";

describe("公开资源投影", () => {
  it("接龙只采用接口给出的有效站内 slug", () => {
    const item = { prev: { slug: "sine", title: "正弦" }, neighbors: { next: { slug: "cosine", title: "余弦" } } };
    expect(resourceNeighbor(item, "prev")).toEqual({ slug: "sine", title: "正弦" });
    expect(resourceNeighbor(item, "next")).toEqual({ slug: "cosine", title: "余弦" });
    expect(resourceNeighbor({}, "next")).toBeNull();
    expect(resourceNeighbor({ next: { slug: "https://example.com" } }, "next")).toBeNull();
  });

  it("拒绝不安全资源路由与明确未发布状态", () => {
    expect(resourceSlug({ slug: "../draft" })).toBe("");
    expect(resourceFormulaId({ id: "142", slug: "pythagoras" })).toBe("142");
    expect(resourcePublished({ status: "draft" })).toBe(false);
    expect(resourcePublished({ status: "review" })).toBe(false);
    expect(resourcePublished({ status: "published" })).toBe(true);
    expect(resourcePublished({ status: 2 }, "formula")).toBe(false);
    expect(resourcePublished({ status: 3 }, "formula")).toBe(false);
    expect(resourcePublished({ status: 1 }, "formula")).toBe(true);
    expect(formulaProofStatus({ proofStatus: 3 })).toMatchObject({ label: "经验拟合 · 注意适用范围", tone: "warning" });
    expect(formulaProofStatus({ proof_status: 4 })).toMatchObject({ label: "尚未证明 · 不应当作定理", tone: "danger" });
  });
});
