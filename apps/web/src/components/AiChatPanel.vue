<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  DISABLED_TEXT,
  LIMITED_TEXT,
  chatCostFront,
  contextLabel,
  initialAiState,
  modeDirective,
  quickAsks,
  reduceAi,
  resolveMode,
  type AiEvent,
  type AiMode,
  type AiState,
} from "../features/ai/aiPanel";

/**
 * AI 聊天面板（16 WD6：右下滑出 40% · 双入口由 D5 决定；此处为全局气泡+面板）。
 * 状态机=reduceAi（纯，单测覆盖）；流式=本地模拟帧（真实 SSE 走 shared.createSseParser + fetch 流，B30 接线）。
 */
const open = ref(false);
const mode = ref<AiMode | null>(null);
const resolvedMode = computed(() => resolveMode(mode.value));
const state = ref<AiState>(initialAiState());
const input = ref("");
const usedToday = ref(0);
const ctx = ref<{ type: "question" | "formula"; id: number | string; title?: string } | null>(null);

const modeText = computed(() => modeDirective(resolvedMode.value));
const ctxText = computed(() => contextLabel(ctx.value));
const cost = computed(() => chatCostFront(usedToday.value));
const canSend = computed(() => state.value.status !== "streaming" && state.value.enabled);

const streamEl = ref<HTMLElement | null>(null);
watch(
  () => state.value.msgs.map((m) => m.content).join("|"),
  async () => {
    await nextTick();
    if (streamEl.value) {
      streamEl.value.scrollTop = streamEl.value.scrollHeight;
    }
  },
);

function dispatch(ev: AiEvent): void {
  state.value = reduceAi(state.value, ev);
}

/** 本地模拟流（每 40ms 一片，5 片 + done 帧）——真实实现替换为 EventSource/fetch 流。 */
let simTimer: ReturnType<typeof setTimeout> | null = null;
function send(): void {
  const text = input.value.trim();
  if (!text) return;
  dispatch({ type: "send", text });
  if (state.value.status !== "streaming") return;
  input.value = "";
  usedToday.value += 1;
  const chunks = ["我们把问题拆成三步：", "①条件给了什么；", "②目标缺什么；", "③桥梁选哪个。", "你想先看哪边？"];
  let i = 0;
  if (simTimer) clearTimeout(simTimer);
  const tick = (): void => {
    if (state.value.status !== "streaming") return;
    if (i < chunks.length) {
      dispatch({ type: "frame", frame: { event: "message", data: JSON.stringify({ delta: chunks[i] }) } });
      i += 1;
      simTimer = setTimeout(tick, 40);
    } else {
      dispatch({ type: "frame", frame: { event: "done", data: '{"usage":{"tokens":42}}' } });
    }
  };
  simTimer = setTimeout(tick, 60);
}

function toggleMode(): void {
  mode.value = resolvedMode.value === "SOCRATIC" ? "DIRECT" : null;
}
function togglePower(): void {
  dispatch({ type: "toggle-enabled" });
}
function quick(q: string): void {
  input.value = q;
  send();
}

/** 暴露给深钻等入口：带上下文唤起。 */
function openWithContext(subject?: { type: "question" | "formula"; id: number | string; title?: string }): void {
  ctx.value = subject ?? null;
  open.value = true;
}
defineExpose({ openWithContext });
</script>

<template>
  <!-- 气泡（WD6 右下全局入口 · 3100 时隐藏） -->
  <button v-if="state.enabled" class="fab" aria-label="AI 助手" @click="open = !open">π</button>

  <!-- 面板（40% 滑出） -->
  <aside class="panel" :class="{ on: open }">
    <header class="phead">
      <b>AI 导师 · {{ resolvedMode === "SOCRATIC" ? "苏格拉底模式" : "直接讲解模式" }}</b>
      <button class="chip" @click="toggleMode">{{ resolvedMode === "SOCRATIC" ? "切换直接讲解" : "切换苏格拉底" }}</button>
      <button class="chip grey" title="Provider 开关（3100 演示）" @click="togglePower">⏻</button>
      <span class="x" @click="open = false">✕</span>
    </header>
    <div class="ctx">{{ ctxText }}</div>
    <p class="directive">📌 {{ modeText }}</p>

    <div ref="streamEl" class="stream">
      <div v-if="!state.enabled" class="banner bad">{{ DISABLED_TEXT }} · 入口已按降级原则隐藏（防御态）</div>
      <div v-if="state.enabled && state.status === 'error' && state.errorCode === 3102" class="banner bad">
        AI 服务暂时不可用（3102）—— 业务不等待，可继续自报断点
      </div>
      <div
        v-for="(m, i) in state.msgs"
        :key="i"
        class="bub"
        :class="m.role"
      >{{ m.content || (m.role === 'ai' && state.status === 'streaming' ? '▍' : '') }}</div>
      <div v-if="state.status === 'error' && state.errorCode === 3101" class="banner bad">{{ LIMITED_TEXT }}</div>
      <div v-if="state.msgs.length === 0 && state.enabled" class="empty">
        把你卡住的那一步告诉我 —— 我默认不直接给答案。
      </div>
    </div>

    <div class="quick">
      <button v-for="q in quickAsks()" :key="q" class="chip" @click="quick(q)">{{ q }}</button>
      <span class="mut">第 {{ usedToday + 1 }} 次对话成本：{{ cost === 0 ? "免费（前 3 次）" : cost + " 分" }}</span>
    </div>

    <footer class="pfoot">
      <input
        v-model="input"
        :disabled="!state.enabled || !canSend"
        placeholder="追问…（Enter 发送）"
        @keydown.enter="send"
      />
      <button class="btn" :disabled="!canSend || !input.trim()" @click="send">发送</button>
      <button class="btn ghost" :disabled="state.msgs.length === 0" @click="dispatch({ type: 'reset' })">清空</button>
    </footer>
  </aside>
</template>

<style scoped>
.fab {
  position: fixed;
  right: 26px;
  bottom: 26px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--grad);
  color: #fff;
  font-size: 24px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 12px 26px -8px rgba(79, 123, 255, 0.6);
  z-index: 70;
}
.panel {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 42%;
  max-width: 560px;
  min-width: 380px;
  background: #fff;
  border-left: 1px solid var(--line);
  z-index: 80;
  transform: translateX(105%);
  transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  display: flex;
  flex-direction: column;
}
.panel.on {
  transform: none;
}
.phead {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 16px 18px 10px;
}
.phead b {
  flex: 1;
  font-size: 15.5px;
}
.chip {
  font-size: 12.5px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 4px 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
}
.chip.grey {
  background: #f1f5f9;
  color: #64748b;
}
.x {
  cursor: pointer;
  color: var(--ink3);
  font-size: 16px;
}
.ctx {
  background: var(--brand-soft);
  border-bottom: 1px solid #e0ebff;
  color: var(--brand-deep);
  font-size: 12.5px;
  padding: 9px 18px;
}
.directive {
  font-size: 12.5px;
  color: var(--ink2);
  padding: 9px 18px;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
}
.stream {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
}
.bub {
  max-width: 86%;
  padding: 10px 14px;
  border-radius: 13px;
  font-size: 14.5px;
  line-height: 1.75;
  margin-bottom: 12px;
  white-space: pre-wrap;
}
.bub.ai {
  background: #f1f3f7;
  border-top-left-radius: 4px;
}
.bub.user {
  background: var(--brand);
  color: #fff;
  margin-left: auto;
  border-top-right-radius: 4px;
}
.banner {
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13.5px;
  font-weight: 600;
  margin-bottom: 12px;
}
.banner.bad {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}
.empty {
  color: var(--ink3);
  font-size: 14px;
  text-align: center;
  padding: 40px 10px;
}
.quick {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 18px;
  flex-wrap: wrap;
  border-top: 1px solid #f1f3f7;
}
.quick .mut {
  color: var(--ink3);
  font-size: 12px;
  margin-left: auto;
}
.pfoot {
  display: flex;
  gap: 9px;
  padding: 12px 18px 18px;
  border-top: 1px solid var(--line);
}
.pfoot input {
  flex: 1;
  height: 42px;
  border-radius: 11px;
  border: 1.5px solid var(--line);
  padding: 0 13px;
  outline: none;
  font-size: 14.5px;
}
.pfoot input:focus {
  border-color: var(--brand);
}
.btn {
  border: none;
  border-radius: 11px;
  background: var(--grad);
  color: #fff;
  font-weight: 700;
  height: 42px;
  padding: 0 18px;
  cursor: pointer;
  font-size: 14.5px;
}
.btn:disabled {
  opacity: 0.45;
}
.btn.ghost {
  background: #eef0f4;
  color: var(--ink2);
}
@media (max-width: 960px) {
  .panel {
    width: 86%;
  }
}
</style>
