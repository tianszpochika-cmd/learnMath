<script setup lang="ts">
const route = useRoute();
const slug = String(route.params.slug || "");
if (!/^[a-zA-Z0-9-]{1,100}$/.test(slug)) throw createError({ statusCode: 404, statusMessage: "帮助文章不存在" });
definePageMeta({ key: (route) => route.fullPath });
</script>
<template>
  <ArticleDetail :slug="slug" :type="6" base="/help" eyebrow="HELP · 帮助中心" fallback-title="帮助中心">
    <template #after><p class="help-footer">还没解决？<NuxtLink to="/contact">整理问题并查看联系渠道 →</NuxtLink></p></template>
  </ArticleDetail>
</template>
<style scoped>.help-footer{margin-top:42px;padding:20px;border-top:1px solid var(--line);color:var(--ink2)}.help-footer a{color:var(--p-strong);font-weight:800}</style>
