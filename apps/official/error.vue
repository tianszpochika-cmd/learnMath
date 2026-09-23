<script setup lang="ts">
defineProps<{ error: { statusCode?: number; message?: string } }>();
useSeoMeta({ title: "页面暂时不可用", description: "这个页面暂时无法访问。可以返回首页或搜索其他公开资源。", robots: "noindex,follow" });
</script>

<template>
  <div class="site-shell">
    <SiteHeader />
    <main id="main-content" class="container error-page">
      <p class="eyebrow">数源 · 页面提示</p>
      <h1>{{ error.statusCode === 404 ? "还没有找到这一页。" : "这一页暂时无法打开。" }}</h1>
      <p>可以从首页重新探索，也可以搜索公式、词条与学习路径。</p>
      <div class="action-row">
        <NuxtLink class="button primary" to="/">返回首页</NuxtLink>
        <NuxtLink class="button subtle" to="/search">搜索公开内容</NuxtLink>
      </div>
    </main>
    <SiteFooter />
  </div>
</template>
