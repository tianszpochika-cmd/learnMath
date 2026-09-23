import type { BreakStatus, BreakEvidenceView } from "../features/wrongbook/wrongbookUi";
import { getAppHttp } from "./client";

type Obj = Record<string, unknown>;
function obj(value: unknown): Obj { return value && typeof value === "object" && !Array.isArray(value) ? value as Obj : {}; }
function str(value: unknown): string { return typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : ""; }
function num(value: unknown): number | null { const n = Number(value); return value === null || value === undefined || value === "" || !Number.isFinite(n) ? null : n; }

export interface WrongbookRow {
  questionId: string;
  title: string;
  node: string;
  wrongCount: number | null;
  dueDays: number | null;
  mastered: boolean;
  breakStatus: BreakStatus;
  evidence: BreakEvidenceView | null;
}
export interface WrongbookPage { rows: WrongbookRow[]; total: number | null }

function breakStatus(value: unknown): BreakStatus {
  const status = str(value).toLowerCase();
  return ["none", "unlocated", "suggested", "observed", "self_reported"].includes(status) ? status as BreakStatus : "none";
}

function evidence(value: unknown): BreakEvidenceView | null {
  const source = obj(value);
  const path = num(source.solutionPathId);
  const rawSteps = Array.isArray(source.minimalChainSteps) ? source.minimalChainSteps : [];
  const steps = rawSteps.map((raw) => num(typeof raw === "object" && raw !== null ? obj(raw).id ?? obj(raw).stepId : raw))
    .filter((n): n is number => n !== null && Number.isSafeInteger(n) && n > 0);
  const warrantNodeSnapshot = Array.isArray(source.warrantNodeSnapshot) ? source.warrantNodeSnapshot.map(num)
    .filter((n): n is number => n !== null && Number.isSafeInteger(n) && n > 0) : [];
  const stepDetails = rawSteps.map((raw) => {
    const item = obj(raw);
    const id = num(item.id ?? item.stepId);
    const content = str(item.content ?? item.text);
    return id !== null && Number.isSafeInteger(id) && id > 0 && content ? { id, content } : null;
  }).filter((item): item is { id: number; content: string } => item !== null);
  return path === null && !steps.length ? null : { solutionPathId: path, chainVersion: num(source.chainVersion), minimalChainSteps: steps, warrantNodeSnapshot, stepDetails };
}

/** 只展示接口返回的错题和证据；到期日缺失时保留未知，不伪造今日到期。 */
export function projectWrongbook(value: unknown): WrongbookPage {
  const source = obj(value);
  const entries = Array.isArray(value) ? value : Array.isArray(source.items) ? source.items : Array.isArray(source.records) ? source.records : [];
  return {
    rows: entries.map((raw): WrongbookRow | null => {
      const item = obj(raw);
      const id = str(item.questionId ?? item.id);
      if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) return null;
      const evidenceSource = obj(item.breakEvidence ?? item.evidence);
      return {
        questionId: id,
        title: str(item.title ?? item.stem) || `题目 #${id}`,
        node: str(item.nodeName ?? item.node),
        wrongCount: num(item.wrongCount),
        dueDays: num(item.dueDays),
        mastered: item.mastered === true,
        breakStatus: breakStatus(item.breakStatus ?? evidenceSource.status),
        evidence: evidence(evidenceSource),
      };
    }).filter((row): row is WrongbookRow => row !== null),
    total: num(source.total),
  };
}

export async function readWrongbook(page = 1, size = 20): Promise<WrongbookPage> {
  return projectWrongbook(await getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/wrongbook", query: { page, size } }));
}

export async function redoWrongbook(count: number): Promise<string> {
  const response = obj(await getAppHttp().request<unknown>({ method: "POST", path: "/api/app/v1/wrongbook/redo", body: { count } }));
  const id = str(response.attemptId ?? obj(response.attempt).id ?? response.id);
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error("服务端未返回可进入的作答编号");
  return id;
}

export async function masterWrong(questionId: string): Promise<void> {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(questionId)) throw new Error("题目编号无效");
  await getAppHttp().request<unknown>({ method: "POST", path: `/api/app/v1/wrongbook/${questionId}/master` });
}
