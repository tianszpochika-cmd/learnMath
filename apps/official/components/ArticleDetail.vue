<script setup lang="ts">
import { articleBlocks, articlePublished, articleSlug, articleTags, articleType } from "./ArticleData";
import { resourceField, resourceRecord } from "./ResourceData";
import { jsonLd } from "../utils/jsonLd";
import { canonicalOrigin, canonicalUrl } from "../utils/seo";

const props = defineProps<{ slug: string; type: number; base: string; eyebrow: string; fallbackTitle: string }>();
const { data, pending, refresh } = await usePublished<unknown>("article-" + props.type + "-" + props.slug, "articles/" + props.slug);
const article = computed(() => resourceRecord(data.value?.value));
const present = computed(() => Boolean(data.value?.available && articlePublished(article.value) && articleType(article.value) === props.type && resourceField(article.value, "title")));
const title = computed(() => present.value ? resourceField(article.value, "title") : props.fallbackTitle);
const blocks = computed(() => articleBlocks(article.value));
const headings = computed(() => blocks.value.map((block, index) => ({ ...block, index })).filter((block) => block.kind === "heading"));
const tags = computed(() => articleTags(article.value));
const publishedAt = computed(() => resourceField(article.value, "publishedAt", "published_at"));
const siteOrigin = canonicalOrigin(useRuntimeConfig().public.siteUrl);
useSeoMeta({
  title: computed(() => present.value ? resourceField(article.value, "seoTitle", "seo_title", "title") : props.fallbackTitle + "暂不可用"),
  description: computed(() => present.value ? resourceField(article.value, "seoDescription", "seo_description", "summary").slice(0, 155) : "这篇内容尚无可展示的已发布版本。"),
  ogTitle: computed(() => present.value ? resourceField(article.value, "title") + " · 数源 MathOrigin" : props.fallbackTitle + "暂不可用"),
  ogDescription: computed(() => present.value ? resourceField(article.value, "summary").slice(0, 155) : "这篇内容尚无可展示的已发布版本。"),
  robots: computed(() => present.value ? "index,follow" : "noindex,follow")
});
useHead(() => ({ script: present.value && siteOrigin ? [{ type: "application/ld+json", innerHTML: jsonLd({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: resourceField(article.value, "title"),
  description: resourceField(article.value, "summary"),
  mainEntityOfPage: canonicalUrl(siteOrigin, props.base + "/" + props.slug),
  ...(publishedAt.value ? { datePublished: publishedAt.value } : {})
}) }] : [] }));
</script>

<template>
  <ResourceShell :eyebrow="eyebrow" :title="title" :intro="present ? resourceField(article, 'summary') : '当前内容尚无可展示的已发布版本。'"
    :parent="fallbackTitle" :parent-to="base">
    <p v-if="pending" role="status">正在读取文章…</p>
    <ResourceEmpty v-else-if="!present" title="内容尚未发布或暂不可用"
      message="公开页面只展示已发布版本。请返回列表查看其他内容。" retry @retry="refresh()" />
    <template v-else>
      <div class="article-topline">
        <span v-if="publishedAt">发布于 {{ publishedAt.slice(0, 10) }}</span>
        <span v-if="resourceField(article, 'legalVersion', 'legal_version')">版本 {{ resourceField(article, 'legalVersion', 'legal_version') }}</span>
        <span v-if="resourceField(article, 'category')">{{ resourceField(article, 'category') }}</span>
      </div>
      <div v-if="blocks.length" class="article-layout">
        <article class="article-copy">
          <template v-for="(block, index) in blocks" :key="index">
            <h2 v-if="block.kind === 'heading'" :id="'article-section-' + index">{{ block.text }}</h2>
            <p v-else :class="{ listline: block.kind === 'list' }">{{ block.text }}</p>
          </template>
        </article>
        <aside class="article-aside">
          <nav v-if="headings.length" class="article-toc" aria-label="文章目录">
            <strong>本文目录</strong>
            <a v-for="heading in headings" :key="heading.index" :href="'#article-section-' + heading.index">{{ heading.text }}</a>
          </nav>
          <strong>继续探索</strong>
          <p>这篇内容来自公开发布版本。学习记录和报名需进入学习端确认。</p>
          <NuxtLink :to="base">返回{{ fallbackTitle }}列表 →</NuxtLink>
          <div v-if="tags.length && base === '/blog'" class="tags">
            <NuxtLink v-for="tag in tags" :key="tag" :to="base + '/tags/' + encodeURIComponent(tag)"># {{ tag }}</NuxtLink>
          </div>
        </aside>
      </div>
      <div v-else class="article-copy"><p>这篇已发布内容暂未提供正文。</p></div>
      <slot name="after" :article="article" :present="present" :slug="articleSlug(article) || slug" />
    </template>
  </ResourceShell>
</template>

<style scoped>
.article-topline{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:28px;color:var(--ink3);font-size:13px}
.article-layout{display:grid;grid-template-columns:minmax(0,760px) 255px;justify-content:space-between;gap:60px}
.article-copy{max-width:760px;color:var(--ink2);font-size:16px;line-height:1.95}
.article-copy h2{margin:37px 0 15px;color:var(--ink);font-size:clamp(25px,3vw,34px)}
.article-copy h2[id]{scroll-margin-top:100px}
.article-copy p{white-space:pre-line;margin:0 0 22px}
.article-copy .listline{padding-left:10px;border-left:2px solid var(--p-soft)}
.article-aside{position:sticky;top:105px;align-self:start;padding:21px;border:1px solid var(--line);border-radius:16px;background:var(--card);color:var(--ink3);font-size:13px}
.article-aside strong{display:block;color:var(--ink);font-size:16px}
.article-aside p{line-height:1.65}
.article-aside>a{color:var(--p-strong);font-weight:800}
.article-toc{display:grid;gap:9px;padding-bottom:20px;margin-bottom:18px;border-bottom:1px solid var(--line)}
.article-toc a{color:var(--ink2);line-height:1.45}
.article-toc a:hover{color:var(--p-strong)}
.tags{display:flex;flex-wrap:wrap;gap:7px;margin-top:19px}
.tags a{border:1px solid var(--line);border-radius:99px;padding:5px 9px}
@media(max-width:850px){.article-layout{grid-template-columns:1fr}.article-aside{position:static}}
</style>
