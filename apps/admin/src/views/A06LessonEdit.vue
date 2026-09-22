<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  PASS_RATE_MIN,
  policyInlineHint,
  publishBlockers,
  publishDecision,
  type LessonDraft,
} from "../features/course/courseAdmin";

/** A06 课时编辑（17A06：富文本+公式条 · **发布 BR-02 实时校验面板**）。 */
const route = useRoute();
const router = useRouter();
const lessonId = computed(() => String(route.params.id ?? "1"));

const draft = reactive<LessonDraft>({
  title: "3.2 求根公式的来历",
  type: "article",
  content: "把 ax²+bx+c=0 配成完全平方——回答的不是怎么背，而是为什么可以除以 a、为什么最后要 ±。",
  videoUrl: "",
  completionPolicy: "practice_required",
  objectiveCount: 3,
  passRate: 80,
  durationSec: 600,
  readOnlyConfirmed: false,
});

const moreOpen = ref(false);
const inlineHint = computed(() => policyInlineHint(draft));
const decision = computed(() => publishDecision(draft, draft.readOnlyConfirmed ?? false));
const canPublish = computed(() => decision.value.ok);
const saved = ref("");

const FORMULAS = ["x²", "√()", "±", "π", "θ", "≤", "∞", "∫"];
function insertFormula(sym: string): void {
  draft.content = `${draft.content}${draft.content.endsWith(" ") || draft.content === "" ? "" : " "}${sym}`;
}
function saveDraft(): void {
  saved.value = "草稿已保存（工作稿 status=draft · 不影响已发布快照 BR-06）";
}
function publish(): void {
  if (!canPublish.value) return;
  saved.value = "✓ 已发布（后端复检通过 → published_snapshot 原子替换）";
}
</script>

<template>
  <div class="le">
    <div class="phead">
      <span class="bk" @click="router.push('/courses')">‹</span>
      <h1>课时编辑 · #{{ lessonId }}</h1>
      <span class="chip" :class="decision.ok ? 'ok' : 'bad'">
        {{ decision.ok ? "校验通过 · 可发布" : `阻断 ${decision.blockers.length} 项` }}
      </span>
      <div class="acts">
        <button class="btn ghost" @click="saveDraft">保存草稿</button>
        <button class="btn ghost" @click="moreOpen = !moreOpen">预览（学员视角）</button>
        <button class="btn" :disabled="!canPublish" @click="publish">发布</button>
      </div>
    </div>

    <div class="grid">
      <section>
        <div class="card">
          <label class="lb">标题 *</label>
          <input v-model="draft.title" class="in" />

          <label class="lb">类型</label>
          <div class="seg">
            <button :class="{ on: draft.type === 'article' }" @click="draft.type = 'article'">图文（MD+公式）</button>
            <button :class="{ on: draft.type === 'video' }" @click="draft.type = 'video'">视频外链</button>
          </div>

          <template v-if="draft.type === 'article'">
            <label class="lb">正文 *（TipTap 接入随 A-08 引入依赖 · 此处结构化文本等价）</label>
            <div class="etool">
              <b>H2</b><b>B</b><b>列表</b><b v-for="f in FORMULAS" :key="f" class="fx" @click="insertFormula(f)">{{ f }}</b><b>🖼 图片</b><b>▶ 视频链接</b>
            </div>
            <textarea v-model="draft.content" class="area" rows="8" />
          </template>
          <template v-else>
            <label class="lb">视频外链 *（必须 https · C-06 外链域校验）</label>
            <input v-model="draft.videoUrl" class="in" placeholder="https://cdn.example.com/lesson.mp4" />
          </template>

          <label class="lb">完成策略（completion_policy · 首次进入冻结阈值版本）</label>
          <div class="seg">
            <button :class="{ on: draft.completionPolicy === 'practice_required' }" @click="draft.completionPolicy = 'practice_required'">
              practice_required（默认）
            </button>
            <button :class="{ on: draft.completionPolicy === 'read_only' }" @click="draft.completionPolicy = 'read_only'">
              read_only（纯阅读）
            </button>
          </div>
          <p v-if="inlineHint" class="hint">⚠ {{ inlineHint }}</p>

          <div class="two">
            <div>
              <label class="lb">关联客观题数（随堂练）</label>
              <input v-model.number="draft.objectiveCount" type="number" class="in" min="0" />
            </div>
            <div v-if="draft.completionPolicy === 'practice_required'">
              <label class="lb">达标阈值 %（{{ PASS_RATE_MIN }}-100）</label>
              <input v-model.number="draft.passRate" type="number" class="in" :min="PASS_RATE_MIN" max="100" />
            </div>
            <div>
              <label class="lb">时长（秒）</label>
              <input v-model.number="draft.durationSec" type="number" class="in" min="0" />
            </div>
          </div>

          <label v-if="draft.completionPolicy === 'read_only'" class="confirm">
            <input v-model="draft.readOnlyConfirmed" type="checkbox" />
            <span>发布确认：本课时为纯阅读，read_only 完成**不代表掌握**（BR-02 管理端显式确认）</span>
          </label>
        </div>

        <!-- 实时校验面板 -->
        <aside class="vpanel">
          <div class="vh">发布校验（BR-02 镜像 · 实时）</div>
          <template v-if="decision.blockers.length === 0">
            <div class="vok">✓ 无阻断，可发布</div>
          </template>
          <template v-else>
            <div v-for="(b, i) in decision.blockers" :key="i" class="verr">{{ i + 1 }}. {{ b }}</div>
          </template>
          <div class="vnote">
            发布动作 = 后端快照原子替换（B-10 / BR-06）；<br />
            practice_required×0 客观题 = <b>分母不为 0 原则</b>（20 §2）；<br />
            完成判定权威在服务端 LessonCompletionPolicy。
          </div>
          <p v-if="saved" class="saved">{{ saved }}</p>
        </aside>
      </div>
    </div>

    <!-- 学员预览（简化） -->
    <div v-if="moreOpen" class="prev card">
      <b>学员视角预览（占位）</b>
      <p class="mut">{{ draft.title }} · {{ draft.type === "video" ? draft.videoUrl : draft.content.slice(0, 80) + "…" }}</p>
    </div>
  </div>
</template>

<style scoped>
.le {
  max-width: 1080px;
}
.phead {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.bk {
  font-size: 24px;
  cursor: pointer;
  color: var(--ink3);
}
.phead h1 {
  font-size: 20px;
}
.chip {
  font-size: 12px;
  border-radius: 99px;
  padding: 3px 12px;
  font-weight: 700;
}
.chip.ok { background: #d1fae5; color: #047857; }
.chip.bad { background: #fee2e2; color: #b91c1c; }
.acts {
  margin-left: auto;
  display: flex;
  gap: 9px;
}
.btn {
  height: 34px;
  border-radius: 8px;
  border: none;
  background: var(--brand);
  color: #fff;
  font-weight: 600;
  padding: 0 16px;
  cursor: pointer;
  font-size: 13.5px;
}
.btn.ghost {
  background: #fff;
  color: var(--ink2);
  border: 1px solid var(--line);
}
.btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.grid {
  display: grid;
  grid-template-columns: 1.7fr 1fr;
  gap: 16px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 16px;
}
.lb {
  display: block;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ink2);
  margin: 14px 0 6px;
}
.lb:first-child {
  margin-top: 0;
}
.in {
  width: 100%;
  height: 38px;
  border: 1.5px solid var(--line);
  border-radius: 9px;
  padding: 0 12px;
  font-size: 14.5px;
  outline: none;
}
.in:focus {
  border-color: var(--brand);
}
.seg {
  display: flex;
  gap: 8px;
}
.seg button {
  flex: 1;
  height: 36px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: #fff;
  cursor: pointer;
  font-size: 13.5px;
  color: var(--ink2);
}
.seg button.on {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand-deep);
  font-weight: 700;
}
.etool {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  border: 1.5px solid var(--line);
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  padding: 8px 10px;
  background: #fafbfd;
}
.etool b {
  font-size: 12.5px;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 3px 9px;
  cursor: pointer;
  background: #fff;
  font-weight: 600;
}
.etool b.fx {
  font-family: var(--font-math);
}
.etool b:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.area {
  width: 100%;
  border: 1.5px solid var(--line);
  border-radius: 0 0 10px 10px;
  padding: 12px;
  font-size: 14.5px;
  line-height: 1.8;
  outline: none;
  resize: vertical;
  min-height: 150px;
}
.area:focus {
  border-color: var(--brand);
}
.hint {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  font-size: 13px;
  border-radius: 8px;
  padding: 8px 12px;
  margin-top: 8px;
}
.two {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.confirm {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  margin-top: 16px;
  font-size: 13.5px;
  cursor: pointer;
}
.confirm input {
  margin-top: 3px;
  width: 16px;
  height: 16px;
  accent-color: var(--brand);
}
.vpanel {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 16px;
  align-self: start;
  position: sticky;
  top: 16px;
}
.vh {
  font-weight: 800;
  font-size: 14.5px;
  margin-bottom: 10px;
}
.vok {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #047857;
  font-weight: 700;
  border-radius: 9px;
  padding: 10px 14px;
  font-size: 13.5px;
}
.verr {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  border-radius: 9px;
  padding: 9px 13px;
  font-size: 13.5px;
  margin-top: 8px;
  line-height: 1.6;
}
.vnote {
  margin-top: 14px;
  font-size: 12.5px;
  color: var(--ink3);
  line-height: 1.8;
  border-top: 1px dashed var(--line);
  padding-top: 12px;
}
.saved {
  margin-top: 12px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 13px;
  font-weight: 600;
}
.prev {
  margin-top: 14px;
}
.mut {
  color: var(--ink3);
  font-size: 13px;
  margin-top: 6px;
}
@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
