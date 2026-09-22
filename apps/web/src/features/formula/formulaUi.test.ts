import { describe, expect, it } from "vitest";
import {
  FORMULA_SECTIONS,
  buildAliasIndex,
  citableAsTheorem,
  conditionBar,
  drillAvailability,
  drillTypeLabel,
  errorVariants,
  formulaCard,
  formulaCompleteness,
  formulaDeepdivePath,
  legalVariants,
  lookupAlias,
  missingSections,
  normalizeAlias,
  proofBadge,
  relLabel,
  sectionFromQuery,
  sectionMissing,
  symbolProblem,
  type FormulaDetail,
} from "./formulaUi";

const full: FormulaDetail = {
  id: 7,
  name: "勾股定理",
  aliases: ["毕达哥拉斯定理", "商高定理"],
  latex: "a^2+b^2=c^2",
  proofStatus: 1,
  origin: "古希腊面积拼图",
  symbols: [
    { symbol: "a", meaning: "直角边", rangeNote: "正实数" },
    { symbol: "θ", meaning: "夹角", rangeNote: "无量纲" },
  ],
  hasDerivation: true,
  conditions: "仅直角三角形（∠C=90°）。边长为正实数。",
  applications: "不可达测距、拱桥跨径",
  family: [{ toFormulaId: 8, relType: 1, note: "推广为余弦定理" }],
  variants: [
    { legal: true, expression: "a²+b²=c²", note: "正位" },
    { legal: false, expression: "a²+b²=c² 对任意三角形", note: "缺 −2ab·cosC" },
  ],
};

const bare: FormulaDetail = {
  id: 9,
  name: "裸公式",
  aliases: [],
  latex: "x=1",
  proofStatus: 4,
  origin: null,
  symbols: null,
  hasDerivation: false,
  conditions: null,
  applications: null,
  family: null,
  variants: null,
};

describe("七区与缺失（11 号 · BR-08）", () => {
  it("七区序与 query 合法化", () => {
    expect(FORMULA_SECTIONS.map((s) => s.key)).toEqual([
      "origin",
      "symbols",
      "derivation",
      "conditions",
      "applications",
      "family",
      "variants",
    ]);
    expect(sectionFromQuery("family")).toBe("family");
    expect(sectionFromQuery("代表题")).toBe("origin");
    expect(sectionFromQuery(undefined)).toBe("origin");
  });

  it("缺失清单：全齐 → []；裸公式 → 全缺（derivation 用布尔位）", () => {
    expect(missingSections(full)).toEqual([]);
    expect(missingSections(bare)).toEqual([
      "起源",
      "符号表",
      "推导",
      "条件边界",
      "应用",
      "家族",
      "变形",
    ]);
    expect(missingSections(null)).toHaveLength(7);
    expect(missingSections({ ...full, origin: "  ", applications: null })).toEqual(["起源", "应用"]);
  });

  it("单区缺失标记与完整度", () => {
    expect(sectionMissing("origin", full)).toBe(false);
    expect(sectionMissing("origin", bare)).toBe(true);
    expect(sectionMissing("derivation", { ...full, hasDerivation: false })).toBe(true);
    expect(formulaCompleteness(full)).toBe(100);
    expect(formulaCompleteness(bare)).toBe(0);
    expect(formulaCompleteness({ ...full, conditions: null })).toBe(86); // 6/7
  });
});

describe("符号表与条件红条", () => {
  it("符号校验（含义/定义域单位，无量纲算有值）", () => {
    expect(symbolProblem({ symbol: "a", meaning: "边", rangeNote: "正实数" })).toBeNull();
    expect(symbolProblem({ symbol: "θ", meaning: "角", rangeNote: "无量纲" })).toBeNull();
    expect(symbolProblem({ symbol: "a", meaning: " ", rangeNote: "x" })).toContain("缺符号含义");
    expect(symbolProblem({ symbol: "a", meaning: "边", rangeNote: "" })).toContain("无量纲");
    expect(symbolProblem({ symbol: " ", meaning: "边", rangeNote: "x" })).toContain("符号为空");
  });

  it("红条=首句 ≤50 + 锚点存在；空 → 无锚点", () => {
    const bar = conditionBar(full);
    expect(bar.summary).toBe("仅直角三角形（∠C=90°）。");
    expect(bar.anchor).toBe(true);
    expect(conditionBar(bare)).toEqual({ summary: "", anchor: false });
    const long = conditionBar({ ...full, conditions: "一".repeat(80) });
    expect(long.summary.length).toBe(51); // 50 + …
    expect(long.summary.endsWith("…")).toBe(true);
  });
});

describe("proof 徽标与引用（F3）", () => {
  it("四态文案与可引用性", () => {
    expect(proofBadge(1)).toBe("✓ 严格证明");
    expect(proofBadge(2)).toBe("✓ 推导确立");
    expect(proofBadge(3)).toBe("≈ 经验拟合");
    expect(proofBadge(4)).toBe("⚑ 未证实（猜想）");
    expect(proofBadge(9)).toContain("未知");
    expect(citableAsTheorem(4)).toBe(false);
    expect(citableAsTheorem(2)).toBe(true);
  });
});

describe("小练三型与变形家族", () => {
  it("有多少显示多少（条件/变形/应用各自独立开关）", () => {
    expect(drillAvailability(full)).toEqual([
      "CONDITION_JUDGE",
      "VARIANT_RECOGNIZE",
      "APPLICATION_MATCH",
    ]);
    expect(drillAvailability(bare)).toEqual([]);
    expect(drillAvailability({ ...full, conditions: null })).toEqual([
      "VARIANT_RECOGNIZE",
      "APPLICATION_MATCH",
    ]);
    expect(drillTypeLabel("CONDITION_JUDGE")).toBe("条件判断");
    expect(drillTypeLabel("VARIANT_RECOGNIZE")).toBe("变形识别");
    expect(drillTypeLabel("APPLICATION_MATCH")).toBe("应用匹配");
  });

  it("误用式分离（红笔区）与家族关系标签", () => {
    expect(errorVariants(full)).toHaveLength(1);
    expect(errorVariants(full)[0].expression).toContain("任意三角形");
    expect(legalVariants(full)).toHaveLength(1);
    expect(errorVariants(bare)).toEqual([]);
    expect(relLabel(1)).toBe("推广");
    expect(relLabel(6)).toBe("常用搭配");
    expect(relLabel(99)).toBe("关联");
  });
});

describe("别名索引与 typed 深钻（F1 / BR-08）", () => {
  const list = [
    { id: 7, name: "勾股定理", aliases: ["毕达哥拉斯定理", "商高定理"] },
    { id: 12, name: "求根公式", aliases: ["根号公式"] },
  ];

  it("归一化（小写去空格）与命中", () => {
    expect(normalizeAlias("  Pythagoras 定理 ")).toBe("pythagoras定理");
    const idx = buildAliasIndex(list);
    expect(lookupAlias(idx, "勾股定理")).toBe(7);
    expect(lookupAlias(idx, " 毕达哥拉斯定理 ")).toBe(7);
    expect(lookupAlias(idx, "商高定理")).toBe(7);
    expect(lookupAlias(idx, "求根公式")).toBe(12);
    expect(lookupAlias(idx, "不存在")).toBeNull();
    expect(lookupAlias(idx, "  ")).toBeNull();
    expect(buildAliasIndex([]).size).toBe(0);
  });

  it("首个占用优先（重名不覆盖）", () => {
    const dup = buildAliasIndex([
      { id: 1, name: "X", aliases: ["同名"] },
      { id: 2, name: "Y", aliases: ["同名"] },
    ]);
    expect(dup.get("同名")).toBe(1);
  });

  it("公式推导深钻入口与卡片投影", () => {
    expect(formulaDeepdivePath(7)).toBe("/deepdive/formula/7");
    const card = formulaCard(full);
    expect(card.badge).toBe("✓ 严格证明");
    expect(card.citable).toBe(true);
    expect(card.conditionLine).toContain("直角三角形");
    expect(card.drillCount).toBe(3);
    const bareCard = formulaCard(bare);
    expect(bareCard.citable).toBe(false);
    expect(bareCard.conditionLine).toBe("");
    expect(bareCard.drillCount).toBe(0);
  });
});
