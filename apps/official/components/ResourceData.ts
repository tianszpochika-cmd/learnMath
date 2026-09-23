export type ResourceRecord = Record<string, unknown>;

export function resourceRecord(value: unknown): ResourceRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ResourceRecord : {};
}

export function resourceText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function resourceField(value: unknown, ...keys: string[]): string {
  const record = resourceRecord(value);
  for (const key of keys) {
    const text = resourceText(record[key]);
    if (text) return text;
  }
  return "";
}

export function resourceArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function resourceItems(value: unknown): ResourceRecord[] {
  if (Array.isArray(value)) return value.map(resourceRecord).filter((item) => Object.keys(item).length > 0);
  const record = resourceRecord(value);
  for (const key of ["items", "records", "list", "results"]) {
    if (Array.isArray(record[key])) return resourceItems(record[key]);
  }
  return [];
}

export function resourcePublished(value: unknown, kind: "glossary" | "formula" = "glossary"): boolean {
  const status = resourceField(value, "status", "publishStatus", "reviewStatus").toLowerCase();
  if (/^\d+$/.test(status)) return kind === "formula" ? status === "1" : status === "1" || status === "3";
  return !["draft", "review", "pending", "ai_draft", "unpublished", "offline", "withdrawn"].includes(status);
}

export function formulaProofStatus(value: unknown): { label: string; tone: "neutral" | "warning" | "danger" } {
  const status = resourceField(value, "proofStatus", "proof_status");
  if (status === "1") return { label: "严格证明", tone: "neutral" };
  if (status === "2") return { label: "推导确立", tone: "neutral" };
  if (status === "3") return { label: "经验拟合 · 注意适用范围", tone: "warning" };
  if (status === "4") return { label: "尚未证明 · 不应当作定理", tone: "danger" };
  return { label: "证明状态待核实", tone: "warning" };
}

export function resourceSlug(value: unknown): string {
  const slug = resourceField(value, "slug", "id");
  return /^[a-zA-Z0-9-]{1,80}$/.test(slug) ? slug : "";
}

/** 公式详情公开契约是 /formulas/{id}；站内链接优先使用服务端 id。 */
export function resourceFormulaId(value: unknown): string {
  const id = resourceField(value, "id", "formulaId", "targetId");
  return /^[a-zA-Z0-9-]{1,80}$/.test(id) ? id : "";
}

/** 接龙关系只接受公开接口给出的相邻词条，且只生成站内安全 slug。 */
export function resourceNeighbor(value: unknown, direction: "prev" | "next"): ResourceRecord | null {
  const record = resourceRecord(value);
  const nested = resourceRecord(record.neighbors ?? record.relay);
  const raw = record[direction] ?? nested[direction];
  const candidate = typeof raw === "string" ? { slug: raw, title: raw } : resourceRecord(raw);
  return resourceSlug(candidate) ? candidate : null;
}

export function resourceBody(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(resourceBody).filter(Boolean).join("\n");
  return resourceField(value, "text", "body", "content", "description", "summary", "meaning");
}

export function resourceRows(value: unknown): ResourceRecord[] {
  return resourceArray(value).map((entry) => {
    if (typeof entry === "string") return { text: entry };
    return resourceRecord(entry);
  }).filter((entry) => Object.keys(entry).length > 0);
}

export function resourceDate(value: unknown): string {
  const raw = resourceText(value);
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Shanghai"
  }).format(date);
}
