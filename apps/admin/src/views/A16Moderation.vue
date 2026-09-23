<script setup lang="ts">
import { onMounted, ref } from "vue";
import { createOperationsApi, displayValue, label, type RecordValue } from "../services/operations";
import "../styles/ops.css";

const api = createOperationsApi();
const kind = ref<"pending" | "reports">("pending");
const rows = ref<RecordValue[]>([]);
const total = ref<number | null>(null);
const page = ref(1);
const loading = ref(false);
const busy = ref(false);
const error = ref("");
const success = ref("");
const selected = ref<RecordValue | null>(null);
const action = ref<"approve" | "delete" | "reject" | null>(null);
const reason = ref("");
const reviewType = (value: unknown) => label(value).toLowerCase() === "reply" ? "reply" : label(value).toLowerCase() === "post" ? "post" : null;
const selectedType = () => reviewType(selected.value?.type);

async function load(): Promise<void> {
  loading.value = true; error.value = "";
  try { const result = await api.communityQueue(page.value, kind.value); rows.value = result.items; total.value = result.total; }
  catch (cause) { rows.value = []; error.value = cause instanceof Error ? cause.message : "审核队列暂不可用"; }
  finally { loading.value = false; }
}
function switchKind(next: "pending" | "reports") { kind.value = next; page.value = 1; selected.value = null; void load(); }
function turn(next: number) { page.value = next; void load(); }
function prepare(row: RecordValue, next: "approve" | "delete" | "reject") {
  selected.value = row; action.value = next; reason.value = ""; success.value = "";
}
async function confirmAudit() {
  const id = label(selected.value?.id);
  const type = selectedType();
  if (!id || !type || !action.value || busy.value) return;
  busy.value = true; error.value = ""; success.value = "";
  try {
    await api.audit(type, id, action.value, reason.value);
    const previousAction = action.value;
    selected.value = null; action.value = null; reason.value = "";
    await load();
    success.value = `${previousAction === "approve" ? "通过" : previousAction === "delete" ? "删除" : "驳回"}操作已由服务端确认；可在操作日志中核对。`;
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "审核操作未确认"; }
  finally { busy.value = false; }
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="ao-page">
    <header class="ao-head"><div><span class="ao-kicker">COMMUNITY CARE · A16</span><h1>社区审核</h1><p>先看内容和上下文，再决定通过、删除或驳回。每次写入都以管理接口回执为准。</p></div></header>
    <div class="ao-tabs" role="group" aria-label="审核任务"><button :aria-pressed="kind === 'pending'" @click="switchKind('pending')">待审内容</button><button :aria-pressed="kind === 'reports'" @click="switchKind('reports')">举报线索</button></div>
    <p v-if="error" class="ao-state error" role="alert">{{ error }}</p><p v-if="success" class="ao-state ok" role="status">{{ success }}</p><p v-if="loading" class="ao-state" role="status">正在读取审核队列…</p>
    <div v-else class="ao-grid"><article v-for="row in rows" :key="String(row.id)" class="ao-card"><span class="ao-kicker">{{ displayValue(row.type) }} · #{{ displayValue(row.id) }}</span><h2>{{ displayValue(row.title) }}</h2><p>{{ displayValue(row.content ?? row.body) }}</p><p class="ao-muted">状态：{{ displayValue(row.status) }} · 提交时间：{{ displayValue(row.createdAt) }}</p><div v-if="kind === 'pending' && reviewType(row.type)" class="ao-actions"><button class="ao-btn" @click="prepare(row, 'approve')">准备通过</button><button class="ao-btn secondary" @click="prepare(row, 'reject')">准备驳回</button><button class="ao-btn danger" @click="prepare(row, 'delete')">准备删除</button></div><p v-else class="ao-note">此类线索的处理请求结构未在接口文档中定义，暂不提供无依据的写入按钮。</p></article><p v-if="!rows.length" class="ao-state">当前筛选没有服务端记录。</p></div>
    <nav class="ao-pager" aria-label="审核分页"><button :disabled="page <= 1 || loading" @click="turn(page - 1)">上一页</button><span>第 {{ page }} 页{{ total === null ? '' : ` · 共 ${total} 条` }}</span><button :disabled="loading || (total === null ? rows.length < 20 : page * 20 >= total)" @click="turn(page + 1)">下一页</button></nav>
    <aside v-if="selected && action" class="ao-drawer" role="dialog" aria-modal="true" aria-label="确认审核操作"><div class="ao-head"><h2>确认{{ action === 'approve' ? '通过' : action === 'delete' ? '删除' : '驳回' }}</h2><button class="ao-btn secondary" @click="selected = null; action = null">关闭</button></div><p>对象：{{ selected.type }} #{{ selected.id }}</p><p class="ao-note">提交后会请求管理域审核接口；页面只在成功回读队列后更新列表。</p><label for="audit-reason">原因{{ action === 'approve' ? '（可选）' : '（必填）' }}</label><textarea id="audit-reason" v-model="reason" maxlength="300" placeholder="填写可追溯的审核原因"></textarea><div class="ao-actions"><button class="ao-btn secondary" @click="selected = null; action = null">取消</button><button class="ao-btn" :disabled="busy || (action !== 'approve' && !reason.trim())" @click="confirmAudit">{{ busy ? '提交中…' : '确认提交' }}</button></div></aside>
  </div>
</template>

