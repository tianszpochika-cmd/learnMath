import { createSseParser } from "@learnmath/shared";
import { currentMobileAccessToken, currentMobileUserId, ensureMobileSession, mobileApiOrigin } from "./mobileClient";
import { obj, safeId, txt } from "../features/socialSystemModel";

export function streamSupported(): boolean { return typeof window !== "undefined" && typeof document !== "undefined" && typeof window.fetch === "function" && typeof window.ReadableStream !== "undefined"; }
export function aiTransportSupported(): boolean { return streamSupported() || (typeof uni !== "undefined" && typeof uni.request === "function"); }
export function activeAttemptMarked(): boolean {
  try { const userId = currentMobileUserId(); return Boolean(userId && uni.getStorageSync(`lm.mobile.activeAttempt:${userId}`)); }
  catch { return false; }
}
export interface ChatMessage { role: "user" | "assistant"; content: string; failed?: boolean }
export function chatMessages(raw: unknown): ChatMessage[] | null {
  const data = obj(raw), entries = Array.isArray(data.messages) ? data.messages : Array.isArray(data.items) ? data.items : null;
  if (!entries) return null;
  return entries.map((entry) => { const row = obj(entry), rawRole = txt(row.role); const role = rawRole === "1" ? "user" : rawRole === "2" || rawRole === "ai" ? "assistant" : rawRole; return role === "user" || role === "assistant" ? { role, content: txt(row.content ?? row.text) } : null; }).filter((entry): entry is ChatMessage => entry !== null && !!entry.content);
}

function consumeFrames(source: string, callbacks: { delta: (text: string) => void; meta: (id: string) => void }): boolean {
  let completed = false;
  const parser = createSseParser();
  for (const frame of parser.push(source)) {
    if (frame.data === "[DONE]") { completed = true; break; }
    let data: Record<string, unknown> = {};
    try { data = obj(JSON.parse(frame.data)); } catch { throw new Error("答疑数据格式异常"); }
    if (frame.event === "meta") { const id = safeId(data.conversationId); if (id) callbacks.meta(id); }
    if (frame.event === "delta") { const delta = txt(data.text); if (delta) callbacks.delta(delta); }
    if (frame.event === "error") throw new Error(txt(data.message) || (data.code === 3101 ? "积分不足或触发限流" : "答疑服务中断"));
    if (frame.event === "done") completed = true;
  }
  return completed;
}

function bufferedChat(url: string, token: string, body: string, callbacks: { delta: (text: string) => void; meta: (id: string) => void }, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error("答疑已取消")); return; }
    let settled = false;
    let task: UniNamespace.RequestTask | null = null;
    const finish = (error?: Error) => { if (settled) return; settled = true; signal.removeEventListener("abort", abort); if (error) reject(error); else resolve(); };
    const abort = () => { task?.abort(); finish(new Error("答疑已取消")); };
    task = uni.request({ url, method: "POST", header: { "content-type": "application/json", authorization: `Bearer ${token}`, accept: "text/event-stream" }, data: body, dataType: "text", responseType: "text", timeout: 120000,
      success: (response) => { if (response.statusCode !== 200) { finish(new Error(response.statusCode === 401 ? "登录状态已过期，请重新登录" : `答疑服务暂不可用（${response.statusCode}）`)); return; }
        if (typeof response.data !== "string") { finish(new Error("当前平台未返回可读取的答疑文本")); return; }
        try { if (!consumeFrames(response.data, callbacks)) throw new Error("答疑响应没有完成标记"); finish(); } catch (cause) { finish(cause instanceof Error ? cause : new Error("答疑数据格式异常")); }
      }, fail: () => finish(new Error("答疑请求未完成，请检查网络后重试")) });
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** H5 streams frames; Mini Program waits for the same authorized SSE response and renders its completed text. */
export async function streamMobileChat(input: { question: string; conversationId?: string; questionId?: string }, callbacks: { delta: (text: string) => void; meta: (id: string) => void }, signal: AbortSignal): Promise<void> {
  if (!aiTransportSupported()) throw new Error("当前环境暂不支持答疑请求");
  if (!await ensureMobileSession()) throw new Error("请重新登录后再提问");
  const token = currentMobileAccessToken();
  if (!token) throw new Error("登录状态尚未就绪");
  const url = `${mobileApiOrigin()}/api/app/v1/ai/chat`;
  const body = JSON.stringify({ question: input.question, ...(input.conversationId ? { conversationId: input.conversationId } : {}), context: input.questionId ? { questionId: input.questionId } : {} });
  if (!streamSupported()) return bufferedChat(url, token, body, callbacks, signal);
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "authorization": `Bearer ${token}`, "accept": "text/event-stream" }, body, signal });
  if (!response.ok || !response.body) throw new Error(response.status === 401 ? "登录状态已过期，请重新登录" : `答疑服务暂不可用（${response.status}）`);
  const reader = response.body.getReader(), decoder = new TextDecoder(), parser = createSseParser();
  let completed = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
        if (frame.data === "[DONE]") { completed = true; break; }
        let data: Record<string, unknown> = {};
        try { data = obj(JSON.parse(frame.data)); } catch { throw new Error("答疑数据格式异常"); }
        if (frame.event === "meta") { const id = safeId(data.conversationId); if (id) callbacks.meta(id); }
        if (frame.event === "delta") { const delta = txt(data.text); if (delta) callbacks.delta(delta); }
        if (frame.event === "error") throw new Error(txt(data.message) || (data.code === 3101 ? "积分不足或触发限流" : "答疑服务中断"));
        if (frame.event === "done") completed = true;
      }
      if (completed) break;
    }
  } finally { await reader.cancel().catch(() => undefined); }
  if (!completed) throw new Error("答疑连接中断，可重新提问");
}
