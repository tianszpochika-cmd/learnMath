import { describe, expect, it } from "vitest";
import { Q_TYPES, emptyPaperDraft, emptyQuestionDraft, qTypeLabel, validateAssessmentDraft, validateDailySchedule, validatePaperDraft, validatePaperQuestions, validateQuestionDraft } from "./questionAdmin";

const ready = () => ({ ...emptyQuestionDraft(), stem: "<p>以下哪项成立？</p>", nodeIds: [12],
  options: [{ key: "A", text: "甲" }, { key: "B", text: "乙" }], answer: "A" });

describe("five question types and judge configuration", () => {
  it("uses the five backend types and rejects an empty or unlinked question", () => {
    expect(Q_TYPES.map((item) => item.key)).toEqual(["SINGLE", "MULTI", "JUDGE", "FILL", "ESSAY"]);
    expect(qTypeLabel(5)).toBe("解答");
    expect(validateQuestionDraft(emptyQuestionDraft())).toEqual(expect.arrayContaining(["题干不能为空", "至少关联一个有效知识点", "标准答案不能为空"]));
    expect(validateQuestionDraft(ready())).toEqual([]);
  });

  it("validates answer keys and multi selection without locally grading a learner", () => {
    expect(validateQuestionDraft({ ...ready(), answer: "C" })).toContain("答案键必须对应非空选项");
    expect(validateQuestionDraft({ ...ready(), type: "MULTI", answer: "A,B" })).toEqual([]);
    expect(validateQuestionDraft({ ...ready(), type: "MULTI", answer: "A" })).toContain("多选至少需要两个正确项");
    expect(validateQuestionDraft({ ...ready(), type: "JUDGE", answer: "A,B" })).toContain("单选或判断只能有一个正确项");
    expect(validateQuestionDraft({ ...ready(), options: [{ key: "A", text: "甲" }, { key: "A", text: "乙" }] })).toContain("选项键须为不重复的 A–Z 字母");
  });

  it("checks fill alternatives, essay presence and type-bound tolerance", () => {
    const fill = { ...ready(), type: "FILL" as const, answer: "2|二||3", options: [] };
    expect(validateQuestionDraft(fill)).toEqual([]);
    expect(validateQuestionDraft({ ...fill, answer: "2||" })).toContain("填空答案须按空位填写；多个可接受答案用 |，多空用 || 分隔");
    expect(validateQuestionDraft({ ...fill, judgeConfig: { ...fill.judgeConfig, tolerance: 0.05 } })).toEqual([]);
    expect(validateQuestionDraft({ ...ready(), judgeConfig: { ...ready().judgeConfig, tolerance: 0.05 } })).toContain("容差和按空计分只适用于填空题");
    expect(validateQuestionDraft({ ...fill, judgeConfig: { ...fill.judgeConfig, tolerance: 0.2 } })).toContain("判分容差必须在 0–0.1 之间");
    expect(validateQuestionDraft({ ...ready(), type: "ESSAY", answer: "推理要点", options: [] })).toEqual([]);
  });
});

describe("paper, assessment and daily release gates", () => {
  it("requires real rule inputs and a restricted policy for competitive paper purposes", () => {
    const paper = emptyPaperDraft();
    expect(validatePaperDraft(paper)).toEqual(expect.arrayContaining(["试卷名称不能为空", "规则抽题至少选择一个知识点"]));
    expect(validatePaperDraft({ ...paper, title: "基础练习", rule: { ...paper.rule, nodeIds: [12] } })).toEqual([]);
    const competitive = { ...paper, title: "测评卷", purpose: "assessment" as const,
      rule: { ...paper.rule, nodeIds: [12], questionTypes: ["ESSAY" as const] } };
    expect(validatePaperDraft(competitive)).toEqual(expect.arrayContaining([
      "测评/晋级/Boss/挑战须交卷后反馈且限制辅助", "测评/晋级/Boss/挑战不能包含解答题",
    ]));
    expect(validatePaperDraft({ ...competitive, feedbackMode: "on_submit", assistancePolicy: "restricted", rule: { ...competitive.rule, questionTypes: ["SINGLE"] } })).toEqual([]);
    expect(validatePaperQuestions([{ questionId: 1, score: 5, type: "SINGLE", status: 1 }, { questionId: 1, score: 2, type: "ESSAY", status: 3 }], "assessment")).toEqual(expect.arrayContaining([
      "题目不能重复", "测评/晋级/Boss/挑战不能包含解答题", "限制用途试卷不能包含已知非可用题目",
    ]));
    expect(validatePaperQuestions([{ questionId: 1, score: 5, type: "SINGLE", status: 1 }], "assessment")).toEqual([]);
  });

  it("keeps assessment JSON honest and daily schedule within seven days", () => {
    expect(validateAssessmentDraft({ name: "入学测评", ruleJson: "{}", dimsJson: "{broken", status: 1 })).toHaveLength(2);
    expect(validateAssessmentDraft({ name: "入学测评", ruleJson: '{"bands":[1,2]}', dimsJson: '{"代数":[12]}', status: 1 })).toEqual([]);
    expect(validateDailySchedule("2026-09-30", 21, "2026-09-23", "unknown")).toEqual([]);
    expect(validateDailySchedule("2026-10-01", 21, "2026-09-23", "unknown")).toContain("排期日期须为今天起 7 天内的有效日期");
    expect(validateDailySchedule("2026-09-24", 21, "2026-09-23", "ineligible")).toContain("该题已知不符合人工精修推理链排期要求");
    expect(validateDailySchedule("2026-02-30", 21, "2026-02-23", "unknown")).toContain("排期日期须为今天起 7 天内的有效日期");
  });
});
