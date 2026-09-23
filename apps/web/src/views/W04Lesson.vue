<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { isApiError } from "@learnmath/shared";
import { useRoute, useRouter } from "vue-router";
import { lessonReading, readReceipt, type LessonReading, type ReadReceipt } from "../features/course/learningProjection";
import { learningApi, learningError, safeId } from "../services/learning";

type LoadState = "loading" | "ready" | "empty" | "unmapped" | "error";
const route = useRoute();
const router = useRouter();
const state = ref<LoadState>("loading");
const error = ref("");
const lesson = ref<LessonReading | null>(null);
const receipt = ref<ReadReceipt | null>(null);
const actionBusy = ref(false);
const actionNote = ref("");
const heartbeatNote = ref("");
let timer: ReturnType<typeof setInterval> | null = null;
let pendingSeconds = 0;
let heartbeatBusy = false;
let generation = 0;

const lessonId = computed(() => String(route.params.lessonId ?? ""));
const courseId = computed(() => String(route.params.courseId ?? ""));
const backRoute = computed(() => {
  try { return "/paths/course/" + safeId(courseId.value); }
  catch { return "/paths"; }
});
const readRecorded = computed(() => receipt.value?.readCompleted === true);
const completed = computed(() => receipt.value?.lessonCompleted === true);

function stopHeartbeat(): void {
  if (timer) clearInterval(timer);
  timer = null;
  pendingSeconds = 0;
}

async function sendHeartbeat(current: number, id: string): Promise<void> {
  if (heartbeatBusy || pendingSeconds <= 0) return;
  heartbeatBusy = true;
  const seconds = pendingSeconds;
  try {
    await learningApi.heartbeat(id, seconds);
    if (current === generation) {
      pendingSeconds -= seconds;
      heartbeatNote.value = "";
    }
  } catch (cause) {
    if (current === generation) heartbeatNote.value = "学习时长尚未同步：" + learningError(cause);
  } finally {
    heartbeatBusy = false;
  }
}

function startHeartbeat(current: number, id: string): void {
  stopHeartbeat();
  timer = setInterval(() => {
    if (document.visibilityState !== "visible" || current !== generation) return;
    pendingSeconds += 30;
    void sendHeartbeat(current, id);
  }, 30_000);
}

async function load(): Promise<void> {
  const current = ++generation;
  stopHeartbeat();
  state.value = "loading";
  error.value = "";
  lesson.value = null;
  receipt.value = null;
  actionBusy.value = false;
  actionNote.value = "";
  heartbeatNote.value = "";
  try {
    safeId(lessonId.value);
    safeId(courseId.value);
    const response = await learningApi.lesson(lessonId.value);
    if (current !== generation) return;
    lesson.value = lessonReading(response);
    state.value = lesson.value ? "ready" : response === null || response === undefined ? "empty" : "unmapped";
    if (lesson.value) startHeartbeat(current, lessonId.value);
  } catch (cause) {
    if (current !== generation) return;
    error.value = learningError(cause);
    state.value = "error";
  }
}

async function markRead(): Promise<void> {
  if (state.value !== "ready" || actionBusy.value || readRecorded.value) return;
  const current = generation;
  actionBusy.value = true;
  actionNote.value = "";
  try {
    const response = await learningApi.readLesson(lessonId.value);
    if (current !== generation) return;
    const confirmed = readReceipt(response);
    if (!confirmed) {
      actionNote.value = "阅读请求已返回，但状态字段不完整；暂不能确认已读或完成。";
      return;
    }
    receipt.value = confirmed;
    actionNote.value = confirmed.lessonCompleted
      ? "服务端确认课时已完成。阅读完成不单独代表掌握度提升。"
      : confirmed.readCompleted
        ? "阅读已记录。课时完成仍以随堂练和服务端策略判定。"
        : "服务端尚未确认阅读完成，请稍后重试。";
  } catch (cause) {
    if (current === generation) actionNote.value = "阅读未记录：" + learningError(cause);
  } finally {
    if (current === generation) actionBusy.value = false;
  }
}

async function requestCompletion(): Promise<void> {
  if (!readRecorded.value || completed.value || actionBusy.value) return;
  const current = generation;
  actionBusy.value = true;
  actionNote.value = "";
  try {
    const response = await learningApi.completeLesson(lessonId.value);
    if (current !== generation) return;
    const confirmed = readReceipt(response);
    if (confirmed) receipt.value = confirmed;
    actionNote.value = confirmed?.lessonCompleted
      ? "服务端确认课时已完成。奖励与掌握度以独立服务端记录为准。"
      : "完成请求已由服务端处理，但回执未确认课时完成；请刷新课程进度核实。";
  } catch (cause) {
    if (current === generation) actionNote.value = isApiError(cause) && cause.code === 3005
      ? "完成条件尚未满足。阅读可记录；随堂练达到当前策略要求后再尝试。"
      : "课时未确认完成：" + learningError(cause);
  } finally {
    if (current === generation) actionBusy.value = false;
  }
}

watch(() => [route.params.courseId, route.params.lessonId], () => { void load(); }, { immediate: true });
onUnmounted(stopHeartbeat);
</script>

<template>
  <main class="lesson-page">
    <nav class="crumb" aria-label="当前位置"><button @click="router.push('/paths')">路径中心</button><span>/</span><button @click="router.push(backRoute)">课程</button><span>/</span><b>{{ lesson?.title || '课时' }}</b></nav>
    <header class="lesson-head">
      <div><span class="eyebrow">LESSON · 专注学习</span><h1>{{ lesson?.title || '课时内容' }}</h1><p>先阅读，再确认；完成与解锁由服务端学习规则决定。</p></div>
      <span class="head-icon" aria-hidden="true">∑</span>
    </header>
    <div v-if="state === 'loading'" class="state-box" role="status">正在读取课时内容…</div>
    <div v-else-if="state === 'error'" class="state-box error" role="alert">课时暂不可用：{{ error }} <button @click="load">重试</button></div>
    <div v-else-if="state === 'empty'" class="state-box">课时暂无可阅读内容。<button @click="router.push(backRoute)">返回课程</button></div>
    <div v-else-if="state === 'unmapped'" class="state-box">服务端已返回课时，但标题或正文结构尚未对齐；为避免展示错误内容，阅读确认暂不可用。<button @click="load">重试</button></div>
    <div v-else class="lesson-grid">
      <article class="reading-card">
        <div class="content-head"><div><span class="eyebrow">READING</span><h2>课时正文</h2></div><span class="content-badge">{{ lesson?.completionPolicy === 'read_only' ? '纯阅读课时' : lesson?.completionPolicy === 'practice_required' ? '随堂练达标后完成' : '完成策略以服务端为准' }}</span></div>
        <p class="render-note">以下保留服务端 Markdown 原文。公式与排版渲染规则待内容接口联调确认。</p>
        <pre class="lesson-content">{{ lesson?.content }}</pre>
        <div v-if="lesson?.videoUrl" class="video-block"><div><span class="video-icon">▶</span><b>本课视频</b></div><a :href="lesson.videoUrl" target="_blank" rel="noopener noreferrer">打开视频 ↗</a></div>
        <div class="reading-action">
          <div><b>{{ readRecorded ? '阅读已记录' : '确认阅读' }}</b><p>点击后向服务端记录阅读；页面滚动和视频时长不会自动视为理解。</p></div>
          <button class="primary" :disabled="actionBusy || readRecorded" @click="markRead">{{ actionBusy ? '提交中…' : readRecorded ? '已由服务端确认' : '我已读完本课时' }}</button>
        </div>
      </article>
      <aside class="lesson-side">
        <section class="side-card status-card">
          <span class="eyebrow">LEARNING STATUS</span><h2>本课进度</h2>
          <div class="status-line"><span>阅读记录</span><b :class="{ confirmed: readRecorded }">{{ receipt ? readRecorded ? '已确认' : '未确认' : '等待回执' }}</b></div>
          <div class="status-line"><span>随堂练达标</span><b :class="{ confirmed: receipt?.practicePassed }">{{ receipt ? receipt.practicePassed ? '已确认' : '未达标' : '等待回执' }}</b></div>
          <div class="status-line"><span>课时完成</span><b :class="{ confirmed: completed }">{{ receipt ? completed ? '已确认' : '未完成' : '等待回执' }}</b></div>
          <button class="complete-button" :disabled="!readRecorded || completed || actionBusy" @click="requestCompletion">{{ completed ? '课时已完成' : '请求完成判定' }}</button>
          <p class="muted">纯阅读课时完成不代表掌握；练习课需满足服务端冻结的随堂练条件。积分只在服务端首次结算后成立。</p>
        </section>
        <section class="side-card practice-card"><span class="eyebrow">PRACTICE</span><h2>随堂练</h2><p>课时接口描述了随堂练引用，但尚未定义题组启动所需字段。本页暂不提供本地判分或虚构练习题。</p><span class="pending">练习入口待接口联调</span></section>
        <div v-if="heartbeatNote" class="sync-note" role="status">{{ heartbeatNote }}</div>
      </aside>
    </div>
    <div v-if="actionNote" class="action-note" role="status">{{ actionNote }}</div>
    <div class="page-bottom"><button @click="router.push(backRoute)">← 返回课程</button></div>
  </main>
</template>

<style scoped>
.lesson-page{max-width:1240px;margin:auto;padding:22px 32px 60px}.crumb{display:flex;align-items:center;gap:10px;color:#91a0b7;font-size:12px;margin-bottom:16px}.crumb button{border:0;background:none;color:#5b74a2;font:inherit;cursor:pointer}.crumb b{color:#384c70;font-weight:700}.lesson-head{display:flex;justify-content:space-between;align-items:center;min-height:165px;padding:30px 37px;border-radius:19px;background:#14244a;color:#fff;overflow:hidden}.eyebrow{font-size:10px;letter-spacing:.18em;font-weight:850;color:#7184a6}.lesson-head .eyebrow{color:#a9c4f6}.lesson-head h1{font-size:clamp(25px,3vw,36px);margin:12px 0 9px}.lesson-head p{font-size:13px;color:#bccbea;line-height:1.7}.head-icon{font:100px Georgia,serif;color:#aac7fa99;line-height:1}.lesson-grid{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(300px,1fr);gap:17px;margin-top:17px;align-items:start}.reading-card,.side-card{background:#fff;border:1px solid #e1e9f4;border-radius:17px;box-shadow:0 8px 25px #1c36550a}.reading-card{padding:30px}.content-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.content-head h2,.side-card h2{font-size:21px;margin-top:6px}.content-badge{font-size:11px;color:#506ca8;background:#eef4ff;border-radius:30px;padding:7px 10px}.render-note,.muted{font-size:12px;line-height:1.7;color:#8793a7}.render-note{margin:25px 0 11px}.lesson-content{white-space:pre-wrap;overflow-wrap:anywhere;font:15px/2 var(--font-sans);color:#263a5b;min-height:210px;padding:23px;border:1px solid #edf1f7;border-radius:11px;background:#fafcff}.video-block{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:18px;padding:16px;border:1px solid #e1e9f4;border-radius:11px;background:#f7faff}.video-block>div{display:flex;align-items:center;gap:10px;font-size:14px}.video-icon{display:grid;place-items:center;width:31px;height:31px;border-radius:50%;background:#e5edff;color:#315bd1;font-size:11px}.video-block a{font-size:12px;font-weight:750;color:#315fc7;text-decoration:none}.reading-action{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:27px;padding-top:23px;border-top:1px solid #e7edf5}.reading-action b{font-size:16px}.reading-action p{font-size:12px;line-height:1.6;color:#7a879f;margin-top:6px}.primary,.complete-button{border:0;border-radius:9px;background:#3261dc;color:#fff;padding:11px 16px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}.primary:disabled,.complete-button:disabled{background:#bec9d9;cursor:default}.lesson-side{display:flex;flex-direction:column;gap:15px}.side-card{padding:22px}.side-card h2{margin-bottom:17px}.status-line{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #edf1f7;padding:12px 0;font-size:12px;color:#61738e}.status-line b{color:#8b98ad;font-size:12px}.status-line b.confirmed{color:#14856a}.complete-button{width:100%;margin-top:12px}.muted{margin-top:12px}.practice-card p{font-size:12px;line-height:1.8;color:#74839c}.pending{display:inline-block;font-size:11px;font-weight:750;color:#92702c;background:#fff7e7;border-radius:20px;padding:6px 10px;margin-top:15px}.state-box,.action-note,.sync-note{padding:15px 17px;border-radius:10px;background:#eff5ff;border:1px solid #d9e5f6;color:#425d87;font-size:13px;line-height:1.7;margin-top:17px}.state-box.error{background:#fff3f3;border-color:#f1d0d0;color:#a04040}.state-box button{border:0;background:none;color:inherit;text-decoration:underline;margin-left:8px;cursor:pointer}.action-note{background:#f1f8f5;border-color:#d4ebe0;color:#315d4c}.sync-note{margin:0;background:#fff8ed;border-color:#f1dfbd;color:#836434}.page-bottom{margin-top:21px}.page-bottom button{border:0;background:none;color:#4770b5;font-weight:750;cursor:pointer}@media(max-width:920px){.lesson-grid{grid-template-columns:1fr}.lesson-side{display:grid;grid-template-columns:1fr 1fr}.sync-note{grid-column:1/-1}}@media(max-width:640px){.lesson-page{padding:16px 16px 48px}.lesson-head{padding:25px}.head-icon{display:none}.reading-card{padding:20px}.lesson-side{display:flex}.reading-action{align-items:stretch;flex-direction:column}.primary{align-self:flex-start}.content-head{align-items:start;flex-direction:column}}
</style>
