import { coursePositionLabel, courseRingPercent, type CourseNow } from "../home/homeAggregation";

/**
 * 课程树与完成展示（16W03/W04 · 01-D4 锁态 · 20 §2 BR-02 提示语前端镜像；纯函数）。
 * 注意：完成判定权威在服务端（LessonCompletionPolicy），本模块只做**展示映射**。
 */

export interface TreeNode {
  id: number;
  parentId: number | null;
  title: string;
  status: "published" | "draft" | "offline";
  locked?: boolean;
  lockReason?: string;
  lessons?: number;
  doneLessons?: number;
  isLesson?: boolean;
  current?: boolean;
}

export interface FlatNode {
  node: TreeNode;
  depth: number;
}

/** 展开态折叠集合（可变引用安全：返回新 Set）。 */
export function toggleExpand(collapsed: Set<number>, id: number): Set<number> {
  const next = new Set(collapsed);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/** 学生端可见性：仅 published（草稿/下架不出现在学员端，09 L6 同口径）。 */
export function visibleToStudent(node: TreeNode): boolean {
  return node.status === "published";
}

/**
 * 树 → 扁平列表（深度标注）：父不可见则整支隐藏；父折叠则子隐藏。
 */
export function flattenVisible(nodes: TreeNode[], collapsed: Set<number>): FlatNode[] {
  const byParent = new Map<number | null, TreeNode[]>();
  for (const n of nodes) {
    const key = n.parentId ?? null;
    if (!byParent.has(key)) {
      byParent.set(key, []);
    }
    byParent.get(key)!.push(n);
  }
  const out: FlatNode[] = [];
  const walk = (parent: number | null, depth: number): void => {
    const children = byParent.get(parent) ?? [];
    for (const n of children) {
      if (!visibleToStudent(n)) {
        continue;
      }
      out.push({ node: n, depth });
      if (n.isLesson !== true && !collapsed.has(n.id)) {
        walk(n.id, depth + 1);
      }
    }
  };
  walk(null, 0);
  return out;
}

/** 锁态标签（01-D4：锁图标 + 原因文案）。 */
export function lockLabel(node: TreeNode): { locked: boolean; text: string } {
  if (!node.locked) {
    return { locked: false, text: "" };
  }
  return { locked: true, text: node.lockReason || "前置条件未满足（3311）" };
}

/** 章节/课程摘要："8 课时 · 已完成 5 · 正确率 83%"。 */
export function chapterSummary(c: { lessons: number; done: number; accuracy?: number }): string {
  const base = `${c.lessons} 课时 · 已完成 ${c.done}`;
  if (c.accuracy === undefined) {
    return base;
  }
  return `${base} · 正确率 ${Math.round(c.accuracy)}%`;
}

/** 六路径行摘要（16W03 中心列表）。 */
export interface PathRow {
  code: "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
  name: string;
  desc: string;
  route: string;
  badge?: string;
}

export function pathCenterRows(): PathRow[] {
  return [
    { code: "P1", name: "系统课程", desc: "按部就班 · 进度环记路", route: "/paths/course/1", badge: "进行中" },
    { code: "P2", name: "知识图谱", desc: "自由漫游 · 颜色即掌握度", route: "/graph" },
    { code: "P3", name: "测评计划", desc: "定级 → 计划 → 动态调档", route: "/assessment/1", badge: "可测评" },
    { code: "P4", name: "阶梯刷题", desc: "L1→L5 · 80% 晋级", route: "/rank" },
    { code: "P5", name: "专题研习", desc: "数论/证明方法主题深钻", route: "/paths" },
    { code: "P6", name: "闯关挑战", desc: "关卡 · 星级 · 段位周榜", route: "/rank" },
  ];
}

// ---------- 课时完成展示（BR-02 前端镜像） ----------

export type CompletionStage = "not-read" | "practice-pending" | "practice-pass" | "read-only-done" | "already";

export interface CompletionInput {
  readConfirmed: boolean;
  policy: "practice_required" | "read_only";
  answeredAll: boolean;
  rate: number; // 0..100；未答传 -1
  alreadyCompleted: boolean;
}

/** 五态展示阶段（与 20 §2 矩阵同构；判定权威在服务端）。 */
export function completionStage(i: CompletionInput): CompletionStage {
  if (i.alreadyCompleted) {
    return "already";
  }
  if (!i.readConfirmed) {
    return "not-read";
  }
  if (i.policy === "read_only") {
    return "read-only-done";
  }
  if (!i.answeredAll || i.rate < 80) {
    return "practice-pending";
  }
  return "practice-pass";
}

/** 完成提示语（BR-02 关键句式：阅读已记录… / 不代表掌握）。 */
export function completionHint(stage: CompletionStage, i?: { answered: number; total: number; rate: number }): string {
  switch (stage) {
    case "not-read":
      return "请先确认已读完本课时（read_completed）";
    case "practice-pending": {
      const answered = i ? i.answered : 0;
      const total = i ? i.total : 0;
      const rate = i ? Math.max(0, Math.round(i.rate)) : 0;
      return `阅读已记录，完成随堂练后继续（${answered}/${total}，正确率 ${rate}% < 80%）`;
    }
    case "practice-pass":
      return "课时完成（随堂练达标）";
    case "read-only-done":
      return "阅读完成（read_only 策略；不代表掌握）";
    case "already":
      return "已完成（幂等返回原结果）";
  }
}

/** 首次完成奖励展示（服务端 +10 幂等；此处仅展示）。 */
export function completionReward(stage: CompletionStage): number {
  return stage === "practice-pass" || stage === "read-only-done" ? 10 : 0;
}

// ---------- 随堂练展示（右栏） ----------

export interface QuizQ {
  stem: string;
  options: string[];
  answerIndex: number;
}

export type OptionMark = "" | "right" | "wrong";

/** 作答后标记：正确项恒 right；用户选错项标 wrong（练习态展示，判分以服务端为准）。 */
export function optionMark(q: QuizQ, selectedIndex: number, answered: boolean): OptionMark {
  if (!answered) {
    return "";
  }
  if (selectedIndex === q.answerIndex) {
    return "right";
  }
  return "wrong";
}

export interface QuizSummary {
  label: string;
  passed: boolean;
}

/** 达标展示：全答且 ≥80%（BR-02 门槛展示；服务端权威）。 */
export function quizSummary(answered: number, total: number, correct: number): QuizSummary {
  if (total <= 0) {
    return { label: "无客观题", passed: false };
  }
  const rate = (correct / total) * 100;
  const passed = answered >= total && rate >= 80;
  return { label: `${answered}/${total} · 正确率 ${Math.round(rate)}%`, passed };
}

export type { CourseNow, CourseNow as Course };
export { coursePositionLabel, courseRingPercent };
