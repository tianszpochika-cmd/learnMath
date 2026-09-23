<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { policyInlineHint, publishDecision, type LessonDraft } from "../features/course/courseAdmin";
import { readLesson, saveLesson } from "../services/content";

const route = useRoute();
const router = useRouter();
const lessonId = computed(() => String(route.params.id ?? ""));
const draft = reactive<LessonDraft>({ title: "", type: "article", content: "", videoUrl: "", completionPolicy: "practice_required", objectiveCount: 0, passRate: 80, durationSec: 0, readOnlyConfirmed: false });
const baseline = ref("");
const loading = ref(true);
const ready = ref(false);
const saving = ref(false);
const error = ref("");
const notice = ref("");
const previewOpen = ref(false);
const objectiveCountKnown = ref(false);
const passRateKnown = ref(false);
const initialPassRateKnown = ref(false);
const textarea = ref<HTMLTextAreaElement | null>(null);
const dirty = computed(() => JSON.stringify(draft) !== baseline.value || (!initialPassRateKnown.value && passRateKnown.value));
const decision = computed(() => publishDecision(draft, !!draft.readOnlyConfirmed));
const inlineHint = computed(() => policyInlineHint(draft));
const saveAllowed = computed(() => !!draft.title.trim() && (draft.type === "article" ? !!draft.content.trim() : /^https:\/\//i.test(draft.videoUrl.trim())) && Number.isFinite(draft.durationSec) && draft.durationSec >= 0 && (draft.completionPolicy === "read_only" || (passRateKnown.value && Number.isFinite(draft.passRate) && draft.passRate >= 80 && draft.passRate <= 100)));
const FORMULAS = ["x²", "√()", "±", "π", "θ", "≤", "∞", "∫"];

async function load() {
  const id = lessonId.value;
  loading.value = true; error.value = ""; notice.value = "";
  try {
    const result = await readLesson(id);
    if (id !== lessonId.value) return;
    Object.assign(draft, result.draft);
    objectiveCountKnown.value = result.objectiveCountKnown;
    passRateKnown.value = result.passRateKnown;
    initialPassRateKnown.value = result.passRateKnown;
    baseline.value = JSON.stringify(draft);
    ready.value = true;
  } catch (cause) { ready.value = false; error.value = cause instanceof Error ? cause.message : "课时工作稿暂不可用"; }
  finally { if (id === lessonId.value) loading.value = false; }
}
async function save() {
  if (saving.value || loading.value || !saveAllowed.value) return;
  saving.value = true; error.value = ""; notice.value = "";
  const id = lessonId.value;
  const snapshot = JSON.stringify(draft);
  try {
    await saveLesson(id, draft);
    const confirmed = await readLesson(id);
    if (id !== lessonId.value) return;
    const mismatch = confirmed.draft.title !== draft.title.trim() || confirmed.draft.completionPolicy !== draft.completionPolicy ||
      (draft.completionPolicy === "practice_required" && (!confirmed.passRateKnown || confirmed.draft.passRate !== draft.passRate)) ||
      (draft.type === "article" ? confirmed.draft.content !== draft.content : confirmed.draft.videoUrl !== draft.videoUrl.trim());
    objectiveCountKnown.value = confirmed.objectiveCountKnown;
    passRateKnown.value = confirmed.passRateKnown || passRateKnown.value;
    initialPassRateKnown.value = confirmed.passRateKnown;
    if (!mismatch && snapshot === JSON.stringify(draft)) {
      Object.assign(draft, confirmed.draft);
      baseline.value = JSON.stringify(draft);
      notice.value = "管理服务已确认并回读课时工作稿。";
    } else {
      notice.value = "保存请求已返回，但回读内容或当前输入已变化；请核对后再保存。";
    }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "保存未获管理服务确认"; }
  finally { saving.value = false; }
}
async function insertFormula(symbol: string) {
  const field = textarea.value;
  if (!field) { draft.content += symbol; return; }
  const start = field.selectionStart, end = field.selectionEnd;
  draft.content = draft.content.slice(0, start) + symbol + draft.content.slice(end);
  await nextTick();
  field.focus();
  field.setSelectionRange(start + symbol.length, start + symbol.length);
}
watch(lessonId, () => { void load(); }, { immediate: true });
</script>

<template>
  <div class="ops-page">
    <header class="ops-heading"><div><button class="back" type="button" @click="router.push('/courses')">← 返回课程</button><p class="ops-eyebrow">A06 · LESSON WORKING DRAFT</p><h1>课时编辑 <span class="id">#{{ lessonId }}</span></h1><p class="ops-lead">工作稿从管理服务读取。完成策略预检与服务端发布检查分开呈现。</p></div><div class="ops-actions"><button class="ops-btn secondary" type="button" :disabled="loading" @click="previewOpen = !previewOpen">{{ previewOpen ? "关闭本地预览" : "查看本地预览" }}</button><button class="ops-btn" type="button" :disabled="!dirty || !saveAllowed || loading || saving" @click="save">{{ saving ? "保存中…" : "保存工作稿" }}</button></div></header>
    <p v-if="loading" class="ops-state" role="status">正在读取服务端课时工作稿…</p>
    <p v-else-if="error" class="ops-state error" role="alert">{{ error }}</p>
    <p v-if="notice" class="ops-state" role="status">{{ notice }}</p>
    <div v-if="!loading && ready" class="editor-grid">
      <section class="ops-card form">
        <label class="ops-field"><span>课时标题 *</span><input v-model="draft.title" maxlength="100" /></label>
        <div class="ops-field"><span>内容类型</span><div class="segments"><button type="button" :class="{ on: draft.type === 'article' }" @click="draft.type = 'article'">图文 · Markdown</button><button type="button" :class="{ on: draft.type === 'video' }" @click="draft.type = 'video'">视频外链</button></div></div>
        <template v-if="draft.type === 'article'"><label class="ops-field"><span>正文 *</span><span class="formula-tools"><button v-for="symbol in FORMULAS" :key="symbol" type="button" @click="insertFormula(symbol)">{{ symbol }}</button></span><textarea ref="textarea" v-model="draft.content" rows="10" placeholder="输入 Markdown 课时正文；数学符号可用上方工具插入" /></label></template>
        <label v-else class="ops-field"><span>视频链接 * · HTTPS</span><input v-model="draft.videoUrl" type="url" placeholder="https://…" /></label>
        <div class="ops-field"><span>完成策略</span><div class="segments"><button type="button" :class="{ on: draft.completionPolicy === 'practice_required' }" @click="draft.completionPolicy = 'practice_required'">随堂练达标</button><button type="button" :class="{ on: draft.completionPolicy === 'read_only' }" @click="draft.completionPolicy = 'read_only'">纯阅读</button></div></div>
        <p v-if="inlineHint" class="ops-state warning">{{ inlineHint }}</p>
        <div class="field-grid"><label class="ops-field"><span>服务端关联客观题数</span><input :value="objectiveCountKnown ? draft.objectiveCount : '未返回'" disabled /><small>此数量由题目关联决定，不能在本页手填。</small></label><label class="ops-field"><span>随堂达标阈值 %</span><input v-model.number="draft.passRate" type="number" min="80" max="100" :disabled="draft.completionPolicy === 'read_only'" @input="passRateKnown = true" /><small v-if="!passRateKnown">服务端未返回阈值；80% 是业务默认建议，请手动确认。</small></label><label class="ops-field"><span>预估时长 · 秒</span><input v-model.number="draft.durationSec" type="number" min="0" /></label></div>
        <label v-if="draft.completionPolicy === 'read_only'" class="confirm"><input v-model="draft.readOnlyConfirmed" type="checkbox" /><span>我确认这是纯阅读课时；读完不等于掌握。</span></label>
      </section>
      <aside class="ops-card validation"><p class="ops-eyebrow">BR-02 · RELEASE CHECK</p><h2>发布前检查</h2><p v-if="draft.completionPolicy === 'practice_required' && !passRateKnown" class="ops-state warning">服务端未返回当前达标阈值；保存前请确认输入值。</p><p v-if="!objectiveCountKnown" class="ops-state warning">服务端未返回关联客观题数量；练习型课时无法在前端确认发布条件。</p><p v-if="dirty" class="ops-state warning">工作稿已修改，尚未由管理服务确认保存。</p><p v-if="decision.blockers.length === 0 && objectiveCountKnown" class="ops-state">本地规则预检未发现阻断。正式发布仍需服务端校验。</p><ol v-else class="blockers"><li v-for="blocker in decision.blockers" :key="blocker">{{ blocker }}</li></ol><p class="ops-muted note">课时专用发布动作与请求体尚未在 04 接口清单中明确。本页不提供本地“发布成功”，上线状态以管理服务为准。</p><button class="ops-btn secondary" type="button" disabled>发布待接口契约</button></aside>
    </div>
    <section v-if="previewOpen && !loading && ready" class="ops-card preview"><p class="ops-eyebrow">LOCAL PREVIEW</p><h2>{{ draft.title || "未命名课时" }}</h2><p class="ops-muted">仅预览当前输入，不代表学员可见的已发布版本或访问权限。</p><p class="preview-content">{{ draft.type === "article" ? draft.content : draft.videoUrl }}</p></section>
  </div>
</template>

<style scoped>
.back{margin:0 0 16px;padding:0;border:0;background:transparent;color:var(--brand-deep);font-weight:750}.id{color:var(--ink3);font-size:15px}.editor-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(290px,.7fr);gap:16px}.form{display:grid;gap:19px}.segments{display:flex;gap:8px}.segments button{flex:1;min-height:39px;padding:7px 11px;border:1px solid var(--line);border-radius:9px;background:var(--ops-card);color:var(--ink2)}.segments button.on{border-color:var(--brand);background:var(--brand-soft);color:var(--brand-deep);font-weight:800}.formula-tools{display:flex;flex-wrap:wrap;gap:5px;padding:8px;border:1px solid var(--line);border-radius:9px;background:var(--ops-soft)}.formula-tools button{min-width:33px;min-height:32px;border:1px solid var(--line);border-radius:6px;background:var(--ops-card);color:var(--ink)}.field-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.ops-field small{font-size:11px;font-weight:400;line-height:1.5;color:var(--ink3)}.confirm{display:flex;align-items:flex-start;gap:9px;color:var(--ink2);font-size:13px}.confirm input{margin-top:2px;accent-color:var(--brand)}.validation{align-self:start;position:sticky;top:16px}.validation h2{font-size:21px}.validation .ops-state{margin-bottom:10px}.blockers{display:grid;gap:9px;padding-left:22px;color:#b94351;line-height:1.55}.note{margin:20px 0;line-height:1.65;font-size:12px}.preview{margin-top:16px}.preview-content{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8}
@media(max-width:960px){.editor-grid{grid-template-columns:1fr}.validation{position:static}}@media(max-width:620px){.field-grid{grid-template-columns:1fr}.segments{flex-direction:column}}
</style>
