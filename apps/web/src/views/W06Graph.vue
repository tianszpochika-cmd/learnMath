<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { isApiError } from "@learnmath/shared";
import { NARRATIVE_TABS, cardView, filterNodes, neighborSet, type CardKey } from "../features/graph/graphUi";
import { graphData, graphNode, layoutGraph, practiceAttemptId, publishedNarrative, verifiedColor, type GraphData, type GraphNode, type PublishedNarrative } from "../features/graph/graphProjection";
import { exploreApi, exploreError } from "../services/explore";

type LoadState = "loading" | "ready" | "empty" | "unmapped" | "error";
const router = useRouter();
const state = ref<LoadState>("loading");
const error = ref("");
const graph = ref<GraphData | null>(null);
const query = ref("");
const selectedId = ref<number | null>(null);
const detail = ref<GraphNode | null>(null);
const detailState = ref<LoadState>("loading");
const detailError = ref("");
const narrative = ref<PublishedNarrative | null>(null);
const narrativeState = ref<LoadState>("loading");
const tab = ref<CardKey>("origin");
const actionBusy = ref(false);
const actionNote = ref("");
let graphGeneration = 0;
let nodeGeneration = 0;

const layout = computed(() => layoutGraph(graph.value?.nodes ?? []));
const selected = computed(() => detail.value?.id === selectedId.value ? detail.value : graph.value?.nodes.find((item) => item.id === selectedId.value) ?? null);
const position = computed(() => new Map(layout.value.nodes.map((node) => [node.id, node])));
const matches = computed(() => new Set(filterNodes(graph.value?.nodes ?? [], query.value).map((node) => node.id)));
const neighbors = computed(() => selectedId.value && graph.value ? neighborSet(graph.value.edges, selectedId.value) : new Set<number>());
const canPractice = computed(() => selected.value?.locked === false && selected.value.preparing === false);
const color = computed(() => selected.value ? verifiedColor(selected.value) : "unverified");
const scoreLabel = computed(() => selected.value && (color.value === "green" || color.value === "yellow") && typeof selected.value.score === "number"
  ? Math.round(selected.value.score) + "%" : "—");

function colorHexFor(node: GraphNode): string {
  const state = verifiedColor(node);
  const colors: Record<string, string> = {
    green: "var(--good)", yellow: "var(--warning)", locked: "var(--danger)",
    preparing: "var(--prep)", "sample-low": "var(--faint)", "no-data": "var(--faint)", unverified: "var(--faint)",
  };
  return colors[state];
}
function statusText(node: GraphNode): string {
  const state = verifiedColor(node);
  return {
    green: "掌握度已确认", yellow: "需要巩固", locked: "前置锁定", preparing: "内容筹备中",
    "sample-low": "样本不足", "no-data": "尚未测量", unverified: "证据状态待核实",
  }[state];
}
function nodeName(id: number): string {
  return graph.value?.nodes.find((item) => item.id === id)?.name ?? "#" + id;
}

async function loadGraph(): Promise<void> {
  const current = ++graphGeneration;
  state.value = "loading";
  error.value = "";
  graph.value = null;
  selectedId.value = null;
  try {
    const response = await exploreApi.graph();
    if (current !== graphGeneration) return;
    const mapped = graphData(response);
    if (!mapped) state.value = response === null || response === undefined ? "empty" : "unmapped";
    else {
      graph.value = mapped;
      state.value = mapped.nodes.length ? "ready" : "empty";
      selectedId.value = mapped.nodes[0]?.id ?? null;
    }
  } catch (cause) {
    if (current !== graphGeneration) return;
    error.value = exploreError(cause);
    state.value = "error";
  }
}

async function loadNode(id: number): Promise<void> {
  const current = ++nodeGeneration;
  detail.value = null;
  narrative.value = null;
  detailState.value = "loading";
  narrativeState.value = "loading";
  detailError.value = "";
  actionNote.value = "";
  const [nodeResult, narrativeResult] = await Promise.allSettled([exploreApi.node(id), exploreApi.narrative(id)]);
  if (current !== nodeGeneration) return;
  if (nodeResult.status === "rejected") {
    detailState.value = "error";
    detailError.value = exploreError(nodeResult.reason);
  } else {
    detail.value = graphNode(nodeResult.value);
    detailState.value = detail.value ? "ready" : nodeResult.value === null || nodeResult.value === undefined ? "empty" : "unmapped";
  }
  if (narrativeResult.status === "rejected") narrativeState.value = "error";
  else {
    narrative.value = publishedNarrative(narrativeResult.value);
    narrativeState.value = narrative.value ? "ready" : "empty";
  }
}

async function startPractice(): Promise<void> {
  if (!selectedId.value || !canPractice.value || actionBusy.value) return;
  actionBusy.value = true;
  actionNote.value = "";
  try {
    const response = await exploreApi.startPractice(selectedId.value);
    const attemptId = practiceAttemptId(response);
    if (attemptId) void router.push("/paper/" + attemptId);
    else actionNote.value = "服务端未返回可用作答编号，暂不进入练习。";
  } catch (cause) {
    actionNote.value = isApiError(cause) && cause.code === 3311
      ? "前置条件未满足，服务端拒绝进入练习。"
      : "练习未启动：" + exploreError(cause);
  } finally {
    actionBusy.value = false;
  }
}

watch(selectedId, (id) => { if (id) void loadNode(id); });
void loadGraph();
</script>

<template>
  <main class="graph-page">
    <header class="graph-head"><div><span class="eyebrow">KNOWLEDGE GRAPH · 知识图谱</span><h1>沿着前置关系，找到下一站。</h1><p>节点和连线来自图谱接口；颜色只有在锁态与有效证据状态完整时才表示学习结论。</p></div><button @click="router.push('/paths')">路径中心 ↗</button></header>
    <div class="toolbar"><label>定位知识点 <input v-model="query" type="search" placeholder="输入名称筛选" :disabled="state !== 'ready'"></label><button @click="loadGraph" :disabled="state === 'loading'">刷新图谱 ↻</button><span class="hint">灰色也可能表示状态未核实，不能视为已解锁。</span></div>
    <div v-if="state === 'loading'" class="notice" role="status">正在获取图谱节点与前置关系…</div>
    <div v-else-if="state === 'error'" class="notice error" role="alert">图谱暂不可用：{{ error }} <button @click="loadGraph">重试</button></div>
    <div v-else-if="state === 'empty'" class="notice">当前没有可展示的知识节点。</div>
    <div v-else-if="state === 'unmapped'" class="notice">图谱数据已返回，但节点与边的字段尚未对齐；暂不画出可能错误的知识关系。</div>
    <div v-else class="workspace">
      <section class="map-wrap" aria-label="知识关系图"><div class="map" :style="{ height: layout.height + 'px' }">
        <svg class="connections" :viewBox="'0 0 960 ' + layout.height" preserveAspectRatio="none" aria-hidden="true">
          <line v-for="(edge, index) in graph?.edges" :key="index"
            :x1="(position.get(edge.from)?.x ?? 0) + 70" :y1="(position.get(edge.from)?.y ?? 0) + 23"
            :x2="(position.get(edge.to)?.x ?? 0) + 70" :y2="(position.get(edge.to)?.y ?? 0) + 23" />
        </svg>
        <button v-for="node in layout.nodes" :key="node.id" class="node-pill"
          :class="{ active: node.id === selectedId, dim: query.trim() && !matches.has(node.id), neighbor: neighbors.has(node.id) }"
          :style="{ left: node.x + 'px', top: node.y + 'px', '--node-color': colorHexFor(node) }" @click="selectedId = node.id">
          <i></i><span>{{ node.name }}</span>
        </button>
      </div></section>
      <aside class="drawer">
        <div class="drawer-head"><span class="eyebrow">NODE DETAIL</span><button v-if="selected" @click="router.push('/graph/node/' + selected.id)">完整页面 ↗</button></div>
        <h2>{{ selected?.name || '选择知识点' }}</h2>
        <div v-if="selected" class="evidence"><span class="score">{{ scoreLabel }}</span><span><b :style="{ color: colorHexFor(selected) }">{{ statusText(selected) }}</b><small>{{ selected.insufficientSample === true ? '有效样本不足，不展示稳定掌握度' : '掌握度仅由服务端有效客观证据计算' }}</small></span></div>
        <p v-if="detailState === 'error'" class="detail-alert">节点详情暂不可用：{{ detailError }}</p>
        <p v-else-if="detailState === 'unmapped'" class="detail-alert">节点详情字段尚未对齐。</p>
        <p v-if="selected?.description" class="definition">{{ selected.description }}</p>
        <nav class="tabs"><button v-for="item in NARRATIVE_TABS" :key="item.key" :class="{ active: tab === item.key }" @click="tab = item.key">{{ item.label }}</button></nav>
        <div v-if="narrativeState === 'loading'" class="card-body">正在获取已发布概念卡…</div>
        <div v-else-if="narrativeState === 'error'" class="card-body">概念卡暂不可用。</div>
        <div v-else class="card-body" :class="{ missing: cardView(tab, narrative?.cards).missing }">{{ cardView(tab, narrative?.cards).text }}<small v-if="narrative">已发布版本 {{ narrative.version }}</small></div>
        <div class="relations"><h3>一跳关联</h3><button v-for="id in neighbors" :key="id" v-show="id !== selectedId" @click="selectedId = id">{{ nodeName(id) }} ↗</button><p v-if="neighbors.size <= 1">暂无可展示的前后继。</p></div>
        <div class="relations"><h3>代表题与课程</h3><p>关联资源的响应字段尚未定义，暂不跳转固定题号或课时。</p></div>
        <p v-if="selected?.locked === true" class="lock">当前节点由服务端标记为前置锁定。</p>
        <p v-else-if="selected?.locked === null || selected?.preparing === null" class="lock">前置状态未核实，练习入口暂不可用。</p>
        <button class="practice" :disabled="!canPractice || actionBusy" @click="startPractice">{{ actionBusy ? '启动中…' : '从此处开始练习' }}</button>
        <p v-if="actionNote" class="detail-alert" role="status">{{ actionNote }}</p>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.graph-page{max-width:1500px;margin:auto;padding:22px 26px 60px;color:var(--text)}.graph-head{display:flex;align-items:end;justify-content:space-between;gap:20px;padding:27px 31px;border-radius:18px;background:var(--deep);color:#f8fafc}.eyebrow{font-size:10px;font-weight:850;letter-spacing:.17em;color:var(--faint)}.graph-head .eyebrow{color:#aec8f7}.graph-head h1{font:clamp(24px,2.8vw,35px)/1.35 var(--serif);margin:8px 0}.graph-head p{font-size:12px;color:#b9c9e3;line-height:1.7}.graph-head button{border:1px solid #ffffff53;background:#ffffff17;color:#fff;border-radius:9px;padding:9px 13px;white-space:nowrap}.toolbar{display:flex;align-items:center;gap:13px;flex-wrap:wrap;margin:16px 0;padding:12px 15px;border:1px solid var(--line);border-radius:11px;background:var(--paper)}.toolbar label{font-size:12px;font-weight:750;color:var(--muted)}.toolbar input{margin-left:9px;width:220px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--text);padding:7px 10px}.toolbar button{border:0;background:var(--primary-soft);color:var(--primary-deep);border-radius:8px;padding:8px 10px;font-size:12px;font-weight:750}.hint{font-size:11px;color:var(--muted)}.notice{padding:16px;border:1px solid var(--line);border-radius:10px;background:var(--soft);color:var(--muted);font-size:13px}.notice.error{background:var(--danger-bg);color:var(--danger)}.notice button{border:0;background:none;color:inherit;text-decoration:underline}.workspace{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px}.map-wrap{min-width:0;overflow:auto;border:1px solid var(--line);border-radius:16px;background:var(--paper);box-shadow:var(--shadow)}.map{position:relative;min-width:960px;background-image:var(--grid)}.connections{position:absolute;inset:0;width:960px;height:100%;pointer-events:none}.connections line{stroke:var(--faint);stroke-width:1.3;stroke-dasharray:5 5}.node-pill{position:absolute;display:flex;align-items:center;gap:9px;width:165px;min-height:46px;border:1px solid var(--node-color);border-left:4px solid var(--node-color);border-radius:10px;padding:8px 11px;background:var(--paper);color:var(--text);font-size:12px;font-weight:750;text-align:left;box-shadow:var(--shadow)}.node-pill i{width:9px;height:9px;flex:none;border-radius:50%;background:var(--node-color)}.node-pill.active{box-shadow:0 0 0 3px var(--primary-soft),var(--shadow)}.node-pill.dim{opacity:.3}.node-pill.neighbor:not(.active){border-style:dashed}.drawer{padding:21px;background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow)}.drawer-head{display:flex;justify-content:space-between}.drawer-head button{border:0;background:none;color:var(--primary);font-size:11px;font-weight:750}.drawer h2{font:23px var(--serif);margin:11px 0 16px}.evidence{display:flex;align-items:center;gap:15px;padding:14px;background:var(--soft);border-radius:10px}.score{display:grid;place-items:center;width:57px;height:57px;border:3px solid var(--line);border-radius:50%;font-size:16px;font-weight:850}.evidence b,.evidence small{display:block}.evidence b{font-size:12px}.evidence small{font-size:10px;color:var(--muted);line-height:1.5;margin-top:5px}.definition{font-size:12px;line-height:1.7;color:var(--body);margin-top:14px}.tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:19px}.tabs button{border:0;border-bottom:2px solid var(--line);background:none;color:var(--muted);padding:8px 0;font-size:11px}.tabs button.active{border-color:var(--primary);color:var(--primary);font-weight:800}.card-body{min-height:95px;padding:14px 4px;white-space:pre-wrap;font-size:13px;line-height:1.8;color:var(--body)}.card-body.missing{color:var(--faint)}.card-body small{display:block;color:var(--faint);font-size:10px;margin-top:8px}.relations{padding:14px 0;border-top:1px solid var(--line)}.relations h3{font-size:11px;color:var(--muted);margin-bottom:9px}.relations button{border:0;border-radius:20px;background:var(--primary-soft);color:var(--primary-deep);padding:6px 10px;margin:0 6px 6px 0;font-size:11px}.relations p,.detail-alert,.lock{font-size:11px;line-height:1.7;color:var(--muted)}.detail-alert{margin:10px 0;color:var(--warning)}.lock{padding:10px;border-radius:8px;background:var(--warning-bg);color:var(--warning)}.practice{width:100%;border:0;border-radius:9px;background:var(--primary);color:var(--deep);padding:11px;margin-top:13px;font-size:12px;font-weight:850}.practice:disabled{opacity:.4;cursor:default}@media(max-width:1040px){.workspace{grid-template-columns:1fr}.drawer{order:-1}}@media(max-width:620px){.graph-page{padding:15px 15px 48px}.graph-head{padding:22px;align-items:start;flex-direction:column}.toolbar input{width:170px}}
</style>
