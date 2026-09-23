<script setup lang="ts">
useSeoMeta({
  title: "学习入口与下载",
  description: "选择数源网页学习端。移动安装包与小程序入口只有在正式发布后才会提供下载。"
});
const pendingChannels = [
  { symbol: "H5", title: "手机网页", detail: "独立 H5 地址尚未发布；如需使用手机，可以先查看网页学习端。" },
  { symbol: "▦", title: "小程序", detail: "没有已核实的小程序码或商店入口，暂不展示二维码。" },
  { symbol: "↓", title: "应用安装包", detail: "正式安装包、版本号与校验信息尚未发布，暂不提供下载。" }
];
</script>
<template>
  <ResourceShell eyebrow="DOWNLOAD · 学习入口" title="在合适的屏幕上，继续思考。"
    intro="已配置的网页学习端可从这里进入。没有经过发布核对的二维码、安装包与版本号不会显示成可下载资源。">
    <section class="web-entry"><div><p class="eyebrow">WEB LEARNING</p><h2>网页学习端</h2><p>沿课程、图谱与练习继续学习。进入后的身份、内容权限和学习结果由学习端处理。</p></div><LearningCta from="official/download" label="打开网页学习端" /></section>
    <div class="download-grid">
      <article v-for="channel in pendingChannels" :key="channel.title" class="download-card"><span aria-hidden="true">{{ channel.symbol }}</span><h2>{{ channel.title }}</h2><p>{{ channel.detail }}</p><small>尚无正式下载入口</small></article>
    </div>
    <div class="download-note"><strong>下载安全提示</strong><p>请仅使用未来在本页明确列出的正式地址和安装包。本页未发布的渠道不应从非官方来源获取。</p></div>
  </ResourceShell>
</template>
<style scoped>
.web-entry{display:flex;align-items:center;justify-content:space-between;gap:25px;padding:30px;border:1px solid #bdcbfa;border-radius:20px;background:linear-gradient(110deg,var(--p-soft),var(--card))}
.web-entry h2{margin:0 0 8px}.web-entry p:last-child{max-width:650px;margin:0;color:var(--ink2)}
.download-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:24px}
.download-card{padding:24px;border:1px solid var(--line);border-radius:17px;background:var(--card)}
.download-card>span{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;background:var(--alt);color:var(--ink3);font-weight:900}
.download-card h2{font-size:24px;margin:23px 0 8px}.download-card p{min-height:75px;color:var(--ink3);font-size:14px}.download-card small{color:var(--ink4);font-weight:750}
.download-note{max-width:800px;margin-top:44px;padding:22px;border-left:4px solid var(--p);background:var(--p-soft);border-radius:0 15px 15px 0}.download-note p{margin:7px 0 0;color:var(--ink2)}
@media(max-width:760px){.download-grid{grid-template-columns:1fr}.web-entry{align-items:start;flex-direction:column}.download-card p{min-height:0}}
</style>
