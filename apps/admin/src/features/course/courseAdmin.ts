/**
 * 课程/课时管理纯逻辑（17A05/06 · 20 §2 BR-02 发布校验镜像；可单测）。
 * 权威边界：课时完成判定=后端 LessonCompletionPolicy；本模块为**发布前阻断清单**（同口径文案）。
 */

export type LessonType = "article" | "video";

export interface LessonDraft {
  title: string;
  type: LessonType;
  content: string;
  videoUrl: string;
  completionPolicy: "practice_required" | "read_only";
  objectiveCount: number; // 关联随堂练客观题数
  passRate: number;       // 0..100（practice_required 阈值）
  durationSec: number;
  readOnlyConfirmed?: boolean; // read_only 须管理端发布时确认（BR-02）
}

export const PASS_RATE_MIN = 80;
export const PASS_RATE_MAX = 100;

/** 发布阻断清单（空=可发布；文案与后端 publishBlocker 对齐）。 */
export function publishBlockers(l: LessonDraft): string[] {
  const errs: string[] = [];
  if (!l.title || !l.title.trim()) {
    errs.push("课时标题不能为空");
  }
  if (l.durationSec < 0) {
    errs.push("时长不能为负数");
  }
  if (l.type === "article") {
    if (!l.content || !l.content.trim()) {
      errs.push("图文课时正文不能为空");
    }
  } else {
    const u = (l.videoUrl || "").trim();
    if (!u) {
      errs.push("视频课时必须填写外链地址");
    } else if (!isHttpsUrl(u)) {
      errs.push("视频外链必须是合法的 https 地址（C-06 外链域校验）");
    }
  }
  if (l.completionPolicy === "practice_required") {
    if (l.objectiveCount <= 0) {
      // 后端同文案（B-11 publishBlocker）
      errs.push("无客观题的课时不能设 practice_required（BR-02：请改 read_only）");
    }
    if (l.passRate < PASS_RATE_MIN || l.passRate > PASS_RATE_MAX) {
      errs.push(`随堂达标阈值须在 ${PASS_RATE_MIN}-${PASS_RATE_MAX}%`);
    }
  }
  if (l.completionPolicy === "read_only" && !l.readOnlyConfirmed) {
    errs.push("read_only 课时须在发布时显式确认（BR-02：管理端发布确认）");
  }
  return errs;
}

export function publishDecision(l: LessonDraft, readOnlyConfirmed: boolean): { ok: boolean; blockers: string[] } {
  const merged: LessonDraft = { ...l, readOnlyConfirmed };
  const blockers = publishBlockers(merged);
  return { ok: blockers.length === 0, blockers };
}

/** practice_required 但无客观题的即时提示（表单侧红字，提交前）。 */
export function policyInlineHint(l: LessonDraft): string | null {
  if (l.completionPolicy === "practice_required" && l.objectiveCount <= 0) {
    return "该课时没有客观题：无有效题不允许「分母为 0」得 100% —— 改 read_only 或绑定随堂练";
  }
  return null;
}

function isHttpsUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

// ---------- 章节排序（↑↓ / 拖拽落位的纯函数） ----------

/** 上移/下移：越界保持原序（返回新数组不改入参）。 */
export function moveChapter<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const arr = [...(list ?? [])];
  const target = index + dir;
  if (index < 0 || index >= arr.length || target < 0 || target >= arr.length) {
    return arr;
  }
  const tmp = arr[index];
  arr[index] = arr[target];
  arr[target] = tmp;
  return arr;
}

/** 章节行序号文案："3 / 8"。 */
export function orderLabel(index: number, total: number): string {
  if (total <= 0) {
    return "0 / 0";
  }
  return `${Math.min(Math.max(1, index + 1), total)} / ${total}`;
}

/** 课程状态徽标。 */
export function courseStatusBadge(status: "published" | "draft" | "offline"): { label: string; cls: string } {
  switch (status) {
    case "published":
      return { label: "上架", cls: "gr" };
    case "draft":
      return { label: "草稿", cls: "warn" };
    default:
      return { label: "下架", cls: "grey" };
  }
}
