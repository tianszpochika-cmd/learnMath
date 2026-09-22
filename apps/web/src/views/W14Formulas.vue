<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  FORMULA_SECTIONS,
  buildAliasIndex,
  conditionBar,
  drillAvailability,
  drillTypeLabel,
  errorVariants,
  formulaCard,
  formulaDeepdivePath,
  legalVariants,
  lookupAlias,
  missingSections,
  proofBadge,
  relLabel,
  sectionFromQuery,
  sectionMissing,
  symbolProblem,
  type FormulaDetail,
  type SectionKey,
} from "../features/formula/formulaUi";

/** W14 公式馆 列表 + 详情（16W14 · 七区/条件红条/小练三型/typed 深钻）。 */
const route = useRoute();
const router = useRouter();

const isDetail = computed(() => Boolean(route.params.id));
const tab = ref<SectionKey>(sectionFromQuery(route.query.section));

const list: FormulaDetail[] = [
  {
    id: 7,
    name: "勾股定理",
    aliases: ["毕达哥拉斯定理", "商高定理"],
    latex: "a² + b² = c²",
    proofStatus: 1,
    origin: "古希腊人用面积拼图证明：把四个直角三角形拼进正方形，用面积守恒倒出关系。",
    symbols: [
      { symbol: "a", meaning: "直角边 a", rangeNote: "正实数" },
      { symbol: "b", meaning: "直角边 b", rangeNote: "正实数" },
      { symbol: "c", meaning: "斜边", rangeNote: "正实数，c 为最长边" },
      { symbol: "θ", meaning: "任意锐角", rangeNote: "无量纲" },
    ],
    hasDerivation: true,
    conditions: "仅直角三角形（∠C=90°）。边长为正实数。",
    applications: "① 不可达测距（河宽/山高）② 直角坐标距离 ③ 拱桥与结构校核",
    family: [
      { toFormulaId: 8, relType: 1, note: "任意三角形 → 余弦定理" },
      { toFormulaId: 9, relType: 6, note: "常与面积法搭配" },
    ],
    variants: [
      { legal: true, expression: "c = √(a²+b²)", note: "求斜边正位" },
      { legal: false, expression: "a²+b²=c² 对任意三角形成立", note: "缺 −2ab·cosC 修正项" },
    ],
  },
  {
    id: 12,
    name: "求根公式",
    aliases: ["根号公式"],
    latex: "x = (−b ± √(b²−4ac)) / 2a",
    proofStatus: 2,
    origin: "巴比伦泥板上的配方法雏形；阿拉伯代数学家完成一般形式。",
    symbols: [
      { symbol: "a", meaning: "二次项系数", rangeNote: "a ≠ 0" },
      { symbol: "Δ", meaning: "判别式 b²−4ac", rangeNote: "实数域 Δ≥0 才有解" },
    ],
    hasDerivation: true,
    conditions: "a ≠ 0；实数解需 Δ ≥ 0。",
    applications: "一元二次方程通用求解、顶点坐标推导",
    family: [{ toFormulaId: 13, relType: 3, note: "与配方法等价" }],
    variants: [
      { legal: true, expression: "x = −b/2a ± √Δ /(2a)", note: "拆分式" },
      { legal: false, expression: "x = (−b ± √(b²−4ac)) / 2a 中 a=0", note: "违反前提" },
    ],
  },
  {
    id: 15,
    name: "黎曼猜想（ζ 函数）",
    aliases: ["Riemann Hypothesis"],
    latex: "ζ(s) = 0 的非平凡零点 Re(s) = 1/2",
    proofStatus: 4,
    origin: null,
    symbols: null,
    hasDerivation: false,
    conditions: null,
    applications: null,
    family: null,
    variants: null,
  },
];

const aliasIdx = buildAliasIndex(list);
const query = ref("");
const hitId = lookupAlias(aliasIdx, query.value);

const current = computed<FormulaDetail>(() => {
  if (isDetail.value) {
    const id = Number(route.params.id);
    return list.find((f) => f.id === id) ?? list[0];
  }
  return list[0];
});

const cards = computed(() => list.map((f) => formulaCard(f)));
const missing = computed(() => missingSections(current.value));
const bar = computed(() => conditionBar(current.value));
const drills = computed(() => drillAvailability(current.value));
const errs = computed(() => errorVariants(current.value));
const oks = computed(() => legalVariants(current.value));

function setTab(k: SectionKey): void {
  tab.value = k;
  void router.replace({ query: { ...route.query, section: k } });
}
function searchGo(): void {
  const id = lookupAlias(aliasIdx, query.value);
  if (id !== null) {
    void router.push(`/formulas/${id}`);
  }
}
function sectionHas(k: SectionKey): boolean {
  return !sectionMissing(k, current.value);
}
</script>

<template>
  <!-- 列表态 -->
  <div v-if="!isDetail" class="fm pad">
    <div class="head">
      <span class="bk" @click="router.push('/do')">‹</span>
      <h1>公式馆</h1>
      <div class="search">
        <input v-model="query" placeholder="搜公式/别名（如：毕达哥拉斯 → 直达）" @keyup.enter="searchGo" />
        <button class="btn" @click="searchGo">搜索</button>
      </div>
      <div class="chips">
        <span class="chip">代数</span><span class="chip grey">几何·三角</span><span class="chip grey">分析</span>
      </div>
    </div>

    <div class="grid3">
      <div v-for="c in cards" :key="c.id" class="card fcard" @click="router.push('/formulas/' + c.id)">
        <div class="fhead">
          <b>{{ c.name }}</b>
          <span class="badge" :class="{ bad: !c.citable }">{{ c.badge }}</span>
        </div>
        <div class="latex">{{ c.latex }}</div>
        <p v-if="c.conditionLine" class="cond">{{ c.conditionLine }}</p>
        <p v-else class="cond miss">条件待补全</p>
        <div class="fmeta">
          <span class="chip grey">小练 {{ c.drillCount }}/3 型</span>
          <span class="arrow">›</span>
        </div>
      </div>
    </div>
    <p class="mut">别名索引命中 → 直达（F1 题面可点同源）；proof=4 红紫徽标不可作定理引用（F3）</p>
  </div>

  <!-- 详情态 -->
  <div v-else class="fm pad">
    <div class="head">
      <span class="bk" @click="router.push('/formulas')">‹</span>
      <h1>{{ current.name }}</h1>
      <span class="badge" :class="{ bad: current.proofStatus === 4 }">{{ proofBadge(current.proofStatus) }}</span>
      <span class="chip grey">别名：{{ current.aliases.join("、") || "—" }}</span>
      <button class="btn ghost" style="margin-left: auto" @click="router.push(formulaDeepdivePath(current.id))">
        推导深钻 →
      </button>
    </div>

    <!-- 条件红条（首屏锚点） -->
    <div v-if="bar.anchor" class="condbar">
      ⚠ <b>成立条件摘要：</b>{{ bar.summary }}
      <span class="anchor">完整条件与误用边界 ↓</span>
    </div>
    <div v-else class="condbar miss">⚠ 条件待补全（七区缺口：{{ missing.join("、") || "无" }}）</div>

    <div class="biglatex">{{ current.latex }}</div>

    <nav class="tabs">
      <button
        v-for="s in FORMULA_SECTIONS"
        :key="s.key"
        :class="{ on: tab === s.key, miss: !sectionHas(s.key) }"
        @click="setTab(s.key)"
      >
        {{ s.label }}<i v-if="!sectionHas(s.key)">!</i>
      </button>
    </nav>

    <!-- 七区分栏 -->
    <section class="card">
      <template v-if="tab === 'origin'">
        <b>起源</b>
        <p class="body">{{ current.origin || "待补全" }}</p>
      </template>

      <template v-else-if="tab === 'symbols'">
        <b>符号表（含义 / 定义域·单位 · BR-08 最低要求）</b>
        <table class="tbl">
          <thead><tr><th>符号</th><th>含义</th><th>定义域 / 单位</th><th>状态</th></tr></thead>
          <tbody>
            <tr v-for="s in current.symbols ?? []" :key="s.symbol">
              <td class="sym">{{ s.symbol }}</td>
              <td>{{ s.meaning }}</td>
              <td>{{ s.rangeNote }}</td>
              <td>
                <span v-if="symbolProblem(s)" class="badge bad">{{ symbolProblem(s) }}</span>
                <span v-else class="badge ok">✓</span>
              </td>
            </tr>
            <tr v-if="!current.symbols || current.symbols.length === 0">
              <td colspan="4" class="mut">符号表待补全</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-else-if="tab === 'derivation'">
        <b>推导链</b>
        <p v-if="current.hasDerivation" class="body">
          推导以「subject=formula 的深钻链」承载（solution_path + 四要素步），点右上「推导深钻」进入完整五玩。
        </p>
        <p v-else class="mut">推导链待补全（missing derivation）</p>
      </template>

      <template v-else-if="tab === 'conditions'">
        <b>完整条件与误用边界</b>
        <p class="body">{{ current.conditions || "待补全" }}</p>
        <template v-if="errs.length">
          <div class="sect">常见误用（红笔区 · 不进首屏正位）</div>
          <div v-for="v in errs" :key="v.expression" class="errvar">
            <s>{{ v.expression }}</s><span class="mut">{{ v.note }}</span>
          </div>
        </template>
      </template>

      <template v-else-if="tab === 'applications'">
        <b>应用</b>
        <p class="body">{{ current.applications || "待补全" }}</p>
      </template>

      <template v-else-if="tab === 'family'">
        <b>家族关系</b>
        <div v-for="r in current.family ?? []" :key="r.toFormulaId + '-' + r.relType" class="relrow">
          <span class="chip">{{ relLabel(r.relType) }}</span>
          <span>→ 公式 #{{ r.toFormulaId }}</span>
          <span class="mut">{{ r.note }}</span>
        </div>
        <p v-if="!current.family || current.family.length === 0" class="mut">家族关系待补全</p>
      </template>

      <template v-else-if="tab === 'variants'">
        <b>合法变形（正位）</b>
        <div v-for="v in oks" :key="v.expression" class="legalvar">
          <code>{{ v.expression }}</code><span class="mut">{{ v.note }}</span>
        </div>
        <div v-if="oks.length === 0" class="mut">变形待补全</div>
        <div v-if="errs.length" class="sect">误用变形（红笔）</div>
        <div v-for="v in errs" :key="'e' + v.expression" class="errvar">
          <s>{{ v.expression }}</s><span class="mut">{{ v.note }}</span>
        </div>
      </template>
    </section>

    <!-- 小练三型（有多少显示多少） -->
    <div class="drillbar">
      <span class="sect" style="margin: 0">小练（{{ drills.length }}/3 型可用）</span>
      <button v-for="t in drills" :key="t" class="btn" @click="router.push('/paper/9001')">
        试做·{{ drillTypeLabel(t) }}
      </button>
      <span v-if="drills.length === 0" class="mut">小练未配（不硬凑入口）</span>
      <button class="btn ghost" style="margin-left: auto" @click="router.push('/paper/9001')">试做第 1 题（题面公开）</button>
    </div>
    <p class="mut">七区完整度缺口：{{ missing.length ? missing.join("、") : "无（全部可达）" }} · 官网仅展示公开摘要（V3）</p>
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
  font-size: 24px;
}
.search {
  display: flex;
  gap: 8px;
  flex: 1;
  max-width: 420px;
}
.search input {
  flex: 1;
  height: 40px;
  border: 1.5px solid var(--line);
  border-radius: 10px;
  padding: 0 14px;
  outline: none;
  font-size: 14.5px;
}
.search input:focus {
  border-color: var(--brand);
}
.chips {
  display: flex;
  gap: 8px;
}
.chip {
  font-size: 12.5px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 4px 13px;
  font-weight: 600;
}
.chip.grey {
  background: #f1f5f9;
  color: #64748b;
}
.grid3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 16px;
}
.fcard {
  cursor: pointer;
}
.fcard:hover {
  border-color: var(--brand);
}
.fhead {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.badge {
  font-size: 11.5px;
  font-weight: 800;
  border-radius: 7px;
  padding: 3px 9px;
  background: #ecfdf5;
  color: #047857;
}
.badge.bad {
  background: #f3e8ff;
  color: #7c3aed;
}
.badge.ok {
  background: #ecfdf5;
  color: #047857;
}
.latex {
  font-family: var(--font-math);
  font-style: italic;
  font-size: 22px;
  text-align: center;
  background: #f8fafc;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 20px 10px;
  margin-top: 10px;
}
.cond {
  font-size: 12.5px;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 7px 10px;
  margin-top: 10px;
}
.cond.miss {
  color: var(--ink3);
  background: #f8fafc;
  border-style: dashed;
}
.fmeta {
  display: flex;
  align-items: center;
  margin-top: 10px;
}
.arrow {
  margin-left: auto;
  color: var(--ink3);
}
.condbar {
  background: #fef2f2;
  border: 1.5px solid #fecaca;
  color: #991b1b;
  border-radius: 10px;
  padding: 12px 16px;
  margin-top: 14px;
  font-size: 14.5px;
}
.condbar .anchor {
  float: right;
  font-size: 12.5px;
  color: var(--brand);
  font-weight: 700;
}
.condbar.miss {
  color: var(--ink3);
  background: #f8fafc;
  border-style: dashed;
}
.biglatex {
  font-family: var(--font-math);
  font-style: italic;
  font-size: 34px;
  text-align: center;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 30px 14px;
  margin-top: 14px;
}
.tabs {
  display: flex;
  gap: 7px;
  margin-top: 16px;
  flex-wrap: wrap;
}
.tabs button {
  padding: 8px 15px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: #fff;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--ink3);
  cursor: pointer;
}
.tabs button.on {
  background: var(--brand-soft);
  border-color: var(--brand);
  color: var(--brand-deep);
}
.tabs button i {
  font-style: normal;
  color: var(--warn);
  font-weight: 900;
  margin-left: 3px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
  margin-top: 12px;
}
.body {
  font-size: 15px;
  line-height: 1.9;
  margin-top: 8px;
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
  padding: 9px 6px;
  border-bottom: 1px solid #f1f3f7;
}
.sym {
  font-family: var(--font-math);
  font-style: italic;
  font-weight: 700;
  font-size: 16px;
}
.sect {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink3);
  margin: 14px 0 8px;
}
.errvar {
  display: flex;
  gap: 12px;
  align-items: center;
  background: #fef2f2;
  border: 1px dashed #fecaca;
  border-radius: 9px;
  padding: 9px 12px;
  margin-top: 8px;
  font-size: 14px;
}
.legalvar {
  display: flex;
  gap: 12px;
  align-items: center;
  background: #f8fafc;
  border-radius: 9px;
  padding: 9px 12px;
  margin-top: 8px;
  font-size: 14px;
}
.relrow {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 9px 0;
  border-top: 1px solid #f1f3f7;
  font-size: 14px;
}
.drillbar {
  display: flex;
  gap: 10px;
  align-items: center;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px 16px;
  margin-top: 12px;
  flex-wrap: wrap;
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
.mut {
  color: var(--ink3);
  font-size: 13px;
  margin-top: 10px;
}
@media (max-width: 960px) {
  .grid3 {
    grid-template-columns: 1fr;
  }
}
</style>
