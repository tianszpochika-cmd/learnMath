<script setup lang="ts">
import { ref } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import MTabBar from "../../components/MTabBar.vue";
import { arrayValue, displayError, numberValue, projectTasks, projectTotal, stringValue, type MobileTask } from "../../features/mobileData";
import { enterTab, unavailable } from "../../features/tabAccess";
import { mobileTabApi } from "../../services/mobileTabApi";

interface Attempt { id: number; title: string; status: string; mode: string }
const tasks = ref<MobileTask[] | null>(null);
const wrongCount = ref<number | null>(null);
const attempts = ref<Attempt[] | null>(null);
const loading = ref(false);
const error = ref("");
const loaded = ref(false);
function projectAttempts(value: unknown): Attempt[] | null {
  const raw = arrayValue(value, "items", "records", "attempts");
  if (raw === null) return null;
  const projected = raw.map((entry) => {
    const row = entry && typeof entry === "object" && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
    const id = numberValue(row.id ?? row.attemptId);
    if (id === null || id < 1) return null;
    return { id, title: stringValue(row.title ?? row.paperTitle) || "作答记录",
      status: stringValue(row.status), mode: stringValue(row.mode) };
  });
  return projected.some((item) => item === null) ? null : projected as Attempt[];
}
async function load(): Promise<void> {
  loading.value = true; error.value = "";
  const [taskResult, wrongResult, attemptResult] = await Promise.allSettled([mobileTabApi.dailyTasks(), mobileTabApi.wrongbook(), mobileTabApi.attempts()]);
  try {
    if (taskResult.status === "rejected") throw taskResult.reason;
    tasks.value = projectTasks(taskResult.value);
    if (tasks.value === null) throw new Error("今日任务接口未返回可识别的清单。");
    wrongCount.value = wrongResult.status === "fulfilled" ? projectTotal(wrongResult.value) : null;
    attempts.value = attemptResult.status === "fulfilled" ? projectAttempts(attemptResult.value) : null;
    loaded.value = true;
  } catch (cause) { error.value = displayError(cause); }
  finally { loading.value = false; }
}
function openAttempt(id: number): void { uni.navigateTo({ url: "/pages/attempt/paper/index?attemptId=" + id, fail: unavailable }); }
function openWrongbook(): void { uni.navigateTo({ url: "/pages/attempt/wrongbook/index", fail: unavailable }); }
onShow(() => { void enterTab(async () => { if (!loaded.value) await load(); }); });
onPullDownRefresh(() => { void load().finally(() => uni.stopPullDownRefresh()); });
</script>
<template>
  <view class="mobile-page"><view class="page-scroll with-tab"><text class="eyebrow">PRACTICE · TODAY</text><text class="page-title">今天做一点，明天更明白</text><text class="muted intro">题目开始、判分和记录都由服务端确认；这里展示当前可读的任务与作答入口。</text>
    <view v-if="loading && !loaded" class="m-state">正在读取练习安排…</view><view v-if="error" class="m-state error">{{ error }} <button class="retry" @click="load">重试</button></view>
    <view class="daily-card"><text class="daily-kicker">DAILY PRACTICE</text><text class="daily-title">每日练习</text><text class="daily-sub">{{ tasks === null ? '任务数据暂未返回' : tasks.length ? `今天有 ${tasks.length} 项任务` : '今天没有待办任务' }}</text><view class="daily-ornament">∑</view></view>
    <view class="section-title"><text>今日任务</text></view><view v-if="tasks !== null && !tasks.length" class="m-state">今天没有待完成的任务。可以从路径中心选择学习内容。</view><view v-for="task in tasks" :key="task.id" class="m-list-row"><view class="task-mark" :class="{ done: task.done === true }">{{ task.done === true ? '✓' : '·' }}</view><view class="body"><text class="title">{{ task.title }}</text><text class="meta">{{ task.minutes !== null ? `预计 ${task.minutes} 分钟 · ` : '' }}{{ task.done === true ? '已完成' : task.done === false ? '待完成' : '状态未返回' }}</text></view></view>
    <view class="section-title"><text>复习与回顾</text></view><view class="m-list-row" @click="openWrongbook"><view class="row-symbol wrong">↺</view><view class="body"><text class="title">错题本</text><text class="meta">{{ wrongCount === null ? '题量暂未返回' : `${wrongCount} 道题可查看` }}</text></view><text class="chevron">›</text></view>
    <view class="section-title"><text>最近作答</text></view><view v-if="attempts === null" class="m-state">作答记录暂时无法读取。</view><view v-else-if="!attempts.length" class="m-state">还没有作答记录。从路径或课程开始第一道题。</view><view v-for="item in attempts" :key="item.id" class="m-list-row" @click="openAttempt(item.id)"><view class="row-symbol">✎</view><view class="body"><text class="title">{{ item.title }}</text><text class="meta">记录 #{{ item.id }}{{ item.status ? ` · 状态 ${item.status}` : '' }}</text></view><text class="chevron">›</text></view>
  </view><MTabBar current="practice" /></view>
</template>
<style scoped>
.intro{display:block;margin:16rpx 0 28rpx}.daily-card{position:relative;overflow:hidden;min-height:230rpx;padding:31rpx;border-radius:33rpx;background:linear-gradient(125deg,#253d7a,#4877de 68%,#8569cd);color:#fff}.daily-kicker{display:block;color:#d8e3ff;font-size:20rpx;font-weight:850;letter-spacing:3rpx}.daily-title{display:block;margin-top:20rpx;font-size:40rpx;font-weight:850}.daily-sub{display:block;margin-top:8rpx;color:#e0e9ff;font-size:24rpx}.daily-ornament{position:absolute;right:14rpx;bottom:-92rpx;color:#ffffff24;font:italic 210rpx Georgia,serif}.task-mark,.row-symbol{display:grid;place-items:center;width:72rpx;height:72rpx;flex:none;border-radius:22rpx;background:#edf3ff;color:#2f6bff;font-size:42rpx;font-weight:800}.task-mark.done{background:#e6f8ec;color:#148044}.row-symbol.wrong{background:#fff2e7;color:#b76721}.retry{display:inline;background:transparent;color:#9e2d44;text-decoration:underline;font-size:23rpx}
</style>
