<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { parseJsonObject, validateAssessmentDraft, validateDailySchedule, type AssessmentDraft } from "../features/question/questionAdmin";
import type { AssessmentRow, QuestionRow } from "../features/question/questionProjection";
import { createQuestionAdminApi } from "../services/questionAdminApi";

const api = createQuestionAdminApi();
const rows = ref<AssessmentRow[]>([]);
const page = ref(1);
const total = ref(0);
const selectedId = ref<number | null>(null);
const draft = reactive<AssessmentDraft>({ name: "", ruleJson: "", dimsJson: "", status: 3 });
const loading = ref(false);
const detailLoading = ref(false);
const busy = ref(false);
const listError = ref("");
const detailError = ref("");
const note = ref("");
const scheduleDate = ref("");
const scheduleQuestionId = ref("");
const verifiedQuestion = ref<QuestionRow | null>(null);
const verifying = ref(false);
const scheduleNote = ref("");
const scheduleBusy = ref(false);
const errors = computed(() => validateAssessmentDraft(draft));
const ruleKeys = computed(() => Object.keys(parseJsonObject(draft.ruleJson) ?? {}));
const dimensionKeys = computed(() => Object.keys(parseJsonObject(draft.dimsJson) ?? {}));
const eligibility = computed<"eligible" | "ineligible" | "unknown">(() =>
  verifiedQuestion.value?.chainQuality === 1 ? "eligible" : verifiedQuestion.value?.chainQuality === 2 ? "ineligible" : "unknown");
const today = (): string => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};
const scheduleErrors = computed(() => validateDailySchedule(scheduleDate.value, Number(scheduleQuestionId.value), today(), eligibility.value));
const message = (cause: unknown) => cause instanceof Error ? cause.message : "请求失败，请稍后重试。";
const statusName = (value: number | null) => value === 1 ? "可用" : value === 2 ? "停用" : value === 3 ? "草稿/待审" : "状态未知";

async function loadRows(): Promise<void> {
  loading.value = true; listError.value = "";
  try { const result = await api.assessments(page.value, 20); rows.value = result.items; total.value = result.total; }
  catch (cause) { rows.value = []; total.value = 0; listError.value = message(cause); }
  finally { loading.value = false; }
}
function newAssessment(): void {
  selectedId.value = null; Object.assign(draft, { name: "", ruleJson: "", dimsJson: "", status: 3 });
  detailError.value = ""; note.value = "";
}
async function openAssessment(id: number): Promise<void> {
  if (detailLoading.value) return;
  selectedId.value = id; detailLoading.value = true; detailError.value = ""; note.value = "";
  try {
    const result = await api.assessment(id);
    if (!result) { detailError.value = "测评详情缺少规则、维度或状态字段，无法安全编辑。"; return; }
    Object.assign(draft, result);
  } catch (cause) { detailError.value = message(cause); }
  finally { detailLoading.value = false; }
}
function formatJson(field: "ruleJson" | "dimsJson"): void {
  const object = parseJsonObject(draft[field]);
  if (object) draft[field] = JSON.stringify(object, null, 2);
}
async function save(): Promise<void> {
  if (busy.value || detailLoading.value || detailError.value || errors.value.length) return;
  busy.value = true; note.value = "";
  try {
    if (selectedId.value === null) {
      const id = await api.createAssessment(draft);
      await loadRows(); await openAssessment(id);
      note.value = `服务端已创建测评 #${id}；请核对题池覆盖与发布状态。`;
    } else {
      await api.updateAssessment(selectedId.value, draft);
      note.value = `服务端已确认测评 #${selectedId.value} 的配置修改。`;
      await loadRows();
    }
  } catch (cause) { note.value = `保存未完成：${message(cause)}`; }
  finally { busy.value = false; }
}
async function verifyQuestion(): Promise<void> {
  const id = Number(scheduleQuestionId.value);
  verifiedQuestion.value = null; scheduleNote.value = "";
  if (!Number.isSafeInteger(id) || id < 1) { scheduleNote.value = "题目编号须为正整数。"; return; }
  verifying.value = true;
  try {
    const result = await api.questionSummary(id);
    if (!result) { scheduleNote.value = "题目详情缺少必要字段，无法核对。"; return; }
    verifiedQuestion.value = result;
    scheduleNote.value = result.chainQuality === 1 ? "已读取题目，服务端标记为人工精修链；提交时仍会复核。" :
      result.chainQuality === 2 ? "此题为 AI 草稿链，不能排入每日一题。" :
      "题目详情未返回可识别的推理链质量；排期将由服务端最终校验。";
  } catch (cause) { scheduleNote.value = `题目核对失败：${message(cause)}`; }
  finally { verifying.value = false; }
}
async function schedule(): Promise<void> {
  if (scheduleBusy.value || scheduleErrors.value.length || !verifiedQuestion.value || Number(scheduleQuestionId.value) !== verifiedQuestion.value.id) return;
  scheduleBusy.value = true; scheduleNote.value = "";
  try {
    await api.scheduleDaily(scheduleDate.value, verifiedQuestion.value.id);
    scheduleNote.value = `服务端已确认 ${scheduleDate.value} 每日一题排期；如同日已有记录，覆盖规则由服务端执行。`;
  } catch (cause) { scheduleNote.value = `排期未完成：${message(cause)}`; }
  finally { scheduleBusy.value = false; }
}
onMounted(() => { void loadRows(); });
</script>

<template>
  <main class="assessment-page">
    <header class="page-head"><div><span class="eyebrow">ASSESSMENT / A10</span><h1>测评配置</h1><p>分档规则、能力维度映射与每日一题排期</p></div><button class="primary" @click="newAssessment">＋ 新建测评</button></header>
    <div class="layout">
      <aside class="panel catalog"><div class="section-head"><h2>测评列表</h2><span>{{ total }} 项</span></div><div v-if="loading" class="state">正在读取…</div><div v-if="listError" class="state warning">{{ listError }} <button @click="loadRows">重试</button></div><div v-if="!loading && !listError && !rows.length" class="state">暂无测评配置。</div>
        <button v-for="item in rows" :key="item.id" class="catalog-row" :class="{ chosen: selectedId === item.id }" @click="openAssessment(item.id)"><strong>{{ item.name || `测评 #${item.id}` }}</strong><small>#{{ item.id }} · {{ statusName(item.status) }}</small></button>
        <div class="pagination"><button :disabled="page <= 1 || loading" @click="page--; loadRows()">上一页</button><span>{{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }}</span><button :disabled="page * 20 >= total || loading" @click="page++; loadRows()">下一页</button></div>
      </aside>
      <div class="workspace">
        <div v-if="detailLoading" class="notice">正在读取测评配置…</div><div v-if="detailError" class="notice bad" role="alert">{{ detailError }} <button v-if="selectedId" @click="openAssessment(selectedId)">重试</button></div><div v-if="note" class="notice" :class="{ bad: note.startsWith('保存未完成') }" role="status">{{ note }}</div>
        <section class="panel editor"><div class="section-head"><div><span class="eyebrow">{{ selectedId ? `ASSESSMENT / #${selectedId}` : 'ASSESSMENT / NEW' }}</span><h2>{{ selectedId ? '编辑测评' : '新建测评' }}</h2></div><button class="primary" :disabled="busy || detailLoading || Boolean(detailError) || Boolean(errors.length)" @click="save">{{ busy ? '保存中…' : '保存配置' }}</button></div>
          <div class="form-grid"><label>测评名称 *<input v-model.trim="draft.name" maxlength="100" placeholder="例如入学水平测评" /></label><label>状态<select v-model.number="draft.status"><option :value="3">草稿/待审</option><option :value="2">停用</option><option :value="1">可用</option></select></label></div>
          <div class="json-grid"><div class="json-panel"><div class="section-head"><h3>分档 / 升降 / 终止规则</h3><button class="text-button" @click="formatJson('ruleJson')">格式化</button></div><textarea v-model="draft.ruleJson" spellcheck="false" rows="13" placeholder="粘贴已由服务端定义的 rule_json 对象" /><p class="help">字段结构须与服务端测评引擎契约一致。当前文档未定义各字段的键名；此处校验 JSON 对象结构，业务条件由服务端执行。</p><div class="key-row">顶层字段：{{ ruleKeys.length ? ruleKeys.join('、') : '尚无有效对象' }}</div></div>
          <div class="json-panel"><div class="section-head"><h3>能力维度与知识点映射</h3><button class="text-button" @click="formatJson('dimsJson')">格式化</button></div><textarea v-model="draft.dimsJson" spellcheck="false" rows="13" placeholder="粘贴已由服务端定义的 dims_json 对象" /><p class="help">提交真实维度映射，不在前端生成题池或推断分档结果。题池审核与覆盖仍需服务端校验。</p><div class="key-row">顶层字段：{{ dimensionKeys.length ? dimensionKeys.join('、') : '尚无有效对象' }}</div></div></div>
          <ul v-if="errors.length" class="validation"><li v-for="item in errors" :key="item">{{ item }}</li></ul>
        </section>
        <section class="panel daily"><div class="section-head"><div><span class="eyebrow">DAILY / CURATED</span><h2>每日一题排期</h2></div></div><p class="help">仅人工精修推理链题目可排；日期限今天起 7 天内。同日唯一和覆盖写由服务端最终裁决。</p><div class="form-grid"><label>排期日期<input v-model="scheduleDate" type="date" /></label><label>题目 ID<div class="inline"><input v-model="scheduleQuestionId" inputmode="numeric" placeholder="输入已审核题目编号" @input="verifiedQuestion = null" /><button class="secondary" :disabled="verifying" @click="verifyQuestion">{{ verifying ? '核对中…' : '核对' }}</button></div></label></div>
          <div v-if="verifiedQuestion" class="question-card"><strong>题目 #{{ verifiedQuestion.id }}</strong><p>{{ verifiedQuestion.stem.replace(/<[^>]*>/g, '').slice(0, 160) || '题干未返回' }}</p><span :class="{ warning: eligibility !== 'eligible' }">推理链质量：{{ eligibility === 'eligible' ? '人工精修' : eligibility === 'ineligible' ? 'AI 草稿，不可排' : '接口未返回' }}</span></div>
          <ul v-if="scheduleErrors.length" class="validation"><li v-for="item in scheduleErrors" :key="item">{{ item }}</li></ul><div v-if="scheduleNote" class="notice" :class="{ bad: /失败|未完成|不能|无法/.test(scheduleNote) }" role="status">{{ scheduleNote }}</div><button class="primary" :disabled="scheduleBusy || verifying || !verifiedQuestion || Boolean(scheduleErrors.length)" @click="schedule">{{ scheduleBusy ? '提交中…' : '提交排期' }}</button>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.assessment-page{max-width:1400px}.page-head,.section-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.page-head{margin-bottom:18px}.page-head h1{margin:4px 0;font-size:24px}.page-head p,.help{color:var(--ink2);font-size:12px;line-height:1.65}.eyebrow{font-size:10px;font-weight:850;letter-spacing:.13em;color:var(--brand)}.layout{display:grid;grid-template-columns:270px minmax(0,1fr);gap:16px}.panel{padding:20px;border:1px solid var(--line);border-radius:12px;background:var(--ops-card,#fff);color:var(--ink)}.catalog{align-self:start}.catalog h2,.panel h2{margin:4px 0 13px;font-size:17px}.section-head span{font-size:12px;color:var(--ink2)}.catalog-row{display:block;width:100%;padding:12px 11px;text-align:left;border:1px solid transparent;border-radius:9px;background:none;color:var(--ink)}.catalog-row:hover,.catalog-row.chosen{border-color:var(--brand);background:var(--brand-soft)}.catalog-row strong,.catalog-row small{display:block}.catalog-row strong{font-size:13px;line-height:1.5}.catalog-row small{margin-top:4px;color:var(--ink2);font-size:11px}.pagination{display:flex;justify-content:space-between;align-items:center;gap:5px;margin-top:12px;font-size:11px;color:var(--ink2)}.pagination button{padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--ops-card,#fff);color:var(--brand)}button:disabled{opacity:.46;cursor:not-allowed}.primary,.secondary{min-height:36px;padding:8px 15px;border:0;border-radius:8px;background:var(--brand);color:var(--ops-on-brand,#fff);font-weight:750}.secondary{border:1px solid var(--line);background:var(--ops-card,#fff);color:var(--brand-deep)}.form-grid,.json-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.json-grid{margin-top:18px}.form-grid label{font-size:12px;font-weight:700;color:var(--ink2)}input,select,textarea{display:block;width:100%;min-height:36px;margin-top:6px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--ops-card,#fff);color:var(--ink);font:inherit}textarea{resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px;line-height:1.55}.json-panel{min-width:0}.json-panel h3{margin:0;font-size:14px}.text-button{border:0;background:none;color:var(--brand);font-size:12px}.key-row{padding:8px 10px;border-radius:7px;background:var(--brand-soft);color:var(--brand-deep);font-size:11px;word-break:break-word}.daily{margin-top:15px}.inline{display:flex;gap:7px}.inline input{flex:1;min-width:0}.inline button{align-self:end}.question-card{margin:16px 0;padding:13px;border:1px solid var(--line);border-radius:9px;background:var(--brand-soft);font-size:12px}.question-card p{margin:6px 0;line-height:1.5}.warning{color:#b45309}.state{padding:18px 8px;color:var(--ink2);font-size:12px}.state button,.notice button{border:0;background:none;color:inherit;text-decoration:underline}.notice{margin:12px 0;padding:11px 13px;border:1px solid #cbdcfb;border-radius:8px;background:var(--brand-soft);color:var(--brand-deep);font-size:12px}.notice.bad,.validation{color:var(--ink)}.notice.bad{border-color:#f1b7b7;background:var(--ops-danger-bg)}.validation{margin:10px 0;padding-left:19px;font-size:12px;line-height:1.7}@media(max-width:1050px){.layout{grid-template-columns:1fr}.catalog{display:flex;flex-wrap:wrap;gap:5px}.catalog .section-head,.catalog .state,.catalog .pagination{width:100%}.catalog-row{width:min(220px,100%)}}@media(max-width:700px){.page-head{align-items:flex-start;flex-direction:column}.json-grid{grid-template-columns:1fr}}@media(max-width:510px){.form-grid{grid-template-columns:1fr}}
</style>
