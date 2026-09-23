<script setup lang="ts">
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import { computed, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Q_TYPES, answerKeys, emptyQuestionDraft, optionKey, validateQuestionDraft, type QType } from "../features/question/questionAdmin";
import type { KnowledgeChoice } from "../features/question/questionProjection";
import { createQuestionAdminApi } from "../services/questionAdminApi";

const route = useRoute();
const router = useRouter();
const api = createQuestionAdminApi();
const resourceId = computed(() => Number(route.params.id));
const isNew = computed(() => resourceId.value === 0);
const draft = reactive(emptyQuestionDraft());
const knowledge = ref<KnowledgeChoice[]>([]);
const nodeSelection = ref("");
const manualNode = ref("");
const nodeError = ref("");
const busy = ref(false);
const loading = ref(false);
const loadError = ref("");
const saveNote = ref("");
const errors = computed(() => validateQuestionDraft(draft));
const selectedAnswers = computed(() => answerKeys(draft.answer));
const message = (cause: unknown) => cause instanceof Error ? cause.message : "请求失败，请稍后重试。";

const editor = useEditor({
  content: "",
  extensions: [StarterKit],
  onUpdate: ({ editor: current }) => { draft.stem = current.getText().trim() ? current.getHTML() : ""; saveNote.value = ""; },
});

function switchType(type: QType): void {
  draft.type = type;
  draft.answer = "";
  if (type === "JUDGE") draft.options = [{ key: "A", text: "对" }, { key: "B", text: "错" }];
  else if (type === "SINGLE" || type === "MULTI") draft.options = [{ key: "A", text: "" }, { key: "B", text: "" }];
  else draft.options = [];
  if (type !== "FILL") { draft.judgeConfig.tolerance = 0; draft.judgeConfig.proportionalFill = false; }
}
function toggleAnswer(key: string): void {
  if (draft.type === "MULTI") {
    const selected = new Set(selectedAnswers.value);
    selected.has(key) ? selected.delete(key) : selected.add(key);
    draft.answer = [...selected].sort().join(",");
  } else draft.answer = key;
}
function addOption(): void {
  const key = optionKey(draft.options.length);
  if (key) draft.options.push({ key, text: "" });
}
function deleteOption(index: number): void {
  const selected = new Set(selectedAnswers.value);
  const selectedOptions = draft.options.filter((item) => selected.has(item.key));
  draft.options.splice(index, 1);
  draft.options.forEach((item, position) => { item.key = optionKey(position); });
  draft.answer = selectedOptions.filter((item) => draft.options.includes(item)).map((item) => item.key).join(",");
}
function setFamily(event: Event): void {
  const input = event.target as HTMLInputElement;
  draft.questionFamilyId = input.value.trim() ? Number(input.value) : null;
}
function addNode(raw: string): void {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1) { nodeError.value = "知识点编号须为正整数。"; return; }
  if (!draft.nodeIds.includes(id)) draft.nodeIds.push(id);
  nodeSelection.value = ""; manualNode.value = ""; nodeError.value = "";
}

async function loadKnowledge(): Promise<void> {
  try { knowledge.value = await api.knowledgeChoices(); nodeError.value = ""; }
  catch (cause) { nodeError.value = `知识点树暂不可读取：${message(cause)}。可输入已知编号。`; }
}
async function loadQuestion(): Promise<void> {
  if (isNew.value) { Object.assign(draft, emptyQuestionDraft()); editor.value?.commands.setContent(""); return; }
  if (!Number.isSafeInteger(resourceId.value) || resourceId.value < 1) { loadError.value = "题目编号无效。"; return; }
  loading.value = true; loadError.value = "";
  try {
    const result = await api.question(resourceId.value);
    if (!result) { loadError.value = "题目不存在或接口字段尚未形成可编辑数据。"; return; }
    Object.assign(draft, result);
    editor.value?.commands.setContent(result.stem);
  } catch (cause) { loadError.value = message(cause); }
  finally { loading.value = false; }
}
async function save(): Promise<void> {
  saveNote.value = "";
  if (errors.value.length || busy.value) return;
  busy.value = true;
  try {
    if (isNew.value) {
      const id = await api.createQuestion(draft);
      saveNote.value = `服务端已创建题目 #${id}；操作已审计。`;
      await router.replace(`/questions/${id}/edit`);
    } else {
      await api.updateQuestion(resourceId.value, draft);
      saveNote.value = "服务端已确认修改；操作已审计。";
    }
  } catch (cause) { saveNote.value = `保存未完成：${message(cause)}`; }
  finally { busy.value = false; }
}
watch(() => route.params.id, () => { saveNote.value = ""; void loadQuestion(); }, { immediate: true });
void loadKnowledge();
</script>

<template>
  <main class="editor-page">
    <header class="page-head"><div><button class="back" @click="router.push('/questions')">← 题库列表</button><h1>{{ isNew ? '新建题目' : `编辑题目 #${resourceId}` }}</h1><p>五类题型 · 题干与判分依据由服务端审核保存</p></div><button class="primary" :disabled="busy || loading || Boolean(errors.length)" @click="save">{{ busy ? '保存中…' : '保存题目' }}</button></header>
    <div v-if="loading" class="notice" role="status">正在读取题目…</div>
    <div v-if="loadError" class="notice error" role="alert">{{ loadError }} <button @click="loadQuestion">重试</button></div>
    <div v-if="saveNote" class="notice" :class="{ error: saveNote.startsWith('保存未完成') }" role="status">{{ saveNote }}</div>
    <div v-if="!loadError" class="columns">
      <section class="panel">
        <span class="eyebrow">01 / 基本内容</span><h2>题面与题型</h2>
        <div class="type-tabs"><button v-for="type in Q_TYPES" :key="type.key" :class="{ active: draft.type === type.key }" @click="switchType(type.key)">{{ type.label }}</button></div>
        <label class="field-label">题干 *</label><EditorContent v-if="editor" :editor="editor" class="stem-editor" />
        <p class="help">支持富文本；LaTeX 以原文保存，展示端负责安全排版。空题干不会提交。</p>
        <div class="two"><label>难度 1–5 *<input v-model.number="draft.difficulty" type="number" min="1" max="5" /></label><label>变式族编号<input :value="draft.questionFamilyId ?? ''" type="number" min="1" placeholder="可留空" @input="setFamily" /></label></div>
        <label class="field-label">关联知识点 *（至少一个）</label>
        <div class="node-controls"><select v-model="nodeSelection" @change="nodeSelection && addNode(nodeSelection)"><option value="">从知识点树选择</option><option v-for="item in knowledge" :key="item.id" :value="String(item.id)">{{ '　'.repeat(item.depth) }}{{ item.name }} #{{ item.id }}</option></select><input v-model="manualNode" inputmode="numeric" placeholder="或输入节点 ID" @keyup.enter="addNode(manualNode)" /><button @click="addNode(manualNode)">添加</button></div>
        <p v-if="nodeError" class="inline-error">{{ nodeError }}</p><div class="node-tags"><button v-for="id in draft.nodeIds" :key="id" @click="draft.nodeIds = draft.nodeIds.filter((value) => value !== id)">知识点 #{{ id }} ×</button></div>

        <template v-if="draft.type === 'SINGLE' || draft.type === 'MULTI' || draft.type === 'JUDGE'">
          <label class="field-label">选项与标准答案 *</label><p class="help">{{ draft.type === 'MULTI' ? '勾选至少两个正确项。' : '只勾选一个正确项。' }}</p>
          <div v-for="(option, index) in draft.options" :key="option.key" class="option-row"><span>{{ option.key }}</span><input v-model="option.text" :readonly="draft.type === 'JUDGE'" placeholder="选项内容" /><label><input type="checkbox" :checked="selectedAnswers.includes(option.key)" @change="toggleAnswer(option.key)" />正确</label><button v-if="draft.type !== 'JUDGE'" title="删除选项" @click="deleteOption(index)">×</button></div>
          <button v-if="draft.type !== 'JUDGE'" class="secondary" :disabled="draft.options.length >= 26" @click="addOption">＋ 添加选项</button>
        </template>
        <template v-else><label class="field-label">{{ draft.type === 'FILL' ? '填空标准答案 *' : '解答要点 / 参考答案 *' }}</label><textarea v-model="draft.answer" rows="4" :placeholder="draft.type === 'FILL' ? '例：2|二||3（空内可接受答案用 |；多空用 ||）' : '写明解答要点，正式作答进入自评，不作客观自动判分'" /><p class="help">{{ draft.type === 'ESSAY' ? '解答题不进入客观判分；测评、晋级战、Boss 和挑战赛发布时不得纳入。' : '填空按空位比对；容差和按空计分在判分配置中设置。' }}</p></template>
        <label class="field-label">解析</label><textarea v-model="draft.analysis" rows="5" placeholder="填写审核后的解析；公开每日题会展示安全版本" />
      </section>

      <aside class="side">
        <section class="panel"><span class="eyebrow">02 / 判分与审核</span><h2>判分配置</h2><label class="check"><input v-model="draft.judgeConfig.fullWidth" type="checkbox" /> 全角转半角</label><label class="check"><input v-model="draft.judgeConfig.stripSeparators" type="checkbox" /> 忽略分隔符</label><label class="check"><input v-model="draft.judgeConfig.lowercase" type="checkbox" /> 英文小写归一</label><label class="field-label">数值容差 0–0.1（仅填空）</label><input v-model.number="draft.judgeConfig.tolerance" type="number" min="0" max="0.1" step="0.001" :disabled="draft.type !== 'FILL'" /><label class="check"><input v-model="draft.judgeConfig.proportionalFill" type="checkbox" :disabled="draft.type !== 'FILL'" /> 多空按命中比例计分</label><p class="help">这里只校验配置结构；真实判分由服务端按作答状态执行。</p></section>
        <section class="panel"><span class="eyebrow">03 / 供给状态</span><h2>来源与审核</h2><label class="field-label">来源</label><select v-model.number="draft.source"><option :value="1">官方</option><option :value="2">导入</option><option :value="3">AI 生成</option></select><label class="field-label">状态</label><select v-model.number="draft.status"><option :value="3">待审</option><option :value="2">停用</option><option :value="1">可用</option></select><p class="help">可用状态仍需服务端校验审核、题族曝光与引用关系。</p></section>
        <section class="panel validation"><span class="eyebrow">CHECK / 提交前校验</span><h2>{{ errors.length ? `${errors.length} 项待处理` : '结构校验通过' }}</h2><ul v-if="errors.length"><li v-for="item in errors" :key="item">{{ item }}</li></ul><p v-else>可提交服务端复检。这里不会模拟判分或发布结果。</p></section>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.editor-page{max-width:1220px}.page-head{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-bottom:16px}.page-head h1{margin:6px 0;font-size:24px}.page-head p,.help{color:var(--ink2);font-size:12px;line-height:1.6}.back{border:0;background:none;color:var(--brand);font-weight:700}.primary,.secondary{min-height:36px;padding:8px 16px;border:0;border-radius:8px;background:var(--brand);color:var(--ops-on-brand);font-weight:700}.primary:disabled,.secondary:disabled{opacity:.5}.secondary{margin-top:8px;border:1px solid var(--line);background:var(--ops-card);color:var(--brand-deep)}.columns{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(270px,1fr);gap:16px}.panel{min-width:0;margin-bottom:14px;padding:20px;border:1px solid var(--line);border-radius:12px;background:var(--ops-card)}.panel h2{margin:5px 0 16px;font-size:18px}.eyebrow{font-size:10px;font-weight:850;letter-spacing:.13em;color:var(--brand)}.type-tabs{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px}.type-tabs button{min-height:36px;padding:6px 14px;border:1px solid var(--line);border-radius:8px;background:var(--ops-card);color:var(--ink2);font-weight:700}.type-tabs button.active{border-color:var(--brand);background:var(--brand-soft);color:var(--brand-deep)}.field-label{display:block;margin:16px 0 7px;color:var(--ink2);font-size:12px;font-weight:800}.stem-editor :deep(.tiptap){min-height:120px;padding:13px;border:1px solid var(--line);border-radius:9px;outline:0;line-height:1.75}.stem-editor :deep(.tiptap:focus){border-color:var(--brand)}input:not([type=checkbox]),textarea,select{width:100%;min-height:36px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--ops-card);color:var(--ink);font:inherit}textarea{resize:vertical}.two{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:11px}.two label{font-size:12px;color:var(--ink2)}.two input{margin-top:6px}.option-row{display:grid;grid-template-columns:25px minmax(0,1fr) auto 25px;align-items:center;gap:8px;margin-top:8px}.option-row>span{color:var(--brand);font-weight:850}.option-row label{white-space:nowrap;font-size:12px}.option-row label input{margin-right:5px}.option-row button{border:0;background:none;color:#b91c1c;font-size:19px}.node-controls{display:grid;grid-template-columns:1fr 160px 54px;gap:7px}.node-controls button{border:0;border-radius:8px;background:var(--brand-soft);color:var(--brand-deep);font-weight:700}.node-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.node-tags button{padding:5px 8px;border:0;border-radius:99px;background:var(--brand-soft);color:var(--brand-deep);font-size:11px}.inline-error{color:#b91c1c;font-size:12px;margin-top:6px}.check{display:block;margin:10px 0;color:var(--ink2);font-size:13px}.check input{margin-right:7px}.validation{border-color:#cbdcfb;background:var(--ops-soft)}.validation ul{padding-left:19px;color:#b91c1c;line-height:1.8;font-size:12px}.validation p{color:var(--ink2);font-size:12px}.notice{margin-bottom:14px;padding:11px 14px;border:1px solid #d9e5fb;border-radius:9px;background:var(--ops-soft);color:var(--ink);font-size:13px}.notice.error{border-color:#f1b7b7;background:var(--ops-danger-bg);color:var(--ink)}.notice button{border:0;background:none;color:inherit;text-decoration:underline}@media(max-width:930px){.columns{grid-template-columns:1fr}.side{display:grid;grid-template-columns:1fr 1fr;gap:12px}.side .panel{margin:0}}@media(max-width:620px){.page-head{align-items:start;flex-direction:column}.two,.side{grid-template-columns:1fr}.node-controls{grid-template-columns:1fr 1fr}.node-controls select{grid-column:1/-1}.option-row{grid-template-columns:24px minmax(0,1fr) 54px 18px}}
</style>
