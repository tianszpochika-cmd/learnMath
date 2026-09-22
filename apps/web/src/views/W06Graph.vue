<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import {
  NARRATIVE_TABS,
  badgeFor,
  cardView,
  colorHex,
  colorLabel,
  filterNodes,
  graphColorOf,
  legendItems,
  missingCards,
  neighborSet,
  narrativeCompleteness,
  tabFromQuery,
  type CardKey,
  type Narrative,
  type NodeView,
} from "../features/graph/graphUi";

/** W06 图谱画布（16W06 · WD5：全屏 DAG+检索+图例+右侧四卡抽屉）。 */
const router = useRouter();

const query = ref("");
const selectedId = ref(2);
const tab = ref<CardKey>("origin");

const nodes: NodeView[] = [
  { id: 1, name: "等式的性质", preparing: false, locked: false, score: 96, insufficientSample: false },
  { id: 2, name: "因式分解", preparing: false, locked: false, score: 61, insufficientSample: false },
  { id: 3, name: "判别式", preparing: false, locked: false, score: null, insufficientSample: false },
  { id: 4, name: "韦达定理", preparing: false, locked: false, score: 100, insufficientSample: true },
  { id: 5, name: "根的分布", preparing: false, locked: true, score: 85, insufficientSample: false },
  { id: 6, name: "解三角形应用", preparing: true, locked: false, score: null, insufficientSample: false },
  { id: 7, name: "函数与零点", preparing: false, locked: false, score: 45, insufficientSample: false },
];
const edges = [
  { from: 1, to: 2 },
  { from: 2, to: 4 },
  { from: 2, to: 7 },
  { from: 3, to: 5 },
  { from: 4, to: 5 },
];
// 画布坐标（fixture）
const pos: Record<number, { x: number; y: number }> = {
  1: { x: 8, y: 16 },
  2: { x: 30, y: 34 },
  3: { x: 30, y: 68 },
  4: { x: 54, y: 26 },
  5: { x: 76, y: 52 },
  6: { x: 76, y: 14 },
  7: { x: 56, y: 66 },
};

const narratives: Record<number, Narrative> = {
  2: {
    origin: "古埃及分地、巴比伦凑数——把面积拆回长宽的手艺，因式分解是它的代数版。",
    prototype: "裁一块方地剩余面积 / 利息模型拆解 / 拱桥跨径分解",
    capability: "不可达测距、结构还原、模型降次",
    ladder: 'REAL：拆面积 → MODEL：和与积互逆 → SYMBOL：(a±b)² 展开与回收',
  },
  1: {
    origin: "等量关系的原始契约",
    prototype: "天平称重",
    capability: "保持平衡的推理",
    ladder: "平衡 → 等式 → 变形规则",
  },
};

const visible = computed(() => filterNodes(nodes, query.value));
const selected = computed(() => nodes.find((n) => n.id === selectedId.value) ?? nodes[0]);
const color = computed(() => graphColorOf(selected.value));
const badge = computed(() => badgeFor(selected.value));
const narrative = computed(() => narratives[selected.value.id] ?? null);
const missing = computed(() => missingCards(narrative.value));
const completeness = computed(() => narrativeCompleteness(narrative.value));
const hood = computed(() => neighborSet(edges, selected.value.id));

function select(id: number): void {
  selectedId.value = id;
}
function isDim(id: number): boolean {
  return query.value.trim() !== "" && !filterNodes([nodes.find((n) => n.id === id)!], query.value).length;
}
function lockedHint(): string {
  return selected.value.locked ? "3311 前置未满足：先补「不等式性质」等必需前置" : "";
}
function cardOf(k: CardKey) {
  return cardView(k, narrative.value);
}
</script>

<template>
  <div class="graph pad">
    <div class="topbar">
      <input v-model="query" placeholder="搜索知识点（定位飞入+高亮脉冲）" />
      <span v-for="l in legendItems()" :key="l.color" class="lg">
        <i :style="{ background: colorHex(l.color), borderStyle: l.color === 'preparing' ? 'dashed' : 'solid' }" />
        {{ l.label }}
      </span>
      <span class="mut">WD5 · 点节点开四卡抽屉</span>
    </div>

    <div class="canvas">
      <!-- 边 -->
      <svg class="edges" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line
          v-for="(e, i) in edges"
          :key="i"
          :x1="pos[e.from].x + 6"
          :y1="pos[e.from].y + 6"
          :x2="pos[e.to].x + 6"
          :y2="pos[e.to].y + 6"
          stroke="#CBD5E1"
          stroke-width="0.4"
          stroke-dasharray="2 1.4"
        />
      </svg>
      <!-- 节点 -->
      <button
        v-for="n in visible"
        :key="n.id"
        class="gn"
        :class="{ on: n.id === selectedId, dim: isDim(n.id), hood: hood.has(n.id) && n.id !== selectedId }"
        :style="{ left: pos[n.id].x + '%', top: pos[n.id].y + '%', borderColor: colorHex(graphColorOf(n)) }"
        @click="select(n.id)"
      >
        <i :class="{ dashed: graphColorOf(n) === 'preparing' }" :style="{ background: colorHex(graphColorOf(n)) }" />
        {{ n.name }}
      </button>

      <!-- 抽屉 -->
      <aside class="drawer">
        <div class="dhead">
          <b>{{ selected.name }}</b>
          <span v-if="badge.tone !== 'none'" class="bdg" :class="badge.tone">{{ badge.text }}</span>
          <span class="close" @click="router.push('/paths')">✕</span>
        </div>

        <div class="mastery">
          <div class="ring" :style="{ '--pct': ((selected.score ?? 0) / 100) * 360 + 'deg' }">
            <span>{{ selected.score === null ? "—" : Math.round(selected.score) }}</span>
          </div>
          <div class="mtext">
            <b :style="{ color: colorHex(color) }">{{ colorLabel(color) }}</b>
            <span class="mut">{{ selected.insufficientSample ? "1≤n<5 · 参考分不解锁（BR-01）" : selected.score === null ? "尚无有效证据" : "掌握度 · 近 7 天有练习" }}</span>
          </div>
        </div>

        <nav class="tabs">
          <button
            v-for="t in NARRATIVE_TABS"
            :key="t.key"
            :class="{ on: tab === t.key, miss: cardOf(t.key).missing }"
            @click="tab = t.key"
          >
            {{ t.label }}<i v-if="cardOf(t.key).missing">!</i>
          </button>
        </nav>

        <div class="cardbody" :class="{ miss: cardOf(tab).missing }">{{ cardOf(tab).text }}</div>
        <p v-if="missing.length" class="mut">待补全：{{ missing.join("、") }}（完整度 {{ completeness }}%）</p>

        <div class="sect">代表题（四卡之后独立列 BR-08）</div>
        <div class="row" @click="router.push('/deepdive/question/1024')">#1024 因式分解基础 <span>›</span></div>
        <div class="row" @click="router.push('/deepdive/question/1102')">#1102 十字相乘 <span>›</span></div>

        <div class="sect">前后继</div>
        <div class="chips">
          <span v-for="id in hood" :key="id" class="nodechip" @click="select(id)">
            {{ nodes.find((n) => n.id === id)?.name }}
          </span>
        </div>

        <p v-if="lockedHint()" class="lockhint">🔒 {{ lockedHint() }}</p>
        <div class="dacts">
          <button class="btn" @click="router.push('/paper/9001')">{{ selected.locked ? "去补先修" : "从此处开始练" }}</button>
          <button class="btn ghost" @click="router.push('/formulas')">关联公式</button>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.pad {
  padding: 20px 28px 40px;
  max-width: 1440px;
  margin: 0 auto;
}
.topbar {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px 16px;
}
.topbar input {
  height: 36px;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 0 14px;
  width: 260px;
  outline: none;
  font-size: 14px;
}
.topbar input:focus {
  border-color: var(--brand);
}
.lg {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 12.5px;
  color: var(--ink2);
}
.lg i {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  border: 1.5px solid;
}
.mut {
  color: var(--ink3);
  font-size: 12.5px;
  margin-left: auto;
}
.canvas {
  position: relative;
  height: 560px;
  background:
    repeating-linear-gradient(0deg, #f3f5f9 0 1px, transparent 1px 28px),
    repeating-linear-gradient(90deg, #f3f5f9 0 1px, transparent 1px 28px), #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  margin-top: 12px;
  overflow: hidden;
}
.edges {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.gn {
  position: absolute;
  transform: translate(-50%, -50%);
  min-width: 84px;
  padding: 8px 12px;
  border-radius: 99px;
  border: 2.5px solid;
  background: #fff;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  gap: 7px;
  align-items: center;
  transition: transform 0.15s;
}
.gn:hover {
  transform: translate(-50%, -50%) scale(1.08);
  z-index: 5;
}
.gn.on {
  box-shadow: 0 0 0 4px rgba(47, 107, 255, 0.18);
  z-index: 6;
}
.gn.dim {
  opacity: 0.3;
}
.gn.hood {
  outline: 1.5px dashed #94a3b8;
}
.gn i {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  flex: none;
}
.gn i.dashed {
  border: 1.5px dashed #8b5cf6;
  background: transparent !important;
}
.drawer {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 380px;
  background: #fff;
  border-left: 1px solid var(--line);
  padding: 16px;
  overflow-y: auto;
  box-shadow: -8px 0 24px -14px rgba(0, 0, 0, 0.2);
}
.dhead {
  display: flex;
  gap: 10px;
  align-items: center;
}
.dhead b {
  font-size: 19px;
}
.bdg {
  font-size: 11.5px;
  font-weight: 800;
  border-radius: 7px;
  padding: 2px 9px;
}
.bdg.violet {
  background: #ede9fe;
  color: #6d28d9;
}
.bdg.red {
  background: #fee2e2;
  color: #b91c1c;
}
.close {
  margin-left: auto;
  cursor: pointer;
  color: var(--ink3);
}
.mastery {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-top: 14px;
}
.ring {
  --pct: 0deg;
  width: 62px;
  height: 62px;
  border-radius: 50%;
  background: conic-gradient(var(--brand) var(--pct), #e5e7eb 0);
  display: grid;
  place-items: center;
  position: relative;
  flex: none;
}
.ring::before {
  content: "";
  position: inset: 7px;
  background: #fff;
  border-radius: 50%;
}
.ring span {
  position: relative;
  font-weight: 800;
  font-size: 15px;
}
.mtext {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mtext b {
  font-size: 15.5px;
}
.mut {
  color: var(--ink3);
  font-size: 12.5px;
}
.tabs {
  display: flex;
  gap: 7px;
  margin-top: 16px;
}
.tabs button {
  flex: 1;
  padding: 8px 4px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: #fff;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink3);
  cursor: pointer;
  position: relative;
}
.tabs button.on {
  background: var(--brand-soft);
  border-color: var(--brand);
  color: var(--brand-deep);
}
.tabs button.miss::after,
.tabs button i {
  font-style: normal;
  color: var(--warn);
}
.tabs button i {
  margin-left: 3px;
  font-weight: 900;
}
.cardbody {
  margin-top: 12px;
  background: #f8fafc;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 14px;
  line-height: 1.8;
}
.cardbody.miss {
  border-style: dashed;
  color: var(--ink3);
  text-align: center;
}
.sect {
  font-size: 12.5px;
  font-weight: 800;
  color: var(--ink3);
  margin: 16px 0 8px;
}
.row {
  display: flex;
  justify-content: space-between;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 9px 12px;
  font-size: 13.5px;
  cursor: pointer;
  margin-top: 8px;
}
.row:hover {
  border-color: var(--brand);
}
.chips {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}
.nodechip {
  font-size: 12.5px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  padding: 3px 11px;
  border-radius: 99px;
  cursor: pointer;
}
.lockhint {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  border-radius: 9px;
  padding: 9px 12px;
  font-size: 13px;
  margin-top: 14px;
}
.dacts {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.btn {
  border: none;
  border-radius: 11px;
  background: var(--grad);
  color: #fff;
  font-weight: 700;
  height: 40px;
  padding: 0 18px;
  cursor: pointer;
  font-size: 14.5px;
  flex: 1;
}
.btn.ghost {
  background: var(--brand-soft);
  color: var(--brand);
}
@media (max-width: 960px) {
  .drawer {
    width: 320px;
  }
}
</style>
