import { getAppHttp } from "./client";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const nonnegative = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const count = (value: unknown): number | null => {
  const n = nonnegative(value);
  return n !== null && Number.isInteger(n) ? n : null;
};
const percentage = (value: unknown): number | null => {
  const n = nonnegative(value);
  return n !== null && n <= 100 ? n : null;
};
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export interface DailyStat {
  date: string;
  minutes: number | null;
  questions: number | null;
  correct: number | null;
}
export interface ProfileStat {
  name: string;
  samples: number | null;
  ratePercent: number | null;
}
export interface MistakeStat { reason: string; count: number }
export interface StatsOverview {
  totalMinutes: number | null;
  questions: number | null;
  correct: number | null;
  accuracyPercent: number | null;
  daily: DailyStat[];
  profile: ProfileStat[];
  mistakes: MistakeStat[];
}
export interface HeatDay { date: string; minutes: number | null; level: number | null }

function explicitRate(correct: number | null, attempted: number | null, reported: unknown): number | null {
  if (attempted === 0) return null;
  if (attempted !== null && correct !== null) return correct <= attempted ? (correct / attempted) * 100 : null;
  return attempted !== null && attempted > 0 ? percentage(reported) : null;
}

/** 仅从服务端明确提供的计数/百分比投影；未知和零分母不写成 0%。 */
export function projectStatsOverview(value: unknown): StatsOverview {
  const source = obj(value);
  const summaryValue = source.week ?? source.weekSummary ?? source.summary;
  const summary = summaryValue === null || summaryValue === undefined ? source : obj(summaryValue);
  const questions = count(summary.questions ?? summary.questionCount);
  const correct = count(summary.correct);
  const totalMinutes = nonnegative(summary.totalMinutes);
  const rawDaily = list(source.daily ?? source.dailyTrend);
  const rawProfile = list(source.profile ?? source.masteryRadar);
  const rawMistakes = list(source.mistakes ?? source.mistakeReasons);
  return {
    totalMinutes,
    questions,
    correct,
    accuracyPercent: explicitRate(correct, questions, summary.accuracyPercent ?? summary.accuracy),
    daily: rawDaily.map((raw): DailyStat | null => {
      const day = obj(raw);
      const date = text(day.date);
      if (!datePattern.test(date)) return null;
      return {
        date,
        minutes: nonnegative(day.minutes),
        questions: count(day.questions),
        correct: count(day.correct),
      };
    }).filter((day): day is DailyStat => day !== null).sort((a, b) => a.date.localeCompare(b.date)),
    profile: rawProfile.map((raw): ProfileStat | null => {
      const item = obj(raw);
      const name = text(item.name ?? item.type ?? item.stepType);
      if (!name) return null;
      const samples = count(item.samples ?? item.attempted);
      return {
        name,
        samples,
        ratePercent: explicitRate(count(item.correct), samples, item.ratePercent ?? item.rate),
      };
    }).filter((item): item is ProfileStat => item !== null),
    mistakes: rawMistakes.map((raw): MistakeStat | null => {
      const item = obj(raw);
      const reason = text(item.reason);
      const amount = count(item.count);
      return reason && amount !== null ? { reason, count: amount } : null;
    }).filter((item): item is MistakeStat => item !== null),
  };
}

export function projectHeatmap(value: unknown): HeatDay[] {
  const source = obj(value);
  return list(Array.isArray(value) ? value : source.days ?? source.items).map((raw): HeatDay | null => {
    const day = obj(raw);
    const date = text(day.date);
    if (!datePattern.test(date)) return null;
    const rawLevel = nonnegative(day.level);
    return {
      date,
      minutes: nonnegative(day.minutes),
      level: rawLevel !== null && Number.isInteger(rawLevel) && rawLevel <= 4 ? rawLevel : null,
    };
  }).filter((day): day is HeatDay => day !== null).sort((a, b) => a.date.localeCompare(b.date));
}

export async function readStatsOverview(): Promise<StatsOverview> {
  return projectStatsOverview(await getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/stats/overview" }));
}
export async function readStatsHeatmap(year: number): Promise<HeatDay[]> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("统计年份无效");
  return projectHeatmap(await getAppHttp().request<unknown>({
    method: "GET", path: "/api/app/v1/stats/heatmap", query: { year },
  }));
}
