import { getMobileHttp } from "./mobileClient";
import { attemptView, id, obj, str, type Attempt } from "../features/attempt/attemptModel";
import type { WrongRow } from "../features/attempt/wrongbookModel";
let selectedWrong: WrongRow | null = null;
export function selectWrong(row: WrongRow): void { selectedWrong = row; }
export function selectedWrongFor(questionId: string): WrongRow | null { return selectedWrong?.questionId === questionId ? selectedWrong : null; }
const path = (attemptId: string) => `/api/app/v1/attempts/${id(attemptId)}`;
export async function readAttempt(attemptId: string): Promise<Attempt> { const result = attemptView(await getMobileHttp().request<unknown>({ method: "GET", path: path(attemptId) })); if (!result || !result.questions.length) throw new Error("服务端作答快照不完整，请稍后重试"); return result; }
export async function attemptAction(attemptId: string, action: "draft"|"answer"|"submit"|"self-assess", body?: Record<string, unknown>): Promise<unknown> {
  return getMobileHttp().request<unknown>({ method: action === "draft" ? "PUT" : "POST", path: `${path(attemptId)}/${action}`, body });
}
export async function wrongbook(page=1, size=20): Promise<unknown> { return getMobileHttp().request<unknown>({ method: "GET", path: "/api/app/v1/wrongbook", query: { page,size } }); }
export async function redoWrongbook(count: number): Promise<string> { const r=obj(await getMobileHttp().request<unknown>({ method:"POST",path:"/api/app/v1/wrongbook/redo",body:{count} })); const result=str(r.attemptId ?? obj(r.attempt).id ?? r.id); return id(result); }
export async function masterWrong(questionId: string): Promise<void> { await getMobileHttp().request<unknown>({ method:"POST",path:`/api/app/v1/wrongbook/${id(questionId)}/master` }); }
export async function startRelatedPractice(nodeIds:number[], count:number):Promise<string>{if(!nodeIds.length||nodeIds.some(n=>!Number.isSafeInteger(n)||n<=0)||!Number.isSafeInteger(count)||count<1||count>2)throw new Error("练习参数不完整");const r=obj(await getMobileHttp().request<unknown>({method:"POST",path:"/api/app/v1/practice/quiz",body:{nodeIds,count}}));return id(r.attemptId);}
