import { getAppHttp } from "./client";

type Data = Record<string, unknown>;
const record = (value: unknown): Data => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const identifier = (value: unknown): string => {
  const id = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : text(value);
  return /^[a-zA-Z0-9_-]{1,80}$/.test(id) ? id : "";
};
const nonNegative = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const position = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;

export type RankScope = "weekly" | "daily";
export interface RankRow {
  key: string;
  position: number | null;
  displayName: string;
  points: number | null;
  tier: string;
  isSelf: boolean;
}
export interface RankBoard {
  rows: RankRow[];
  mine: { position: number | null; points: number | null; tier: string } | null;
}
export interface Challenge {
  id: string;
  title: string;
  status: "upcoming" | "live" | "ended" | "unknown";
  startsAt: string;
  endsAt: string;
  joined: boolean;
  attemptId: string;
  description: string;
  rules: ChallengeRules | null;
}
export interface ChallengeRules {
  timeLimit: string;
  assistance: string;
  feedback: string;
  resume: string;
  scoring: string;
}
export interface ChallengeRankRow {
  key: string;
  position: number | null;
  displayName: string;
  score: number | null;
  isSelf: boolean;
}

function list(value: unknown, keys: string[]): unknown[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  const source = record(value);
  for (const key of keys) if (Array.isArray(source[key])) return source[key] as unknown[];
  throw new Error("服务端列表格式暂不可识别，请稍后重试");
}

function displayName(item: Data): string {
  if (item.anonymous === true) return "匿名学员";
  return text(item.displayName) || text(item.nickname) || text(item.name);
}

/** 保留服务端顺序；没有明确 position 时不推算名次。 */
export function projectRankBoard(value: unknown, currentUserId: string | null = null): RankBoard {
  const source = record(value);
  const rows = list(value, ["items", "rows", "entries"]).map((raw, index): RankRow | null => {
    const item = record(raw);
    const name = displayName(item);
    if (!name) return null;
    const userId = identifier(item.userId);
    return {
      key: userId || `row-${index}`,
      position: position(item.position),
      displayName: name,
      points: nonNegative(item.points),
      tier: text(item.rankTierName) || text(item.tierName),
      isSelf: item.isSelf === true || Boolean(userId && currentUserId && userId === currentUserId),
    };
  }).filter((entry): entry is RankRow => entry !== null);
  const own = record(source.mine ?? source.myRank);
  const ownRow = rows.find((row) => row.isSelf);
  const mine = ownRow
    ? { position: ownRow.position, points: ownRow.points, tier: ownRow.tier }
    : Object.keys(own).length
      ? { position: position(own.position), points: nonNegative(own.points), tier: text(own.rankTierName) || text(own.tierName) }
      : null;
  return { rows, mine };
}

export function projectChallenges(value: unknown): Challenge[] {
  return list(value, ["items", "challenges", "records"]).map((raw): Challenge | null => {
    const item = record(raw);
    const id = identifier(item.id ?? item.challengeId);
    if (!id) return null;
    const status = text(item.status).toLowerCase();
    const publishedRules = record(item.rules);
    const seconds = nonNegative(publishedRules.durationSeconds ?? item.durationSeconds);
    const minutes = nonNegative(publishedRules.durationMinutes ?? item.durationMinutes);
    const timeLimit = text(publishedRules.timeLimitText ?? item.timeLimitText)
      || (seconds !== null && seconds > 0 ? seconds % 60 === 0 ? `${seconds / 60} 分钟` : `${seconds} 秒` : "")
      || (minutes !== null && minutes > 0 ? `${minutes} 分钟` : "");
    const assistancePolicy = text(publishedRules.assistancePolicy ?? item.assistancePolicy).toLowerCase();
    const feedbackMode = text(publishedRules.feedbackMode ?? item.feedbackMode).toLowerCase();
    const resume = text(publishedRules.resumeRule ?? publishedRules.resumeRuleText ?? item.resumeRule);
    const scoring = text(publishedRules.scoringRule ?? publishedRules.scoringRuleText ?? item.scoringRule);
    const rules: ChallengeRules | null = timeLimit && resume && scoring && assistancePolicy === "restricted" && feedbackMode === "on_submit"
      ? { timeLimit, assistance: "受限：作答中不可使用 AI、公式参考或题目深钻", feedback: "交卷后反馈", resume, scoring }
      : null;
    return {
      id,
      title: text(item.title) || "未命名赛事",
      status: status === "upcoming" || status === "live" || status === "ended" ? status : "unknown",
      startsAt: text(item.startsAt ?? item.startAt),
      endsAt: text(item.endsAt ?? item.endAt),
      joined: item.joined === true,
      attemptId: identifier(item.attemptId),
      description: text(item.description),
      rules,
    };
  }).filter((entry): entry is Challenge => entry !== null);
}

export function projectChallengeRank(value: unknown, currentUserId: string | null = null): ChallengeRankRow[] {
  return list(value, ["items", "rows", "entries"]).map((raw, index): ChallengeRankRow | null => {
    const item = record(raw);
    const name = displayName(item);
    if (!name) return null;
    const userId = identifier(item.userId);
    return {
      key: userId || `row-${index}`,
      position: position(item.position),
      displayName: name,
      score: nonNegative(item.score),
      isSelf: item.isSelf === true || Boolean(userId && currentUserId && userId === currentUserId),
    };
  }).filter((entry): entry is ChallengeRankRow => entry !== null);
}

/** 参赛请求的结果只供后续核对；“已参赛”由再次读取的赛事数据确认。 */
export function projectJoinResult(value: unknown): { attemptId: string } {
  return { attemptId: identifier(record(value).attemptId) };
}

export function challengePath(id: string): string {
  const safe = identifier(id);
  if (!safe) throw new Error("赛事编号无效");
  return `/api/app/v1/challenges/${safe}`;
}

export async function readRank(scope: RankScope, currentUserId: string | null = null): Promise<RankBoard> {
  if (scope !== "weekly" && scope !== "daily") throw new Error("榜单类型无效");
  return projectRankBoard(await getAppHttp().request<unknown>({ method: "GET", path: `/api/app/v1/rank/${scope}` }), currentUserId);
}
export async function readChallenges(): Promise<Challenge[]> {
  return projectChallenges(await getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/challenges" }));
}
export async function readChallengeRank(id: string, currentUserId: string | null = null): Promise<ChallengeRankRow[]> {
  return projectChallengeRank(await getAppHttp().request<unknown>({ method: "GET", path: challengePath(id) + "/rank" }), currentUserId);
}
export async function joinChallenge(id: string): Promise<{ attemptId: string }> {
  return projectJoinResult(await getAppHttp().request<unknown>({ method: "POST", path: challengePath(id) + "/join" }));
}
