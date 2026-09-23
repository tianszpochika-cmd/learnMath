import type { DrillType, FamilyRelRow, FormulaDetail, SymbolRow, VariantRow2 } from "./formulaUi";

export interface FormulaPage {
  items: FormulaDetail[];
  page: number;
  size: number;
  total: number | null;
  hasMore: boolean;
}

export interface FormulaPathSummary {
  id: number;
  title: string;
  quality: string | null;
  version: string | null;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const own = (value: Record<string, unknown>, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const string = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const label = (value: unknown): string => typeof value === "number" && Number.isFinite(value) ? String(value) : string(value);
const numeric = (value: unknown): number | null => {
  const number = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};
const positiveId = (value: unknown): number | null => {
  const id = numeric(value);
  return id && id > 0 ? id : null;
};
const first = (source: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) if (source[key] !== undefined && source[key] !== null) return source[key];
  return undefined;
};
const lines = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(string).filter(Boolean);
  if (typeof value === "string") {
    const raw = value.trim();
    if (raw.startsWith("[")) {
      try { return lines(JSON.parse(raw)); } catch { return []; }
    }
    return raw ? [raw] : [];
  }
  return [];
};

/** Public app endpoints must expose only published snapshots; reject known drafts. */
function published(source: Record<string, unknown>): boolean {
  if (source.published === false || source.isPublished === false) return false;
  const status = first(source, "status", "publicationStatus", "publication_status");
  if (status !== undefined && status !== 1 && status !== "1" && status !== "published") return false;
  if ((own(source, "publishedSnapshot") && !Object.keys(record(source.publishedSnapshot)).length) ||
    (own(source, "published_snapshot") && !Object.keys(record(source.published_snapshot)).length)) return false;
  return true;
}

function publishedBody(source: Record<string, unknown>): Record<string, unknown> {
  if (own(source, "publishedSnapshot")) return record(source.publishedSnapshot);
  if (own(source, "published_snapshot")) return record(source.published_snapshot);
  return source;
}

function symbols(value: unknown): SymbolRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.map((entry): SymbolRow | null => {
    const item = record(entry);
    const symbol = string(item.symbol);
    if (!symbol) return null;
    return { symbol, meaning: string(item.meaning), rangeNote: string(first(item, "rangeNote", "range_note")) };
  }).filter((item): item is SymbolRow => item !== null);
  return rows.length ? rows : null;
}

function family(value: unknown): FamilyRelRow[] | null {
  if (!Array.isArray(value)) return null;
  const rows = value.map((entry): FamilyRelRow | null => {
    const item = record(entry);
    const toFormulaId = positiveId(first(item, "toFormulaId", "to_formula_id", "toId", "to_id"));
    if (!toFormulaId) return null;
    return { toFormulaId, relType: numeric(first(item, "relType", "rel_type")) ?? 0, note: string(item.note) };
  }).filter((item): item is FamilyRelRow => item !== null);
  return rows.length ? rows : null;
}

function variants(value: unknown): VariantRow2[] | null {
  const direct = Array.isArray(value) ? value : [];
  const grouped = record(value);
  const legal = Array.isArray(first(grouped, "legal_forms", "legalForms")) ? first(grouped, "legal_forms", "legalForms") as unknown[] : [];
  const errors = Array.isArray(first(grouped, "error_forms", "errorForms")) ? first(grouped, "error_forms", "errorForms") as unknown[] : [];
  const rows = [...direct.map((entry) => ({ entry, legal: record(entry).legal === true })),
    ...legal.map((entry) => ({ entry, legal: true })), ...errors.map((entry) => ({ entry, legal: false }))]
    .map(({ entry, legal }): VariantRow2 | null => {
      const item = record(entry);
      const expression = string(first(item, "expression", "latex", "wrongForm", "wrong_form"));
      if (!expression) return null;
      return { legal, expression, note: string(first(item, "note", "why", "reason")) };
    }).filter((item): item is VariantRow2 => item !== null);
  return rows.length ? rows : null;
}

const TYPES: Record<string, DrillType> = {
  condition: "CONDITION_JUDGE", CONDITION_JUDGE: "CONDITION_JUDGE",
  variant: "VARIANT_RECOGNIZE", VARIANT_RECOGNIZE: "VARIANT_RECOGNIZE",
  apply: "APPLICATION_MATCH", APPLICATION_MATCH: "APPLICATION_MATCH",
};

export function projectDrillTypes(value: unknown): DrillType[] {
  const source = Array.isArray(value) ? value : Object.entries(record(value)).filter(([, enabled]) => enabled === true).map(([key]) => key);
  return [...new Set(source.map((entry) => TYPES[string(entry)]).filter((type): type is DrillType => Boolean(type)))];
}

export function projectFormulaDetail(value: unknown): FormulaDetail | null {
  const source = record(value);
  if (!published(source)) return null;
  const body = publishedBody(source);
  const id = positiveId(first(source, "id", "formulaId", "formula_id") ?? first(body, "id", "formulaId", "formula_id"));
  const name = string(first(body, "name", "title"));
  if (!id || !name) return null;
  const proofStatus = numeric(first(body, "proofStatus", "proof_status")) ?? 0;
  return {
    id, name,
    aliases: lines(first(body, "aliases", "alias")),
    latex: string(first(body, "latex", "formula", "expression")),
    proofStatus,
    origin: string(body.origin) || null,
    symbols: symbols(first(body, "symbols", "symbolTable", "symbol_table")),
    hasDerivation: first(body, "hasDerivation", "has_derivation", "derivationAvailable") === true,
    conditions: string(first(body, "conditions", "fullConditions", "full_conditions")) || null,
    applications: string(first(body, "applications", "application")) || null,
    family: family(first(body, "family", "relations", "familyRelations")),
    variants: variants(body.variants),
    domain: numeric(body.domain),
    tier: numeric(body.tier),
    quality: numeric(body.quality),
    conditionSummary: string(first(body, "conditionSummary", "condition_summary")) || null,
    drillTypes: projectDrillTypes(first(body, "availableDrillTypes", "drillTypes", "drillAvailability") ??
      first(source, "availableDrillTypes", "drillTypes", "drillAvailability")),
  };
}

export function projectFormulaPage(value: unknown, page: number, size: number): FormulaPage {
  const source = record(value);
  const container = record(first(source, "page", "pagination"));
  const raw = Array.isArray(value) ? value : first(source, "items", "records", "list", "rows", "content");
  const rows = Array.isArray(raw) ? raw : [];
  const total = numeric(first(source, "total", "totalElements", "totalCount") ?? first(container, "total", "totalElements"));
  const items = rows.map(projectFormulaDetail).filter((item): item is FormulaDetail => item !== null);
  const explicitNext = first(source, "hasMore", "hasNext") ?? first(container, "hasMore", "hasNext");
  const hasMore = typeof explicitNext === "boolean" ? explicitNext : total !== null ? page * size < total : rows.length >= size;
  return { items, page, size, total, hasMore };
}

export function projectFormulaPaths(value: unknown): FormulaPathSummary[] {
  const source = record(value);
  const raw = Array.isArray(value) ? value : first(source, "items", "paths", "records", "list");
  if (!Array.isArray(raw)) return [];
  return raw.map((entry): FormulaPathSummary | null => {
    const item = record(entry);
    if (!published(item)) return null;
    const body = publishedBody(item);
    const id = positiveId(first(item, "id", "pathId", "path_id"));
    const title = string(first(body, "title", "name"));
    if (!id || !title) return null;
    return { id, title, quality: label(body.quality ?? item.quality) || null,
      version: label(first(body, "version", "publishedVersion") ?? first(item, "version", "publishedVersion")) || null };
  }).filter((item): item is FormulaPathSummary => item !== null);
}

export function requireAttemptId(value: unknown): number {
  const source = record(value);
  const attempt = record(source.attempt);
  const id = positiveId(source.attemptId ?? attempt.attemptId ?? attempt.id);
  if (!id) throw new Error("小练服务未返回有效作答编号，请勿进入示例试卷。");
  return id;
}
