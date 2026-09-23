<script setup lang="ts">
useSeoMeta({
  title: "产品更新日志",
  description: "数源产品更新记录。只有经过发布确认的版本与变更会列在这里。"
});
</script>
<template>
  <ResourceShell eyebrow="CHANGELOG · 产品更新" title="每一次变化，都应说清缘由。"
    intro="这里用于发布真实的版本更新记录。现有公开文章类型没有独立的更新日志分类，普通公告不会被自动当成版本记录。">
    <div class="timeline-head"><span>版本</span><span>变化</span><span>日期</span></div>
    <ResourceEmpty title="暂无已发布的版本记录"
      message="版本号、上线日期和功能范围需经实际发布确认后写入。当前不展示示例版本。" />
    <div class="more-links"><NuxtLink to="/roadmap">查看公开路线图 →</NuxtLink><NuxtLink to="/contact">整理反馈 →</NuxtLink></div>
  </ResourceShell>
</template>
<style scoped>
.timeline-head{display:grid;grid-template-columns:1fr 2fr 1fr;gap:15px;max-width:720px;padding:12px 20px;margin-bottom:18px;border-bottom:2px solid var(--ink);color:var(--ink3);font-size:12px;font-weight:800}
.more-links{display:flex;flex-wrap:wrap;gap:20px;margin-top:30px;color:var(--p-strong);font-size:14px;font-weight:800}
</style>
