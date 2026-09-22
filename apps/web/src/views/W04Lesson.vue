<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  completionHint,
  completionReward,
  completionStage,
  optionMark,
  quizSummary,
  type QuizQ,
} from "../features/course/courseTree";

/** W04 课时页 双栏 + 右栏随堂练（16W04 · BR-02 提示语；判定权威=服务端）。 */
const router = useRouter();

const readConfirmed = ref(false);
const alreadyCompleted = ref(false);
const rewarded = ref(0);

const state = reactive({
  answered: 0,
  correct: 0,
  selected: -1,
  currentQ: 0,
});

const questions: QuizQ[] = [
  { stem: "方程 2x²−4x−6=0 的一个根是？", options: ["x = 3", "x = −1", "x = 3 或 x = −1", "x = 6"], answerIndex: 2 },
  { stem: "x²−5x+6=0 分解为？", options: ["(x+2)(x+3)", "(x−2)(x−3)", "(x−1)(x−6)", "(x+2)(x−3)"], answerIndex: 1 },
];
const q = computed(() => questions[state.currentQ]);

const summary = computed(() => quizSummary(state.answered, questions.length, state.correct));

const stage = computed(() =>
  completionStage({
    readConfirmed: readConfirmed.value,
    policy: "practice_required",
    answeredAll: state.answered >= questions.length,
    rate: questions.length === 0 ? -1 : (state.correct / questions.length) * 100,
    alreadyCompleted: alreadyCompleted.value,
  }),
);
const hint = computed(() =>
  completionHint(stage.value, { answered: state.answered, total: questions.length, rate: questions.length === 0 ? 0 : (state.correct / questions.length) * 100 }),
);
const reward = computed(() => completionReward(stage.value));

function pick(i: number): void {
  if (state.answered > state.currentQ) return; // 已判过当前题
  state.selected = i;
}
function submitQ(): void {
  if (state.selected < 0) return;
  state.answered = state.currentQ + 1;
  if (state.selected === q.value.answerIndex) {
    state.correct += 1;
  }
}
function nextQ(): void {
  if (state.currentQ < questions.length - 1) {
    state.currentQ += 1;
    state.selected = -1;
  }
}
function markDone(): void {
  readConfirmed.value = true;
  // 先按当前 stage 取奖励，再翻 alreadyCompleted（否则 stage 变 already 恒得 0）
  const st = stage.value;
  if ((st === "practice-pass" || st === "read-only-done") && !alreadyCompleted.value) {
    rewarded.value = completionReward(st);
    alreadyCompleted.value = true;
  }
}
function mark(i: number): "right" | "wrong" | "" {
  return optionMark(q.value, i, state.answered > state.currentQ);
}
</script>

<template>
  <div class="pad">
    <div class="crumb">
      <span @click="router.push('/paths/course/1')">路径</span> / <span @click="router.push('/paths/course/1')">系统课程</span> /
      <b>3.2 求根公式的来历</b>
      <span class="rt">进度 62% · 心跳 05:12</span>
    </div>

    <div class="grid">
      <!-- 内容区 -->
      <section class="card">
        <p class="lead">
          把 <span class="math">ax²+bx+c=0 (a≠0)</span> 配成完全平方——是两千年前巴比伦人就会的操作。我们要回答的不是"怎么背"，而是——
          <b>为什么可以除以 a？为什么最后要 ±？</b>
        </p>
        <div class="formula"><span class="math">x = ( −b ± √(b²−4ac) ) / 2a</span></div>
        <div class="video">🎬 视频（外链）· 配方法 6 分钟 — 断点 02:14（播放器占位）</div>

        <label class="readrow">
          <input v-model="readConfirmed" type="checkbox" />
          <span>我已确认读完本课时（read_completed）</span>
        </label>

        <div class="footrow">
          <button class="btn gray">← 上一课时</button>
          <div class="hintbox">
            <b :class="stage">{{ hint }}</b>
            <span v-if="rewarded > 0" class="reward">+{{ rewarded }} 积分 · 首次完成</span>
          </div>
          <button class="btn" @click="markDone">标记完成</button>
          <button class="btn ghost" @click="router.push('/deepdive/question/1024')">课时例题进深钻 →</button>
        </div>
        <p class="mut">完成条件：读完确认 + 随堂练全答且 ≥80%（服务端权威判定，本页为展示镜像 BR-02）</p>
      </section>

      <!-- 右栏随堂练 -->
      <aside class="side">
        <div class="card sticky">
          <div class="sidehead">
            <b>随堂练</b>
            <span class="chip" :class="{ pass: summary.passed }">{{ summary.label }}</span>
          </div>
          <p class="stem">{{ q.stem }}</p>
          <div
            v-for="(o, i) in q.options"
            :key="i"
            class="opt"
            :class="mark(i) || (state.selected === i && state.answered <= state.currentQ ? 'sel' : '')"
            @click="pick(i)"
          >
            <span class="k">{{ String.fromCharCode(65 + i) }}</span>
            <span class="math">{{ o }}</span>
          </div>
          <div class="acts">
            <button v-if="state.answered <= state.currentQ" class="btn" :disabled="state.selected < 0" @click="submitQ">提交本题</button>
            <button v-else-if="state.currentQ < questions.length - 1" class="btn" @click="nextQ">下一题 →</button>
            <span v-else class="chip pass">{{ summary.passed ? "✓ 随堂达标" : "未达标，可重做" }}</span>
          </div>
          <div class="chips">
            <span class="chip">判别式</span><span class="chip">求根公式</span>
          </div>
          <p class="mut">判分以服务端为准（练习态逐题反馈 01-U-04）</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.pad {
  padding: 22px 32px 48px;
  max-width: 1200px;
  margin: 0 auto;
}
.crumb {
  font-size: 13.5px;
  color: var(--ink3);
  margin-bottom: 14px;
}
.crumb b {
  color: var(--ink);
}
.crumb span {
  cursor: pointer;
}
.rt {
  float: right;
}
.grid {
  display: grid;
  grid-template-columns: 1.9fr 1fr;
  gap: 16px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px;
}
.lead {
  font-size: 16px;
  line-height: 1.95;
}
.math {
  font-family: var(--font-math);
  font-style: italic;
}
.formula {
  text-align: center;
  background: #f8fafc;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 30px 14px;
  margin-top: 16px;
}
.formula .math {
  font-size: 28px;
}
.video {
  border: 1.5px dashed var(--line);
  border-radius: 12px;
  padding: 22px;
  margin-top: 14px;
  color: var(--ink3);
  font-size: 14px;
}
.readrow {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 16px;
  font-size: 14.5px;
  cursor: pointer;
}
.readrow input {
  width: 17px;
  height: 17px;
  accent-color: var(--ok);
}
.footrow {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 16px;
}
.hintbox {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13.5px;
}
.hintbox b.practice-pending,
.hintbox b.not-read {
  color: var(--warn);
}
.hintbox b.practice-pass,
.hintbox b.read-only-done,
.hintbox b.already {
  color: var(--ok);
}
.reward {
  font-size: 12.5px;
  color: var(--gold);
  font-weight: 700;
}
.btn {
  border: none;
  border-radius: 11px;
  background: var(--grad);
  color: #fff;
  font-weight: 700;
  height: 40px;
  padding: 0 20px;
  cursor: pointer;
  font-size: 14.5px;
}
.btn:disabled {
  opacity: 0.45;
}
.btn.gray {
  background: #eef0f4;
  color: var(--ink2);
}
.btn.ghost {
  background: var(--brand-soft);
  color: var(--brand);
}
.mut {
  color: var(--ink3);
  font-size: 12.5px;
  margin-top: 12px;
}
.side .sticky {
  position: sticky;
  top: 76px;
}
.sidehead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.chip {
  font-size: 12.5px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 3px 12px;
  font-weight: 600;
}
.chip.pass {
  background: #ecfdf5;
  color: #047857;
}
.stem {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.7;
}
.opt {
  display: flex;
  gap: 10px;
  align-items: center;
  border: 1.5px solid var(--line);
  border-radius: 11px;
  padding: 11px 13px;
  margin-top: 10px;
  cursor: pointer;
  font-size: 14.5px;
}
.opt:hover {
  border-color: var(--brand);
}
.opt.sel {
  border-color: var(--brand);
  background: var(--brand-soft);
}
.opt.right {
  border-color: var(--ok);
  background: #f0fdf4;
}
.opt.wrong {
  border-color: var(--bad);
  background: #fef2f2;
}
.opt .k {
  font-weight: 800;
  color: var(--brand);
}
.acts {
  margin-top: 14px;
  display: flex;
  gap: 10px;
  align-items: center;
}
.chips {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  flex-wrap: wrap;
}
@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
