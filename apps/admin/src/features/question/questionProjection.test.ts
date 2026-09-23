import { describe, expect, it } from "vitest";
import { projectAssessmentDraft, projectPage, projectPaperDraft, projectPaperPreview, projectPaperQuestions, projectQuestionDraft } from "./questionProjection";

describe("admin content projection", () => {
  it("fails closed on malformed paged data instead of showing an empty success", () => {
    expect(() => projectPage({}, 1, 20, () => null)).toThrow("分页记录");
    expect(() => projectPage({ items: [], page: 1, size: 20 }, 1, 20, () => null)).toThrow("有效总数");
    expect(projectPage({ items: [], total: 0, page: 1, size: 20 }, 1, 20, () => null).items).toEqual([]);
  });

  it("blocks editing when required server fields are absent", () => {
    expect(projectQuestionDraft({ id: 8, type: "SINGLE", stem: "题干" })).toBeNull();
    expect(projectPaperDraft({ id: 8, title: "练习", type: 2, duration: 30 })).toBeNull();
    expect(projectAssessmentDraft({ id: 8, name: "入学" })).toBeNull();
  });

  it("distinguishes missing paper lineup from a truly empty lineup", () => {
    expect(projectPaperQuestions({ id: 8 })).toBeNull();
    expect(projectPaperQuestions({ id: 8, questions: [] })).toEqual([]);
    expect(projectPaperQuestions({ id: 8, questions: [{ seq: 1, score: 5 }] })).toBeNull();
    expect(projectPaperQuestions({ id: 8, questions: [{ questionId: 12, seq: 1, score: 5 }] })?.[0]?.questionId).toBe(12);
    expect(projectPaperPreview({ questions: [{ stem: "无编号" }] })).toBeNull();
  });
});
