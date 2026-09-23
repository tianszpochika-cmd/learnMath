<script setup lang="ts">
import { onMounted, ref } from "vue";
import { createOperationsApi, publicConfigEntries, record, type RecordValue } from "../services/operations";
import "../styles/ops.css";

const api = createOperationsApi();
const usage = ref<RecordValue | null>(null);
const provider = ref<RecordValue | null>(null);
const loading = ref(false);
const error = ref("");

async function load() {
  loading.value = true; error.value = ""; usage.value = null; provider.value = null;
  const results = await Promise.allSettled([api.usage(), api.configs()]);
  if (results[0]?.status === "fulfilled") usage.value = results[0].value;
  if (results[1]?.status === "fulfilled") provider.value = record(results[1].value.ai);
  if (results.some((result) => result.status === "rejected")) error.value = "部分管理数据暂不可用，可稍后重试。";
  loading.value = false;
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="ao-page">
    <header class="ao-head"><div><span class="ao-kicker">AI OPERATIONS · A17</span><h1>AI 与内容供给</h1><p>供应状态和用量来自管理接口；涉及发布的工作流须以审核快照及版本回执为准。</p></div><button class="ao-btn secondary" :disabled="loading" @click="load">刷新</button></header>
    <p v-if="error" class="ao-state error" role="alert">{{ error }}</p><p v-if="loading" class="ao-state" role="status">正在读取 AI 用量与配置…</p>
    <div v-else class="ao-grid"><section class="ao-card"><span class="ao-kicker">PROVIDER</span><h2>当前供应配置</h2><dl v-if="provider && publicConfigEntries(provider).length"><template v-for="entry in publicConfigEntries(provider)" :key="entry.key"><dt>{{ entry.key }}</dt><dd>{{ entry.value }}</dd></template></dl><p v-else>管理接口未返回可展示的供应配置。</p><p class="ao-note">密钥、令牌和私密字段始终不在界面回显。配置写入结构及权限未明确前不开放编辑。</p></section><section class="ao-card"><span class="ao-kicker">USAGE</span><h2>服务端用量</h2><dl v-if="usage && publicConfigEntries(usage).length"><template v-for="entry in publicConfigEntries(usage)" :key="entry.key"><dt>{{ entry.key }}</dt><dd>{{ entry.value }}</dd></template></dl><p v-else>当前没有可展示的用量汇总。</p><p class="ao-muted">仅显示接口实际返回的指标；未返回费用时不估算。</p></section><section class="ao-card"><span class="ao-kicker">CONTENT SUPPLY</span><h2>审核与发布任务</h2><p>推理链、四卡与公式的管理队列及 <code>expectedRevision</code> 发布请求尚无可调用的管理端接口结构。</p><p class="ao-note">此处保留任务说明；没有审核回执时不显示“已发布”或伪造队列数量。每日一题排期请从测评配置进入。</p></section></div>
  </div>
</template>

<style scoped>dl{display:grid;grid-template-columns:minmax(110px,1fr) 1.2fr;gap:8px 12px;margin:15px 0}dt{color:var(--ink2);overflow-wrap:anywhere}dd{margin:0;font-weight:700;overflow-wrap:anywhere}.ao-card code{color:var(--brand-deep)}</style>

