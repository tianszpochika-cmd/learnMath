<script setup lang="ts">
const route = useRoute();
const category = String(route.params.cat || "");
if (!/^[\p{L}\p{N} _-]{1,80}$/u.test(category)) {
  throw createError({ statusCode: 404, statusMessage: "博客分类不存在" });
}
definePageMeta({ key: (route) => route.fullPath });
</script>
<template>
  <ArticleFeed :type="1" base="/blog" eyebrow="BLOG · 分类" :title="category || '博客分类'"
    intro="在已发布文章中按分类阅读。" :category="category" />
</template>
