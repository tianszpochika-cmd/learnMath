import { obj, str, num } from "./attemptModel";
export type BreakStatus = "none"|"unlocated"|"suggested"|"observed"|"self_reported";
export type StepSnapshot = { stepId: number; text: string };
export type BreakEvidence = { status: BreakStatus; source: string; solutionPathId: number|null; chainVersion: number|null; stepId: number|null; stepSeq: number|null; kind: string; steps: StepSnapshot[]; warrantNodes: number[]; remedies: Array<{questionId:string;title:string}>; publishedFallback: Array<{type:string;id:string;title:string}> };
export type WrongRow = { questionId: string; title: string; nodeName: string; mastered: boolean; wrongCount: number|null; dueDays: number|null; evidence: BreakEvidence[] };
export function statusOf(v: unknown): BreakStatus { const x=str(v).toLowerCase(); return ["unlocated","suggested","observed","self_reported"].includes(x)?x as BreakStatus:"none"; }
export function statusLabel(s:BreakStatus):string { return ({none:"尚无断链证据",unlocated:"尚未定位",suggested:"可能卡在这里 · 待确认",observed:"预测答错 · 已定位",self_reported:"我的自报"})[s]; }
export function evidenceOf(raw:unknown):BreakEvidence|null { const v=obj(raw); if(!Object.keys(v).length)return null;
  const stepsRaw=Array.isArray(v.minimalChainSteps)?v.minimalChainSteps:[];
  const steps=stepsRaw.map((x):StepSnapshot|null=>{const r=obj(x);const stepId=num(r.stepId??r.id??x);return stepId&&Number.isSafeInteger(stepId)&&stepId>0?{stepId,text:str(r.content??r.text)}:null;}).filter((x):x is StepSnapshot=>x!==null);
  const remediesRaw=Array.isArray(v.remedialExercises)?v.remedialExercises:Array.isArray(v.remedies)?v.remedies:[];
  const remedies=remediesRaw.map(x=>{const r=obj(x);return {questionId:str(r.questionId??r.id),title:str(r.title??r.stem)};}).filter(x=>x.questionId).slice(0,2);
  const fallbackRaw=Array.isArray(v.publishedFallback)?v.publishedFallback:[];
  const publishedFallback=fallbackRaw.map(x=>{const r=obj(x);return {type:str(r.type),id:str(r.id),title:str(r.title)};}).filter(x=>x.id&&x.title);
  return {status:statusOf(v.status??v.breakStatus),source:str(v.source),solutionPathId:num(v.solutionPathId),chainVersion:num(v.chainVersion),stepId:num(v.stepId),stepSeq:num(v.stepSeq),kind:str(v.kind),steps,
    warrantNodes:(Array.isArray(v.warrantNodeSnapshot)?v.warrantNodeSnapshot:[]).map(num).filter((x):x is number=>x!==null&&Number.isSafeInteger(x)&&x>0),remedies,publishedFallback};
}
export function wrongRows(raw:unknown):WrongRow[]|null { const source=obj(raw),list=Array.isArray(raw)?raw:Array.isArray(source.items)?source.items:Array.isArray(source.records)?source.records:null;if(!list)return null;
  const rows=list.map((x):WrongRow|null=>{const v=obj(x),qid=str(v.questionId??v.id);if(!/^[a-zA-Z0-9-]{1,80}$/.test(qid))return null;const evidenceRaw=Array.isArray(v.breakEvidence)?v.breakEvidence:Array.isArray(v.evidence)?v.evidence:[v.breakEvidence??v.evidence??(v.breakStatus?{status:v.breakStatus}:null)];
    return {questionId:qid,title:str(v.title??v.stem)||`题目 #${qid}`,nodeName:str(v.nodeName??v.node),mastered:v.mastered===true,wrongCount:num(v.wrongCount),dueDays:num(v.dueDays),evidence:evidenceRaw.map(evidenceOf).filter((e):e is BreakEvidence=>e!==null)};});
  return rows.some(x=>x===null)?null:rows as WrongRow[];
}
export function dueLabel(days:number|null):string { return days===null?"复习时间待服务端确认":days<0?`逾期 ${-days} 天`:days===0?"今天到期":`${days} 天后到期`; }
export function mayCountProfile(e:BreakEvidence):boolean { return e.status==="observed"; }
