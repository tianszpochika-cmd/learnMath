import { getMobileHttp } from "./mobileClient";
import { id } from "../features/attempt/attemptModel";
const base="/api/app/v1";
const numericId=(value:string|number)=>{const x=String(value);if(!/^[1-9]\d*$/.test(x)||!Number.isSafeInteger(Number(x)))throw new Error("学习资源编号无效");return x;};
export const learnApi={
  course:(x:string)=>getMobileHttp().request<unknown>({method:"GET",path:`${base}/courses/${numericId(x)}`}),
  tree:(x:string)=>getMobileHttp().request<unknown>({method:"GET",path:`${base}/courses/${numericId(x)}/tree`}),
  lesson:(x:string)=>getMobileHttp().request<unknown>({method:"GET",path:`${base}/lessons/${numericId(x)}`}),
  heartbeat:(x:string,second:number)=>getMobileHttp().request<unknown>({method:"POST",path:`${base}/lessons/${numericId(x)}/heartbeat`,body:{second}}),
  read:(x:string)=>getMobileHttp().request<unknown>({method:"POST",path:`${base}/lessons/${numericId(x)}/read`}),
  complete:(x:string)=>getMobileHttp().request<unknown>({method:"POST",path:`${base}/lessons/${numericId(x)}/complete`}),
  graph:()=>getMobileHttp().request<unknown>({method:"GET",path:`${base}/graph`}),
  node:(x:number)=>getMobileHttp().request<unknown>({method:"GET",path:`${base}/graph/nodes/${numericId(x)}`}),
  narrative:(x:number)=>getMobileHttp().request<unknown>({method:"GET",path:`${base}/narratives/${numericId(x)}`}),
  startPractice:(x:number)=>getMobileHttp().request<unknown>({method:"POST",path:`${base}/practice/quiz`,body:{nodeIds:[x],count:1}}),
  deepdive:(type:string,x:string,mode:"read"|"predict"|"compare")=>getMobileHttp().request<unknown>({method:"GET",path:`${base}/deepdive/${type==="formula"?"formula":type==="question"?"question":(()=>{throw new Error("深钻资源类型无效")})()}/${numericId(x)}`,query:{mode}}),
  predict:(type:string,x:string,body:Record<string,unknown>)=>getMobileHttp().request<unknown>({method:"POST",path:`${base}/deepdive/${type==="formula"?"formula":type==="question"?"question":(()=>{throw new Error("深钻资源类型无效")})()}/${numericId(x)}/predict`,body}),
  reportBreak:(type:string,x:string,body:Record<string,unknown>)=>getMobileHttp().request<unknown>({method:"POST",path:`${base}/deepdive/${type==="formula"?"formula":type==="question"?"question":(()=>{throw new Error("深钻资源类型无效")})()}/${numericId(x)}/break`,body}),
  notes:()=>getMobileHttp().request<unknown>({method:"GET",path:`${base}/notes`}),
  favorites:()=>getMobileHttp().request<unknown>({method:"GET",path:`${base}/favorites`}),
  saveNote:(body:{content:string;refType:string;refId:string},noteId?:string)=>getMobileHttp().request<unknown>({method:noteId?"PATCH":"POST",path:noteId?`${base}/notes/${numericId(noteId)}`:`${base}/notes`,body}),
  deleteNote:(noteId:string)=>getMobileHttp().request<unknown>({method:"DELETE",path:`${base}/notes/${numericId(noteId)}`}),
  removeFavorite:(refType:string,refId:string)=>getMobileHttp().request<unknown>({method:"DELETE",path:`${base}/favorites/${["question","lesson","formula","node"].includes(refType)?refType:(()=>{throw new Error("收藏类型无效")})()}/${numericId(refId)}`}),
};
export function attemptId(raw:unknown):string|null{const o=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};try{return id(o.attemptId);}catch{return null;}}
