<script setup lang="ts">
import { articlePublished, articleOfType } from "~/components/ArticleData";
import { resourceBody, resourceField, resourceItems, resourceSlug } from "~/components/ResourceData";

const { data, pending, refresh } = await usePublished<unknown>("public-timeline", "articles", { type: 7, size: 100 });
const events = computed(() => resourceItems(data.value?.value)
  .filter((item) => articlePublished(item) && articleOfType(item, 7))
  .filter((item) => resourceField(item, "title", "name") && resourceField(item, "eventYear", "year", "era", "eventDate", "date"))
  .sort((a, b) => {
    const left = Number(resourceField(a, "sortYear", "year"));
    const right = Number(resourceField(b, "sortYear", "year"));
    return Number.isFinite(left) && Number.isFinite(right) ? left - right : 0;
  }));
const selected = ref(0);
const active = computed(() => events.value[selected.value] || events.value[0]);
const zoom = ref(1);
const rail = ref<HTMLElement | null>(null);
let drag: { startX: number; scrollLeft: number } | null = null;

function pointerDown(event: PointerEvent) {
  if (!rail.value || (event.target instanceof HTMLElement && event.target.closest("button"))) return;
  drag = { startX: event.clientX, scrollLeft: rail.value.scrollLeft };
  rail.value.setPointerCapture(event.pointerId);
}
function pointerMove(event: PointerEvent) {
  if (drag && rail.value) rail.value.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
}
function pointerUp() { drag = null; }

useSeoMeta({
  title: "数学年表",
  description: "从已审核的数学历史条目出发，看概念与方法如何在不同时代逐渐成形。"
});
</script>

<template>
  <ResourceShell eyebrow="TIMELINE · 数学年表" title="数学是怎样长出来的" intro="沿时间阅读经过审核的起源故事。点击节点看摘要；有词条关联时，还能继续追问概念本身。">
    <p v-if="pending" role="status">正在读取年表…</p>
    <ResourceEmpty v-else-if="!events.length" :title="data?.available ? '暂无已发布年表条目' : '年表暂时无法读取'"
      :message="data?.available ? '年代、故事和出处需要审核后才会出现在这里。' : '公开内容服务暂不可用；此处没有使用未经核实的历史示例。'"
      retry @retry="refresh()" />
    <template v-else>
      <div class="timeline-tools">
        <p>拖动时间线或横向滚动，点击事件查看详情。手机上按时间纵向阅读。</p>
        <div aria-label="调整时间线密度">
          <button type="button" :disabled="zoom <= .8" aria-label="缩小时间线" @click="zoom = Math.max(.8, zoom - .2)">−</button>
          <span>{{ Math.round(zoom * 100) }}%</span>
          <button type="button" :disabled="zoom >= 1.4" aria-label="放大时间线" @click="zoom = Math.min(1.4, zoom + .2)">+</button>
        </div>
      </div>
      <div ref="rail" class="timeline-rail" :style="{ '--event-width': 225 * zoom + 'px' }" @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerUp" @pointercancel="pointerUp">
        <div class="timeline-track">
          <button v-for="(event, index) in events" :key="resourceSlug(event) || index" type="button" class="timeline-event"
            :aria-pressed="selected === index" @click="selected = index">
            <span class="timeline-year">{{ resourceField(event, "era", "eventYear", "year", "eventDate", "date") }}</span>
            <span class="timeline-dot" aria-hidden="true" />
            <strong>{{ resourceField(event, "title", "name") }}</strong>
            <span>{{ resourceField(event, "summary", "description") }}</span>
          </button>
        </div>
      </div>
      <section v-if="active" class="timeline-detail" aria-live="polite">
        <span>ORIGIN / 起源摘要</span>
        <h2>{{ resourceField(active, "title", "name") }}</h2>
        <p>{{ resourceBody(active) || "这条已发布年表项目暂未提供详细摘要。" }}</p>
        <NuxtLink v-if="resourceSlug({ slug: resourceField(active, 'glossarySlug', 'nodeSlug') })"
          :to="'/glossary/' + resourceSlug({ slug: resourceField(active, 'glossarySlug', 'nodeSlug') })">深入关联词条 ↗</NuxtLink>
      </section>
      <div class="timeline-end">
        <h2>故事的下一页，是亲手推导</h2>
        <p>先从已发布的概念四卡和公式条件继续阅读。</p>
        <NuxtLink to="/glossary">探索数学词条 →</NuxtLink><NuxtLink to="/formulas">查看公式馆 →</NuxtLink>
      </div>
    </template>
  </ResourceShell>
</template>

<style scoped>
.timeline-tools{display:flex;align-items:center;justify-content:space-between;gap:20px;color:var(--ink3);font-size:13px}
.timeline-tools>div{display:flex;align-items:center;gap:8px;white-space:nowrap}
.timeline-tools button{width:38px;height:38px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);font-size:20px}
.timeline-tools button:disabled{opacity:.4}
.timeline-rail{overflow:auto;cursor:grab;touch-action:pan-x;margin-top:30px;padding:27px 6px 24px;scrollbar-color:var(--p) var(--alt)}
.timeline-rail:active{cursor:grabbing}
.timeline-track{position:relative;display:flex;align-items:stretch;min-width:max-content;gap:0}
.timeline-track::before{content:"";position:absolute;left:0;right:0;top:67px;height:2px;background:var(--p)}
.timeline-event{position:relative;display:flex;flex-direction:column;align-items:flex-start;width:var(--event-width);min-height:190px;border:0;background:transparent;color:var(--ink);padding:0 14px;text-align:left;cursor:pointer}
.timeline-year{height:50px;color:var(--p);font:700 25px var(--serif)}
.timeline-dot{z-index:1;width:16px;height:16px;margin:10px 0 19px;border:3px solid var(--p);border-radius:50%;background:var(--card)}
.timeline-event[aria-pressed=true] .timeline-dot{background:var(--p);box-shadow:0 0 0 6px var(--p-soft)}
.timeline-event strong{font:700 17px/1.4 var(--serif)}
.timeline-event>span:last-child{margin-top:7px;color:var(--ink3);font-size:12px;line-height:1.55}
.timeline-detail{max-width:760px;margin-top:26px;padding:27px 31px;border:1px solid var(--line);border-radius:18px;background:var(--card)}
.timeline-detail>span{color:var(--p);font-size:11px;font-weight:800;letter-spacing:.15em}
.timeline-detail h2,.timeline-end h2{font:700 clamp(23px,3vw,32px) var(--serif);margin:8px 0}
.timeline-detail p{white-space:pre-line;color:var(--ink2);line-height:1.8}
.timeline-detail a{color:var(--p-strong);font-weight:800}
.timeline-end{margin-top:52px;padding:30px;border-radius:18px;background:var(--alt)}
.timeline-end p{color:var(--ink3)}.timeline-end a{display:inline-flex;margin:6px 15px 0 0;color:var(--p-strong);font-weight:800}
@media(max-width:640px){.timeline-tools{display:block}.timeline-tools>div{display:none}.timeline-rail{overflow:visible;cursor:auto;touch-action:auto}.timeline-track{display:grid;min-width:0;border-left:2px solid var(--p);margin-left:14px}.timeline-track::before{display:none}.timeline-event{width:100%;min-height:0;padding:0 0 26px 22px}.timeline-year{height:auto;font-size:20px}.timeline-dot{position:absolute;left:-9px;top:3px;margin:0}.timeline-detail{margin-top:8px}}
</style>
