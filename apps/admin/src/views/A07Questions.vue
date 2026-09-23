<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import LmTablePage from "../components/LmTablePage.vue";
import type { FilterDef } from "../features/adminShell";
import { Q_TYPES, qTypeLabel } from "../features/question/questionAdmin";
import type { QuestionRow } from "../features/question/questionProjection";
import { createQuestionAdminApi } from "../services/questionAdminApi";

const router = useRouter();
const api = createQuestionAdminApi();
const filters: FilterDef[] = [
  { key: "keyword", label: "题干关键词", type: "text" },
  { key: "type", label: "题型", type: "select", options: ["全部", ...Q_TYPES.map((type) => type.label)] },
  { key: "difficulty", label: "难度", type: "select", options: ["全部", "1", "2", "3", "4", "5"] },
  { key: "status", label: "状态", type: "select", options: ["全部", "可用", "停用", "待审"] },
];
const columns = [
  { key: "id", label: "ID", width: 75 }, { key: "stem", label: "题干" },
  { key: "type", label: "题型", width: 90 }, { key: "difficulty", label: "难度", width: 75 },
  { key: "status", label: "状态", width: 85 }, { key: "source", label: "来源", width: 85 },
];
const query = ref<Record<string, string>>({ keyword: "", type: "全部", difficulty: "全部", status: "全部" });
const rows = ref<QuestionRow[]>([]);
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const error = ref("");
const actionNote = ref("");
const statusName = (value: number | null) => ({ 1: "可用", 2: "停用", 3: "待审" })[value as 1 | 2 | 3] ?? "未知";
const sourceName = (value: number | null) => ({ 1: "官方", 2: "导入", 3: "AI" })[value as 1 | 2 | 3] ?? "未标注";
const message = (cause: unknown) => cause instanceof Error ? cause.message : "请求失败，请稍后重试。";

async function load(): Promise<void> {
  loading.value = true; error.value = "";
  try {
    const type = Q_TYPES.find((item) => item.label === query.value.type)?.key ?? "";
    const status = query.value.status === "全部" ? "" : String(["可用", "停用", "待审"].indexOf(query.value.status) + 1);
    const result = await api.questions({ keyword: query.value.keyword.trim(), type,
      difficulty: query.value.difficulty === "全部" ? "" : query.value.difficulty, status, page: page.value, size: 20 });
    rows.value = result.items; total.value = result.total;
  } catch (cause) { rows.value = []; total.value = 0; error.value = message(cause); }
  finally { loading.value = false; }
}
function search(next: Record<string, string>): void { query.value = next; page.value = 1; void load(); }
function reset(): void { query.value = { keyword: "", type: "全部", difficulty: "全部", status: "全部" }; page.value = 1; void load(); }
function setPage(next: number): void { page.value = next; void load(); }
async function rowAction(action: string, row: Record<string, unknown>): Promise<void> {
  const id = Number(row.id);
  if (!Number.isSafeInteger(id) || id < 1) return;
  if (action === "view" || action === "edit") { await router.push(`/questions/${id}/edit`); return; }
  if (action !== "delete" || !window.confirm(`确定删除题目 #${id}？引用与历史作答将由服务端校验。`)) return;
  actionNote.value = "";
  try { await api.deleteQuestion(id); actionNote.value = `题目 #${id} 删除请求已由服务端确认，操作已审计。`; await load(); }
  catch (cause) { actionNote.value = `删除未完成：${message(cause)}`; }
}
async function checkDuplicates(): Promise<void> {
  actionNote.value = "";
  try {
    const result = await api.duplicates();
    const record = result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : {};
    const candidates = Array.isArray(result) ? result : Array.isArray(record.items) ? record.items : null;
    actionNote.value = candidates ? `服务端返回 ${candidates.length} 条疑似重复记录；详情字段尚待接口对齐。` : "查重服务已响应，但未返回可识别的记录列表。";
  } catch (cause) { actionNote.value = `查重失败：${message(cause)}`; }
}
onMounted(() => { void load(); });
</script>

<template>
  <section class="questions-page">
    <div v-if="loading" class="notice" role="status">正在读取题库…</div>
    <div v-if="error" class="notice error" role="alert">{{ error }} <button @click="load">重试</button></div>
    <div v-if="actionNote" class="notice" role="status">{{ actionNote }}</div>
    <LmTablePage title="题库" :filters="filters" :columns="columns" :rows="rows as unknown as Array<Record<string, unknown>>"
      :total="total" :page="page" :page-size="20" @search="search" @reset="reset" @update:page="setPage" @row-action="rowAction">
      <template #acts><button class="btn secondary" @click="checkDuplicates">疑似重复检查</button><button class="btn" @click="router.push('/questions/0/edit')">＋ 新建题目</button></template>
      <template #cell-stem="{ row }"><span class="stem">{{ String(row.stem || '题干未返回').replace(/<[^>]*>/g, '').slice(0, 68) }}</span></template>
      <template #cell-type="{ row }"><span class="tag">{{ qTypeLabel(row.type) }}</span></template>
      <template #cell-difficulty="{ row }">{{ row.difficulty ?? "—" }}</template>
      <template #cell-status="{ row }"><span class="tag" :class="row.status === 3 ? 'pending' : ''">{{ statusName(Number(row.status)) }}</span></template>
      <template #cell-source="{ row }">{{ sourceName(Number(row.source)) }}</template>
    </LmTablePage>
    <p class="footnote">管理端展示与编辑仅依据服务端题库。测评与挑战题池的审核、公开同族排除由发布服务再次校验。</p>
  </section>
</template>

<style scoped>
.questions-page{max-width:1250px}.btn{min-height:35px;padding:7px 14px;border:0;border-radius:8px;background:var(--brand);color:var(--ops-on-brand);font-weight:700}.btn.secondary{border:1px solid var(--line);background:var(--ops-card);color:var(--brand-deep)}.notice{margin-bottom:12px;padding:11px 14px;border:1px solid #d9e5fb;border-radius:9px;background:var(--ops-soft);color:var(--ink);font-size:13px}.notice.error{border-color:#f1b7b7;background:var(--ops-danger-bg);color:var(--ink)}.notice button{border:0;background:none;color:inherit;text-decoration:underline}.stem{display:block;max-width:620px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.tag{display:inline-block;padding:2px 8px;border-radius:6px;background:var(--brand-soft);color:var(--brand-deep);font-size:12px;font-weight:700}.tag.pending{background:var(--ops-warn-bg);color:var(--ink)}.footnote{margin-top:12px;color:var(--ink2);font-size:12px;line-height:1.6}
</style>
