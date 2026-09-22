<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NARRATIVE_TABS,
  badgeFor,
  cardView,
  colorLabel,
  graphColorOf,
  missingCards,
  narrativeCompleteness,
  tabFromQuery,
  type CardKey,
} from "../features/graph/graphUi";

/** W07 节点详情页（16W07：四卡全量 + 掌握历史 + 图谱返回）。 */
const route = useRoute();
const router = useRouter();

const node = {
  id: 12,
  name: "因式分解",
  preparing: false,
  locked: false,
  score: 61,
  insufficientSample: false,
};

const narrative = {
  origin: "古埃及人分地、巴比伦人凑数，都在反复做「把一块面积拆回长宽」——因式分解是这门手艺的代数版。",
  prototype: "裁一块方地，剩下的面积如何表达 / 利息与增长的二次模型拆解 / 抛物线拱桥的跨径分解",
  capability: "① 不可达测距（无法直接量时用结构推）② 模型还原（展开的逆过程）③ 降次化归",
  ladder: 'REAL：拆面积 → MODEL：和与积的互逆 → SYMBOL：a²+2ab+b²=(a+b)²',
} as const;

const tab = ref<CardKey>(tabFromQuery(route.query.card));
function setTab(k: CardKey): void {
  tab.value = k;
  void router.replace({ query: { ...route.query, card: k } });
}
const missing = missingCards(narrative);
const completeness = narrativeCompleteness(narrative);
const badge = badgeFor(node);
const color = graphColorOf(node);

const reps = ["#1024 入门（可深钻）", "#1102 十字相乘", "#1310 逆向构造"];
</script>

<template>
  <div class="node pad">
    <div class="head">
      <span class="bk" @click="router.push('/graph')">‹</span>
      <h1>{{ node.name }}</h1>
      <span class="bdg" :class="badge.tone || 'none'">{{ badge.text || colorLabel(color) }}</span>
      <span class="mut">掌握 {{ node.score }} · tier 2 · 薄弱区间</span>
      <div class="hist">近 7 次：折线占位（接 04 /mastery/history）</div>
    </div>

    <nav class="tabs">
      <button
        v-for="t in NARRATIVE_TABS"
        :key="t.key"
        :class="{ on: tab === t.key }"
        @click="setTab(t.key)"
      >
        {{ t.label }}
      </button>
    </nav>

    <div class="grid">
      <section class="card big">
        <h3>{{ NARRATIVE_TABS.find((t) => t.key === tab)?.label }}</h3>
        <p class="body">{{ cardView(tab, narrative).text }}</p>
        <p class="mut">完整度 {{ completeness }}%<span v-if="missing.length"> · 待补全：{{ missing.join("、") }}</span></p>

        <div class="sect">代表题（四卡之后独立列 · BR-08）</div>
        <div v-for="r in reps" :key="r" class="row" @click="router.push('/deepdive/question/1024')">
          {{ r }} <span>›</span>
        </div>
      </section>

      <aside>
        <div class="card">
          <div class="sect" style="margin-top: 0">关系</div>
          <div class="chips">
            <span class="chip ok">前置：等式性质 ✓</span>
            <span class="chip lock">后继：判别式 🔒</span>
          </div>
          <div class="sect">关联资产</div>
          <div class="chips">
            <span class="chip" @click="router.push('/learn/1/5')">课时 3.2</span>
            <span class="chip" @click="router.push('/deepdive/question/1024')">深钻 #1024</span>
            <span class="chip" @click="router.push('/formulas/7')">公式：求根公式</span>
          </div>
        </div>
        <div class="card mt">
          <div class="acts">
            <button class="btn" @click="router.push('/paper/9001')">从此处开始练</button>
            <button class="btn ghost" @click="router.push('/graph')">回图谱</button>
          </div>
          <p class="mut" style="margin-top: 10px">锁态时按钮=「去补先修」并附 3311 提示（09-L4）</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.pad {
  padding: 22px 32px 48px;
  max-width: 1160px;
  margin: 0 auto;
}
.head {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
}
.bk {
  font-size: 24px;
  cursor: pointer;
  color: var(--ink3);
}
.head h1 {
  font-size: 26px;
}
.mut {
  color: var(--ink3);
  font-size: 13px;
}
.hist {
  width: 100%;
  height: 70px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  color: var(--ink3);
  font-size: 12.5px;
  display: grid;
  place-items: center;
  margin-top: 6px;
}
.bdg {
  font-size: 12px;
  font-weight: 800;
  border-radius: 7px;
  padding: 3px 11px;
}
.bdg.violet {
  background: #ede9fe;
  color: #6d28d9;
}
.bdg.red {
  background: #fee2e2;
  color: #b91c1c;
}
.bdg.none {
  background: #fef3c7;
  color: #b45309;
}
.tabs {
  display: flex;
  gap: 9px;
  margin-top: 18px;
}
.tabs button {
  padding: 10px 24px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: #fff;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--ink3);
  cursor: pointer;
}
.tabs button.on {
  background: var(--brand-soft);
  border-color: var(--brand);
  color: var(--brand-deep);
}
.grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px;
}
.big .body {
  font-size: 16px;
  line-height: 2;
  margin-top: 10px;
}
.sect {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink3);
  margin: 16px 0 8px;
}
.row {
  display: flex;
  justify-content: space-between;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 11px 14px;
  margin-top: 9px;
  cursor: pointer;
  font-size: 14.5px;
}
.row:hover {
  border-color: var(--brand);
}
.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.chip {
  font-size: 13px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 4px 13px;
  cursor: pointer;
}
.chip.ok {
  background: #ecfdf5;
  color: #047857;
}
.chip.lock {
  background: #fef2f2;
  color: #b91c1c;
}
.mt {
  margin-top: 16px;
}
.acts {
  display: flex;
  gap: 10px;
}
.btn {
  border: none;
  border-radius: 11px;
  background: var(--grad);
  color: #fff;
  font-weight: 700;
  height: 42px;
  padding: 0 20px;
  cursor: pointer;
  font-size: 15px;
  flex: 1;
}
.btn.ghost {
  background: var(--brand-soft);
  color: var(--brand);
}
@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
