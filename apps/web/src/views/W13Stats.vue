<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { canPlotDailyTrend, heatLevel, mistakeBreakdown, radarAxisTips, radarPoints, trendPoints } from "../features/stats/statsUi";
import { readStatsHeatmap, readStatsOverview, type HeatDay, type StatsOverview } from "../services/stats";

const overview = ref<StatsOverview | null>(null);
const heatmap = ref<HeatDay[]>([]);
const overviewLoading = ref(false);
const heatLoading = ref(false);
const overviewError = ref("");
const heatError = ref("");
const year = new Date().getFullYear();
let serial = 0;

async function load(): Promise<void> {
  const current = ++serial;
  overviewLoading.value = true;
  heatLoading.value = true;
  overviewError.value = "";
  heatError.value = "";
  const results = await Promise.allSettled([readStatsOverview(), readStatsHeatmap(year)]);
  if (current !== serial) return;
  if (results[0].status === "fulfilled") overview.value = results[0].value;
  else {
    overview.value = null;
    overviewError.value = results[0].reason instanceof Error ? results[0].reason.message : "统计概览暂不可用";
  }
  if (results[1].status === "fulfilled") heatmap.value = results[1].value;
  else {
    heatmap.value = [];
    heatError.value = results[1].reason instanceof Error ? results[1].reason.message : "学习热力暂不可用";
  }
  overviewLoading.value = false;
  heatLoading.value = false;
}
onMounted(() => { void load(); });

const hasSummary = computed(() => overview.value !== null && (
  overview.value.totalMinutes !== null || overview.value.questions !== null || overview.value.accuracyPercent !== null
));
const plotDays = computed(() => overview.value?.daily.slice(-7) ?? []);
const showTrend = computed(() => canPlotDailyTrend(plotDays.value));
const trend = computed(() => showTrend.value ? trendPoints(plotDays.value.map((day) => day.minutes!), 640, 145) : "");
const goodProfile = computed(() => overview.value?.profile.filter((entry) => entry.samples !== null && entry.samples >= 5 && entry.ratePercent !== null) ?? []);
const showRadar = computed(() => goodProfile.value.length >= 3);
const radarData = computed(() => goodProfile.value.map((entry) => ({
  type: entry.name, rate: entry.ratePercent, smallSample: false,
})));
const axisTips = computed(() => radarAxisTips(radarData.value.length, 150, 103, 77));
const radarPolygon = computed(() => showRadar.value ? radarPoints(radarData.value, 150, 103, 77) : "");
const weakest = computed(() => goodProfile.value.length
  ? goodProfile.value.reduce((weak, entry) => entry.ratePercent! < weak.ratePercent! ? entry : weak)
  : null);
const mistakes = computed(() => mistakeBreakdown(overview.value?.mistakes ?? []));
const recentHeat = computed(() => heatmap.value.slice(-35).map((day) => ({
  ...day,
  displayLevel: day.level ?? (day.minutes === null ? null : heatLevel(day.minutes)),
})));
function displayCount(value: number | null | undefined, unit = ""): string {
  return value === null || value === undefined ? "—" : `${value}${unit}`;
}
</script>

<template>
  <div class="stats-page">
    <div class="topline">
      <div>
        <div class="eyebrow">LEARNING EVIDENCE · 学习统计</div>
        <h1>看见进展，也看见证据的边界。</h1>
        <p>所有数值取自服务端统计。样本不足与未测量会明确标出，不用空数据补成趋势。</p>
      </div>
      <button type="button" class="button" :disabled="overviewLoading || heatLoading" @click="load">刷新统计</button>
    </div>

    <p v-if="overviewLoading" class="status" role="status">正在读取统计概览…</p>
    <p v-if="overviewError" class="status error" role="alert">{{ overviewError }}</p>
    <div v-if="!overviewLoading && hasSummary && overview" class="kpis">
      <div class="card kpi"><span>学习时长</span><strong>{{ displayCount(overview.totalMinutes, " 分钟") }}</strong><small>{{ overview.totalMinutes === null ? "服务端未提供汇总" : "服务端汇总" }}</small></div>
      <div class="card kpi"><span>做题量</span><strong>{{ displayCount(overview.questions, " 题") }}</strong><small>{{ overview.questions === null ? "服务端未提供题量" : "服务端汇总" }}</small></div>
      <div class="card kpi"><span>客观正确率</span><strong>{{ overview.accuracyPercent === null ? "—" : overview.accuracyPercent.toFixed(1) + "%" }}</strong><small>{{ overview.questions === 0 ? "分母为 0，尚无正确率" : overview.questions !== null && overview.questions < 5 ? "样本不足，仅供参考" : overview.accuracyPercent === null ? "口径未返回" : "以服务端客观题统计为准" }}</small></div>
      <div class="card kpi"><span>待巩固维度</span><strong class="small">{{ weakest?.name ?? "—" }}</strong><small>{{ weakest ? "至少 5 条有效样本 · " + weakest.ratePercent?.toFixed(0) + "%" : "尚无足够样本" }}</small></div>
    </div>
    <section v-if="!overviewLoading && !overviewError && !hasSummary" class="card empty">
      <h2>暂无可展示的统计汇总</h2>
      <p>服务端尚未返回可确认的时长、题量或正确率；不会用评审稿示例数值填充。</p>
    </section>

    <div v-if="!overviewLoading && overview" class="panels">
      <section class="card">
        <div class="eyebrow">DAILY TREND</div>
        <h2>每日学习时长</h2>
        <template v-if="showTrend">
          <svg viewBox="0 0 640 165" class="chart" role="img" :aria-label="`最近 ${plotDays.length} 个连续日期的学习时长趋势`">
            <line x1="0" y1="145" x2="640" y2="145" stroke="var(--line)" />
            <polyline :points="trend" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="trend-dates"><span>{{ plotDays[0]?.date }}</span><span>{{ plotDays[plotDays.length - 1]?.date }}</span></div>
          <ul class="sr-only"><li v-for="day in plotDays" :key="day.date">{{ day.date }}：{{ day.minutes }} 分钟</li></ul>
        </template>
        <p v-else class="empty-copy">需要至少 5 个连续日期且每天有明确时长，才绘制趋势。当前不补零、不连缺失日期。</p>
      </section>

      <section class="card">
        <div class="eyebrow">EVIDENCE PROFILE</div>
        <h2>已测维度</h2>
        <svg v-if="showRadar" viewBox="0 0 300 210" class="chart radar" role="img" aria-label="至少五条有效样本的维度雷达">
          <polygon :points="axisTips.map((tip) => tip.x + ',' + tip.y).join(' ')" fill="none" stroke="var(--line)" />
          <line v-for="(tip, index) in axisTips" :key="index" x1="150" y1="103" :x2="tip.x" :y2="tip.y" stroke="var(--line)" />
          <polygon :points="radarPolygon" fill="var(--primary-soft)" stroke="var(--primary)" stroke-width="2" />
        </svg>
        <p v-else class="empty-copy">至少需要 3 个维度各有 5 条有效样本，才绘制雷达。</p>
        <div v-if="overview.profile.length" class="profile-list">
          <div v-for="entry in overview.profile" :key="entry.name" class="profile-row">
            <span>{{ entry.name }}</span>
            <strong>{{ entry.ratePercent === null ? "尚未测量" : entry.ratePercent.toFixed(0) + "%" }}</strong>
            <small>{{ entry.samples === null ? "样本数未返回" : entry.samples < 5 ? "样本不足 · n=" + entry.samples : "n=" + entry.samples }}</small>
          </div>
        </div>
        <p v-else class="empty-copy">服务端暂未提供维度画像。</p>
      </section>

      <section class="card">
        <div class="eyebrow">LEARNING CALENDAR</div>
        <h2>{{ year }} 年学习热力</h2>
        <p v-if="heatLoading" class="substatus" role="status">正在读取热力数据…</p>
        <p v-if="heatError" class="substatus error" role="alert">{{ heatError }}</p>
        <div v-if="recentHeat.length" class="heat-grid" role="list" aria-label="服务端返回的最近三十五个日期">
          <time v-for="day in recentHeat" :key="day.date" role="listitem" :datetime="day.date" :class="day.displayLevel === null ? 'unknown' : 'heat-' + day.displayLevel" :title="`${day.date}：${day.minutes === null ? '时长未提供' : day.minutes + ' 分钟'}`" :aria-label="`${day.date}：${day.minutes === null ? '时长未提供' : day.minutes + ' 分钟'}`" />
        </div>
        <p v-else-if="!heatLoading && !heatError" class="empty-copy">服务端暂无热力数据。空白不代表 0 分钟。</p>
        <p class="footnote">仅展示服务端返回的最近 35 个日期；缺失日期不会自动填补。</p>
      </section>

      <section class="card">
        <div class="eyebrow">LEARNING REFLECTION</div>
        <h2>错因分布</h2>
        <div v-if="mistakes.length" class="mistake-list">
          <div v-for="item in mistakes" :key="item.reason" class="mistake-row">
            <div><span>{{ item.reason }}</span><strong>{{ item.percent }}%</strong></div>
            <div class="bar"><i :style="{ width: item.percent + '%' }" /></div>
          </div>
        </div>
        <p v-else class="empty-copy">服务端尚未提供可展示的错因计数；不会推断“最常见错误”。</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.stats-page { max-width: 1320px; margin: auto; padding: 36px 24px 90px; color: var(--body); }
.topline { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
.eyebrow { color: var(--primary-deep); font-size: 12px; font-weight: 800; letter-spacing: .13em; }
.topline h1 { margin: 7px 0 10px; color: var(--text); font: 700 clamp(31px, 3.5vw, 46px)/1.3 var(--serif); }
.topline p { max-width: 700px; color: var(--muted); }
.button { min-height: 40px; padding: 8px 15px; border: 1px solid var(--line); border-radius: 10px; background: var(--paper); color: var(--text); font-weight: 700; cursor: pointer; white-space: nowrap; }
.button:disabled { opacity: .5; cursor: not-allowed; }
.status, .substatus { margin-top: 20px; padding: 11px 14px; border-radius: 10px; background: var(--primary-soft); color: var(--primary-deep); }
.status.error, .substatus.error { background: var(--danger-bg); color: var(--danger); }
.substatus { font-size: 13px; }
.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 15px; margin-top: 27px; }
.card { min-width: 0; padding: 23px; border: 1px solid var(--line); border-radius: 18px; background: var(--paper); box-shadow: var(--shadow); }
.card h2 { margin: 6px 0 15px; color: var(--text); font-size: 23px; }
.kpi span, .kpi small { display: block; color: var(--muted); font-size: 13px; }
.kpi strong { display: block; margin: 8px 0; color: var(--text); font: 750 clamp(24px, 2.6vw, 34px) var(--sans); font-variant-numeric: tabular-nums; }
.kpi strong.small { font-size: 22px; }
.panels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 18px; }
.chart { display: block; width: 100%; height: auto; max-height: 280px; }
.chart.radar { max-height: 220px; }
.trend-dates { display: flex; justify-content: space-between; color: var(--muted); font-size: 12px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.empty { max-width: 700px; margin-top: 18px; }.empty p, .empty-copy, .footnote { color: var(--muted); }
.empty-copy { margin-top: 15px; font-size: 14px; line-height: 1.7; }
.footnote { margin-top: 13px; font-size: 12px; }
.profile-list { display: grid; gap: 2px; margin-top: 16px; }
.profile-row { display: grid; grid-template-columns: minmax(100px, 1fr) auto minmax(90px, auto); gap: 9px; padding: 9px 0; border-top: 1px solid var(--line); font-size: 13px; }
.profile-row strong { color: var(--text); }.profile-row small { color: var(--muted); text-align: right; }
.heat-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; margin-top: 16px; }
.heat-grid time { min-width: 0; aspect-ratio: 1; border-radius: 7px; }
.heat-grid time.unknown { background: var(--soft); border: 1px dashed var(--line); }
.heat-0 { background: var(--soft); }.heat-1 { background: #d1fae5; }.heat-2 { background: #6ee7b7; }.heat-3 { background: #10b981; }.heat-4 { background: #047857; }
.mistake-list { display: grid; gap: 15px; margin-top: 15px; }
.mistake-row > div:first-child { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 7px; font-size: 14px; }
.mistake-row strong { color: var(--text); }.bar { height: 9px; overflow: hidden; border-radius: 99px; background: var(--soft); }.bar i { display: block; height: 100%; background: var(--grad); }
@media (max-width: 1050px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) { .panels { grid-template-columns: 1fr; } }
@media (max-width: 560px) { .stats-page { padding: 25px 16px 75px; } .topline { display: block; } .topline .button { margin-top: 16px; } .kpis { gap: 10px; } .card { padding: 17px; } .kpi strong { font-size: 23px; } .profile-row { grid-template-columns: 1fr auto; } .profile-row small { grid-column: 1 / -1; text-align: left; } }
</style>
