<script setup lang="ts">
import { paths } from "../../utils/siteContent";
useSeoMeta({ title: "六条学习路径", description: "系统课程、知识图谱、学习计划、阶梯刷题、专题探索与闯关挑战，六条路径连接同一个数学知识体系。" });
</script>

<template>
  <div>
    <header class="page-hero container"><p class="eyebrow">SIX WAYS THROUGH MATH</p><h1>六条路径，同一个理解的目标。</h1><p class="lead">有时适合按课程稳步走，有时需要看清知识之间的连接。选一种当下顺手的方式，之后还可以改变。</p></header>
    <section class="section alt"><div class="container card-grid"><NuxtLink v-for="entry in paths" :key="entry.slug" :to="'/paths/' + entry.slug" class="card path-card" :style="{ '--accent': entry.accent }"><span class="card-kicker">{{ entry.eyebrow }}</span><h2 style="font-size:27px">{{ entry.title }}</h2><p>{{ entry.summary }}</p><span class="card-link">探索路径 →</span></NuxtLink></div></section>
    <section class="section"><div class="container split-section"><div><p class="eyebrow">CONNECTED, NOT SEPARATE</p><h2>不必选对“唯一”的路。</h2><p class="lead">路径共享课程、知识点、题目和公式。你可以从一题深入推理，也可以回到前置概念；进度和能力判断需要真实作答证据。</p></div><div class="card"><h3>从哪里开始？</h3><p>先看看一种路径怎样安排学习。想保存进度时，再进入学习端。</p><div class="action-row" style="margin-top:20px"><LearningCta label="进入学习端" from="official/paths" /><NuxtLink class="button subtle" to="/features">看核心功能</NuxtLink></div></div></div></section>
  </div>
</template>
