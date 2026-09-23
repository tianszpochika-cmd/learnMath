/** Mobile attempt projection. Only server snapshots and receipts are authoritative. */
export type Data = Record<string, unknown>;
export const obj = (v: unknown): Data => v && typeof v === "object" && !Array.isArray(v) ? v as Data : {};
export const str = (v: unknown): string => typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
export const num = (v: unknown): number | null => v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
export const id = (v: unknown): string => { const x = str(v); if (!/^[a-zA-Z0-9-]{1,80}$/.test(x)) throw new Error("资源编号无效"); return x; };
export type Option = { key: string; text: string };
export type QuestionKind = "single"|"multi"|"judge"|"fill"|"essay"|"unknown";
export type Question = { seq: number; questionId: string; stem: string; type: string; kind: QuestionKind; issue: string; options: Option[]; optionValid: boolean; draftValid: boolean; draft: string; submitted: boolean; locked: boolean; flagged: boolean; judgement: string | null; analysis: string; selfAssess: number | null };
export type Attempt = { id: string; title: string; state: string; mode: string; feedbackMode: "immediate" | "on_submit" | null; assistancePolicy: string; capabilities: Data; revision: number | null; serverNow: string; deadlineAt: string; questions: Question[]; objectiveEarned: number | null; objectivePossible: number | null; objectiveRate: number | null; pendingSelfAssess: number | null; reportVersion: number | null; lastSavedAt: string };
export const finished = (a: Attempt) => ["submitted", "pending_self_assess", "finalized"].includes(a.state);
export const reportReady = (a: Attempt) => a.state === "pending_self_assess" || a.state === "finalized";
export const active = (a: Attempt) => a.state === "in_progress";
export function kindOf(type:string):QuestionKind {const x=type.toLowerCase();return x==="2"||/multi|多选/.test(x)?"multi":x==="1"||/single|choice|select|单选/.test(x)?"single":x==="3"||/judge|判断/.test(x)?"judge":x==="4"||/fill|blank|填空/.test(x)?"fill":x==="5"||/essay|subjective|解答|简答/.test(x)?"essay":"unknown";}
export function kindLabel(kind:QuestionKind):string{return ({single:"单选",multi:"多选",judge:"判断",fill:"填空",essay:"解答",unknown:"题型待核实"})[kind];}
export function attemptView(raw: unknown): Attempt | null {
  const s = obj(raw); const state = str(s.state ?? s.status);
  if (!state || !["in_progress", "submitted", "pending_self_assess", "finalized"].includes(state)) return null;
  const feedbackMode = s.feedbackMode === "immediate" || s.feedbackMode === "on_submit" ? s.feedbackMode : null;
  const list = Array.isArray(s.questions) ? s.questions : Array.isArray(s.items) ? s.items : [];
  const questions = list.map((v): Question | null => {
    const q = obj(v), inner = obj(q.question); const seq = num(q.seq); const stem = str(q.stem ?? inner.stem);
    if (!seq || !Number.isSafeInteger(seq) || !stem) return null;
    const type = str(q.type ?? inner.type), kind=kindOf(type); const optionsRaw = q.options ?? inner.options;
    const mapped = Array.isArray(optionsRaw) ? optionsRaw.map((v) => { const x = obj(v); return { key: str(x.key), text: str(x.text ?? x.content ?? x.label) }; }) : [];
    const optionValid = (kind==="single"||kind==="judge"?mapped.length>=2:kind==="fill"||kind==="essay") && mapped.every((o) => o.key && o.text) && new Set(mapped.map((o) => o.key)).size === mapped.length;
    const issue=kind==="multi"?"多选题答案编码尚未约定，暂不能安全提交。":kind==="unknown"?"服务端题型尚未对齐，暂不能作答。":!optionValid?"选项信息不完整，本题暂不可作答。":"";
    const submitted = q.submitted === true || q.answered === true;
    const canSeeFeedback = state === "pending_self_assess" || state === "finalized" || (feedbackMode === "immediate" && submitted);
    return { seq, questionId: str(q.questionId ?? inner.id), stem, type, kind, issue, options: optionValid ? mapped : [], optionValid,
      draftValid: q.draft === undefined || q.draft === null || typeof q.draft === "string" || typeof q.draft === "number",
      draft: str(q.draft), submitted, locked: q.locked === true || (feedbackMode === "immediate" && submitted), flagged: q.flagged === true,
      judgement: canSeeFeedback ? str(q.judgement ?? q.result) || null : null, analysis: canSeeFeedback ? str(q.analysis ?? q.explanation) : "",
      selfAssess: canSeeFeedback ? num(q.selfAssess ?? q.assess) : null };
  }).filter((q): q is Question => q !== null).sort((a,b) => a.seq-b.seq);
  if (questions.length !== list.length || new Set(questions.map(q=>q.seq)).size !== questions.length) return null;
  const objective = obj(s.objective);
  return { id: str(s.attemptId ?? s.id), title: str(s.title ?? s.paperTitle) || "本次作答", state, mode: str(s.mode), feedbackMode,
    assistancePolicy: str(s.assistancePolicy), capabilities: obj(s.capabilities), revision: typeof s.revision === "number" && Number.isSafeInteger(s.revision) && s.revision >= 0 ? s.revision : null,
    serverNow: str(s.serverNow), deadlineAt: str(s.deadlineAt), questions,
    objectiveEarned: num(objective.earned ?? s.objectiveEarned), objectivePossible: num(objective.possible ?? s.objectivePossible),
    objectiveRate: num(objective.rate ?? s.objectiveRate), pendingSelfAssess: num(s.pendingSelfAssess), reportVersion: num(s.reportVersion), lastSavedAt: str(s.lastSavedAt) };
}
export function writeAllowed(a: Attempt, q: Question, remaining: number | null): boolean {
  return active(a) && a.revision !== null && !!a.feedbackMode && q.optionValid && q.draftValid && !q.locked && remaining !== 0;
}
export function remainingMs(a: Attempt, elapsedMs: number): number | null {
  if (!a.deadlineAt) return null;
  const now = Date.parse(a.serverNow), end = Date.parse(a.deadlineAt);
  if (!Number.isFinite(now) || !Number.isFinite(end)) return 0;
  return Math.max(0,end-now-Math.max(0,elapsedMs));
}
export function countdown(ms: number | null): string { if (ms === null) return "无时限"; if (ms <= 0) return "已到期"; const sec = Math.ceil(ms/1000); return `${String(Math.floor(sec/3600)).padStart(2,"0")}:${String(Math.floor(sec%3600/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`; }
export function draftKey(userId: string, attemptId: string, seq: number): string { return `lm.mobile.draft:${id(userId)}:${id(attemptId)}:${seq}`; }
export type LocalDraft = { value: string; baseRevision: number; updatedAt: number };
export function parseDraft(raw: unknown): LocalDraft | null { try { const v = typeof raw === "string" ? JSON.parse(raw) : raw; return typeof v?.value === "string" && Number.isSafeInteger(v.baseRevision) && v.baseRevision >= 0 && Number.isFinite(v.updatedAt) ? v : null; } catch { return null; } }
export function recovery(server: string, revision: number | null, local: LocalDraft | null, canWrite: boolean): "none" | "compare" | "copy-only" {
  if (!local || local.value === server) return "none";
  return canWrite && revision !== null ? "compare" : "copy-only";
}
export function objectiveLabel(a: Attempt): string { if(a.state==="submitted")return "客观判分处理中"; if(a.objectivePossible===null||a.objectivePossible<=0||a.objectiveRate===null)return "本卷无客观成绩"; const percent=a.objectiveRate<=1?a.objectiveRate*100:a.objectiveRate;return `${Math.round(percent*100)/100}% · ${a.objectiveEarned ?? "—"}/${a.objectivePossible}`; }
export const mathSymbols = ["²","√()","/","±","π","θ","≤","∞"] as const;
export function insertMath(text: string, symbol: string, cursor?: number) { const at = cursor === undefined || cursor < 0 || cursor > text.length ? text.length : cursor; return { value: text.slice(0,at)+symbol+text.slice(at), cursor: at+symbol.length }; }
export function submitText(questions: Question[]): string { const unanswered = questions.filter(q => !q.draft && !q.submitted).map(q=>q.seq); return unanswered.length ? `还有 ${unanswered.length} 题未答（${unanswered.slice(0,6).join("、")}${unanswered.length>6?"…":""}）。确认交卷？` : `已答完 ${questions.length} 题，确认交卷？`; }
