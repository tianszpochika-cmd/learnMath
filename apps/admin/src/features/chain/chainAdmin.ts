/** A12 editor projection. Ids identify existing steps; edge_from stores seq, so reorder remaps dependencies. */
export type Obj = Record<string, unknown>;
export interface ChainStep {
  id: number;
  seq: number;
  stepType: number;
  content: string;
  warrant: string;
  warrantNodes: number[];
  motive: string;
  offRamp: string;
  dependsOn: number[];
  prediction: unknown;
  raw: Obj;
}
export interface ChainPath {
  id: number;
  title: string;
  quality: number | null;
  status: number | null;
  workingRevision: number | null;
  steps: ChainStep[];
  raw: Obj;
}
export interface ChainDocument { raw: unknown; paths: ChainPath[]; envelope: "array" | "object" }
export const STEP_TYPES = [
  "读条件", "目标转化", "等价变形", "放缩", "构造", "论证", "回代检验", "工具选择",
] as const;
const obj = (value: unknown): Obj | null => value && typeof value === "object" && !Array.isArray(value) ? value as Obj : null;
const int = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) ? value : null;
const positive = (value: unknown): number | null => { const number = int(value); return number && number > 0 ? number : null; };
const text = (value: unknown): string => typeof value === "string" ? value : "";
const ids = (value: unknown): number[] | null => Array.isArray(value) && value.every((item) => positive(item) !== null) ? value as number[] : null;

export function projectChain(value: unknown): ChainDocument | null {
  const envelope: "array" | "object" = Array.isArray(value) ? "array" : "object";
  const list = envelope === "array" ? value : obj(value)?.paths;
  if (!Array.isArray(list)) return null;
  const paths: ChainPath[] = [];
  for (const rawPath of list) {
    const path = obj(rawPath);
    const id = positive(path?.id);
    if (!path || !id || !Array.isArray(path.steps)) return null;
    const rawSteps: Array<{ raw: Obj; id: number; seq: number }> = [];
    for (const rawStep of path.steps) {
      const step = obj(rawStep);
      const stepId = positive(step?.id);
      const seq = positive(step?.seq);
      if (!step || !stepId || !seq || !positive(step.step_type)) return null;
      rawSteps.push({ raw: step, id: stepId, seq });
    }
    const seqToId = new Map(rawSteps.map((step) => [step.seq, step.id]));
    const steps: ChainStep[] = [];
    for (const step of rawSteps) {
      const from = step.raw.edge_from === undefined ? [] : ids(step.raw.edge_from);
      const nodes = step.raw.warrant_nodes === undefined ? [] : ids(step.raw.warrant_nodes);
      if (!from || !nodes || from.some((seq) => !seqToId.has(seq))) return null;
      steps.push({ id: step.id, seq: step.seq, stepType: step.raw.step_type as number,
        content: text(step.raw.content), warrant: text(step.raw.warrant), warrantNodes: nodes,
        motive: text(step.raw.motive), offRamp: text(step.raw.off_ramp),
        dependsOn: from.map((seq) => seqToId.get(seq)!), prediction: step.raw.prediction,
        raw: step.raw });
    }
    if (new Set(steps.map((step) => step.id)).size !== steps.length || new Set(steps.map((step) => step.seq)).size !== steps.length) return null;
    paths.push({ id, title: text(path.title), quality: int(path.quality), status: int(path.status),
      workingRevision: int(path.workingRevision) ?? int(path.working_revision),
      steps: steps.sort((a, b) => a.seq - b.seq), raw: path });
  }
  return { raw: value, paths, envelope };
}

/** Local structure check is advisory; only the service can approve a chain for publication. */
export function chainIssues(steps: ChainStep[]): string[] {
  const issues: string[] = [];
  if (!steps.length) return ["至少需要一个步骤"];
  const ids = new Set(steps.map((step) => step.id));
  const order = new Map(steps.map((step, index) => [step.id, index]));
  for (const [index, step] of steps.entries()) {
    const label = `第 ${index + 1} 步`;
    if (step.stepType < 1 || step.stepType > 8) issues.push(`${label}类型无效`);
    if (!step.content.trim() || !step.warrant.trim() || !step.motive.trim()) issues.push(`${label}缺少内容、依据或动机`);
    if (!step.warrantNodes.length) issues.push(`${label}未挂知识点`);
    if (index > 0 && !step.dependsOn.length) issues.push(`${label}缺少入边`);
    if (step.dependsOn.some((id) => !ids.has(id))) issues.push(`${label}引用不存在的前置步`);
    if (step.dependsOn.some((id) => (order.get(id) ?? Infinity) >= index)) issues.push(`${label}依赖自身或后继步骤`);
    if (new Set(step.dependsOn).size !== step.dependsOn.length) issues.push(`${label}重复依赖`);
  }
  return issues;
}

export function serializeChain(document: ChainDocument, paths: ChainPath[]): unknown {
  const serialized = paths.map((path) => {
    const seqById = new Map(path.steps.map((step, index) => [step.id, index + 1]));
    return { ...path.raw, steps: path.steps.map((step, index) => ({ ...step.raw, id: step.id > 0 ? step.id : undefined,
      seq: index + 1, step_type: step.stepType, content: step.content, warrant: step.warrant,
      warrant_nodes: step.warrantNodes, motive: step.motive, off_ramp: step.offRamp,
      edge_from: step.dependsOn.map((id) => seqById.get(id)) })) };
  });
  return document.envelope === "array" ? serialized : { ...(document.raw as Obj), paths: serialized };
}
