<script setup lang="ts">
import { resourceField, resourceFormulaId, resourceItems, resourcePublished, resourceRecord, resourceSlug } from "~/components/ResourceData";
import { parsePlotExpression, PlotExpressionError } from "~/utils/plotExpression";

const expression = ref("sin(x)");
const presets = [
  { label: "sin(x)", value: "sin(x)" },
  { label: "x²", value: "x^2" },
  { label: "eˣ / 10", value: "exp(x)/10" },
  { label: "1 / x", value: "1/x" },
  { label: "√x", value: "sqrt(x)" }
];
const canvas = ref<HTMLCanvasElement | null>(null);
const plotStatus = ref("输入表达式后绘制图像。");
const copyStatus = ref("");
const formulaSearch = ref("");
const { data, pending, refresh } = await usePublished<unknown>("public-tools-formulas", "formulas", { size: 100 });
const formulas = computed(() => resourceItems(data.value?.value).filter((item) => resourcePublished(item, "formula")).filter(resourceSlug));
const formulaTotal = computed(() => resourceRecord(data.value?.value).total);
const visibleFormulas = computed(() => formulas.value.filter((item) =>
  !formulaSearch.value.trim() || [resourceField(item, "name", "title"), resourceField(item, "domain", "category"), resourceField(item, "conditionSummary")]
    .join(" ").toLowerCase().includes(formulaSearch.value.trim().toLowerCase())
));
const grouped = computed(() => {
  const groups = new Map<string, typeof formulas.value>();
  for (const item of visibleFormulas.value) {
    const domain = resourceField(item, "domain", "category") || "其他";
    groups.set(domain, [...(groups.get(domain) || []), item]);
  }
  return [...groups.entries()].map(([name, items]) => ({ name, items }));
});
const webBase = String(useRuntimeConfig().public.webBase || "").replace(/\/$/, "");
let compiled: ((x: number) => number | null) | null = null;
let debounce: ReturnType<typeof setTimeout> | undefined;
let observer: ResizeObserver | undefined;

function draw() {
  const el = canvas.value;
  if (!el) return;
  try {
    compiled = parsePlotExpression(expression.value);
  } catch (error) {
    compiled = null;
    plotStatus.value = error instanceof PlotExpressionError ? error.message : "表达式无法解析。";
    const context = el.getContext("2d");
    context?.clearRect(0, 0, el.width, el.height);
    return;
  }
  const context = el.getContext("2d");
  if (!context) { plotStatus.value = "当前设备暂不支持画布。"; return; }
  const width = el.clientWidth || 760;
  const height = width / 1.6;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  el.width = Math.round(width * ratio);
  el.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f8faff";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#e5eaf2";
  context.lineWidth = 1;
  for (let unit = -10; unit <= 10; unit++) {
    const x = (unit + 10) / 20 * width;
    const y = (10 - unit) / 20 * height;
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }
  context.strokeStyle = "#7788aa";
  context.lineWidth = 1.5;
  context.beginPath(); context.moveTo(width / 2, 0); context.lineTo(width / 2, height); context.stroke();
  context.beginPath(); context.moveTo(0, height / 2); context.lineTo(width, height / 2); context.stroke();
  context.strokeStyle = "#2f6bff";
  context.lineWidth = 2.5;
  context.lineJoin = "round";
  context.beginPath();
  let previous: number | null = null;
  let visible = 0;
  for (let pixel = 0; pixel <= width; pixel += Math.max(1, width / 800)) {
    const x = pixel / width * 20 - 10;
    const y = compiled(x);
    if (y == null || Math.abs(y) > 25 || (previous != null && Math.abs(y - previous) > 8)) {
      previous = null;
      continue;
    }
    const py = (10 - y) / 20 * height;
    if (previous === null) context.moveTo(pixel, py);
    else context.lineTo(pixel, py);
    previous = y;
    visible++;
  }
  context.stroke();
  plotStatus.value = visible ? "已绘制 y = " + expression.value + "。横轴与纵轴范围均为 −10 到 10。" : "这个表达式在当前视窗没有可绘制的实数值。";
}

function inspectPoint(event: PointerEvent) {
  if (!canvas.value || !compiled) return;
  const rect = canvas.value.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * 20 - 10;
  const y = compiled(x);
  plotStatus.value = y == null ? "x ≈ " + x.toFixed(2) + "：此处无实数值。" : "x ≈ " + x.toFixed(2) + "，y ≈ " + y.toFixed(3);
}

async function copyExpression() {
  try {
    await navigator.clipboard.writeText(expression.value);
    copyStatus.value = "表达式已复制。可以在学习端粘贴继续使用。";
  } catch {
    copyStatus.value = "复制失败，请手动选择输入框中的表达式。";
  }
}

watch(expression, () => {
  if (!import.meta.client) return;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(draw, 80);
});
onMounted(() => {
  draw();
  if ("ResizeObserver" in window && canvas.value) {
    observer = new ResizeObserver(draw);
    observer.observe(canvas.value);
  }
});
onBeforeUnmount(() => { if (debounce) clearTimeout(debounce); observer?.disconnect(); });

useSeoMeta({
  title: "函数画板与公式速查",
  description: "免费画函数图像，并按领域查找已审核公式与成立条件。"
});
</script>

<template>
  <ResourceShell eyebrow="TOOLS · 免费公开工具" title="让函数长出图像" intro="先画一条曲线，观察它在哪里连续、转弯或没有实数值。旁边的速查表只收录已审核公式。">
    <div class="tools-grid">
      <section class="plot-panel" aria-labelledby="plot-title">
        <p class="section-index">01 / FUNCTION PLOTTER</p>
        <h2 id="plot-title">函数图像画板</h2>
        <form class="plot-form" @submit.prevent="draw">
          <label for="plot-expression">y =</label>
          <input id="plot-expression" v-model="expression" type="text" maxlength="120" spellcheck="false" autocomplete="off" aria-describedby="plot-help">
          <button type="submit">绘制</button>
        </form>
        <div class="presets" aria-label="预设表达式">
          <button v-for="preset in presets" :key="preset.value" type="button" @click="expression = preset.value">{{ preset.label }}</button>
        </div>
        <canvas ref="canvas" class="plot-canvas" width="760" height="475" role="img" :aria-label="'函数图像，表达式 y = ' + expression"
          @pointermove="inspectPoint" @pointerleave="draw" />
        <p class="plot-status" role="status">{{ plotStatus }}</p>
        <p id="plot-help" class="plot-help">支持 x、pi、e、+ − * / ^、括号，以及 sin、cos、tan、sqrt、exp、log、ln、abs。乘法请写 *；表达式由白名单解析，不运行代码。</p>
        <div class="plot-footer">
          <button type="button" @click="copyExpression">复制表达式</button>
          <a :href="webBase + '/login?from=tools'">去学习端做题 ↗</a>
        </div>
        <p v-if="copyStatus" class="plot-status" role="status">{{ copyStatus }}</p>
      </section>
      <section class="cheat-panel" aria-labelledby="cheat-title">
        <p class="section-index">02 / CHEAT SHEET</p>
        <h2 id="cheat-title">公式速查表</h2>
        <label class="sr-only" for="formula-filter">过滤已发布公式</label>
        <input id="formula-filter" v-model="formulaSearch" type="search" placeholder="按名称、领域或条件过滤">
        <p class="cheat-note">这里快速浏览当前载入的前 100 条；<NuxtLink to="/formulas">到公式馆查看全部分页结果 →</NuxtLink><span v-if="typeof formulaTotal === 'number'"> 共 {{ formulaTotal }} 条公开记录。</span></p>
        <p v-if="pending" role="status">正在读取公式…</p>
        <div v-else-if="grouped.length" class="cheat-groups">
          <details v-for="group in grouped" :key="group.name" open>
            <summary>{{ group.name }} <span>{{ group.items.length }} 条</span></summary>
            <NuxtLink v-for="item in group.items" :key="resourceFormulaId(item) || resourceSlug(item)" :to="'/formulas/' + (resourceFormulaId(item) || resourceSlug(item))" class="cheat-item">
              <strong>{{ resourceField(item, "name", "title") || resourceSlug(item) }}</strong>
              <span><ResourceMath v-if="resourceField(item, 'latex', 'formula', 'expression')" :latex="resourceField(item, 'latex', 'formula', 'expression')" /></span>
              <small>{{ resourceField(item, "conditionSummary") || "完整条件见详情" }}</small>
            </NuxtLink>
          </details>
        </div>
        <ResourceEmpty v-else :title="data?.available ? '暂无匹配的已发布公式' : '速查内容暂不可用'"
          :message="data?.available ? '换一个关键词，或等待公式审核发布。' : '公式服务暂不可用；速查表不填充虚构条目。'"
          retry @retry="refresh()" />
      </section>
    </div>
  </ResourceShell>
</template>

<style scoped>
.tools-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.85fr);gap:20px;align-items:start}
.plot-panel,.cheat-panel{padding:clamp(20px,3vw,30px);border:1px solid var(--line);border-radius:20px;background:var(--card)}
.section-index{color:var(--p);font-size:11px;font-weight:800;letter-spacing:.15em;margin:0 0 7px}
h2{font:700 clamp(25px,3vw,32px) var(--serif);margin:0 0 20px}
.plot-form{display:flex;align-items:center;gap:9px}
.plot-form label{font:italic 22px Georgia,serif}
.plot-form input,.cheat-panel>input{min-width:0;flex:1;width:100%;min-height:44px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:var(--page);color:var(--ink)}
.plot-form button{min-height:44px;border:0;border-radius:10px;background:var(--p);color:#fff;padding:10px 17px;font-weight:800}
.presets{display:flex;flex-wrap:wrap;gap:7px;margin:13px 0 18px}
.presets button{min-height:39px;padding:7px 11px;border:1px solid var(--line);border-radius:99px;background:var(--page);color:var(--ink2);font-size:12px}
.plot-canvas{display:block;width:100%;height:auto;aspect-ratio:16/10;border:1px solid var(--line);border-radius:13px;touch-action:pan-y;background:#f8faff}
.plot-status{min-height:20px;color:var(--ink2);font-size:13px}
.plot-help{color:var(--ink3);font-size:12px;line-height:1.7}
.plot-footer{display:flex;flex-wrap:wrap;gap:15px;align-items:center;margin-top:15px}
.plot-footer button{min-height:40px;padding:8px 13px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink)}
.plot-footer a{color:var(--p-strong);font-size:13px;font-weight:800}
.cheat-panel>input{margin-bottom:16px}
.cheat-note{margin:0 0 15px;color:var(--ink3);font-size:12px}.cheat-note a{color:var(--p-strong);font-weight:750}
.cheat-groups{display:grid;gap:11px;max-height:620px;overflow:auto}
.cheat-groups details{border:1px solid var(--line);border-radius:11px;overflow:hidden}
.cheat-groups summary{display:flex;justify-content:space-between;cursor:pointer;padding:12px 15px;background:var(--alt);font-weight:800}
.cheat-groups summary span{color:var(--ink3);font-size:12px}
.cheat-item{display:grid;gap:3px;padding:12px 15px;border-top:1px solid var(--line)}
.cheat-item:hover{background:var(--p-soft)}
.cheat-item strong{font-size:14px}.cheat-item>span{font:16px Georgia,var(--serif)}.cheat-item small{color:var(--ink3);font-size:11px}
@media(max-width:900px){.tools-grid{grid-template-columns:1fr}}
@media(max-width:500px){.plot-form{flex-wrap:wrap}.plot-form input{flex-basis:calc(100% - 40px)}.plot-form button{width:100%}}
</style>
