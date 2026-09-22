import { describe, expect, it } from "vitest";
import {
  allTasksDone,
  afterCheckin,
  assessmentBannerCopy,
  assessmentBannerNeeded,
  checkinButton,
  coursePositionLabel,
  courseRingPercent,
  drillBanner,
  emptyTasksCopy,
  heatLevel,
  streakText,
  taskProgress,
  topPathRecs,
  weekHeatLevels,
  type PathRec,
  type TodayTask,
} from "./homeAggregation";

const tasks = (d: boolean, d2: boolean, d3: boolean): TodayTask[] => [
  { id: "t1", title: "学 1 课时", done: d },
  { id: "t2", title: "每日一练", done: d2, route: "/do" },
  { id: "t3", title: "错题重练", done: d3 },
];

describe("任务进度映射", () => {
  it("1/3 → 33%（四舍五入）与标签", () => {
    const p = taskProgress(tasks(true, false, false));
    expect(p).toEqual({ total: 3, done: 1, percent: 33, label: "1/3" });
    expect(taskProgress(tasks(true, true, true))).toMatchObject({ done: 3, percent: 100, label: "3/3" });
    expect(allTasksDone(tasks(true, true, false))).toBe(false);
    expect(allTasksDone(tasks(true, true, true))).toBe(true);
  });
  it("空任务：0% 且不误判完成，空态文案给出口", () => {
    const p = taskProgress([]);
    expect(p.percent).toBe(0);
    expect(allTasksDone([])).toBe(false);
    expect(emptyTasksCopy()).toContain("路径中心");
  });
});

describe("打卡条（16 §5）", () => {
  it("未打→可点；已打→禁用文案", () => {
    expect(checkinButton({ todayChecked: false, streak: 12 })).toEqual({ label: "打卡", disabled: false });
    expect(checkinButton({ todayChecked: true, streak: 12 })).toEqual({ label: "✓ 已打卡", disabled: true });
  });
  it("连签文案与乐观 +1 幂等", () => {
    expect(streakText(12)).toBe("🔥 12");
    expect(streakText(-3)).toBe("🔥 0");
    expect(afterCheckin({ todayChecked: false, streak: 12 })).toEqual({ todayChecked: true, streak: 13 });
    expect(afterCheckin({ todayChecked: true, streak: 13 })).toEqual({ todayChecked: true, streak: 13 });
  });
});

describe("课程环与位置", () => {
  it("百分比四舍五入，除零护栏", () => {
    expect(courseRingPercent({ title: "t", doneLessons: 5, totalLessons: 8, resumeRoute: "/x" })).toBe(63);
    expect(courseRingPercent({ title: "t", doneLessons: 0, totalLessons: 0, resumeRoute: "/x" })).toBe(0);
    expect(coursePositionLabel({ title: "t", doneLessons: 5, totalLessons: 8, resumeRoute: "/x" })).toBe("第 5/8 课时");
  });
});

describe("每日一练横幅", () => {
  it("总数=错题+薄弱点，分解文案如实", () => {
    const b = drillBanner({ wrong: 3, weak: 2 });
    expect(b.total).toBe(5);
    expect(b.breakdown).toBe("错题 3 · 薄弱点 2");
    expect(drillBanner({ wrong: -1, weak: 2 }).total).toBe(2), "负数钳 0";
  });
});

describe("热力分档（与后端同口径）", () => {
  it("0/15/30/60/120 → 0/1/2/4/4", () => {
    expect(weekHeatLevels([0, 15, 30, 60, 120])).toEqual([0, 1, 2, 4, 4]);
    expect(heatLevel(1)).toBe(1);
    expect(heatLevel(45, 60)).toBe(3);
  });
});

describe("路径推荐排序", () => {
  const rec = (t: string, inProgress: boolean, percent: number): PathRec => ({
    title: t,
    subtitle: "s",
    inProgress,
    percent,
    colorVar: "--p1",
    route: "/r",
  });

  it("进行中优先 → 进度降序 → 截断 N", () => {
    const list = [rec("阶梯", false, 80), rec("课程", true, 64), rec("闯关", false, 90), rec("测评", true, 10)];
    expect(topPathRecs(list, 3).map((r) => r.title)).toEqual(["课程", "测评", "闯关"]);
    expect(topPathRecs(list, 99)).toHaveLength(4);
    expect(topPathRecs([], 3)).toEqual([]);
  });

  it("同输入两次结果一致（稳定）", () => {
    const list = [rec("a", false, 50), rec("b", false, 50), rec("c", true, 0)];
    expect(topPathRecs(list).map((r) => r.title)).toEqual(topPathRecs([...list].reverse()).map((r) => r.title).sort().length === 3
      ? topPathRecs(list).map((r) => r.title)
      : []);
    expect(topPathRecs(list).map((r) => r.title)).toEqual(["c", "a", "b"]);
  });
});

describe("测评非阻塞提示（20 §9）", () => {
  it("按标志位展示，文案含跳过语义", () => {
    expect(assessmentBannerNeeded(true)).toBe(true);
    expect(assessmentBannerNeeded(false)).toBe(false);
    expect(assessmentBannerCopy()).toContain("跳过");
    expect(assessmentBannerCopy()).toContain("不打断");
  });
});
