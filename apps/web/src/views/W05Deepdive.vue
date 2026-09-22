<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  DEEP_MODES,
  alignPairs,
  alignRatio,
  deepdivePath,
  fastestVariant,
  generalTip,
  modeFromQuery,
  normalizeSubjectType,
  pairColorIndex,
  predOptionMark,
  predictionBranch,
  predictionFeedback,
  railOf,
  selectStep,
  variantRows,
  type DeepMode,
  type DeepStep,
  type Variant,
} from "../features/deepdive/deepdiveUi";

/** W05 深钻三区（16W05 · WD3：左链画布+右上下文栏+顶五玩Tab）。 */
const route = useRoute();
const router = useRouter();

const subjectType = computed(() => normalizeSubjectType(route.params.type));
const subjectId = computed(() => String(route.params.id ?? "1024"));
const pathLabel = computed(() => deepdivePath(subjectType.value, subjectId.value));

const mode = ref<DeepMode>(modeFromQuery(route.query.mode));
function setMode(m: DeepMode): void {
  mode.value = m;
  void router.replace({ query: { ...route.query, mode: m } });
}

const steps: DeepStep[] = [
  {
    seq: 1,
    typeLabel: "工具选择",
    content: "尝试因式分解：找两数积 6、和 −5",
    warrant: "十字相乘法适用（首项系数为 1）",
    warrantNodes: ["因式分解 · 符号规则"],
    motive: "常数 6=2×3 且 2+3=5——信号明显，先试最快的工具。",
    offRamp: "因数组不合（和对不上）才转求根公式；别一上来就套公式。",
  },
  {
    seq: 2,
    typeLabel: "等价变形",
    content: "分解为 (x−2)(x−3)=0",
    warrant: "乘法分配律逆用（等价变形）",
    warrantNodes: ["整式乘法"],
    motive: "S1 已锁定 2 与 3，符号取负来自「和为负」。",
    offRamp: "写成 (x+2)(x+3) 是符号错——负号来源没想清楚。",
  },
  {
    seq: 3,
    typeLabel: "论证",
    content: "零因子律：积为 0 → x=2 或 x=3",
    warrant: "整环中无零因子（论证规则）",
    warrantNodes: ["零因子律"],
    motive: "目标是解出 x，降次到一次即可完成。",
    offRamp: "两边同除 (x−2) 会丢根——除变量式前必须讨论为零情况。",
  },
  {
    seq: 4,
    typeLabel: "回代检验",
    content: "代回原方程两边相等（检验两根）",
    warrant: "解必须自洽（检验规则）",
    warrantNodes: ["方程解检验"],
    motive: "回代是最后一道防线。",
    offRamp: "跳过回代：增根、丢根都靠它拦。",
  },
];
const selected = ref<DeepStep>(steps[0]);
const rail = computed(() => railOf(selected.value));
function pick(seq: number): void {
  const s = selectStep(steps, seq);
  if (s) selected.value = s;
}

// 预测（客观：选依据）
const pred = reactive({ kind: "PICK" as "PICK" | "SUBJECTIVE", answered: false, selectedIndex: -1, correctIndex: 2 });
const PRED_OPTS = ["分配律", "零因子律", "等式的性质"];
const feedback = computed(() =>
  predictionFeedback(
    { kind: pred.kind, answered: pred.answered, selectedIndex: pred.selectedIndex, correctIndex: pred.correctIndex },
    {
      reinforce: "零因子律正是此步依据；动机=目标降次。",
      wrongBridge: "你会这么想，因为「乘法展开后对比系数更快」——",
      offRamp: "但这里要的是降次：能分解时不展开，展开只会绕远。",
      reference: "目标是把二次降为一次 → 需左边分解为两个一次因式 → 选零因子律的依据",
    },
  ),
);
const branch = computed(() =>
  predictionBranch({ kind: pred.kind, answered: pred.answered, selectedIndex: pred.selectedIndex, correctIndex: pred.correctIndex }),
);
function answerPred(i: number): void {
  if (pred.answered) return;
  pred.selectedIndex = i;
  pred.answered = true;
}
// 主观（填动机）
const subj = reactive({ kind: "SUBJECTIVE" as const, answered: false, selectedIndex: -1, correctIndex: -1 });
const subjFeedback = computed(() =>
  predictionFeedback(subj, {
    reinforce: "",
    wrongBridge: "",
    offRamp: "",
    reference: "设未知 x 表示较慢者，再按路程相等列一元一次方程",
  }),
);

// 顺逆双画布
const forward = [
  { id: "s1", label: "条件 x²−5x+6=0" },
  { id: "s2", label: "十字相乘 → (x−2)(x−3)=0" },
  { id: "s3", label: "零因子律 → 两根" },
];
const backward = [
  { id: "s3", label: "要 x=? → 需两根" },
  { id: "s2", label: "需分解 → 找积6和−5" },
  { id: "s4", label: "（回代检验另起）" },
];
const pairs = alignPairs(forward, backward);
const ratio = alignRatio(pairs);
function colorOf(i: number): string {
  const c = pairColorIndex(pairs, i);
  const palette = ["#2F6BFF", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899", "#F97316"];
  return c === null ? "#CBD5E1" : palette[c];
}

// 多解
const variants: Variant[] = [
  { id: "a", name: "解法A 因式分解", stepCount: 3, trick: "中", calcLoad: "小", applicable: "判别式完全平方" },
  { id: "b", name: "解法B 求根公式", stepCount: 4, trick: "低", calcLoad: "中", applicable: "恒可用", isGeneral: true },
  { id: "c", name: "解法C 图像交点", stepCount: 5, trick: "高", calcLoad: "中", applicable: "需估根/理解意义" },
];
const rows = variantRows(variants);
const fastest = fastestVariant(variants);
</script>

<template>
  <div class="dd pad">
    <header class="head">
      <span class="bk" @click="router.push('/wrongbook')">‹</span>
      <div>
        <b>深钻 #{{ subjectId }}</b>
        <span class="mut">{{ pathLabel }} · 解方程 x²−5x+6=0，说明每步依据</span>
      </div>
      <span class="chip">quality: curated</span>
    </header>

    <nav class="mtabs">
      <button
        v-for="m in DEEP_MODES"
        :key="m.key"
        :class="{ on: mode === m.key }"
        @click="setMode(m.key)"
      >
        {{ m.label }}
      </button>
    </nav>

    <!-- 通读 -->
    <div v-show="mode === 'read'" class="grid">
      <section class="chain card">
        <div
          v-for="s in steps"
          :key="s.seq"
          class="step"
          :class="{ sel: selected.seq === s.seq, sub: s.seq > 1 }"
          @click="pick(s.seq)"
        >
          <span class="k">S{{ s.seq }} · {{ s.typeLabel }}</span>
          <span class="tx">{{ s.content }}</span>
          <span class="dep" v-if="s.seq > 1" />
        </div>
        <p class="mut">点步卡 → 右栏三层联动（WD3）；依赖虚线示意上一步</p>
      </section>

      <aside class="rail card">
        <h4>▸ 依据 WARRANT</h4>
        <div class="box">
          {{ rail.warrant }}
          <div><span v-for="n in rail.nodes" :key="n" class="nodechip">{{ n }}</span></div>
        </div>
        <h4>▸ 为什么想到 MOTIVE</h4>
        <div class="box">{{ rail.motive }}</div>
        <h4 class="red">▸ 岔路 OFF_RAMP</h4>
        <div class="box err">{{ rail.offRamp }}</div>
        <button class="btn ghost" style="width: 100%; margin-top: 12px" @click="setMode('ai')">
          在此步追问 AI（WD6 面板 · W-13 接线）
        </button>
      </aside>
    </div>

    <!-- 预测 -->
    <div v-show="mode === 'predict'" class="cards2">
      <section class="card">
        <span class="chip">选依据型（客观）</span>
        <p class="stem">已知 (x−2)(x−3)=0，下一步的<b>依据</b>选哪个？</p>
        <div
          v-for="(o, i) in PRED_OPTS"
          :key="o"
          class="opt"
          :class="predOptionMark({ kind: pred.kind, answered: pred.answered, selectedIndex: pred.selectedIndex, correctIndex: pred.correctIndex }, i)"
          @click="answerPred(i)"
        >
          <span class="k">{{ String.fromCharCode(65 + i) }}</span>
          <span>{{ o }}</span>
        </div>
        <div v-if="branch !== 'idle'" class="fb" :class="branch">
          <b>{{ feedback.headline }}</b>
          <p>{{ feedback.body }}</p>
          <p v-if="feedback.offRamp" class="off">⚠ {{ feedback.offRamp }}</p>
        </div>
      </section>

      <section class="card">
        <span class="chip warn">填动机型（主观 · 不自动判）</span>
        <p class="stem">为什么设未知 x？（对照参考后自报）</p>
        <textarea class="ta" placeholder="写下你的动机…" @focus="subj.answered = true" />
        <div class="selfrow">
          <button @click="subj.answered = true">不会</button>
          <button @click="subj.answered = true">半会</button>
          <button @click="subj.answered = true">会</button>
        </div>
        <div v-if="subj.answered" class="fb self">
          <b>{{ subjFeedback.headline }}</b>
          <p>{{ subjFeedback.body }}</p>
        </div>
        <p class="mut">主观型一期对照参考+自报：不产生 observed、不计推理画像（BR-05/BR-08）</p>
      </section>
    </div>

    <!-- 顺逆 -->
    <div v-show="mode === 'dual'" class="cards2">
      <section class="card" style="border-top: 4px solid var(--brand)">
        <b>综合法（由因导果）</b>
        <div
          v-for="(f, i) in forward"
          :key="f.id"
          class="astep"
          :style="{ borderColor: colorOf(i) }"
        >
          <i :style="{ background: colorOf(i) }" />{{ f.label }}
        </div>
      </section>
      <section class="card" style="border-top: 4px solid var(--violet)">
        <b>分析法（执果索因）</b>
        <div
          v-for="b in backward"
          :key="b.id"
          class="astep"
          :style="{ borderColor: pairs.some((p) => p.backward?.id === b.id) ? colorOf(pairs.findIndex((p) => p.backward?.id === b.id)) : '#CBD5E1' }"
        >
          <i :style="{ background: pairs.some((p) => p.backward?.id === b.id) ? colorOf(pairs.findIndex((p) => p.backward?.id === b.id)) : '#CBD5E1' }" />
          {{ b.label }}
        </div>
      </section>
      <div class="alignnote">
        同色步对齐 · 对齐率 <b>{{ ratio }}%</b>（WD3：双画布同 id 共色；未对齐灰）
      </div>
    </div>

    <!-- 多解 -->
    <div v-show="mode === 'multi'" class="card">
      <b>解法对比</b>
      <table class="tbl">
        <thead>
          <tr><th>解法</th><th>步数</th><th>技巧性</th><th>计算量</th><th>适用</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td><b>{{ r.name }}</b></td>
            <td>{{ r.stepText }}</td>
            <td>{{ r.trick }}</td>
            <td>{{ r.calcLoad }}</td>
            <td>{{ r.applicable }}</td>
          </tr>
        </tbody>
      </table>
      <p class="mut">最快解：{{ fastest ? fastest.name : "—" }}（步数少优先）</p>
      <div class="tip">📌 {{ generalTip() }}</div>
    </div>

    <!-- AI -->
    <div v-show="mode === 'ai'" class="card">
      <b>AI 苏格拉底（嵌入深钻 · 带 stepSeq 上下文）</b>
      <p class="mut" style="margin-top: 8px">
        右侧滑出面板（WD6）由 W-13 统一实装；本页入口已带「{{ selected.typeLabel }} · S{{ selected.seq }}」上下文标签。
      </p>
      <button class="btn" style="margin-top: 12px" @click="setMode('read')">← 返回通读</button>
    </div>
  </div>
</template>

<style scoped>
.pad {
  padding: 20px 32px 48px;
  max-width: 1280px;
  margin: 0 auto;
}
.head {
  display: flex;
  gap: 14px;
  align-items: center;
}
.bk {
  font-size: 22px;
  cursor: pointer;
  color: var(--ink3);
}
.mut {
  color: var(--ink3);
  font-size: 13px;
  display: block;
  margin-top: 3px;
}
.chip {
  font-size: 12px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 3px 12px;
  font-weight: 600;
}
.chip.warn {
  background: #fef3c7;
  color: #b45309;
}
.mt {
  margin-top: 14px;
}
.mtabs {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
.mtabs button {
  padding: 9px 26px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: #fff;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--ink3);
  cursor: pointer;
}
.mtabs button.on {
  background: var(--grad);
  border-color: transparent;
  color: #fff;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
  margin-top: 16px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
}
.chain .step {
  border: 1.5px solid var(--line);
  border-radius: 12px;
  padding: 13px 15px;
  margin-bottom: 12px;
  cursor: pointer;
  position: relative;
}
.chain .step:hover {
  border-color: #c7d6ff;
}
.chain .step.sel {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.14);
}
.chain .step.sub {
  margin-left: 34px;
}
.chain .step .dep {
  position: absolute;
  left: -27px;
  top: 50%;
  width: 20px;
  height: 0;
  border-top: 1.5px dashed #c7d6ff;
}
.chain .k {
  display: block;
  font-size: 11.5px;
  font-weight: 800;
  color: var(--brand);
}
.chain .tx {
  display: block;
  font-size: 15px;
  font-weight: 600;
  margin-top: 3px;
}
.rail h4 {
  font-size: 12.5px;
  color: var(--ink3);
  letter-spacing: 0.05em;
  margin: 14px 0 6px;
}
.rail h4:first-child {
  margin-top: 0;
}
.rail h4.red {
  color: #b91c1c;
}
.box {
  background: #f8fafc;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.7;
}
.box.err {
  border-color: #fecaca;
  background: #fef2f2;
}
.nodechip {
  display: inline-block;
  font-size: 12px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  padding: 2px 10px;
  border-radius: 99px;
  margin: 6px 4px 0 0;
}
.cards2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.stem {
  font-size: 15.5px;
  line-height: 1.7;
  margin-top: 10px;
}
.opt {
  display: flex;
  gap: 10px;
  align-items: center;
  border: 1.5px solid var(--line);
  border-radius: 11px;
  padding: 11px 14px;
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
.fb {
  border-radius: 11px;
  padding: 12px 14px;
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.7;
}
.fb.right {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}
.fb.wrong {
  background: #fff7ed;
  border: 1px solid #fed7aa;
}
.fb.self {
  background: var(--brand-soft);
  border: 1px solid #c7d6ff;
}
.fb .off {
  color: #b45309;
  margin-top: 6px;
  font-weight: 600;
}
.ta {
  width: 100%;
  min-height: 90px;
  border: 1.5px solid var(--line);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14.5px;
  margin-top: 10px;
  outline: none;
  resize: vertical;
}
.selfrow {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.selfrow button {
  flex: 1;
  height: 34px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: #fff;
  cursor: pointer;
}
.astep {
  display: flex;
  gap: 10px;
  align-items: center;
  border: 1.5px solid;
  border-radius: 11px;
  padding: 11px 13px;
  margin-top: 10px;
  font-size: 14.5px;
}
.astep i {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  flex: none;
}
.alignnote {
  grid-column: 1 / -1;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13.5px;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  font-size: 14px;
}
.tbl th {
  text-align: left;
  color: var(--ink3);
  font-size: 12.5px;
  padding: 8px 6px;
  border-bottom: 1px solid var(--line);
}
.tbl td {
  padding: 10px 6px;
  border-bottom: 1px solid #f1f3f7;
}
.tip {
  background: var(--brand-soft);
  border-radius: 10px;
  padding: 12px 14px;
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.7;
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
.btn.ghost {
  background: var(--brand-soft);
  color: var(--brand);
}
@media (max-width: 1024px) {
  .grid,
  .cards2 {
    grid-template-columns: 1fr;
  }
}
</style>
