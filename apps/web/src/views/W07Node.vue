<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { isApiError } from "@learnmath/shared";
import { useRoute, useRouter } from "vue-router";
import { NARRATIVE_TABS, cardView, missingCards, tabFromQuery, type CardKey } from "../features/graph/graphUi";
import { graphNode, practiceAttemptId, publishedNarrative, verifiedColor, type GraphNode, type PublishedNarrative } from "../features/graph/graphProjection";
import { exploreApi, exploreError } from "../services/explore";

type LoadState = "loading" | "ready" | "empty" | "unmapped" | "error";
const route = useRoute();
const router = useRouter();
const node = ref<GraphNode | null>(null);
const nodeState = ref<LoadState>("loading");
const nodeError = ref("");
const narrative = ref<PublishedNarrative | null>(null);
const narrativeState = ref<LoadState>("loading");
const tab = ref<CardKey>(tabFromQuery(route.query.card));
const actionBusy = ref(false);
const actionNote = ref("");
let generation = 0;

const id = computed(() => Number(route.params.id));
const color = computed(() => node.value ? verifiedColor(node.value) : "unverified");
const score = computed(() => (color.value === "green" || color.value === "yellow") && typeof node.value?.score === "number"
  ? Math.round(node.value.score) + "%" : "—");
const status = computed(() => ({
  green: "掌握度已确认", yellow: "需要巩固", locked: "前置锁定", preparing: "内容筹备中",
  "sample-low": "样本不足", "no-data": "尚未测量", unverified: "证据状态待核实",
})[color.value]);
const canPractice = computed(() => node.value?.locked === false && node.value.preparing === false);
const missing = computed(() => narrative.value ? missingCards(narrative.value.cards) : NARRATIVE_TABS.map((item) => item.label));

function setTab(next: CardKey): void {
  tab.value = next;
  void router.replace({ query: { ...route.query, card: next } });
}
async function load(): Promise<void> {
  const current = ++generation;
  node.value = null;
  narrative.value = null;
  nodeState.value = "loading";
  narrativeState.value = "loading";
  nodeError.value = "";
  actionNote.value = "";
  if (!Number.isSafeInteger(id.value) || id.value <= 0) {
    nodeState.value = "error";
    narrativeState.value = "error";
    nodeError.value = "无效的知识点编号";
    return;
  }
  const [nodeResult, narrativeResult] = await Promise.allSettled([exploreApi.node(id.value), exploreApi.narrative(id.value)]);
  if (current !== generation) return;
  if (nodeResult.status === "rejected") {
    nodeState.value = "error";
    nodeError.value = exploreError(nodeResult.reason);
  } else {
    node.value = graphNode(nodeResult.value);
    nodeState.value = node.value ? "ready" : nodeResult.value === null || nodeResult.value === undefined ? "empty" : "unmapped";
  }
  if (narrativeResult.status === "rejected") narrativeState.value = "error";
  else {
    narrative.value = publishedNarrative(narrativeResult.value);
    narrativeState.value = narrative.value ? "ready" : "empty";
  }
}
async function startPractice(): Promise<void> {
  if (!node.value || !canPractice.value || actionBusy.value) return;
  actionBusy.value = true;
  actionNote.value = "";
  try {
    const response = await exploreApi.startPractice(node.value.id);
    const attemptId = practiceAttemptId(response);
    if (attemptId) void router.push("/paper/" + attemptId);
    else actionNote.value = "服务端未返回作答编号，暂不进入练习。";
  } catch (cause) {
    actionNote.value = isApiError(cause) && cause.code === 3311
      ? "前置条件未满足，服务端拒绝进入练习。"
      : "练习未启动：" + exploreError(cause);
  } finally {
    actionBusy.value = false;
  }
}
watch(() => route.params.id, () => { void load(); }, { immediate: true });
watch(() => route.query.card, () => { tab.value = tabFromQuery(route.query.card); });
</script>

<template>
  <main class="node-page">
    <button class="back" @click="router.push('/graph')">← 返回知识图谱</button>
    <div v-if="nodeState === 'loading'" class="notice" role="status">正在读取知识点与已发布概念卡…</div>
    <div v-else-if="nodeState === 'error'" class="notice error" role="alert">知识点暂不可用：{{ nodeError }} <button @click="load">重试</button></div>
    <div v-else-if="nodeState === 'empty'" class="notice">这个知识点暂无可展示详情。</div>
    <div v-else-if="nodeState === 'unmapped'" class="notice">知识点字段尚未对齐；暂不展示可能错误的掌握度与关联资源。</div>
    <template v-else>
      <header class="node-head"><div><span class="eyebrow">KNOWLEDGE NODE · #{{ node?.id }}</span><h1>{{ node?.name }}</h1><p>{{ node?.description || '定义与说明待内容补全。' }}</p></div><div class="score-card"><b>{{ score }}</b><span>{{ status }}</span></div></header>
      <div class="content-grid">
        <section class="main-card">
          <div class="section-title"><span class="eyebrow">MATHEMATICS & THE WORLD</span><h2>从概念到能力</h2><p>这里只读取已发布的四卡快照；空字段保持待补全。</p></div>
          <nav class="tabs"><button v-for="item in NARRATIVE_TABS" :key="item.key" :class="{ active: tab === item.key }" @click="setTab(item.key)">{{ item.label }}</button></nav>
          <div v-if="narrativeState === 'loading'" class="story">正在读取已发布内容…</div>
          <div v-else-if="narrativeState === 'error'" class="story missing">概念卡暂不可用。</div>
          <div v-else class="story" :class="{ missing: cardView(tab, narrative?.cards).missing }">{{ cardView(tab, narrative?.cards).text }}</div>
          <div class="story-foot"><span v-if="narrative">已发布版本 {{ narrative.version }}</span><span v-else>尚无已发布快照</span><span v-if="missing.length">待补全：{{ missing.join('、') }}</span></div>
        </section>
        <aside class="side">
          <section class="side-card"><span class="eyebrow">EVIDENCE</span><h2>掌握与前置</h2><div class="metric"><b>{{ score }}</b><span>{{ status }}</span></div>
            <p v-if="node?.insufficientSample === true">有效样本不足，不显示稳定掌握度，也不据此宣布解锁。</p>
            <p v-else>掌握度只由服务端有效客观作答证据计算。当前接口未提供可核实的样本数，故不展示证据数量或趋势。</p>
            <div v-if="node?.locked === true" class="guard">服务端标记前置锁定；先完成必需前置。</div>
            <div v-else-if="node?.locked === null || node?.preparing === null" class="guard">前置或发布状态待核实，练习入口暂不可用。</div>
          </section>
          <section class="side-card"><span class="eyebrow">RELATED CONTENT</span><h2>关联内容</h2><p>课程、题目与公式关联虽在接口范围内，返回字段尚未约定。这里不会跳到固定题号、课时或公式。</p><button class="secondary" @click="router.push('/formulas')">浏览公式馆 ↗</button></section>
          <section class="side-card action"><button class="primary" :disabled="!canPractice || actionBusy" @click="startPractice">{{ actionBusy ? '启动中…' : '从此处开始练习' }}</button><p v-if="actionNote" role="status">{{ actionNote }}</p><button class="secondary" @click="router.push('/graph')">回到关系图</button></section>
        </aside>
      </div>
    </template>
  </main>
</template>

<style scoped>
.node-page{max-width:1180px;margin:auto;padding:23px 30px 60px;color:var(--text)}.back{border:0;background:none;color:var(--primary);font-size:12px;font-weight:750;margin-bottom:15px}.notice{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:15px;color:var(--muted);font-size:13px}.notice.error{background:var(--danger-bg);color:var(--danger)}.notice button{border:0;background:none;text-decoration:underline;color:inherit}.node-head{display:flex;justify-content:space-between;align-items:center;gap:22px;border-radius:18px;background:var(--deep);color:#f8fafc;padding:32px 36px}.eyebrow{font-size:10px;font-weight:850;letter-spacing:.16em;color:var(--faint)}.node-head .eyebrow{color:#aac5f3}.node-head h1{font:clamp(27px,3vw,39px)/1.4 var(--serif);margin:8px 0}.node-head p{font-size:13px;line-height:1.75;color:#c1cfe6;max-width:700px}.score-card{min-width:120px;display:flex;flex-direction:column;align-items:center;gap:5px;border:1px solid #ffffff39;border-radius:14px;padding:14px;background:#ffffff12}.score-card b{font-size:27px}.score-card span{font-size:11px;color:#dae5f9}.content-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(290px,1fr);gap:17px;margin-top:17px}.main-card,.side-card{background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow)}.main-card{padding:28px;min-height:420px}.section-title h2{font:25px var(--serif);margin:8px 0}.section-title p,.side-card p{font-size:12px;line-height:1.75;color:var(--muted)}.tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:26px;border-bottom:1px solid var(--line)}.tabs button{border:0;border-bottom:3px solid transparent;background:none;padding:12px 3px;font-size:12px;font-weight:750;color:var(--muted)}.tabs button.active{border-color:var(--primary);color:var(--primary)}.story{min-height:190px;white-space:pre-wrap;padding:25px 5px;font:16px/2 var(--serif);color:var(--body)}.story.missing{color:var(--faint)}.story-foot{display:flex;gap:12px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:14px;color:var(--faint);font-size:11px}.side{display:flex;flex-direction:column;gap:15px}.side-card{padding:21px}.side-card h2{font:20px var(--serif);margin:7px 0 13px}.metric{display:flex;align-items:center;gap:13px;padding:12px;background:var(--soft);border-radius:9px;margin-bottom:12px}.metric b{font-size:25px;color:var(--primary)}.metric span{font-size:11px;color:var(--muted)}.guard{background:var(--warning-bg);color:var(--warning);padding:10px;border-radius:8px;margin-top:14px;font-size:11px;line-height:1.6}.primary,.secondary{border:0;border-radius:9px;padding:10px 13px;font-size:12px;font-weight:800}.primary{background:var(--primary);color:var(--deep);width:100%}.primary:disabled{opacity:.45;cursor:default}.secondary{background:var(--primary-soft);color:var(--primary-deep);margin-top:14px}.action p{color:var(--warning);margin-top:9px}.action .secondary{width:100%}@media(max-width:890px){.content-grid{grid-template-columns:1fr}.side{display:grid;grid-template-columns:1fr 1fr}.side-card.action{grid-column:1/-1}}@media(max-width:620px){.node-page{padding:15px 15px 45px}.node-head{padding:24px;align-items:flex-start;flex-direction:column}.score-card{align-items:flex-start;width:100%}.main-card{padding:20px}.tabs button{font-size:11px}.side{display:flex}}
</style>
