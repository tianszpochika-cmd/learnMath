<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import {
  csvFilename,
  deltaTone,
  deltaView,
  heatMonth,
  mistakeBreakdown,
  profileView,
  radarAxisTips,
  radarPoints,
  trendPoints,
  weakestProfile,
  weekSummary,
} from "../features/stats/statsUi";

/** W13 统计看板（16W13 · 双雷达/热力/趋势；数据变换在 statsUi 单测锁定）。 */
const router = useRouter();

const thisWeek = [
  { minutes: 30, questions: 10, correct: 8 },
  { minutes: 45, questions: 20, correct: 12 },
  { minutes: 0, questions: 0, correct: 0 },
  { minutes: 60, questions: 25, correct: 22 },
  { minutes: 15, questions: 5, correct: 3 },
  { minutes: 0, questions: 0, correct: 0 },
  { minutes: 52, questions: 18, correct: 14 },
];
const lastWeek = [
  { minutes: 40, questions: 15, correct: 11 },
  { minutes: 35, questions: 15, correct: 9 },
  { minutes: 50, questions: 25, correct: 18 },
];
const week = computed(() => weekSummary(thisWeek, lastWeek));

const trend = computed(() => trendPoints(thisWeek.map((d) => d.minutes), 640, 150));

const profileInputs = [
  { type: "读条件", attempted: 24, correct: 21 },
  { type: "选工具", attempted: 20, correct: 12 },
  { type: "等价变形", attempted: 26, correct: 21 },
  { type: "论证", attempted: 14, correct: 9 },
  { type: "回代检验", attempted: 4, correct: 1 },
];
const profile = computed(() => profileView(profileInputs));
const weak = computed(() => weakestProfile(profile.value));
const radarPoly = computed(() => radarPoints(profile.value, 150, 100, 78));
const axisTips = radarAxisTips(profile.value.length, 150, 100, 78);

const heat = heatMonth([30, 45, 0, 60, 15, 0, 52, 20, 41, 12, 60, 0, 8, 33]);

const mistakes = mistakeBreakdown([
  { reason: "缺依据（断链）", count: 46 },
  { reason: "变形错误", count: 31 },
  { reason: "漏检验", count: 23 },
]);

const exported = ref("");
function doExport(): void {
  exported.value = csvFilename("learnmath-stats", "2026-09-22");
}
</script>

<template>
  <div class="st pad">
    <div class="head">
      <span class="bk" @click="router.push('/me/settings')">‹</span>
      <h1>学习统计</h1>
      <span class="chip">本周</span>
      <button class="btn gray" style="margin-left: auto" @click="doExport">导出 CSV</button>
    </div>
    <p v-if="exported" class="exported">✓ 已生成 {{ exported }}（下载走数据导出流程 · 02 §7）</p>

    <div class="grid4">
      <div class="card kpi">
        <span>本周时长</span>
        <b>{{ week.totalMinutes }}m</b>
        <em :class="deltaTone(week.minutesDelta)">{{ deltaView(week.minutesDelta) }} 环比</em>
      </div>
      <div class="card kpi">
        <span>做题量</span>
        <b>{{ week.questions }}</b>
        <em :class="deltaTone(week.questionsDelta)">{{ deltaView(week.questionsDelta) }} 环比</em>
      </div>
      <div class="card kpi">
        <span>正确率</span>
        <b>{{ week.accuracy === null ? "—" : week.accuracy.toFixed(1) + "%" }}</b>
        <em :class="deltaTone(week.accuracyDelta)">{{ deltaView(week.accuracyDelta, true) }} 环比</em>
      </div>
      <div class="card kpi">
        <span>最弱推理步</span>
        <b class="small">{{ weak ? weak.type : "—" }}</b>
        <em class="flat">{{ weak && weak.rate !== null ? weak.rate.toFixed(0) + "%" : "样本不足" }}</em>
      </div>
    </div>

    <div class="grid2">
      <!-- 趋势 -->
      <section class="card">
        <div class="sect">每日学习时长趋势（min-max 归一 · 等值走中线）</div>
        <svg viewBox="0 0 640 160" class="chart">
          <line x1="0" y1="150" x2="640" y2="150" stroke="#E5E7EB" />
          <polyline :points="trend" fill="none" stroke="url(#g1)" stroke-width="3" stroke-linejoin="round" />
          <defs>
            <linearGradient id="g1" x1="0" x2="1">
              <stop offset="0" stop-color="#4F7BFF" />
              <stop offset="1" stop-color="#8B5CF6" />
            </linearGradient>
          </defs>
        </svg>
        <p class="mut">周一 → 周日 · 接 04 聚合接口（fixture 演示）</p>
      </section>

      <!-- 推理画像雷达 -->
      <section class="card">
        <div class="sect">推理能力画像（step_type 雷达 · 仅 observed 证据）</div>
        <svg viewBox="0 0 300 200" class="chart">
          <polygon
            v-for="i in 2"
            :key="'ring' + i"
            :points="radarAxisTips(profile.length, 150, 100, (78 * i) / 2).map((t) => t.x + ',' + t.y).join(' ')"
            fill="none"
            stroke="#E5E7EB"
          />
          <line
            v-for="(t, i) in axisTips"
            :key="'ax' + i"
            x1="150"
            y1="100"
            :x2="t.x"
            :y2="t.y"
            stroke="#E5E7EB"
          />
          <polygon :points="radarPoly" fill="rgba(47,107,255,.25)" stroke="#2F6BFF" stroke-width="2" />
          <text
            v-for="(e, i) in profile"
            :key="e.type"
            :x="axisTips[i].x"
            :y="axisTips[i].y + (axisTips[i].y > 100 ? 16 : -6)"
            text-anchor="middle"
            font-size="11"
            fill="#64748B"
          >
            {{ e.rate === null ? e.type + "(未测量)" : e.type }}
          </text>
        </svg>
        <p class="mut">n&lt;5 标小样本；null 率退化为中心点（不画假数据）</p>
      </section>

      <!-- 热力 -->
      <section class="card">
        <div class="sect">学习热力（近 14 天 · 60 分钟满级）</div>
        <div class="heat">
          <span v-for="(h, i) in heat" :key="i" :class="'h' + h" />
        </div>
        <div class="legend">
          <span>少</span><i class="h0" /><i class="h1" /><i class="h2" /><i class="h3" /><i class="h4" /><span>多</span>
        </div>
      </section>

      <!-- 错因分布 -->
      <section class="card">
        <div class="sect">错因分布（断链口径）</div>
        <div v-for="m in mistakes" :key="m.reason" class="mist">
          <div class="mrow">
            <span>{{ m.reason }}</span>
            <b>{{ m.percent }}%</b>
          </div>
          <div class="bar"><i :style="{ width: m.percent + '%' }" /></div>
        </div>
        <p class="mut">缺依据占比最高 → 优先补 warrant 挂点内容（12 选题输入）</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pad {
  padding: 22px 32px 48px;
  max-width: 1200px;
  margin: 0 auto;
}
.head {
  display: flex;
  gap: 14px;
  align-items: center;
}
.bk {
  font-size: 24px;
  cursor: pointer;
  color: var(--ink3);
}
.head h1 {
  font-size: 24px;
}
.chip {
  font-size: 12.5px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 3px 12px;
  font-weight: 600;
}
.exported {
  margin-top: 10px;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #047857;
  border-radius: 10px;
  padding: 10px 15px;
  font-size: 13.5px;
}
.grid4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-top: 16px;
}
.kpi span {
  color: var(--ink3);
  font-size: 13px;
}
.kpi b {
  display: block;
  font-size: 28px;
  margin-top: 6px;
}
.kpi b.small {
  font-size: 21px;
}
.kpi em {
  font-style: normal;
  font-size: 12.5px;
  font-weight: 700;
}
.kpi em.up {
  color: var(--ok);
}
.kpi em.down {
  color: var(--bad);
}
.kpi em.flat {
  color: var(--ink3);
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
}
.sect {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink3);
  margin-bottom: 10px;
}
.chart {
  width: 100%;
  height: auto;
}
.mut {
  color: var(--ink3);
  font-size: 12.5px;
  margin-top: 8px;
}
.heat {
  display: grid;
  grid-template-columns: repeat(14, 1fr);
  gap: 6px;
}
.heat span {
  height: 26px;
  border-radius: 7px;
}
.legend {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 10px;
  font-size: 12px;
  color: var(--ink3);
}
.legend i {
  width: 14px;
  height: 14px;
  border-radius: 4px;
}
.h0 { background: #ecfdf5; }
.h1 { background: #d1fae5; }
.h2 { background: #6ee7b7; }
.h3 { background: #10b981; }
.h4 { background: #059669; }
.mist {
  margin-top: 12px;
}
.mrow {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}
.bar {
  height: 9px;
  background: #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  margin-top: 6px;
}
.bar i {
  display: block;
  height: 100%;
  background: var(--grad);
}
.btn {
  border: none;
  border-radius: 11px;
  background: var(--grad);
  color: #fff;
  font-weight: 700;
  height: 40px;
  padding: 0 20px;
  cursor: pointer;
  font-size: 14.5px;
}
.btn.gray {
  background: #eef0f4;
  color: var(--ink2);
}
@media (max-width: 960px) {
  .grid2,
  .grid4 {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
