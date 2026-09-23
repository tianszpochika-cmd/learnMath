<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { createSseParser } from "@learnmath/shared";
import { contextLabel, initialAiState, quickAsks, reduceAi, type AiEvent, type AiState } from "../features/ai/aiPanel";
import { activeAttemptRestricted } from "../features/ai/activeRestriction";
import { ensureAuthSession, getAppHttp } from "../services/client";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const open = ref(false);
const available = ref(false);
const checking = ref(true);
const restricted = ref(true);
const state = ref<AiState>(initialAiState(false));
const input = ref("");
const streamEl = ref<HTMLElement | null>(null);
const ctx = ref<{ type: "question" | "formula"; id: number | string; title?: string } | null>(null);
const ctxText = computed(() => contextLabel(ctx.value));
const canSend = computed(() => available.value && !restricted.value && state.value.status !== "streaming");
let controller: AbortController | null = null;

function refreshRestriction(): void {
  try { restricted.value = typeof window === "undefined" || activeAttemptRestricted(window.sessionStorage, auth.userId); }
  catch { restricted.value = true; }
  if (restricted.value) close();
}

function dispatch(event: AiEvent) { state.value = reduceAi(state.value, event); }
function statusEnabled(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const chat = data.chat;
  return data.enabled === true || chat === true || !!(chat && typeof chat === "object" && (chat as Record<string, unknown>).enabled === true);
}

async function checkStatus() {
  checking.value = true;
  try {
    available.value = statusEnabled(await getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/ai/status" }));
    state.value = initialAiState(available.value);
  } catch { available.value = false; state.value = initialAiState(false); }
  finally { checking.value = false; }
}

function apiOrigin(): string {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  return (env.VITE_APP_API_BASE ?? env.VITE_API_BASE ?? "").trim().replace(/\/+$/, "").replace(/\/api\/app\/v1$/i, "");
}

async function send() {
  refreshRestriction();
  const question = input.value.trim();
  if (!question || !canSend.value) return;
  if (!await ensureAuthSession() || !auth.accessToken) { dispatch({ type: "parse-error", code: 2001 }); return; }
  dispatch({ type: "send", text: question });
  input.value = "";
  controller = new AbortController();
  try {
    const response = await fetch(apiOrigin() + "/api/app/v1/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream", authorization: "Bearer " + auth.accessToken },
      body: JSON.stringify({ question, context: ctx.value?.type === "question" ? { questionId: ctx.value.id } : {} }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("AI 服务没有返回可读取的流");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = createSseParser();
    while (true) {
      const { done, value } = await reader.read();
      const chunk = decoder.decode(value || new Uint8Array(), { stream: !done });
      for (const frame of parser.push(chunk)) dispatch({ type: "frame", frame });
      if (done || parser.done() || state.value.status === "error") break;
    }
    if (state.value.status === "streaming") dispatch({ type: "parse-error", code: 3102 });
  } catch {
    if (state.value.status === "streaming") dispatch({ type: "parse-error", code: 3102 });
  } finally { controller = null; }
}

function close() { controller?.abort(); open.value = false; if (state.value.status === "streaming") dispatch({ type: "parse-error", code: 3102 }); }
function openWithContext(subject?: { type: "question" | "formula"; id: number | string; title?: string }) { refreshRestriction(); if (!available.value || restricted.value) return; ctx.value = subject ?? null; open.value = true; }
defineExpose({ openWithContext });

watch(() => state.value.msgs.map((message) => message.content).join("|"), async () => { await nextTick(); if (streamEl.value) streamEl.value.scrollTop = streamEl.value.scrollHeight; });
watch(() => auth.userId, refreshRestriction);
onMounted(() => { refreshRestriction(); window.addEventListener("lm:active-attempt-change", refreshRestriction); void checkStatus(); });
onUnmounted(() => { controller?.abort(); window.removeEventListener("lm:active-attempt-change", refreshRestriction); });
</script>

<template>
  <button v-if="available && !checking && !restricted" type="button" class="fab" aria-label="打开 AI 导师" :aria-expanded="open" @click="open = !open">π</button>
  <aside v-if="available && !checking && !restricted" class="panel" :class="{ on: open }" :aria-hidden="!open" aria-label="AI 导师"><header class="phead"><div><p class="eyebrow">AI GUIDE</p><h2>AI 导师</h2></div><button type="button" class="close" aria-label="关闭 AI 导师" @click="close">×</button></header><p class="context">{{ ctxText }}</p><p class="directive">先说清你卡在哪里。服务不可用时不会给出本地模拟回答。</p><div ref="streamEl" class="stream" role="log" aria-live="polite"><p v-if="!state.msgs.length" class="empty">可以追问概念或步骤。答案与费用以服务端回应为准。</p><div v-for="(message, index) in state.msgs" :key="index" class="bubble" :class="message.role">{{ message.content || (message.role === 'ai' && state.status === 'streaming' ? '正在思考…' : '') }}</div><p v-if="state.status === 'error'" class="error" role="alert">{{ state.errorCode === 3101 ? '次数或积分不足。' : state.errorCode === 2001 ? '登录状态已过期，请重新登录。' : 'AI 服务暂时不可用。你仍可使用课程和错题本。' }}</p></div><div class="quick"><button v-for="item in quickAsks()" :key="item" type="button" :disabled="!canSend" @click="input = item; send()">{{ item }}</button></div><form class="composer" @submit.prevent="send"><label class="sr-only" for="ai-question">给 AI 导师的提问</label><input id="ai-question" v-model="input" :disabled="!canSend" placeholder="描述你卡住的那一步…"><button type="submit" :disabled="!canSend || !input.trim()">发送</button></form></aside>
</template>

<style scoped>
.fab{position:fixed;right:25px;bottom:25px;z-index:70;display:grid;place-items:center;width:56px;height:56px;border:0;border-radius:50%;background:var(--grad);color:#fff;font-size:25px;font-weight:800;box-shadow:var(--shadow);cursor:pointer}.panel{position:fixed;z-index:80;inset:0 0 0 auto;display:flex;flex-direction:column;width:min(500px,42vw);border-left:1px solid var(--line);background:var(--card,#fff);color:var(--ink);box-shadow:-20px 0 50px -30px #0f172a88;transform:translateX(105%);transition:transform .25s}.panel.on{transform:none}.phead{display:flex;align-items:center;justify-content:space-between;padding:21px 20px;border-bottom:1px solid var(--line)}.eyebrow{margin:0 0 4px;color:var(--brand);font-size:10px;font-weight:850;letter-spacing:.17em}.phead h2{margin:0;font:700 23px var(--serif,Georgia,serif)}.close{min-width:38px;min-height:38px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);font-size:23px}.context,.directive{margin:0;padding:11px 20px;background:var(--brand-soft);color:var(--ink2);font-size:12px;line-height:1.6}.directive{background:var(--soft)}.stream{flex:1;overflow:auto;padding:20px}.bubble{max-width:84%;margin-bottom:13px;padding:11px 14px;border-radius:13px;white-space:pre-wrap;line-height:1.65;font-size:14px}.bubble.ai{background:var(--soft);border-top-left-radius:3px}.bubble.user{margin-left:auto;background:var(--brand);color:#fff;border-top-right-radius:3px}.empty{color:var(--ink3);text-align:center;padding:25px 8px}.error{padding:12px;border-radius:9px;background:var(--danger-bg,#fee2e2);color:var(--danger,#b91c1c)}.quick{display:flex;flex-wrap:wrap;gap:8px;padding:10px 17px;border-top:1px solid var(--line)}.quick button{min-height:36px;padding:7px 11px;border:1px solid var(--line);border-radius:99px;background:var(--card);color:var(--ink2);font-size:12px}.composer{display:flex;gap:9px;padding:12px 17px 18px;border-top:1px solid var(--line)}.composer input{flex:1;min-width:0;min-height:43px;padding:8px 12px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font:inherit}.composer button{min-height:43px;padding:8px 16px;border:0;border-radius:10px;background:var(--brand);color:#fff;font-weight:800}.composer button:disabled,.quick button:disabled{opacity:.5}
@media(max-width:850px){.panel{width:min(100vw,500px)}}@media(prefers-reduced-motion:reduce){.panel{transition:none}}
</style>
