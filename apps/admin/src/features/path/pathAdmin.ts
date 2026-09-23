/** A11 management projection. Unknown service fields stay unknown; this is not a coverage verdict. */
export type Row = Record<string, unknown>;
export interface PathSummary { code: string; name: string; status: string; raw: Row }
export interface PathNode { id: number; seq: number; title: string; refType: number; refId: number; rule: unknown; mapX: number | null; mapY: number | null; raw: Row }
export const RESOURCE_TYPES = [
  { value: 1, label: "课时" }, { value: 2, label: "练习组" }, { value: 3, label: "试卷" },
  { value: 4, label: "测评" }, { value: 5, label: "AI 任务" }, { value: 6, label: "专题" },
  { value: 7, label: "Boss" }, { value: 8, label: "关卡" },
] as const;

const row = (value: unknown): Row | null => value && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
const positive = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
const number = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) ? value : null;
const string = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const items = (value: unknown): unknown[] | null => {
  if (Array.isArray(value)) return value;
  const obj = row(value);
  if (Array.isArray(obj?.items)) return obj.items;
  if (Array.isArray(obj?.records)) return obj.records;
  return null;
};

export function projectPaths(value: unknown): PathSummary[] | null {
  const list = items(value);
  if (!list) return null;
  const result = list.map((source) => {
    const data = row(source);
    const code = string(data?.code);
    if (!data || !/^P[1-6]$/.test(code)) return null;
    return { code, name: string(data.name) || code, status: string(data.status), raw: data };
  });
  return result.some((value) => value === null) ? null : result as PathSummary[];
}

export function projectNodes(value: unknown): PathNode[] | null {
  const list = items(value);
  if (!list) return null;
  const result = list.map((source) => {
    const data = row(source);
    const id = positive(data?.id);
    const seq = positive(data?.seq);
    const refType = positive(data?.ref_type) ?? 0;
    const refId = positive(data?.ref_id) ?? 0;
    if (!data || !id || !seq) return null;
    return { id, seq, refType, refId, title: string(data.title), rule: data.unlock_rule,
      mapX: number(data.map_x), mapY: number(data.map_y), raw: data };
  });
  return result.some((value) => value === null) ? null : (result as PathNode[]).sort((a, b) => a.seq - b.seq);
}

export function parseRule(raw: string): { value: Row | null; error: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { value: null, error: "解锁规则需为合法 JSON" }; }
  const rule = row(parsed);
  if (!rule || !string(rule.type) && !Array.isArray(rule.allOf) && !Array.isArray(rule.anyOf)) {
    return { value: null, error: "规则需要 type 或 allOf/anyOf" };
  }
  return { value: rule, error: "" };
}

export function nodeErrors(input: { title: string; refType: number; refId: number; ruleText: string; seq: number; mapX?: string; mapY?: string }, code: string): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push("节点标题不能为空");
  if (!Number.isSafeInteger(input.refType) || input.refType < 1 || input.refType > 8) errors.push("引用类型无效");
  if (!Number.isSafeInteger(input.refId) || input.refId < 1) errors.push("请输入真实资源的正整数编号");
  if (!Number.isSafeInteger(input.seq) || input.seq < 1) errors.push("顺序 seq 需为正整数");
  const rule = parseRule(input.ruleText);
  if (rule.error) errors.push(rule.error);
  if (code === "P6" && (input.mapX || input.mapY)) {
    if (!/^-?\d+$/.test(input.mapX ?? "") || !/^-?\d+$/.test(input.mapY ?? "")) errors.push("P6 坐标需要同时填写整数 X/Y");
  }
  return errors;
}

/** Only an explicit server verdict may remove the publish blocker; absent DTO is unknown. */
export function validationVerdict(value: unknown): { passed: boolean | null; blockers: string[]; raw: unknown } {
  const data = row(value);
  const blockers = Array.isArray(data?.blockers) ? data.blockers.filter((x): x is string => typeof x === "string") : [];
  const passed = data?.valid === true || data?.isValid === true ? blockers.length === 0 :
    data?.valid === false || data?.isValid === false || blockers.length > 0 ? false : null;
  return { passed, blockers, raw: value };
}
