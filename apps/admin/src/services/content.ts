import { getAdminHttp } from "./client";
import type { TreeNodeAdmin, DepEdge } from "../features/knowledge/knowledgeAdmin";
import type { LessonDraft } from "../features/course/courseAdmin";

type Data = Record<string, unknown>;
const BASE = "/api/admin/v1";
const record = (value: unknown): Data => value && typeof value === "object" && !Array.isArray(value) ? value as Data : {};
const text = (value: unknown): string => typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
const finite = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const safeInt = (value: unknown): number | null => { const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN; return Number.isSafeInteger(n) && n >= 0 ? n : null; };
const idPath = (value: string): string => { if (!/^[a-zA-Z0-9-]{1,80}$/.test(value)) throw new Error("无效的管理记录编号"); return value; };

function list(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const source = record(value);
  for (const key of keys) if (Array.isArray(source[key])) return source[key] as unknown[];
  throw new Error("管理服务未返回可读取的列表结构");
}

export interface AdminOverview { dau: number | null; newUsers: number | null; retention: number | null; answers: number | null; accuracy: number | null }
export function projectOverview(value: unknown): AdminOverview {
  const source = record(value);
  return {
    dau: finite(source.dau ?? source.dailyActiveUsers),
    newUsers: finite(source.newUsers ?? source.new_users),
    retention: finite(source.retention ?? source.retentionRate),
    answers: finite(source.answers ?? source.answerCount ?? source.questionCount),
    accuracy: finite(source.accuracy ?? source.accuracyRate),
  };
}
export const readOverview = async (): Promise<AdminOverview> => projectOverview(await getAdminHttp().request<unknown>({ method: "GET", path: BASE + "/stats/overview" }));

function nodeStatus(value: unknown): TreeNodeAdmin["status"] {
  if (value === 1 || value === "published" || value === "online") return "published";
  if (value === 2 || value === "offline") return "offline";
  if (value === 3 || value === "draft") return "draft";
  throw new Error("管理服务返回了无法识别的发布状态");
}
export function projectKnowledgeTree(value: unknown): TreeNodeAdmin[] {
  const roots = list(value, ["tree", "nodes", "items"]);
  const output: TreeNodeAdmin[] = [];
  const seen = new Set<number>();
  function walk(raw: unknown, parent: number | null, depth: number) {
    if (depth > 30) throw new Error("知识点层级超过可安全展示的范围");
    const source = record(raw);
    const id = safeInt(source.id);
    const name = text(source.name ?? source.title);
    if (id === null || id === 0 || !name || seen.has(id)) throw new Error("知识点树含缺失或重复的节点编号/名称");
    seen.add(id);
    const children = Array.isArray(source.children) ? source.children : [];
    const parentId = parent ?? safeInt(source.parentId ?? source.parent_id);
    output.push({ id, parentId: parentId === 0 ? null : parentId, title: name, status: nodeStatus(source.status), childrenCount: children.length || safeInt(source.childrenCount) || 0 });
    children.forEach((child) => walk(child, id, depth + 1));
  }
  roots.forEach((root) => walk(root, null, 0));
  const directChildren = new Map<number, number>();
  for (const node of output) if (node.parentId !== null) directChildren.set(node.parentId, (directChildren.get(node.parentId) ?? 0) + 1);
  for (const node of output) node.childrenCount = Math.max(node.childrenCount, directChildren.get(node.id) ?? 0);
  return output;
}
export const readKnowledgeTree = async (): Promise<TreeNodeAdmin[]> => projectKnowledgeTree(await getAdminHttp().request<unknown>({ method: "GET", path: BASE + "/knowledge/tree" }));
export const deleteKnowledgeNode = async (id: number): Promise<void> => { await getAdminHttp().request<unknown>({ method: "DELETE", path: BASE + "/knowledge/nodes/" + idPath(String(id)) }); };

export interface AdminEdge extends DepEdge { id: string | null }
export function projectEdges(value: unknown): AdminEdge[] {
  return list(value, ["edges", "items"]).map((raw) => {
    const source = record(raw);
    const from = safeInt(source.fromId ?? source.from_id ?? source.from);
    const to = safeInt(source.toId ?? source.to_id ?? source.to);
    if (!from || !to) throw new Error("管理服务返回了无效的依赖边");
    const id = text(source.id);
    return { id: id || null, from, to };
  });
}
export const readEdges = async (): Promise<AdminEdge[]> => projectEdges(await getAdminHttp().request<unknown>({ method: "GET", path: BASE + "/knowledge/edges" }));
export const addEdge = async (fromId: number, toId: number): Promise<void> => { await getAdminHttp().request<unknown>({ method: "POST", path: BASE + "/knowledge/edges", body: { fromId, toId } }); };
export const deleteEdge = async (id: string): Promise<void> => { await getAdminHttp().request<unknown>({ method: "DELETE", path: BASE + "/knowledge/edges/" + idPath(id) }); };
export const readGraphHealth = async (): Promise<Data> => record(await getAdminHttp().request<unknown>({ method: "GET", path: BASE + "/knowledge/validate" }));

export interface AdminCourse { id: string; title: string; status: "published" | "offline" | "draft"; chapterCount: number | null; lessonCount: number | null; updatedAt: string }
export function projectCourses(value: unknown): { items: AdminCourse[]; total: number | null } {
  const source = record(value);
  const items = list(value, ["items", "records", "courses"]).map((raw) => {
    const course = record(raw);
    const id = text(course.id), title = text(course.title);
    if (!id || !title) throw new Error("管理服务返回了不完整的课程记录");
    return { id, title, status: nodeStatus(course.status), chapterCount: finite(course.chapterCount), lessonCount: finite(course.lessonCount), updatedAt: text(course.updatedAt ?? course.updated_at) };
  });
  return { items, total: finite(source.total) };
}
export const readCourses = async (page: number, keyword: string, status: string): Promise<{ items: AdminCourse[]; total: number | null }> => projectCourses(await getAdminHttp().request<unknown>({ method: "GET", path: BASE + "/courses", query: { page, size: 20, keyword: keyword || undefined, status: status || undefined } }));

export interface AdminChapter { id: string; title: string; parentId: string | null; sort: number | null; lessons: Array<{ id: string; title: string }> }
export function projectChapters(value: unknown): AdminChapter[] {
  const source = record(value);
  const raw = list(value, ["chapters", "tree", "items", "records"]);
  return raw.map((entry) => {
    const chapter = record(entry);
    const id = text(chapter.id), title = text(chapter.title);
    if (!id || !title) throw new Error("章节记录缺少编号或标题");
    const lessons = Array.isArray(chapter.lessons) ? chapter.lessons.map((lesson) => record(lesson)).map((lesson) => ({ id: text(lesson.id), title: text(lesson.title) })).filter((lesson) => lesson.id && lesson.title) : [];
    return { id, title, parentId: text(chapter.parentId ?? chapter.parent_id) || null, sort: finite(chapter.sort), lessons };
  });
}
export const readCourseDetail = async (id: string): Promise<{ title: string; chapters: AdminChapter[] }> => {
  const safe = idPath(id);
  const [course, chapterData] = await Promise.all([
    getAdminHttp().request<unknown>({ method: "GET", path: BASE + "/courses/" + safe }),
    getAdminHttp().request<unknown>({ method: "GET", path: BASE + "/chapters", query: { courseId: safe } }),
  ]);
  const value = record(course);
  const title = text(value.title);
  if (!title) throw new Error("课程详情缺少标题");
  return { title, chapters: projectChapters(chapterData) };
};
export const moveChapterOnServer = async (id: string, parentId: string | null, sort: number): Promise<void> => {
  await getAdminHttp().request<unknown>({ method: "PATCH", path: BASE + "/chapters/" + idPath(id) + "/move", body: { parentId, sort } });
};

export interface AdminLesson { draft: LessonDraft; objectiveCountKnown: boolean; passRateKnown: boolean; revision: number | null }
export function projectLesson(value: unknown): AdminLesson {
  const source = record(value);
  const title = text(source.title);
  const type = source.type === 1 || source.type === "article" ? "article" : source.type === 2 || source.type === "video" ? "video" : null;
  const rawPolicy = source.completionPolicy ?? source.completion_policy;
  const completionPolicy = rawPolicy === 1 || rawPolicy === "practice_required" ? "practice_required" : rawPolicy === 2 || rawPolicy === "read_only" ? "read_only" : null;
  if (!title || !type || !completionPolicy) throw new Error("课时详情缺少标题、类型或完成策略，暂不可编辑");
  const objectiveCount = finite(source.objectiveCount);
  const rawRate = finite(source.passRate ?? source.pass_rate);
  const passRate = rawRate === null ? 80 : rawRate <= 1 ? rawRate * 100 : rawRate;
  const durationSec = finite(source.durationSec ?? source.duration);
  return { draft: { title, type, content: text(source.content), videoUrl: text(source.videoUrl ?? source.video_url), completionPolicy, objectiveCount: objectiveCount ?? 0, passRate, durationSec: durationSec ?? 0, readOnlyConfirmed: false }, objectiveCountKnown: objectiveCount !== null, passRateKnown: rawRate !== null, revision: finite(source.revision) };
}
export const readLesson = async (id: string): Promise<AdminLesson> => projectLesson(await getAdminHttp().request<unknown>({ method: "GET", path: BASE + "/lessons/" + idPath(id) }));
export const saveLesson = async (id: string, draft: LessonDraft): Promise<void> => {
  await getAdminHttp().request<unknown>({ method: "PATCH", path: BASE + "/lessons/" + idPath(id), body: {
    title: draft.title.trim(), type: draft.type, content: draft.type === "article" ? draft.content : null,
    videoUrl: draft.type === "video" ? draft.videoUrl.trim() : null, completionPolicy: draft.completionPolicy,
    ...(draft.completionPolicy === "practice_required" ? { passRate: draft.passRate / 100 } : {}), durationSec: draft.durationSec,
  } });
};
