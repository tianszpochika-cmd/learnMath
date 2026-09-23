import { getAdminHttp } from "./client";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const str = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const id = (value: unknown): string => {
  const result = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : str(value);
  return /^[a-zA-Z0-9_-]{1,80}$/.test(result) ? result : "";
};
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const revision = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

export interface ChallengeSummary { id: string; title: string; status: string }
export interface ChallengeDetail extends ChallengeSummary {
  paperId: string;
  startsAt: string;
  endsAt: string;
  revision: number | null;
  feedbackMode: string;
  assistancePolicy: string;
}
export interface ChallengeRecord {
  id: string;
  position: number | null;
  displayName: string;
  score: number | null;
  durationSeconds: number | null;
  anomalyFlag: boolean;
  reviewStatus: string;
}
export interface PaperGate { checked: boolean; blockers: string[]; notes: string[] }

function list(value: unknown, keys: string[]): unknown[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  const source = obj(value);
  for (const key of keys) if (Array.isArray(source[key])) return source[key] as unknown[];
  throw new Error("服务端列表格式暂不可识别");
}
export function projectChallenges(value: unknown): ChallengeSummary[] {
  return list(value, ["items", "challenges", "records"]).map((raw): ChallengeSummary | null => {
    const source = obj(raw);
    const key = id(source.id ?? source.challengeId);
    return key ? { id: key, title: str(source.title) || "未命名赛事", status: str(source.status) } : null;
  }).filter((item): item is ChallengeSummary => item !== null);
}
export function projectChallenge(value: unknown): ChallengeDetail {
  const source = obj(value);
  const key = id(source.id ?? source.challengeId);
  if (!key) throw new Error("服务端赛事详情缺少编号");
  return {
    id: key,
    title: str(source.title),
    status: str(source.status),
    paperId: id(source.paperId),
    startsAt: str(source.startsAt ?? source.startAt),
    endsAt: str(source.endsAt ?? source.endAt),
    revision: revision(source.revision),
    feedbackMode: str(source.feedbackMode),
    assistancePolicy: str(source.assistancePolicy),
  };
}
export function challengeDraftIssues(draft: ChallengeDetail): string[] {
  const issues: string[] = [];
  if (!draft.title.trim()) issues.push("请填写赛事名称");
  if (!draft.paperId) issues.push("请填写有效试卷编号");
  const start = Date.parse(draft.startsAt);
  const end = Date.parse(draft.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) issues.push("请填写有效开始与结束时间");
  else if (start >= end) issues.push("结束时间应晚于开始时间");
  return issues;
}
/** 不猜测榜单名次或时长异常；仅投影服务端明确返回的字段。 */
export function projectChallengeRecords(value: unknown): ChallengeRecord[] {
  return list(value, ["items", "records", "rows"]).map((raw, index): ChallengeRecord | null => {
    const source = obj(raw);
    const key = id(source.id ?? source.recordId) || `row-${index}`;
    const displayName = str(source.displayName) || str(source.nickname);
    if (!displayName) return null;
    const rawPosition = source.rankNo ?? source.position;
    const pos = typeof rawPosition === "number" && Number.isSafeInteger(rawPosition) && rawPosition > 0 ? rawPosition : null;
    return { id: key, position: pos, displayName, score: number(source.objectiveScore ?? source.score),
      durationSeconds: number(source.durationSeconds ?? source.durationSecond), anomalyFlag: source.anomalyFlag === true,
      reviewStatus: str(source.reviewStatus) };
  }).filter((item): item is ChallengeRecord => item !== null);
}

/** 仅当前试卷 GET 明确披露的字段可做前置检查；缺项保持未核实。 */
export function projectPaperGate(value: unknown): PaperGate {
  const source = obj(value);
  const blockers: string[] = [];
  const notes: string[] = [];
  const purpose = str(source.purpose ?? source.mode).toLowerCase();
  const feedback = str(source.feedbackMode).toLowerCase();
  const assistance = str(source.assistancePolicy).toLowerCase();
  if (!purpose) blockers.push("试卷用途未返回");
  else if (purpose !== "challenge") blockers.push("试卷用途不是挑战赛");
  if (!feedback) blockers.push("反馈时机未返回");
  else if (feedback !== "on_submit") blockers.push("挑战赛应在交卷后反馈");
  if (!assistance) blockers.push("辅助策略未返回");
  else if (assistance !== "restricted") blockers.push("挑战赛应限制辅助");
  for (const [field, label] of [
    ["subjectiveCount", "解答题数量"], ["unreviewedCount", "未审核题数量"],
    ["publicFamilyCount", "公开同族题数量"], ["exposedFamilyCount", "训练曝光题族数量"],
  ] as const) {
    const count = number(source[field]);
    if (count === null) blockers.push(`${label}未返回`);
    else if (count > 0) blockers.push(`${label}为 ${count}，需先排除`);
    else notes.push(`${label}：0`);
  }
  const targetCount = number(source.questionCount);
  const eligibleFamilies = number(source.eligibleFamilyCount);
  if (targetCount === null || targetCount < 1) blockers.push("目标题数未返回或小于 1");
  if (eligibleFamilies === null) blockers.push("可用审核客观题族数未返回");
  else if (targetCount !== null && eligibleFamilies < targetCount) blockers.push(`可用审核客观题族仅 ${eligibleFamilies}，少于目标题数 ${targetCount}`);
  return { checked: blockers.length === 0, blockers, notes };
}
function path(challengeId: string): string {
  const safe = id(challengeId);
  if (!safe) throw new Error("赛事编号无效");
  return `/api/admin/v1/challenges/${safe}`;
}
export async function readChallenges(): Promise<ChallengeSummary[]> {
  return projectChallenges(await getAdminHttp().request<unknown>({ method: "GET", path: "/api/admin/v1/challenges" }));
}
export async function readChallenge(challengeId: string): Promise<ChallengeDetail> {
  return projectChallenge(await getAdminHttp().request<unknown>({ method: "GET", path: path(challengeId) }));
}
export async function saveChallenge(draft: ChallengeDetail): Promise<void> {
  const issues = challengeDraftIssues(draft);
  if (issues.length) throw new Error(issues.join("；"));
  await getAdminHttp().request<unknown>({ method: "PATCH", path: path(draft.id), body: {
    title: draft.title.trim(), paperId: draft.paperId, startAt: draft.startsAt, endAt: draft.endsAt,
    ...(draft.revision === null ? {} : { expectedRevision: draft.revision }),
  } });
}
export async function readChallengeRecords(challengeId: string): Promise<ChallengeRecord[]> {
  return projectChallengeRecords(await getAdminHttp().request<unknown>({ method: "GET", path: path(challengeId) + "/records" }));
}
export async function checkChallengePaper(paperId: string): Promise<PaperGate> {
  const safe = id(paperId);
  if (!safe) throw new Error("试卷编号无效");
  return projectPaperGate(await getAdminHttp().request<unknown>({ method: "GET", path: `/api/admin/v1/papers/${safe}` }));
}
