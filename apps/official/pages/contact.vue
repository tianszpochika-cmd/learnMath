<script setup lang="ts">
const topic = ref("产品反馈");
const name = ref("");
const message = ref("");
const feedback = ref("");
async function copyDraft() {
  feedback.value = "";
  if (message.value.trim().length < 10) {
    feedback.value = "请至少写 10 个字，说明遇到的问题或合作需求。";
    return;
  }
  const draft = ["主题：" + topic.value, name.value.trim() ? "称呼：" + name.value.trim() : "", "留言：" + message.value.trim()].filter(Boolean).join("\n");
  try {
    await navigator.clipboard.writeText(draft);
    feedback.value = "留言草稿已复制。当前尚未接入投递渠道，也没有发送给我们。";
  } catch {
    feedback.value = "复制失败。当前尚未接入投递渠道，请手动保存留言。";
  }
}
useSeoMeta({ title: "联系我们", description: "整理产品反馈、媒体或合作需求。正式投递渠道未接入前，页面不会声称已发送留言。" });
</script>
<template>
  <ResourceShell eyebrow="CONTACT · 联系我们" title="说出你想解决的问题。"
    intro="产品反馈、内容问题或媒体合作都值得被认真记录。当前官网尚未接入安全的联系投递接口，因此此页只帮助你整理并复制留言，不会假称已发送。">
    <div class="contact-layout">
      <form class="contact-form" @submit.prevent="copyDraft">
        <div><label for="contact-topic">问题类型</label><select id="contact-topic" v-model="topic"><option>产品反馈</option><option>内容纠错</option><option>账号与数据</option><option>媒体合作</option><option>其他</option></select></div>
        <div><label for="contact-name">称呼（选填）</label><input id="contact-name" v-model="name" maxlength="60" autocomplete="name" placeholder="方便你辨认这份草稿的称呼"></div>
        <div><label for="contact-message">留言内容</label><textarea id="contact-message" v-model="message" minlength="10" maxlength="2000" rows="8" placeholder="描述页面、操作步骤、预期结果，或合作用途。请不要填入密码和完整身份证号。"></textarea><small>{{ message.length }} / 2000</small></div>
        <p class="contact-warning">投递通道尚未开放。按钮只会复制文本到你的剪贴板，不会提交到服务器。</p>
        <button type="submit">复制留言草稿</button><p v-if="feedback" class="contact-feedback" role="status">{{ feedback }}</p>
      </form>
      <aside class="contact-aside">
        <p class="eyebrow">BEFORE YOU WRITE</p><h2>这些信息会帮助定位问题</h2>
        <ul><li>使用的是官网、网页学习端还是手机端</li><li>发生问题的页面与大致时间</li><li>你做了什么、页面又显示了什么</li></ul>
        <div class="aside-note"><strong>没有公开收件地址</strong><p>商务、媒体与支持邮箱需正式确认后才会显示。这里不会提供未经核实的地址。</p></div>
        <NuxtLink to="/help">先查看帮助中心 →</NuxtLink>
      </aside>
    </div>
  </ResourceShell>
</template>
<style scoped>
.contact-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(250px,.75fr);gap:24px}
.contact-form,.contact-aside{padding:30px;border:1px solid var(--line);border-radius:20px;background:var(--card)}
.contact-form>div{margin-bottom:19px}.contact-form label{display:block;margin-bottom:7px;color:var(--ink);font-weight:750}
.contact-form input,.contact-form select,.contact-form textarea{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:11px;background:var(--card);color:var(--ink)}
.contact-form textarea{resize:vertical;line-height:1.6}
.contact-form small{display:block;text-align:right;color:var(--ink4)}
.contact-warning{padding:12px;border-radius:10px;background:var(--p-soft);color:var(--ink2);font-size:13px}
.contact-form button{min-height:46px;padding:10px 21px;border:0;border-radius:10px;background:var(--p);color:#fff;font-weight:800}.contact-feedback{color:var(--ink2);font-size:13px}
.contact-aside h2{font-size:29px}.contact-aside ul{padding-left:22px;color:var(--ink2);line-height:2}
.aside-note{margin:28px 0;padding:18px;border:1px dashed var(--line);border-radius:12px;background:var(--alt)}.aside-note p{margin:7px 0 0;color:var(--ink3);font-size:13px}
.contact-aside>a{color:var(--p-strong);font-weight:800}
@media(max-width:800px){.contact-layout{grid-template-columns:1fr}.contact-form,.contact-aside{padding:22px}}
</style>
