import { describe, expect, it } from "vitest";
import {
  NARRATIVE_TABS,
  badgeFor,
  cardView,
  colorHex,
  colorLabel,
  filterNodes,
  graphColorOf,
  legendItems,
  missingCards,
  neighborSet,
  narrativeCompleteness,
  tabFromQuery,
  type NodeView,
} from "./graphUi";

const node = (over: Partial<NodeView>): NodeView => ({
  id: 1,
  name: "x",
  preparing: false,
  locked: false,
  score: null,
  insufficientSample: false,
  ...over,
});

describe("色档渲染（20 §1.1 与后端同口径）", () => {
  it("优先级链：筹备 > 锁定 > 无数据/样本不足 > 分数档", () => {
    expect(graphColorOf(node({ preparing: true, locked: true, score: 30 }))).toBe("preparing");
    expect(graphColorOf(node({ locked: true, score: 85 }))).toBe("locked");
    expect(graphColorOf(node({ score: null }))).toBe("no-data");
    expect(graphColorOf(node({ score: 100, insufficientSample: true }))).toBe("sample-low");
    expect(graphColorOf(node({ score: 80 }))).toBe("green");
    expect(graphColorOf(node({ score: 79.99 }))).toBe("yellow");
    expect(graphColorOf(node({ score: 0 }))).toBe("yellow");
  });

  it("六色 hex 与文案", () => {
    expect(colorHex("green")).toBe("#22C55E");
    expect(colorHex("yellow")).toBe("#F59E0B");
    expect(colorHex("locked")).toBe("#EF4444");
    expect(colorHex("preparing")).toBe("#8B5CF6");
    expect(colorHex("no-data")).toBe(colorHex("sample-low"));
    expect(colorLabel("yellow")).toBe("薄弱");
    expect(colorLabel("sample-low")).toBe("样本不足");
    expect(colorLabel("no-data")).toBe("尚未测量");
  });

  it("图例六项齐全", () => {
    expect(legendItems()).toHaveLength(6);
    expect(legendItems().map((l) => l.label)).toContain("内容筹备中");
  });

  it("徽标：筹备与锁定必须区分（BR-11）", () => {
    expect(badgeFor(node({ preparing: true, locked: true }))).toEqual({ text: "内容筹备中", tone: "violet" });
    expect(badgeFor(node({ locked: true }))).toEqual({ text: "前置锁定", tone: "red" });
    expect(badgeFor(node({ score: 50 }))).toEqual({ text: "", tone: "none" });
  });
});

describe("节点四卡（BR-08）", () => {
  const full = {
    origin: "古希腊测量",
    prototype: "影长角度",
    capability: "不可达测距",
    ladder: "REAL→MODEL→SYMBOL",
  };

  it("四 Tab 序与 query 合法化", () => {
    expect(NARRATIVE_TABS.map((t) => t.key)).toEqual(["origin", "prototype", "capability", "ladder"]);
    expect(tabFromQuery("ladder")).toBe("ladder");
    expect(tabFromQuery("代表题")).toBe("origin");
    expect(tabFromQuery(undefined)).toBe("origin");
  });

  it("缺失卡清单（中文名 · 空字段待补全）", () => {
    expect(missingCards(full)).toEqual([]);
    expect(missingCards(null)).toEqual(["起源", "现实原型", "能力地图", "抽象阶梯"]);
    expect(missingCards({ ...full, origin: "  " })).toEqual(["起源"]);
    expect(missingCards({ origin: "x" })).toEqual(["现实原型", "能力地图", "抽象阶梯"]);
  });

  it("单卡视图：缺失占位 / 有数据可达", () => {
    expect(cardView("origin", full)).toEqual({ text: "古希腊测量", missing: false });
    const miss = cardView("prototype", { origin: "x" });
    expect(miss.missing).toBe(true);
    expect(miss.text).toBe("待补全");
    expect(cardView("origin", null).missing).toBe(true);
  });

  it("完整度百分比", () => {
    expect(narrativeCompleteness(full)).toBe(100);
    expect(narrativeCompleteness({ origin: "x", prototype: "y" })).toBe(50);
    expect(narrativeCompleteness(null)).toBe(0);
  });
});

describe("检索与一跳邻域", () => {
  it("名称过滤：trim+忽略大小写+空查询全量", () => {
    const list = [{ name: "因式分解" }, { name: "Pythagoras" }, { name: "判别式" }];
    expect(filterNodes(list, " 因式 ").map((n) => n.name)).toEqual(["因式分解"]);
    expect(filterNodes(list, "pyth").map((n) => n.name)).toEqual(["Pythagoras"]);
    expect(filterNodes(list, "")).toHaveLength(3);
    expect(filterNodes(list, "不存在")).toHaveLength(0);
  });

  it("一跳邻域双向收集", () => {
    const edges = [
      { from: 1, to: 2 },
      { from: 3, to: 1 },
      { from: 2, to: 4 },
      { from: 3, to: 5 },
    ];
    expect([...neighborSet(edges, 1)].sort()).toEqual([1, 2, 3]);
    expect([...neighborSet(edges, 4)].sort()).toEqual([2, 4]);
    expect([...neighborSet(edges, 99)]).toEqual([99]);
    expect([...neighborSet([], 7)]).toEqual([7]);
  });
});
