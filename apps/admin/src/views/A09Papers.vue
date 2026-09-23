<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { Q_TYPES, emptyPaperDraft, validatePaperDraft, validatePaperQuestions, type PaperDraft } from "../features/question/questionAdmin";
import type { KnowledgeChoice, PaperQuestionRow, PaperRow, QuestionRow } from "../features/question/questionProjection";
import { createQuestionAdminApi } from "../services/questionAdminApi";

const api = createQuestionAdminApi();
const papers = ref<PaperRow[]>([]);
const page = ref(1);
const total = ref(0);
const selectedId = ref<number | null>(null);
const draft = reactive<PaperDraft>(emptyPaperDraft());
const questions = ref<PaperQuestionRow[] | null>(null);
const knowledge = ref<KnowledgeChoice[]>([]);
const preview = ref<QuestionRow[] | null>(null);
const shortfall = ref<number | null>(null);
const tab = ref<"rules" | "manual">("rules");
const candidateId = ref("");
const manualNodeId = ref("");
const busy = ref(false);
const loading = ref(false);
const detailLoading = ref(false);
const note = ref("");
const error = ref("");
const listError = ref("");
const knowledgeError = ref("");
const draftErrors = computed(() => validatePaperDraft(draft));
const lineupErrors = computed(() => questions.value === null ? ["试卷详情未返回题目清单。"] : validatePaperQuestions(questions.value, draft.purpose));
const totalScore = computed(() => questions.value?.reduce((sum, item) => sum + Number(item.score || 0), 0) ?? 0);
const purposeLabels: Record<PaperDraft["purpose"], string> = { practice: "练习", exam: "考试", assessment: "测评", promotion: "晋级", boss: "Boss", challenge: "挑战" };
const message = (cause: unknown) => cause instanceof Error ? cause.message : "请求失败，请稍后重试。";

async function loadPapers(): Promise<void> {
  loading.value = true; listError.value = "";
  try { const result = await api.papers(page.value, 20); papers.value = result.items; total.value = result.total; }
  catch (cause) { papers.value = []; total.value = 0; listError.value = message(cause); }
  finally { loading.value = false; }
}
async function loadKnowledge(): Promise<void> {
  try { knowledge.value = await api.knowledgeChoices(); }
  catch (cause) { knowledgeError.value = `知识点树读取失败：${message(cause)}。可填写已知编号。`; }
}
function newPaper(): void {
  selectedId.value = null; Object.assign(draft, emptyPaperDraft()); questions.value = null;
  preview.value = null; note.value = ""; error.value = ""; tab.value = "rules";
}
async function openPaper(id: number): Promise<void> {
  if (detailLoading.value) return;
  selectedId.value = id; detailLoading.value = true; error.value = ""; note.value = "";
  questions.value = null; preview.value = null;
  try {
    const result = await api.paper(id);
    if (!result.draft) { error.value = "试卷详情缺少必要字段，无法安全编辑。"; return; }
    Object.assign(draft, result.draft); questions.value = result.questions;
    tab.value = result.draft.type === 1 ? "manual" : "rules";
  } catch (cause) { error.value = message(cause); }
  finally { detailLoading.value = false; }
}
function toggleNode(id: number): void {
  draft.rule.nodeIds = draft.rule.nodeIds.includes(id) ? draft.rule.nodeIds.filter((item) => item !== id) : [...draft.rule.nodeIds, id];
  preview.value = null;
}
function addNode(): void {
  const id = Number(manualNodeId.value);
  if (!Number.isSafeInteger(id) || id < 1) { note.value = "知识点编号须为正整数。"; return; }
  if (!draft.rule.nodeIds.includes(id)) draft.rule.nodeIds.push(id);
  manualNodeId.value = ""; note.value = ""; preview.value = null;
}
function toggleType(type: typeof Q_TYPES[number]["key"]): void {
  draft.rule.questionTypes = draft.rule.questionTypes.includes(type) ? draft.rule.questionTypes.filter((item) => item !== type) : [...draft.rule.questionTypes, type];
  preview.value = null;
}
async function previewRules(): Promise<void> {
  if (busy.value || draft.type !== 2) return;
  preview.value = null; note.value = "";
  if (draftErrors.value.length) { note.value = draftErrors.value.join("；"); return; }
  busy.value = true;
  try {
    const result = await api.previewPaper(draft.rule);
    if (!result) { note.value = "预览接口未返回可识别的题目清单。"; return; }
    preview.value = result.questions; shortfall.value = result.insufficient;
    note.value = "已读取服务端抽题预览；发布资格由服务端复核。";
  } catch (cause) { note.value = `预览失败：${message(cause)}`; }
  finally { busy.value = false; }
}
async function savePaper(): Promise<void> {
  if (busy.value || detailLoading.value || draftErrors.value.length || error.value) return;
  busy.value = true; note.value = "";
  try {
    if (selectedId.value === null) {
      const id = await api.createPaper(draft);
      await loadPapers(); await openPaper(id);
      note.value = `服务端已创建试卷 #${id}；请核对题目清单与发布条件。`;
    } else {
      await api.updatePaper(selectedId.value, draft);
      note.value = `服务端已确认试卷 #${selectedId.value} 的修改。`;
      await loadPapers();
    }
  } catch (cause) { note.value = `保存未完成：${message(cause)}`; }
  finally { busy.value = false; }
}
async function addQuestion(): Promise<void> {
  if (questions.value === null || busy.value) return;
  const id = Number(candidateId.value);
  if (!Number.isSafeInteger(id) || id < 1) { note.value = "题目编号须为正整数。"; return; }
  if (questions.value.some((item) => item.questionId === id)) { note.value = "题目不能重复。"; return; }
  busy.value = true; note.value = "";
  try {
    const row = await api.questionSummary(id);
    if (!row) { note.value = "题目详情缺少必要字段，无法添加。"; return; }
    if (["assessment", "promotion", "boss", "challenge"].includes(draft.purpose) && (row.type === "ESSAY" || row.status !== 1)) {
      note.value = "限制用途试卷只能加入已知可用的客观题。"; return;
    }
    questions.value.push({ questionId: id, seq: questions.value.length + 1, score: 5, stem: row.stem, type: row.type, status: row.status });
    candidateId.value = "";
  } catch (cause) { note.value = `读取题目失败：${message(cause)}`; }
  finally { busy.value = false; }
}
function move(index: number, delta: number): void {
  if (!questions.value) return;
  const next = index + delta;
  if (next < 0 || next >= questions.value.length) return;
  const [item] = questions.value.splice(index, 1);
  if (item) questions.value.splice(next, 0, item);
}
async function saveLineup(): Promise<void> {
  if (selectedId.value === null || questions.value === null || lineupErrors.value.length || busy.value || error.value) return;
  busy.value = true; note.value = "";
  try {
    await api.adjustPaperQuestions(selectedId.value, questions.value.map((item, index) => ({ questionId: item.questionId, seq: index + 1, score: item.score })));
    await openPaper(selectedId.value);
    note.value = "服务端已确认顺序与分值，并已重新读取当前试卷。";
  } catch (cause) { note.value = `调卷未完成：${message(cause)}`; }
  finally { busy.value = false; }
}
onMounted(() => { void loadPapers(); void loadKnowledge(); });
</script>

<template>
  <main class="papers-page">
    <header class="page-head"><div><span class="eyebrow">CONTENT / A09</span><h1>试卷与组卷</h1><p>规则抽题、手动调序与分值配置</p></div><button class="primary" @click="newPaper">＋ 新建试卷</button></header>
    <div class="layout">
      <aside class="panel catalog">
        <div class="section-head"><h2>试卷列表</h2><span>{{ total }} 份</span></div>
        <div v-if="loading" class="state">正在读取…</div><div v-if="listError" class="state warning">{{ listError }} <button @click="loadPapers">重试</button></div>
        <div v-if="!loading && !listError && !papers.length" class="state">暂无试卷，可新建草稿。</div>
        <button v-for="paper in papers" :key="paper.id" class="catalog-row" :class="{ chosen: selectedId === paper.id }" @click="openPaper(paper.id)"><strong>{{ paper.title || `试卷 #${paper.id}` }}</strong><small>#{{ paper.id }} · {{ paper.type === 1 ? '手动' : paper.type === 2 ? '规则' : '类型未知' }} · {{ paper.totalScore ?? '—' }} 分</small></button>
        <div class="pagination"><button :disabled="page <= 1 || loading" @click="page--; loadPapers()">上一页</button><span>{{ page }} / {{ Math.max(1, Math.ceil(total / 20)) }}</span><button :disabled="page * 20 >= total || loading" @click="page++; loadPapers()">下一页</button></div>
      </aside>
      <div class="workspace">
        <div v-if="detailLoading" class="notice">正在读取试卷详情…</div><div v-if="error" class="notice bad" role="alert">{{ error }} <button v-if="selectedId" @click="openPaper(selectedId)">重试</button></div><div v-if="note" class="notice" :class="{ bad: /失败|未完成|无法|须为/.test(note) }" role="status">{{ note }}</div>
        <section class="panel">
          <div class="section-head"><div><span class="eyebrow">{{ selectedId ? `PAPER / #${selectedId}` : 'PAPER / NEW' }}</span><h2>{{ selectedId ? '编辑试卷' : '新建试卷' }}</h2></div><button class="primary" :disabled="busy || detailLoading || Boolean(error) || Boolean(draftErrors.length)" @click="savePaper">{{ busy ? '处理中…' : '保存试卷' }}</button></div>
          <div class="form-grid">
            <label>试卷名称 *<input v-model.trim="draft.title" maxlength="100" placeholder="输入可辨识的名称" /></label>
            <label>组卷方式<select v-model.number="draft.type" @change="tab = draft.type === 1 ? 'manual' : 'rules'"><option :value="2">规则抽题</option><option :value="1">手动组卷</option></select></label>
            <label>用途<select v-model="draft.purpose"><option v-for="(label, key) in purposeLabels" :key="key" :value="key">{{ label }}</option></select></label>
            <label>时长（分钟）<input v-model.number="draft.duration" type="number" min="0" step="1" /></label>
            <label>反馈时机<select v-model="draft.feedbackMode"><option value="immediate">逐题反馈</option><option value="on_submit">交卷后反馈</option></select></label>
            <label>辅助策略<select v-model="draft.assistancePolicy"><option value="learning">学习辅助</option><option value="reference_only">仅参考资料</option><option value="restricted">限制辅助</option><option value="open_book">开卷</option></select></label>
          </div>
          <p class="help">测评、晋级、Boss、挑战须交卷后反馈并限制辅助。审核状态和公开同族仍由服务端校验。</p><ul v-if="draftErrors.length" class="validation"><li v-for="item in draftErrors" :key="item">{{ item }}</li></ul>
        </section>
        <nav class="tabs" aria-label="组卷操作"><button :class="{ active: tab === 'rules' }" @click="tab = 'rules'">规则抽题</button><button :class="{ active: tab === 'manual' }" @click="tab = 'manual'">手动调序改分</button></nav>
        <section v-if="tab === 'rules'" class="panel"><div class="section-head"><div><span class="eyebrow">RULE / PREVIEW</span><h2>抽题规则</h2></div><button class="secondary" :disabled="draft.type !== 2 || busy || Boolean(draftErrors.length)" @click="previewRules">预览抽题</button></div>
          <p v-if="draft.type !== 2" class="help">当前为手动组卷，请先切换组卷方式。</p>
          <div class="form-grid"><label>知识点 ID<div class="inline"><input v-model="manualNodeId" inputmode="numeric" placeholder="已知编号" @keyup.enter="addNode" /><button @click="addNode">添加</button></div></label><label>难度<select v-model.number="draft.rule.difficulty" @change="preview = null"><option :value="null">不限</option><option v-for="level in 5" :key="level" :value="level">{{ level }}</option></select></label><label>抽题数量<input v-model.number="draft.rule.count" type="number" min="1" max="100" @input="preview = null" /></label></div>
          <p v-if="knowledgeError" class="help warning">{{ knowledgeError }}</p><div v-if="knowledge.length" class="choices"><button v-for="node in knowledge" :key="node.id" :class="{ selected: draft.rule.nodeIds.includes(node.id) }" @click="toggleNode(node.id)">{{ node.name }} #{{ node.id }}</button></div><p v-if="draft.rule.nodeIds.length" class="help">已选知识点：{{ draft.rule.nodeIds.join('、') }}</p>
          <h3>题型范围</h3><div class="choices"><button v-for="type in Q_TYPES" :key="type.key" :class="{ selected: draft.rule.questionTypes.includes(type.key) }" @click="toggleType(type.key)">{{ type.label }}</button></div><p class="help">不选题型表示交由服务端规则决定；限制用途不可包含解答题。</p>
          <div v-if="preview !== null" class="preview"><h3>服务端预览 · {{ preview.length }} 道</h3><p v-if="shortfall !== null && shortfall > 0" class="warning">缺少 {{ shortfall }} 道题，请调整规则。</p><p v-else-if="preview.length < draft.rule.count" class="warning">抽题数量低于目标，请核对规则结果。</p><div v-if="!preview.length" class="state">服务端未抽到题目。</div><div v-for="(item, index) in preview" :key="item.id" class="preview-row"><span>{{ index + 1 }}.</span><span>{{ item.stem.replace(/<[^>]*>/g, '').slice(0, 110) || '题干未返回' }}</span><small>#{{ item.id }}</small></div></div>
        </section>
        <section v-else class="panel"><div class="section-head"><div><span class="eyebrow">MANUAL / SCORE</span><h2>题目顺序与分值</h2></div><strong class="score">{{ totalScore }} 分</strong></div><p class="help">先保存试卷，再读取服务端清单。更改只在点击保存后提交。</p><div v-if="selectedId === null" class="state">请先保存试卷以取得服务端编号。</div><div v-else-if="questions === null" class="state">详情未返回可识别的题目清单，暂不能调序或改分。</div><template v-else><div class="add-row"><input v-model="candidateId" inputmode="numeric" placeholder="输入题目 ID" /><button class="secondary" :disabled="busy" @click="addQuestion">读取并添加</button></div><div v-if="!questions.length" class="state">当前试卷尚无题目。</div><div v-for="(item, index) in questions" :key="item.questionId" class="lineup-row"><span class="seq">{{ index + 1 }}</span><div class="lineup-title"><strong>{{ item.stem.replace(/<[^>]*>/g, '').slice(0, 100) || `题目 #${item.questionId}` }}</strong><small>#{{ item.questionId }} · {{ item.type || '题型未返回' }}</small></div><label>分值<input v-model.number="item.score" type="number" min="1" max="100" step="1" /></label><div class="row-buttons"><button :disabled="index === 0" aria-label="上移" @click="move(index, -1)">↑</button><button :disabled="index === questions.length - 1" aria-label="下移" @click="move(index, 1)">↓</button><button aria-label="移除" @click="questions.splice(index, 1)">×</button></div></div><ul v-if="lineupErrors.length" class="validation"><li v-for="item in lineupErrors" :key="item">{{ item }}</li></ul><button class="primary save-lineup" :disabled="busy || Boolean(lineupErrors.length) || Boolean(error)" @click="saveLineup">保存顺序与分值</button></template>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.papers-page{max-width:1400px}.page-head,.section-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.page-head{margin-bottom:18px}.page-head h1{margin:4px 0;font-size:24px}.page-head p,.help{color:var(--ink2);font-size:12px;line-height:1.65}.eyebrow{font-size:10px;font-weight:850;letter-spacing:.13em;color:var(--brand)}.layout{display:grid;grid-template-columns:270px minmax(0,1fr);gap:16px}.panel{padding:20px;border:1px solid var(--line);border-radius:12px;background:var(--ops-card)}.catalog{align-self:start}.catalog h2,.panel h2{margin:4px 0 13px;font-size:17px}.section-head span{font-size:12px;color:var(--ink2)}.catalog-row{display:block;width:100%;padding:12px 11px;text-align:left;border:1px solid transparent;border-radius:9px;background:none;color:var(--ink)}.catalog-row:hover,.catalog-row.chosen{border-color:#cad9f7;background:var(--brand-soft)}.catalog-row strong,.catalog-row small{display:block}.catalog-row strong{font-size:13px;line-height:1.5}.catalog-row small{margin-top:4px;color:var(--ink2);font-size:11px}.pagination{display:flex;justify-content:space-between;align-items:center;gap:5px;margin-top:12px;font-size:11px;color:var(--ink2)}.pagination button,.row-buttons button{padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--ops-card);color:var(--brand)}button:disabled{opacity:.46;cursor:not-allowed}.primary,.secondary{min-height:36px;padding:8px 15px;border:0;border-radius:8px;background:var(--brand);color:var(--ops-on-brand);font-weight:750}.secondary{border:1px solid var(--line);background:var(--ops-card);color:var(--brand-deep)}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.form-grid label,.lineup-row label{font-size:12px;font-weight:700;color:var(--ink2)}input,select{display:block;width:100%;min-height:36px;margin-top:6px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--ops-card);color:var(--ink);font:inherit}.inline,.add-row{display:flex;gap:8px}.inline button{margin-top:6px;padding:5px 10px;border:0;border-radius:7px;background:var(--brand-soft);color:var(--brand-deep)}.tabs{display:flex;gap:8px;margin:15px 0}.tabs button{padding:9px 14px;border:1px solid var(--line);border-radius:8px;background:var(--ops-card);color:var(--ink2);font-weight:700}.tabs button.active{border-color:var(--brand);background:var(--brand-soft);color:var(--brand-deep)}.choices{display:flex;flex-wrap:wrap;gap:7px;max-height:180px;overflow:auto;margin:11px 0}.choices button{padding:7px 10px;border:1px solid var(--line);border-radius:7px;background:var(--ops-card);color:var(--ink2);font-size:12px}.choices button.selected{border-color:var(--brand);background:var(--brand-soft);color:var(--brand-deep);font-weight:700}.panel h3{margin:20px 0 8px;font-size:14px}.preview{margin-top:18px;padding-top:8px;border-top:1px solid var(--line)}.preview-row,.lineup-row{display:flex;align-items:center;gap:10px;padding:11px 4px;border-bottom:1px solid var(--line);font-size:12px}.preview-row span:nth-child(2){flex:1}.preview-row small{color:var(--ink2)}.lineup-title{flex:1;min-width:0}.lineup-title strong,.lineup-title small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lineup-title small{margin-top:3px;color:var(--ink2)}.lineup-row label{width:95px}.seq{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--brand-soft);color:var(--brand-deep);font-weight:800}.row-buttons{display:flex;gap:4px}.score{color:var(--brand)}.add-row{margin:18px 0}.add-row input{max-width:270px;margin:0}.save-lineup{margin-top:16px}.state{padding:18px 8px;color:var(--ink2);font-size:12px}.warning{color:#b45309}.state button,.notice button{border:0;background:none;color:inherit;text-decoration:underline}.notice{margin-bottom:12px;padding:11px 13px;border:1px solid #cbdcfb;border-radius:8px;background:var(--ops-soft);color:var(--ink);font-size:12px}.notice.bad,.validation{color:var(--ink)}.notice.bad{border-color:#f1b7b7;background:var(--ops-danger-bg)}.validation{margin:10px 0;padding-left:19px;font-size:12px;line-height:1.7}@media(max-width:1050px){.layout{grid-template-columns:1fr}.catalog{display:flex;flex-wrap:wrap;gap:5px}.catalog .section-head,.catalog .state,.catalog .pagination{width:100%}.catalog-row{width:min(220px,100%)}}@media(max-width:700px){.page-head{align-items:flex-start;flex-direction:column}.form-grid{grid-template-columns:1fr 1fr}.lineup-row{flex-wrap:wrap}.lineup-title{min-width:calc(100% - 40px)}}@media(max-width:510px){.form-grid{grid-template-columns:1fr}}
</style>
