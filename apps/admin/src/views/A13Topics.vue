<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { moveTopicNode, readTopic, readTopics, saveTopic, topicDraftIssues, type TopicDetail, type TopicSummary } from "../services/topics";

const router = useRouter();
const topics = ref<TopicSummary[]>([]);
const draft = ref<TopicDetail | null>(null);
const saved = ref<TopicDetail | null>(null);
const listState = ref<"loading" | "ready" | "error">("loading");
const detailState = ref<"idle" | "loading" | "ready" | "error">("idle");
const busy = ref(false);
const notice = ref("");
const noticeTone = ref<"neutral" | "good" | "warn" | "bad">("neutral");
const dragIndex = ref<number | null>(null);
let detailRequest = 0;
const dirty = computed(() => Boolean(draft.value && saved.value && (
  draft.value.title !== saved.value.title || draft.value.nodes.map((node) => node.id).join("|") !== saved.value.nodes.map((node) => node.id).join("|")
)));

function message(error: unknown): string { return error instanceof Error && error.message ? error.message : "请求失败，请稍后重试"; }
function status(text: string, tone: "neutral" | "good" | "warn" | "bad" = "neutral"): void { notice.value = text; noticeTone.value = tone; }
function clone(detail: TopicDetail): TopicDetail { return { ...detail, nodes: detail.nodes.map((node) => ({ ...node })) }; }

async function loadList(): Promise<void> {
  listState.value = "loading";
  try {
    topics.value = await readTopics();
    listState.value = "ready";
    if (!draft.value && topics.value.length) await selectTopic(topics.value[0].id);
  } catch (error) { listState.value = "error"; status(message(error), "bad"); }
}
async function selectTopic(id: string): Promise<void> {
  if (dirty.value && typeof window !== "undefined" && !window.confirm("当前专题还有未保存调整，确定切换吗？")) return;
  const request = ++detailRequest;
  detailState.value = "loading";
  status("");
  try {
    const detail = await readTopic(id);
    if (request !== detailRequest) return;
    saved.value = clone(detail);
    draft.value = clone(detail);
    detailState.value = "ready";
  } catch (error) { if (request !== detailRequest) return; detailState.value = "error"; status(message(error), "bad"); }
}
function move(index: number, delta: -1 | 1): void {
  if (!draft.value) return;
  draft.value.nodes = moveTopicNode(draft.value.nodes, index, delta);
  status("顺序已在本页调整，尚未保存。资源引用仍需服务端核对。", "warn");
}
function dragStart(index: number, event: DragEvent): void {
  dragIndex.value = index;
  event.dataTransfer?.setData("text/plain", String(index));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}
function dropAt(index: number, event: DragEvent): void {
  event.preventDefault();
  if (!draft.value || dragIndex.value === null) return;
  const from = dragIndex.value;
  dragIndex.value = null;
  if (from === index) return;
  const nodes = [...draft.value.nodes];
  const [item] = nodes.splice(from, 1);
  nodes.splice(index, 0, item);
  draft.value.nodes = nodes;
  status("节点顺序已调整，尚未保存。", "warn");
}
function checkDraft(): void {
  if (!draft.value) return;
  const issues = topicDraftIssues(draft.value);
  status(issues.length ? issues.join("；") : "表单结构已检查；引用可达性、挑战独立题池与在线快照仍缺独立服务端校验，不能据此发布。", issues.length ? "bad" : "warn");
}
async function persist(): Promise<void> {
  if (!draft.value || busy.value) return;
  const issues = topicDraftIssues(draft.value);
  if (issues.length) { status(issues.join("；"), "bad"); return; }
  busy.value = true;
  const attempted = clone(draft.value);
  try {
    await saveTopic(attempted);
    const confirmed = await readTopic(attempted.id);
    const sameOrder = confirmed.nodes.map((node) => node.id).join("|") === attempted.nodes.map((node) => node.id).join("|");
    if (confirmed.title !== attempted.title.trim() || !confirmed.nodesKnown || !sameOrder) {
      status("保存请求已返回，但专题详情回读与本页工作稿不一致。请刷新核对，暂不标记为已保存。", "warn");
      return;
    }
    saved.value = clone(confirmed);
    draft.value = clone(confirmed);
    topics.value = topics.value.map((item) => item.id === confirmed.id ? { id: confirmed.id, title: confirmed.title, status: confirmed.status } : item);
    status("服务端已确认工作稿保存。发布前还需独立校验引用、覆盖和题池。", "good");
  } catch (error) { status(message(error), "bad"); }
  finally { busy.value = false; }
}
onMounted(() => { void loadList(); });
</script>

<template>
  <div class="workspace-page">
    <header class="page-head">
      <div><p class="eyebrow">TOPIC BUILDER · A13</p><h1>专题编排</h1><p>调整学习资源的顺序，保留每个节点的身份与引用。工作稿保存和正式发布分别核对。</p></div>
      <div class="head-actions"><button type="button" class="button" @click="router.push('/paths/editor')">查看路径编排器</button><button type="button" class="button" :disabled="!draft" @click="checkDraft">检查工作稿</button></div>
    </header>
    <p v-if="notice" class="notice" :class="noticeTone" role="status">{{ notice }}</p>
    <div class="layout">
      <aside class="panel topic-list">
        <div class="panel-head"><h2>专题列表</h2><button type="button" class="text-button" :disabled="listState === 'loading'" @click="loadList">刷新</button></div>
        <p v-if="listState === 'loading'" class="empty">正在读取专题…</p>
        <p v-else-if="listState === 'error'" class="empty">列表读取失败，请重试。</p>
        <p v-else-if="!topics.length" class="empty">尚无可展示的专题。</p>
        <button v-for="topic in topics" :key="topic.id" type="button" class="topic-choice" :class="{ selected: draft?.id === topic.id }" @click="selectTopic(topic.id)"><strong>{{ topic.title }}</strong><span>#{{ topic.id }} · {{ topic.status || '状态未返回' }}</span></button>
      </aside>
      <template v-if="detailState === 'loading'"><section class="panel content-state">正在读取专题详情…</section></template>
      <template v-else-if="draft">
        <section class="panel sequence">
          <div class="panel-head"><div><p class="eyebrow">LEARNING SEQUENCE</p><h2>节点序列</h2></div><span class="pill">{{ draft.nodes.length }} 个节点</span></div>
          <p class="micro">拖动节点或使用上下按钮调整顺序。节点 ID 与资源引用保持原值。</p>
          <p v-if="!draft.nodesKnown" class="notice warn">服务端未返回节点序列；当前禁止保存顺序。</p>
          <p v-else-if="!draft.nodes.length" class="empty">当前专题没有节点。新增节点的写入字段尚未定义。</p>
          <ol v-else class="nodes">
            <li v-for="(node, index) in draft.nodes" :key="node.id" draggable="true" @dragstart="dragStart(index, $event)" @dragover.prevent @drop="dropAt(index, $event)" @dragend="dragIndex = null">
              <span class="handle" aria-hidden="true">⋮⋮</span><span class="number">{{ String(index + 1).padStart(2, '0') }}</span>
              <div class="node-main"><strong>{{ node.title }}</strong><small>{{ node.type || '类型未返回' }} · ref {{ node.refId || '未绑定' }} · 节点 #{{ node.id }}</small></div>
              <div class="node-actions"><button type="button" :disabled="index === 0" :aria-label="`上移${node.title}`" @click="move(index, -1)">↑</button><button type="button" :disabled="index === draft.nodes.length - 1" :aria-label="`下移${node.title}`" @click="move(index, 1)">↓</button></div>
            </li>
          </ol>
        </section>
        <aside class="panel properties">
          <p class="eyebrow">PROPERTIES & GATE</p><h2>专题属性</h2>
          <label class="field"><span>专题名称</span><input v-model="draft.title" @input="status('名称已修改，尚未保存。', 'warn')"></label>
          <div class="meta"><span>当前状态</span><strong>{{ draft.status || '未返回' }}</strong></div><div class="meta"><span>版本</span><strong>{{ draft.revision === null ? '未返回' : draft.revision }}</strong></div>
          <div class="gate"><h3>发布前还需要</h3><p>资源引用与前置可达、挑战独立题族和在线快照的服务端校验。资源缺失应呈现“内容筹备中”。</p></div>
          <button type="button" class="button primary full" :disabled="busy || !dirty || !draft.nodesKnown" @click="persist">{{ busy ? '正在保存…' : '保存工作稿' }}</button>
          <button type="button" class="button full" disabled title="专题独立校验和发布接口尚未定义">发布专题 · 等待发布接口</button>
          <p class="micro">当前只有专题 CRUD 契约。保存成功不代表已经发布到学习端。</p>
        </aside>
      </template>
      <section v-else class="panel content-state">{{ detailState === 'error' ? '专题详情暂不可读取，请重新选择。' : '选择专题查看编排。' }}</section>
    </div>
  </div>
</template>

<style scoped>
.workspace-page{--paper-local:var(--ops-card);--soft-local:var(--ops-soft);--text-local:var(--ink);--muted-local:var(--ink2);--primary-local:var(--brand);max-width:1480px;margin:auto;padding:30px 28px 72px;color:var(--text-local)}.page-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:22px}.eyebrow{font-size:11px;letter-spacing:.14em;color:var(--brand-deep);font-weight:800}.page-head h1{font:700 clamp(28px,3vw,40px)/1.25 var(--serif,Georgia,serif);margin:7px 0 8px}.page-head p:last-child{color:var(--muted-local);max-width:690px}.head-actions{display:flex;gap:8px;flex-wrap:wrap}.button,.text-button,.node-actions button{border:1px solid var(--line);background:var(--paper-local);color:var(--text-local);border-radius:9px;padding:8px 13px;min-height:36px;font-weight:700}.button:hover:not(:disabled),.node-actions button:hover:not(:disabled){border-color:var(--primary-local);color:var(--primary-local)}.button:disabled,.node-actions button:disabled{opacity:.48;cursor:not-allowed}.button.primary{background:var(--grad);color:var(--ops-on-brand);border-color:transparent}.button.full{width:100%;margin-top:10px}.text-button{border:0;color:var(--primary-local);padding:3px}.layout{display:grid;grid-template-columns:220px minmax(0,1.4fr) minmax(260px,.8fr);gap:16px;align-items:start}.panel{background:var(--paper-local);border:1px solid var(--line);border-radius:15px;padding:20px;box-shadow:var(--shadow,0 10px 28px -22px #29467088);min-width:0}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.panel h2{font-size:18px}.topic-list{display:grid;gap:7px}.topic-choice{border:1px solid var(--line);border-radius:9px;background:var(--paper-local);padding:10px;text-align:left;display:grid;gap:3px;color:var(--text-local)}.topic-choice.selected{border-color:var(--primary-local);background:var(--brand-soft)}.topic-choice span,.micro{color:var(--muted-local);font-size:12px}.pill{border-radius:99px;background:var(--brand-soft);color:var(--brand-deep);padding:4px 10px;font-size:12px;font-weight:800}.empty,.content-state{color:var(--muted-local);padding:25px 8px}.nodes{list-style:none;display:grid;gap:9px;margin-top:18px}.nodes li{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:11px;padding:12px;background:var(--paper-local)}.nodes li:hover{border-color:var(--primary-local)}.handle{cursor:grab;color:var(--muted-local);font-size:20px;line-height:1}.number{font:700 15px Georgia,serif;color:var(--primary-local)}.node-main{flex:1;min-width:0;display:grid;gap:4px}.node-main strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.node-main small{color:var(--muted-local);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.node-actions{display:flex;gap:4px}.node-actions button{min-width:32px;padding:5px}.field{display:grid;gap:6px;margin:18px 0}.field span{font-size:12px;font-weight:750}.field input{width:100%;border:1px solid var(--line);background:var(--paper-local);color:var(--text-local);border-radius:8px;padding:9px}.meta{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding:10px 0;font-size:12px}.meta span{color:var(--muted-local)}.gate{background:var(--soft-local);border-radius:10px;padding:13px;margin:13px 0}.gate h3{font-size:13px;margin-bottom:6px}.gate p{font-size:12px;color:var(--muted-local)}.notice{padding:11px 13px;border-radius:10px;border:1px solid var(--line);background:var(--soft-local);margin-bottom:15px;font-size:12px}.notice.good{background:var(--ops-soft);color:var(--ink)}.notice.warn{background:var(--ops-warn-bg);color:var(--ink)}.notice.bad{background:var(--ops-danger-bg);color:var(--ink)}
@media(max-width:1150px){.layout{grid-template-columns:220px minmax(0,1fr)}.properties{grid-column:2}}@media(max-width:760px){.workspace-page{padding:20px 14px 60px}.page-head{display:block}.head-actions{margin-top:14px}.layout{grid-template-columns:1fr}.properties{grid-column:auto}.node-actions{flex-direction:column}}
</style>
