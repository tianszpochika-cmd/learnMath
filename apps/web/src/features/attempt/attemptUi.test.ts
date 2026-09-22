import { describe, expect, it } from "vitest";
import {
  countdownTone,
  cellClass,
  draftKey,
  draftRelation,
  formatCountdown,
  insertMath,
  keyAction,
  objectiveView,
  remainingMs,
  safeParseDraft,
  selfAssessProgress,
  selfAssessNote,
  selfValueLabel,
  selfValueRef,
  sheetCounts,
  sheetProgressLabel,
  submitConfirmText,
  type SheetItem,
} from "./attemptUi";

const items = (spec: Array<[number, boolean, boolean]>): SheetItem[] =>
  spec.map(([seq, answered, flagged]) => ({ seq, answered, flagged }));

describe("答题卡（WD4 右栏）", () => {
  it("单元格样式优先级：cur > done > flag > todo", () => {
    const list = items([
      [1, true, false],
      [2, false, true],
      [3, false, false],
    ]);
    expect(cellClass(list[0], 1)).toBe("cur");
    expect(cellClass(list[0], 9)).toBe("done");
    expect(cellClass(list[1], 9)).toBe("flag");
    expect(cellClass(list[2], 9)).toBe("todo");
  });
  it("计数与进度文案", () => {
    const c = sheetCounts(items([[1, true, true], [2, false, true], [3, false, false], [4, true, false]]));
    expect(c).toEqual({ total: 4, answered: 2, flagged: 2 });
    expect(sheetProgressLabel(c)).toBe("进度 2 / 4");
    expect(sheetCounts([])).toEqual({ total: 0, answered: 0, flagged: 0 });
  });
});

describe("数学工具条光标插入", () => {
  it("末尾追加（无光标参数）", () => {
    expect(insertMath("x", "²")).toEqual({ value: "x²", cursor: 2 });
  });
  it("光标处插入并推进光标", () => {
    expect(insertMath("ab", "π", 1)).toEqual({ value: "aπb", cursor: 2 });
    expect(insertMath("", "√()", 0)).toEqual({ value: "√()", cursor: 3 });
  });
  it("非法光标钳到末尾", () => {
    expect(insertMath("abc", "±", 99)).toEqual({ value: "abc±", cursor: 4 });
    expect(insertMath("abc", "±", -5)).toEqual({ value: "abc±", cursor: 4 });
  });
});

describe("倒计时校准（BR-07 服务端 deadline）", () => {
  it("格式化：分秒/时分秒/到期", () => {
    expect(formatCountdown(0)).toBe("已到期");
    expect(formatCountdown(-1)).toBe("已到期");
    expect(formatCountdown(309_000)).toBe("05:09");
    expect(formatCountdown(59_000)).toBe("00:59");
    expect(formatCountdown(3_723_000)).toBe("1:02:03");
  });
  it("预警分档（等于即过期）", () => {
    expect(countdownTone(0)).toBe("expired");
    expect(countdownTone(-5)).toBe("expired");
    expect(countdownTone(59_999)).toBe("danger");
    expect(countdownTone(60_000)).toBe("warn");
    expect(countdownTone(299_999)).toBe("warn");
    expect(countdownTone(300_000)).toBe("ok");
  });
  it("剩余=deadline−serverNow（客户端只渲染差值）", () => {
    expect(remainingMs(1_000, 400)).toBe(600);
    expect(remainingMs(1_000, 1_000)).toBe(0);
    expect(remainingMs(1_000, 1_500)).toBeLessThan(0);
  });
});

describe("快捷键（16 §5：输入框内不劫持）", () => {
  it("作答键位映射", () => {
    expect(keyAction({ key: "1" })).toEqual({ type: "select", index: 0 });
    expect(keyAction({ key: "4" })).toEqual({ type: "select", index: 3 });
    expect(keyAction({ key: "Enter" })).toEqual({ type: "submit" });
    expect(keyAction({ key: "ArrowLeft" })).toEqual({ type: "prev" });
    expect(keyAction({ key: "ArrowRight" })).toEqual({ type: "next" });
    expect(keyAction({ key: "f" })).toEqual({ type: "flag" });
    expect(keyAction({ key: "F" })).toEqual({ type: "flag" });
    expect(keyAction({ key: "Escape" })).toEqual({ type: "close" });
    expect(keyAction({ key: "k", ctrlKey: true })).toEqual({ type: "search" });
    expect(keyAction({ key: "K", metaKey: true })).toEqual({ type: "search" });
  });
  it("输入态一律不劫持（含 Ctrl+K）", () => {
    expect(keyAction({ key: "Enter", target: { tagName: "INPUT" } })).toBeNull();
    expect(keyAction({ key: "2", target: { tagName: "TEXTAREA" } })).toBeNull();
    expect(keyAction({ key: "k", ctrlKey: true, target: { tagName: "INPUT" } })).toBeNull();
    expect(keyAction({ key: "f", target: { tagName: "DIV", isContentEditable: true } })).toBeNull();
  });
  it("非作答页不启用；未知键 null", () => {
    expect(keyAction({ key: "Enter" }, false)).toBeNull();
    expect(keyAction({ key: "q" })).toBeNull();
    expect(keyAction({ key: "5" })).toBeNull();
  });
});

describe("草稿本地化（BR-07 隔离与冲突展示）", () => {
  it("键按用户+作答隔离", () => {
    expect(draftKey(1001, 900)).toBe("lm.draft:1001:900");
    expect(draftKey(1001, 900)).not.toBe(draftKey(1002, 900));
    expect(draftKey(1001, 900)).not.toBe(draftKey(1001, 901));
  });
  it("脏数据安全解析", () => {
    expect(safeParseDraft(null)).toBeNull();
    expect(safeParseDraft("not json")).toBeNull();
    expect(safeParseDraft('{"revision":"x"}')).toBeNull();
    expect(safeParseDraft('{"revision":2,"updatedAt":1,"payload":{}}')).toEqual({
      revision: 2,
      updatedAt: 1,
      payload: {},
    });
  });
  it("revision 关系 → 两份答案确认（不静默覆盖）", () => {
    expect(draftRelation(3, 3)).toBe("equal");
    expect(draftRelation(3, 5)).toBe("server-newer");
    expect(draftRelation(6, 5)).toBe("local-newer");
  });
});

describe("交卷确认文案（如实列未答）", () => {
  it("全答", () => {
    expect(submitConfirmText(items([[1, true, false], [2, true, false]]))).toBe(
      "全部作答完成（2/2），确认交卷？",
    );
  });
  it("未答列题号，超 6 个截断加省略", () => {
    const t = submitConfirmText(items([[1, true, false], [2, false, false], [3, false, false]]));
    expect(t).toBe("已答 1/3，未答 2 题（2、3），确认交卷？");
    const many = submitConfirmText(
      Array.from({ length: 10 }, (_, i) => ({ seq: i + 1, answered: false, flagged: false })),
    );
    expect(many).toContain("（1、2、3、4、5、6…）");
    expect(many).toContain("未答 10 题");
  });
});

describe("报告客观-自评拆分（20 §4）", () => {
  it("纯解答卷 → 本卷无客观成绩（禁 0/100）", () => {
    expect(objectiveView(0, 0, null)).toEqual({ main: "本卷无客观成绩", sub: null, muted: true });
    expect(objectiveView(0, 0, 0)).toEqual({ main: "本卷无客观成绩", sub: null, muted: true });
  });
  it("有客观题 → 百分比 + 明细", () => {
    const v = objectiveView(8, 10, 80);
    expect(v).toEqual({ main: "80%", sub: "8/10", muted: false });
    expect(objectiveView(7, 9, 77.777).main).toBe("77.78%");
  });

  it("自评五值标签与参考分", () => {
    expect(selfValueLabel("unrated")).toBe("未评");
    expect(selfValueLabel("cannot")).toBe("不会");
    expect(selfValueLabel("partial")).toBe("半会");
    expect(selfValueLabel("can")).toBe("会");
    expect(selfValueLabel("skipped")).toBe("暂不评价");
    expect(selfValueRef("cannot")).toBe(0);
    expect(selfValueRef("partial")).toBe(0.5);
    expect(selfValueRef("can")).toBe(1);
    expect(selfValueRef("unrated")).toBeNull();
    expect(selfValueRef("skipped")).toBeNull();
  });

  it("自评进度：skipped 算已选、unrated 可继续", () => {
    expect(selfAssessProgress(["can", "partial", "unrated"])).toEqual({
      answered: 2,
      total: 3,
      label: "自评 2/3",
      canResume: true,
    });
    expect(selfAssessProgress(["can", "skipped"]).canResume).toBe(false);
    expect(selfAssessProgress([]).canResume).toBe(false);
    expect(selfAssessNote()).toContain("BR-04");
  });
});
