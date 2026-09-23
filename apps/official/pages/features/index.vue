<script setup lang="ts">
import { features } from "../../utils/siteContent";
useSeoMeta({ title: "功能与学习方式", description: "一题五玩、知识图谱、公式馆、错题复盘与 AI 导师，了解数源如何帮助你讲清楚每一步。" });
</script>

<template>
  <div>
    <header class="page-hero container"><p class="eyebrow">HOW MATHORIGIN WORKS</p><h1>不止告诉你答案，更陪你走完整条思路。</h1><p class="lead">以下功能围绕同一个问题：学到哪里，为什么卡住，下一步怎样继续。</p></header>
    <section class="section alt"><div class="container card-grid"><NuxtLink v-for="entry in features" :key="entry.slug" :to="'/features/' + entry.slug" class="card path-card" :style="{ '--accent': entry.accent }"><span class="card-kicker">{{ entry.eyebrow }}</span><h2 style="font-size:26px">{{ entry.title }}</h2><p>{{ entry.summary }}</p><span class="card-link">查看使用方式 →</span></NuxtLink></div></section>
    <section class="section"><div class="container split-section"><div><p class="eyebrow">ONE CONNECTED JOURNEY</p><h2>让功能回到真实任务里。</h2><p class="lead">当你在一道题的第二步停下，可以看对应概念、核对公式条件，再用已发布练习检验理解。功能入口始终受课程进度、内容发布和考试规则约束。</p></div><div class="card"><h3>从一条路径开始</h3><p>先选你此刻最想解决的问题，再进入学习端保存自己的学习过程。</p><div class="action-row" style="margin-top:18px"><NuxtLink class="button primary" to="/paths">探索六条路径</NuxtLink><LearningCta from="official/features" label="进入学习端" subtle /></div></div></div></section>
  </div>
</template>
