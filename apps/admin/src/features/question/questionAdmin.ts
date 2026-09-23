/** Admin form validation mirrors 03 T09/T11/T19 and 20 BR-03/11; server remains authoritative. */
export const Q_TYPES = [
  { key: "SINGLE", label: "单选" }, { key: "MULTI", label: "多选" },
  { key: "JUDGE", label: "判断" }, { key: "FILL", label: "填空" },
  { key: "ESSAY", label: "解答" },
] as const;
export type QType = typeof Q_TYPES[number]["key"];
export interface Choice { key: string; text: string }
export interface JudgeConfig {
  fullWidth: boolean;
  stripSeparators: boolean;
  lowercase: boolean;
  tolerance: number;
  proportionalFill: boolean;
}
export interface QuestionDraft {
  stem: string;
  type: QType;
  options: Choice[];
  answer: string;
  analysis: string;
  difficulty: number;
  nodeIds: number[];
  source: number;
  status: number;
  questionFamilyId: number | null;
  judgeConfig: JudgeConfig;
}

export const defaultJudgeConfig = (): JudgeConfig => ({
  fullWidth: true, stripSeparators: true, lowercase: false, tolerance: 0, proportionalFill: false,
});
export const emptyQuestionDraft = (): QuestionDraft => ({
  stem: "", type: "SINGLE", options: [{ key: "A", text: "" }, { key: "B", text: "" }], answer: "",
  analysis: "", difficulty: 2, nodeIds: [], source: 1, status: 3, questionFamilyId: null,
  judgeConfig: defaultJudgeConfig(),
});
export function qTypeLabel(type: unknown): string {
  const key = typeof type === "number" ? Q_TYPES[type - 1]?.key : type;
  return Q_TYPES.find((item) => item.key === key)?.label ?? "未知题型";
}
export function optionKey(index: number): string { return index >= 0 && index < 26 ? String.fromCharCode(65 + index) : ""; }
const isChoice = (type: QType) => type === "SINGLE" || type === "MULTI" || type === "JUDGE";
const stemText = (value: string) => value.replace(/<[^>]*>/g, "").replace(/&nbsp;|\s/gi, "").trim();
export function answerKeys(answer: string): string[] {
  return answer.toUpperCase().split(/[,、\s]+/).filter(Boolean);
}

export function validateQuestionDraft(draft: QuestionDraft): string[] {
  const errors: string[] = [];
  if (!stemText(draft.stem)) errors.push("题干不能为空");
  if (!Q_TYPES.some((item) => item.key === draft.type)) errors.push("题型不在一期五类范围内");
  if (!Number.isInteger(draft.difficulty) || draft.difficulty < 1 || draft.difficulty > 5) errors.push("难度须为 1–5 的整数");
  if (!draft.nodeIds.length || draft.nodeIds.some((id) => !Number.isSafeInteger(id) || id < 1)) errors.push("至少关联一个有效知识点");
  if (!draft.answer.trim()) errors.push("标准答案不能为空");
  if (draft.answer.length > 500) errors.push("标准答案不得超过 500 字");
  if (![1, 2, 3].includes(draft.source)) errors.push("题目来源无效");
  if (![1, 2, 3].includes(draft.status)) errors.push("题目状态无效");
  if (draft.questionFamilyId !== null && (!Number.isSafeInteger(draft.questionFamilyId) || draft.questionFamilyId < 1)) errors.push("变式族编号无效");
  if (isChoice(draft.type)) {
    const options = draft.options.filter((item) => item.text.trim());
    if (options.length < 2) errors.push("选择或判断题至少需要两个非空选项");
    const keys = options.map((item) => item.key.trim().toUpperCase());
    if (new Set(keys).size !== keys.length || keys.some((key) => !/^[A-Z]$/.test(key))) errors.push("选项键须为不重复的 A–Z 字母");
    if (new Set(options.map((item) => item.text.trim())).size !== options.length) errors.push("选项文本不能重复");
    const answers = answerKeys(draft.answer);
    if (answers.length === 0 || answers.some((key) => !keys.includes(key))) errors.push("答案键必须对应非空选项");
    if (new Set(answers).size !== answers.length) errors.push("答案键不能重复");
    if (draft.type !== "MULTI" && answers.length !== 1) errors.push("单选或判断只能有一个正确项");
    if (draft.type === "MULTI" && answers.length < 2) errors.push("多选至少需要两个正确项");
  }
  if (draft.type === "FILL" && draft.answer.split("||").some((part) => !part.trim() || part.split("|").some((alt) => !alt.trim()))) {
    errors.push("填空答案须按空位填写；多个可接受答案用 |，多空用 || 分隔");
  }
  const config = draft.judgeConfig;
  if (!Number.isFinite(config.tolerance) || config.tolerance < 0 || config.tolerance > 0.1) errors.push("判分容差必须在 0–0.1 之间");
  if (draft.type !== "FILL" && (config.tolerance > 0 || config.proportionalFill)) errors.push("容差和按空计分只适用于填空题");
  return errors;
}

export type PaperPurpose = "practice" | "exam" | "assessment" | "promotion" | "boss" | "challenge";
export type FeedbackMode = "immediate" | "on_submit";
export type AssistancePolicy = "learning" | "reference_only" | "restricted" | "open_book";
export interface PaperDraft {
  title: string;
  type: 1 | 2;
  duration: number;
  purpose: PaperPurpose;
  feedbackMode: FeedbackMode;
  assistancePolicy: AssistancePolicy;
  rule: { nodeIds: number[]; difficulty: number | null; questionTypes: QType[]; count: number };
}
export const emptyPaperDraft = (): PaperDraft => ({
  title: "", type: 2, duration: 30, purpose: "practice", feedbackMode: "immediate", assistancePolicy: "learning",
  rule: { nodeIds: [], difficulty: null, questionTypes: [], count: 10 },
});
export function validatePaperDraft(draft: PaperDraft): string[] {
  const errors: string[] = [];
  if (!draft.title.trim()) errors.push("试卷名称不能为空");
  if (!Number.isInteger(draft.duration) || draft.duration < 0) errors.push("时长须为非负整数分钟");
  if (draft.type === 2) {
    if (!Number.isInteger(draft.rule.count) || draft.rule.count < 1 || draft.rule.count > 100) errors.push("规则抽题数量须为 1–100");
    if (!draft.rule.nodeIds.length || draft.rule.nodeIds.some((id) => !Number.isSafeInteger(id) || id < 1)) errors.push("规则抽题至少选择一个知识点");
    if (draft.rule.difficulty !== null && (!Number.isInteger(draft.rule.difficulty) || draft.rule.difficulty < 1 || draft.rule.difficulty > 5)) errors.push("规则难度须为 1–5");
  }
  const restricted = ["assessment", "promotion", "boss", "challenge"].includes(draft.purpose);
  if (restricted && (draft.feedbackMode !== "on_submit" || draft.assistancePolicy !== "restricted")) errors.push("测评/晋级/Boss/挑战须交卷后反馈且限制辅助");
  if (restricted && draft.rule.questionTypes.includes("ESSAY")) errors.push("测评/晋级/Boss/挑战不能包含解答题");
  if (draft.purpose === "exam" && draft.feedbackMode !== "on_submit") errors.push("考试须交卷后反馈");
  return errors;
}

export interface PaperQuestionInput { questionId: number; score: number; type?: QType | null; status?: number | null }
export function validatePaperQuestions(questions: PaperQuestionInput[], purpose: PaperPurpose): string[] {
  const errors: string[] = [];
  if (!questions.length) errors.push("手动组卷至少需要一道题");
  if (questions.length > 100) errors.push("手动组卷最多 100 道题");
  if (questions.some((item) => !Number.isSafeInteger(item.questionId) || item.questionId < 1)) errors.push("题目编号须为正整数");
  if (new Set(questions.map((item) => item.questionId)).size !== questions.length) errors.push("题目不能重复");
  if (questions.some((item) => !Number.isSafeInteger(item.score) || item.score < 1 || item.score > 100)) errors.push("每题分值须为 1–100 的整数");
  if (["assessment", "promotion", "boss", "challenge"].includes(purpose)) {
    if (questions.some((item) => item.type === "ESSAY")) errors.push("测评/晋级/Boss/挑战不能包含解答题");
    if (questions.some((item) => item.status !== undefined && item.status !== null && item.status !== 1)) errors.push("限制用途试卷不能包含已知非可用题目");
  }
  return errors;
}

export interface AssessmentDraft { name: string; ruleJson: string; dimsJson: string; status: number }
export function parseJsonObject(value: string): Record<string, unknown> | null {
  try { const result: unknown = JSON.parse(value); return result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : null; }
  catch { return null; }
}
export function validateAssessmentDraft(draft: AssessmentDraft): string[] {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("测评名称不能为空");
  const rule = parseJsonObject(draft.ruleJson);
  const dimensions = parseJsonObject(draft.dimsJson);
  if (!rule || !Object.keys(rule).length) errors.push("分档/升降/终止规则须为非空 JSON 对象");
  if (!dimensions || !Object.keys(dimensions).length) errors.push("维度与知识点映射须为非空 JSON 对象");
  if (![1, 2, 3].includes(draft.status)) errors.push("测评状态无效");
  return errors;
}

export function validateDailySchedule(date: string, questionId: number, today: string, eligibility: "eligible" | "ineligible" | "unknown"): string[] {
  const errors: string[] = [];
  const dateValue = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(date + "T00:00:00Z") : NaN;
  const todayValue = Date.parse(today + "T00:00:00Z");
  if (!Number.isFinite(dateValue) || new Date(dateValue).toISOString().slice(0, 10) !== date ||
    !Number.isFinite(todayValue) || dateValue < todayValue || dateValue > todayValue + 7 * 86_400_000) errors.push("排期日期须为今天起 7 天内的有效日期");
  if (!Number.isSafeInteger(questionId) || questionId < 1) errors.push("请选择有效的题目编号");
  if (eligibility === "ineligible") errors.push("该题已知不符合人工精修推理链排期要求");
  return errors;
}
