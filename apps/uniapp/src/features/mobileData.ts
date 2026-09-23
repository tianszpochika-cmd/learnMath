const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const stringValue = (value: unknown): string => typeof value === "string" ? value.trim() : "";
export const numberValue = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
export function arrayValue(value: unknown, ...keys: string[]): unknown[] | null {
  if (Array.isArray(value)) return value;
  const source = object(value);
  for (const key of keys) {
    if (Array.isArray(source[key])) return source[key] as unknown[];
    const nested = object(source[key]);
    if (Array.isArray(nested.items)) return nested.items;
  }
  return null;
}
export function displayError(cause: unknown): string { return cause instanceof Error ? cause.message : "暂时无法读取，请检查网络后重试。"; }

export interface MobileTask { id: string; title: string; done: boolean | null; minutes: number | null; refType: string; refId: number | null }
export function projectTasks(value: unknown): MobileTask[] | null {
  const list = arrayValue(value, "todayTasks", "tasks", "items");
  if (list === null) return null;
  const projected = list.map((entry) => {
    const row = object(entry);
    const id = stringValue(row.id ?? row.taskId) || String(numberValue(row.id ?? row.taskId) ?? "");
    const title = stringValue(row.title) || stringValue(row.name);
    if (!id || !title) return null;
    const status = row.completed ?? row.done ?? row.status;
    const done = typeof status === "boolean" ? status : status === 1 || status === "completed" || status === "done" ? true : status === 0 || status === "pending" ? false : null;
    return { id, title,
      done, minutes: numberValue(row.estimateMinutes ?? row.minutes), refType: stringValue(row.refType ?? row.ref_type), refId: numberValue(row.refId ?? row.ref_id) };
  });
  return projected.some((row) => row === null) ? null : projected as MobileTask[];
}
export interface MobileProfile { nickname: string; avatarUrl: string; points: number | null; rank: string; level: string; unreadCount: number | null }
export function projectProfile(value: unknown): MobileProfile | null {
  const source = object(value);
  const row = Object.keys(object(source.profile)).length ? object(source.profile) : source;
  if (!Object.keys(row).length) return null;
  return { nickname: stringValue(row.nickname) || stringValue(row.username), avatarUrl: stringValue(row.avatarUrl ?? row.avatar),
    points: numberValue(row.points), rank: stringValue(row.rankName ?? row.rank ?? row.stageRank),
    level: stringValue(row.levelName ?? row.level), unreadCount: numberValue(row.unreadCount ?? row.unread) };
}
export interface MobileCourse { id: number; title: string; progress: number | null; nextLesson: string }
export function projectCourses(value: unknown): MobileCourse[] | null {
  const list = arrayValue(value, "courses", "learningCourses", "currentCourses");
  if (list === null) return null;
  const projected = list.map((entry) => {
    const row = object(entry);
    const id = numberValue(row.id ?? row.courseId);
    const title = stringValue(row.title ?? row.name);
    if (id === null || id < 1 || !title) return null;
    return { id, title,
      progress: numberValue(row.progress ?? row.progressPercent), nextLesson: stringValue(row.nextLessonTitle ?? row.currentLessonTitle) };
  });
  return projected.some((row) => row === null) ? null : projected as MobileCourse[];
}
export interface MobilePath { code: string; name: string; description: string; progress: number | null; status: string; recommended: boolean }
export function projectPaths(value: unknown): MobilePath[] | null {
  const list = arrayValue(value, "paths", "items", "list");
  if (list === null) return null;
  const projected = list.map((entry) => {
    const row = object(entry);
    const code = stringValue(row.code);
    const name = stringValue(row.name ?? row.title);
    if (!/^P[1-6]$/.test(code) || !name) return null;
    return { code, name,
      description: stringValue(row.description ?? row.subtitle), progress: numberValue(row.progress ?? row.progressPercent),
      status: stringValue(row.status), recommended: row.recommended === true };
  });
  return projected.some((row) => row === null) ? null : projected as MobilePath[];
}
export interface MobilePost { id: number; title: string; content: string; author: string; replies: number | null; status: string; topic: string }
export function projectPosts(value: unknown): MobilePost[] | null {
  const list = arrayValue(value, "items", "posts", "records", "list");
  if (list === null) return null;
  const projected = list.map((entry) => {
    const row = object(entry);
    const id = numberValue(row.id ?? row.postId);
    if (id === null || id < 1) return null;
    return { id, title: stringValue(row.title), content: stringValue(row.content ?? row.body),
      author: stringValue(row.authorName ?? object(row.author).nickname), replies: numberValue(row.replyCount ?? row.replies),
      status: typeof row.status === "number" ? String(row.status) : stringValue(row.status), topic: stringValue(row.topicName ?? row.topic) };
  });
  return projected.some((row) => row === null) ? null : projected as MobilePost[];
}
export function projectTotal(value: unknown): number | null {
  const row = object(value);
  return numberValue(row.total ?? row.totalCount);
}
export function projectCheckin(value: unknown): { checked: boolean | null; streak: number | null } | null {
  const row = object(value);
  if (!Object.keys(row).length) return null;
  const checkedRaw = row.checkedToday ?? row.todayChecked ?? row.checked;
  return { checked: typeof checkedRaw === "boolean" ? checkedRaw : null,
    streak: numberValue(row.streak ?? row.consecutiveDays) };
}
