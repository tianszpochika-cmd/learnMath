<script setup lang="ts">
useSeoMeta({
  title: "公开路线图",
  description: "数源公开路线图的阶段框架。具体事项和日期只在经过确认并发布后展示。"
});
const stages = [
  { title: "进行中", note: "经确认正在推进的事项", symbol: "↗" },
  { title: "计划中", note: "已列入公开计划的事项", symbol: "◇" },
  { title: "探索中", note: "仍在研究与验证的方向", symbol: "···" }
];
</script>
<template>
  <ResourceShell eyebrow="ROADMAP · 公开路线图" title="方向可以公开，承诺需要证据。"
    intro="以下是路线图的阶段框架。项目条目与日期需经过产品发布确认后展示；目前不把设计稿任务当成已启动或已交付的功能。">
    <div class="roadmap-grid">
      <section v-for="stage in stages" :key="stage.title" class="roadmap-col">
        <div class="stage-head"><span aria-hidden="true">{{ stage.symbol }}</span><h2>{{ stage.title }}</h2></div>
        <p>{{ stage.note }}</p>
        <div class="stage-empty">暂无公开确认的事项</div>
      </section>
    </div>
    <div class="roadmap-note">
      <strong>如何判断已经交付？</strong>
      <p>以上阶段不代表功能已经开放。实际发布范围会在更新日志中记录；内容是否可用还受审核、题池覆盖和服务状态约束。</p>
      <div class="roadmap-links"><NuxtLink to="/changelog">查看更新日志 →</NuxtLink><NuxtLink to="/contact">整理反馈 →</NuxtLink></div>
    </div>
  </ResourceShell>
</template>
<style scoped>
.roadmap-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px}
.roadmap-col{min-height:310px;padding:24px;border:1px solid var(--line);border-radius:19px;background:var(--card)}
.stage-head{display:flex;align-items:center;gap:10px}.stage-head span{display:grid;place-items:center;width:39px;height:39px;border-radius:12px;background:var(--p-soft);color:var(--p-strong);font-weight:900}.stage-head h2{margin:0;font-size:25px}
.roadmap-col>p{margin:15px 0 24px;color:var(--ink3);font-size:14px}
.stage-empty{padding:20px;border:1px dashed var(--line);border-radius:12px;color:var(--ink3);font-size:13px}
.roadmap-note{margin-top:45px;max-width:800px;padding:25px;border-left:4px solid var(--p);background:var(--p-soft);border-radius:0 15px 15px 0}
.roadmap-note strong{font-size:17px}.roadmap-note p{color:var(--ink2)}.roadmap-note a{color:var(--p-strong);font-weight:800}
.roadmap-links{display:flex;flex-wrap:wrap;gap:18px}
@media(max-width:850px){.roadmap-grid{grid-template-columns:1fr}.roadmap-col{min-height:0}}
</style>
