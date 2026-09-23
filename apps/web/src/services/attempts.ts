import { getAppHttp } from "./client";

type RecordValue = Record<string, unknown>;

export interface AttemptOption { key: string; text: string }
export interface AttemptItem {
  seq: number;
  questionId: string;
  stem: string;
  type: string;
  options: AttemptOption[];
  optionError: boolean;
  draft: string;
  submitted: boolean;
  locked: boolean;
  flagged: boolean;
  judgement: "correct" | "incorrect" | "pending" | null;
  selfAssess: number | null;
}
export interface AttemptView {
  id: string;
  title: string;
  mode: string;
  status: string;
  revision: number;
  revisionKnown: boolean;
  serverNow: string;
  deadlineAt: string;
  feedbackMode: "immediate" | "on_submit" | null;
  items: AttemptItem[];
  objectiveEarned: number | null;
  objectivePossible: number | null;
  objectiveRate: number | null;
  pendingSelfAssess: number;
}

function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

function string(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function options(value: unknown): AttemptOption[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const mapped = value.map((raw) => {
    const item = record(raw);
    const key = string(item.key);
    const label = string(item.text ?? item.content ?? item.label);
    return key && label ? { key, text: label } : null;
  });
  if (mapped.some((item) => item === null)) return null;
  const result = mapped as AttemptOption[];
  return new Set(result.map((item) => item.key)).size === result.length ? result : null;
}

/**
 * 只投影服务端明确返回的作答信息。题面缺失时返回空题组，页面显示不可作答，
 * 不用示例题或本机时间替代服务端的题面、截止和判分。
 */
export function projectAttempt(value: unknown): AttemptView {
  const source = record(value);
  const rawItems = Array.isArray(source.items) ? source.items : Array.isArray(source.questions) ? source.questions : [];
  const objective = record(source.objective);
  const status = string(source.status ?? source.state);
  const feedbackMode = source.feedbackMode === "immediate" || source.feedbackMode === "on_submit" ? source.feedbackMode : null;
  const items = rawItems.map((raw): AttemptItem | null => {
    const item = record(raw);
    const question = record(item.question);
    const seq = numberOrNull(item.seq);
    const stem = string(item.stem ?? question.stem);
    if (seq === null || seq < 1 || !stem) return null;
    const judgement = string(item.judgement ?? item.result).toLowerCase();
    const submitted = item.submitted === true || item.answered === true;
    const feedbackAllowed = ["submitted", "pending_self_assess", "finalized"].includes(status.toLowerCase()) || (feedbackMode === "immediate" && submitted);
    const type = string(item.type ?? question.type);
    const rawOptions = item.options ?? question.options;
    const mappedOptions = options(rawOptions);
    const expectsOptions = /choice|select|单选|多选/i.test(type);
    return {
      seq,
      questionId: string(item.questionId ?? question.id),
      stem,
      type,
      options: mappedOptions ?? [],
      optionError: mappedOptions === null || (expectsOptions && !mappedOptions?.length),
      // answer may be a standard answer in a raw entity; only the explicit
      // server draft projection may refill an in-progress input.
      draft: string(item.draft),
      submitted,
      locked: item.locked !== false || (feedbackMode === "immediate" && submitted),
      flagged: item.flagged === true,
      judgement: feedbackAllowed && (judgement === "correct" || judgement === "incorrect" || judgement === "pending") ? judgement : null,
      selfAssess: numberOrNull(item.selfAssess ?? item.assess),
    };
  }).filter((item): item is AttemptItem => item !== null).sort((a, b) => a.seq - b.seq);
  return {
    id: string(source.id),
    title: string(source.title ?? source.paperTitle) || "作答",
    mode: string(source.mode),
    status,
    revision: numberOrNull(source.revision) ?? 0,
    revisionKnown: typeof source.revision === "number" && Number.isSafeInteger(source.revision) && source.revision >= 0,
    serverNow: string(source.serverNow),
    deadlineAt: string(source.deadlineAt),
    feedbackMode,
    items,
    objectiveEarned: numberOrNull(objective.earned ?? source.objectiveEarned),
    objectivePossible: numberOrNull(objective.possible ?? source.objectivePossible),
    objectiveRate: numberOrNull(objective.rate ?? source.objectiveRate),
    pendingSelfAssess: numberOrNull(source.pendingSelfAssess) ?? 0,
  };
}

export function serverRemainingMs(serverNow: string, deadlineAt: string, elapsedMs: number): number | null {
  if (!serverNow || !deadlineAt) return null;
  const start = Date.parse(serverNow);
  const end = Date.parse(deadlineAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, end - start - Math.max(0, elapsedMs));
}

export function attemptPath(id: string): string {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error("无效的作答编号");
  return "/api/app/v1/attempts/" + id;
}

export async function readAttempt(id: string): Promise<AttemptView> {
  return projectAttempt(await getAppHttp().request<unknown>({ method: "GET", path: attemptPath(id) }));
}

export async function sendAttemptAction(id: string, action: "draft" | "answer" | "submit" | "self-assess", body?: RecordValue): Promise<unknown> {
  return getAppHttp().request<unknown>({ method: action === "draft" ? "PUT" : "POST", path: attemptPath(id) + "/" + action, body });
}
