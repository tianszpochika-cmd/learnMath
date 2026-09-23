import { getAppHttp } from "./client";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const str = (value: unknown): string => typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
const count = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
};
const idPattern = /^[a-zA-Z0-9_-]{1,80}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export type PlanTaskState = "todo" | "completed" | "skipped" | "absent" | "rescheduled" | "unknown";
export type PlanTaskKind = "objective" | "reading" | "personal" | "unknown";
export interface PlanTask {
  id: string;
  title: string;
  date: string;
  state: PlanTaskState;
  kind: PlanTaskKind;
  reason: string;
  evidenceRef: string;
}
export interface PlanView {
  id: string;
  revision: number | null;
  title: string;
  tasks: PlanTask[];
  dailyMinutes: number | null;
  undoAvailable: boolean;
}
export interface PlanSuggestion {
  id: string;
  basePlanRevision: number;
  kind: string;
  reason: string;
  windowKey: string;
  status: string;
  diffs: Array<{ date: string; target: string; from: string; to: string; reason: string }>;
}
export interface PlanDay { date: string; todo: number | null; done: number | null }

function arrayPayload(value: unknown, keys: string[]): unknown[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  const source = obj(value);
  for (const key of keys) if (Array.isArray(source[key])) return source[key] as unknown[];
  throw new Error("服务端列表数据格式暂不可识别");
}
function taskState(raw: unknown): PlanTaskState {
  const value = str(raw).toLowerCase();
  return value === "todo" || value === "completed" || value === "skipped" || value === "absent" || value === "rescheduled"
    ? value : "unknown";
}
function taskKind(raw: unknown): PlanTaskKind {
  const value = str(raw).toLowerCase();
  return value === "objective" || value === "reading" || value === "personal" ? value : "unknown";
}

/** 只投影返回体明确提供的值；非空但缺少计划编号视为格式错误。 */
export function projectPlan(value: unknown): PlanView | null {
  if (value === null || value === undefined) return null;
  const source = obj(value);
  const id = str(source.id ?? source.planId);
  if (!idPattern.test(id)) throw new Error("服务端计划数据缺少有效编号");
  const rawTasks = source.tasks ?? source.todayTasks;
  const tasks = rawTasks === null || rawTasks === undefined ? [] : arrayPayload(rawTasks, []);
  return {
    id,
    revision: count(source.revision),
    title: str(source.title ?? source.goal) || "当前学习计划",
    dailyMinutes: count(source.dailyMinutes),
    undoAvailable: source.undoAvailable === true,
    tasks: tasks.map((raw): PlanTask => {
      const task = obj(raw);
      const taskId = str(task.id ?? task.taskId);
      if (!idPattern.test(taskId)) throw new Error("服务端任务数据缺少有效编号");
      return {
        id: taskId,
        title: str(task.title ?? task.name) || "未命名任务",
        date: str(task.date ?? task.scheduledDate),
        state: taskState(task.state ?? task.status),
        kind: taskKind(task.kind ?? task.type),
        reason: str(task.reason),
        evidenceRef: str(task.evidenceRef),
      };
    }),
  };
}

export function projectSuggestions(value: unknown): PlanSuggestion[] {
  return arrayPayload(value, ["items", "suggestions"]).map((raw): PlanSuggestion => {
    const entry = obj(raw);
    const id = str(entry.id ?? entry.suggestionId);
    const basePlanRevision = count(entry.basePlanRevision);
    if (!idPattern.test(id) || basePlanRevision === null) throw new Error("服务端建议缺少编号或基准版本");
    const rawDiffs = entry.diffs ?? entry.diff;
    const diffs = rawDiffs === null || rawDiffs === undefined ? [] : arrayPayload(rawDiffs, []);
    return {
      id,
      basePlanRevision,
      kind: str(entry.kind).toUpperCase(),
      reason: str(entry.reason),
      windowKey: str(entry.windowKey),
      status: str(entry.status).toLowerCase(),
      diffs: diffs.map((rawDiff) => {
        const diff = obj(rawDiff);
        return {
          date: str(diff.date ?? diff.dateLabel),
          target: str(diff.target),
          from: str(diff.from),
          to: str(diff.to),
          reason: str(diff.reason),
        };
      }),
    };
  });
}

export function projectCalendar(value: unknown): PlanDay[] {
  return arrayPayload(value, ["days", "items"]).map((raw): PlanDay => {
    const day = obj(raw);
    const date = str(day.date);
    if (!datePattern.test(date)) throw new Error("服务端日历日期格式暂不可识别");
    return { date, todo: count(day.todo ?? day.pending), done: count(day.done ?? day.completed) };
  });
}

function validId(id: string, label: string): string {
  if (!idPattern.test(id)) throw new Error(label + "编号无效");
  return id;
}
function validRevision(revision: number): number {
  if (!Number.isInteger(revision) || revision < 0) throw new Error("缺少可用的计划版本，请刷新后重试");
  return revision;
}
function planPath(id: string): string { return "/api/app/v1/plans/" + validId(id, "计划"); }

export async function readCurrentPlan(): Promise<PlanView | null> {
  return projectPlan(await getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/plans/current" }));
}
export async function createRulePlan(goal: string, dailyMinutes: number): Promise<void> {
  if (!goal.trim() || !Number.isInteger(dailyMinutes) || dailyMinutes <= 0) throw new Error("请输入目标和每日学习时长");
  await getAppHttp().request<unknown>({ method: "POST", path: "/api/app/v1/plans", body: { source: "rule", dailyMinutes, goal: goal.trim() } });
}
export async function readPlanSuggestions(id: string): Promise<PlanSuggestion[]> {
  return projectSuggestions(await getAppHttp().request<unknown>({ method: "GET", path: planPath(id) + "/suggestions" }));
}
export async function readPlanCalendar(from: string, to: string): Promise<PlanDay[]> {
  if (!datePattern.test(from) || !datePattern.test(to)) throw new Error("日历日期无效");
  return projectCalendar(await getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/plans/calendar", query: { from, to } }));
}
export async function actOnSuggestion(id: string, suggestionId: string, action: "apply" | "dismiss", expectedRevision: number): Promise<void> {
  await getAppHttp().request<unknown>({
    method: "POST",
    path: planPath(id) + "/suggestions/" + validId(suggestionId, "建议") + "/" + action,
    body: { expectedRevision: validRevision(expectedRevision) },
  });
}
export async function undoPlan(id: string, expectedRevision: number): Promise<void> {
  await getAppHttp().request<unknown>({ method: "POST", path: planPath(id) + "/undo", body: { expectedRevision: validRevision(expectedRevision) } });
}
