import { describe, expect, it } from "vitest";
import {
  ASSESS_CAP,
  adaptiveHint,
  applyState,
  assessProgress,
  assessmentReportView,
  calibrationCopy,
  calibrationVisible,
  checkboxAction,
  conflictBanner,
  dayCellClass,
  dimRateText,
  levelLabel,
  monthMatrix,
  suggestionCard,
  taskStateView,
  undoEnabled,
  type SuggestionUi,
} from "./planUi";

describe("测评提示与报告（16W11 · 02 §5.6 镜像）", () => {
  it("定级标签钳 1..5", () => {
    expect(levelLabel(3)).toBe("L3");
    expect(levelLabel(0)).toBe("L1");
    expect(levelLabel(9)).toBe("L5");
  });

  it("升降提示（连对/错题/档5/题量帽）", () => {
    expect(adaptiveHint({ level: 2, consecutiveCorrect: 2, wrongInLevel: 0, answered: 4 })).toBe(
      "再连对 1 题升档 L3",
    );
    expect(adaptiveHint({ level: 3, consecutiveCorrect: 0, wrongInLevel: 1, answered: 6 })).toContain(
      "再错 1 题降档 L2",
    );
    expect(adaptiveHint({ level: 3, consecutiveCorrect: 1, wrongInLevel: 1, answered: 6 })).toContain("再连对 2 题");
    expect(adaptiveHint({ level: 5, consecutiveCorrect: 0, wrongInLevel: 0, answered: 3 })).toBe(
      "已达档 5 → 答完即出定级",
    );
    expect(adaptiveHint({ level: 3, consecutiveCorrect: 0, wrongInLevel: 0, answered: ASSESS_CAP })).toBe(
      "答满 25 题 → 出定级",
    );
    expect(adaptiveHint({ level: 3, consecutiveCorrect: 0, wrongInLevel: 0, answered: 5 })).toBe("保持节奏（当前 L3）");
  });

  it("进度段（题量帽封顶）", () => {
    expect(assessProgress(4)).toEqual({ percent: 16, label: "第 5/25 题" });
    expect(assessProgress(24)).toEqual({ percent: 96, label: "第 25/25 题" });
    expect(assessProgress(30)).toEqual({ percent: 100, label: "第 25/25 题" });
  });

  it("报告：定级+终止原因+正确率 null → —", () => {
    const v = assessmentReportView({
      level: 3,
      answered: 12,
      wrongTotal: 3,
      accuracy: 75,
      reachedCeiling: false,
      hitQuestionCap: false,
    });
    expect(v.headline).toBe("定级 L3");
    expect(v.reasons).toEqual(["按服务端终止规则结算"]);
    expect(v.accuracyText).toBe("75%");

    const ceiling = assessmentReportView({
      level: 5,
      answered: 15,
      wrongTotal: 2,
      accuracy: null,
      reachedCeiling: true,
      hitQuestionCap: true,
    });
    expect(ceiling.reasons).toEqual(["达到档位上限（档 5）", "答满 25 题"]);
    expect(ceiling.accuracyText).toBe("—");

    expect(
      assessmentReportView({ level: 2, answered: 0, wrongTotal: 0, accuracy: null, reachedCeiling: false, hitQuestionCap: false })
        .reasons,
    ).toEqual([]);
    expect(dimRateText(null)).toBe("—");
    expect(dimRateText(83.4)).toBe("83%");
  });
});

describe("月历矩阵（16W12）", () => {
  it("2026-09：周一起始、7 列、覆盖 1..30、恒 6 行", () => {
    const weeks = monthMatrix(2026, 9);
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const inMonth = weeks.flat().filter((c) => c.inMonth);
    expect(inMonth.map((c) => c.day)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    // 2026-09-01 是周二 → 周一起始前导 1 个空位
    expect(weeks[0].filter((c) => c.day === null)).toHaveLength(1);
    expect(weeks[0][1].day).toBe(1);
  });

  it("闰月/长度正确（2024-02=29 天；2026-02=28 天）", () => {
    const feb24 = monthMatrix(2024, 2).flat().filter((c) => c.inMonth);
    expect(feb24).toHaveLength(29);
    const feb26 = monthMatrix(2026, 2).flat().filter((c) => c.inMonth);
    expect(feb26).toHaveLength(28);
  });

  it("日格样式三态", () => {
    expect(dayCellClass(undefined)).toBe("");
    expect(dayCellClass({ todo: 0, done: 0 })).toBe("");
    expect(dayCellClass({ todo: 2, done: 1 })).toBe("has");
    expect(dayCellClass({ todo: 0, done: 3 })).toBe("alldone");
  });
});

describe("计划任务行（BR-10 五态）", () => {
  it("五态标签与样式", () => {
    expect(taskStateView({ id: 1, title: "t", kind: "objective", state: "completed" })).toEqual({
      icon: "✓",
      label: "已完成",
      cls: "done",
    });
    expect(taskStateView({ id: 1, title: "t", kind: "objective", state: "skipped" }).label).toContain("不计缺席");
    expect(taskStateView({ id: 1, title: "t", kind: "objective", state: "rescheduled" }).label).toContain("不计缺席");
    expect(taskStateView({ id: 1, title: "t", kind: "objective", state: "absent" }).cls).toBe("absent");
    expect(taskStateView({ id: 1, title: "t", kind: "objective", state: "todo" }).label).toContain("服务端事件");
    expect(taskStateView({ id: 1, title: "t", kind: "reading", state: "todo" }).label).toContain("自报");
  });

  it("复选框行为：客观=发起校验；阅读=自报；非 todo=none", () => {
    expect(checkboxAction({ id: 1, title: "t", kind: "objective", state: "todo" })).toBe("request-confirm");
    expect(checkboxAction({ id: 1, title: "t", kind: "reading", state: "todo" })).toBe("self-report");
    expect(checkboxAction({ id: 1, title: "t", kind: "objective", state: "completed" })).toBe("none");
  });
});

describe("建议 diff（BR-10 · 3011 · undo）", () => {
  const s = (over: Partial<SuggestionUi> = {}): SuggestionUi => ({
    kind: "RETEST",
    basePlanRevision: 7,
    diffs: [
      {
        dateLabel: "周三",
        target: "判别式课时",
        from: "按原计划推进",
        to: "插入复测/补先修",
        reason: "7 天正确率 50% < 60%",
      },
    ],
    windowKey: "kw-1",
    ...over,
  });

  it("卡片：标题/色调/diff 逐条渲染", () => {
    const card = suggestionCard(s());
    expect(card.title).toContain("复测");
    expect(card.tone).toBe("amber");
    expect(card.diffLines[0]).toBe(
      "周三 判别式课时：按原计划推进 → 插入复测/补先修（7 天正确率 50% < 60%）",
    );
    expect(suggestionCard(s({ kind: "ACCELERATE" })).tone).toBe("green");
    expect(suggestionCard(s({ kind: "REDUCE" })).title).toContain("减少时长");
    expect(suggestionCard(s({ kind: "EVIDENCE_INSUFFICIENT" })).tone).toBe("grey");
    expect(suggestionCard(s({ kind: "CALIBRATION" })).tone).toBe("blue");
  });

  it("applyState 四态矩阵", () => {
    expect(applyState(s(), 7, new Set())).toBe("ready");
    expect(applyState(s(), 9, new Set())).toBe("conflict-3011");
    expect(applyState(s(), 7, new Set(["kw-1"]))).toBe("dismissed");
    expect(applyState(s({ kind: "NONE" }), 7, new Set())).toBe("no-op");
    expect(applyState(s({ kind: "EVIDENCE_INSUFFICIENT" }), 7, new Set())).toBe("no-op");
  });

  it("3011 横幅带新旧版本与差异指引", () => {
    const banner = conflictBanner(s(), 9);
    expect(banner).toContain("v7");
    expect(banner).toContain("v9");
    expect(banner).toContain("差异");
  });

  it("undo 双条件 / 校准可见性", () => {
    expect(undoEnabled(7, 7, false)).toBe(true);
    expect(undoEnabled(7, 8, false)).toBe(false), "版本已变";
    expect(undoEnabled(7, 7, true)).toBe(false), "有新证据";
    expect(calibrationVisible(true, 10)).toBe(true);
    expect(calibrationVisible(true, 9)).toBe(false);
    expect(calibrationVisible(false, 30)).toBe(false);
    expect(calibrationCopy()).toContain("不自动覆盖");
  });
});
