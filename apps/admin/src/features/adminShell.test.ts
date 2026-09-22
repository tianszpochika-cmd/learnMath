import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  buildFilterModel,
  menuRouteNames,
  menuSections,
  pageRange,
  sortedRows,
  toggleSort,
  type FilterDef,
} from "../features/adminShell";

describe("AD1 菜单（17 §2 顺序）", () => {
  it("四组齐备且顺序一致；自研星标三处；子页不进菜单", () => {
    const sections = menuSections();
    expect(sections.map((s) => s.group)).toEqual(["总览", "内容生产", "路径与引擎", "运营"]);
    const flat = sections.flatMap((s) => s.items);
    expect(flat[0].name).toBe("dashboard");
    expect(flat.map((i) => i.name)).toContain("graph-edge");
    // 星标 = 编排器/链编辑/图谱边/审核（自研工具与审核队列）
    const stars = flat.filter((i) => i.star).map((i) => i.name);
    expect(stars).toContain("path-canvas");
    expect(stars).toContain("chain-editor");
    expect(stars).toContain("graph-edge");
    // 子页（编辑器）不出现
    expect(flat.map((i) => i.name)).not.toContain("lesson-edit");
    expect(flat.map((i) => i.name)).not.toContain("question-edit");
    // 路径都以 / 开头
    for (const i of flat) {
      expect(i.path.startsWith("/")).toBe(true);
    }
    const names = menuRouteNames();
    expect(new Set(names).size).toBe(names.length), "菜单路由名唯一";
  });
});

describe("AD2 列表模板辅助", () => {
  const defs: FilterDef[] = [
    { key: "kw", label: "关键词", type: "text" },
    { key: "status", label: "状态", type: "select", options: ["全部", "上架", "草稿"] },
    { key: "diff", label: "难度", type: "select", initial: "全部", options: ["全部", "L2", "L3"] },
  ];

  it("过滤模型初值：文本空、select 首项、initial 优先", () => {
    expect(buildFilterModel(defs)).toEqual({ kw: "", status: "全部", diff: "全部" });
    expect(buildFilterModel([])).toEqual({});
  });

  it("生效过滤数：与初值不同且非空才计", () => {
    const m = buildFilterModel(defs);
    expect(activeFilterCount(defs, m)).toBe(0);
    m.kw = "因式";
    expect(activeFilterCount(defs, m)).toBe(1);
    m.status = "上架";
    expect(activeFilterCount(defs, m)).toBe(2);
    m.status = "全部"; // 改回初值
    expect(activeFilterCount(defs, m)).toBe(1);
    m.kw = "";
    expect(activeFilterCount(defs, m)).toBe(0);
  });

  it("分页范围：0 数据/正常/越界钳制", () => {
    expect(pageRange(0, 1, 20)).toBe("暂无数据");
    expect(pageRange(125, 1, 20)).toBe("1-20 / 共 125");
    expect(pageRange(125, 3, 20)).toBe("41-60 / 共 125");
    expect(pageRange(125, 7, 20)).toBe("121-125 / 共 125");
    expect(pageRange(125, 99, 20)).toBe("121-125 / 共 125"), "越界页钳到最后一页区间";
    expect(pageRange(10, 0, 20)).toBe("1-10 / 共 10"), "page=0 钳 1";
  });
});

describe("排序三态与稳定排序", () => {
  it("点击循环 无→asc→desc→无", () => {
    let s = toggleSort("age", { col: null, dir: "asc" });
    expect(s).toEqual({ col: "age", dir: "asc" });
    s = toggleSort("age", s);
    expect(s).toEqual({ col: "age", dir: "desc" });
    s = toggleSort("age", s);
    expect(s).toEqual({ col: null, dir: "asc" });
    // 换列直接 asc
    expect(toggleSort("name", { col: "age", dir: "desc" })).toEqual({ col: "name", dir: "asc" });
  });

  it("数字/字符串/空值恒末尾", () => {
    const rows = [
      { id: 3, name: "丙" },
      { id: 1, name: "甲" },
      { id: null as number | null, name: "空" },
      { id: 2, name: "乙" },
    ];
    const asc = sortedRows(rows, { col: "id", dir: "asc" }, (r) => r.id);
    expect(asc.map((r) => r.id)).toEqual([1, 2, 3, null]);
    const desc = sortedRows(rows, { col: "id", dir: "desc" }, (r) => r.id);
    expect(desc.map((r) => r.id)).toEqual([3, 2, 1, null]), "null 恒末尾";
    const unsorted = sortedRows(rows, { col: null, dir: "asc" }, (r) => r.id);
    expect(unsorted[0].id).toBe(3), "无排序=原序";
    const byName = sortedRows(rows, { col: "name", dir: "asc" }, (r) => r.name);
    // zh 拼音序：丙(bing) < 甲(jia) < 空(kong) < 乙(yi)
    expect(byName.map((r) => r.name)).toEqual(["丙", "甲", "空", "乙"]);
    expect(byName[0].name).toBe("丙");
    expect(byName[byName.length - 1].name).toBe("乙");
    expect(sortedRows([], { col: "id", dir: "asc" }, () => 1)).toEqual([]);
  });
});
