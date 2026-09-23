import { currentMobileUserId, getMobileHttp } from "./mobileClient";
import { list, number, record, text, validId } from "./pathPlan";

const root = "/api/app/v1";
declare const uni: { getStorageSync(key: string): unknown };
/** Local marker only narrows UI; server remains the authority for every protected resource. */
export function formulaAccessFromMarker(): "blocked" | "reference" | "full" {
  const user = currentMobileUserId();
  if (!user) return "full";
  try {
    const marker = record(uni.getStorageSync(`lm.mobile.activeAttempt:${user}`));
    if (text(marker.state) !== "in_progress") return "full";
    const policy = text(marker.assistancePolicy);
    if (policy === "learning" || policy === "open_book") return "full";
    return policy === "reference_only" ? "reference" : "blocked";
  } catch { return "blocked"; }
}
export interface StatMetric { label: string; value: string; unit: string }
export interface StatPoint { label: string; value: number }
export interface Stats { metrics: StatMetric[]; timeTrend: StatPoint[]; reasoning: StatPoint[]; mastery: StatPoint[]; accuracy: StatPoint[] }
function points(value: unknown): StatPoint[] {
  return Array.isArray(value) ? value.map(raw => { const row = record(raw); return { label: text(row.label ?? row.date ?? row.name ?? row.stepType), value: number(row.value ?? row.percent ?? row.minutes) }; }).filter((row): row is StatPoint => Boolean(row.label) && row.value !== null) : [];
}
export function projectStats(value: unknown): Stats {
  const row = record(value);
  if (!["summary","metrics","timeTrend","studyTimeTrend","reasoning","reasoningAbility","mastery","masteryRadar","accuracy","accuracyTrend"].some(key => key in row)) throw new Error("服务端尚未返回可识别的统计数据");
  const rawMetrics = record(row.summary ?? row.metrics);
  const metrics = Object.entries(rawMetrics).filter(([, value]) => typeof value === "number" || typeof value === "string").map(([label, value]) => ({ label, value: String(value), unit: "" }));
  return { metrics, timeTrend: points(row.timeTrend ?? row.studyTimeTrend), reasoning: points(row.reasoning ?? row.reasoningAbility), mastery: points(row.mastery ?? row.masteryRadar), accuracy: points(row.accuracy ?? row.accuracyTrend) };
}
export interface HeatDay { date: string; level: number }
export function projectHeatmap(value: unknown): HeatDay[] {
  return list(value, "days", "items", "heatmap").map(raw => { const row = record(raw); return { date: text(row.date), level: number(row.level ?? row.count) }; }).filter((day): day is HeatDay => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && day.level !== null && day.level >= 0);
}
export interface WeeklyReport { id: string; title: string; period: string; metrics: StatMetric[]; commentary: string; suggestions: string[]; posterAvailable: boolean }
export function projectReport(value: unknown): WeeklyReport | null {
  if (value == null) return null;
  const row = record(value);
  if (!["id","reportId","title","period","weekLabel","metrics","summary","commentary","aiCommentary","nextWeekSuggestions","suggestions"].some(key => key in row)) throw new Error("报告格式暂不可识别");
  const metricsRaw = record(row.metrics ?? row.summary);
  const metrics = Object.entries(metricsRaw).filter(([, val]) => typeof val === "number" || typeof val === "string").map(([label, val]) => ({ label, value: String(val), unit: "" }));
  const rawSuggestions = row.nextWeekSuggestions ?? row.suggestions;
  return { id: text(row.id ?? row.reportId), title: text(row.title) || "学习周报", period: text(row.period ?? row.weekLabel), metrics,
    commentary: text(row.commentary ?? row.aiCommentary), suggestions: Array.isArray(rawSuggestions) ? rawSuggestions.map(text).filter(Boolean) : [], posterAvailable: row.posterAvailable === true };
}
export const statsApi = {
  overview: async () => projectStats(await getMobileHttp().request<unknown>({ method: "GET", path: `${root}/stats/overview` })),
  heatmap: async (year: number) => { if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("年份无效"); return projectHeatmap(await getMobileHttp().request<unknown>({ method: "GET", path: `${root}/stats/heatmap`, query: { year } })); },
  latest: async () => projectReport(await getMobileHttp().request<unknown>({ method: "GET", path: `${root}/reports/latest` })),
  poster: (id: string) => getMobileHttp().request<unknown>({ method: "GET", path: `${root}/reports/${validId(id, "报告")}/poster` }),
};

export interface FormulaCard { id: string; name: string; latex: string; domain: string; tier: number | null; proofStatus: number | null; condition: string; quality: string }
export function projectFormulas(value: unknown): FormulaCard[] {
  return list(value, "items", "formulas", "records", "list").map(raw => {
    const row = record(raw), id = text(row.id ?? row.formulaId); validId(id, "公式");
    return { id, name: text(row.name), latex: text(row.latex), domain: text(row.domain), tier: number(row.tier), proofStatus: number(row.proofStatus ?? row.proof_status),
      condition: text(row.conditionsSummary ?? row.conditionSummary ?? record(row.conditions).summary ?? row.conditions), quality: text(row.quality) };
  });
}
export interface FormulaDetail extends FormulaCard { origin: string; symbols: { symbol: string; meaning: string; range: string }[]; applications: string[]; conditions: string; relations: { id: string; name: string; type: string }[]; legalForms: string[]; errorForms: { formula: string; reason: string }[]; derivations: { id: string; title: string; quality: string }[]; drillTypes: ("condition"|"variant"|"apply")[] }
export function projectFormula(value: unknown, derivationValue: unknown): FormulaDetail {
  const row = record(value);
  if (!Object.keys(row).length) throw new Error("公式详情尚未发布");
  const base = projectFormulas([row])[0];
  const rawSymbols = row.symbols;
  const symbols = Array.isArray(rawSymbols) ? rawSymbols.map(raw => { const s = record(raw); return { symbol: text(s.symbol), meaning: text(s.meaning), range: text(s.rangeNote ?? s.range_note) }; }).filter(s => s.symbol) : [];
  const rawApplications = row.applications;
  const applications = Array.isArray(rawApplications) ? rawApplications.map(item => typeof item === "string" ? item : text(record(item).title ?? record(item).description)).filter(Boolean) : text(rawApplications) ? [text(rawApplications)] : [];
  const rawRelations = row.relations;
  const relations = Array.isArray(rawRelations) ? rawRelations.map(item => { const r = record(item); return { id: text(r.toId ?? r.formulaId ?? r.id), name: text(r.name ?? r.title), type: text(r.relType ?? r.type) }; }).filter(r => r.id && r.name) : [];
  const variants = record(row.variants);
  const rawLegal = variants.legal_forms ?? variants.legalForms;
  const legalForms = Array.isArray(rawLegal) ? rawLegal.map(item => typeof item === "string" ? item : text(record(item).latex ?? record(item).formula)).filter(Boolean) : [];
  const rawErrors = variants.error_forms ?? variants.errorForms;
  const errorForms = Array.isArray(rawErrors) ? rawErrors.map(item => { const r = record(item); return { formula: text(r.latex ?? r.formula), reason: text(r.reason) }; }).filter(item => item.formula) : [];
  const rawPaths = derivationValue == null ? [] : list(derivationValue, "items", "paths");
  const derivations = rawPaths.map(item => { const d = record(item); return { id: text(d.id ?? d.pathId), title: text(d.title ?? d.name), quality: text(d.quality) }; }).filter(item => item.id && item.title);
  const conditions = text(row.conditionsSummary ?? row.conditionSummary ?? row.conditions ?? record(row.conditions).summary);
  const available = row.availableDrillTypes ?? row.drillTypes;
  const drillTypes = Array.isArray(available) ? available.filter((item): item is "condition"|"variant"|"apply" => item === "condition" || item === "variant" || item === "apply") : [];
  return { ...base, origin: text(row.origin), symbols, applications, conditions, relations, legalForms, errorForms, derivations, drillTypes };
}
export const formulaApi = {
  list: async (query: { search?: string; domain?: string; tier?: number; page?: number; size?: number }) => projectFormulas(await getMobileHttp().request<unknown>({ method: "GET", path: `${root}/formulas`, query })),
  detail: async (id: string, includePaths = true) => { const key = validId(id, "公式"); const [detail, paths] = await Promise.all([
    getMobileHttp().request<unknown>({ method: "GET", path: `${root}/formulas/${key}` }),
    includePaths ? getMobileHttp().request<unknown>({ method: "GET", path: `${root}/formulas/${key}/paths` }).catch(() => null) : Promise.resolve(null),
  ]); return projectFormula(detail, paths); },
  drill: async (id: string, type: "condition" | "variant" | "apply") => {
    const row = record(await getMobileHttp().request<unknown>({ method: "POST", path: `${root}/formulas/${validId(id, "公式")}/drill`, body: { type, count: 1 } }));
    const attemptId = text(row.attemptId ?? record(row.attempt).id);
    return validId(attemptId, "作答");
  },
};
