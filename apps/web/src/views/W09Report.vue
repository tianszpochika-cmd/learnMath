<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  objectiveView,
  selfAssessProgress,
  selfAssessNote,
  selfValueLabel,
  selfValueRef,
  type SelfValue,
} from "../features/attempt/attemptUi";

/** W09 成绩报告（16W09 · 20 §4 客观-自评拆分；结算权威=服务端，本页展示投影）。 */
const router = useRouter();

const objective = reactive({ earned: 8, possible: 10, rate: 80 });
const view = computed(() => objectiveView(objective.earned, objective.possible, objective.rate));

const wrongList = reactive([
  { id: 1024, title: "#1024 因式分解基础", broken: true, reason: "断在 S2 · 缺依据" },
  { id: 1102, title: "#1102 十字相乘", broken: false, reason: "不会" },
]);

// 自评区（解答题 2 道）
const selfValues = reactive<SelfValue[]>(["unrated", "unrated"]);
const progress = computed(() => selfAssessProgress([...selfValues]));
const note = selfAssessNote();

const PURE_ESSAY_DEMO = ref(false); // 切换演示：纯解答卷展示
const essayView = computed(() =>
  PURE_ESSAY_DEMO.value ? objectiveView(0, 0, null) : view.value,
);

function setSelf(i: number, v: SelfValue): void {
  selfValues[i] = v;
}
</script>

<template>
  <div class="report pad">
    <header class="head">
      <span class="bk" @click="router.push('/paper/9001')">‹</span>
      <h1>成绩报告</h1>
      <span class="chip">每日一练 · 2026-09-15</span>
      <div class="acts">
        <button class="btn ghost" @click="router.push('/wrongbook')">去错题本</button>
        <button class="btn gray" @click="PURE_ESSAY_DEMO = !PURE_ESSAY_DEMO">
          {{ PURE_ESSAY_DEMO ? "切回客观卷" : "演示纯解答卷" }}
        </button>
      </div>
    </header>

    <!-- 客观区（拆分展示） -->
    <div class="grid4">
      <div class="card score" :class="{ muted: essayView.muted }">
        <b>{{ essayView.main }}</b>
        <span class="mut">{{ essayView.sub ? "客观 " + essayView.sub : "客观分不适用" }}</span>
      </div>
      <div class="card score"><b>11:24</b><span class="mut">用时</span></div>
      <div class="card score"><b>2</b><span class="mut">错题已入本</span></div>
      <div class="card score"><b>{{ progress.answered }}/{{ progress.total }}</b><span class="mut">自评进度</span></div>
    </div>

    <div class="grid2">
      <section class="card">
        <div class="sect">知识点分布（点条形跳图谱）</div>
        <div v-for="d in [{ n: '因式分解', v: 90 }, { n: '判别式', v: 62 }, { n: '根的分布', v: 45 }]" :key="d.n" class="dist">
          <span class="mut">{{ d.n }} {{ d.v }}%</span>
          <div class="bar"><i :style="{ width: d.v + '%' }" /></div>
        </div>
        <div class="sect">错题清单</div>
        <div v-for="w in wrongList" :key="w.id" class="wrongrow" @click="router.push('/wrongbook')">
          <b>{{ w.title }}</b>
          <span class="tag" :class="w.broken ? 'bad' : 'warn2'">{{ w.reason }}</span>
          <span class="ar">›</span>
        </div>
      </section>

      <section>
        <div class="card">
          <div class="sect" style="margin-top: 0">自评区（解答题 · {{ progress.label }}）</div>
          <div v-for="(v, i) in selfValues" :key="i" class="selfrow">
            <span class="qname">解答题 {{ i + 1 }}</span>
            <span class="selfval" :class="v">{{ selfValueLabel(v) }}{{ selfValueRef(v) !== null ? " · 参考 " + selfValueRef(v) : "" }}</span>
            <div class="selfbtns">
              <button :class="{ on: v === 'cannot' }" @click="setSelf(i, 'cannot')">不会</button>
              <button :class="{ on: v === 'partial' }" @click="setSelf(i, 'partial')">半会</button>
              <button :class="{ on: v === 'can' }" @click="setSelf(i, 'can')">会</button>
              <button :class="{ on: v === 'skipped' }" @click="setSelf(i, 'skipped')">暂不评价</button>
            </div>
          </div>
          <p v-if="progress.canResume" class="resume">📄 报告可恢复自评：{{ progress.label }} · 继续完成剩余题目</p>
          <p class="mut">{{ note }}</p>
        </div>

        <div class="card mt">
          <div class="sect" style="margin-top: 0">AI 归因（无 Key=规则模板 01-U-45）</div>
          <p class="mut">「根的分布」错题集中：建议回补前置 <b style="color: var(--brand)">不等式性质</b>。</p>
          <button class="btn ghost" style="margin-top: 10px" @click="router.push('/graph')">去补先修</button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pad {
  padding: 24px 32px 48px;
  max-width: 1200px;
  margin: 0 auto;
}
.head {
  display: flex;
  align-items: center;
  gap: 14px;
}
.head h1 {
  font-size: 24px;
}
.bk {
  font-size: 22px;
  cursor: pointer;
  color: var(--ink3);
}
.acts {
  margin-left: auto;
  display: flex;
  gap: 10px;
}
.chip {
  font-size: 12.5px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 3px 12px;
  font-weight: 600;
}
.grid4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-top: 16px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
}
.score {
  text-align: center;
}
.score b {
  display: block;
  font-size: 32px;
  background: var(--grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.score.muted b {
  background: none;
  color: var(--ink2);
  font-size: 19px;
  line-height: 1.5;
}
.mut {
  color: var(--ink3);
  font-size: 13px;
}
.grid2 {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.sect {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink3);
  margin: 14px 0 10px;
}
.dist {
  margin-top: 10px;
}
.bar {
  height: 9px;
  background: #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  margin-top: 5px;
}
.bar i {
  display: block;
  height: 100%;
  background: var(--grad);
}
.wrongrow {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 11px 4px;
  border-top: 1px solid #f1f3f7;
  cursor: pointer;
}
.tag {
  font-size: 11px;
  font-weight: 800;
  border-radius: 6px;
  padding: 2px 8px;
}
.tag.bad {
  background: #fee2e2;
  color: #b91c1c;
}
.tag.warn2 {
  background: #fef3c7;
  color: #b45309;
}
.ar {
  margin-left: auto;
  color: var(--ink3);
}
.selfrow {
  border: 1px solid var(--line);
  border-radius: 11px;
  padding: 12px;
  margin-top: 10px;
}
.selfrow {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
}
.qname {
  font-weight: 700;
  font-size: 14.5px;
}
.selfval {
  text-align: right;
  font-size: 13px;
  color: var(--ink3);
}
.selfval.unrated {
  color: var(--warn);
  font-weight: 700;
}
.selfval.cannot {
  color: var(--bad);
  font-weight: 700;
}
.selfval.can {
  color: var(--ok);
  font-weight: 700;
}
.selfbtns {
  grid-column: 1 / -1;
  display: flex;
  gap: 8px;
}
.selfbtns button {
  flex: 1;
  height: 34px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: #fff;
  cursor: pointer;
  font-size: 13.5px;
}
.selfbtns button.on {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 700;
}
.resume {
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 9px;
  padding: 9px 13px;
  font-size: 13px;
  margin-top: 12px;
}
.mt {
  margin-top: 16px;
}
.btn {
  border: none;
  border-radius: 11px;
  background: var(--grad);
  color: #fff;
  font-weight: 700;
  height: 38px;
  padding: 0 18px;
  cursor: pointer;
  font-size: 14px;
}
.btn.ghost {
  background: var(--brand-soft);
  color: var(--brand);
}
.btn.gray {
  background: #eef0f4;
  color: var(--ink2);
}
@media (max-width: 960px) {
  .grid2,
  .grid4 {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
