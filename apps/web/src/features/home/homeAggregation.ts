/**
 * 首页聚合映射（16W02 · 16 §5 打卡条 · 纯函数可单测；视图只做渲染接线）。
 * 数据来源：/me/home 聚合接口（04 §4.x）—— 联调前以 fixture 注入，映射逻辑先行锁口径。
 */

export interface TodayTask {
  id: string;
  title: string;
  subtitle?: string;
  done: boolean;
  route?: string;
}

export interface TaskProgress {
  total: number;
  done: number;
  percent: number;
  label: string;
}

/** 今日任务进度（01 §2 口径：完成数/总数；percent 四舍五入整数）。 */
export function taskProgress(tasks: TodayTask[]): TaskProgress {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, percent, label: `${done}/${total}` };
}

export function allTasksDone(tasks: TodayTask[]): boolean {
  return tasks.length > 0 && tasks.every((t) => t.done);
}

export function emptyTasksCopy(): string {
  return "今天还没有任务，去路径中心挑一条开始吧";
}

// ---------- 打卡条（16 §5 · 01 U-60/61） ----------

export interface CheckinState {
  todayChecked: boolean;
  streak: number;
}

export interface CheckinButton {
  label: string;
  disabled: boolean;
}

export function checkinButton(s: CheckinState): CheckinButton {
  if (s.todayChecked) {
    return { label: "✓ 已打卡", disabled: true };
  }
  return { label: "打卡", disabled: false };
}

export function streakText(streak: number): string {
  return `🔥 ${Math.max(0, streak)}`;
}

/** 打卡成功后的乐观展示态（真实入账以接口回执为准，失败回滚）。 */
export function afterCheckin(s: CheckinState): CheckinState {
  if (s.todayChecked) {
    return s;
  }
  return { todayChecked: true, streak: s.streak + 1 };
}

// ---------- 在学课程 ----------

export interface CourseNow {
  title: string;
  doneLessons: number;
  totalLessons: number;
  resumeRoute: string;
}

/** 进度环百分比（total=0 → 0，禁止除零）。 */
export function courseRingPercent(c: CourseNow): number {
  if (c.totalLessons <= 0) {
    return 0;
  }
  return Math.round((c.doneLessons / c.totalLessons) * 100);
}

export function coursePositionLabel(c: CourseNow): string {
  return `第 ${c.doneLessons}/${c.totalLessons} 课时`;
}

// ---------- 每日一练横幅 ----------

export interface DrillDue {
  wrong: number;
  weak: number;
}

export interface DrillBanner {
  total: number;
  breakdown: string;
}

/** due = 错题到期 + 薄弱点；文案如实（07/09 L4 口径：错题 3 · 薄弱点 2）。 */
export function drillBanner(d: DrillDue): DrillBanner {
  const wrong = Math.max(0, d.wrong);
  const weak = Math.max(0, d.weak);
  return {
    total: wrong + weak,
    breakdown: `错题 ${wrong} · 薄弱点 ${weak}`,
  };
}

// ---------- 学习热力（周） ----------

/** 分档：0 无 / 1-4 递增（默认 60 分钟满级，与后端 StatsAggregation.heatLevel 同口径）。 */
export function heatLevel(minutes: number, cap = 60): number {
  if (minutes <= 0) {
    return 0;
  }
  if (minutes >= cap) {
    return 4;
  }
  return Math.min(4, Math.ceil(minutes / (cap / 4)));
}

export function weekHeatLevels(dailyMinutes: number[], cap = 60): number[] {
  return (dailyMinutes ?? []).map((m) => heatLevel(m, cap));
}

// ---------- 路径推荐 ----------

export interface PathRec {
  title: string;
  subtitle: string;
  inProgress: boolean;
  percent: number;
  colorVar: string;
  route: string;
}

/** 推荐排序：进行中优先 → 进度降序 → 取前 N（稳定排序保证同输入同序）。 */
export function topPathRecs(list: PathRec[], n = 3): PathRec[] {
  const sorted = [...(list ?? [])].sort((a, b) => {
    if (a.inProgress !== b.inProgress) {
      return a.inProgress ? -1 : 1;
    }
    return b.percent - a.percent;
  });
  return sorted.slice(0, Math.max(0, n));
}

// ---------- 测评提示（20 §9：非阻塞） ----------

/** 首页是否展示测评 banner（登录落地已分流 modal/banner；首页只认标志位）。 */
export function assessmentBannerNeeded(needAssessment: boolean): boolean {
  return needAssessment;
}

/** banner 文案（有目标时的非阻塞提示）。 */
export function assessmentBannerCopy(): string {
  return "3 分钟定位你的起点 —— 也可跳过（不打断当前目标）";
}
