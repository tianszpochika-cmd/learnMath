<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DEEP_MODES, modeFromQuery, type DeepMode } from "../features/deepdive/deepdiveUi";
import { deepdivePaths, feedbackText, type PathView, type StepView } from "../features/deepdive/deepdiveProjection";
import { exploreApi, exploreError } from "../services/explore";

type LoadState = "loading" | "ready" | "empty" | "unmapped" | "error";
const route = useRoute();
const router = useRouter();
const mode = ref<DeepMode>(modeFromQuery(route.query.mode));
const state = ref<LoadState>("loading");
const error = ref("");
const paths = ref<PathView[]>([]);
const selectedPathId = ref<number | null>(null);
const selectedStepId = ref<number | null>(null);
const selectedOption = ref<number | null>(null);
const writtenAnswer = ref("");
const feedback = ref("");
const breakNote = ref("");
const submitting = ref(false);
const reporting = ref(false);
let generation = 0;

const type = computed(() => String(route.params.type ?? ""));
const id = computed(() => String(route.params.id ?? ""));
const currentPath = computed(() => paths.value.find((path) => path.id === selectedPathId.value) ?? paths.value[0] ?? null);
const currentStep = computed(() => currentPath.value?.steps.find((step) => step.id === selectedStepId.value) ?? currentPath.value?.steps[0] ?? null);
const prediction = computed(() => currentStep.value?.prediction ?? null);
const forward = computed(() => paths.value.find((path) => path.view === 1) ?? null);
const backward = computed(() => paths.value.find((path) => path.view === 2) ?? null);
const canSubmit = computed(() => Boolean(currentPath.value?.chainVersion && currentStep.value?.id && prediction.value
  && (prediction.value.mode <= 2 ? selectedOption.value !== null : writtenAnswer.value.trim())));
const modeQuery = computed<"read" | "predict" | "compare">(() =>
  mode.value === "predict" ? "predict" : mode.value === "dual" || mode.value === "multi" ? "compare" : "read");

function setMode(next: DeepMode): void {
  if (mode.value === next) return;
  mode.value = next;
  void router.replace({ query: { ...route.query, mode: next } });
}
function selectPath(path: PathView): void {
  selectedPathId.value = path.id;
  selectedStepId.value = path.steps[0]?.id ?? null;
  selectedOption.value = null;
  writtenAnswer.value = "";
  feedback.value = "";
  breakNote.value = "";
}
function selectStep(step: StepView): void {
  selectedStepId.value = step.id;
  selectedOption.value = null;
  writtenAnswer.value = "";
  feedback.value = "";
  breakNote.value = "";
}

async function load(): Promise<void> {
  const current = ++generation;
  state.value = "loading";
  error.value = "";
  paths.value = [];
  selectedPathId.value = null;
  selectedStepId.value = null;
  feedback.value = "";
  breakNote.value = "";
  submitting.value = false;
  reporting.value = false;
  try {
    const result = await exploreApi.deepdive(type.value, id.value, modeQuery.value);
    if (current !== generation) return;
    const mapped = deepdivePaths(result);
    if (mapped === null) state.value = result === null || result === undefined ? "empty" : "unmapped";
    else {
      paths.value = mapped;
      state.value = mapped.length ? "ready" : "empty";
      if (mapped[0]) selectPath(mapped[0]);
    }
  } catch (cause) {
    if (current !== generation) return;
    error.value = exploreError(cause);
    state.value = "error";
  }
}

async function submitPrediction(): Promise<void> {
  const path = currentPath.value;
  const step = currentStep.value;
  const prompt = prediction.value;
  if (!path?.chainVersion || !step || !prompt || !canSubmit.value || submitting.value) return;
  const current = generation;
  const answer = prompt.mode <= 2 ? prompt.options[selectedOption.value!] : writtenAnswer.value.trim();
  submitting.value = true;
  feedback.value = "";
  try {
    const result = await exploreApi.predict(type.value, id.value, {
      solutionPathId: path.id, chainVersion: path.chainVersion, stepId: step.id,
      answer, requestId: crypto.randomUUID(),
    });
    if (current !== generation || currentPath.value?.id !== path.id || currentStep.value?.id !== step.id) return;
    feedback.value = result === null || result === undefined
      ? "预测请求未返回可核实回执，结果暂不可用。"
      : feedbackText(result) || (prompt.mode >= 3
        ? "服务端已处理简答；对照与自报状态的字段尚未对齐，不作客观判对。"
        : "服务端已处理预测；点评字段尚未对齐，不显示本地正误或解析。");
  } catch (cause) {
    if (current === generation) feedback.value = "预测未确认：" + exploreError(cause);
  } finally {
    if (current === generation) submitting.value = false;
  }
}

async function reportBreak(): Promise<void> {
  const path = currentPath.value;
  const step = currentStep.value;
  if (!path?.chainVersion || !step || reporting.value) return;
  const current = generation;
  reporting.value = true;
  breakNote.value = "";
  try {
    const result = await exploreApi.reportBreak(type.value, id.value, {
      solutionPathId: path.id, chainVersion: path.chainVersion, stepId: step.id,
    });
    if (current !== generation || currentPath.value?.id !== path.id || currentStep.value?.id !== step.id) return;
    breakNote.value = result === null || result === undefined
      ? "断链请求未返回可核实回执，暂不能确认已保存。"
      : "服务端已接收这一步的自报断链。自报与客观观察分开记录。";
  } catch (cause) {
    if (current === generation) breakNote.value = "断链未保存：" + exploreError(cause);
  } finally {
    if (current === generation) reporting.value = false;
  }
}

watch(() => [route.params.type, route.params.id, route.query.mode], () => {
  mode.value = modeFromQuery(route.query.mode);
  void load();
}, { immediate: true });
</script>

<template>
  <main class="deep-page">
    <header class="deep-head">
      <button class="back" @click="router.push('/wrongbook')">← 返回</button>
      <div><span class="eyebrow">REASONING STUDIO · 推理链深钻</span><h1>看见每一步为什么成立</h1><p>{{ type === 'formula' ? '公式' : type === 'question' ? '题目' : '资源' }} #{{ id }} · 答案与解析遵循服务端作答权限</p></div>
      <span v-if="currentPath?.quality" class="quality">{{ currentPath.quality === 1 ? '人工精修' : 'AI 整理' }}</span>
    </header>
    <nav class="modes" aria-label="深钻玩法">
      <button v-for="item in DEEP_MODES" :key="item.key" :class="{ active: mode === item.key }" @click="setMode(item.key)">{{ item.label }}</button>
    </nav>
    <div v-if="state === 'loading'" class="notice" role="status">正在向服务端获取此模式的解法链…</div>
    <div v-else-if="state === 'error'" class="notice error" role="alert">解法链暂不可用：{{ error }} <button @click="load">重试</button></div>
    <div v-else-if="state === 'empty'" class="notice">此资源当前没有可访问的已发布解法链，或尚未满足作答后的查看权限。</div>
    <div v-else-if="state === 'unmapped'" class="notice">服务端已响应，但解法链字段尚未与已评审结构对齐；答案与点评不会以示例内容补齐。</div>
    <template v-else>
      <div class="path-switch"><span>解法</span><button v-for="path in paths" :key="path.id" :class="{ active: path.id === currentPath?.id }" @click="selectPath(path)">{{ path.title }}</button></div>
      <div v-if="mode === 'read'" class="read-grid">
        <section class="chain panel"><div class="panel-heading"><span class="eyebrow">SOLUTION CHAIN</span><h2>{{ currentPath?.title }}</h2></div>
          <div v-if="!currentPath?.steps.length" class="inner-empty">此解法尚未返回可展示步骤。</div>
          <button v-for="step in currentPath?.steps" :key="step.id" class="step" :class="{ selected: currentStep?.id === step.id }" @click="selectStep(step)">
            <span class="step-index">S{{ step.seq }}</span><span>{{ step.content }}</span><span class="step-arrow">↗</span>
          </button>
          <p v-if="currentPath?.summary" class="summary">{{ currentPath.summary }}</p>
        </section>
        <aside class="rail panel"><span class="eyebrow">STEP CONTEXT</span><h2>{{ currentStep ? '第 ' + currentStep.seq + ' 步' : '选择一步' }}</h2>
          <div v-if="currentStep"><div class="rail-block"><b>依据 · WARRANT</b><p>{{ currentStep.warrant || '依据待补全' }}</p><div class="node-links"><button v-for="nodeId in currentStep.warrantNodes" :key="nodeId" @click="router.push('/graph/node/' + nodeId)">知识点 #{{ nodeId }} ↗</button></div></div>
            <div class="rail-block"><b>动机 · MOTIVE</b><p>{{ currentStep.motive || '动机待补全' }}</p></div>
            <div class="rail-block off"><b>岔路 · OFF RAMP</b><p>{{ currentStep.offRamp || '岔路待补全' }}</p></div>
            <button class="report" :disabled="!currentPath?.chainVersion || reporting" @click="reportBreak">{{ reporting ? '保存中…' : '我卡在这一步' }}</button>
            <p v-if="!currentPath?.chainVersion" class="muted">缺少链版本，断链自报暂不可提交。</p><p v-if="breakNote" class="feedback" role="status">{{ breakNote }}</p>
          </div>
        </aside>
      </div>
      <div v-else-if="mode === 'predict'" class="predict-grid">
        <section class="panel"><span class="eyebrow">PREDICT THE NEXT STEP</span><h2>先预测，再看服务端点评</h2>
          <div class="step-select"><button v-for="step in currentPath?.steps" :key="step.id" :class="{ active: currentStep?.id === step.id }" @click="selectStep(step)">S{{ step.seq }}</button></div>
          <div v-if="!prediction" class="inner-empty">这一步没有返回可用预测题。请切换步骤，或稍后再来。</div>
          <template v-else><p class="stem">{{ prediction.stem }}</p>
            <div v-if="prediction.mode <= 2" class="options"><button v-for="(option, index) in prediction.options" :key="index" :class="{ selected: selectedOption === index }" @click="selectedOption = index"><span>{{ String.fromCharCode(65 + index) }}</span>{{ option }}</button></div>
            <textarea v-else v-model="writtenAnswer" placeholder="写下你的下一步想法；简答不做本地自动判分。" />
            <button class="primary" :disabled="!canSubmit || submitting" @click="submitPrediction">{{ submitting ? '提交中…' : '提交给服务端' }}</button>
            <p v-if="!currentPath?.chainVersion" class="muted">缺少链版本，暂不能安全提交预测。</p><div v-if="feedback" class="feedback" role="status">{{ feedback }}</div>
          </template>
        </section>
        <aside class="panel guidance"><span class="eyebrow">LEARNING NOTE</span><h2>先猜，再解释</h2><p>预测用于暴露下一步的依据和动机。正确选项与解析只由服务端在允许的作答状态下返回；简答对照与自报不会冒充客观证据。</p></aside>
      </div>
      <div v-else-if="mode === 'dual'" class="compare-grid">
        <section class="panel"><span class="eyebrow">FORWARD</span><h2>综合法 · 由因导果</h2><div v-if="!forward" class="inner-empty">未返回已发布的综合法链。</div><div v-for="step in forward?.steps" :key="step.id" class="compare-step"><b>S{{ step.seq }}</b>{{ step.content }}</div></section>
        <section class="panel"><span class="eyebrow">BACKWARD</span><h2>分析法 · 执果索因</h2><div v-if="!backward" class="inner-empty">未返回已发布的分析法链。</div><div v-for="step in backward?.steps" :key="step.id" class="compare-step"><b>S{{ step.seq }}</b>{{ step.content }}</div></section>
      </div>
      <div v-else-if="mode === 'multi'" class="panel multi"><span class="eyebrow">MULTIPLE SOLUTIONS</span><h2>比较已发布解法</h2><div class="table-wrap"><table><thead><tr><th>解法</th><th>步骤</th><th>质量标记</th><th>总结</th></tr></thead><tbody><tr v-for="path in paths" :key="path.id"><td>{{ path.title }}</td><td>{{ path.stepCount ?? path.steps.length }}</td><td>{{ path.quality === 1 ? '人工精修' : path.quality === 2 ? 'AI 整理' : '未标注' }}</td><td>{{ path.summary || '待补全' }}</td></tr></tbody></table></div></div>
      <div v-else class="panel ai"><span class="eyebrow">SOCRATIC DIALOGUE</span><h2>沿链追问 AI</h2><p>当前选择：{{ currentPath?.title }}{{ currentStep ? ' · S' + currentStep.seq : '' }}。流式追问需要单独接入服务端 SSE 与活动作答权限校验，暂不可发送问题。</p><button @click="setMode('read')">返回通读 →</button></div>
    </template>
  </main>
</template>

<style scoped>
.deep-page{max-width:1280px;margin:auto;padding:24px 30px 60px;color:var(--text)}.deep-head{display:flex;align-items:center;gap:22px;padding:28px 32px;border-radius:18px;background:var(--deep);color:#f8fafc}.back{align-self:flex-start;background:#ffffff1b;border:1px solid #ffffff30;color:#dce7ff;border-radius:8px;padding:7px 11px}.deep-head>div{flex:1}.eyebrow{font-size:10px;font-weight:850;letter-spacing:.17em;color:var(--faint)}.deep-head .eyebrow{color:#a9c4f6}.deep-head h1{font:clamp(24px,2.8vw,35px)/1.35 var(--serif);margin:7px 0}.deep-head p{font-size:12px;color:#b8c8e5}.quality{padding:6px 11px;border-radius:20px;background:#ffffff1c;font-size:11px}.modes,.path-switch,.step-select{display:flex;gap:8px;overflow-x:auto}.modes{border-bottom:1px solid var(--line);margin:20px 0 16px}.modes button{border:0;border-bottom:3px solid transparent;background:none;color:var(--muted);padding:11px 22px;white-space:nowrap;font-weight:750}.modes button.active{border-color:var(--primary);color:var(--primary)}.notice,.inner-empty,.feedback{border:1px solid var(--line);border-radius:11px;background:var(--soft);padding:15px 18px;color:var(--muted);font-size:13px;line-height:1.7}.notice.error{color:var(--danger);background:var(--danger-bg)}.notice button{border:0;background:none;text-decoration:underline;color:inherit}.path-switch{align-items:center;margin:0 0 14px}.path-switch>span{font-size:12px;color:var(--muted);font-weight:800}.path-switch button,.step-select button{border:1px solid var(--line);background:var(--paper);color:var(--body);border-radius:8px;padding:7px 12px;font-size:12px}.path-switch button.active,.step-select button.active{border-color:var(--primary);background:var(--primary-soft);color:var(--primary-deep)}.read-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,1fr);gap:16px}.panel{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:23px;box-shadow:var(--shadow)}.panel h2{font:22px var(--serif);margin:7px 0 17px}.step{display:flex;align-items:center;gap:13px;width:100%;text-align:left;border:1px solid var(--line);border-left:3px solid var(--line);border-radius:10px;background:var(--paper);padding:15px;margin-top:10px;color:var(--body);line-height:1.65}.step.selected{border-color:var(--primary);background:var(--primary-soft)}.step-index{font-size:11px;font-weight:900;color:var(--primary);white-space:nowrap}.step-arrow{margin-left:auto;color:var(--faint)}.summary{font-size:13px;line-height:1.8;color:var(--muted);border-top:1px solid var(--line);padding-top:15px;margin-top:18px}.rail-block{padding:13px 0;border-top:1px solid var(--line)}.rail-block b{font-size:11px;letter-spacing:.05em;color:var(--primary-deep)}.rail-block p{font-size:13px;line-height:1.75;margin-top:6px;color:var(--body);white-space:pre-wrap}.rail-block.off b{color:var(--warning)}.node-links{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.node-links button{border:0;border-radius:20px;background:var(--primary-soft);color:var(--primary-deep);padding:5px 9px;font-size:11px}.report,.primary{border:0;border-radius:9px;background:var(--primary);color:var(--deep);padding:10px 15px;font-size:12px;font-weight:850;margin-top:14px}.report:disabled,.primary:disabled{opacity:.45;cursor:default}.muted{font-size:12px;color:var(--muted);line-height:1.75;margin-top:10px}.feedback{margin-top:12px;background:var(--primary-soft);color:var(--body)}.predict-grid,.compare-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.step-select{margin-bottom:17px}.stem{font:18px/1.7 var(--serif);margin-bottom:16px}.options{display:grid;gap:9px}.options button{text-align:left;border:1px solid var(--line);background:var(--paper);color:var(--body);border-radius:10px;padding:11px 13px}.options button.selected{border-color:var(--primary);background:var(--primary-soft)}.options span{display:inline-grid;place-items:center;width:24px;height:24px;margin-right:10px;border-radius:6px;background:var(--soft);font-size:11px;font-weight:900}.predict-grid textarea{width:100%;min-height:125px;padding:12px;border:1px solid var(--line);background:var(--paper);color:var(--text);border-radius:10px;resize:vertical}.guidance p,.ai p{font-size:14px;line-height:1.9;color:var(--body)}.compare-step{display:flex;gap:12px;border-top:1px solid var(--line);padding:14px 0;font-size:13px;line-height:1.7}.compare-step b{color:var(--primary);white-space:nowrap}.table-wrap{overflow:auto}.multi table{width:100%;border-collapse:collapse;font-size:13px}.multi th,.multi td{text-align:left;padding:13px 10px;border-bottom:1px solid var(--line)}.multi th{color:var(--muted);font-size:11px}.ai button{border:0;background:var(--primary-soft);color:var(--primary-deep);border-radius:8px;padding:9px 13px;margin-top:17px;font-weight:750}@media(max-width:900px){.read-grid,.predict-grid,.compare-grid{grid-template-columns:1fr}}@media(max-width:620px){.deep-page{padding:15px 15px 45px}.deep-head{padding:21px;align-items:flex-start;flex-wrap:wrap}.quality{display:none}.panel{padding:18px}.modes button{padding:10px 15px}}
</style>
