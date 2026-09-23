<script setup lang="ts">
useSeoMeta({
  title: "产品宣言",
  description: "数源相信数学不该只剩答案。从推理、知识结构与公式条件出发，让每一步都有依据。"
});
</script>

<template>
  <ResourceShell eyebrow="MANIFESTO · 产品宣言" title="数学的每一步，都应当有来处。"
    intro="数源从一个朴素的问题出发：学会一道题之后，我们是否也理解了为什么这样做？">
    <article class="manifesto-copy">
      <p class="drop">一个答案可以很快出现。真正让人继续走下去的，是答案背后的依据：为什么先选这个工具、这个条件从哪里来、如果换一种问法还会不会做。</p>
      <p>我们希望把数学学习拆成可以追问的过程。通读一条推理链，在关键步骤先预测下一步，再比较顺着做与倒着想；看见另一种解法时，知道它和当前方法各适合什么情形。这是“一题五玩”的方向。</p>
      <blockquote>让一次做对，变成一次真正理解。</blockquote>
      <h2>知识不是散落的卡片</h2>
      <p>一个概念从问题中生长，也连接着先修知识和现实原型。概念四卡保留起源、现实原型、能力地图与抽象阶梯；图谱帮助我们辨别“尚未学到”与“已经学过但还需要证据”。缺少题目或审核内容时，我们会说明资源仍在筹备。</p>
      <h2>公式从条件里来</h2>
      <p>公式不是背下符号就能到处使用的口令。它有定义域、成立条件、推导路径和误用边界。公开页面可以提供已审核的摘要；更完整的练习和推理应在对应的学习情境里进行。</p>
      <h2>学习建议属于学习者</h2>
      <p>测评只对真正测到的领域给出建议。计划可以根据学习证据提出调整，但不会因为几天缺席就自动降低能力，也不会悄悄改写你的安排。学习记录、成绩和奖励要由明确的服务端结果确认。</p>
      <p class="end">我们想做的，是一套让人愿意反复提问的学习环境：先理解，再练习；先看证据，再下结论。</p>
    </article>
    <div class="manifesto-actions"><NuxtLink class="button subtle" to="/features">探索三个理解工具</NuxtLink><LearningCta from="official/manifesto" label="从你的问题开始" /></div>
  </ResourceShell>
</template>

<style scoped>
.manifesto-copy{max-width:790px;margin:auto;color:var(--ink2);font-size:18px;line-height:2}
.manifesto-copy p{margin:0 0 29px}
.manifesto-copy .drop:first-letter{float:left;margin:3px 8px 0 0;color:var(--p);font:700 66px/.95 var(--serif)}
.manifesto-copy h2{margin:54px 0 18px;color:var(--ink)}
.manifesto-copy blockquote{margin:55px -30px;padding:22px 28px;border-left:4px solid var(--p);background:var(--p-soft);color:var(--ink);font:700 clamp(25px,4vw,41px)/1.5 var(--serif)}
.manifesto-copy .end{color:var(--ink);font-weight:650}
.manifesto-actions{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:14px;margin-top:50px}
@media(max-width:700px){.manifesto-copy{font-size:16px}.manifesto-copy blockquote{margin-inline:0}}
</style>
