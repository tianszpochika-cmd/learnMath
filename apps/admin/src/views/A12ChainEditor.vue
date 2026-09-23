<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { chainIssues, projectChain, serializeChain, STEP_TYPES, type ChainDocument, type ChainPath, type ChainStep } from "../features/chain/chainAdmin";
import { createChainsApi, type ChainSubject } from "../services/chains";

const route = useRoute();
const api = createChainsApi();
const type = ref<ChainSubject>(route.query.subjectType === "formula" ? "formula" : "question");
const subjectId = ref(typeof route.query.subjectId === "string" ? route.query.subjectId : "");
const loadedSubject = ref("");
const document = ref<ChainDocument | null>(null);
const paths = ref<ChainPath[]>([]);
const selectedPathId = ref<number | null>(null);
const selectedStepId = ref<number | null>(null);
const warrantText = ref("");
const busy = ref(false);
const dirty = ref(false);
const error = ref("");
const notice = ref("");
const issuesShown = ref(false);
const preview = ref<unknown>(null);
const selectedPath = computed(() => paths.value.find((path) => path.id === selectedPathId.value) ?? null);
const steps = computed(() => selectedPath.value?.steps ?? []);
const selectedStep = computed(() => steps.value.find((step) => step.id === selectedStepId.value) ?? null);
const issues = computed(() => chainIssues(steps.value));
const warrantValid = computed(() => warrantText.value === "" ||
  /^\s*[1-9]\d*(\s*,\s*[1-9]\d*)*\s*$/.test(warrantText.value) &&
  warrantText.value.split(",").every((part) => Number.isSafeInteger(Number(part.trim()))));
const json = (value: unknown) => { try { return JSON.stringify(value, null, 2) ?? "—"; } catch { return "响应无法显示"; } };
const errorText = (value: unknown) => value instanceof Error ? value.message : "请求失败，请稍后重试";
const stepName = (value: number) => STEP_TYPES[value - 1] ?? `未知类型 ${value}`;
watch([type, subjectId], () => {
  if (dirty.value || loadedSubject.value === `${type.value}:${subjectId.value}`) return;
  document.value = null; paths.value = []; selectedPathId.value = null; selectedStepId.value = null; preview.value = null;
});
function markDirty(): void { dirty.value = true; notice.value = "当前修改只在本页，尚未保存；在线快照不受影响。"; }
function selectStep(step: ChainStep): void { selectedStepId.value = step.id; warrantText.value = step.warrantNodes.join(", "); }
function choosePath(path: ChainPath): void {
  if (dirty.value) return;
  selectedPathId.value = path.id;
  if (path.steps.length) selectStep(path.steps[0]!); else { selectedStepId.value = null; warrantText.value = ""; }
  issuesShown.value = false; preview.value = null;
}
async function load(): Promise<boolean> {
  const id = Number(subjectId.value);
  if (!Number.isSafeInteger(id) || id <= 0) { error.value = "请输入真实题目或公式的正整数编号"; return false; }
  if (dirty.value && !window.confirm("放弃尚未保存的推理链修改并重新读取？")) return false;
  busy.value = true; error.value = ""; notice.value = ""; preview.value = null;
  try {
    const parsed = projectChain(await api.read(type.value, id));
    if (!parsed) throw new Error("链响应不符合 paths×steps 结构，已停止编辑以免覆盖服务端内容");
    document.value = parsed; paths.value = parsed.paths; dirty.value = false; loadedSubject.value = `${type.value}:${subjectId.value}`;
    const next = parsed.paths.find((path) => path.id === selectedPathId.value) ?? parsed.paths[0];
    if (next) choosePath(next); else { selectedPathId.value = null; selectedStepId.value = null; notice.value = "该资源没有解法链。新建链的请求结构尚未明确，请先由内容服务建立工作稿。"; }
    return true;
  } catch (cause) {
    if (loadedSubject.value !== `${type.value}:${subjectId.value}`) {
      document.value = null; paths.value = []; selectedPathId.value = null; selectedStepId.value = null;
    }
    error.value = errorText(cause); return false;
  }
  finally { busy.value = false; }
}
function updateWarrantNodes(): void {
  if (!selectedStep.value) return;
  if (!warrantValid.value) return;
  selectedStep.value.warrantNodes = warrantText.value ? warrantText.value.split(",").map((value) => Number(value.trim())) : [];
  markDirty();
}
function addStep(): void {
  const path = selectedPath.value; if (!path) return;
  const tempId = Math.min(0, ...path.steps.map((step) => step.id)) - 1;
  const previous = path.steps.at(-1)?.id;
  const step: ChainStep = { id: tempId, seq: path.steps.length + 1, stepType: 6, content: "", warrant: "", warrantNodes: [], motive: "", offRamp: "", dependsOn: previous ? [previous] : [], prediction: null, raw: {} };
  path.steps.push(step); selectStep(step); markDirty();
}
function move(index: number, direction: -1 | 1): void {
  const list = selectedPath.value?.steps; if (!list || index + direction < 0 || index + direction >= list.length) return;
  [list[index], list[index + direction]] = [list[index + direction]!, list[index]!]; markDirty();
}
function removeStep(step: ChainStep): void {
  const list = selectedPath.value?.steps; if (!list || !window.confirm(`从本页工作稿移除步骤 #${step.id}？保存后由服务端处理历史引用。`)) return;
  const index = list.indexOf(step); if (index < 0) return;
  list.splice(index, 1); list.forEach((item) => { item.dependsOn = item.dependsOn.filter((id) => id !== step.id); });
  if (selectedStepId.value === step.id) { if (list.length) selectStep(list[Math.min(index, list.length - 1)]!); else selectedStepId.value = null; }
  markDirty();
}
async function save(): Promise<void> {
  if (!document.value || !selectedPath.value || !dirty.value || busy.value || loadedSubject.value !== `${type.value}:${subjectId.value}`) return;
  issuesShown.value = true;
  if (issues.value.length || !warrantValid.value) { error.value = "本地结构检查未通过；修正后再提交服务端。"; return; }
  busy.value = true; error.value = ""; notice.value = "";
  try {
    await api.save(type.value, Number(subjectId.value), serializeChain(document.value, paths.value));
    dirty.value = false;
    if (await load()) notice.value = "服务端接受了保存请求，工作稿已重新读取；这不代表人工校对或发布完成。";
  } catch (cause) { error.value = errorText(cause); }
  finally { busy.value = false; }
}
async function loadPreview(): Promise<void> {
  if (!selectedPath.value) return;
  preview.value = null; error.value = "";
  try { preview.value = await api.preview(selectedPath.value.id); }
  catch (cause) { error.value = errorText(cause); }
}
</script>

<template>
  <div class="chain-page">
    <header class="heading"><div><span class="eyebrow">A12 · REASONING CHAIN</span><h1>推理链编辑器</h1><p>四要素、依据挂点与步骤依赖一起编辑。工作稿保存、人工校对与在线快照是不同阶段。</p></div><div class="header-actions"><button type="button" class="btn ghost" :disabled="!selectedPath" @click="issuesShown = true">检查结构</button><button type="button" class="btn primary" :disabled="!dirty || busy || !selectedPath" @click="save">{{ busy ? "处理中…" : "保存工作稿" }}</button></div></header>
    <div class="toolbar"><label>主体<select v-model="type" :disabled="busy || dirty"><option value="question">题目</option><option value="formula">公式</option></select></label><label>资源 ID<input v-model="subjectId" inputmode="numeric" placeholder="输入真实编号" :disabled="busy || dirty" @keyup.enter="load"></label><button type="button" class="btn" :disabled="busy" @click="load">读取推理链</button><span v-if="dirty" class="unsaved">● 未保存</span></div>
    <p v-if="error" class="message bad" role="alert">{{ error }}</p><p v-if="notice" class="message" role="status">{{ notice }}</p>
    <div v-if="!document" class="empty">输入题目或公式编号读取服务端工作稿。页面没有预置链数据。</div>
    <template v-else><nav class="path-tabs" aria-label="解法选择"><button v-for="path in paths" :key="path.id" type="button" class="btn" :class="{ active: selectedPathId === path.id }" :disabled="dirty && selectedPathId !== path.id" @click="choosePath(path)">{{ path.title || `解法 #${path.id}` }}</button></nav><div v-if="selectedPath" class="columns"><section class="panel list"><div class="section-head"><h2>步骤列表</h2><button type="button" class="btn" @click="addStep">＋ 加步</button></div><p class="hint">步骤 ID 保持稳定，↑↓ 只改变本次工作稿顺序。</p><div v-if="!steps.length" class="empty">尚无步骤。</div><div v-for="(step, index) in steps" :key="step.id" class="step" :class="{ active: step.id === selectedStepId }"><button type="button" class="step-select" @click="selectStep(step)"><strong>S{{ index + 1 }} · {{ stepName(step.stepType) }}</strong><small>{{ step.content || "待填写内容" }}</small></button><span class="step-actions"><button type="button" :disabled="index === 0" :aria-label="`上移 S${index + 1}`" @click="move(index, -1)">↑</button><button type="button" :disabled="index === steps.length - 1" :aria-label="`下移 S${index + 1}`" @click="move(index, 1)">↓</button><button type="button" :aria-label="`移除 S${index + 1}`" @click="removeStep(step)">×</button></span></div></section><section class="panel editor"><h2>{{ selectedStep ? `步骤 #${selectedStep.id < 0 ? "待服务端分配" : selectedStep.id}` : "选择步骤" }}</h2><template v-if="selectedStep"><label>step_type<select v-model.number="selectedStep.stepType" @change="markDirty"><option v-for="(name, index) in STEP_TYPES" :key="name" :value="index + 1">{{ name }}</option></select></label><label>content · 步骤内容<textarea v-model="selectedStep.content" rows="5" @input="markDirty"></textarea></label><label>warrant · 合法性依据<textarea v-model="selectedStep.warrant" rows="3" @input="markDirty"></textarea></label><label>依据知识点 ID，逗号分隔<input v-model="warrantText" placeholder="使用真实知识点编号" :aria-invalid="!warrantValid" @change="updateWarrantNodes"></label><p v-if="!warrantValid" class="field-error">知识点编号需为正整数，用英文逗号分隔。</p><label>motive · 为什么想到<textarea v-model="selectedStep.motive" rows="3" @input="markDirty"></textarea></label><label>off_ramp · 常见岔路（可空）<textarea v-model="selectedStep.offRamp" rows="3" @input="markDirty"></textarea></label><fieldset><legend>依赖步骤 · 可多选</legend><p v-if="steps.length < 2" class="hint">当前没有可选的前置步。</p><label v-for="candidate in steps.filter((item) => item.id !== selectedStep?.id)" :key="candidate.id" class="check"><input v-model="selectedStep.dependsOn" type="checkbox" :value="candidate.id" @change="markDirty">S{{ steps.indexOf(candidate) + 1 }} · {{ candidate.content.slice(0, 22) || stepName(candidate.stepType) }}</label></fieldset><details><summary>已有预测题配置（只读保留）</summary><pre>{{ json(selectedStep.prediction ?? '未配置') }}</pre><p class="hint">预测题写入结构与答案权限需由后端确认后开放编辑。</p></details></template></section><aside class="panel preview"><h2>链预览与门禁</h2><p class="hint">{{ selectedPath.title || `解法 #${selectedPath.id}` }} · quality {{ selectedPath.quality === 1 ? "curated" : selectedPath.quality === 2 ? "ai_draft" : "未知" }} · 工作稿版本 {{ selectedPath.workingRevision ?? "未返回" }}</p><div v-for="(step, index) in steps" :key="step.id" class="preview-step"><strong>S{{ index + 1 }} {{ stepName(step.stepType) }}</strong><p>{{ step.content || "内容待填写" }}</p><small>← {{ step.dependsOn.length ? step.dependsOn.map((id) => `S${steps.findIndex((item) => item.id === id) + 1}`).join("、") : "起点" }} · 依据挂点 {{ step.warrantNodes.length }}</small></div><div v-if="issuesShown" class="issues"><h3>本地结构检查</h3><p v-if="!issues.length">未发现本地结构问题；仍需服务端校验与人工校对。</p><ul v-else><li v-for="(item, index) in issues" :key="index">{{ item }}</li></ul></div><div class="publish"><h3>在线快照</h3><p>文档尚未定义链审核许可的响应字段。发布入口暂时关闭；AI 草稿标签不代表审核通过。</p><button type="button" class="btn" :disabled="busy" @click="loadPreview">读取管理预览</button><button type="button" class="btn primary" disabled>发布待审核契约</button><p class="hint">可读取管理预览核对工作稿；待审核许可契约明确后才能开放发布。</p><pre v-if="preview !== null">{{ json(preview) }}</pre></div></aside></div></template>
  </div>
</template>

<style scoped>
.chain-page{display:grid;gap:17px;color:var(--ink)}.heading{display:flex;justify-content:space-between;align-items:end;gap:20px}.eyebrow{font-size:11px;letter-spacing:.17em;color:var(--brand);font-weight:800}h1{font-size:27px;margin:7px 0}h2{font-size:16px;margin:0 0 12px}h3{font-size:14px;margin:14px 0 8px}.heading p,.hint,.preview p{color:var(--ink2);line-height:1.6}.header-actions{display:flex;gap:8px;flex-wrap:wrap}.btn{border:1px solid var(--line);background:var(--ops-card,#fff);color:var(--ink);padding:9px 13px;border-radius:8px;cursor:pointer;font:inherit}.btn.primary{background:var(--brand);border-color:var(--brand);color:#fff;font-weight:700}.btn.active{background:var(--brand-soft);color:var(--brand-deep);border-color:var(--brand)}.btn:disabled,button:disabled{opacity:.5;cursor:not-allowed}.toolbar,.panel{background:var(--ops-card,#fff);border:1px solid var(--line);border-radius:12px;padding:16px}.toolbar{display:flex;align-items:end;gap:12px;flex-wrap:wrap}.toolbar label,.editor>label{display:grid;gap:6px;font-size:12px;color:var(--ink2);font-weight:700}.toolbar input{width:160px}input,select,textarea{border:1px solid var(--line);border-radius:8px;padding:9px;font:inherit;color:var(--ink);background:var(--ops-card,#fff)}textarea{width:100%;resize:vertical}.editor>label{margin-bottom:13px}.unsaved,.field-error{color:#bb4d12}.message,.empty{padding:13px;border-radius:9px;background:var(--brand-soft);color:var(--brand-deep)}.message.bad{background:var(--ops-bad-soft,#fef2f2);color:#b42334}.path-tabs{display:flex;gap:8px;flex-wrap:wrap}.columns{display:grid;grid-template-columns:minmax(190px,230px) minmax(310px,1fr) minmax(250px,320px);gap:13px;align-items:start}.panel{min-height:490px}.section-head{display:flex;justify-content:space-between;align-items:center}.section-head h2{margin:0}.hint{font-size:12px}.step{display:flex;align-items:center;border:1px solid var(--line);border-radius:9px;margin:9px 0;gap:5px;padding:8px}.step.active{background:var(--brand-soft);border-color:var(--brand)}.step-select{flex:1;min-width:0;text-align:left;border:0;background:transparent;cursor:pointer;color:var(--ink)}.step-select strong,.step-select small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.step-select small{color:var(--ink2);margin-top:4px}.step-actions{display:flex}.step-actions button{border:0;background:transparent;color:var(--brand);cursor:pointer}.check{display:flex;align-items:center;gap:7px;padding:5px 0;color:var(--ink)}.check input{width:auto}fieldset{border:1px solid var(--line);border-radius:9px;padding:10px;margin:14px 0}legend{font-weight:700;font-size:12px}details{border-top:1px solid var(--line);padding-top:12px}.preview-step{border-left:3px solid var(--brand);padding:8px 12px;margin:12px 0;background:var(--ops-soft,#f7f9ff)}.preview-step p{margin:5px 0}.preview-step small{color:var(--ink2)}.issues{border-top:1px solid var(--line);margin-top:18px}.issues ul{color:#b42334;padding-left:20px}.publish{border-top:1px solid var(--line);margin-top:18px}.publish .btn{margin:4px}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto;background:var(--ops-soft,#f7f8fa);padding:10px;border-radius:8px;font-size:11px}@media(max-width:1130px){.columns{grid-template-columns:220px 1fr}.preview{grid-column:1/-1;min-height:0}}@media(max-width:700px){.heading{display:block}.header-actions{margin-top:15px}.columns{grid-template-columns:1fr}.preview{grid-column:auto}.panel{min-height:0}}
</style>
