<script setup lang="ts">
import { features, findEntry } from "../../utils/siteContent";
const route = useRoute();
const entry = computed(() => findEntry(features, String(route.params.slug || "")));
if (!entry.value) throw createError({ statusCode: 404, statusMessage: "功能详情不存在" });
useSeoMeta({
  title: () => entry.value?.title || "功能详情",
  description: () => entry.value?.summary || "",
  ogTitle: () => entry.value?.title + " · 数源 MathOrigin"
});
const related = computed(() => features.filter((item) => item.slug !== entry.value?.slug).slice(0, 3));
</script>

<template>
  <div v-if="entry">
    <header class="page-hero container"><NuxtLink class="text-link" to="/features">← 功能总览</NuxtLink><p class="eyebrow" style="margin-top:25px">{{ entry.eyebrow }}</p><h1>{{ entry.title }}</h1><p class="lead">{{ entry.summary }}</p><div class="action-row" style="margin-top:25px"><LearningCta :from="'official/features/' + entry.slug" label="在学习端体验" /><NuxtLink class="button subtle" to="/paths">找到适合的路径</NuxtLink></div></header>
    <section class="section alt"><div class="container split-section"><div><p class="eyebrow">THE PROBLEM</p><h2>让一个问题，不再只剩“对”与“错”。</h2><p class="lead">{{ entry.suitable }}。数源把相关内容放回学习发生的地方，帮助你看懂这一步为什么成立，以及可以从哪里补。</p></div><div class="card"><span class="card-kicker">界面结构示意</span><div v-for="(step, index) in entry.steps" :key="step" class="reason-step"><span class="step-number">0{{ index + 1 }}</span>{{ step }}</div><p style="color:var(--ink3);font-size:12px">这里展示流程结构；真实内容须以已发布快照和当前权限为准。</p></div></div></section>
    <section class="section"><div class="container content-layout"><article class="prose"><p class="eyebrow">HOW IT WORKS</p><h2>三步，把思路接起来。</h2><ol><li v-for="step in entry.steps" :key="step">{{ step }}</li></ol><h2>这个功能有什么边界？</h2><p>{{ entry.boundary }}</p><p>当资源未发布或服务暂不可用时，界面会说明当前状态；不会用演示内容冒充你的成绩、掌握度或反馈。</p><h2>什么时候适合用？</h2><p>{{ entry.suitable }}。你也可以先阅读公开的词条与公式，再进入学习端继续。</p></article><aside class="card aside-card"><h3>相关公开入口</h3><ul class="mini-list"><li><NuxtLink to="/glossary">概念四卡 →</NuxtLink></li><li><NuxtLink to="/formulas">公式馆 →</NuxtLink></li><li><NuxtLink to="/daily">每日一题 →</NuxtLink></li></ul></aside></div></section>
    <section class="section alt"><div class="container"><div class="section-heading"><p class="eyebrow">EXPLORE MORE</p><h2>把另一块拼图也接上。</h2></div><div class="card-grid"><NuxtLink v-for="item in related" :key="item.slug" class="card path-card" :style="{ '--accent': item.accent }" :to="'/features/' + item.slug"><span class="card-kicker">{{ item.eyebrow }}</span><h3>{{ item.title }}</h3><p>{{ item.summary }}</p><span class="card-link">了解功能 →</span></NuxtLink></div></div></section>
  </div>
</template>
