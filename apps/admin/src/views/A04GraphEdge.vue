<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { validateEdgeAdd, type TreeNodeAdmin } from "../features/knowledge/knowledgeAdmin";
import { addEdge, deleteEdge, readEdges, readGraphHealth, readKnowledgeTree, type AdminEdge } from "../services/content";

const nodes = ref<TreeNodeAdmin[]>([]);
const edges = ref<AdminEdge[]>([]);
const loading = ref(true);
const ready = ref(false);
const busy = ref(false);
const error = ref("");
const notice = ref("");
const sourceId = ref<number | null>(null);
const cyclePath = ref<number[]>([]);
const search = ref("");
const report = ref<Record<string, unknown> | null>(null);
const visibleNodes = computed(() => nodes.value.filter((node) => node.title.includes(search.value.trim())).slice(0, 100));
const labels = computed(() => new Map(nodes.value.map((node) => [node.id, node.title])));
const label = (id: number) => labels.value.get(id) ?? `#${id}`;

async function load() {
  loading.value = true; error.value = "";
  try {
    const [tree, graph] = await Promise.all([readKnowledgeTree(), readEdges()]);
    nodes.value = tree; edges.value = graph; ready.value = true;
  } catch (cause) { nodes.value = []; edges.value = []; ready.value = false; error.value = cause instanceof Error ? cause.message : "图谱暂不可用"; }
  finally { loading.value = false; }
}
async function choose(node: TreeNodeAdmin) {
  if (busy.value) return;
  if (sourceId.value === null) { sourceId.value = node.id; cyclePath.value = []; notice.value = `已选择起点「${node.title}」，请选择终点。`; return; }
  const from = sourceId.value;
  sourceId.value = null;
  if (from === node.id) { notice.value = "已取消本次加边。"; return; }
  const check = validateEdgeAdd(edges.value, from, node.id);
  if (!check.ok) { cyclePath.value = check.cyclePath; error.value = check.message; return; }
  busy.value = true; error.value = ""; notice.value = "";
  try { await addEdge(from, node.id); await load(); notice.value = "管理服务已确认新增依赖边。"; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "加边未获服务端确认"; }
  finally { busy.value = false; }
}
async function remove(edge: AdminEdge) {
  if (!edge.id || busy.value || !window.confirm(`确认删除「${label(edge.from)} → ${label(edge.to)}」依赖？`)) return;
  busy.value = true; error.value = ""; notice.value = "";
  try { await deleteEdge(edge.id); await load(); notice.value = "管理服务已确认删除依赖边。"; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "删边未获服务端确认"; }
  finally { busy.value = false; }
}
async function checkHealth() {
  busy.value = true; error.value = ""; report.value = null;
  try { report.value = await readGraphHealth(); notice.value = "已读取管理服务图谱体检报告。"; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "图谱体检暂不可用"; }
  finally { busy.value = false; }
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="ops-page">
    <header class="ops-heading"><div><p class="ops-eyebrow">A04 · GRAPH DEPENDENCIES</p><h1>图谱边编辑</h1><p class="ops-lead">选择前置与后继节点创建依赖。页面先检查重复与成环，最终由服务端验证并入库。</p></div><div class="ops-actions"><button class="ops-btn secondary" type="button" :disabled="busy" @click="load">刷新图谱</button><button class="ops-btn secondary" type="button" :disabled="busy" @click="checkHealth">服务端图谱体检</button></div></header>
    <p v-if="loading" class="ops-state" role="status">正在读取管理服务的节点与依赖边…</p>
    <p v-else-if="error" class="ops-state error" role="alert">{{ error }}</p>
    <p v-if="notice" class="ops-state" role="status">{{ notice }}</p>
    <p v-if="cyclePath.length" class="ops-state warning">预检发现成环路径：{{ cyclePath.map(label).join(" → ") }}。未向服务端提交。</p>
    <div v-if="!loading && ready" class="graph-grid">
      <section class="ops-card">
        <div class="section-head"><div><h2>节点工作区</h2><p class="ops-muted">点选起点，再点终点；再次点起点可取消。</p></div><span class="count">{{ nodes.length }} 节点</span></div>
        <label class="ops-field search"><span>定位节点</span><input v-model="search" type="search" placeholder="按名称筛选节点" /></label>
        <div class="node-grid"><button v-for="node in visibleNodes" :key="node.id" class="node" :class="{ selected: sourceId === node.id }" type="button" :disabled="busy" @click="choose(node)"><span class="node-id">#{{ node.id }}</span><strong>{{ node.title }}</strong><span class="node-status">{{ node.status === "published" ? "已上架" : node.status === "offline" ? "已下架" : "草稿" }}</span></button></div>
        <p v-if="nodes.length > 100" class="ops-muted">节点较多，请输入名称定位；当前最多显示 100 个。</p>
        <p v-if="visibleNodes.length === 0" class="ops-state">{{ search ? "没有匹配节点" : "服务端没有返回节点" }}</p>
      </section>
      <section class="ops-card"><div class="section-head"><div><h2>已确认依赖边</h2><p class="ops-muted">删除操作会直接请求管理服务。</p></div><span class="count">{{ edges.length }} 条</span></div><div class="edge-list"><div v-for="edge in edges" :key="edge.id || edge.from + '-' + edge.to" class="edge"><span><b>{{ label(edge.from) }}</b><small>前置</small></span><span class="arrow">→</span><span><b>{{ label(edge.to) }}</b><small>后继</small></span><button class="remove" type="button" :disabled="!edge.id || busy" :title="edge.id ? '删除依赖边' : '服务端未返回边编号'" @click="remove(edge)">删除</button></div><p v-if="edges.length === 0" class="ops-state">服务端尚无依赖边。</p></div></section>
    </div>
    <section v-if="report" class="ops-card report"><div class="section-head"><h2>服务端体检报告</h2><span class="ops-muted">原始结果，最终判定由管理服务给出</span></div><pre>{{ JSON.stringify(report, null, 2) }}</pre></section>
  </div>
</template>

<style scoped>
.graph-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:16px;margin-top:15px}.section-head{display:flex;align-items:start;justify-content:space-between;gap:12px}.section-head h2{margin:0 0 5px}.section-head p{font-size:12px}.count{padding:5px 9px;border-radius:99px;background:var(--brand-soft);color:var(--brand-deep);font-size:11px;font-weight:800;white-space:nowrap}.search{margin:17px 0}.node-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:9px}.node{display:grid;gap:4px;min-height:87px;padding:10px 12px;border:1px solid var(--line);border-radius:11px;background:var(--ops-soft);color:var(--ink);text-align:left}.node:hover,.node.selected{border-color:var(--brand);background:var(--brand-soft)}.node-id,.node-status{color:var(--ink3);font-size:10px}.node strong{font-size:13px}.edge-list{display:grid;gap:8px;max-height:650px;overflow:auto;margin-top:17px}.edge{display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--line);border-radius:9px}.edge>span:not(.arrow){min-width:0;flex:1}.edge b,.edge small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.edge small{color:var(--ink3);font-size:10px}.arrow{color:var(--brand-deep);font-size:18px}.remove{padding:6px 8px;border:0;background:transparent;color:#b94351;font-size:11px;font-weight:750}.report{margin-top:16px}.report pre{overflow:auto;max-height:350px;padding:14px;border-radius:9px;background:var(--ops-soft);font-size:12px;line-height:1.6}
@media(max-width:950px){.graph-grid{grid-template-columns:1fr}}
</style>
