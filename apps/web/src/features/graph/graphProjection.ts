import { graphColorOf, type GraphColor, type Narrative } from "./graphUi";

export interface GraphNode {
  id: number;
  name: string;
  description: string;
  locked: boolean | null;
  preparing: boolean | null;
  score: number | null | undefined;
  insufficientSample: boolean | null;
}
export interface GraphEdge { from: number; to: number }
export interface GraphData { nodes: GraphNode[]; edges: GraphEdge[] }
export interface PositionedNode extends GraphNode { x: number; y: number }
export interface GraphLayout { nodes: PositionedNode[]; height: number }
export interface PublishedNarrative { version: number; cards: Narrative; missing: string[] }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function idOf(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}
function words(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** 03 knowledge_node/mastery 字段；缺锁态或证据状态时保留 null，不能当作已解锁。 */
export function graphNode(value: unknown): GraphNode | null {
  if (!record(value)) return null;
  const id = idOf(value.id);
  const name = words(value.name);
  if (!id || !name) return null;
  const score = value.score === null ? null
    : typeof value.score === "number" && Number.isFinite(value.score) && value.score >= 0 && value.score <= 100
      ? value.score : undefined;
  return {
    id, name, description: words(value.description),
    locked: typeof value.locked === "boolean" ? value.locked : null,
    preparing: typeof value.preparing === "boolean" ? value.preparing : null,
    score, insufficientSample: typeof value.insufficientSample === "boolean" ? value.insufficientSample : null,
  };
}

/** 图谱节点+边必须来自同一响应；边按 03 knowledge_edge 字段识别。 */
export function graphData(value: unknown): GraphData | null {
  if (!record(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null;
  const nodes = value.nodes.map(graphNode);
  if (nodes.some((node) => node === null)) return null;
  const ids = new Set((nodes as GraphNode[]).map((node) => node.id));
  const edges: GraphEdge[] = [];
  for (const edge of value.edges) {
    if (!record(edge)) return null;
    const from = idOf(edge.from_id);
    const to = idOf(edge.to_id);
    if (!from || !to) return null;
    if (ids.has(from) && ids.has(to)) edges.push({ from, to });
  }
  return { nodes: nodes as GraphNode[], edges };
}

export function verifiedColor(node: GraphNode): GraphColor | "unverified" {
  if (node.locked === null || node.preparing === null || node.score === undefined || node.insufficientSample === null) return "unverified";
  return graphColorOf({
    id: node.id, name: node.name, locked: node.locked, preparing: node.preparing,
    score: node.score, insufficientSample: node.insufficientSample,
  });
}

/** 位置仅由返回节点的排序推导；不把 fixture 坐标当知识关系。 */
export function layoutGraph(nodes: GraphNode[]): GraphLayout {
  const columns = 3;
  const rows = Math.ceil(nodes.length / columns);
  const height = Math.max(420, rows * 120 + 80);
  return {
    height,
    nodes: nodes.map((node, index) => ({
      ...node,
      x: 140 + (index % columns) * 270,
      y: 70 + Math.floor(index / columns) * 120,
    })),
  };
}

/** 无已发布版本时即使响应里出现工作稿字段也不向学员呈现。 */
export function publishedNarrative(value: unknown): PublishedNarrative | null {
  if (!record(value)) return null;
  const version = idOf(value.publishedVersion);
  if (!version) return null;
  const source = record(value.published_snapshot) ? value.published_snapshot : value;
  const cards: Narrative = {
    origin: words(source.origin), prototype: words(source.prototype),
    capability: words(source.capability), ladder: words(source.ladder),
  };
  const missing = Array.isArray(value.missingCards)
    ? value.missingCards.filter((item): item is string => typeof item === "string")
    : [];
  return { version, cards, missing };
}

/** 04 §8.1 练习创建回执；没有 attemptId 不构造作答跳转。 */
export function practiceAttemptId(value: unknown): number | null {
  return record(value) ? idOf(value.attemptId) : null;
}
