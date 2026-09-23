import { getMobileHttp } from "./mobileClient";

const root = "/api/app/v1";
const idPattern = /^[A-Za-z0-9_-]{1,80}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const text = (value: unknown): string => typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
export const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
export function list(value: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const row = record(value);
  for (const key of keys) if (Array.isArray(row[key])) return row[key] as unknown[];
  throw new Error("服务端列表格式暂不可识别，请稍后重试。");
}
export function validId(value: string, label = "资源"): string {
  if (!idPattern.test(value)) throw new Error(`${label}编号无效`);
  return value;
}
function validCode(value: string): string {
  if (!/^P[1-6]$/.test(value)) throw new Error("路径编号无效");
  return value;
}
function revision(value: number | null): number {
  if (value === null || !Number.isInteger(value) || value < 0) throw new Error("缺少可用的计划版本，请刷新后重试");
  return value;
}
const path = (code: string) => `${root}/paths/${validCode(code)}`;
const planPath = (id: string) => `${root}/plans/${validId(id, "计划")}`;

export interface PathNode { id: string; title: string; group: string; description: string; status: "locked" | "available" | "done" | "unknown"; level: string; stars: number | null; isBoss: boolean; x: number | null; y: number | null; lockReason: string; resourceType: string }
export interface PathDetail { code: string; title: string; description: string; progress: number | null; rank: string; nodes: PathNode[] }
export function projectPath(value: unknown, code: string): PathDetail {
  const row = record(value);
  if (!Object.keys(row).length) throw new Error("服务端未返回路径详情");
  const nodes = list(row.nodes ?? row.items ?? row.levels, "nodes", "items").map((raw): PathNode => {
    const item = record(raw), id = text(item.id ?? item.nodeId);
    if (!idPattern.test(id)) throw new Error("路径节点缺少有效编号");
    const state = text(item.status ?? item.unlockStatus).toLowerCase();
    const rawLevel = text(item.level ?? item.difficulty).toUpperCase();
    return { id, title: text(item.title ?? item.name) || "未命名节点", group: text(item.knowledgeName ?? item.knowledgeTitle ?? item.knowledgePointName ?? item.title ?? item.name), description: text(item.description),
      status: state === "locked" || state === "available" || state === "done" ? state : "unknown",
      level: /^[1-5]$/.test(rawLevel) ? `L${rawLevel}` : rawLevel, stars: number(item.stars), isBoss: item.isBoss === true || item.boss === true,
      x: number(item.x), y: number(item.y), lockReason: text(item.lockReason ?? item.unlockHint), resourceType: text(item.resourceType) };
  });
  const rawProgress = number(row.progressPercent);
  return { code, title: text(row.title ?? row.name) || code, description: text(row.description), progress: rawProgress !== null && rawProgress >= 0 && rawProgress <= 100 ? rawProgress : null, rank: text(row.rank ?? row.rankName), nodes };
}
export interface Entry { type: string; id: string; attemptId: string }
export function projectEntry(value: unknown): Entry {
  const row = record(value), target = Object.keys(record(row.resource)).length ? record(row.resource) : row;
  const type = text(target.type ?? target.resourceType).toLowerCase();
  const id = text(target.id ?? target.resourceId);
  const attemptId = text(target.attemptId);
  if (!(["lesson", "quiz", "paper", "attempt"].includes(type) && (idPattern.test(id) || idPattern.test(attemptId)))) throw new Error("服务端未返回可识别的节点入口，请勿重复进入");
  return { type, id, attemptId };
}
export const pathApi = {
  detail: async (code: string) => projectPath(await getMobileHttp().request<unknown>({ method: "GET", path: path(code) }), code),
  map: async (code: string) => projectPath(await getMobileHttp().request<unknown>({ method: "GET", path: path(code) + "/map" }), code),
  enter: async (code: string, nodeId: string) => projectEntry(await getMobileHttp().request<unknown>({ method: "POST", path: path(code) + `/nodes/${validId(nodeId, "节点")}/enter` })),
};

export interface Assessment { id: string; title: string; disabled: boolean }
export function projectAssessments(value: unknown): Assessment[] {
  return list(value, "items", "assessments").map(raw => { const row = record(raw), id = text(row.id ?? row.assessmentId); validId(id, "测评"); return { id, title: text(row.title ?? row.name) || "测评", disabled: row.disabled === true }; });
}
export interface AssessmentStart { attemptId: string }
export function projectAssessmentStart(value: unknown): AssessmentStart {
  const row = record(value), attemptId = text(row.attemptId);
  validId(attemptId, "作答");
  const policy = text(row.assistancePolicy).toLowerCase();
  if (policy !== "restricted") throw new Error("测评受限作答权限未由服务端确认，已停止进入");
  return { attemptId };
}
export interface AssessmentReport { level: string; status: string; recommendedStart: string; dimensions: { name: string; percent: number | null }[] }
export function projectAssessmentReport(value: unknown): AssessmentReport {
  const row = record(value);
  if (!["resultLevel","level","status","recommendedStart","dimensions","dimScores"].some(key => key in row)) throw new Error("服务端尚未返回可识别的测评报告");
  const raw = row.dimensions ?? row.dimScores;
  const dimensions = Array.isArray(raw) ? raw.map(item => { const dim = record(item), percent = number(dim.ratePercent); return { name: text(dim.name ?? dim.dimension), percent: percent !== null && percent >= 0 && percent <= 100 ? percent : null }; }).filter(dim => dim.name) : [];
  const level = text(row.resultLevel ?? row.level).toUpperCase();
  return { level: /^L?[1-5]$/.test(level) ? level : "", status: text(row.status), recommendedStart: text(row.recommendedStart ?? record(row.recommendedStart).title), dimensions };
}
export const assessmentApi = {
  catalog: async () => projectAssessments(await getMobileHttp().request<unknown>({ method: "GET", path: `${root}/assessments` })),
  start: async (id: string) => projectAssessmentStart(await getMobileHttp().request<unknown>({ method: "POST", path: `${root}/assessments/${validId(id, "测评")}/start` })),
  report: async (id: string) => projectAssessmentReport(await getMobileHttp().request<unknown>({ method: "GET", path: `${root}/assessments/records/${validId(id, "测评记录")}` })),
};

export type TaskState = "todo" | "completed" | "skipped" | "absent" | "rescheduled" | "unknown";
export interface PlanTask { id: string; title: string; date: string; status: TaskState; kind: string; reason: string }
export interface Plan { id: string; revision: number | null; title: string; dailyMinutes: number | null; undoAvailable: boolean; tasks: PlanTask[] }
export function projectPlan(value: unknown): Plan | null {
  if (value == null) return null;
  const row = record(value), id = text(row.id ?? row.planId); validId(id, "计划");
  const rawTasks = row.todayTasks ?? row.tasks;
  const tasks = rawTasks == null ? [] : list(rawTasks);
  return { id, revision: number(row.revision), title: text(row.title ?? row.goal) || "当前学习计划", dailyMinutes: number(row.dailyMinutes), undoAvailable: row.undoAvailable === true,
    tasks: tasks.map(raw => { const task = record(raw), taskId = text(task.id ?? task.taskId), state = text(task.status ?? task.state); validId(taskId, "任务"); return { id: taskId, title: text(task.title ?? task.name) || "未命名任务", date: text(task.date ?? task.scheduledDate), status: (["todo", "completed", "skipped", "absent", "rescheduled"].includes(state) ? state : "unknown") as TaskState, kind: text(task.kind ?? task.type), reason: text(task.reason) }; }) };
}
export interface PlanDay { date: string; todo: number | null; done: number | null }
export function projectCalendar(value: unknown): PlanDay[] {
  return list(value, "days", "items").map(raw => { const row = record(raw), date = text(row.date); if (!datePattern.test(date)) throw new Error("服务端日历日期无效"); return { date, todo: number(row.todo ?? row.pending), done: number(row.done ?? row.completed) }; });
}
export interface PlanSuggestion { id: string; basePlanRevision: number; reason: string; kind: string; status: string; windowKey: string; diffs: { target: string; date: string; from: string; to: string; reason: string }[] }
export function projectSuggestions(value: unknown): PlanSuggestion[] {
  return list(value, "items", "suggestions").map(raw => {
    const row = record(raw), id = text(row.id ?? row.suggestionId), basePlanRevision = number(row.basePlanRevision);
    validId(id, "建议"); revision(basePlanRevision);
    const rawDiffs = row.diffs ?? row.diff;
    const diffs = (rawDiffs == null ? [] : list(rawDiffs, "items")).map(rawDiff => { const d = record(rawDiff); return { target: text(d.target), date: text(d.date), from: text(d.from), to: text(d.to), reason: text(d.reason) }; });
    return { id, basePlanRevision: basePlanRevision as number, reason: text(row.reason), kind: text(row.kind), status: text(row.status), windowKey: text(row.windowKey), diffs };
  });
}
export const planApi = {
  current: async () => projectPlan(await getMobileHttp().request<unknown>({ method: "GET", path: `${root}/plans/current` })),
  calendar: async (from: string, to: string) => { if (!datePattern.test(from) || !datePattern.test(to)) throw new Error("日历日期无效"); return projectCalendar(await getMobileHttp().request<unknown>({ method: "GET", path: `${root}/plans/calendar`, query: { from, to } })); },
  suggestions: async (id: string) => projectSuggestions(await getMobileHttp().request<unknown>({ method: "GET", path: planPath(id) + "/suggestions" })),
  apply: (id: string, suggestionId: string, expectedRevision: number | null) => getMobileHttp().request<unknown>({ method: "POST", path: planPath(id) + `/suggestions/${validId(suggestionId, "建议")}/apply`, body: { expectedRevision: revision(expectedRevision) } }),
  dismiss: (id: string, suggestionId: string) => getMobileHttp().request<unknown>({ method: "POST", path: planPath(id) + `/suggestions/${validId(suggestionId, "建议")}/dismiss` }),
  undo: (id: string, expectedRevision: number | null) => getMobileHttp().request<unknown>({ method: "POST", path: planPath(id) + "/undo", body: { expectedRevision: revision(expectedRevision) } }),
  create: (goal: string, dailyMinutes: number) => { if (!goal.trim() || !Number.isInteger(dailyMinutes) || dailyMinutes <= 0) throw new Error("请填写目标与每日学习时长"); return getMobileHttp().request<unknown>({ method: "POST", path: `${root}/plans`, body: { source: "rule", dailyMinutes, goal: goal.trim() } }); },
};
