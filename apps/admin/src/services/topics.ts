import { getAdminHttp } from "./client";

type Obj = Record<string, unknown>;
const obj = (value: unknown): Obj => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const str = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const id = (value: unknown): string => {
  const result = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : str(value);
  return /^[a-zA-Z0-9_-]{1,80}$/.test(result) ? result : "";
};
const rev = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

export interface TopicSummary { id: string; title: string; status: string }
export interface TopicNode { id: string; type: string; refId: string; title: string }
export interface TopicDetail extends TopicSummary { nodes: TopicNode[]; nodesKnown: boolean; revision: number | null }

function items(value: unknown): unknown[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  const source = obj(value);
  if (Array.isArray(source.items)) return source.items;
  if (Array.isArray(source.topics)) return source.topics;
  throw new Error("服务端专题列表格式暂不可识别");
}
export function projectTopics(value: unknown): TopicSummary[] {
  return items(value).map((raw): TopicSummary | null => {
    const source = obj(raw);
    const key = id(source.id ?? source.topicId);
    return key ? { id: key, title: str(source.title) || "未命名专题", status: str(source.status) } : null;
  }).filter((item): item is TopicSummary => item !== null);
}
export function projectTopic(value: unknown): TopicDetail {
  const source = obj(value);
  const key = id(source.id ?? source.topicId);
  if (!key) throw new Error("服务端专题详情缺少编号");
  const rawNodes = Array.isArray(source.topicNodes) ? source.topicNodes : source.nodes;
  const nodesReturned = Array.isArray(rawNodes);
  const nodes = nodesReturned ? (rawNodes as unknown[]).map((raw): TopicNode | null => {
    const node = obj(raw);
    const nodeId = id(node.id ?? node.topicNodeId);
    const refId = id(node.refId ?? node.resourceId);
    return nodeId ? { id: nodeId, type: str(node.type ?? node.refType), refId, title: str(node.title) || `${str(node.type ?? node.refType) || "资源"} ${refId || "未绑定"}` } : null;
  }).filter((node): node is TopicNode => node !== null) : [];
  const nodesKnown = nodesReturned && nodes.length === (rawNodes as unknown[]).length;
  return { id: key, title: str(source.title), status: str(source.status), revision: rev(source.revision), nodesKnown, nodes };
}
export function moveTopicNode(nodes: TopicNode[], index: number, delta: -1 | 1): TopicNode[] {
  const to = index + delta;
  if (index < 0 || index >= nodes.length || to < 0 || to >= nodes.length) return [...nodes];
  const copy = [...nodes];
  [copy[index], copy[to]] = [copy[to], copy[index]];
  return copy;
}
export function topicDraftIssues(draft: TopicDetail): string[] {
  const issues: string[] = [];
  if (!draft.title.trim()) issues.push("请填写专题名称");
  if (!draft.nodesKnown) issues.push("服务端未返回专题节点序列，无法安全保存顺序");
  if (draft.nodes.some((node) => !node.id || !node.type || !node.refId)) issues.push("节点缺少身份、类型或资源引用");
  if (new Set(draft.nodes.map((node) => node.id)).size !== draft.nodes.length) issues.push("节点身份重复");
  return issues;
}
function path(topicId: string): string {
  const safe = id(topicId);
  if (!safe) throw new Error("专题编号无效");
  return `/api/admin/v1/topics/${safe}`;
}
export async function readTopics(): Promise<TopicSummary[]> {
  return projectTopics(await getAdminHttp().request<unknown>({ method: "GET", path: "/api/admin/v1/topics" }));
}
export async function readTopic(topicId: string): Promise<TopicDetail> {
  return projectTopic(await getAdminHttp().request<unknown>({ method: "GET", path: path(topicId) }));
}
export async function saveTopic(draft: TopicDetail): Promise<void> {
  const issues = topicDraftIssues(draft);
  if (issues.length) throw new Error(issues.join("；"));
  await getAdminHttp().request<unknown>({ method: "PATCH", path: path(draft.id), body: {
    title: draft.title.trim(),
    topicNodes: draft.nodes.map((node, index) => ({ id: node.id, type: node.type, refId: node.refId, sortOrder: index + 1 })),
    ...(draft.revision === null ? {} : { expectedRevision: draft.revision }),
  } });
}
