<script setup lang="ts">
import { computed, ref } from "vue";
import { ApiError } from "@learnmath/shared";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import MSheet from "../../components/MSheet.vue";
import MTabBar from "../../components/MTabBar.vue";
import { getResumeToken, takeAssessmentInvite } from "../../features/entryFlow";
import { displayError, projectCheckin, projectCourses, projectPaths, projectProfile, projectTasks, type MobileCourse, type MobilePath, type MobileProfile, type MobileTask } from "../../features/mobileData";
import { restoreMobileTarget } from "../../features/mobileIntent";
import { enterTab, unavailable } from "../../features/tabAccess";
import { mobileTabApi } from "../../services/mobileTabApi";

const profile = ref<MobileProfile | null>(null);
const tasks = ref<MobileTask[] | null>(null);
const courses = ref<MobileCourse[] | null>(null);
const paths = ref<MobilePath[] | null>(null);
const checked = ref<boolean | null>(null);
const streak = ref<number | null>(null);
const loading = ref(false);
const error = ref("");
const checkinBusy = ref(false);
const checkinNote = ref("");
const resumeNote = ref("");
const invite = ref(false);
const loaded = ref(false);
let lastAttemptedToken: string | null = null;
const doneCount = computed(() => tasks.value?.filter((task) => task.done === true).length ?? 0);
const firstTask = computed(() => tasks.value?.find((task) => task.done !== true) ?? null);
const greeting = computed(() => profile.value?.nickname ? `你好，${profile.value.nickname}` : "欢迎回来");
async function load(): Promise<void> {
  loading.value = true; error.value = "";
  try {
    const [homeResult, checkinResult] = await Promise.allSettled([mobileTabApi.home(), mobileTabApi.checkin()]);
    if (homeResult.status === "rejected") throw homeResult.reason;
    const source = homeResult.value;
    profile.value = projectProfile(source);
    tasks.value = projectTasks(source);
    courses.value = projectCourses(source);
    paths.value = projectPaths(source);
    if (checkinResult.status === "fulfilled") {
      const checkin = projectCheckin(checkinResult.value);
      checked.value = checkin?.checked ?? null; streak.value = checkin?.streak ?? null;
    } else { checked.value = null; streak.value = null; }
    loaded.value = true;
  } catch (cause) { error.value = displayError(cause); }
  finally { loading.value = false; }
}
async function checkin(): Promise<void> {
  if (checkinBusy.value || checked.value === true) return;
  checkinBusy.value = true; checkinNote.value = "";
  try {
    await mobileTabApi.submitCheckin();
    checkinNote.value = "打卡请求已由服务端确认，正在刷新状态。";
    await load();
    checkinNote.value = "服务端已确认打卡请求；请以上方刷新后的状态为准。";
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 3501) {
      checked.value = true;
      checkinNote.value = "今天已打卡，服务端没有重复发放奖励。";
    } else checkinNote.value = `打卡未完成：${displayError(cause)}`;
  }
  finally { checkinBusy.value = false; }
}
async function show(): Promise<void> {
  const ready = await enterTab(async () => { if (!loaded.value) await load(); });
  if (!ready) return;
  const token = getResumeToken();
  if (token && token !== lastAttemptedToken) {
    lastAttemptedToken = token;
    const result = await restoreMobileTarget();
    resumeNote.value = result.message;
    if (result.opened) return;
  }
  if (!getResumeToken() && takeAssessmentInvite()) invite.value = true;
}
onShow(() => { void show(); });
onPullDownRefresh(() => { void load().finally(() => uni.stopPullDownRefresh()); });
function goSearch(): void { uni.navigateTo({ url: "/pages/system/search/index", fail: unavailable }); }
function goPractice(): void { uni.switchTab({ url: "/pages/practice/index" }); }
function goPaths(): void { uni.switchTab({ url: "/pages/paths/index" }); }
function openCourse(id: number): void { uni.navigateTo({ url: "/pages/learn/course/index?id=" + id, fail: unavailable }); }
function startAssessment(): void {
  invite.value = false;
  uni.navigateTo({ url: "/pages/path/assessment/index", fail: () => { invite.value = true; unavailable(); } });
}
</script>
<template>
  <view class="mobile-page">
    <view class="page-scroll with-tab home-content">
      <view class="welcome"><view class="avatar">{{ profile?.nickname?.slice(0, 1) || 'π' }}</view><view class="welcome-copy"><text class="hello">{{ greeting }}</text><text class="muted">{{ streak !== null ? `连续学习 ${streak} 天` : '今天也从一小步开始' }}{{ profile?.rank ? ` · ${profile.rank}` : '' }}</text></view><button class="quick" aria-label="搜索" @click="goSearch">⌕</button></view>
      <view v-if="loading && !loaded" class="m-state">正在读取你的今日学习安排…</view><view v-if="error" class="m-state error">{{ error }} <button class="inline-link" @click="load">重试</button></view><view v-if="resumeNote" class="m-state warning">{{ resumeNote }}</view>
      <view class="hero"><text class="hero-kicker">TODAY · 今日重点</text><text class="hero-title">{{ firstTask?.title || (tasks?.length === 0 ? '今天没有待办任务' : '先找到今天的一件事') }}</text><text class="hero-desc">{{ firstTask?.minutes !== null && firstTask?.minutes !== undefined ? `预计 ${firstTask.minutes} 分钟 · ` : '' }}{{ tasks ? `已完成 ${doneCount}/${tasks.length} 项` : '任务暂未返回，稍后下拉刷新' }}</text><button class="hero-button" @click="goPractice">查看今天可做什么　›</button></view>
      <view class="m-card checkin"><view class="checkin-icon">✦</view><view class="checkin-copy"><text class="m-card-title">{{ checked === true ? '今日已打卡' : '让今天留下一个标记' }}</text><text class="muted">{{ streak !== null ? `已连续 ${streak} 天` : '打卡状态以服务端为准' }}</text></view><button class="small-button" :disabled="checked === true || checkinBusy" @click="checkin">{{ checkinBusy ? '处理中' : checked === true ? '已打卡' : '打卡' }}</button></view>
      <view v-if="checkinNote" class="m-state" :class="{ error: checkinNote.startsWith('打卡未完成') }">{{ checkinNote }}</view>
      <view class="section-title"><text>在学课程</text></view><view v-if="courses === null" class="m-state">课程信息暂未返回。</view><view v-else-if="!courses.length" class="m-state">还没有在学课程。可到路径中心寻找起点。</view><view v-for="course in courses" :key="course.id" class="m-card course-card"><view class="course-mark">∑</view><view class="course-copy"><text class="m-card-title">{{ course.title }}</text><text class="muted">{{ course.nextLesson || '下一课时由课程详情确认' }}</text><text v-if="course.progress !== null" class="progress-note">当前进度 {{ course.progress }}{{ course.progress <= 1 ? '' : '%' }}</text></view><button class="card-action" aria-label="查看课程" @click="openCourse(course.id)">›</button></view>
      <view class="section-title"><text>你的路径</text><button class="section-link" @click="goPaths">全部 ›</button></view><view v-if="paths === null" class="m-state">推荐路径暂未返回。</view><view v-else-if="!paths.length" class="m-state">目前没有可展示的路径推荐。</view><scroll-view v-else scroll-x class="path-scroll"><view class="path-list"><view v-for="path in paths" :key="path.code" class="path-card"><text class="path-code">{{ path.code }}</text><text class="path-name">{{ path.name }}</text><text class="muted">{{ path.description || '在路径中心查看当前状态' }}</text></view></view></scroll-view>
    </view>
    <MTabBar current="home" />
    <MSheet v-model="invite" title="找到适合你的起点" height="compact"><text class="invite-title">用一次测评，看看从哪里开始</text><text class="muted">测评可以稍后再做。你的首页和路径始终可用；测评结果将由服务端计算。</text><template #footer><view class="invite-actions"><button class="m-button secondary" @click="invite = false">先逛逛</button><button class="m-button" @click="startAssessment">查看可用测评</button></view></template></MSheet>
  </view>
</template>
<style scoped>
.home-content{padding-top:calc(24rpx + env(safe-area-inset-top))}.welcome{display:flex;align-items:center;gap:19rpx;margin-bottom:28rpx}.avatar{display:grid;place-items:center;width:84rpx;height:84rpx;border-radius:29rpx;background:linear-gradient(135deg,#4f7bff,#8b5cf6);color:#fff;font-size:37rpx;font-weight:850}.welcome-copy{flex:1;min-width:0}.hello{display:block;font-size:32rpx;font-weight:850}.quick{width:88rpx;height:88rpx;padding:0;border-radius:24rpx;background:#fff;color:#2f6bff;font-size:50rpx}.hero{position:relative;overflow:hidden;min-height:320rpx;padding:31rpx;border-radius:34rpx;background:linear-gradient(135deg,#214ec7,#4f7bff 60%,#8b5cf6);color:#fff;box-shadow:0 26rpx 45rpx -30rpx #1748ae}.hero:after{content:"π";position:absolute;right:-6rpx;bottom:-100rpx;color:#ffffff21;font:italic 300rpx Georgia,serif}.hero-kicker{display:block;position:relative;z-index:1;font-size:20rpx;font-weight:850;letter-spacing:3rpx;color:#d5e0ff}.hero-title{display:block;position:relative;z-index:1;max-width:560rpx;margin-top:19rpx;font-size:41rpx;font-weight:850;line-height:1.25}.hero-desc{display:block;position:relative;z-index:1;margin-top:14rpx;color:#e0e8ff;font-size:23rpx}.hero-button{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;min-height:72rpx;width:max-content;margin:28rpx 0 0;padding:0 25rpx;border-radius:19rpx;background:#fff;color:#214ec7;font-size:24rpx;font-weight:800}.checkin{display:flex;align-items:center;gap:18rpx;margin-top:23rpx}.checkin-icon{display:grid;place-items:center;width:67rpx;height:67rpx;border-radius:20rpx;background:#fff2d7;color:#b87613;font-size:42rpx}.checkin-copy{flex:1}.small-button{min-width:106rpx;min-height:74rpx;padding:0 13rpx;border-radius:18rpx;background:#2f6bff;color:#fff;font-size:24rpx;font-weight:750}.small-button[disabled]{background:#e8eef7;color:#66758b}.course-card{display:flex;align-items:center;gap:19rpx}.course-mark{display:grid;place-items:center;flex:none;width:86rpx;height:86rpx;border-radius:22rpx;background:#edf3ff;color:#2f6bff;font:italic 50rpx Georgia,serif}.course-copy{flex:1;min-width:0}.course-copy .m-card-title{font-size:27rpx}.progress-note{display:block;margin-top:9rpx;color:#2f6bff;font-size:22rpx}.card-action{width:74rpx;height:88rpx;background:transparent;color:#2f6bff;font-size:50rpx}.section-link{background:transparent;color:#2f6bff;font-size:23rpx}.inline-link{display:inline;background:transparent;color:#9e2d44;text-decoration:underline;font-size:23rpx}.path-scroll{width:100%;white-space:nowrap}.path-list{display:flex;gap:17rpx}.path-card{display:flex;flex:none;flex-direction:column;width:290rpx;min-height:180rpx;padding:22rpx;border-top:7rpx solid #6c83ed;border-radius:23rpx;background:#fff}.path-code{font-size:20rpx;font-weight:850;color:#2f6bff}.path-name{margin:8rpx 0;font-size:28rpx;font-weight:800}.path-card .muted{font-size:21rpx;white-space:normal}.invite-title{display:block;margin-bottom:18rpx;font-size:34rpx;font-weight:850}.invite-actions{display:grid;grid-template-columns:1fr 1fr;gap:12rpx}.invite-actions .m-button{font-size:23rpx;padding:12rpx}
</style>
