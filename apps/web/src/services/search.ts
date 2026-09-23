import type { SearchDoc, SearchGroup } from "../features/ai/aiPanel";
import { getAppHttp } from "./client";

const names: Record<SearchDoc["type"], string> = { node: "知识点", formula: "公式", question: "题目", course: "课程", post: "帖子" };
const order: SearchDoc["type"][] = ["node", "formula", "question", "course", "post"];
const validType = (value: unknown): value is SearchDoc["type"] => typeof value === "string" && value in names;
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";

/** 搜索排序和命中由服务端决定；前端仅校验安全的类型、数字 ID 与可见标题。 */
export function projectSearch(value: unknown): SearchGroup[] {
  const source = object(value);
  const raw = Array.isArray(value) ? value : Array.isArray(source.items) ? source.items : Array.isArray(source.results) ? source.results : [];
  const docs: SearchDoc[] = raw.map((entry): SearchDoc | null => {
    const item = object(entry);
    const id = Number(item.id);
    const type = item.type;
    const name = text(item.name ?? item.title);
    return validType(type) && Number.isSafeInteger(id) && id > 0 && name ? { type, id, name, sub: text(item.sub ?? item.summary) } : null;
  }).filter((item): item is SearchDoc => item !== null);
  return order.map((type) => ({ key: type, label: names[type], items: docs.filter((doc) => doc.type === type), total: docs.filter((doc) => doc.type === type).length })).filter((group) => group.total > 0);
}

export async function searchAll(query: string): Promise<SearchGroup[]> {
  const q = query.trim();
  if (!q) return [];
  return projectSearch(await getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/search", query: { q, type: "all" } }));
}
