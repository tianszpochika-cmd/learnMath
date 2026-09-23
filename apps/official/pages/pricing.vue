<script setup lang="ts">
useSeoMeta({
  title: "价格说明",
  description: "数源 MathOrigin 当前不提供付费购买入口。了解公开内容与学习端能力，以及未来服务的说明边界。"
});
const included = [
  { title: "六条学习路径", detail: "课程、图谱、计划、阶梯、专题与挑战按已开放的内容提供。" },
  { title: "三种理解工具", detail: "一题五玩、概念四卡和公式馆帮助你追问解法与适用条件。" },
  { title: "学习记录与复盘", detail: "作答报告、错题证据和计划建议以学习端真实结果为准。" }
];
</script>

<template>
  <ResourceShell eyebrow="PRICING · 价格说明" title="先把数学学明白，再谈别的。"
    intro="当前没有付费购买入口。已开放功能按产品现行规则免费使用；部分内容和能力仍取决于审核发布与服务可用状态。">
    <div class="free-statement">
      <span>当前价格政策</span>
      <strong>免费使用</strong>
      <p>这里不会要求你填写付款信息。未来如有收费服务，需另行明确内容、价格和生效时间。</p>
    </div>
    <section class="price-section" aria-labelledby="included-title">
      <p class="eyebrow">WHAT IS INCLUDED</p>
      <h2 id="included-title">从第一步到复盘，沿同一套知识体系前进。</h2>
      <div class="price-grid">
        <article v-for="item in included" :key="item.title" class="price-card">
          <span aria-hidden="true">✓</span>
          <h3>{{ item.title }}</h3>
          <p>{{ item.detail }}</p>
        </article>
      </div>
    </section>
    <section class="future-card" aria-labelledby="future-title">
      <div><p class="eyebrow">FUTURE · 未开放</p><h2 id="future-title">会员服务尚未推出</h2></div>
      <p>可能的增值能力仍在探索，没有订阅、预售、价格或上线日期承诺。当前不收取费用。</p>
    </section>
    <section class="price-section" aria-labelledby="price-faq">
      <p class="eyebrow">FAQ</p><h2 id="price-faq">开始之前，你可能会关心</h2>
      <details><summary>注册需要付费吗？</summary><p>当前没有注册收费或付费购买入口。学习端是否可用，仍以实际服务和已发布内容为准。</p></details>
      <details><summary>以后会自动扣费吗？</summary><p>不会因浏览本页或注册自动产生订阅。若未来推出收费服务，应在你主动确认前展示明确的规则与价格。</p></details>
      <details><summary>所有课程和题目都已开放吗？</summary><p>没有通过审核或题池覆盖不足的资源会保持筹备状态，不能用“免费”暗示它们已经上线。</p></details>
    </section>
    <div class="price-actions"><LearningCta label="进入学习端" from="official/pricing" /><NuxtLink class="price-link" to="/features">先看看学习方式 →</NuxtLink></div>
  </ResourceShell>
</template>

<style scoped>
.free-statement{padding:clamp(28px,5vw,52px);border:1px solid #b8c9fa;border-radius:24px;background:linear-gradient(125deg,var(--p-soft),var(--card));}
.free-statement span{font-size:12px;font-weight:800;color:var(--p-strong);letter-spacing:.12em}
.free-statement strong{display:block;margin:12px 0 14px;font:700 clamp(45px,7vw,82px)/1.1 var(--serif);color:var(--ink)}
.free-statement p{max-width:620px;margin:0;color:var(--ink2)}
.price-section{margin-top:64px}
.price-section h2{max-width:740px}
.price-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:28px}
.price-card{padding:25px;border:1px solid var(--line);border-radius:17px;background:var(--card)}
.price-card>span{display:grid;place-items:center;width:35px;height:35px;border-radius:11px;background:var(--p-soft);color:var(--p-strong);font-weight:800}
.price-card h3{margin:19px 0 8px;font-size:21px}
.price-card p{color:var(--ink3);font-size:14px;line-height:1.7}
.future-card{display:grid;grid-template-columns:1fr 1.2fr;gap:35px;align-items:center;margin-top:62px;padding:30px;border:1px dashed var(--line);border-radius:18px;background:var(--alt)}
.future-card h2{margin:0}.future-card p:last-child{color:var(--ink2)}
details{max-width:850px;border-bottom:1px solid var(--line);padding:17px 0;color:var(--ink2)}
summary{color:var(--ink);font-weight:750;cursor:pointer}
details p{margin:10px 0 0}
.price-actions{display:flex;flex-wrap:wrap;align-items:center;gap:20px;margin-top:55px}
.price-link{color:var(--p-strong);font-size:14px;font-weight:800}
@media(max-width:720px){.price-grid,.future-card{grid-template-columns:1fr}.price-section{margin-top:48px}}
</style>
