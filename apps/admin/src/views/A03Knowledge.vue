<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { parseKnowledgeCsv, toggleCollapsed, treeRows, type TreeNodeAdmin } from "../features/knowledge/knowledgeAdmin";
import { deleteKnowledgeNode, readKnowledgeTree } from "../services/content";

const router = useRouter();
const nodes = ref<TreeNodeAdmin[]>([]);
const collapsed = ref(new Set<number>());
const query = ref("");
const loading = ref(true);
const ready = ref(false);
const busy = ref(false);
const error = ref("");
const notice = ref("");
const rows = computed(() => treeRows(nodes.value, collapsed.value, query.value));
const importOpen = ref(false);
const csvText = ref("");
const csvResult = ref<ReturnType<typeof parseKnowledgeCsv> | null>(null);

async function load() {
  loading.value = true; error.value = ""; notice.value = "";
  try { nodes.value = await readKnowledgeTree(); ready.value = true; }
  catch (cause) { nodes.value = []; ready.value = false; error.value = cause instanceof Error ? cause.message : "知识点树暂不可用"; }
  finally { loading.value = false; }
}
function toggle(id: number) { collapsed.value = toggleCollapsed(collapsed.value, id); }
function openImport() { importOpen.value = true; csvText.value = ""; csvResult.value = null; }
function parse() { csvResult.value = parseKnowledgeCsv(csvText.value); }
async function remove(node: TreeNodeAdmin) {
  if (busy.value || !window.confirm(`确认删除「${node.title}」？服务端会检查引用并执行逻辑删除。`)) return;
  busy.value = true; error.value = ""; notice.value = "";
  try { await deleteKnowledgeNode(node.id); await load(); notice.value = "管理服务已确认删除该节点。"; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "删除未获服务端确认"; }
  finally { busy.value = false; }
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="ops-page">
    <header class="ops-heading"><div><p class="ops-eyebrow">A03 · KNOWLEDGE TREE</p><h1>知识点树</h1><p class="ops-lead">从管理服务读取完整层级。搜索可穿透折叠节点，删除前由服务端检查引用。</p></div><div class="ops-actions"><button class="ops-btn secondary" type="button" @click="load">刷新</button><button class="ops-btn secondary" type="button" @click="openImport">CSV 导入预检</button><button class="ops-btn" type="button" @click="router.push('/knowledge/edges')">配依赖边 →</button></div></header>
    <div class="toolbar ops-card"><label class="ops-field"><span>搜索节点</span><input v-model="query" type="search" placeholder="输入名称，查找父级与子级" /></label><span class="count">{{ loading ? "读取中" : error ? "数据不可用" : `服务端返回 ${nodes.length} 个节点` }}</span></div>
    <p v-if="loading" class="ops-state" role="status">正在读取服务端知识点树…</p>
    <p v-else-if="error" class="ops-state error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="ops-state" role="status">{{ notice }}</p>
    <div v-if="!loading && ready" class="ops-table-wrap">
      <table class="ops-table"><thead><tr><th>知识点</th><th>状态</th><th>操作</th></tr></thead><tbody>
        <tr v-for="row in rows" :key="row.id"><td :style="{ paddingLeft: 14 + row.depth * 20 + 'px' }"><button class="caret" type="button" :disabled="!row.expandable" :aria-label="collapsed.has(row.id) ? '展开节点' : '折叠节点'" @click="toggle(row.id)">{{ row.expandable ? (collapsed.has(row.id) ? "▸" : "▾") : "·" }}</button><strong>{{ row.title }}</strong></td><td><span class="badge" :class="row.statusClass">{{ row.statusLabel }}</span></td><td><button class="text-action" type="button" @click="router.push('/knowledge/edges')">查看依赖</button><button class="text-action danger" type="button" :disabled="busy" @click="remove(nodes.find((node) => node.id === row.id)!)">删除</button></td></tr>
        <tr v-if="rows.length === 0"><td colspan="3" class="empty">{{ query ? "没有匹配的知识点" : "服务端暂未返回知识点" }}</td></tr>
      </tbody></table>
    </div>
    <p class="foot">CSV 导入端点已列入接口文档，但上传请求格式尚未约定；当前只提供本地逐行预检，不显示导入成功。</p>
    <div v-if="importOpen" class="overlay" @click.self="importOpen = false"><section class="dialog ops-card" role="dialog" aria-modal="true" aria-labelledby="import-title"><div class="dialog-head"><h2 id="import-title">CSV 导入预检</h2><button class="text-action" type="button" @click="importOpen = false">关闭</button></div><p class="ops-muted">粘贴 CSV 后检查 path、name、difficulty 等列。预检不会修改服务端知识点。</p><label class="ops-field"><span>CSV 内容</span><textarea v-model="csvText" spellcheck="false" placeholder="path,name,difficulty,description" /></label><div class="dialog-actions"><button class="ops-btn secondary" type="button" @click="parse">解析预检</button><span class="ops-muted">正式导入待服务端定义文件上传格式</span></div><div v-if="csvResult" class="ops-state" :class="{ error: !!csvResult.errors.length }" role="status"><p>可解析 {{ csvResult.drafts.length }} 行；需修正 {{ csvResult.errors.length }} 行。</p><p v-for="entry in csvResult.errors" :key="entry.line">行 {{ entry.line }}：{{ entry.reason }}</p></div></section></div>
  </div>
</template>

<style scoped>
.toolbar{display:flex;align-items:end;gap:16px;margin-bottom:14px}.toolbar .ops-field{min-width:min(100%,340px)}.count{margin-left:auto;color:var(--ink3);font-size:12px}.badge{display:inline-block;padding:4px 9px;border-radius:99px;font-size:11px;font-weight:800}.badge.gr{background:#1e77452b;color:#20844b}.badge.warn{background:#bb801e2b;color:#a67012}.badge.grey{background:var(--ops-soft);color:var(--ink3)}.caret{width:24px;min-height:25px;margin-right:7px;border:0;background:transparent;color:var(--brand-deep);font-size:18px}.text-action{padding:5px 7px;border:0;background:transparent;color:var(--brand-deep);font-size:12px;font-weight:750}.text-action.danger{color:#b94351}.empty{text-align:center;color:var(--ink3);padding:30px!important}.foot{margin-top:12px;color:var(--ink3);font-size:12px;line-height:1.6}.overlay{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:#071126ad}.dialog{width:min(100%,650px);max-height:90vh;overflow:auto}.dialog-head,.dialog-actions{display:flex;align-items:center;justify-content:space-between;gap:10px}.dialog .ops-field{margin:18px 0}.dialog textarea{min-height:185px;font-family:ui-monospace,monospace}.dialog-actions{justify-content:flex-start}.dialog .ops-state{margin-top:15px}
@media(max-width:600px){.toolbar{flex-direction:column;align-items:stretch}.count{margin-left:0}}
</style>
