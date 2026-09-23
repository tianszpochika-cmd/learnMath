<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { readOverview, type AdminOverview } from "../services/content";

const router = useRouter();
const loading = ref(true);
const error = ref("");
const overview = ref<AdminOverview | null>(null);
const cards = computed(() => [
  { label: "日活跃用户", value: overview.value?.dau, unit: "人", note: "DAU · 管理服务统计" },
  { label: "新增用户", value: overview.value?.newUsers, unit: "人", note: "当前统计区间" },
  { label: "做题量", value: overview.value?.answers, unit: "题", note: "提交量以服务端口径为准" },
  { label: "正确率（服务端值）", value: overview.value?.accuracy, unit: "", note: "百分比单位与区间待接口契约明确" },
]);
async function load() {
  loading.value = true; error.value = "";
  try { overview.value = await readOverview(); }
  catch (cause) { overview.value = null; error.value = cause instanceof Error ? cause.message : "运营概览暂不可用"; }
  finally { loading.value = false; }
}
onMounted(() => { void load(); });
</script>

<template>
  <div class="ops-page">
    <header class="ops-heading"><div><p class="ops-eyebrow">A02 · OPERATIONS OVERVIEW</p><h1>从内容流，看到今天该处理什么。</h1><p class="ops-lead">管理服务提供的运营信号与内容入口放在同一页。未返回的数据保持空白，不用设计稿数字填充。</p></div><div class="ops-actions"><button class="ops-btn secondary" type="button" @click="load">刷新数据</button><button class="ops-btn" type="button" @click="router.push('/stats')">查看完整统计 →</button></div></header>
    <p v-if="loading" class="ops-state" role="status">正在读取管理服务的运营概览…</p>
    <p v-else-if="error" class="ops-state error" role="alert">运营数据暂不可用：{{ error }}</p>
    <div class="ops-grid" aria-label="运营指标">
      <article v-for="card in cards" :key="card.label" class="ops-card kpi"><span>{{ card.label }}</span><strong>{{ card.value === null || card.value === undefined ? "—" : card.value.toLocaleString() }}<small v-if="card.value !== null && card.value !== undefined">{{ card.unit }}</small></strong><p>{{ card.note }}</p></article>
    </div>
    <div class="ops-grid two lower">
      <section class="ops-card"><p class="ops-eyebrow">CONTENT PIPELINE</p><h2>发布前的检查点</h2><ol class="steps"><li><b>工作稿</b><span>编辑课程、课时、题目与推理链。</span></li><li><b>资源覆盖</b><span>按真实节点、题型和题族清单核查缺口。</span></li><li><b>校对与冲突</b><span>审核后再核对版本与发布差异。</span></li><li><b>上线与审计</b><span>由管理服务确认发布结果并记录操作。</span></li></ol></section>
      <section class="ops-card"><p class="ops-eyebrow">WORKSPACE</p><h2>进入内容工作台</h2><div class="links"><button type="button" @click="router.push('/knowledge')"><b>知识点树</b><span>检查节点、层级和引用 →</span></button><button type="button" @click="router.push('/knowledge/edges')"><b>图谱边编辑</b><span>查看依赖与无环校验 →</span></button><button type="button" @click="router.push('/courses')"><b>课程与课时</b><span>维护教学内容和完成策略 →</span></button><button type="button" @click="router.push('/community/review')"><b>社区审核</b><span>处理真实队列 →</span></button></div></section>
    </div>
  </div>
</template>

<style scoped>
.kpi{min-height:155px}.kpi>span{color:var(--ink2);font-size:13px}.kpi strong{display:block;margin:13px 0;font-size:35px;line-height:1.1;font-variant-numeric:tabular-nums}.kpi strong small{padding-left:5px;font-size:13px;color:var(--ink3)}.kpi p{margin:0;color:var(--ink3);font-size:12px}.lower{margin-top:16px}.steps{display:grid;gap:12px;margin:16px 0 0;padding:0;list-style:none;counter-reset:step}.steps li{display:grid;grid-template-columns:130px 1fr;gap:10px;padding:11px;border-radius:9px;background:var(--ops-soft);counter-increment:step}.steps b:before{content:counter(step,decimal-leading-zero) " · ";color:var(--brand-deep)}.steps span{color:var(--ink2)}.links{display:grid;gap:9px}.links button{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:56px;padding:12px 15px;border:1px solid var(--line);border-radius:10px;background:var(--ops-card);color:var(--ink);text-align:left}.links button:hover{border-color:var(--brand)}.links span{color:var(--ink2);font-size:12px}
@media(max-width:650px){.steps li{grid-template-columns:1fr}.links button{align-items:flex-start;flex-direction:column}}
</style>
