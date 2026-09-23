<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { objectiveView } from "../features/attempt/attemptUi";
import { readAttempt, sendAttemptAction, type AttemptView } from "../services/attempts";

const route = useRoute();
const attemptId = computed(() => String(route.params.id || ""));
const report = ref<AttemptView | null>(null);
const loading = ref(true);
const busySeq = ref<number | null>(null);
const error = ref("");
const notice = ref("");
const score = computed(() => objectiveView(report.value?.objectiveEarned ?? 0, report.value?.objectivePossible ?? 0, report.value?.objectiveRate ?? null));
const essays = computed(() => report.value?.items.filter((item) => item.type.toUpperCase() === "ESSAY") ?? []);
const finished = computed(() => Boolean(report.value && ["submitted", "pending_self_assess", "finalized"].includes(report.value.status.toLowerCase())));

async function load() {
  loading.value = true;
  error.value = "";
  try { report.value = await readAttempt(attemptId.value); }
  catch (cause) { report.value = null; error.value = cause instanceof Error ? cause.message : "报告暂时无法读取。"; }
  finally { loading.value = false; }
}

async function assess(seq: number, value: 0 | 1 | 2 | 3) {
  if (!report.value || !finished.value || busySeq.value !== null) return;
  busySeq.value = seq;
  notice.value = "";
  error.value = "";
  try {
    await sendAttemptAction(attemptId.value, "self-assess", {
      seq,
      assess: value,
      expectedRevision: report.value.revision,
      requestId: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${seq}`,
    });
    await load();
    notice.value = "自评已由服务端确认。客观成绩不会因此重新结算。";
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "自评尚未保存，请重试。"; }
  finally { busySeq.value = null; }
}

watch(attemptId, () => { void load(); });
onMounted(() => { void load(); });
</script>

<template>
  <div class="report-page">
    <header class="report-hero"><RouterLink to="/wrongbook" class="back">← 错题本</RouterLink><p class="eyebrow">LEARNING REPORT · 学习报告</p><h1>看清结果，再决定下一步</h1><p>客观成绩与解答题自评分开展示；所有结果以服务端作答报告为准。</p></header>
    <p v-if="loading" class="state" role="status">正在读取本次作答报告…</p>
    <section v-else-if="!report" class="state" role="alert"><h2>报告暂不可用</h2><p>{{ error || "尚未取得服务端报告。" }}</p><button type="button" @click="load">重试</button></section>
    <section v-else-if="!finished" class="state"><h2>作答尚未结束</h2><p>报告与解析会在服务端确认交卷后展示。当前不会提前显示正确答案。</p><RouterLink :to="'/paper/' + encodeURIComponent(attemptId)">返回作答 →</RouterLink></section>
    <main v-else class="report-main">
      <div class="summary-grid"><section class="summary-card primary-card"><span>客观部分</span><strong>{{ score.main }}</strong><p>{{ score.sub || "这次没有适用的客观分数" }}</p></section><section class="summary-card"><span>待自评解答题</span><strong>{{ report.pendingSelfAssess }}</strong><p>自评仅记录主观学习状态，不并入客观准确率</p></section><section class="summary-card"><span>报告状态</span><strong class="status-label">{{ report.status }}</strong><p>交卷状态由服务端维护</p></section></div>
      <div class="report-grid"><section class="content-card"><p class="eyebrow">REFLECTION</p><h2>解答题自评</h2><p class="intro">按自己的实际理解选择；可以暂不评价。修改自评不会重复结算客观事件。</p><div v-if="essays.length" class="essay-list"><article v-for="item in essays" :key="item.seq" class="essay"><h3>第 {{ item.seq }} 题</h3><p>{{ item.stem }}</p><div class="choices" role="group" :aria-label="`第 ${item.seq} 题自评`"><button v-for="choice in [{ value: 0, label: '不会' }, { value: 1, label: '半会' }, { value: 2, label: '会' }, { value: 3, label: '暂不评价' }] as const" :key="choice.value" type="button" :class="{ selected: item.selfAssess === choice.value }" :disabled="busySeq !== null" @click="assess(item.seq, choice.value)">{{ choice.label }}</button></div></article></div><p v-else class="empty">服务端未返回可自评的解答题。若报告仍提示待自评，请稍后刷新或联系支持。</p><p v-if="notice" class="feedback" role="status">{{ notice }}</p><p v-if="error" class="error" role="alert">{{ error }}</p></section><aside class="next-card"><p class="eyebrow">NEXT STEP</p><h2>从证据继续学</h2><p>错题本展示服务端保存的错因与断链快照；先核对具体证据，再决定是否重练。</p><RouterLink to="/wrongbook">查看错题与断链 →</RouterLink><RouterLink to="/graph">回到知识图谱 →</RouterLink></aside></div>
    </main>
  </div>
</template>

<style scoped>
.report-page{min-height:100vh;background:var(--bg,#f5f7fb);color:var(--ink,#14213b)}.report-hero{padding:42px max(24px,calc((100vw - 1180px)/2));background:linear-gradient(125deg,#102245,#253a71);color:white}.back{display:inline-block;margin-bottom:25px;color:#cfddff}.eyebrow{margin:0 0 8px;color:var(--brand,#4e7bff);font-size:11px;font-weight:850;letter-spacing:.17em}.report-hero .eyebrow{color:#9bb8ff}.report-hero h1{margin:0;font:700 clamp(28px,4vw,45px)/1.25 var(--serif,Georgia,serif)}.report-hero>p:last-child{color:#cfdbf3;line-height:1.8}.report-main{max-width:1180px;margin:auto;padding:30px 24px 60px}.summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.summary-card,.content-card,.next-card,.state{border:1px solid var(--line,#e0e5ed);border-radius:18px;background:var(--card,#fff);padding:24px}.summary-card span{display:block;color:var(--ink3,#64748b);font-size:13px;font-weight:700}.summary-card strong{display:block;margin:12px 0;font:700 42px var(--serif,Georgia,serif)}.summary-card p{margin:0;color:var(--ink3);font-size:13px;line-height:1.6}.primary-card{border-color:#adc4ff;background:var(--brand-soft,#edf3ff)}.summary-card .status-label{font:800 18px var(--sans,system-ui);overflow-wrap:anywhere}.report-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(270px,1fr);gap:18px;margin-top:18px}.content-card h2,.next-card h2,.state h2{margin:0 0 9px;font:700 27px var(--serif,Georgia,serif)}.intro,.next-card p{color:var(--ink3);line-height:1.7}.essay{padding:22px 0;border-top:1px solid var(--line)}.essay h3{margin:0 0 8px;font-size:15px}.essay p{white-space:pre-wrap;line-height:1.7}.choices{display:flex;flex-wrap:wrap;gap:8px}.choices button,.state button{min-height:42px;padding:8px 13px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);cursor:pointer}.choices button.selected{border-color:var(--brand);background:var(--brand-soft);color:var(--brand);font-weight:800}.choices button:disabled{opacity:.6}.next-card{align-self:start}.next-card a,.state a{display:block;margin-top:16px;color:var(--brand);font-weight:800}.empty{padding:22px;background:var(--soft);border-radius:10px;color:var(--ink3)}.feedback{padding:12px;background:#eaf5ec;color:#23713d;border-radius:9px}.error{padding:12px;background:#fff0ef;color:#a53535;border-radius:9px}.state{max-width:650px;margin:35px auto;line-height:1.7}
@media(max-width:760px){.summary-grid{grid-template-columns:1fr 1fr}.report-grid{grid-template-columns:1fr}.report-hero{padding:28px 22px}}@media(max-width:510px){.summary-grid{grid-template-columns:1fr}.report-main{padding:16px}.summary-card strong{font-size:34px}}
</style>
