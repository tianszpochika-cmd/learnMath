<script setup lang="ts">
useSeoMeta({
  title: "学习社区",
  description: "数源学习社区的公开预览。精选问答只有在审核通过且公开接口可用时展示。"
});
</script>
<template>
  <ResourceShell eyebrow="COMMUNITY · 一起讨论" title="把“为什么”问出来。"
    intro="社区中的优质问答应经过审核后公开展示。当前官网尚无精选问答公开接口，因此不会用编造的帖子或人数填充卡片。">
    <div class="community-layout">
      <div class="community-main">
        <div class="community-empty"><span aria-hidden="true">?</span><h2>公开精选问答暂未开放</h2><p>待审核内容和仅登录可见的讨论不会被复制到官网。你可以先读公开词条与文章，再到学习端查看实际社区入口。</p></div>
      </div>
      <aside class="community-side"><p class="eyebrow">HOW TO ASK</p><h2>一个好问题，从自己的思路开始。</h2><ol><li>写下题目与已尝试的步骤</li><li>说明卡住的位置和理由</li><li>讨论解法，不提前索取受限作答答案</li></ol><LearningCta from="official/community-preview" label="进入学习端" /></aside>
    </div>
    <NuxtLink class="community-link" to="/glossary">先探索数学词条 →</NuxtLink>
  </ResourceShell>
</template>
<style scoped>
.community-layout{display:grid;grid-template-columns:1.35fr .65fr;gap:22px}
.community-empty{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;min-height:360px;padding:35px;border:1px dashed var(--line);border-radius:20px;background:var(--card)}
.community-empty>span{display:grid;place-items:center;width:50px;height:50px;border-radius:15px;background:var(--p-soft);color:var(--p);font:700 28px var(--serif)}
.community-empty h2{margin:23px 0 9px}.community-empty p{max-width:550px;color:var(--ink3)}
.community-side{padding:30px;border-radius:20px;background:var(--p-soft)}
.community-side h2{font-size:28px}.community-side ol{padding-left:20px;color:var(--ink2);line-height:2}
.community-link{display:inline-block;margin-top:30px;color:var(--p-strong);font-weight:800}
@media(max-width:850px){.community-layout{grid-template-columns:1fr}}
</style>
