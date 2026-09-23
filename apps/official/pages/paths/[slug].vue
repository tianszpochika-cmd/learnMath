<script setup lang="ts">
import { findEntry, paths } from "../../utils/siteContent";
const route = useRoute();
const entry = computed(() => findEntry(paths, String(route.params.slug || "")));
if (!entry.value) throw createError({ statusCode: 404, statusMessage: "这条路径不存在" });
useSeoMeta({
  title: () => entry.value?.title || "学习路径",
  description: () => entry.value?.summary || "",
  ogTitle: () => entry.value?.title + " · 数源 MathOrigin"
});
const related = computed(() => paths.filter((item) => item.slug !== entry.value?.slug).slice(0, 3));
</script>

<template>
  <div v-if="entry" :style="{ '--path-accent': entry.accent }">
    <header class="page-hero path-detail-hero"><div class="container"><NuxtLink class="text-link" to="/paths">← 六条路径</NuxtLink><p class="eyebrow" style="margin-top:25px">{{ entry.eyebrow }}</p><h1>{{ entry.title }}</h1><p class="lead">{{ entry.summary }}</p><div class="action-row" style="margin-top:25px"><LearningCta :label="'从' + entry.title + '开始'" :from="'official/paths/' + entry.slug" target-type="path" :slug="entry.slug" action="start" /><NuxtLink class="button subtle" to="/features">先了解学习工具</NuxtLink></div></div></header>
    <section class="section"><div class="container content-layout"><div class="prose"><p class="eyebrow">WHY THIS PATH</p><h2>当你需要一种清楚的起步方式。</h2><p>{{ entry.summary }} 这条路径会把“接下来做什么”与“为什么做”放在一起，让每一次练习有具体目标。</p><h2>适合谁？</h2><p>{{ entry.suitable }}。你也可以从另一条路径回来，同一知识点不会被分成互不相通的进度。</p><h2>怎样开始？</h2><ol><li v-for="step in entry.steps" :key="step">{{ step }}</li></ol><h2>规则先讲明白。</h2><p>{{ entry.boundary }}</p></div><aside class="card aside-card"><span class="card-kicker">AT A GLANCE</span><h3>{{ entry.title }}</h3><ul class="mini-list"><li v-for="(step, index) in entry.steps" :key="step">0{{ index + 1 }} · {{ step }}</li></ul><LearningCta :from="'official/paths/' + entry.slug" target-type="path" :slug="entry.slug" action="start" label="进入这条路径" style="margin-top:17px" /></aside></div></section>
    <section class="section alt"><div class="container"><div class="section-heading"><p class="eyebrow">ANOTHER ROUTE</p><h2>想换一种走法？</h2></div><div class="card-grid"><NuxtLink v-for="item in related" :key="item.slug" class="card path-card" :style="{ '--accent': item.accent }" :to="'/paths/' + item.slug"><span class="card-kicker">{{ item.eyebrow }}</span><h3>{{ item.title }}</h3><p>{{ item.summary }}</p><span class="card-link">了解路径 →</span></NuxtLink></div></div></section>
  </div>
</template>

<style scoped>
.path-detail-hero{border-left:6px solid var(--path-accent);background:var(--alt)}
.path-detail-hero h1{margin-top:0}
</style>
