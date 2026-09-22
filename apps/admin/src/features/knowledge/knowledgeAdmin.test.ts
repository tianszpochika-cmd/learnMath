import { describe, expect, it } from "vitest";
import {
  findExistingCycle,
  parseKnowledgeCsv,
  splitCsvLine,
  toggleCollapsed,
  treeRows,
  validateEdgeAdd,
  type TreeNodeAdmin,
} from "./knowledgeAdmin";

describe("CSV 导入预检（镜像后端逐行报错）", () => {
  it("RFC4180：引号包裹与 \"\" 转义", () => {
    expect(splitCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
    expect(splitCsvLine('"说""明",x')).toEqual(['说"明', "x"]);
    expect(splitCsvLine("plain,row")).toEqual(["plain", "row"]);
  });

  it("表头必须含 path,name（快速失败）", () => {
    const r = parseKnowledgeCsv("foo,bar\n1,2");
    expect(r.ok).toBe(false);
    expect(r.errors[0].reason).toContain("表头");
    expect(r.drafts).toHaveLength(0);
  });

  it("好行入库 + 坏行行号（空名/难度越界/非整数/空段/重复）", () => {
    const csv = [
      "path,name,difficulty,description",
      "代数,方程,3,一到三次", // 好
      "代数,,3,", // 空名 line3
      "代数/方程,一元一次,2,", // 好 line4
      "代数,不等式,9,", // 越界 line5
      "代数,函数,abc,", // 非整数 line6
      "代数//多项式,坏段,3,", // 空段 line7
      "代数/方程,一元一次,2,", // 重复 line8
      ',顶层根,3,带引号名",', // 好（path 空=根）line9 —— 末列含逗号需引号，此处用 plain 处理
    ].join("\n");
    const r = parseKnowledgeCsv(csv);
    expect(r.ok).toBe(false);
    // 第三好行：name=顶层根（path 空=根；desc 列引号未闭合按字面收尾，不参与断言）
    expect(r.drafts.map((d) => d.name)).toEqual(["方程", "一元一次", "顶层根"]);
    const lines = r.errors.map((e) => e.line);
    expect(lines).toContain(3);
    expect(lines).toContain(5);
    expect(lines).toContain(6);
    expect(lines).toContain(7);
    expect(lines).toContain(8);
    expect(r.errors.find((e) => e.line === 5)!.reason).toContain("1-5");
    expect(r.errors.find((e) => e.line === 7)!.reason).toContain("空段");
    expect(r.errors.find((e) => e.line === 8)!.reason).toContain("重复");
  });

  it("空内容/无数据行", () => {
    expect(parseKnowledgeCsv("").errors[0].reason).toBe("内容为空");
    expect(parseKnowledgeCsv("path,name\n").errors[0].reason).toBe("无数据行");
  });
});

describe("树形展示", () => {
  const nodes: TreeNodeAdmin[] = [
    { id: 1, parentId: null, title: "代数", status: "published", childrenCount: 2 },
    { id: 11, parentId: 1, title: "方程", status: "published", childrenCount: 0 },
    { id: 12, parentId: 1, title: "不等式", status: "draft", childrenCount: 0 },
    { id: 2, parentId: null, title: "几何", status: "offline", childrenCount: 1 },
    { id: 21, parentId: 2, title: "三角", status: "published", childrenCount: 0 },
  ];

  it("深度标注与展开折叠", () => {
    const all = treeRows(nodes, new Set(), "");
    expect(all.map((r) => `${r.depth}:${r.id}`)).toEqual(["0:1", "1:11", "1:12", "0:2", "1:21"]);
    const collapsed = treeRows(nodes, new Set([1]), "");
    expect(collapsed.map((r) => r.id)).toEqual([1, 2, 21]);
    const t = toggleCollapsed(new Set([1]), 1);
    expect(t.has(1)).toBe(false);
    expect(toggleCollapsed(t, 1).has(1)).toBe(true);
  });

  it("query 过滤：命中父保留子，命中子保留父链", () => {
    const hitParent = treeRows(nodes, new Set(), "代数");
    expect(hitParent.map((r) => r.id)).toEqual([1, 11, 12]);
    const hitChild = treeRows(nodes, new Set([1]), "三角");
    expect(hitChild.map((r) => r.id)).toEqual([2, 21]), "命中子 → 折叠父也显示父链";
    expect(treeRows(nodes, new Set(), "不存在")).toEqual([]);
  });

  it("状态徽标三色", () => {
    const rows = treeRows(nodes, new Set(), "");
    const pub = rows.find((r) => r.id === 11)!;
    expect(pub.statusLabel).toBe("上架");
    expect(pub.statusClass).toBe("gr");
    const draft = rows.find((r) => r.id === 12)!;
    expect(draft.statusLabel).toBe("草稿");
    expect(draft.statusClass).toBe("warn");
    const off = rows.find((r) => r.id === 2)!;
    expect(off.statusLabel).toBe("下架");
    expect(off.statusClass).toBe("grey");
    expect(rows.find((r) => r.id === 1)!.expandable).toBe(true);
    expect(pub.expandable).toBe(false);
  });
});

describe("AD5 无环预检（镜像后端 GraphCycleDetector）", () => {
  const edges = [
    { from: 0, to: 2 },
    { from: 2, to: 4 },
  ];

  it("无环加边 OK", () => {
    const r = validateEdgeAdd(edges, 4, 6);
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("ok");
  });

  it("回边成环：环序 [to,…,from,to] 与后端一致", () => {
    const r = validateEdgeAdd(edges, 4, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("cycle");
    expect(r.cyclePath).toEqual([0, 2, 4, 0]);
    expect(r.message).toContain("3310");
  });

  it("自环与重复边", () => {
    const self = validateEdgeAdd(edges, 7, 7);
    expect(self.reason).toBe("cycle");
    expect(self.cyclePath).toEqual([7, 7]);
    const dup = validateEdgeAdd(edges, 0, 2);
    expect(dup.reason).toBe("duplicate");
    expect(dup.cyclePath).toEqual([]);
  });

  it("长链回边（最短回路）与菱形安全", () => {
    const chain = [
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
    ];
    const r = validateEdgeAdd(chain, 4, 1);
    expect(r.reason).toBe("cycle");
    expect(r.cyclePath).toEqual([1, 2, 3, 4, 1]);
    const diamond = [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
    ];
    expect(validateEdgeAdd(diamond, 2, 3).reason).toBe("duplicate");
    expect(validateEdgeAdd(diamond, 3, 0).reason).toBe("cycle");
    expect(validateEdgeAdd([{ from: 0, to: 1 }, { from: 0, to: 2 }, { from: 1, to: 3 }], 2, 3).ok).toBe(true);
  });

  it("全图体检：DAG 无环 / 环回显稳定", () => {
    expect(findExistingCycle([{ from: 1, to: 2 }, { from: 2, to: 3 }])).toBeNull();
    const c = findExistingCycle([
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 1 },
    ]);
    expect(c).not.toBeNull();
    expect(c![0]).toBe(1);
    expect(c![0]).toBe(c![c!.length - 1]);
    expect(findExistingCycle([])).toBeNull();
  });
});
