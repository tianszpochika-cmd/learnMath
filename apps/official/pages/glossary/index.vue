<script setup lang="ts">
import { resourceField, resourceItems, resourcePublished, resourceRecord, resourceSlug } from "~/components/ResourceData";

const keyword = ref("");
const domain = ref("");
const request = reactive<{ keyword?: string; domain?: string; page: number; size: number }>({ page: 1, size: 20 });
const { data, pending, refresh } = await usePublished<unknown>("public-glossary-list", "glossary", request);
const response = computed(() => resourceRecord(data.value?.value));
const entries = computed(() => resourceItems(data.value?.value).filter((item) => resourcePublished(item, "glossary")).filter(resourceSlug));
const total = computed(() => typeof response.value.total === "number" && Number.isFinite(response.value.total) ? response.value.total : null);
const hasNext = computed(() => total.value !== null ? request.page * request.size < total.value : resourceItems(data.value?.value).length === request.size);
const domains = computed(() => [...new Set(entries.value.map((item) => resourceField(item, "domain", "category")).filter(Boolean))]);
const visible = computed(() => entries.value.filter((item) =>
  (!domain.value || resourceField(item, "domain", "category") === domain.value) &&
  (!keyword.value.trim() || [resourceField(item, "title", "name"), resourceField(item, "summary", "definition")].join(" ").toLowerCase().includes(keyword.value.trim().toLowerCase()))
));

async function search() {
  request.page = 1;
  request.keyword = keyword.value.trim() || undefined;
  request.domain = domain.value || undefined;
  await refresh();
}
async function turnPage(next: number) {
  if (next < 1 || (next > request.page && !hasNext.value)) return;
  request.page = next;
  await refresh();
}

useSeoMeta({
  title: "数学词条百科",
  description: "沿着概念的起源、现实原型、能力地图与抽象阶梯，发现数学知识之间的连接。"
});
</script>

<template>
  <ResourceShell eyebrow="GLOSSARY · 数学词条" title="从一个概念，接到下一个问题" intro="先读已审核的概念四卡，再沿知识关系继续探索。每一条内容都来自公开发布版本。">
    <form class="resource-search" role="search" @submit.prevent="search">
      <label class="sr-only" for="glossary-search">搜索数学词条</label>
      <input id="glossary-search" v-model="keyword" type="search" placeholder="搜索词条或定义" autocomplete="off">
      <button type="submit">搜索词条</button>
    </form>
    <div v-if="domains.length || domain" class="domain-list" aria-label="领域筛选">
      <button type="button" :aria-pressed="!domain" @click="domain = ''; search()">全部领域</button>
      <button v-for="item in domains" :key="item" type="button" :aria-pressed="domain === item" @click="domain = item; search()">{{ item }}</button>
    </div>
    <p v-if="pending" class="resource-note" role="status">正在读取已发布词条…</p>
    <div v-else-if="visible.length" class="resource-grid">
      <ResourceCard v-for="item in visible" :key="resourceSlug(item)" :to="'/glossary/' + resourceSlug(item)"
        :eyebrow="resourceField(item, 'domain', 'category') || '概念四卡'"
        :title="resourceField(item, 'title', 'name') || resourceSlug(item)"
        :summary="resourceField(item, 'originSummary', 'summary', 'definition')"
        detail="起源 · 现实原型 · 能力地图 · 抽象阶梯" />
    </div>
    <ResourceEmpty v-else :title="data?.available ? '没有找到已发布词条' : '词条暂时无法读取'"
      :message="data?.available ? '请换个关键词，或稍后查看新发布的内容。' : '公开内容服务暂不可用；页面没有填入未经审核的示例内容。'"
      retry @retry="refresh()" />
    <nav v-if="data?.available && (request.page > 1 || hasNext)" class="resource-pagination" aria-label="词条分页">
      <button type="button" :disabled="pending || request.page <= 1" @click="turnPage(request.page - 1)">上一页</button>
      <span>第 {{ request.page }} 页<span v-if="total !== null"> · 共 {{ total }} 条</span></span>
      <button type="button" :disabled="pending || !hasNext" @click="turnPage(request.page + 1)">下一页</button>
    </nav>
  </ResourceShell>
</template>

<style scoped>
.resource-search{display:flex;gap:10px;max-width:650px;padding:6px;border:1px solid var(--line);border-radius:15px;background:var(--card)}
.resource-search input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink);outline:none;padding:9px 12px}
.resource-search button{min-height:42px;border:0;border-radius:10px;background:var(--p);color:#fff;padding:9px 20px;font-weight:750}
.domain-list{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 34px}
.domain-list button{min-height:40px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ink2);padding:7px 16px}
.domain-list button[aria-pressed=true]{border-color:var(--p);background:var(--p-soft);color:var(--p-strong);font-weight:750}
.resource-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:28px}
.resource-note{color:var(--ink3)}
.resource-pagination{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:32px;color:var(--ink3);font-size:13px}
.resource-pagination button{min-height:42px;padding:8px 15px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink)}
.resource-pagination button:disabled{opacity:.5;cursor:not-allowed}
@media(max-width:850px){.resource-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:580px){.resource-grid{grid-template-columns:1fr}.resource-search button{padding-inline:14px}}
</style>
