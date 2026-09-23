<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { createOperationsApi, displayValue, label, record, userStatusLabel, type RecordValue } from "../services/operations";
import "../styles/ops.css";

const api = createOperationsApi();
const rows = ref<RecordValue[]>([]);
const total = ref<number | null>(null);
const page = ref(1);
const keyword = ref("");
const loading = ref(false);
const busy = ref(false);
const error = ref("");
const success = ref("");
const detail = ref<RecordValue | null>(null);
const detailId = ref("");
const action = ref<"enabled" | "disabled" | null>(null);
const reason = ref("");
const pathRows = computed(() => Array.isArray(detail.value?.pathProgress) ? detail.value.pathProgress.map(record) : []);
const pointRows = computed(() => Array.isArray(detail.value?.pointsLedger) ? detail.value.pointsLedger.map(record) : []);

async function load(): Promise<void> {
  loading.value = true; error.value = "";
  try { const result = await api.users(page.value, keyword.value.trim()); rows.value = result.items; total.value = result.total; }
  catch (cause) { rows.value = []; error.value = cause instanceof Error ? cause.message : "学员列表暂不可用"; }
  finally { loading.value = false; }
}
async function openUser(row: RecordValue): Promise<void> {
  const id = label(row.id);
  if (!id) return;
  detailId.value = id; detail.value = null; action.value = null; error.value = "";
  try { detail.value = await api.user(id); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "学员详情暂不可用"; }
}
async function changeStatus(): Promise<void> {
  if (!action.value || !detailId.value || !reason.value.trim() || busy.value) return;
  busy.value = true; error.value = ""; success.value = "";
  try {
    await api.setUserStatus(detailId.value, action.value, reason.value);
    detail.value = await api.user(detailId.value);
    await load();
    success.value = "管理端已确认状态变更；请在操作日志核对记录。";
    action.value = null; reason.value = "";
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "状态变更未确认"; }
  finally { busy.value = false; }
}
function search() { page.value = 1; void load(); }
function turn(next: number) { page.value = next; void load(); }
onMounted(() => { void load(); });
</script>

<template>
  <div class="ao-page">
    <header class="ao-head"><div><span class="ao-kicker">LEARNERS · A15</span><h1>学员管理</h1><p>查看真实账号状态与学习概况；修改状态需填写原因并由服务端确认。</p></div></header>
    <form class="ao-toolbar" @submit.prevent="search"><label for="user-search">账号或昵称</label><input id="user-search" v-model="keyword" type="search" placeholder="输入关键词"><button class="ao-btn" type="submit">查询</button></form>
    <p v-if="error" class="ao-state error" role="alert">{{ error }}</p><p v-if="success" class="ao-state ok" role="status">{{ success }}</p><p v-if="loading" class="ao-state" role="status">正在读取学员列表…</p>
    <div v-else class="ao-table-wrap"><table class="ao-table"><thead><tr><th>ID</th><th>昵称</th><th>账号状态</th><th>注册时间</th><th>操作</th></tr></thead><tbody><tr v-for="row in rows" :key="String(row.id)"><td>{{ displayValue(row.id) }}</td><td>{{ displayValue(row.nickname ?? row.name) }}</td><td>{{ userStatusLabel(row.status) }}</td><td>{{ displayValue(row.createdAt) }}</td><td><button class="ao-btn secondary" type="button" @click="openUser(row)">查看详情</button></td></tr><tr v-if="!rows.length"><td colspan="5">当前查询没有服务端记录。</td></tr></tbody></table></div>
    <nav class="ao-pager" aria-label="学员分页"><button :disabled="page <= 1 || loading" @click="turn(page - 1)">上一页</button><span>第 {{ page }} 页{{ total === null ? '' : ` · 共 ${total} 条` }}</span><button :disabled="loading || (total === null ? rows.length < 20 : page * 20 >= total)" @click="turn(page + 1)">下一页</button></nav>
    <aside v-if="detailId" class="ao-drawer" role="dialog" aria-modal="true" aria-label="学员详情"><div class="ao-head"><h2>学员 #{{ detailId }}</h2><button class="ao-btn secondary" @click="detailId = ''; detail = null">关闭</button></div><p v-if="!detail" class="ao-state">详情尚未返回。</p><template v-else><dl><dt>昵称</dt><dd>{{ displayValue(detail.nickname ?? detail.name) }}</dd><dt>状态</dt><dd>{{ userStatusLabel(detail.status) }}</dd><dt>路径进度</dt><dd>{{ displayValue(detail.pathProgress) }}</dd><dt>积分</dt><dd>{{ displayValue(detail.points) }}</dd><dt>注册时间</dt><dd>{{ displayValue(detail.createdAt) }}</dd></dl><section v-if="pathRows.length" class="ao-detail-section"><h3>路径进度</h3><p v-for="(entry,index) in pathRows" :key="index">{{ displayValue(entry.pathName ?? entry.name ?? entry.code) }} · {{ displayValue(entry.progress ?? entry.completionRate) }}</p></section><section v-if="pointRows.length" class="ao-detail-section"><h3>积分流水</h3><p v-for="(entry,index) in pointRows" :key="index">{{ displayValue(entry.createdAt) }} · {{ displayValue(entry.reason ?? entry.type) }} · {{ displayValue(entry.delta ?? entry.points) }}</p></section><p class="ao-note">学习明细只展示接口明确返回的字段；缺少路径或积分记录时保留未知。</p><div class="ao-actions"><button class="ao-btn secondary" @click="action = 'enabled'">准备启用</button><button class="ao-btn danger" @click="action = 'disabled'">准备禁用</button></div><div v-if="action" class="ao-card"><h3>确认{{ action === 'disabled' ? '禁用' : '启用' }}此账号</h3><label for="user-reason">操作原因</label><textarea id="user-reason" v-model="reason" maxlength="300" placeholder="供审计核对的原因"></textarea><div class="ao-actions"><button class="ao-btn secondary" @click="action = null">取消</button><button class="ao-btn" :disabled="!reason.trim() || busy" @click="changeStatus">{{ busy ? '提交中…' : '提交并回读状态' }}</button></div></div></template></aside>
  </div>
</template>

