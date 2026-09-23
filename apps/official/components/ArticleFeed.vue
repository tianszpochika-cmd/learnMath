<script setup lang="ts">
import { articleSlug, articleTags, publishedArticles } from "./ArticleData";
import { collectArticlePages, parseArticlePage, type ArticleCollection, type ArticlePage } from "./ArticlePagination";
import { resourceField } from "./ResourceData";

const props = defineProps<{
  type: number;
  base: string;
  eyebrow: string;
  title: string;
  intro: string;
  category?: string;
  tag?: string;
}>();

const query = ref("");
const pageSize = 100;
const maxTaxonomyPages = 20;
const scanTaxonomy = Boolean(props.category || props.tag);
const added = ref<ArticlePage[]>([]);
const loadingMore = ref(false);
const loadError = ref("");
const paginationStalled = ref(false);

async function fetchPage(page: number): Promise<ArticlePage | null> {
  try {
    const response = await $fetch<unknown>("/api/public/articles", {
      query: { type: props.type, page, size: pageSize }, timeout: 4000
    });
    return parseArticlePage(response, page, pageSize);
  } catch { return null; }
}

const { data, pending, refresh } = await useAsyncData<ArticleCollection>(
  "articles-" + props.type + "-" + (props.category || "all") + "-" + (props.tag || "all"),
  async () => {
    if (scanTaxonomy) return collectArticlePages(fetchPage, maxTaxonomyPages);
    const first = await fetchPage(1);
    return first ? {
      items: first.items, available: true, hasMore: first.hasMore, incomplete: false,
      page: first.page, size: first.size, total: first.total
    } : {
      items: [], available: false, hasMore: false, incomplete: false,
      page: 0, size: pageSize, total: null
    };
  }
);
const all = computed(() => publishedArticles([
  ...(data.value?.items ?? []), ...added.value.flatMap((page) => page.items)
], props.type));
const hasMore = computed(() => !scanTaxonomy && !paginationStalled.value && (added.value.at(-1)?.hasMore ?? data.value?.hasMore ?? false));
const loadedCount = computed(() => (data.value?.items.length ?? 0) + added.value.reduce((sum, page) => sum + page.items.length, 0));
const categories = computed(() => [...new Set(all.value.map((item) => resourceField(item, "category")).filter(Boolean))]);
const shown = computed(() => all.value.filter((item) => {
  if (props.category && resourceField(item, "category") !== props.category) return false;
  if (props.tag && !articleTags(item).includes(props.tag)) return false;
  const needle = query.value.trim().toLocaleLowerCase();
  return !needle || [resourceField(item, "title"), resourceField(item, "summary"), resourceField(item, "category")].join(" ").toLocaleLowerCase().includes(needle);
}));

async function loadMore() {
  if (!hasMore.value || loadingMore.value) return;
  loadingMore.value = true;
  loadError.value = "";
  const pageNumber = (added.value.at(-1)?.page ?? data.value?.page ?? 0) + 1;
  const next = await fetchPage(pageNumber);
  if (!next) loadError.value = "后续文章暂时无法读取。已加载内容仍可阅读，请稍后重试。";
  else {
    const seen = new Set([...(data.value?.items ?? []), ...added.value.flatMap((page) => page.items)].map(articleSlug).filter(Boolean));
    const fresh = next.items.filter((item) => {
      const slug = articleSlug(item);
      if (!slug || seen.has(slug)) return false;
      seen.add(slug);
      return true;
    });
    if (next.hasMore && !fresh.length) {
      paginationStalled.value = true;
      loadError.value = "后续分页没有返回新文章，列表可能不完整。请稍后重试。";
    } else added.value = [...added.value, { ...next, items: fresh }];
  }
  loadingMore.value = false;
}

async function retry() {
  added.value = [];
  loadError.value = "";
  paginationStalled.value = false;
  await refresh();
}
useSeoMeta({ title: props.title, description: props.intro });
</script>

<template>
  <ResourceShell :eyebrow="eyebrow" :title="title" :intro="intro">
    <div class="feed-toolbar">
      <label class="feed-search">
        <span class="sr-only">筛选{{ title }}</span>
        <input v-model="query" type="search" :placeholder="'搜索' + title" autocomplete="off">
        <span aria-hidden="true">⌕</span>
      </label>
      <NuxtLink v-if="category || tag" :to="base">查看全部</NuxtLink>
    </div>
    <nav v-if="categories.length && !category && !tag && base === '/blog'" class="feed-categories" aria-label="文章分类">
      <NuxtLink v-for="item in categories" :key="item" :to="base + '/cat/' + encodeURIComponent(item)">{{ item }}</NuxtLink>
    </nav>
    <p v-if="data?.available && hasMore" class="feed-note">当前已加载 {{ loadedCount }}{{ data?.total != null ? ' / ' + data.total : '' }} 条；搜索和分类会随加载范围扩展。</p>
    <p v-if="data?.incomplete || paginationStalled" class="feed-note" role="status">文章数量超过本页可完整读取的范围，或后续页面暂时不可用。以下筛选结果可能不完整，请稍后重试。</p>
    <p v-if="pending" role="status" class="feed-note">正在读取已发布内容…</p>
    <div v-else-if="shown.length" class="feed-grid">
      <NuxtLink v-for="item in shown" :key="articleSlug(item)" class="feed-card" :to="base + '/' + articleSlug(item)">
        <span class="feed-symbol" aria-hidden="true">∑</span>
        <span class="feed-meta">{{ resourceField(item, "category") || eyebrow }} <span v-if="resourceField(item, 'publishedAt', 'published_at')">· {{ resourceField(item, "publishedAt", "published_at").slice(0, 10) }}</span></span>
        <strong>{{ resourceField(item, "title") }}</strong>
        <span class="feed-summary">{{ resourceField(item, "summary") }}</span>
        <span v-if="type === 8 && resourceField(item, 'startAt', 'startsAt', 'start_at')" class="feed-evidence">
          活动时间：{{ resourceField(item, "startAt", "startsAt", "start_at").slice(0, 16) }}
        </span>
        <span v-if="type === 5 && resourceField(item, 'outcome', 'resultSummary')" class="feed-evidence">
          案例结果：{{ resourceField(item, "outcome", "resultSummary") }}
        </span>
        <span class="feed-link">阅读全文 <span aria-hidden="true">↗</span></span>
      </NuxtLink>
    </div>
    <ResourceEmpty v-else :title="data?.available ? '当前范围没有符合条件的已发布内容' : '公开内容暂时无法读取'"
      :message="data?.available ? (hasMore || data?.incomplete ? '还有文章未完整读取，可以继续加载或稍后重试。' : '换个关键词或分类试试。页面不会展示工作稿和未审核内容。') : '内容接口暂不可用，请稍后重试。'"
      retry @retry="retry" />
    <div v-if="hasMore && !pending" class="feed-more">
      <button type="button" :disabled="loadingMore" @click="loadMore">{{ loadingMore ? '正在加载…' : '加载更多已发布内容' }}</button>
    </div>
    <p v-if="loadError" class="feed-note" role="alert">{{ loadError }}</p>
  </ResourceShell>
</template>

<style scoped>
.feed-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:22px}
.feed-toolbar>a{color:var(--p-strong);font-size:13px;font-weight:750}
.feed-search{display:flex;align-items:center;gap:10px;width:min(460px,100%);padding:0 15px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.feed-search input{width:100%;min-height:48px;border:0;outline:none;background:transparent;color:var(--ink)}
.feed-search span:last-child{font-size:23px;color:var(--ink3)}
.feed-categories{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:28px}
.feed-categories a{border:1px solid var(--line);border-radius:999px;padding:7px 14px;background:var(--card);font-size:13px}
.feed-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.feed-card{display:flex;flex-direction:column;align-items:flex-start;min-height:300px;padding:27px;border:1px solid var(--line);border-radius:20px;background:var(--card);box-shadow:var(--shadow)}
.feed-card:hover{border-color:var(--p)}
.feed-symbol{display:grid;place-items:center;width:43px;height:43px;border-radius:13px;background:var(--p-soft);color:var(--p);font:italic 27px Georgia,serif}
.feed-meta{margin-top:25px;color:var(--p-strong);font-size:11px;font-weight:800;letter-spacing:.05em}
.feed-card strong{margin-top:10px;font:700 23px/1.4 var(--serif)}
.feed-summary{margin-top:11px;color:var(--ink3);font-size:14px;line-height:1.65}
.feed-evidence{margin-top:11px;color:var(--ink2);font-size:12px;line-height:1.5}
.feed-link{margin-top:auto;padding-top:24px;color:var(--p-strong);font-size:13px;font-weight:800}
.feed-note{color:var(--ink3)}
.feed-more{display:grid;justify-items:center;gap:9px;margin-top:26px;color:var(--ink3);font-size:13px}
.feed-more button{min-height:45px;padding:9px 22px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--p-strong);font-weight:800}
.feed-more button:disabled{opacity:.6}
.feed-more p{margin:0}
@media(max-width:880px){.feed-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.feed-grid{grid-template-columns:1fr}.feed-card{min-height:240px}}
</style>
