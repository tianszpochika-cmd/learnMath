<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { ApiError } from "@learnmath/shared";
import { useRoute, useRouter } from "vue-router";
import { MATH_SYMBOLS, formatCountdown, insertMath } from "../features/attempt/attemptUi";
import { draftKey, draftRecovery, parseLocalDraft, type LocalDraft } from "../features/attempt/draftRecovery";
import { readAttempt, sendAttemptAction, serverRemainingMs, type AttemptItem, type AttemptView } from "../services/attempts";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const attemptId = computed(() => String(route.params.attemptId || ""));
const attempt = ref<AttemptView | null>(null);
const loading = ref(true);
const busy = ref(false);
const navigating = ref(false);
const draftSaving = ref(false);
const error = ref("");
const notice = ref("");
const currentSeq = ref(1);
const answer = ref("");
const sheetOpen = ref(false);
const confirmOpen = ref(false);
const elapsed = ref(0);
const offline = ref(false);
const draftChoice = ref<{ local: LocalDraft; server: string; mode: "restore" | "compare" | "copy-only" } | null>(null);
const lastConfirmedAt = ref("");
let loadedAt = 0;
let tick: ReturnType<typeof setInterval> | undefined;
let draftTimer: ReturnType<typeof setTimeout> | undefined;
let saveQueue: Promise<boolean> = Promise.resolve(true);

const item = computed(() => attempt.value?.items.find((entry) => entry.seq === currentSeq.value) ?? null);
const active = computed(() => ["1", "active", "in_progress"].includes((attempt.value?.status || "").toLowerCase()));
const remaining = computed(() => serverRemainingMs(attempt.value?.serverNow || "", attempt.value?.deadlineAt || "", elapsed.value));
const remainingLabel = computed(() => remaining.value === null ? "以服务端时间为准" : formatCountdown(remaining.value));
const answeredCount = computed(() => attempt.value?.items.filter((entry) => entry.submitted || Boolean(entry.draft)).length ?? 0);
const flagCount = computed(() => attempt.value?.items.filter((entry) => entry.flagged).length ?? 0);
const writable = computed(() => active.value && !!item.value && !item.value.locked && !item.value.optionError && !!attempt.value?.revisionKnown && !!attempt.value.feedbackMode && !draftChoice.value && remaining.value !== 0);
const canEdit = computed(() => writable.value && !busy.value && !navigating.value);
const immediateFeedback = computed(() => attempt.value?.feedbackMode === "immediate" && item.value?.submitted && !!item.value.judgement);

function syncActiveMarker(view: AttemptView, id: string) {
  if (!auth.userId || typeof window === "undefined") return;
  const key = `lm.web.activeAttempt:${auth.userId}`;
  try {
    const before = sessionStorage.getItem(key);
    let after = before;
    if (["active", "in_progress", "1"].includes(view.status.toLowerCase())) {
      after = JSON.stringify({ attemptId: id, restricted: true });
      sessionStorage.setItem(key, after);
    } else if (["submitted", "pending_self_assess", "finalized", "expired", "cancelled"].includes(view.status.toLowerCase())) {
      const marked = before ? JSON.parse(before) as { attemptId?: string } : null;
      if (marked?.attemptId === id) {
        sessionStorage.removeItem(key);
        after = null;
      }
    }
    if (before !== after) window.dispatchEvent(new Event("lm:active-attempt-change"));
  } catch { /* storage unavailable: never use this marker as authorization */ }
}

function resetServerClock() {
  loadedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  elapsed.value = 0;
}

async function load(keepSeq = true) {
  const id = attemptId.value;
  cancelDraftTimer();
  loading.value = true;
  error.value = "";
  try {
    const view = await readAttempt(id);
    if (id !== attemptId.value) return;
    attempt.value = view;
    syncActiveMarker(view, id);
    if (!keepSeq || !view.items.some((entry) => entry.seq === currentSeq.value)) currentSeq.value = view.items[0]?.seq ?? 1;
    resetServerClock();
    restoreDraft(view.items.find((entry) => entry.seq === currentSeq.value) ?? null);
  } catch (cause) {
    if (id !== attemptId.value) return;
    attempt.value = null;
    error.value = cause instanceof Error ? cause.message : "作答暂时无法读取，请稍后重试。";
  } finally {
    loading.value = false;
  }
}

function localKey(seq: number) { return draftKey(auth.userId, attemptId.value, seq); }
function restoreDraft(next: AttemptItem | null) {
  const key = next && localKey(next.seq);
  let local: LocalDraft | null = null;
  try { local = key ? parseLocalDraft(localStorage.getItem(key)) : null; } catch { /* storage unavailable */ }
  const server = next?.draft ?? "";
  const canRestore = active.value && remaining.value !== 0 && !!attempt.value?.revisionKnown && !!attempt.value.feedbackMode && !!next && !next.locked && !next.optionError;
  const mode = draftRecovery(server, attempt.value?.revision ?? 0, local, canRestore);
  draftChoice.value = local && mode !== "none" ? { local, server, mode } : null;
  answer.value = server;
  if (local && mode === "none") clearLocal(next!.seq);
}
function saveLocal() {
  const key = localKey(currentSeq.value);
  if (!key || !attempt.value || !writable.value) return;
  try { localStorage.setItem(key, JSON.stringify({ value: answer.value, baseRevision: attempt.value.revision, updatedAt: Date.now() })); } catch { /* storage unavailable */ }
  scheduleDraft();
}
function clearLocal(seq: number) {
  const key = localKey(seq);
  try { if (key) localStorage.removeItem(key); } catch { /* storage unavailable */ }
}
function chooseDraft(source: "local" | "server") {
  if (!draftChoice.value) return;
  answer.value = source === "local" ? draftChoice.value.local.value : draftChoice.value.server;
  if (source === "server") clearLocal(currentSeq.value);
  draftChoice.value = null;
  if (source === "local") saveLocal();
}

async function selectItem(next: AttemptItem) {
  if (navigating.value || next.seq === currentSeq.value) { sheetOpen.value = false; return; }
  if (draftChoice.value && draftChoice.value.mode !== "copy-only") {
    error.value = "请先选择本地或服务端草稿，再切换题目。";
    return;
  }
  navigating.value = true;
  try {
    if (attempt.value && item.value && answer.value !== item.value.draft && !draftChoice.value) {
      // BR-07: the current answer must reach the server immediately on a question switch.
      const saved = await flushDraft();
      if (draftChoice.value) return;
      if (!saved) {
        let local: LocalDraft | null = null;
        try { local = parseLocalDraft(localStorage.getItem(localKey(currentSeq.value) ?? "")); } catch { /* storage unavailable */ }
        if (!local || local.value !== answer.value) {
          error.value ||= "当前答案尚未获服务端确认，且无法保存到本机；请先重试保存。";
          return;
        }
      }
    }
    currentSeq.value = next.seq;
    restoreDraft(attempt.value?.items.find((entry) => entry.seq === next.seq) ?? null);
    notice.value = "";
    sheetOpen.value = false;
  } finally {
    navigating.value = false;
  }
}

function addSymbol(symbol: string) {
  const result = insertMath(answer.value, symbol, answer.value.length);
  answer.value = result.value;
  saveLocal();
}

function requestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cancelDraftTimer() {
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = undefined;
}

function scheduleDraft() {
  cancelDraftTimer();
  if (!writable.value || !item.value || answer.value === item.value.draft) return;
  // BR-07: edit locally at once, save to the server after two quiet seconds.
  draftTimer = setTimeout(() => { void flushDraft(); }, 2_000);
}

async function refreshAfterConflict(seq: number, attempted: string, baseRevision: number) {
  cancelDraftTimer();
  const id = attemptId.value;
  try {
    const latest = await readAttempt(id);
    if (id !== attemptId.value) return;
    attempt.value = latest;
    syncActiveMarker(latest, id);
    resetServerClock();
    const latestItem = latest.items.find((entry) => entry.seq === seq);
    const server = latestItem?.draft ?? "";
    let local: LocalDraft | null = null;
    try { local = parseLocalDraft(localStorage.getItem(localKey(seq) ?? "")); } catch { /* storage unavailable */ }
    local ??= { value: attempted, baseRevision, updatedAt: Date.now() };
    const canRestore = active.value && remaining.value !== 0 && latest.revisionKnown && !!latest.feedbackMode && !!latestItem && !latestItem.locked && !latestItem.optionError;
    const mode = draftRecovery(server, latest.revision, local, canRestore);
    if (mode !== "none") {
      draftChoice.value = { local, server, mode };
      answer.value = server;
    }
    error.value = mode === "none" ? "服务端版本已变化，请重试保存。" : "草稿版本已变化。请并排核对本地输入与服务端答案后再提交。";
  } catch {
    error.value = "草稿版本已变化，且暂时无法读取服务端版本。本机输入已保留，请稍后重试。";
  }
}

async function writeCurrentDraft(): Promise<boolean> {
  const view = attempt.value;
  const entry = item.value;
  if (!view || !entry) return false;
  if (draftChoice.value) return false;
  if (answer.value === entry.draft) { clearLocal(entry.seq); return true; }
  if (!writable.value) return false;
  const id = attemptId.value;
  const seq = entry.seq;
  const savedAnswer = answer.value;
  const baseRevision = view.revision;
  draftSaving.value = true;
  error.value = "";
  try {
    await sendAttemptAction(id, "draft", {
      seq,
      answer: savedAnswer,
      expectedRevision: baseRevision,
      requestId: requestId(),
    });
    lastConfirmedAt.value = new Date().toLocaleTimeString();
    const latest = await readAttempt(id);
    if (id !== attemptId.value) return false;
    attempt.value = latest;
    syncActiveMarker(latest, id);
    resetServerClock();
    const confirmed = latest.items.find((candidate) => candidate.seq === seq);
    if (!confirmed || confirmed.draft !== savedAnswer) {
      await refreshAfterConflict(seq, answer.value, baseRevision);
      return false;
    }
    if (currentSeq.value === seq && answer.value === savedAnswer) {
      clearLocal(seq);
      notice.value = "草稿已由服务端保存";
    } else if (currentSeq.value === seq) {
      scheduleDraft();
    }
    return true;
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 3008) {
      await refreshAfterConflict(seq, answer.value, baseRevision);
    } else {
      error.value = cause instanceof Error ? cause.message : "草稿未获服务端确认；本地输入已保留，请重试。";
    }
    return false;
  } finally {
    draftSaving.value = false;
  }
}

function flushDraft(): Promise<boolean> {
  cancelDraftTimer();
  const pending = saveQueue.then(() => writeCurrentDraft());
  saveQueue = pending.catch(() => false);
  return pending;
}

async function persist(kind: "draft" | "answer") {
  if (!canEdit.value || !item.value || !answer.value.trim() || !attempt.value) return;
  if (kind === "draft") { await flushDraft(); return; }
  const seq = item.value.seq;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    if (!await flushDraft()) {
      error.value ||= "草稿尚未由服务端确认，请先核对并重试。";
      return;
    }
    const current = attempt.value;
    if (!current?.revisionKnown || !current.feedbackMode || !active.value || !item.value || item.value.locked) return;
    await sendAttemptAction(attemptId.value, "answer", {
      seq,
      answer: answer.value,
      expectedRevision: current.revision,
      requestId: requestId(),
    });
    clearLocal(seq);
    lastConfirmedAt.value = new Date().toLocaleTimeString();
    await load();
    notice.value = current.feedbackMode === "on_submit" ? "答案已由服务端接收，交卷后查看判分" : "本题已由服务端接收；反馈以服务端结果为准";
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 3008) await refreshAfterConflict(seq, answer.value, attempt.value?.revision ?? 0);
    else error.value = cause instanceof Error ? cause.message : "提交本题未获服务端确认，请重试。";
  } finally {
    busy.value = false;
  }
}

async function submitPaper() {
  if (!active.value || busy.value || !attempt.value?.revisionKnown || !attempt.value.feedbackMode || draftChoice.value) return;
  busy.value = true;
  error.value = "";
  try {
    if (!await flushDraft()) {
      error.value ||= "当前题草稿尚未由服务端确认，交卷已暂停；请核对并重试。";
      return;
    }
    await sendAttemptAction(attemptId.value, "submit", { requestId: requestId() });
    syncActiveMarker({ ...attempt.value!, status: "submitted" }, attemptId.value);
    confirmOpen.value = false;
    await router.replace("/report/attempt/" + encodeURIComponent(attemptId.value));
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "交卷未确认，请检查网络并重试。";
  } finally {
    busy.value = false;
  }
}

function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") { confirmOpen.value = false; sheetOpen.value = false; return; }
  const target = event.target as HTMLElement | null;
  if (target?.closest("input,textarea,[contenteditable=true]") || confirmOpen.value || !attempt.value) return;
  const index = attempt.value.items.findIndex((entry) => entry.seq === currentSeq.value);
  if (event.key === "ArrowLeft" && index > 0) selectItem(attempt.value.items[index - 1]!);
  if (event.key === "ArrowRight" && index < attempt.value.items.length - 1) selectItem(attempt.value.items[index + 1]!);
}

watch(attemptId, () => { void load(false); });
function networkState() {
  offline.value = !navigator.onLine;
  if (!offline.value && writable.value && item.value && answer.value !== item.value.draft) void flushDraft();
}
onMounted(() => {
  void load(false);
  networkState();
  window.addEventListener("online", networkState);
  window.addEventListener("offline", networkState);
  tick = setInterval(() => { elapsed.value = Math.max(0, (typeof performance !== "undefined" ? performance.now() : Date.now()) - loadedAt); }, 1000);
  document.addEventListener("keydown", onKey);
});
onUnmounted(() => { cancelDraftTimer(); if (tick) clearInterval(tick); document.removeEventListener("keydown", onKey); window.removeEventListener("online", networkState); window.removeEventListener("offline", networkState); });
</script>

<template>
  <div class="paper-page">
    <header class="paper-header">
      <RouterLink to="/wrongbook" class="back">← 返回</RouterLink>
      <div><p class="eyebrow">FOCUS MODE · 专注作答</p><h1>{{ attempt?.title || "作答" }}</h1></div>
      <span class="clock" :class="{ urgent: remaining !== null && remaining < 60_000 }" aria-live="off">{{ remainingLabel }}</span>
      <button class="sheet-toggle" type="button" @click="sheetOpen = !sheetOpen">答题卡 {{ answeredCount }}/{{ attempt?.items.length || 0 }}</button>
    </header>

    <p v-if="loading" class="state" role="status">正在读取服务端题面与作答状态…</p>
    <section v-else-if="error && !attempt" class="state" role="alert"><h2>作答暂不可用</h2><p>{{ error }}</p><button type="button" @click="load(false)">重试</button></section>
    <section v-else-if="!attempt?.items.length" class="state"><h2>尚无可作答题面</h2><p>服务端未返回可展示的题目。这里不会填入示例题或代替服务端判分。</p><button type="button" @click="load(false)">重新读取</button></section>
    <div v-else class="layout">
      <main class="question-card" aria-labelledby="question-title">
        <div v-if="offline" class="offline-note" role="status">当前离线。输入可留在本机；上次服务端确认{{ lastConfirmedAt || "时间未知" }}。重新联网后请先核对版本再提交。</div>
        <div class="question-meta"><span>第 {{ currentSeq }} 题 / 共 {{ attempt.items.length }} 题</span><span>{{ item?.type || "题目" }}</span><span v-if="!active" class="closed">已结束 · 只读</span></div>
        <h2 id="question-title">{{ item?.stem }}</h2>
        <div v-if="draftChoice" class="draft-choice" role="alert">
          <strong>{{ draftChoice.mode === 'copy-only' ? '本地草稿仅供学习笔记' : draftChoice.mode === 'compare' ? '服务端版本已变化，请核对两份答案' : '发现尚未同步的本地草稿' }}</strong>
          <p v-if="draftChoice.mode === 'copy-only'">服务端当前未开放继续提交这份草稿。可复制下方文本留作学习笔记。</p>
          <div class="draft-columns"><div><span>服务端答案</span><pre>{{ draftChoice.server || '尚无服务端草稿' }}</pre></div><div><span>本地草稿</span><pre>{{ draftChoice.local.value }}</pre></div></div>
          <div v-if="draftChoice.mode !== 'copy-only'" class="draft-actions"><button type="button" @click="chooseDraft('server')">使用服务端答案</button><button type="button" @click="chooseDraft('local')">使用本地草稿</button></div>
        </div>
        <p v-if="active && !attempt.revisionKnown" class="error" role="alert">服务端未返回可确认的草稿版本，本次作答暂不可编辑。</p>
        <p v-else-if="active && !attempt.feedbackMode" class="error" role="alert">服务端未返回本次作答的反馈策略，本次作答暂不可编辑。</p>
        <p v-else-if="item?.optionError" class="error" role="alert">题目选项缺少有效的选项 key，暂不可作答。请刷新后重试。</p>
        <fieldset v-if="item?.options.length && !item.optionError" :disabled="!canEdit">
          <legend>选择答案</legend>
          <label v-for="option in item.options" :key="option.key" class="option" :class="{ selected: answer === option.key }">
            <input v-model="answer" type="radio" :value="option.key" @change="saveLocal"><b>{{ option.key }}</b><span>{{ option.text }}</span>
          </label>
        </fieldset>
        <div v-else-if="!item?.optionError" class="free-answer"><label for="answer-input">你的作答</label><textarea id="answer-input" v-model="answer" rows="6" :disabled="!canEdit" placeholder="写下你的推理或答案" @input="saveLocal" /></div>
        <div v-if="!item?.options.length && !item?.optionError && canEdit" class="mathbar" aria-label="数学符号工具条"><button v-for="symbol in MATH_SYMBOLS" :key="symbol" type="button" @click="addSymbol(symbol)">{{ symbol }}</button></div>
        <div class="actions">
          <button type="button" class="subtle" :disabled="!canEdit || !answer.trim() || draftSaving" @click="persist('draft')">{{ draftSaving ? "同步中…" : "保存草稿" }}</button>
          <button type="button" class="primary" :disabled="!canEdit || !answer.trim()" @click="persist('answer')">{{ busy ? "提交中…" : "提交本题" }}</button>
          <button type="button" class="text-button" :disabled="!item" @click="item && (item.flagged = !item.flagged)">{{ item?.flagged ? "取消标记" : "标记稍后检查" }}</button>
        </div>
        <p v-if="immediateFeedback" class="feedback" :class="item?.judgement || ''">{{ item?.judgement === "correct" ? "服务端判定：正确" : item?.judgement === "incorrect" ? "服务端判定：需要再看" : "等待服务端判定" }}</p>
        <p v-else-if="item?.submitted" class="feedback">已提交。判分与解析按本次作答策略开放。</p>
        <p v-if="draftSaving" class="feedback" role="status">正在向服务端保存当前草稿…</p>
        <p v-if="notice" class="feedback" role="status">{{ notice }}</p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <div class="question-nav"><button type="button" :disabled="currentSeq === attempt.items[0]?.seq" @click="selectItem(attempt.items[attempt.items.findIndex((entry) => entry.seq === currentSeq) - 1]!)">← 上一题</button><button type="button" :disabled="currentSeq === attempt.items[attempt.items.length - 1]?.seq" @click="selectItem(attempt.items[attempt.items.findIndex((entry) => entry.seq === currentSeq) + 1]!)">下一题 →</button></div>
      </main>
      <aside class="sheet" :class="{ open: sheetOpen }" aria-label="答题卡">
        <div class="sheet-head"><h2>答题卡</h2><button class="sheet-close" type="button" @click="sheetOpen = false">关闭</button></div>
        <p>已答 {{ answeredCount }} · 标记 {{ flagCount }} · 共 {{ attempt.items.length }} 题</p>
        <div class="sheet-grid"><button v-for="entry in attempt.items" :key="entry.seq" type="button" :class="{ current: entry.seq === currentSeq, answered: entry.submitted || !!entry.draft, flagged: entry.flagged }" :aria-label="`第 ${entry.seq} 题${entry.submitted || entry.draft ? '，已答' : ''}${entry.flagged ? '，已标记' : ''}`" @click="selectItem(entry)">{{ entry.seq }}</button></div>
        <p class="sheet-note">标记仅辅助本次页面检查；草稿和提交状态以服务端为准。</p>
        <button class="submit" type="button" :disabled="!active || busy || !attempt.revisionKnown || !attempt.feedbackMode || !!draftChoice" @click="confirmOpen = true">交卷</button>
      </aside>
    </div>

    <div v-if="confirmOpen" class="overlay" @click.self="confirmOpen = false"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="submit-title"><p class="eyebrow">FINAL CHECK</p><h2 id="submit-title">确认交卷？</h2><p>已答 {{ answeredCount }}/{{ attempt?.items.length || 0 }} 题，{{ (attempt?.items.length || 0) - answeredCount }} 题未答。提交后按服务端状态生成报告。</p><p class="dialog-note">剩余时间 {{ remainingLabel }}；到期判定和幂等交卷以服务端为准。</p><div class="actions"><button type="button" class="subtle" @click="confirmOpen = false">继续作答</button><button type="button" class="primary" :disabled="busy" @click="submitPaper">{{ busy ? "提交中…" : "确认交卷" }}</button></div><p v-if="error" class="error" role="alert">{{ error }}</p></section></div>
  </div>
</template>

<style scoped>
.paper-page{min-height:100vh;background:var(--bg,#f5f7fb);color:var(--ink,#14213b)}
.paper-header{display:flex;align-items:center;gap:24px;max-width:1320px;margin:auto;padding:22px 30px;border-bottom:1px solid var(--line,#e0e5ed)}
.back{color:var(--ink3,#64748b);white-space:nowrap}.eyebrow{margin:0 0 5px;color:var(--brand,#2f6bff);font-size:11px;font-weight:800;letter-spacing:.16em}.paper-header h1{font:700 clamp(20px,2.3vw,30px) var(--serif,Georgia,serif);margin:0}.clock{margin-left:auto;padding:10px 14px;border:1px solid var(--line);border-radius:12px;background:var(--card,#fff);font-weight:800;white-space:nowrap}.clock.urgent{color:#a53535;border-color:#e7aeae}.sheet-toggle{display:none}
.layout{display:grid;grid-template-columns:minmax(0,2.1fr) minmax(260px,.9fr);gap:22px;max-width:1320px;margin:auto;padding:30px}.question-card,.sheet,.state{background:var(--card,#fff);border:1px solid var(--line,#e0e5ed);border-radius:22px;padding:30px;box-shadow:0 18px 50px -42px #14213b80}.question-meta{display:flex;flex-wrap:wrap;gap:10px;color:var(--ink3,#64748b);font-size:13px}.question-meta span{padding:5px 9px;background:var(--brand-soft,#eef3ff);border-radius:7px}.question-meta .closed{color:#a53535}.question-card h2{margin:24px 0 26px;font:700 clamp(22px,2.5vw,32px)/1.5 var(--serif,Georgia,serif);white-space:pre-wrap}.question-card fieldset{border:0;padding:0;margin:0}.question-card legend,.free-answer label{font-size:13px;font-weight:800;color:var(--ink2,#334155);margin-bottom:12px}.option{display:flex;align-items:center;gap:14px;min-height:56px;margin:10px 0;padding:11px 16px;border:1px solid var(--line);border-radius:12px;cursor:pointer}.option.selected{border-color:var(--brand);background:var(--brand-soft,#eef3ff)}.option input{accent-color:var(--brand);width:18px;height:18px}.option b{color:var(--brand)}.free-answer textarea{box-sizing:border-box;display:block;width:100%;resize:vertical;padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink);font:inherit;line-height:1.7}.mathbar{display:flex;flex-wrap:wrap;gap:7px;margin-top:13px}.mathbar button{min-width:37px;min-height:37px;border:1px solid var(--line);border-radius:8px;background:var(--soft);color:var(--ink)}.actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:23px}.actions button,.submit,.state button{min-height:43px;padding:10px 17px;border-radius:10px;font-weight:800;cursor:pointer}.primary,.submit,.state button{border:1px solid var(--brand);background:var(--brand);color:var(--on-brand,#fff)}.subtle{border:1px solid var(--line);background:var(--card);color:var(--ink)}.text-button{border:0;background:transparent;color:var(--ink2)}button:disabled{opacity:.5;cursor:not-allowed}.feedback{padding:11px 14px;border-radius:10px;background:var(--brand-soft,#eef3ff);color:var(--ink2);font-size:13px}.feedback.correct{background:#e3f5e9;color:#1c6836}.feedback.incorrect,.error{background:#fff0ef;color:#a53535}.error{padding:10px 13px;border-radius:9px}.question-nav{display:flex;justify-content:space-between;border-top:1px solid var(--line);margin-top:30px;padding-top:22px}.question-nav button{border:0;background:transparent;color:var(--brand);font-weight:700}.sheet{align-self:start;position:sticky;top:20px}.sheet-head{display:flex;align-items:center;justify-content:space-between}.sheet h2{margin:0;font:700 22px var(--serif,Georgia,serif)}.sheet p{color:var(--ink3);font-size:13px;line-height:1.6}.sheet-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:22px 0}.sheet-grid button{aspect-ratio:1;border:1px solid var(--line);border-radius:9px;background:var(--soft);color:var(--ink);font-weight:800}.sheet-grid button.answered{background:var(--brand-soft);color:var(--brand)}.sheet-grid button.current{outline:2px solid var(--brand)}.sheet-grid button.flagged::after{content:'•';color:#c74747}.sheet-note{border-top:1px solid var(--line);padding-top:14px}.submit{width:100%;margin-top:12px}.sheet-close{display:none}.state{max-width:720px;margin:30px auto;line-height:1.7}.state h2{font:700 27px var(--serif,Georgia,serif)}.overlay{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:#0b1634a8}.dialog{width:min(100%,450px);padding:29px;border-radius:20px;background:var(--card,#fff);color:var(--ink)}.dialog h2{font:700 29px var(--serif,Georgia,serif);margin:7px 0}.dialog p{line-height:1.7}.dialog-note{color:var(--ink3);font-size:13px}
.offline-note,.draft-choice{margin-bottom:20px;padding:15px 17px;border:1px solid var(--warning,#a16207);border-radius:12px;background:var(--warning-bg,#fff7e1);color:var(--ink);font-size:13px;line-height:1.7}.draft-choice strong{font-size:15px}.draft-choice p{margin:7px 0}.draft-columns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:13px}.draft-columns>div{min-width:0;padding:12px;border:1px solid var(--line);border-radius:9px;background:var(--card)}.draft-columns span{font-size:12px;color:var(--ink3);font-weight:800}.draft-columns pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}.draft-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.draft-actions button{min-height:40px;padding:8px 12px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);font-weight:750}
@media(max-width:860px){.layout{grid-template-columns:1fr}.sheet{position:fixed;z-index:60;inset:auto 0 0;max-height:75vh;overflow:auto;border-radius:20px 20px 0 0;transform:translateY(110%);transition:transform .25s}.sheet.open{transform:translateY(0)}.sheet-toggle,.sheet-close{display:block;min-height:40px;padding:7px 11px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink)}.paper-header{flex-wrap:wrap}.clock{margin-left:auto}}
@media(max-width:600px){.paper-header{gap:10px;padding:14px 16px}.paper-header>div{order:3;width:100%}.layout{padding:14px}.question-card{padding:20px}.clock{margin-left:auto;font-size:12px}.sheet-toggle{font-size:12px}.sheet-grid{grid-template-columns:repeat(6,1fr)}.draft-columns{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.sheet{transition:none}}
</style>
