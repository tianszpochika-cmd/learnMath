<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  readAssessmentReport,
  readAvailableAssessments,
  startAssessment,
  type AssessmentChoice,
  type AssessmentReport,
} from "../services/assessments";

const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id ?? ""));
const isReport = computed(() => route.name === "assessment-result");
const catalog = ref<AssessmentChoice[]>([]);
const report = ref<AssessmentReport | null>(null);
const loading = ref(false);
const starting = ref(false);
const error = ref("");
const acceptedRules = ref(false);
let requestSerial = 0;

const selected = computed(() => catalog.value.find((entry) => entry.id === id.value) ?? null);
const reportFinal = computed(() => report.value !== null && ["completed", "finalized", "2"].includes(report.value.status));

async function load(): Promise<void> {
  const serial = ++requestSerial;
  loading.value = true;
  error.value = "";
  acceptedRules.value = false;
  catalog.value = [];
  report.value = null;
  try {
    if (isReport.value) {
      const next = await readAssessmentReport(id.value);
      if (serial === requestSerial) report.value = next;
    } else {
      const next = await readAvailableAssessments();
      if (serial === requestSerial) catalog.value = next;
    }
  } catch (cause) {
    if (serial === requestSerial) error.value = cause instanceof Error ? cause.message : "测评数据暂不可用";
  } finally {
    if (serial === requestSerial) loading.value = false;
  }
}
watch([id, isReport], () => { void load(); }, { immediate: true });

async function begin(): Promise<void> {
  if (!selected.value || selected.value.disabled || !acceptedRules.value || starting.value) return;
  starting.value = true;
  error.value = "";
  try {
    // 04 §8.1 开考返回 attemptId，后续作答交给共用作答页的服务端草稿/提交状态机。
    const started = await startAssessment(selected.value.id);
    await router.push("/paper/" + encodeURIComponent(started.attemptId));
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "暂无法开始测评，请稍后重试";
  } finally {
    starting.value = false;
  }
}
</script>

<template>
  <div class="assessment-page">
    <div class="topline">
      <RouterLink to="/paths" class="back">← 返回课程</RouterLink>
      <span class="eyebrow">ASSESSMENT · 测评</span>
    </div>
    <section class="hero">
      <div>
        <h1>{{ isReport ? "从已覆盖的领域，看清下一步。" : "找到适合自己的起点。" }}</h1>
        <p v-if="isReport">报告以服务端完成记录为准；未测到的领域保持待校准。</p>
        <p v-else>测评会根据作答动态选题。档位、结果与推荐起点均由服务端决定。</p>
      </div>
      <div class="hero-mark" aria-hidden="true">◎</div>
    </section>

    <p v-if="loading" class="notice" role="status">正在读取{{ isReport ? "测评报告" : "可用测评" }}…</p>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>

    <template v-if="!loading && !isReport">
      <section v-if="selected" class="grid">
        <div class="card">
          <div class="eyebrow">AVAILABLE ASSESSMENT</div>
          <h2>{{ selected.title }}</h2>
          <p class="lead">开始前请确认作答规则。开始后会进入服务端创建的独立作答记录。</p>
          <div class="rule-list">
            <div><strong>反馈时机</strong><span>整体结束后才显示结果；作答中不显示正误。</span></div>
            <div><strong>辅助限制</strong><span>测评属于受限作答；公式、深钻和 AI 辅助不可用。</span></div>
            <div><strong>时限与恢复</strong><span>以开考时服务端返回的规则和已同步答题记录为准。</span></div>
            <div><strong>提前结束</strong><span>仅保留已答记录，不产生完整定级或通关奖励。</span></div>
          </div>
          <label class="confirm">
            <input v-model="acceptedRules" type="checkbox" :disabled="selected.disabled || starting" />
            <span>我已了解规则，确认开始这次测评</span>
          </label>
          <button type="button" class="button primary" :disabled="!acceptedRules || selected.disabled || starting" @click="begin">
            {{ starting ? "正在请求开考…" : "确认并开始测评" }}
          </button>
          <p v-if="selected.disabled" class="muted">该测评当前不可开始，请选择其他学习内容。</p>
        </div>
        <aside class="card side">
          <div class="eyebrow">HOW IT WORKS</div>
          <h2>每一步都有依据</h2>
          <p>系统逐题调整题目档位。此页不在浏览器内判分，也不会用少量示例题推断全部领域水平。</p>
          <RouterLink to="/paths" class="text-link">先看看课程 →</RouterLink>
        </aside>
      </section>
      <section v-else-if="!error" class="card empty">
        <h2>这项测评目前不可用</h2>
        <p>服务端可用测评列表中没有此编号。请从课程入口选择已开放的测评。</p>
        <RouterLink to="/paths" class="button">返回课程</RouterLink>
      </section>
    </template>

    <template v-if="!loading && isReport && !error">
      <section v-if="report && reportFinal && report.level !== null" class="grid">
        <div class="card result">
          <div class="eyebrow">SERVER REPORT · 已完成</div>
          <h2>当前定级 <span>L{{ report.level }}</span></h2>
          <p>此定级来自本次服务端测评记录，仅适用于实际覆盖的领域。</p>
          <div v-if="report.recommendedStart" class="recommend">
            <strong>推荐起点</strong>
            <span>{{ report.recommendedStart }}</span>
          </div>
          <div v-else class="recommend muted">服务端尚未提供可展示的推荐起点。</div>
          <RouterLink to="/plans" class="button primary">查看或制定学习计划</RouterLink>
        </div>
        <aside class="card side">
          <div class="eyebrow">DIMENSION COVERAGE</div>
          <h2>已测维度</h2>
          <div v-if="report.dimensions.length" class="dimensions">
            <div v-for="dim in report.dimensions" :key="dim.name" class="dimension">
              <span>{{ dim.name }}</span><strong>{{ dim.ratePercent === null ? "—" : Math.round(dim.ratePercent) + "%" }}</strong>
            </div>
          </div>
          <p v-else>服务端暂未提供可展示的维度得分；未覆盖领域不推断为零分。</p>
        </aside>
      </section>
      <section v-else class="card empty">
        <h2>完整报告尚未就绪</h2>
        <p>当前记录没有服务端确认的完成状态与定级。请稍后刷新报告，或回到课程继续学习。</p>
        <button type="button" class="button" @click="load">重新读取报告</button>
      </section>
    </template>
  </div>
</template>

<style scoped>
.assessment-page { max-width: 1240px; margin: auto; padding: 34px 24px 88px; color: var(--body); }
.topline { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.back, .text-link { color: var(--primary-deep); font-weight: 700; text-decoration: none; }
.eyebrow { color: var(--primary-deep); font-size: 12px; font-weight: 800; letter-spacing: .13em; }
.hero { position: relative; display: flex; align-items: center; justify-content: space-between; min-height: 265px; overflow: hidden; padding: 42px 52px; border-radius: 23px; background: var(--deep); background-image: var(--grid); color: #d7e4ff; }
.hero h1 { max-width: 760px; color: #fff; font: 700 clamp(32px, 4vw, 49px)/1.3 var(--serif); }
.hero p { max-width: 700px; margin-top: 16px; font-size: 16px; }
.hero-mark { flex: none; color: #779cff; font: 160px/.9 var(--serif); opacity: .55; }
.grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(260px, .8fr); gap: 19px; margin-top: 22px; align-items: start; }
.card { padding: 29px; border: 1px solid var(--line); border-radius: 18px; background: var(--paper); box-shadow: var(--shadow); }
.card h2 { margin: 7px 0 10px; color: var(--text); font-size: 27px; line-height: 1.4; }
.lead { color: var(--muted); }
.rule-list { display: grid; margin: 25px 0; border-top: 1px solid var(--line); }
.rule-list div { display: grid; grid-template-columns: 104px 1fr; gap: 16px; padding: 13px 2px; border-bottom: 1px solid var(--line); }
.rule-list strong { color: var(--text); }
.confirm { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 16px; color: var(--text); font-weight: 650; cursor: pointer; }
.confirm input { width: 17px; height: 17px; margin-top: 3px; accent-color: var(--primary); }
.button { display: inline-flex; align-items: center; justify-content: center; min-height: 43px; padding: 9px 17px; border: 1px solid var(--line); border-radius: 10px; background: var(--paper); color: var(--text); font-weight: 700; text-decoration: none; }
.button.primary { border-color: transparent; background: var(--grad); color: #fff; }
.button:disabled { opacity: .5; cursor: not-allowed; }
.side p { margin: 15px 0 18px; color: var(--muted); }
.notice { padding: 13px 16px; margin-top: 20px; border-radius: 10px; background: var(--primary-soft); color: var(--primary-deep); }
.notice.error { background: var(--danger-bg); color: var(--danger); }
.empty { margin-top: 22px; max-width: 690px; }
.empty p { margin: 12px 0 19px; color: var(--muted); }
.result h2 { font-family: var(--serif); }
.result h2 span { color: var(--primary-deep); font-size: 1.55em; }
.result > p { color: var(--muted); }
.recommend { display: grid; gap: 5px; margin: 24px 0; padding: 17px; border-radius: 12px; background: var(--soft); }
.recommend strong { color: var(--text); }
.dimensions { margin-top: 14px; }
.dimension { display: flex; justify-content: space-between; gap: 20px; padding: 10px 0; border-top: 1px solid var(--line); }
.dimension strong { color: var(--text); }
.muted { color: var(--muted); }
@media (max-width: 800px) { .grid { grid-template-columns: 1fr; } .hero { padding: 30px; min-height: 225px; } .hero-mark { font-size: 100px; } }
@media (max-width: 550px) { .assessment-page { padding: 25px 16px 70px; } .hero { padding: 26px; } .hero-mark { display: none; } .hero p { font-size: 14px; } .card { padding: 22px; } .rule-list div { grid-template-columns: 1fr; gap: 3px; } }
</style>
