<script setup lang="ts">
useSeoMeta({
  title: "服务状态",
  description: "数源服务状态页面。实时监测数据未接入时会明确标示未知，不展示虚构的健康状态或可用率。",
  robots: "noindex,follow"
});
const services = [
  { name: "官网", detail: "页面是否可访问不等于全站服务健康" },
  { name: "学习接口", detail: "作答、登录与内容接口需要独立监测" },
  { name: "移动端", detail: "不同平台的版本与服务需分别核实" }
];
</script>
<template>
  <ResourceShell eyebrow="STATUS · 服务状态" title="状态未知时，就如实说未知。"
    intro="此页目前没有接入实时健康监测或历史事件接口。页面能够打开，只说明你正在阅读官网，不能证明学习服务均正常。">
    <div class="status-notice" role="status"><span aria-hidden="true">●</span><div><strong>实时监测尚未接入</strong><p>暂不提供“一切正常”、90 天可用率或故障恢复时间的估计。</p></div></div>
    <div class="service-grid">
      <article v-for="service in services" :key="service.name" class="service-card">
        <div class="service-top"><h2>{{ service.name }}</h2><span>未验证</span></div>
        <p>{{ service.detail }}</p>
      </article>
    </div>
    <section class="history"><h2>历史事件</h2><p>暂无可核实的公开事件记录。接入监测和事件发布后，才会在此展示时间线。</p></section>
  </ResourceShell>
</template>
<style scoped>
.status-notice{display:flex;gap:15px;align-items:flex-start;padding:22px;border:1px solid #dfc99a;border-radius:15px;background:#fff9ed;color:#684d19}
:root[data-theme=dark] .status-notice{background:#352b19;color:#f6dfa8}
.status-notice>span{font-size:19px}.status-notice strong{font-size:18px}.status-notice p{margin:5px 0 0;font-size:14px}
.service-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;margin-top:30px}
.service-card{padding:22px;border:1px solid var(--line);border-radius:17px;background:var(--card)}
.service-top{display:flex;align-items:center;justify-content:space-between;gap:9px}.service-top h2{margin:0;font-size:23px}.service-top span{padding:5px 9px;border-radius:99px;background:var(--alt);color:var(--ink3);font-size:11px;font-weight:800}
.service-card p,.history p{color:var(--ink3);font-size:14px}
.history{margin-top:52px;padding-top:20px;border-top:1px solid var(--line)}
@media(max-width:740px){.service-grid{grid-template-columns:1fr}}
</style>
