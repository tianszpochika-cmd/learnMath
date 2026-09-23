<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { createOperationsApi, displayValue, downloadStatsCsv, pageResult, publicConfigEntries, record, type RecordValue } from "../services/operations";
import "../styles/ops.css";

type Kind = "overview" | "paths" | "content" | "learners";
const api = createOperationsApi();
const kinds: Array<{ key: Kind; label: string }> = [
  { key: "overview", label: "运营概览" }, { key: "paths", label: "路径转化" },
  { key: "content", label: "内容表现" }, { key: "learners", label: "学员分层" },
];
const kind = ref<Kind>("overview");
const data = ref<unknown>(null);
const loading = ref(false);
const exporting = ref(false);
const error = ref("");
const from = ref("");
const to = ref("");
const rows = computed<RecordValue[]>(() => pageResult(data.value).items);
const columns = computed(() => Object.keys(rows.value[0] ?? {}).filter((key) => !/(secret|password|token|api.?key)/i.test(key)).slice(0, 8));
const metrics = computed(() => publicConfigEntries(record(data.value)));

async function load() {
  loading.value = true; error.value = ""; data.value = null;
  try { data.value = await api.stats(kind.value); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "统计暂不可用"; }
  finally { loading.value = false; }
}
function switchKind(next: Kind) { kind.value = next; void load(); }
async function exportCsv() {
  if (exporting.value) return;
  exporting.value = true; error.value = "";
  try { await downloadStatsCsv(kind.value, from.value, to.value); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "导出未完成"; }
  finally { exporting.value = false; }
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="ao-page">
    <header class="ao-head"><div><span class="ao-kicker">EVIDENCE DASHBOARD · A18</span><h1>数据统计</h1><p>指标、分母与时间范围以服务端汇总为准；无数据时不绘制趋势。</p></div><button class="ao-btn secondary" :disabled="loading" @click="load">刷新数据</button></header>
    <div class="ao-tabs" role="group" aria-label="统计类型"><button v-for="item in kinds" :key="item.key" :aria-pressed="kind === item.key" @click="switchKind(item.key)">{{ item.label }}</button></div>
    <form class="ao-toolbar" @submit.prevent="exportCsv"><label for="stats-from">导出起始</label><input id="stats-from" v-model="from" type="date" required><label for="stats-to">结束</label><input id="stats-to" v-model="to" type="date" required><button class="ao-btn" :disabled="exporting || !from || !to" type="submit">{{ exporting ? '下载中…' : '导出当前报表 CSV' }}</button></form>
    <p v-if="error" class="ao-state error" role="alert">{{ error }}</p><p v-if="loading" class="ao-state" role="status">正在读取统计汇总…</p>
    <template v-else-if="kind === 'overview'"><div v-if="metrics.length" class="ao-grid"><article v-for="metric in metrics" :key="metric.key" class="ao-card"><span class="ao-kicker">{{ metric.key }}</span><h2>{{ metric.value }}</h2></article></div><p v-else class="ao-state">当前没有可核对的概览指标。</p></template>
    <template v-else><div v-if="rows.length" class="ao-table-wrap"><table class="ao-table"><thead><tr><th v-for="column in columns" :key="column">{{ column }}</th></tr></thead><tbody><tr v-for="(row,index) in rows" :key="index"><td v-for="column in columns" :key="column">{{ displayValue(row[column]) }}</td></tr></tbody></table></div><p v-else class="ao-state">服务端没有返回当前分组的明细，暂不展示示例图表。</p></template>
  </div>
</template>

