<script setup lang="ts">
import { onMounted, ref } from "vue";
import { createOperationsApi, displayValue, publicConfigEntries, record, type RecordValue } from "../services/operations";
import "../styles/ops.css";

const api = createOperationsApi();
const tab = ref<"configs" | "logs">("configs");
const configs = ref<RecordValue | null>(null);
const logs = ref<RecordValue[]>([]);
const total = ref<number | null>(null);
const page = ref(1);
const operator = ref("");
const action = ref("");
const loading = ref(false);
const error = ref("");
const groups = ["ai", "sms", "wechat", "exam", "gamification"];

async function load() {
  loading.value = true; error.value = "";
  try {
    if (tab.value === "configs") configs.value = await api.configs();
    else { const result = await api.oplogs(page.value, operator.value.trim(), action.value.trim()); logs.value = result.items; total.value = result.total; }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "系统数据暂不可用"; if (tab.value === "logs") logs.value = []; else configs.value = null; }
  finally { loading.value = false; }
}
function switchTab(next: "configs" | "logs") { tab.value = next; void load(); }
function search() { page.value = 1; void load(); }
function turn(next: number) { page.value = next; void load(); }
onMounted(() => { void load(); });
</script>

<template>
  <div class="ao-page">
    <header class="ao-head"><div><span class="ao-kicker">SYSTEM & AUDIT · A19</span><h1>系统与操作日志</h1><p>配置按分组查看，凭证不回显；日志以管理接口的真实记录为准。</p></div><button class="ao-btn secondary" :disabled="loading" @click="load">刷新</button></header>
    <div class="ao-tabs" role="group" aria-label="系统页面"><button :aria-pressed="tab === 'configs'" @click="switchTab('configs')">系统配置</button><button :aria-pressed="tab === 'logs'" @click="switchTab('logs')">操作日志</button></div>
    <p v-if="error" class="ao-state error" role="alert">{{ error }}</p><p v-if="loading" class="ao-state" role="status">正在读取管理数据…</p>
    <template v-else-if="tab === 'configs'"><div class="ao-grid"><section v-for="group in groups" :key="group" class="ao-card"><span class="ao-kicker">{{ group.toUpperCase() }}</span><h2>{{ group }} 配置</h2><dl v-if="publicConfigEntries(record(configs?.[group])).length"><template v-for="entry in publicConfigEntries(record(configs?.[group]))" :key="entry.key"><dt>{{ entry.key }}</dt><dd>{{ entry.value }}</dd></template></dl><p v-else class="ao-muted">此分组没有可公开展示的配置值。</p></section></div><p class="ao-note">管理接口目前只列出 PUT /configs，尚未定义字段级校验、版本冲突与私密字段回显规范。此页不提供无依据的保存或“连接测试”操作。</p></template>
    <template v-else><form class="ao-toolbar" @submit.prevent="search"><label for="operator">操作人</label><input id="operator" v-model="operator" placeholder="操作人 ID 或名称"><label for="op-action">动作</label><input id="op-action" v-model="action" placeholder="动作关键词"><button class="ao-btn" type="submit">查询</button></form><div class="ao-table-wrap"><table class="ao-table"><thead><tr><th>时间</th><th>操作人</th><th>动作</th><th>对象</th><th>结果</th></tr></thead><tbody><tr v-for="(row,index) in logs" :key="String(row.id ?? index)"><td>{{ displayValue(row.createdAt ?? row.occurredAt) }}</td><td>{{ displayValue(row.operator ?? row.adminName) }}</td><td>{{ displayValue(row.action) }}</td><td>{{ displayValue(row.target ?? row.resource) }}</td><td>{{ displayValue(row.result ?? row.status) }}</td></tr><tr v-if="!logs.length"><td colspan="5">当前筛选没有服务端日志。</td></tr></tbody></table></div><nav class="ao-pager" aria-label="日志分页"><button :disabled="page <= 1 || loading" @click="turn(page - 1)">上一页</button><span>第 {{ page }} 页{{ total === null ? '' : ` · 共 ${total} 条` }}</span><button :disabled="loading || (total === null ? logs.length < 20 : page * 20 >= total)" @click="turn(page + 1)">下一页</button></nav></template>
  </div>
</template>

<style scoped>dl{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin:13px 0}dt{color:var(--ink2);overflow-wrap:anywhere}dd{margin:0;font-weight:700;overflow-wrap:anywhere}</style>

