/** 目前只读取 03 §T06-T08 已定义的实体字段和 04 §1 已定义的分页外壳。 */
export interface CoursePreview {
  id: string;
  title: string;
  description?: string;
}

export interface LessonReading {
  title: string;
  content: string;
  videoUrl?: string;
  completionPolicy?: "practice_required" | "read_only";
}

export interface ReadReceipt {
  readCompleted: boolean;
  lessonCompleted: boolean;
  practicePassed: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveId(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value);
  return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text)) ? text : null;
}

export function coursePreview(value: unknown): CoursePreview | null {
  if (!isRecord(value)) return null;
  const id = positiveId(value.id);
  const title = typeof value.title === "string" ? value.title.trim() : "";
  if (!id || !title) return null;
  return {
    id,
    title,
    ...(typeof value.description === "string" && value.description.trim()
      ? { description: value.description.trim() }
      : {}),
  };
}

export function courseList(value: unknown): { items: CoursePreview[]; total: number } | null {
  if (!isRecord(value) || !Array.isArray(value.items) || typeof value.total !== "number" || !Number.isSafeInteger(value.total) || value.total < 0) return null;
  const items = value.items.map(coursePreview);
  if (items.some((item) => item === null)) return null;
  return { items: items as CoursePreview[], total: value.total };
}

export function lessonReading(value: unknown): LessonReading | null {
  if (!isRecord(value)) return null;
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const content = typeof value.content === "string" ? value.content.trim() : "";
  if (!title || !content) return null;
  const videoUrl = typeof value.video_url === "string" && /^https:\/\//i.test(value.video_url)
    ? value.video_url
    : undefined;
  const completionPolicy = value.completion_policy === "practice_required" || value.completion_policy === "read_only"
    ? value.completion_policy
    : undefined;
  return { title, content, ...(videoUrl ? { videoUrl } : {}), ...(completionPolicy ? { completionPolicy } : {}) };
}

/** 04 §4.3 唯一明确命名的课时回执字段；缺少任何布尔字段均不可当成成功。 */
export function readReceipt(value: unknown): ReadReceipt | null {
  if (!isRecord(value)) return null;
  if (typeof value.readCompleted !== "boolean"
    || typeof value.lessonCompleted !== "boolean"
    || typeof value.practicePassed !== "boolean") return null;
  if (value.lessonCompleted && !value.readCompleted) return null;
  return {
    readCompleted: value.readCompleted,
    lessonCompleted: value.lessonCompleted,
    practicePassed: value.practicePassed,
  };
}
