import { describe, expect, it } from "vitest";
import { projectDrillTypes, projectFormulaDetail, projectFormulaPage, projectFormulaPaths, requireAttemptId } from "./formulaProjection";

const published = {
  id: 21, status: 1,
  publishedSnapshot: {
    name: "勾股定理", alias: '["商高定理","毕达哥拉斯定理"]', latex: "a^2+b^2=c^2",
    proof_status: 1, domain: 3, tier: 2, conditionSummary: "仅用于直角三角形",
    conditions: "仅用于直角三角形。边长必须为正。",
    symbols: [{ symbol: "a", meaning: "直角边", range_note: "正实数；单位：长度" }],
    variants: { legal_forms: [{ latex: "c^2=a^2+b^2", note: "移项" }], error_forms: [{ latex: "a+b=c", why: "平方遗漏" }] },
    availableDrillTypes: ["condition", "variant"],
  },
};

describe("published formula projection", () => {
  it("uses only the reviewed snapshot and preserves aliases, warnings, sections and explicit drills", () => {
    const detail = projectFormulaDetail({ ...published, name: "未审改名", conditions: "未审条件" });
    expect(detail).toMatchObject({ id: 21, name: "勾股定理", aliases: ["商高定理", "毕达哥拉斯定理"], proofStatus: 1,
      conditions: "仅用于直角三角形。边长必须为正。", drillTypes: ["CONDITION_JUDGE", "VARIANT_RECOGNIZE"] });
    expect(detail?.symbols?.[0].rangeNote).toContain("单位");
    expect(detail?.variants).toHaveLength(2);
    expect(projectFormulaDetail({ ...published, publishedSnapshot: null })).toBeNull();
    expect(projectFormulaDetail({ ...published, status: 2 })).toBeNull();
    expect(projectDrillTypes(undefined)).toEqual([]);
  });

  it("paginates on raw server results and does not fill removed draft rows with examples", () => {
    const page = projectFormulaPage({ items: [published, { ...published, id: 22, status: 3 }], total: 8 }, 1, 2);
    expect(page.items.map((item) => item.id)).toEqual([21]);
    expect(page.hasMore).toBe(true);
    expect(page.total).toBe(8);
    expect(projectFormulaPage([], 1, 12)).toMatchObject({ items: [], hasMore: false });
  });

  it("shows only published path summaries and requires a real attempt identifier", () => {
    expect(projectFormulaPaths({ paths: [
      { id: 3, title: "面积拼接证明", version: 2, status: 1 },
      { id: 4, title: "未审证明", status: 3, steps: ["secret"] },
    ] })).toEqual([{ id: 3, title: "面积拼接证明", quality: null, version: "" + 2 }]);
    expect(requireAttemptId({ attemptId: 901 })).toBe(901);
    expect(requireAttemptId({ attempt: { id: 902 } })).toBe(902);
    expect(() => requireAttemptId({ id: 9001 })).toThrow("作答编号");
  });
});
