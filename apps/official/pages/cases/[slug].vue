<script setup lang="ts">
const route = useRoute();
const slug = String(route.params.slug || "");
if (!/^[a-zA-Z0-9-]{1,100}$/.test(slug)) throw createError({ statusCode: 404, statusMessage: "案例不存在" });
definePageMeta({ key: (route) => route.fullPath });
</script>
<template>
  <ArticleDetail :slug="slug" :type="5" base="/cases" eyebrow="CASES · 学习案例" fallback-title="学习案例" />
</template>
