<script setup lang="ts">
import { resourceBody, resourceField, resourceItems, resourceNeighbor, resourcePublished, resourceRecord, resourceRows, resourceSlug } from "~/components/ResourceData";
import { jsonLd } from "~/utils/jsonLd";
import { canonicalOrigin, canonicalUrl } from "~/utils/seo";

const route = useRoute();
const slug = String(route.params.slug || "");
definePageMeta({ key: (route) => route.fullPath });
const { data, pending, refresh } = await usePublished<unknown>("public-glossary-" + slug, "glossary/" + slug);
const detail = computed(() => resourceRecord(data.value?.value));
const hasSnapshot = computed(() => !("publishedSnapshot" in detail.value) || detail.value.publishedSnapshot != null);
const present = computed(() => data.value?.available && resourcePublished(detail.value) && hasSnapshot.value && Boolean(resourceField(detail.value, "title", "name")));
const snapshot = computed(() => resourceRecord(detail.value.publishedSnapshot ?? detail.value.snapshot ?? detail.value));
const cards = computed(() => resourceRecord(snapshot.value.cards ?? snapshot.value.narrative ?? snapshot.value));
const title = computed(() => resourceField(detail.value, "title", "name") || "数学词条");
const domain = computed(() => resourceField(detail.value, "domain", "category"));
const definition = computed(() => resourceBody(snapshot.value.definition ?? detail.value.definition));
const tabs = computed(() => [
  { label: "起源", body: resourceBody(cards.value.origin ?? cards.value.origins), rows: resourceRows(cards.value.originExamples) },
  { label: "现实原型", body: resourceBody(cards.value.reality ?? cards.value.realPrototype ?? cards.value.realWorld), rows: resourceRows(cards.value.realExamples) },
  { label: "能力地图", body: resourceBody(cards.value.abilityMap ?? cards.value.capabilityMap), rows: resourceRows(cards.value.abilityLinks) },
  { label: "抽象阶梯", body: resourceBody(cards.value.abstractionLadder ?? cards.value.abstractLadder), rows: resourceRows(cards.value.ladderSteps) }
]);
const activeTab = ref(0);
const related = computed(() => resourceItems(detail.value.related ?? snapshot.value.related).filter(resourceSlug));
const previous = computed(() => resourceNeighbor(detail.value, "prev"));
const next = computed(() => resourceNeighbor(detail.value, "next"));
const representative = computed(() => resourceBody(snapshot.value.representativeQuestion ?? snapshot.value.representative));
const shareMessage = ref("");
const siteOrigin = canonicalOrigin(useRuntimeConfig().public.siteUrl);

async function share() {
  try {
    await navigator.clipboard.writeText(location.href);
    shareMessage.value = "词条链接已复制";
  } catch {
    shareMessage.value = "复制失败，请使用浏览器的分享功能";
  }
}

useSeoMeta({
  title: computed(() => present.value ? title.value + "是什么？起源与应用" : "词条暂不可用"),
  description: computed(() => resourceField(detail.value, "summary") || definition.value.slice(0, 110) || "数源数学词条"),
  ogTitle: computed(() => present.value ? title.value + "是什么？起源与应用 · 数源 MathOrigin" : "词条暂不可用"),
  ogDescription: computed(() => resourceField(detail.value, "summary") || definition.value.slice(0, 110) || "数源数学词条"),
  robots: computed(() => present.value ? "index,follow" : "noindex,follow")
});
useHead(() => ({ script: present.value && siteOrigin ? [{ type: "application/ld+json", innerHTML: jsonLd({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: title.value,
  description: resourceField(detail.value, "summary") || definition.value.slice(0, 155),
  mainEntityOfPage: canonicalUrl(siteOrigin, "/glossary/" + slug)
}) }] : [] }));
</script>

<template>
  <ResourceShell eyebrow="GLOSSARY · 概念四卡" :title="title" :intro="present ? resourceField(detail, 'summary') : '当前词条尚无可展示的已审核版本。'"
    parent="数学词条" parent-to="/glossary">
    <template #hero>
      <div v-if="present" class="detail-actions">
        <span v-if="domain" class="detail-badge">{{ domain }}</span>
        <button type="button" @click="share">分享词条</button>
        <span v-if="shareMessage" role="status">{{ shareMessage }}</span>
      </div>
    </template>
    <p v-if="pending" role="status">正在读取词条…</p>
    <ResourceEmpty v-else-if="!present" title="词条尚未发布或暂不可用" message="未审核的四卡不会出现在公开页面。你可以返回词条列表，继续探索已发布内容。" retry @retry="refresh()" />
    <template v-else>
      <section class="glossary-cards" aria-labelledby="cards-heading">
        <div class="section-line"><span>01 / 概念四卡</span><h2 id="cards-heading">从来处，到用处</h2></div>
        <div class="card-tabs" role="tablist" aria-label="概念四卡">
          <button v-for="(tab, index) in tabs" :id="'card-tab-' + index" :key="tab.label" type="button" role="tab"
            :aria-selected="activeTab === index" :aria-controls="'card-panel-' + index" :tabindex="activeTab === index ? 0 : -1"
            @click="activeTab = index" @keydown.left.prevent="activeTab = (activeTab + 3) % 4" @keydown.right.prevent="activeTab = (activeTab + 1) % 4">{{ tab.label }}</button>
        </div>
        <div v-for="(tab, index) in tabs" v-show="activeTab === index" :id="'card-panel-' + index" :key="tab.label"
          class="card-panel" role="tabpanel" :aria-labelledby="'card-tab-' + index">
          <p class="card-index">0{{ index + 1 }} / 04</p>
          <h3>{{ tab.label }}</h3>
          <p v-if="tab.body" class="card-body">{{ tab.body }}</p>
          <p v-else class="missing-copy">这一卡尚未包含在已发布快照中，待补全。</p>
          <div v-if="tab.rows.length" class="example-grid">
            <div v-for="(row, rowIndex) in tab.rows" :key="rowIndex" class="example">
              <strong>{{ resourceField(row, 'title', 'name') || '例 ' + (rowIndex + 1) }}</strong>
              <p>{{ resourceBody(row) }}</p>
            </div>
          </div>
        </div>
      </section>
      <section class="resource-section" aria-labelledby="definition-heading">
        <div class="section-line"><span>02 / 正式定义</span><h2 id="definition-heading">定义与边界</h2></div>
        <p v-if="definition" class="definition">{{ definition }}</p>
        <p v-else class="missing-copy">当前已发布版本尚无正式定义，待补全。</p>
        <div v-if="representative" class="representative">
          <strong>代表题 · 独立阅读</strong><p>{{ representative }}</p>
        </div>
      </section>
      <section v-if="related.length" class="resource-section" aria-labelledby="related-heading">
        <div class="section-line"><span>03 / 知识连接</span><h2 id="related-heading">沿着相邻概念继续</h2></div>
        <div class="related-list">
          <NuxtLink v-for="item in related" :key="resourceSlug(item)" :to="'/glossary/' + resourceSlug(item)">{{ resourceField(item, "title", "name") || resourceSlug(item) }} <span aria-hidden="true">↗</span></NuxtLink>
        </div>
      </section>
      <nav v-if="resourceSlug(previous) || resourceSlug(next)" class="relay" aria-label="词条接龙">
        <NuxtLink v-if="resourceSlug(previous)" :to="'/glossary/' + resourceSlug(previous)"><span>← 上一站</span><strong>{{ resourceField(previous, "title", "name") || resourceSlug(previous) }}</strong></NuxtLink>
        <span class="relay-current">当前 · {{ title }}</span>
        <NuxtLink v-if="resourceSlug(next)" :to="'/glossary/' + resourceSlug(next)"><span>下一站 →</span><strong>{{ resourceField(next, "title", "name") || resourceSlug(next) }}</strong></NuxtLink>
      </nav>
      <ResourceIntent target-type="node" :slug="slug" :from="'glossary/' + slug" label="去学习端继续探索" />
    </template>
  </ResourceShell>
</template>

<style scoped>
.detail-actions{display:flex;align-items:center;gap:10px;margin-top:26px;color:var(--ink3);font-size:13px}
.detail-badge{padding:7px 12px;border-radius:99px;background:var(--p-soft);color:var(--p-strong);font-weight:800}
.detail-actions button{min-height:40px;padding:7px 13px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink2)}
.section-line{display:flex;align-items:baseline;gap:18px;margin-bottom:20px}
.section-line>span{color:var(--p);font-size:11px;font-weight:800;letter-spacing:.12em;white-space:nowrap}
h2{font:700 clamp(25px,3vw,34px)/1.3 var(--serif);margin:0}
.card-tabs{display:flex;gap:7px;overflow:auto;padding-bottom:10px}
.card-tabs button{min-height:46px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink2);padding:10px 17px;white-space:nowrap}
.card-tabs button[aria-selected=true]{border-color:var(--p);background:var(--p-soft);color:var(--p-strong);font-weight:800}
.card-panel{min-height:240px;border:1px solid var(--line);border-radius:22px;background:var(--card);padding:clamp(22px,4vw,42px);box-shadow:var(--shadow)}
.card-index{margin:0 0 12px;color:var(--p);font:700 12px Georgia,serif;letter-spacing:.13em}
.card-panel h3{font:700 28px var(--serif);margin:0 0 13px}
.card-body,.definition{white-space:pre-line;line-height:1.9;font-size:16px;color:var(--ink2)}
.missing-copy{color:var(--ink3);line-height:1.7}
.example-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:25px}
.example{padding:17px;border-radius:13px;background:var(--alt)}
.example p{font-size:13px;color:var(--ink3);margin:5px 0 0}
.resource-section{margin-top:58px}
.definition{max-width:850px;padding:28px;border-left:4px solid var(--p);background:var(--card);border-radius:0 13px 13px 0}
.representative{margin-top:20px;padding:18px 22px;border:1px solid var(--line);border-radius:13px;background:var(--card)}
.representative p{margin:7px 0 0;color:var(--ink2)}
.related-list{display:flex;flex-wrap:wrap;gap:9px}
.related-list a{padding:10px 14px;border:1px solid var(--line);border-radius:99px;background:var(--card);font-weight:700;font-size:13px}
.relay{display:flex;align-items:stretch;justify-content:space-between;gap:15px;margin-top:55px;border-top:2px solid var(--p);padding-top:20px}
.relay a{display:grid;gap:5px;min-width:120px}
.relay a:last-child{text-align:right}
.relay a span{color:var(--ink3);font-size:12px}
.relay strong{color:var(--ink);font-size:15px}
.relay-current{align-self:center;color:var(--ink3);font-size:13px;text-align:center}
@media(max-width:700px){.section-line{display:block}.section-line h2{margin-top:6px}.example-grid{grid-template-columns:1fr}.relay-current{display:none}}
</style>
