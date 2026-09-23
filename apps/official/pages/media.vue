<script setup lang="ts">
const introduction = "数源 MathOrigin 是围绕数学理解过程设计的学习产品。它把课程、知识图谱、学习计划、阶梯练习、专题探索和闯关挑战连接在同一套知识体系里，并以一题五玩、概念四卡和公式馆帮助学习者追问推理依据、概念来处与公式条件。公开内容只展示经过审核的发布版本；个人作答、测评和奖励以学习端的实际结果为准。";
const copied = ref("");
async function copyIntroduction() {
  copied.value = "";
  try {
    await navigator.clipboard.writeText(introduction);
    copied.value = "介绍文字已复制";
  } catch {
    copied.value = "无法自动复制，请手动选取文字";
  }
}
useSeoMeta({ title: "媒体与品牌资料", description: "数源 MathOrigin 的品牌名称、产品介绍与媒体素材发布状态。" });
</script>
<template>
  <ResourceShell eyebrow="MEDIA · 媒体资料" title="介绍数源，请从准确的文字开始。"
    intro="媒体素材以正式发布的版本为准。这里提供可复制的产品简介；Logo 文件、截图包和授权说明尚未发布。">
    <div class="media-grid">
      <section class="media-brand"><p class="eyebrow">BRAND NAME</p><div class="media-mark"><span aria-hidden="true">π</span><strong>数源<small>MathOrigin</small></strong></div><p>品牌预览沿用官网标识与色彩。此处不是可下载的正式矢量文件。</p></section>
      <section class="media-copy"><p class="eyebrow">PRODUCT INTRODUCTION</p><h2>一段可引用的介绍</h2><p id="media-intro">{{ introduction }}</p><button type="button" @click="copyIntroduction">复制介绍文字</button><span v-if="copied" role="status">{{ copied }}</span></section>
    </div>
    <section class="media-assets"><h2>素材包</h2><div class="asset-grid"><div><strong>Logo 文件</strong><span>尚未发布正式下载包</span></div><div><strong>产品截图</strong><span>尚未发布经核对的截图包</span></div><div><strong>品牌授权</strong><span>使用范围尚待正式说明</span></div></div></section>
    <div class="media-end"><p>需要核实功能、数据或转载范围时，请先整理具体用途与引用内容。</p><NuxtLink to="/contact">查看联系页面 →</NuxtLink></div>
  </ResourceShell>
</template>
<style scoped>
.media-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:20px}
.media-grid section{padding:30px;border:1px solid var(--line);border-radius:20px;background:var(--card)}
.media-mark{display:flex;align-items:center;gap:16px;margin:25px 0}
.media-mark>span{display:grid;place-items:center;width:64px;height:64px;border-radius:18px;background:var(--grad);color:#fff;font:italic 43px Georgia,serif}
.media-mark strong{font-size:27px}.media-mark small{display:block;color:var(--ink3);font-size:13px;letter-spacing:.1em}
.media-brand>p:last-child,.media-copy>p:not(.eyebrow),.media-end p{color:var(--ink2)}
.media-copy h2{font-size:29px}.media-copy button{min-height:43px;margin-right:12px;padding:9px 17px;border:0;border-radius:10px;background:var(--p);color:#fff;font-weight:800}.media-copy span{color:var(--ink3);font-size:13px}
.media-assets{margin-top:55px}.asset-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}
.asset-grid div{display:grid;gap:10px;padding:22px;border:1px dashed var(--line);border-radius:15px;background:var(--alt)}.asset-grid span{color:var(--ink3);font-size:13px}
.media-end{margin-top:42px;padding-top:25px;border-top:1px solid var(--line)}.media-end a{color:var(--p-strong);font-weight:800}
@media(max-width:760px){.media-grid,.asset-grid{grid-template-columns:1fr}}
</style>
