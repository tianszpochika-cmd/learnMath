import { Q_TYPES, defaultJudgeConfig, emptyPaperDraft, emptyQuestionDraft, type AssessmentDraft, type Choice, type PaperDraft, type QType, type QuestionDraft } from "./questionAdmin";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const integer = (value: unknown): number | null => {
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(number) ? number : null;
};
const id = (value: unknown): number | null => { const parsed = integer(value); return parsed && parsed > 0 ? parsed : null; };
const first = (source: Record<string, unknown>, ...keys: string[]) => keys.map((key) => source[key]).find((value) => value !== undefined && value !== null);
const rows = (value: unknown): unknown[] => {
  const source = record(value);
  const result = Array.isArray(value) ? value : first(source, "items", "records", "list", "results", "content");
  return Array.isArray(result) ? result : [];
};
export interface AdminPage<T> { items: T[]; total: number; page: number; size: number }
export function projectPage<T>(value: unknown, fallbackPage: number, fallbackSize: number, project: (entry: unknown) => T | null): AdminPage<T> {
  const source = record(value);
  if (!Array.isArray(value) && !Array.isArray(first(source, "items", "records", "list", "results", "content"))) {
    throw new Error("列表接口未返回可识别的分页记录，请核对接口契约。");
  }
  const rawItems = rows(value);
  const projected = rawItems.map(project);
  if (projected.some((entry) => entry === null)) throw new Error("列表接口存在无法识别的记录，请核对字段后再操作。");
  const items = projected as T[];
  const total = integer(source.total);
  if (!Array.isArray(value) && (total === null || total < 0)) throw new Error("列表接口未返回有效总数，无法安全分页。");
  return { items, total: total !== null && total >= 0 ? total : items.length, page: integer(source.page) ?? fallbackPage, size: integer(source.size) ?? fallbackSize };
}
export function questionType(value: unknown): QType | null {
  const type = typeof value === "number" ? Q_TYPES[value - 1]?.key : value;
  return Q_TYPES.find((item) => item.key === type)?.key ?? null;
}
export interface QuestionRow { id: number; stem: string; type: QType | null; difficulty: number | null; status: number | null; source: number | null; chainQuality: number | null }
export function projectQuestionRow(value: unknown): QuestionRow | null {
  const item = record(value);
  const questionId = id(first(item, "id", "questionId"));
  if (!questionId) return null;
  return { id: questionId, stem: text(item.stem), type: questionType(item.type), difficulty: integer(item.difficulty),
    status: integer(item.status), source: integer(item.source), chainQuality: integer(first(item, "chainQuality", "chain_quality")) };
}
function choices(value: unknown): Choice[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => {
    const item = record(entry);
    if (typeof entry === "string") {
      const match = entry.match(/^([A-Z])\.(.*)$/i);
      return { key: match?.[1]?.toUpperCase() ?? String.fromCharCode(65 + index), text: match?.[2]?.trim() ?? entry.trim() };
    }
    return { key: text(item.key).toUpperCase() || String.fromCharCode(65 + index), text: text(item.text) };
  }).filter((entry) => entry.key && entry.text);
}
function ids(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => id(typeof entry === "object" ? first(record(entry), "id", "nodeId") : entry)).filter((entry): entry is number => entry !== null))];
}
export function projectQuestionDraft(value: unknown): QuestionDraft | null {
  const item = record(value);
  const type = questionType(item.type);
  if (!id(first(item, "id", "questionId")) || !type || typeof item.stem !== "string" || typeof item.answer !== "string" ||
    integer(item.difficulty) === null || integer(item.source) === null || integer(item.status) === null) return null;
  const defaults = emptyQuestionDraft();
  const judgeConfig = record(first(item, "judgeConfig", "judge_config"));
  const configDefaults = defaultJudgeConfig();
  return {
    ...defaults, stem: text(item.stem), type, options: choices(item.options), answer: text(item.answer),
    analysis: text(item.analysis), difficulty: integer(item.difficulty) ?? defaults.difficulty,
    nodeIds: ids(first(item, "nodeIds", "knowledgeNodeIds", "nodes")),
    source: integer(item.source) ?? defaults.source, status: integer(item.status) ?? defaults.status,
    questionFamilyId: id(first(item, "questionFamilyId", "question_family_id")),
    judgeConfig: {
      fullWidth: typeof judgeConfig.fullWidth === "boolean" ? judgeConfig.fullWidth : configDefaults.fullWidth,
      stripSeparators: typeof judgeConfig.stripSeparators === "boolean" ? judgeConfig.stripSeparators : configDefaults.stripSeparators,
      lowercase: typeof judgeConfig.lowercase === "boolean" ? judgeConfig.lowercase : configDefaults.lowercase,
      tolerance: typeof judgeConfig.tolerance === "number" ? judgeConfig.tolerance : configDefaults.tolerance,
      proportionalFill: typeof judgeConfig.proportionalFill === "boolean" ? judgeConfig.proportionalFill : configDefaults.proportionalFill,
    },
  };
}
export function questionPayload(draft: QuestionDraft): Record<string, unknown> {
  return { stem: draft.stem, type: draft.type, options: draft.type === "SINGLE" || draft.type === "MULTI" || draft.type === "JUDGE" ? draft.options : [],
    answer: draft.answer, analysis: draft.analysis, difficulty: draft.difficulty, nodeIds: draft.nodeIds,
    source: draft.source, status: draft.status, questionFamilyId: draft.questionFamilyId, judgeConfig: draft.judgeConfig };
}

export interface PaperRow { id: number; title: string; type: number | null; duration: number | null; totalScore: number | null; status: number | null }
export function projectPaperRow(value: unknown): PaperRow | null {
  const item = record(value); const paperId = id(item.id);
  if (!paperId) return null;
  return { id: paperId, title: text(item.title), type: integer(item.type), duration: integer(item.duration), totalScore: integer(first(item, "totalScore", "total_score")), status: integer(item.status) };
}
export function projectPaperDraft(value: unknown): PaperDraft | null {
  const item = record(value);
  if (!id(item.id)) return null;
  if (typeof item.title !== "string" || ![1, 2].includes(Number(item.type)) || integer(item.duration) === null ||
    !["practice", "exam", "assessment", "promotion", "boss", "challenge"].includes(text(item.purpose)) ||
    !["immediate", "on_submit"].includes(text(item.feedbackMode)) ||
    !["learning", "reference_only", "restricted", "open_book"].includes(text(item.assistancePolicy))) return null;
  const base = emptyPaperDraft();
  const rule = record(first(item, "rule", "ruleJson", "rule_json"));
  return { ...base, title: text(item.title), type: integer(item.type) === 1 ? 1 : 2, duration: integer(item.duration) ?? base.duration,
    purpose: ["practice", "exam", "assessment", "promotion", "boss", "challenge"].includes(text(item.purpose)) ? item.purpose as PaperDraft["purpose"] : base.purpose,
    feedbackMode: item.feedbackMode === "on_submit" ? "on_submit" : base.feedbackMode,
    assistancePolicy: ["learning", "reference_only", "restricted", "open_book"].includes(text(item.assistancePolicy)) ? item.assistancePolicy as PaperDraft["assistancePolicy"] : base.assistancePolicy,
    rule: { nodeIds: ids(rule.nodeIds), difficulty: integer(rule.difficulty), questionTypes: Array.isArray(rule.questionTypes) ? rule.questionTypes.map(questionType).filter((type): type is QType => type !== null) : [], count: integer(rule.count) ?? base.rule.count } };
}
export interface PaperQuestionRow { questionId: number; seq: number; score: number; stem: string; type: QType | null; status: number | null }
export function projectPaperQuestions(value: unknown): PaperQuestionRow[] | null {
  const source = record(value);
  const raw = first(source, "questions", "paperQuestions");
  if (!Array.isArray(raw)) return null;
  const projected = raw.map((entry): PaperQuestionRow | null => {
    const item = record(entry);
    const questionId = id(first(item, "questionId", "question_id", "id"));
    const score = integer(item.score);
    if (!questionId || score === null || score < 1) return null;
    return { questionId, seq: integer(item.seq) ?? 0, score, stem: text(item.stem),
      type: questionType(item.type), status: integer(item.status) };
  });
  if (projected.some((item) => item === null)) return null;
  return (projected as PaperQuestionRow[]).sort((a, b) => a.seq - b.seq);
}
export function projectPaperPreview(value: unknown): { questions: QuestionRow[]; insufficient: number | null } | null {
  const source = record(value);
  const raw = first(source, "questions", "items", "candidates");
  if (!Array.isArray(raw)) return null;
  const projected = raw.map(projectQuestionRow);
  if (projected.some((row) => row === null)) return null;
  return { questions: projected as QuestionRow[], insufficient: integer(first(source, "insufficient", "shortfall")) };
}

export interface AssessmentRow { id: number; name: string; status: number | null }
export function projectAssessmentRow(value: unknown): AssessmentRow | null {
  const item = record(value); const assessmentId = id(item.id);
  return assessmentId ? { id: assessmentId, name: text(item.name), status: integer(item.status) } : null;
}
export function projectAssessmentDraft(value: unknown): AssessmentDraft | null {
  const item = record(value);
  if (!id(item.id) || typeof item.name !== "string" || first(item, "ruleJson", "rule_json") === undefined ||
    first(item, "dimsJson", "dims_json") === undefined || integer(item.status) === null) return null;
  const json = (entry: unknown): string => typeof entry === "string" ? entry : JSON.stringify(entry ?? {});
  return { name: text(item.name), ruleJson: json(first(item, "ruleJson", "rule_json")), dimsJson: json(first(item, "dimsJson", "dims_json")), status: integer(item.status) ?? 3 };
}
export function requireId(value: unknown, message: string): number {
  const source = record(value);
  const result = id(first(source, "id", "questionId", "paperId", "assessmentId"));
  if (!result) throw new Error(message);
  return result;
}

export interface KnowledgeChoice { id: number; name: string; depth: number }
export function projectKnowledgeChoices(value: unknown): KnowledgeChoice[] {
  const source = record(value);
  const root = Array.isArray(value) ? value : Array.isArray(source.tree) ? source.tree : rows(value);
  const choices: KnowledgeChoice[] = [];
  const seen = new Set<number>();
  function visit(entries: unknown[], depth: number): void {
    for (const entry of entries) {
      const item = record(entry);
      const nodeId = id(first(item, "id", "nodeId"));
      const name = text(first(item, "name", "title"));
      if (nodeId && name && !seen.has(nodeId)) { choices.push({ id: nodeId, name, depth }); seen.add(nodeId); }
      if (Array.isArray(item.children) && depth < 8) visit(item.children, depth + 1);
    }
  }
  visit(root, 0);
  return choices;
}
