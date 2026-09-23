<script setup lang="ts">
import { articleBlocks, articlePublished } from "~/components/ArticleData";
import { resourceField, resourceRecord } from "~/components/ResourceData";

const route = useRoute();
const legalType = String(route.params.type || "");
if (!["privacy", "terms"].includes(legalType)) throw createError({ statusCode: 404, statusMessage: "协议页面不存在" });
definePageMeta({ key: (route) => route.fullPath });
const label = legalType === "privacy" ? "隐私政策" : "用户协议";
const { data, pending, refresh } = await usePublished<unknown>("legal-" + legalType, "legal/" + legalType);
const article = computed(() => {
  const payload = resourceRecord(data.value?.value);
  return resourceRecord(payload.article ?? payload.latest ?? payload);
});
const present = computed(() => Boolean(data.value?.available && articlePublished(article.value) && resourceField(article.value, "content", "body")));
const blocks = computed(() => articleBlocks(article.value));
useSeoMeta({
  title: computed(() => present.value ? resourceField(article.value, "title") || label : label + "暂不可用"),
  description: computed(() => present.value ? resourceField(article.value, "summary", "seoDescription", "seo_description") : "当前没有可展示的已发布协议版本。"),
  robots: computed(() => present.value ? "index,follow" : "noindex,follow")
});
</script>

<template>
  <ResourceShell eyebrow="LEGAL · 合规文件" :title="label"
    :intro="present ? '以下为当前公开可读取的已发布版本；同意记录和后续版本以服务端为准。' : '当前无法读取已发布协议正文。'">
    <p v-if="pending" role="status">正在读取已发布协议…</p>
    <ResourceEmpty v-else-if="!present" title="协议正文暂不可用"
      message="协议不能用占位文案替代。请稍后重试；在正式协议可阅读前，不应继续新的协议确认操作。"
      retry @retry="refresh()" />
    <template v-else>
      <div class="legal-meta">
        <span v-if="resourceField(article, 'legalVersion', 'legal_version', 'version')">版本：{{ resourceField(article, "legalVersion", "legal_version", "version") }}</span>
        <span v-if="resourceField(article, 'publishedAt', 'published_at', 'effectiveAt')">发布日期：{{ resourceField(article, "publishedAt", "published_at", "effectiveAt").slice(0, 10) }}</span>
      </div>
      <article class="legal-copy">
        <template v-for="(block, index) in blocks" :key="index">
          <h2 v-if="block.kind === 'heading'">{{ block.text }}</h2>
          <p v-else>{{ block.text }}</p>
        </template>
      </article>
      <NuxtLink class="legal-other" :to="legalType === 'privacy' ? '/legal/terms' : '/legal/privacy'">
        阅读{{ legalType === "privacy" ? "用户协议" : "隐私政策" }} →
      </NuxtLink>
    </template>
  </ResourceShell>
</template>

<style scoped>
.legal-meta{display:flex;flex-wrap:wrap;gap:18px;margin-bottom:28px;color:var(--ink3);font-size:13px}
.legal-copy{max-width:820px;color:var(--ink2);line-height:1.95}
.legal-copy h2{margin:35px 0 14px;color:var(--ink);font-size:clamp(24px,3vw,32px)}
.legal-copy p{white-space:pre-line;margin:0 0 20px}
.legal-other{display:inline-block;margin-top:30px;color:var(--p-strong);font-weight:800}
</style>
