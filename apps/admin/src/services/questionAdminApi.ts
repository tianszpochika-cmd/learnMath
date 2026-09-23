import type { HttpClient } from "@learnmath/api-client";
import { projectAssessmentDraft, projectAssessmentRow, projectKnowledgeChoices, projectPage, projectPaperDraft, projectPaperPreview, projectPaperQuestions, projectPaperRow, projectQuestionDraft, projectQuestionRow, questionPayload, requireId } from "../features/question/questionProjection";
import { parseJsonObject, type AssessmentDraft, type PaperDraft, type QuestionDraft } from "../features/question/questionAdmin";
import { getAdminHttp } from "./client";

const root = "/api/admin/v1";
const validId = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("管理资源编号无效");
  return value;
};

export function createQuestionAdminApi(http: HttpClient = getAdminHttp()) {
  return {
    knowledgeChoices: async () => projectKnowledgeChoices(await http.request<unknown>({ method: "GET", path: root + "/knowledge/tree" })),
    questions: async (filters: { keyword: string; type: string; difficulty: string; status: string; page: number; size: number }) =>
      projectPage(await http.request<unknown>({ method: "GET", path: root + "/questions", query: {
        keyword: filters.keyword || undefined, type: filters.type || undefined,
        difficulty: filters.difficulty || undefined, status: filters.status || undefined,
        page: filters.page, size: filters.size,
      } }), filters.page, filters.size, projectQuestionRow),
    question: async (questionId: number) => projectQuestionDraft(await http.request<unknown>({ method: "GET", path: `${root}/questions/${validId(questionId)}` })),
    questionSummary: async (questionId: number) => projectQuestionRow(await http.request<unknown>({ method: "GET", path: `${root}/questions/${validId(questionId)}` })),
    createQuestion: async (draft: QuestionDraft) => requireId(await http.request<unknown>({
      method: "POST", path: root + "/questions", body: questionPayload(draft),
    }), "服务端未返回新题目编号，请返回题库核查后再继续。"),
    updateQuestion: async (questionId: number, draft: QuestionDraft) => {
      await http.request<unknown>({ method: "PATCH", path: `${root}/questions/${validId(questionId)}`, body: questionPayload(draft) });
    },
    deleteQuestion: async (questionId: number) => {
      await http.request<unknown>({ method: "DELETE", path: `${root}/questions/${validId(questionId)}` });
    },
    duplicates: async () => http.request<unknown>({ method: "GET", path: root + "/questions/dup" }),

    papers: async (page: number, size: number) => projectPage(await http.request<unknown>({
      method: "GET", path: root + "/papers", query: { page, size },
    }), page, size, projectPaperRow),
    paper: async (paperId: number) => {
      const data = await http.request<unknown>({ method: "GET", path: `${root}/papers/${validId(paperId)}` });
      return { draft: projectPaperDraft(data), questions: projectPaperQuestions(data) };
    },
    previewPaper: async (rule: PaperDraft["rule"]) => projectPaperPreview(await http.request<unknown>({
      method: "POST", path: root + "/papers/generate", body: { rule },
    })),
    createPaper: async (draft: PaperDraft) => requireId(await http.request<unknown>({
      method: "POST", path: root + "/papers", body: { title: draft.title, type: draft.type, duration: draft.duration,
        purpose: draft.purpose, feedbackMode: draft.feedbackMode, assistancePolicy: draft.assistancePolicy, ruleJson: draft.rule },
    }), "服务端未返回新试卷编号，请返回组卷列表核查。"),
    updatePaper: async (paperId: number, draft: PaperDraft) => {
      await http.request<unknown>({ method: "PATCH", path: `${root}/papers/${validId(paperId)}`,
        body: { title: draft.title, type: draft.type, duration: draft.duration,
          purpose: draft.purpose, feedbackMode: draft.feedbackMode, assistancePolicy: draft.assistancePolicy, ruleJson: draft.rule } });
    },
    adjustPaperQuestions: async (paperId: number, questions: Array<{ questionId: number; seq: number; score: number }>) => {
      await http.request<unknown>({ method: "PATCH", path: `${root}/papers/${validId(paperId)}/questions`, body: { questions } });
    },

    assessments: async (page: number, size: number) => projectPage(await http.request<unknown>({
      method: "GET", path: root + "/assessments", query: { page, size },
    }), page, size, projectAssessmentRow),
    assessment: async (assessmentId: number) => projectAssessmentDraft(await http.request<unknown>({ method: "GET", path: `${root}/assessments/${validId(assessmentId)}` })),
    createAssessment: async (draft: AssessmentDraft) => requireId(await http.request<unknown>({
      method: "POST", path: root + "/assessments", body: { name: draft.name, ruleJson: parseJsonObject(draft.ruleJson), dimsJson: parseJsonObject(draft.dimsJson), status: draft.status },
    }), "服务端未返回新测评编号，请返回测评列表核查。"),
    updateAssessment: async (assessmentId: number, draft: AssessmentDraft) => {
      await http.request<unknown>({ method: "PATCH", path: `${root}/assessments/${validId(assessmentId)}`,
        body: { name: draft.name, ruleJson: parseJsonObject(draft.ruleJson), dimsJson: parseJsonObject(draft.dimsJson), status: draft.status } });
    },
    scheduleDaily: async (date: string, questionId: number) => {
      await http.request<unknown>({ method: "PUT", path: root + "/daily/schedule", body: { date, questionId: validId(questionId) } });
    },
  };
}
