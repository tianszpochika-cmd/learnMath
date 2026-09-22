import { describe, expect, it } from "vitest";
import {
  aiUnavailableFallback,
  breakBadge,
  chainPreview,
  countsInProfile,
  deterministic,
  dueText,
  filterWrong,
  profileNote,
  remediationPlan,
  showBreakDetail,
  snapshotDisplayable,
  versionNote,
  type WrongItem,
} from "./wrongbookUi";

describe("断链四状态徽标（BR-05 前端镜像）", () => {
  it("四状态文案与色调 + none", () => {
    expect(breakBadge("unlocated")).toEqual({ text: "尚未定位", tone: "grey" });
    expect(breakBadge("suggested")).toEqual({ text: "可能卡在这里，待确认", tone: "amber" });
    expect(breakBadge("observed")).toEqual({ text: "预测答错 · 已定位", tone: "red" });
    expect(breakBadge("self_reported")).toEqual({ text: "我的自报", tone: "blue" });
    expect(breakBadge("none")).toEqual({ text: "", tone: "none" });
  });

  it("确定断言与画像计入口径：仅 observed", () => {
    expect(deterministic("observed")).toBe(true);
    expect(deterministic("self_reported")).toBe(true);
    expect(deterministic("suggested")).toBe(false);
    expect(deterministic("unlocated")).toBe(false);

    expect(countsInProfile("observed")).toBe(true);
    expect(countsInProfile("suggested")).toBe(false), "AI 建议不计推理分数";
    expect(countsInProfile("self_reported")).toBe(false);
    expect(profileNote("observed")).toBe("计入推理画像");
    expect(profileNote("suggested")).toBe("不计入推理画像");
  });
});

describe("证据快照回放（链重排/下架仍显示原解法）", () => {
  it("可回放判定与步骤串", () => {
    const e = { solutionPathId: 10, chainVersion: 2, minimalChainSteps: [1, 2, 3] };
    expect(snapshotDisplayable(e)).toBe(true);
    expect(chainPreview(e.minimalChainSteps)).toBe("S1 → S2 → S3");
    expect(snapshotDisplayable({ solutionPathId: null, chainVersion: null, minimalChainSteps: [] })).toBe(false);
    expect(snapshotDisplayable(null)).toBe(false);
    expect(chainPreview([])).toBe("");
  });

  it("跨版本：给提示；同版本/无版本 → null", () => {
    const e = { solutionPathId: 10, chainVersion: 2, minimalChainSteps: [1] };
    const note = versionNote(e, 3);
    expect(note).toContain("v2 → v3");
    expect(note).toContain("不跳转新版本");
    expect(versionNote(e, 2)).toBeNull();
    expect(versionNote({ solutionPathId: 1, chainVersion: null, minimalChainSteps: [1] }, 5)).toBeNull();
    expect(versionNote(null, 5)).toBeNull();
  });
});

describe("补救如实数量（期望上限 2 · 禁空列表报 2）", () => {
  it("≥2 → 开始 2 题", () => {
    expect(remediationPlan(5, true)).toEqual({ count: 2, startButton: true, message: "开始 2 题" });
  });
  it("1 → 如实 1 题且文案带数量", () => {
    const p = remediationPlan(1, true);
    expect(p).toEqual({ count: 1, startButton: true, message: "开始 1 题（同知识点仅 1 题）" });
    expect(p.message).not.toContain("开始 2 题");
  });
  it("0 + 有内容 → 内容+稍后复习，无开始按钮", () => {
    const p = remediationPlan(0, true);
    expect(p.startButton).toBe(false);
    expect(p.count).toBe(0);
    expect(p.message).toContain("概念/公式");
  });
  it("0 + 无内容 → 稍后复习；负数钳 0", () => {
    expect(remediationPlan(0, false).message).toContain("稍后复习");
    expect(remediationPlan(-3, false).count).toBe(0);
  });
});

describe("AI 降级（不等待 AI）", () => {
  it("四动作 + 无需等待语义", () => {
    const f = aiUnavailableFallback();
    expect(f.actions).toHaveLength(4);
    expect(f.actions).toContain("选错因标签");
    expect(f.actions).toContain("自报断点");
    expect(f.headline).toContain("尚未定位");
    expect(f.headline).toContain("无需等待");
  });
});

describe("列表筛选与到期", () => {
  const list: WrongItem[] = [
    { id: 1, title: "a", node: "因式分解", wrongCount: 2, dueDays: 0, mastered: false, breakStatus: "observed" },
    { id: 2, title: "b", node: "判别式", wrongCount: 1, dueDays: 3, mastered: false, breakStatus: "none" },
    { id: 3, title: "c", node: "韦达", wrongCount: 5, dueDays: -2, mastered: true, breakStatus: "self_reported" },
    { id: 4, title: "d", node: "十字相乘", wrongCount: 1, dueDays: 1, mastered: false, breakStatus: "suggested" },
  ];

  it("四 Tab 过滤语义", () => {
    expect(filterWrong(list, "all")).toHaveLength(4);
    // 到期=dueDays≤0 且未掌握（id3 已掌握 → 不进到期复习队列）
    expect(filterWrong(list, "due").map((i) => i.id)).toEqual([1]);
    expect(filterWrong(list, "unmastered").map((i) => i.id)).toEqual([1, 2, 4]);
    expect(filterWrong(list, "has-break").map((i) => i.id)).toEqual([1, 3, 4]);
    expect(filterWrong([], "all")).toEqual([]);
    expect(filterWrong(null as never, "all")).toEqual([]);
  });

  it("到期文案", () => {
    expect(dueText(-2)).toBe("已逾期 2 天");
    expect(dueText(0)).toBe("到期今天");
    expect(dueText(3)).toBe("3 天后到期");
  });

  it("断链详情显隐", () => {
    expect(showBreakDetail("observed")).toBe(true);
    expect(showBreakDetail("suggested")).toBe(true);
    expect(showBreakDetail("none")).toBe(false);
  });
});
