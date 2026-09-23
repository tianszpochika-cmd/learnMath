<script setup lang="ts">
const route = useRoute();
const tag = String(route.params.tag || "");
if (!/^[\p{L}\p{N} _-]{1,80}$/u.test(tag)) {
  throw createError({ statusCode: 404, statusMessage: "博客标签不存在" });
}
definePageMeta({ key: (route) => route.fullPath });
</script>
<template>
  <ArticleFeed :type="1" base="/blog" eyebrow="BLOG · 标签" :title="tag ? '# ' + tag : '文章标签'"
    intro="在已发布文章中按标签阅读。" :tag="tag" />
</template>
