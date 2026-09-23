import { describe, expect, it } from "vitest";
import {
  canPlotDailyTrend,
  csvFilename,
  delta,
  deltaNullable,
  deltaTone,
  deltaView,
  heatLevel,
  heatMonth,
  mistakeBreakdown,
  profileView,
  radarAxisTips,
  radarPoints,
  trendMaxMin,
  trendPoints,
  weakestProfile,
  weekSummary,
} from "./statsUi";

describe("真实日期趋势门槛", () => {
  const five = [1, 2, 3, 4, 5].map((day) => ({ date: `2026-09-0${day}`, minutes: day * 10 }));
  it("至少五个连续日期且每一天有明确时长", () => {
    expect(canPlotDailyTrend(five)).toBe(true);
    expect(canPlotDailyTrend(five.slice(1))).toBe(false);
    expect(canPlotDailyTrend([...five.slice(0, 4), { date: "2026-09-07", minutes: 50 }])).toBe(false);
    expect(canPlotDailyTrend([...five.slice(0, 4), { date: "2026-09-05", minutes: null }])).toBe(false);
  });
});

describe("周汇总与环比（镜像后端 StatsAggregation）", () => {
  const thisWeek = [
    { minutes: 30, questions: 10, correct: 8 },
    { minutes: 45, questions: 20, correct: 12 },
    { minutes: 0, questions: 0, correct: 0 },
  ];
  const lastWeek = [
    { minutes: 40, questions: 15, correct: 11 },
    { minutes: 35, questions: 15, correct: 9 },
  ];

  it("汇总合计与精度", () => {
    const w = weekSummary(thisWeek, lastWeek);
    expect(w.totalMinutes).toBe(75);
    expect(w.questions).toBe(30);
    expect(w.accuracy).toBeCloseTo(66.666, 2);
  });

  it("题量 0 → accuracy null（禁除零 100%）", () => {
    expect(weekSummary([{ minutes: 30, questions: 0, correct: 0 }], []).accuracy).toBeNull();
  });

  it("环比：prev=0 不可用；正负号；正确率给百分点差", () => {
    expect(delta(50, 0)).toEqual({ pct: null, available: false });
    expect(delta(150, 100).pct).toBeCloseTo(50);
    expect(delta(80, 100).pct).toBeCloseTo(-20);
    expect(deltaNullable(90, 70).pct).toBeCloseTo(20);
    expect(deltaNullable(null, 70).available).toBe(false);
    expect(deltaNullable(90, null).available).toBe(false);

    const w = weekSummary(thisWeek, lastWeek);
    expect(w.questionsDelta.pct).toBeCloseTo((30 - 30) / 30 * 100);
    expect(w.minutesDelta.pct).toBeCloseTo(0); // 75 vs 75 → 0%
    expect(deltaView(w.minutesDelta)).toBe("0%");
    expect(deltaView({ pct: -20, available: true })).toBe("−20%");
    expect(deltaView({ pct: null, available: false })).toBe("—");
    expect(deltaView({ pct: 2.5, available: true }, true)).toBe("+2.5pt");
    expect(deltaTone({ pct: -1, available: true })).toBe("down");
    expect(deltaTone({ pct: 0, available: true })).toBe("flat");
    expect(deltaTone({ pct: null, available: false })).toBe("flat");
  });
});

describe("画像展示（仅 observed 喂入的结果做展示）", () => {
  it("rate/小样本/中文排序/最弱项（按名取值，避免排序方向耦合）", () => {
    const p = profileView([
      { type: "回代检验", attempted: 3, correct: 1 },
      { type: "等价变形", attempted: 20, correct: 16 },
      { type: "构造", attempted: 0, correct: 0 },
    ]);
    expect(p).toHaveLength(3);
    expect(new Set(p.map((e) => e.type))).toEqual(new Set(["回代检验", "等价变形", "构造"]));
    const eq = p.find((e) => e.type === "等价变形")!;
    expect(eq.rate).toBeCloseTo(80);
    expect(eq.smallSample).toBe(false);
    const back = p.find((e) => e.type === "回代检验")!;
    expect(back.smallSample).toBe(true);
    expect(back.rate).toBeCloseTo(33.33, 1);
    expect(p.find((e) => e.type === "构造")!.rate).toBeNull();
    expect(weakestProfile(p)?.type).toBe("回代检验");
    expect(weakestProfile([])).toBeNull();
    expect(weakestProfile([{ type: "x", rate: null, smallSample: true }])).toBeNull();
  });
});

describe("雷达几何（纯数学）", () => {
  it("三轴顶点：从 -90° 起，100% 落在半径端", () => {
    const pts = radarPoints([{ type: "a", rate: 100, smallSample: false }], 100, 100, 50);
    expect(pts).toBe("100,50"); // -90° → 上端
    const two = radarPoints(
      [
        { type: "a", rate: 100, smallSample: false },
        { type: "b", rate: 0, smallSample: false },
      ],
      100,
      100,
      50,
    ).split(" ");
    expect(two[0]).toBe("100,50");
    expect(two[1]).toBe("100,100"); // 90° → 右侧？0% → 中心
    // 修正：0% → 中心点 (100,100)
    expect(two[1]).toBe("100,100");
  });

  it("null 率 → 中心点（图上退化为点）", () => {
    const pts = radarPoints([{ type: "a", rate: null, smallSample: true }], 10, 10, 8);
    expect(pts).toBe("10,10");
  });

  it("轴端点 count 与几何", () => {
    const tips = radarAxisTips(4, 100, 100, 50);
    expect(tips).toHaveLength(4);
    expect(tips[0]).toEqual({ x: 100, y: 50 });
    expect(tips[2]).toEqual({ x: 100, y: 150 }); // 对轴（-90+180）
    expect(radarAxisTips(0, 0, 0, 10)).toHaveLength(1);
  });
});

describe("趋势折线（min-max 归一防除零）", () => {
  it("首尾贴边、等值走中线", () => {
    const pts = trendPoints([10, 20, 30], 100, 50).split(" ");
    expect(pts[0]).toBe("0,50"); // min → 底
    expect(pts[1]).toBe("50,25");
    expect(pts[2]).toBe("100,0"); // max → 顶
    const flat = trendPoints([5, 5, 5], 100, 50).split(" ");
    expect(flat[1]).toBe("50,25"), "全等 → 中线，无 NaN";
    expect(flat.join(" ")).not.toContain("NaN");
  });

  it("空/非法输入防护", () => {
    expect(trendPoints([], 100, 50)).toBe("");
    expect(trendPoints([NaN, 1], 100, 50).split(" ")).toHaveLength(1);
    expect(trendMaxMin([])).toEqual({ max: 0, min: 0 });
    expect(trendMaxMin([3, 9, 5])).toEqual({ max: 9, min: 3 });
  });
});

describe("热力与错因", () => {
  it("热力 5 档（60 满）", () => {
    expect(heatMonth([0, 15, 30, 60, 120])).toEqual([0, 1, 2, 4, 4]);
    expect(heatLevel(45)).toBe(3);
  });

  it("错因占比：降序 + 合计约 100（四舍五入）", () => {
    const s = mistakeBreakdown([
      { reason: "缺依据", count: 46 },
      { reason: "变形错误", count: 31 },
      { reason: "漏检验", count: 23 },
    ]);
    expect(s.map((x) => x.reason)).toEqual(["缺依据", "变形错误", "漏检验"]);
    expect(s[0].percent).toBe(46);
    expect(mistakeBreakdown([])).toEqual([]);
    expect(mistakeBreakdown([{ reason: "x", count: 0 }])).toEqual([]);
  });

  it("导出文件名清洗", () => {
    expect(csvFilename("learnmath-stats", "2026-09-22")).toBe("learnmath-stats-2026-09-22.csv");
    expect(csvFilename("a b/c", "2026.09.22")).toBe("abc-20260922.csv");
    expect(csvFilename("", "")).toBe("learnmath-.csv");
  });
});
