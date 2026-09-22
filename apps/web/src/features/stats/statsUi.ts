/**
 * 统计看板 UI 纯逻辑（16W13 · 01 U-70 · 02 §7 后端 StatsAggregation 前端镜像；可单测）。
 * 口径同步：accuracy 除零 → null；环比 prev=0 → 不可用；画像 n<5 小样本；
 * 热力 60 分钟满级 5 档；null 率 → 0 半径（图上不可见但文本标"未测量"）。
 */

export interface DailyStat {
  minutes: number;
  questions: number;
  correct: number;
}

export interface Delta {
  pct: number | null;
  available: boolean;
}

export interface WeekSummary {
  totalMinutes: number;
  questions: number;
  accuracy: number | null;
  minutesDelta: Delta;
  questionsDelta: Delta;
  accuracyDelta: Delta;
}

/** 本周汇总（镜像后端 summarize）。 */
export function weekSummary(thisWeek: DailyStat[], lastWeek: DailyStat[]): WeekSummary {
  const sum = (list: DailyStat[]): { m: number; q: number; c: number } =>
    (list ?? []).reduce(
      (acc, d) => ({ m: acc.m + d.minutes, q: acc.q + d.questions, c: acc.c + d.correct }),
      { m: 0, q: 0, c: 0 },
    );
  const now = sum(thisWeek);
  const prev = sum(lastWeek);
  const accuracy = now.q === 0 ? null : (now.c / now.q) * 100;
  const prevAccuracy = prev.q === 0 ? null : (prev.c / prev.q) * 100;
  return {
    totalMinutes: now.m,
    questions: now.q,
    accuracy,
    minutesDelta: delta(now.m, prev.m),
    questionsDelta: delta(now.q, prev.q),
    accuracyDelta: deltaNullable(accuracy, prevAccuracy),
  };
}

/** 环比：prev≤0 → 不可用（不显示 0% / ∞）。 */
export function delta(now: number, prev: number): Delta {
  if (prev <= 0) {
    return { pct: null, available: false };
  }
  return { pct: ((now - prev) / prev) * 100, available: true };
}

/** 正确率环比给百分点差。 */
export function deltaNullable(now: number | null, prev: number | null): Delta {
  if (now === null || prev === null || prev === 0) {
    return { pct: null, available: false };
  }
  return { pct: now - prev, available: true };
}

/** 环比展示："—" / "+50%" / "−20%" / "+2.5pt"。 */
export function deltaView(d: Delta, asPoints = false): string {
  if (!d.available || d.pct === null) {
    return "—";
  }
  const rounded = Math.round(d.pct * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  const abs = Math.abs(rounded);
  return `${sign}${abs}${asPoints ? "pt" : "%"}`;
}

export function deltaTone(d: Delta): "up" | "down" | "flat" {
  if (!d.available || d.pct === null || d.pct === 0) {
    return "flat";
  }
  return d.pct > 0 ? "up" : "down";
}

// ---------- 推理画像（仅 observed 喂入的后端结果做展示） ----------

export interface ProfileInput {
  type: string;
  attempted: number;
  correct: number;
}

export interface ProfileEntryView {
  type: string;
  rate: number | null;
  smallSample: boolean;
}

const SMALL_SAMPLE = 5;

export function profileView(inputs: ProfileInput[]): ProfileEntryView[] {
  return (inputs ?? [])
    .map((p) => ({
      type: p.type,
      rate: p.attempted <= 0 ? null : (p.correct / p.attempted) * 100,
      smallSample: p.attempted < SMALL_SAMPLE,
    }))
    .sort((a, b) => a.type.localeCompare(b.type, "zh-Hans-CN"));
}

export function weakestProfile(entries: ProfileEntryView[]): ProfileEntryView | null {
  const candidates = (entries ?? []).filter((e) => e.rate !== null);
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((min, e) => (e.rate! < min.rate! ? e : min));
}

// ---------- 雷达（SVG 多边形，纯几何可测） ----------

/**
 * 雷达顶点串：从 -90° 起等角分布；value 0..100 → 半径比例；null → 中心点（不可见）。
 */
export function radarPoints(entries: ProfileEntryView[], cx: number, cy: number, radius: number): string {
  const n = Math.max(1, entries.length);
  return entries
    .map((e, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const ratio = (e.rate ?? 0) / 100;
      const x = cx + Math.cos(angle) * radius * ratio;
      const y = cy + Math.sin(angle) * radius * ratio;
      return `${round2(x)},${round2(y)}`;
    })
    .join(" ");
}

/** 轴端点（画轴线用）。 */
export function radarAxisTips(count: number, cx: number, cy: number, radius: number): Array<{ x: number; y: number }> {
  const n = Math.max(1, count);
  return Array.from({ length: n }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: round2(cx + Math.cos(angle) * radius), y: round2(cy + Math.sin(angle) * radius) };
  });
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ---------- 趋势折线（min-max 归一，全等 → 中线防除零） ----------

export function trendPoints(values: number[], width: number, height: number): string {
  const list = (values ?? []).filter((v) => Number.isFinite(v));
  if (list.length === 0) {
    return "";
  }
  const min = Math.min(...list);
  const max = Math.max(...list);
  const span = max - min;
  const stepX = list.length === 1 ? 0 : width / (list.length - 1);
  return list
    .map((v, i) => {
      const x = round2(i * stepX);
      // 全等（span=0）→ 画在中线，避免除零 NaN
      const ratio = span === 0 ? 0.5 : (v - min) / span;
      const y = round2(height - ratio * height);
      return `${x},${y}`;
    })
    .join(" ");
}

export function trendMaxMin(values: number[]): { max: number; min: number } {
  const list = (values ?? []).filter((v) => Number.isFinite(v));
  if (list.length === 0) {
    return { max: 0, min: 0 };
  }
  return { max: Math.max(...list), min: Math.min(...list) };
}

// ---------- 热力（同后端口径 5 档） ----------

export function heatLevel(minutes: number, cap = 60): number {
  if (minutes <= 0) {
    return 0;
  }
  if (minutes >= cap) {
    return 4;
  }
  return Math.min(4, Math.ceil(minutes / (cap / 4)));
}

export function heatMonth(dailyMinutes: number[], cap = 60): number[] {
  return (dailyMinutes ?? []).map((m) => heatLevel(m, cap));
}

// ---------- 错因分布 ----------

export interface MistakeItem {
  reason: string;
  count: number;
}

export interface MistakeSlice {
  reason: string;
  count: number;
  percent: number;
}

export function mistakeBreakdown(items: MistakeItem[]): MistakeSlice[] {
  const list = (items ?? []).filter((i) => i.count > 0);
  const total = list.reduce((s, i) => s + i.count, 0);
  if (total === 0) {
    return [];
  }
  return list
    .map((i) => ({ reason: i.reason, count: i.count, percent: Math.round((i.count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

// ---------- 导出 ----------

export function csvFilename(prefix: string, day: string): string {
  const safePrefix = (prefix || "learnmath").replace(/[^\w-]/g, "");
  const safeDay = (day || "").replace(/[^\d-]/g, "");
  return `${safePrefix}-${safeDay}.csv`;
}
