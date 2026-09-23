import { getAppHttp } from "./client";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const str = (value: unknown): string => typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
const idPattern = /^[a-zA-Z0-9_-]{1,80}$/;
const percent = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};

export interface AssessmentChoice { id: string; title: string; disabled: boolean }
export interface AssessmentStart { attemptId: string }
export interface AssessmentDimension { name: string; ratePercent: number | null }
export interface AssessmentReport {
  level: number | null;
  status: string;
  dimensions: AssessmentDimension[];
  recommendedStart: string;
}

function path(id: string): string {
  if (!idPattern.test(id)) throw new Error("测评编号无效");
  return "/api/app/v1/assessments/" + id;
}
function listPayload(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  const source = obj(value);
  if (Array.isArray(source.items)) return source.items;
  if (Array.isArray(source.assessments)) return source.assessments;
  throw new Error("服务端测评列表格式暂不可识别");
}

/** 列表不带题目时只展示名称，不生成本地示例题或答题结果。 */
export function projectAssessmentCatalog(value: unknown): AssessmentChoice[] {
  return listPayload(value).map((raw) => {
    const entry = obj(raw);
    const id = str(entry.id ?? entry.assessmentId);
    if (!idPattern.test(id)) throw new Error("服务端测评缺少有效编号");
    return { id, title: str(entry.title ?? entry.name) || "测评", disabled: entry.disabled === true };
  });
}

/** 04 §8.1 约定开考返回 attemptId；缺失时不能猜测卷号或自动重试。 */
export function projectAssessmentStart(value: unknown): AssessmentStart {
  const source = obj(value);
  const attemptId = str(source.attemptId);
  if (!idPattern.test(attemptId)) {
    throw new Error("开考请求已返回，但缺少作答入口。请检查进行中作答，勿重复开始。");
  }
  const policy = str(source.assistancePolicy).toLowerCase();
  if (policy && policy !== "restricted") {
    throw new Error("测评辅助策略与受限作答规则不一致，已停止进入作答。");
  }
  return { attemptId };
}

/** 报告仅显示服务端明确给出的定级与百分比；不从题数反推正确率。 */
export function projectAssessmentReport(value: unknown): AssessmentReport {
  const source = obj(value);
  const rawLevel = Number(source.resultLevel ?? source.result_level ?? source.level);
  const level = Number.isInteger(rawLevel) && rawLevel >= 1 && rawLevel <= 5 ? rawLevel : null;
  const rawDims = source.dimensions ?? source.dimScores;
  const dimensions: AssessmentDimension[] = Array.isArray(rawDims)
    ? rawDims.map((raw) => {
      const item = obj(raw);
      return { name: str(item.name ?? item.dimension), ratePercent: percent(item.ratePercent) };
    }).filter((entry) => entry.name)
    : [];
  const start = source.recommendedStart;
  return {
    level,
    status: str(source.status).toLowerCase(),
    dimensions,
    recommendedStart: typeof start === "string" ? start.trim() : str(obj(start).title),
  };
}

export async function readAvailableAssessments(): Promise<AssessmentChoice[]> {
  return projectAssessmentCatalog(await getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/assessments" }));
}
export async function startAssessment(id: string): Promise<AssessmentStart> {
  return projectAssessmentStart(await getAppHttp().request<unknown>({ method: "POST", path: path(id) + "/start" }));
}
export async function readAssessmentReport(recordId: string): Promise<AssessmentReport> {
  if (!idPattern.test(recordId)) throw new Error("测评记录编号无效");
  return projectAssessmentReport(await getAppHttp().request<unknown>({
    method: "GET", path: "/api/app/v1/assessments/records/" + recordId,
  }));
}
