<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  adaptiveHint,
  assessProgress,
  assessmentReportView,
  dimRateText,
  levelLabel,
} from "../features/plan/planUi";

/** W11 测评答题 → 报告（16W11 · 定级与升降权威在服务端，本页提示+报告投影）。 */
const router = useRouter();

const state = reactive({ level: 2, consecutiveCorrect: 0, wrongInLevel: 0, answered: 0 });
const hint = computed(() => adaptiveHint(state));
const progress = computed(() => assessProgress(state.answered));

const questions = [
  { stem: "若 a > b，则下列恒成立的是？", options: ["a² > b²", "ac > bc（任意 c）", "−a < −b", "a−c > b−c"], answer: 3 },
  { stem: "一元二次方程判别式 Δ = b²−4ac，Δ = 0 说明？", options: ["两不等实根", "无实根", "两相等实根", "无法判断"], answer: 2 },
  { stem: "因式分解 x²−5x+6 = ?", options: ["(x−1)(x−6)", "(x−2)(x−3)", "(x+2)(x+3)", "(x−2)(x+3)"], answer: 1 },
];
const idx = ref(0);
const selected = ref(-1);
const finished = ref(false);

function pick(i: number): void {
  selected.value = i;
}
function next(): void {
  if (selected.value < 0) return;
  const correct = selected.value === questions[idx.value].answer;
  state.answered += 1;
  if (correct) {
    state.consecutiveCorrect += 1;
    // 注意：答对不清 wrongInLevel（档内错题计数只在换档/降档时重置，与服务端一致）
  } else {
    state.wrongInLevel += 1;
    state.consecutiveCorrect = 0;
    if (state.wrongInLevel >= 2 && state.level > 1) {
      state.level -= 1;
      state.wrongInLevel = 0;
    }
  }
  if (state.consecutiveCorrect >= 3 && state.level < 5) {
    state.level += 1;
    state.consecutiveCorrect = 0;
    state.wrongInLevel = 0;
  }
  selected.value = -1;
  if (idx.value < questions.length - 1) {
    idx.value += 1;
  } else {
    finished.value = true; // 演示结束（真实终止=服务端 25 题帽/档5）
  }
}

const report = computed(() =>
  assessmentReportView({
    level: state.level,
    answered: state.answered,
    wrongTotal: state.wrongInLevel,
    accuracy: state.answered === 0 ? null : Math.round(((state.answered - state.wrongInLevel) / state.answered) * 100),
    reachedCeiling: state.level >= 5,
    hitQuestionCap: state.answered >= 25,
  }),
);
const dims = [
  { name: "代数", rate: 80 as number | null },
  { name: "几何", rate: null as number | null },
  { name: "建模", rate: 60 as number | null },
];
</script>

<template>
  <div class="as pad">
    <div class="head">
      <span class="bk" @click="router.push('/paths')">‹</span>
      <h1>入学测评</h1>
      <span class="chip">当前档 {{ levelLabel(state.level) }} · 起始 L2</span>
      <span class="mut" style="margin-left: auto">{{ progress.label }} · {{ hint }}</span>
      <button class="btn gray" @click="finished = true">交卷（演示）</button>
    </div>

    <!-- 答题态 -->
    <div v-if="!finished" class="grid">
      <section class="card">
        <div class="seg"><i :style="{ width: progress.percent + '%' }" /></div>
        <p class="mut">服务端逐题调档但**未交卷不返正误**（BR-03 restricted 投影）；升降提示仅供预估</p>
        <p class="stem">{{ questions[idx].stem }}</p>
        <div
          v-for="(o, i) in questions[idx].options"
          :key="i"
          class="opt"
          :class="{ sel: selected === i }"
          @click="pick(i)"
        >
          <span class="k">{{ String.fromCharCode(65 + i) }}</span>
          <span>{{ o }}</span>
        </div>
        <button class="btn" style="margin-top: 14px" :disabled="selected < 0" @click="next">
          {{ idx < questions.length - 1 ? "下一题" : "完成（演示出报告）" }}
        </button>
        <p class="mut">演示 3 题即止；真实终止=档 5 或 25 题（服务端 AssessmentEngine）</p>
      </section>
      <aside class="card">
        <div class="sect">档位规则（17 A10 默认）</div>
        <ul class="rules">
          <li>起始档：中考水平（L2）</li>
          <li>连对 3 题 → 升一档</li>
          <li>错 2 题 → 降一档</li>
          <li>达档 5 或答满 25 → 终止定级</li>
          <li>可中断续答（draft 恢复 · 01-D3）</li>
        </ul>
      </aside>
    </div>

    <!-- 报告态 -->
    <div v-else class="grid">
      <section class="card center">
        <div class="big">{{ report.headline }}</div>
        <p class="mut">正确率 {{ report.accuracyText }} · 答题 {{ state.answered }} 题</p>
        <div class="reasons">
          <span v-for="r in report.reasons" :key="r" class="chip">{{ r }}</span>
        </div>
        <button class="btn" style="margin-top: 16px" @click="router.push('/plans')">生成计划（from=assessment）→</button>
        <button class="btn gray" style="margin-top: 10px" @click="finished = false">再测一次（演示）</button>
      </section>
      <aside class="card">
        <div class="sect">维度得分（未覆盖 → "—"）</div>
        <div v-for="d in dims" :key="d.name" class="dimrow">
          <span>{{ d.name }}</span>
          <b>{{ dimRateText(d.rate) }}</b>
        </div>
        <p class="mut">入学定级只依据测评覆盖领域（BR-10：不用一组算术题推断全领域）</p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.pad {
  padding: 22px 32px 48px;
  max-width: 1120px;
  margin: 0 auto;
}
.head {
  display: flex;
  gap: 14px;
  align-items: center;
}
.bk {
  font-size: 24px;
  cursor: pointer;
  color: var(--ink3);
}
.head h1 {
  font-size: 24px;
}
.chip {
  font-size: 12.5px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 3px 12px;
  font-weight: 600;
}
.mut {
  color: var(--ink3);
  font-size: 13px;
}
.grid {
  display: grid;
  grid-template-columns: 1.7fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px;
}
.seg {
  height: 10px;
  background: #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}
.seg i {
  display: block;
  height: 100%;
  background: var(--grad);
  transition: width 0.3s;
}
.stem {
  font-size: 16.5px;
  font-weight: 600;
  line-height: 1.8;
  margin-top: 16px;
}
.opt {
  display: flex;
  gap: 10px;
  align-items: center;
  border: 1.5px solid var(--line);
  border-radius: 11px;
  padding: 12px 14px;
  margin-top: 10px;
  cursor: pointer;
  font-size: 15px;
}
.opt:hover {
  border-color: var(--brand);
}
.opt.sel {
  border-color: var(--brand);
  background: var(--brand-soft);
}
.opt .k {
  font-weight: 800;
  color: var(--brand);
}
.btn {
  border: none;
  border-radius: 11px;
  background: var(--grad);
  color: #fff;
  font-weight: 700;
  height: 42px;
  padding: 0 22px;
  cursor: pointer;
  font-size: 15px;
}
.btn:disabled {
  opacity: 0.45;
}
.btn.gray {
  background: #eef0f4;
  color: var(--ink2);
}
.sect {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink3);
  margin-bottom: 10px;
}
.rules {
  padding-left: 18px;
  font-size: 14.5px;
  line-height: 2.1;
  color: var(--ink2);
}
.center {
  text-align: center;
}
.big {
  font-size: 46px;
  font-weight: 800;
  background: var(--grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.reasons {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 12px;
  flex-wrap: wrap;
}
.dimrow {
  display: flex;
  justify-content: space-between;
  padding: 10px 4px;
  border-bottom: 1px solid #f1f3f7;
  font-size: 14.5px;
}
@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
