<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  afterCheckin,
  assessmentBannerCopy,
  assessmentBannerNeeded,
  checkinButton,
  coursePositionLabel,
  courseRingPercent,
  drillBanner,
  emptyTasksCopy,
  streakText,
  taskProgress,
  topPathRecs,
  weekHeatLevels,
  type CheckinState,
  type CourseNow,
  type PathRec,
  type TodayTask,
} from "../features/home/homeAggregation";

/** W02 学习概览（16W02）。数据 = 聚合接口 fixture；映射逻辑在 homeAggregation 单测锁定。 */
const router = useRouter();

const needAssessment = ref(true); // 登录回执标志位（B30 契约接线）
const greeting = "早上好，同学A 👋";

const tasks = reactive<TodayTask[]>([
  { id: "t1", title: "学 1 课时", subtitle: "P1 · 第 4 章", done: false, route: "/learn/1/5" },
  { id: "t2", title: "每日一练", subtitle: "间隔重复已排好", done: true, route: "/wrongbook" },
  { id: "t3", title: "错题重练", subtitle: "到期 3 题", done: false, route: "/wrongbook" },
]);

const progress = computed(() => taskProgress(tasks));
const emptyCopy = emptyTasksCopy();

const checkin = reactive<CheckinState>({ todayChecked: false, streak: 12 });
const checkinBtn = computed(() => checkinButton(checkin));
const streak = computed(() => streakText(checkin.streak));
function doCheckin(): void {
  if (checkinBtn.value.disabled) return;
  Object.assign(checkin, afterCheckin(checkin)); // 乐观更新；接口回执失败回滚（B30 接线）
}

const course: CourseNow = {
  title: "一元二次方程 · 从因式分解到求根",
  doneLessons: 5,
  totalLessons: 8,
  resumeRoute: "/learn/1/5",
};
const ring = computed(() => courseRingPercent(course));
const posLabel = computed(() => coursePositionLabel(course));

const drill = drillBanner({ wrong: 3, weak: 2 });

const heat = weekHeatLevels([30, 45, 0, 60, 15, 0, 52]);

const recs = topPathRecs([
  { title: "▤ 系统课程", subtitle: "按部就班 · 进度环记路", inProgress: true, percent: 64, colorVar: "--p1", route: "/paths" },
  { title: "◈ 知识图谱", subtitle: "自由漫游 · 颜色即掌握度", inProgress: false, percent: 0, colorVar: "--p2", route: "/graph" },
  { title: "▟ 阶梯刷题", subtitle: "L1→L5 · 80% 晋级", inProgress: true, percent: 42, colorVar: "--p4", route: "/rank" },
  { title: "♜ 闯关挑战", subtitle: "关卡 · 星级 · 段位", inProgress: false, percent: 0, colorVar: "--p6", route: "/rank" },
], 3);

function toggle(t: TodayTask): void {
  t.done = !t.done; // 本地乐观；客观任务完成须服务端事件（BR-10，接线后回执校验）
}
function go(route?: string): void {
  if (route) void router.push(route);
}
</script>

<template>
  <div class="home pad">
    <div class="greet">
      <div>
        <h1>{{ greeting }}</h1>
        <p class="mut">连续学习 · <b>{{ streak }}</b> 天在状态里</p>
      </div>
      <div class="acts">
        <span class="kbd" @click="router.push('/search')">🔍 Ctrl K</span>
      </div>
    </div>

    <div v-if="assessmentBannerNeeded(needAssessment)" class="banner">
      <span>◎ {{ assessmentBannerCopy() }}</span>
      <button class="btn sm ghost" @click="router.push('/assessment/1')">开始测评</button>
      <button class="btn sm gray" @click="needAssessment = false">跳过</button>
    </div>

    <div class="grid2">
      <section class="card tasks">
        <div class="rowhead">
          <b>今日任务 {{ progress.label }}</b>
          <span class="mut">{{ progress.percent }}%</span>
        </div>
        <div class="bar"><i :style="{ width: progress.percent + '%' }"></i></div>
        <p v-if="tasks.length === 0" class="mut">{{ emptyCopy }}</p>
        <label v-for="t in tasks" :key="t.id" class="task">
          <input type="checkbox" :checked="t.done" @change="toggle(t)" />
          <div class="tinfo" @click="go(t.route)">
            <b :class="{ done: t.done }">{{ t.title }}</b>
            <span class="mut">{{ t.subtitle }}</span>
          </div>
          <span class="ar" @click="go(t.route)">›</span>
        </label>
      </section>

      <section class="card">
        <div class="rowhead"><b>连续打卡</b><span class="mut">{{ streak }}</span></div>
        <div class="ckrow">
          <div class="flames">🔥 {{ checkin.streak }} 天</div>
          <button class="btn sm" :disabled="checkinBtn.disabled" @click="doCheckin">{{ checkinBtn.label }}</button>
        </div>
        <p class="mut">00:05 日结；错过可用补签卡（3502 守卫）</p>

        <div class="rowhead mt"><b>在学课程</b></div>
        <div class="course">
          <div class="ring" :style="{ '--v': ring / 100 }"><span>{{ ring }}%</span></div>
          <div class="cinfo">
            <b>{{ course.title }}</b>
            <span class="mut">{{ posLabel }}</span>
            <button class="btn sm ghost" @click="go(course.resumeRoute)">继续学习 →</button>
          </div>
        </div>
      </section>
    </div>

    <section class="card drill" @click="go('/wrongbook')">
      <div>
        <b>🎯 每日一练 · {{ drill.total }} 题待做</b>
        <div class="mut">{{ drill.breakdown }}（间隔重复）</div>
      </div>
      <button class="btn sm">开始</button>
    </section>

    <section class="card">
      <div class="rowhead"><b>学习热力（周）</b><span class="mut">60 分钟满级</span></div>
      <div class="heat">
        <span v-for="(h, i) in heat" :key="i" :class="'h' + h" />
      </div>
    </section>

    <section>
      <div class="sect">路径推荐</div>
      <div class="recs">
        <div v-for="r in recs" :key="r.title" class="card rec" :style="{ borderTop: '4px solid var(' + r.colorVar + ')' }" @click="go(r.route)">
          <b>{{ r.title }}</b>
          <span class="mut">{{ r.subtitle }}</span>
          <span v-if="r.inProgress" class="chip">进行中 {{ r.percent }}%</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pad {
  padding: 26px 32px 48px;
  max-width: 1200px;
  margin: 0 auto;
}
.greet {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.greet h1 {
  font-size: 26px;
}
.mut {
  color: var(--ink3);
  font-size: 13.5px;
}
.mt {
  margin-top: 14px;
}
.kbd {
  font-size: 12px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 5px 11px;
  color: var(--ink3);
  cursor: pointer;
}
.banner {
  margin-top: 16px;
  background: var(--brand-soft);
  border: 1px solid #c7d6ff;
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 14.5px;
}
.banner span {
  flex: 1;
}
.grid2 {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
}
.rowhead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.bar {
  height: 9px;
  background: #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 8px;
}
.bar i {
  display: block;
  height: 100%;
  background: var(--grad);
  transition: width 0.3s;
}
.task {
  display: flex;
  gap: 11px;
  align-items: center;
  padding: 11px 4px;
  border-top: 1px solid #f1f3f7;
}
.task input {
  width: 17px;
  height: 17px;
  accent-color: var(--ok);
}
.tinfo {
  flex: 1;
  display: flex;
  flex-direction: column;
  cursor: pointer;
}
.tinfo b {
  font-size: 15px;
}
.tinfo b.done {
  text-decoration: line-through;
  color: var(--ink3);
}
.ar {
  color: var(--ink3);
  cursor: pointer;
}
.ckrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.flames {
  font-size: 22px;
  font-weight: 800;
}
.btn {
  border: none;
  border-radius: 11px;
  background: var(--grad);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.btn.sm {
  height: 36px;
  padding: 0 18px;
  font-size: 14px;
}
.btn.ghost {
  background: var(--p50, #eef4ff);
  color: var(--brand);
}
.btn.gray {
  background: #eef0f4;
  color: var(--ink2);
}
.course {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-top: 6px;
}
.ring {
  --v: 0.63;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: conic-gradient(var(--brand) calc(var(--v) * 360deg), #e5e7eb 0);
  display: grid;
  place-items: center;
  position: relative;
  flex: none;
}
.ring::before {
  content: "";
  position: inset: 7px;
  background: #fff;
  border-radius: 50%;
}
.ring span {
  position: relative;
  font-weight: 800;
  font-size: 13.5px;
}
.cinfo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.drill {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}
.heat {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 7px;
}
.heat span {
  height: 30px;
  border-radius: 8px;
}
.heat .h0 {
  background: #ecfdf5;
}
.heat .h1 {
  background: #d1fae5;
}
.heat .h2 {
  background: #6ee7b7;
}
.heat .h3 {
  background: #10b981;
}
.heat .h4 {
  background: #059669;
}
.sect {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink3);
  margin: 20px 0 10px;
}
.recs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.rec {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.chip {
  align-self: flex-start;
  font-size: 12px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 3px 11px;
  font-weight: 600;
}
@media (max-width: 960px) {
  .grid2,
  .recs {
    grid-template-columns: 1fr;
  }
}
</style>
