<script setup lang="ts">
const route = useRoute();
const slug = String(route.params.slug || "");
if (!/^[a-zA-Z0-9-]{1,100}$/.test(slug)) throw createError({ statusCode: 404, statusMessage: "文章不存在" });
definePageMeta({ key: (route) => route.fullPath });
</script>
<template>
  <ArticleDetail :slug="slug" :type="1" base="/blog" eyebrow="BLOG · 数学与世界" fallback-title="博客" />
</template>
