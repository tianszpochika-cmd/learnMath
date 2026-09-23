<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { FORMULA_SECTIONS, conditionBar, drillAvailability, drillTypeLabel, errorVariants, formulaCard, formulaDeepdivePath, legalVariants, missingSections, proofBadge, relLabel, sectionFromQuery, sectionMissing, symbolProblem, type DrillType, type FormulaDetail, type SectionKey } from "../features/formula/formulaUi";
import type { FormulaPathSummary } from "../features/formula/formulaProjection";
import { createFormulaApi } from "../services/formulas";

/** W14: published formula projections only; exercises are server-created attempts. */
const route = useRoute();
const router = useRouter();
const api = createFormulaApi();
const domains = ["算术", "代数", "几何", "三角", "数列", "概率统计", "微积分", "线性代数", "复变", "数论", "其他"];
const PAGE_SIZE = 12;

const isDetail = computed(() => route.params.id !== undefined);
const detailId = computed(() => {
  const raw = String(route.params.id ?? "");
  const id = Number(raw);
  return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(id) ? id : null;
});
const tab = computed<SectionKey>(() => sectionFromQuery(route.query.section));

const searchInput = ref("");
const keyword = ref("");
const domain = ref<number | null>(null);
const tier = ref<number | null>(null);
const proofStatus = ref<number | null>(null);
const quality = ref<number | null>(null);
const list = ref<FormulaDetail[]>([]);
const listPage = ref(0);
const listTotal = ref<number | null>(null);
const listHasMore = ref(false);
const listBusy = ref(false);
const listError = ref("");
let listRun = 0;

const detail = ref<FormulaDetail | null>(null);
const paths = ref<FormulaPathSummary[]>([]);
const detailBusy = ref(false);
const detailError = ref("");
const pathsError = ref("");
const drillBusy = ref<DrillType | null>(null);
const drillError = ref("");
const copyStatus = ref("");
let detailRun = 0;

const cards = computed(() => list.value.map(formulaCard));
const conditions = computed(() => conditionBar(detail.value));
const detailWithPaths = computed(() => detail.value ? { ...detail.value, hasDerivation: detail.value.hasDerivation || paths.value.length > 0 } : null);
const missing = computed(() => missingSections(detailWithPaths.value));
const drills = computed(() => drillAvailability(detail.value));
const legalForms = computed(() => legalVariants(detail.value));
const errorForms = computed(() => errorVariants(detail.value));
const domainName = (value: number | null | undefined) => value && domains[value - 1] ? domains[value - 1] : "领域未标注";
const explanation = (error: unknown) => error instanceof Error && error.message ? error.message : "请求暂时失败，请稍后重试。";

async function loadList(reset = false): Promise<void> {
  if (!reset && (listBusy.value || !listHasMore.value)) return;
  const run = reset ? ++listRun : listRun;
  const nextPage = reset ? 1 : listPage.value + 1;
  if (reset) { list.value = []; listPage.value = 0; listTotal.value = null; listHasMore.value = false; }
  listBusy.value = true;
  listError.value = "";
  try {
    const result = await api.list({ keyword: keyword.value, domain: domain.value, tier: tier.value,
      proofStatus: proofStatus.value, quality: quality.value, page: nextPage, size: PAGE_SIZE });
    if (run !== listRun || isDetail.value) return;
    const seen = new Set(list.value.map((item) => item.id));
    list.value = [...list.value, ...result.items.filter((item) => !seen.has(item.id))];
    listPage.value = result.page;
    listTotal.value = result.total;
    listHasMore.value = result.hasMore;
  } catch (error) {
    if (run === listRun) listError.value = explanation(error);
  } finally {
    if (run === listRun) listBusy.value = false;
  }
}

function search(): void {
  keyword.value = searchInput.value.trim();
  void loadList(true);
}

async function loadDetail(id: number | null): Promise<void> {
  const run = ++detailRun;
  detail.value = null;
  paths.value = [];
  detailError.value = "";
  pathsError.value = "";
  drillError.value = "";
  copyStatus.value = "";
  if (!id) { detailError.value = "公式编号无效。"; return; }
  detailBusy.value = true;
  try {
    const result = await api.detail(id);
    if (run !== detailRun) return;
    detail.value = result;
    if (!result) return;
    try { paths.value = await api.paths(id); }
    catch (error) { if (run === detailRun) pathsError.value = explanation(error); }
  } catch (error) {
    if (run === detailRun) detailError.value = explanation(error);
  } finally {
    if (run === detailRun) detailBusy.value = false;
  }
}

async function selectTab(next: SectionKey): Promise<void> {
  await router.replace({ query: { ...route.query, section: next } });
  await nextTick();
  document.getElementById("formula-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function startDrill(type: DrillType): Promise<void> {
  if (!detail.value || !drills.value.includes(type) || drillBusy.value) return;
  drillBusy.value = type;
  drillError.value = "";
  try {
    const attemptId = await api.drill(detail.value.id, type);
    await router.push(`/paper/${attemptId}`);
  } catch (error) {
    drillError.value = explanation(error);
  } finally { drillBusy.value = null; }
}

async function copyExpression(): Promise<void> {
  if (!detail.value?.latex) return;
  try { await navigator.clipboard.writeText(detail.value.latex); copyStatus.value = "公式已复制"; }
  catch { copyStatus.value = "复制失败，请选择式子手动复制。"; }
}

watch(() => route.params.id, (value) => {
  if (value === undefined) { if (!list.value.length) void loadList(true); }
  else void loadDetail(detailId.value);
}, { immediate: true });
watch([domain, tier, proofStatus, quality], () => { if (!isDetail.value) void loadList(true); });
</script>

<template>
  <main class="formula-page">
    <header class="hero">
      <div class="hero-inner">
        <button class="back-link" type="button" @click="router.push(isDetail ? '/formulas' : '/')">← {{ isDetail ? '返回公式馆' : '学习首页' }}</button>
        <p class="eyebrow">MATHORIGIN / FORMULA ATLAS</p>
        <h1>{{ isDetail ? detail?.name || '公式详情' : '公式馆' }}</h1>
        <p>{{ isDetail ? '看懂式子、成立条件与推导依据，再决定怎样应用。' : '从已发布的公式出发，沿着条件、推导与应用继续学习。' }}</p>
        <span class="hero-mark" aria-hidden="true">∑</span>
      </div>
    </header>

    <div v-if="!isDetail" class="content">
      <div class="section-head"><div><span class="eyebrow">BROWSE / 探索</span><h2>按名称或别名寻找公式</h2></div><span class="count">{{ listTotal === null ? '仅显示已取得的发布内容' : `共 ${listTotal} 条结果` }}</span></div>
      <form class="search" @submit.prevent="search">
        <label class="sr-only" for="formula-search">搜索公式正名或别名</label>
        <span aria-hidden="true">⌕</span><input id="formula-search" v-model="searchInput" type="search" placeholder="输入公式正名或别名" />
        <button type="submit">搜索</button>
      </form>
      <div class="filters" aria-label="公式筛选">
        <label>领域<select v-model="domain"><option :value="null">全部领域</option><option v-for="(name, index) in domains" :key="name" :value="index + 1">{{ name }}</option></select></label>
        <label>层级<select v-model="tier"><option :value="null">全部层级</option><option v-for="n in 5" :key="n" :value="n">Tier {{ n }}</option></select></label>
        <label>证明状态<select v-model="proofStatus"><option :value="null">全部状态</option><option v-for="n in 4" :key="n" :value="n">{{ proofBadge(n) }}</option></select></label>
        <label>来源<select v-model="quality"><option :value="null">全部来源</option><option :value="1">人工整理</option><option :value="2">AI 整理</option></select></label>
      </div>
      <p class="filter-note">正名与别名搜索、分页及筛选结果由公式馆接口决定；未发布版本不会展示。</p>
      <div v-if="listError" class="state error" role="alert"><strong>公式列表暂不可用</strong><p>{{ listError }}</p><button type="button" @click="loadList(true)">重试</button></div>
      <div v-else-if="listBusy && !list.length" class="state" role="status">正在读取已发布公式…</div>
      <div v-else-if="!list.length" class="state"><strong>{{ listHasMore ? '当前页没有可展示的已发布公式' : '没有符合条件的已发布公式' }}</strong><p>{{ listHasMore ? '可继续加载后续结果。' : '可以更换关键词或筛选条件，再试一次。' }}</p></div>
      <div v-if="list.length" class="formula-grid">
        <RouterLink v-for="card in cards" :key="card.id" class="formula-card" :to="`/formulas/${card.id}`">
          <div class="card-top"><span class="card-category">{{ domainName(list.find((item) => item.id === card.id)?.domain) }}</span><span class="proof-badge" :class="{ caution: !card.citable }">{{ card.badge }}</span></div>
          <h3>{{ card.name }}</h3>
          <div class="formula-text" :title="card.latex">{{ card.latex || '表达式待补全' }}</div>
          <p class="condition-preview">{{ card.conditionLine || '成立条件待补全' }}</p>
          <div class="card-bottom"><span>{{ card.drillCount ? `${card.drillCount} 型小练可选` : '小练尚未确认可用' }}</span><span aria-hidden="true">↗</span></div>
        </RouterLink>
      </div>
      <div v-if="list.length || listHasMore" class="pager"><span>已显示 {{ list.length }}{{ listTotal === null ? '' : ` / ${listTotal}` }} 条</span><button v-if="listHasMore" type="button" :disabled="listBusy" @click="loadList()">{{ listBusy ? '正在加载…' : '加载更多公式' }}</button><span v-else>已到当前结果末尾</span></div>
    </div>

    <div v-else class="content detail-content">
      <div v-if="detailBusy" class="state" role="status">正在读取已发布公式与推导摘要…</div>
      <div v-else-if="detailError || !detail" class="state error" role="alert"><strong>这条公式暂不可查看</strong><p>{{ detailError || '尚无可展示的已发布版本。' }}</p><button type="button" @click="loadDetail(detailId)">重试读取</button><RouterLink to="/formulas">返回公式馆</RouterLink></div>
      <template v-else>
        <div class="detail-meta"><span>{{ domainName(detail.domain) }}</span><span>{{ detail.tier ? `Tier ${detail.tier}` : '层级未标注' }}</span><span v-if="detail.quality === 2">AI 整理 · 已发布内容</span><span v-else-if="detail.quality === 1">人工整理</span><span class="proof-badge" :class="{ caution: detail.proofStatus >= 3 || detail.proofStatus < 1 }">{{ proofBadge(detail.proofStatus) }}</span></div>
        <div v-if="detail.proofStatus === 3 || detail.proofStatus === 4" class="proof-warning" role="note"><strong>{{ detail.proofStatus === 4 ? '尚未证明，请勿当作定理引用' : '经验拟合，请核对适用范围' }}</strong><p>使用前请查看来源与完整成立条件，避免将结论推广到未经验证的情形。</p></div>
        <div class="expression-panel"><span class="expression-label">FORMULA / {{ detail.name }}</span><div class="expression">{{ detail.latex || '表达式待补全' }}</div><button type="button" :disabled="!detail.latex" @click="copyExpression">复制式子</button><span v-if="copyStatus" class="copy-note" role="status">{{ copyStatus }}</span></div>
        <div class="conditions-bar"><strong>成立条件摘要</strong><p>{{ detail.conditionSummary || conditions.summary || '已发布版本的成立条件待补全，使用前请核对完整条件。' }}</p><button v-if="detail.conditions" type="button" @click="selectTab('conditions')">查看完整条件与误用边界 ↓</button></div>
        <p v-if="detail.aliases.length" class="aliases">别名：{{ detail.aliases.join(' · ') }}</p>

        <div class="learning-layout">
          <section id="formula-content" class="learning-main">
            <div class="section-head"><div><span class="eyebrow">SEVEN PARTS / 完整研习</span><h2>逐层理解这条公式</h2></div><span class="count">{{ 7 - missing.length }} / 7 区有已发布内容</span></div>
            <nav class="tabs" aria-label="公式研习七区"><button v-for="section in FORMULA_SECTIONS" :key="section.key" type="button" :class="{ active: tab === section.key }" :aria-current="tab === section.key ? 'page' : undefined" @click="selectTab(section.key)">{{ section.label }}<span v-if="sectionMissing(section.key, detailWithPaths)" class="tab-missing">待补</span></button></nav>
            <article class="chapter">
              <template v-if="tab === 'origin'"><span class="chapter-index">01 / ORIGIN</span><h3>它从哪里来</h3><p class="body-copy">{{ detail.origin || '起源内容待补全。' }}</p></template>
              <template v-else-if="tab === 'symbols'"><span class="chapter-index">02 / SYMBOLS</span><h3>读懂每个符号</h3><div v-if="detail.symbols?.length" class="table-wrap"><table><thead><tr><th>符号</th><th>含义</th><th>定义域 / 单位</th></tr></thead><tbody><tr v-for="symbol in detail.symbols" :key="symbol.symbol"><td class="symbol">{{ symbol.symbol }}</td><td>{{ symbol.meaning || '待补全' }}</td><td>{{ symbol.rangeNote || '待补全' }}<small v-if="symbolProblem(symbol)">{{ symbolProblem(symbol) }}</small></td></tr></tbody></table></div><p v-else class="empty-copy">符号表待补全。</p></template>
              <template v-else-if="tab === 'derivation'"><span class="chapter-index">03 / DERIVATION</span><h3>推导链</h3><p class="body-copy">这里仅展示已发布推导的标题与版本摘要。完整推导须由学习端核验当前作答的辅助权限。</p><div v-if="paths.length" class="path-list"><div v-for="path in paths" :key="path.id" class="path-row"><strong>{{ path.title }}</strong><span>{{ [path.quality, path.version ? `版本 ${path.version}` : ''].filter(Boolean).join(' · ') || '已发布摘要' }}</span></div></div><p v-else class="empty-copy">{{ pathsError ? `推导摘要暂不可读取：${pathsError}` : '该公式的已发布推导摘要待补全。' }}</p><RouterLink v-if="paths.length" class="deep-link" :to="formulaDeepdivePath(detail.id)">打开完整推导 ↗</RouterLink><p class="permission-note">完整推导页由学习端权限校验；当前作答策略不允许时，以服务端提示为准。</p></template>
              <template v-else-if="tab === 'conditions'"><span class="chapter-index">04 / CONDITIONS</span><h3>完整条件与误用边界</h3><p class="body-copy">{{ detail.conditions || '完整成立条件待补全。' }}</p><div v-if="errorForms.length" class="variant-list"><h4>常见误用</h4><div v-for="form in errorForms" :key="form.expression" class="variant invalid"><code>{{ form.expression }}</code><span>{{ form.note || '误用原因待补全' }}</span></div></div></template>
              <template v-else-if="tab === 'applications'"><span class="chapter-index">05 / APPLICATION</span><h3>它能解决什么</h3><p class="body-copy">{{ detail.applications || '应用内容待补全。' }}</p></template>
              <template v-else-if="tab === 'family'"><span class="chapter-index">06 / FAMILY</span><h3>放回公式家族</h3><div v-if="detail.family?.length" class="family-list"><RouterLink v-for="relation in detail.family" :key="`${relation.toFormulaId}-${relation.relType}`" :to="`/formulas/${relation.toFormulaId}`"><span>{{ relLabel(relation.relType) }}</span><strong>公式 #{{ relation.toFormulaId }}</strong><small>{{ relation.note }}</small><b aria-hidden="true">↗</b></RouterLink></div><p v-else class="empty-copy">家族关系待补全。</p></template>
              <template v-else><span class="chapter-index">07 / VARIANTS</span><h3>合法变形与常见错误</h3><div v-if="legalForms.length" class="variant-list"><h4>合法变形</h4><div v-for="form in legalForms" :key="form.expression" class="variant"><code>{{ form.expression }}</code><span>{{ form.note }}</span></div></div><div v-if="errorForms.length" class="variant-list"><h4>误用形式</h4><div v-for="form in errorForms" :key="form.expression" class="variant invalid"><code>{{ form.expression }}</code><span>{{ form.note }}</span></div></div><p v-if="!legalForms.length && !errorForms.length" class="empty-copy">变形内容待补全。</p></template>
            </article>
          </section>
          <aside class="practice-panel"><span class="eyebrow">PRACTICE / 标准作答</span><h2>用一道题确认理解</h2><p>小练由服务端创建真实作答，成绩和错题以作答服务为准。</p><div v-if="drills.length" class="drill-list"><button v-for="type in drills" :key="type" type="button" :disabled="Boolean(drillBusy)" @click="startDrill(type)"><span>{{ drillTypeLabel(type) }}</span><b>{{ drillBusy === type ? '创建中…' : '开始小练 ↗' }}</b></button></div><p v-else class="empty-copy">当前没有服务端确认可用的小练类型。</p><p v-if="drillError" class="drill-error" role="alert">{{ drillError }}</p><p class="practice-note">当前作答策略可能限制公式推导或另开练习；以服务端返回为准。</p></aside>
        </div>
      </template>
    </div>
  </main>
</template>

<style scoped>
.formula-page{min-height:100vh;background:var(--bg);color:var(--ink)}.hero{position:relative;overflow:hidden;background:#14244b;color:#fff}.hero-inner{position:relative;max-width:1220px;min-height:230px;margin:auto;padding:31px 32px 44px}.hero-inner:after{content:"";position:absolute;right:-120px;top:-250px;width:540px;height:540px;border:1px solid #ffffff35;border-radius:50%;box-shadow:0 0 0 60px #ffffff0a,0 0 0 124px #ffffff09}.back-link{position:relative;z-index:1;border:0;background:none;color:#c8d7f5;font-size:13px}.eyebrow{display:block;color:var(--primary);font-size:11px;font-weight:850;letter-spacing:.17em}.hero .eyebrow{margin-top:25px;color:#9fbaff}.hero h1{position:relative;z-index:1;margin:7px 0 6px;font:700 clamp(30px,4vw,46px)/1.25 var(--serif)}.hero p{position:relative;z-index:1;max-width:600px;color:#d3def4;font-size:14px}.hero-mark{position:absolute;right:120px;bottom:0;color:#ffffff20;font:130px/.85 Georgia,serif}.content{max-width:1220px;margin:auto;padding:34px 32px 70px}.section-head{display:flex;justify-content:space-between;align-items:end;gap:15px;margin-bottom:17px}.section-head h2{margin-top:5px;font:700 clamp(21px,2.4vw,27px) var(--serif)}.count{color:var(--muted);font-size:12px}.search{display:flex;align-items:center;gap:10px;min-height:58px;padding:6px 8px 6px 17px;border:1.5px solid var(--primary);border-radius:15px;background:var(--paper);box-shadow:var(--shadow)}.search span{font-size:27px;color:var(--primary)}.search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--ink);font-size:15px}.search button,.pager button,.state button{min-height:40px;padding:8px 18px;border:0;border-radius:9px;background:var(--grad);color:#fff;font-weight:750}.filters{display:flex;flex-wrap:wrap;gap:10px;margin-top:15px}.filters label{display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--muted);font-size:12px}.filters select{max-width:170px;border:0;background:var(--paper);color:var(--ink);font-weight:700;outline:0}.filter-note{margin:10px 1px 0;color:var(--muted);font-size:12px}.formula-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px;margin-top:25px}.formula-card{display:flex;min-height:290px;flex-direction:column;padding:20px;border:1px solid var(--line);border-radius:18px;background:var(--paper);box-shadow:var(--shadow);text-decoration:none;transition:transform .2s,border-color .2s}.formula-card:hover{transform:translateY(-3px);border-color:var(--primary)}.card-top,.card-bottom{display:flex;justify-content:space-between;align-items:center;gap:8px}.card-category{color:var(--primary);font-size:11px;font-weight:800;letter-spacing:.08em}.proof-badge{display:inline-block;padding:5px 9px;border-radius:99px;background:var(--good-bg);color:var(--good);font-size:11px;font-weight:800}.proof-badge.caution{background:var(--warning-bg);color:var(--warning)}.formula-card h3{margin:18px 0 10px;font-size:19px}.formula-text{display:grid;place-items:center;min-height:76px;padding:13px;border:1px solid var(--line);border-radius:12px;background:var(--soft);font:600 22px/1.4 var(--math);white-space:pre-wrap;overflow-wrap:anywhere;text-align:center}.condition-preview{margin:12px 0 18px;color:var(--danger);font-size:12px;line-height:1.6}.card-bottom{margin-top:auto;padding-top:12px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}.card-bottom span:last-child{color:var(--primary);font-size:20px}.pager{display:flex;justify-content:center;align-items:center;gap:17px;margin-top:27px;color:var(--muted);font-size:12px}.pager button:disabled{opacity:.55}.state{display:flex;align-items:flex-start;flex-direction:column;gap:8px;margin-top:25px;padding:28px;border:1px solid var(--line);border-radius:16px;background:var(--paper);line-height:1.7}.state p{color:var(--muted)}.state.error{border-color:var(--danger)}.state a{color:var(--primary)}.detail-meta{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:14px}.detail-meta>span:not(.proof-badge){padding:5px 10px;border-radius:99px;background:var(--soft);color:var(--body);font-size:12px;font-weight:700}.proof-warning{margin:12px 0;padding:15px 18px;border:1px solid var(--warning);border-radius:13px;background:var(--warning-bg);color:var(--warning)}.proof-warning p{font-size:12px;margin-top:5px}.expression-panel{position:relative;padding:29px;border:1px solid var(--line);border-radius:19px;background:var(--paper);box-shadow:var(--shadow)}.expression-label,.chapter-index{color:var(--primary);font-size:11px;font-weight:850;letter-spacing:.15em}.expression{padding:26px 5px;text-align:center;white-space:pre-wrap;overflow-wrap:anywhere;font:600 clamp(25px,4vw,42px)/1.4 var(--math)}.expression-panel button{padding:8px 13px;border:1px solid var(--line);border-radius:9px;background:var(--soft);color:var(--ink);font-weight:700}.expression-panel button:disabled{opacity:.5}.copy-note{margin-left:12px;color:var(--muted);font-size:12px}.conditions-bar{margin-top:14px;padding:16px 20px;border-left:5px solid var(--danger);border-radius:0 11px 11px 0;background:var(--danger-bg);color:var(--ink)}.conditions-bar strong{color:var(--danger)}.conditions-bar p{margin:4px 0;line-height:1.7}.conditions-bar button{border:0;background:none;color:var(--danger);font-size:13px;font-weight:800;text-decoration:underline}.aliases{margin-top:12px;color:var(--muted);font-size:12px}.learning-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:22px;margin-top:36px;align-items:start}.learning-main{min-width:0;scroll-margin-top:25px}.tabs{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px}.tabs button{min-height:39px;padding:8px 12px;border:1px solid var(--line);border-radius:9px;background:var(--paper);color:var(--body);font-size:12px;font-weight:750}.tabs button.active{border-color:var(--primary);background:var(--primary-soft);color:var(--primary-deep)}.tab-missing{margin-left:5px;color:var(--warning);font-size:10px}.chapter{min-height:270px;padding:26px;border:1px solid var(--line);border-radius:17px;background:var(--paper)}.chapter h3{margin:7px 0 13px;font:700 23px var(--serif)}.body-copy{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9}.empty-copy{color:var(--muted);font-size:13px;line-height:1.8}.chapter .empty-copy{margin-top:12px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:10px;border-bottom:1px solid var(--line);font-size:13px}th{color:var(--muted)}td small{display:block;color:var(--warning);font-size:11px}.symbol{font:700 17px var(--math)}.path-list,.variant-list,.family-list{display:grid;gap:9px;margin-top:15px}.path-row,.variant{display:flex;justify-content:space-between;gap:10px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--soft)}.path-row span,.variant span{color:var(--muted);font-size:12px}.permission-note,.practice-note{margin-top:17px;color:var(--muted);font-size:12px;line-height:1.7}.deep-link{display:inline-block;margin-top:14px;padding:9px 13px;border-radius:9px;background:var(--primary-soft);color:var(--primary-deep);font-size:13px;font-weight:800;text-decoration:none}.variant-list h4{font-size:13px}.variant code{white-space:pre-wrap;overflow-wrap:anywhere;font:15px var(--math)}.variant.invalid{border-color:var(--danger);background:var(--danger-bg)}.variant.invalid code{color:var(--danger)}.family-list a{display:flex;align-items:center;gap:11px;padding:13px;border:1px solid var(--line);border-radius:10px;text-decoration:none}.family-list a:hover{border-color:var(--primary)}.family-list a span{color:var(--primary);font-size:12px}.family-list a small{color:var(--muted)}.family-list a b{margin-left:auto;color:var(--primary)}.practice-panel{position:sticky;top:20px;padding:20px;border:1px solid var(--line);border-radius:16px;background:var(--paper);box-shadow:var(--shadow)}.practice-panel h2{margin:6px 0;font:700 20px var(--serif)}.practice-panel>p{color:var(--muted);font-size:12px;line-height:1.7}.drill-list{display:grid;gap:8px;margin-top:17px}.drill-list button{display:flex;justify-content:space-between;gap:8px;min-height:48px;align-items:center;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:var(--soft);color:var(--ink);text-align:left}.drill-list button:hover{border-color:var(--primary)}.drill-list button:disabled{opacity:.6}.drill-list b{color:var(--primary);font-size:12px}.practice-panel .drill-error{margin-top:13px;color:var(--danger)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:950px){.formula-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.learning-layout{grid-template-columns:1fr}.practice-panel{position:static}}
@media(max-width:620px){.hero-inner{min-height:210px;padding:22px 18px 35px}.hero-mark{right:10px;font-size:90px}.content{padding:25px 16px 50px}.section-head{align-items:start;flex-direction:column}.formula-grid{grid-template-columns:1fr}.formula-card{min-height:250px}.filters label{flex:1 1 45%}.filters select{min-width:0;width:100%}.expression-panel{padding:20px}.expression{padding:21px 0}.chapter{padding:19px}.pager{flex-wrap:wrap}.path-row,.variant{flex-direction:column}}
</style>
