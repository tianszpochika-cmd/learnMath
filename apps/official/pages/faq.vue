<script setup lang="ts">
const groups = [
  { name: "学习方式", items: [
    { q: "必须先参加入学测评吗？", a: "测评可以跳过。有明确学习目标时应先返回目标；后续证据充足时可以再审阅校准建议。" },
    { q: "读完课时就算掌握了吗？", a: "阅读、课时完成和掌握度是不同状态。需要练习的课时以相应客观题达标为完成条件，掌握度还要依据有效证据计算。" },
    { q: "AI 提示会提高掌握度吗？", a: "AI 可作为学习提示，但使用辅助的作答不应计入客观掌握度证据；受限作答期间还会按考试策略限制辅助。" }
  ] },
  { name: "内容与规则", items: [
    { q: "公式与概念内容为什么有“待补全”？", a: "公开页面仅展示已审核的发布快照。部分内容可以先发布，但缺少的卡片和条件必须明示，不能把工作稿当成正式内容。" },
    { q: "挑战或测评能看题目解析吗？", a: "能否查看取决于本次作答开始时冻结的反馈和辅助规则。受限考试在交卷前不会提前开放答案、完整深钻或关联辅助。" },
    { q: "公开每日一题会出现在测评里吗？", a: "设计规则要求公开每日题及同族题不进入测评、晋级战、Boss 或挑战题池；正式题池仍需服务端发布与开卷时复核。" }
  ] },
  { name: "账号与合规", items: [
    { q: "现在需要付费吗？", a: "当前官网没有付费购买入口。未来若推出收费服务，需在你主动确认前另行说明价格与规则。" },
    { q: "在哪里阅读协议？", a: "可在页脚查看隐私政策和用户协议。若正式正文暂不可用，页面会提示无法读取，不会用占位文案代替协议。" },
    { q: "数据导出和注销如何处理？", a: "相关申请与冷静期应在登录后的学习端按照服务端回执处理；官网不会代替账户操作或声称已经完成。" }
  ] }
];
const entities = groups.flatMap((group) => group.items);
useSeoMeta({ title: "常见问题", description: "了解数源的学习规则、内容发布、测评辅助和账号合规边界。" });
useHead({ script: [{ type: "application/ld+json", innerHTML: JSON.stringify({
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: entities.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } }))
}) }] });
</script>

<template>
  <ResourceShell eyebrow="FAQ · 常见问题" title="把规则讲清楚，再开始。"
    intro="这里回答学习方式、内容可见范围与账号处理的常见问题。具体操作仍以产品页面和服务端结果为准。">
    <nav class="faq-nav" aria-label="问题分类">
      <a v-for="(group, index) in groups" :key="group.name" :href="'#faq-' + index">{{ group.name }} ↘</a>
    </nav>
    <section v-for="(group, index) in groups" :id="'faq-' + index" :key="group.name" class="faq-group">
      <div class="faq-heading"><span>0{{ index + 1 }}</span><h2>{{ group.name }}</h2></div>
      <details v-for="item in group.items" :key="item.q">
        <summary>{{ item.q }}</summary>
        <p>{{ item.a }}</p>
      </details>
    </section>
    <div class="faq-end"><strong>还没找到答案？</strong><p>浏览帮助文章，或先整理问题与页面链接。</p><NuxtLink to="/help">前往帮助中心 →</NuxtLink></div>
  </ResourceShell>
</template>

<style scoped>
.faq-nav{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:34px}
.faq-nav a{padding:9px 15px;border:1px solid var(--line);border-radius:99px;background:var(--card);font-size:13px;font-weight:750}
.faq-group{max-width:850px;padding:19px 0 28px;scroll-margin-top:100px}
.faq-heading{display:flex;align-items:baseline;gap:15px;border-bottom:2px solid var(--ink);margin-bottom:6px}
.faq-heading span{color:var(--p);font:700 13px Georgia,serif}
.faq-heading h2{margin:0 0 13px}
details{border-bottom:1px solid var(--line);padding:18px 2px}
summary{position:relative;padding-right:28px;color:var(--ink);font-weight:730;cursor:pointer}
summary::marker{color:var(--p)}
details p{max-width:760px;margin:13px 0 0;color:var(--ink2);line-height:1.75}
.faq-end{margin-top:35px;max-width:850px;padding:25px;border:1px solid var(--line);border-radius:17px;background:var(--card)}
.faq-end strong{font:700 23px var(--serif)}.faq-end p{color:var(--ink3)}.faq-end a{color:var(--p-strong);font-weight:800}
</style>
