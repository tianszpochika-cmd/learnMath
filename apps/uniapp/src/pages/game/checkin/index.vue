<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import MNavBar from "../../../components/MNavBar.vue";
import { displayError } from "../../../features/mobileData";
import { checkinView, type CheckinView } from "../../../features/socialSystemModel";
import { socialSystemApi } from "../../../services/socialSystemApi";

const state = ref<CheckinView | null>(null), loading = ref(false), busy = ref(false), pending = ref(false), error = ref(""), note = ref("");
const today = new Date();
const month = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
const cells = computed(() => {
  const offset = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const count = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => {
    const day = index + 1, date = `${month}-${String(day).padStart(2,"0")}`;
    return { day, date, state: state.value?.days.find((entry) => entry.date === date)?.state ?? "unknown" };
  })];
});
async function load(): Promise<void> {
  loading.value = true; error.value = "";
  try { state.value = checkinView(await socialSystemApi.checkin()); if (!state.value) throw new Error("服务端未返回打卡状态"); if (state.value.checked === true) pending.value = false; }
  catch (cause) { error.value = displayError(cause); }
  finally { loading.value = false; }
}
async function submit(): Promise<void> {
  if (busy.value || pending.value || state.value?.checked !== false) return;
  busy.value = true; note.value = "";
  try {
    await socialSystemApi.submitCheckin(); pending.value = true;
    try { const verified = checkinView(await socialSystemApi.checkin()); state.value = verified; note.value = verified?.checked ? "服务端已确认今日打卡。" : "请求已接收，打卡状态尚未确认，请稍后刷新。"; if (verified?.checked) pending.value = false; }
    catch { note.value = "服务端已接收打卡请求，但状态复核暂不可用；请稍后刷新，不必重复提交。"; }
  } catch (cause) { note.value = `打卡请求未确认：${displayError(cause)}`; }
  finally { busy.value = false; }
}
onShow(() => { void load(); });
</script>
<template>
  <view class="mobile-page"><MNavBar title="打卡日历" back /><view class="page-scroll">
    <view class="hero"><text class="hero-label">LEARNING STREAK</text><view class="hero-line"><text class="hero-count">{{ state?.streak ?? '—' }}</text><text class="hero-unit">天连续学习</text></view><text class="hero-note">把每一次坚持，留在自己的日历里</text></view>
    <view v-if="loading" class="m-state">正在读取打卡记录…</view><view v-if="error" class="m-state error">{{ error }}<button class="link" @click="load">重试</button></view>
    <view v-if="state" class="m-card"><view class="month-heading"><text>{{ today.getFullYear() }} 年 {{ today.getMonth()+1 }} 月</text><text class="muted">记录由服务端同步</text></view><view class="calendar"><text v-for="name in ['日','一','二','三','四','五','六']" :key="name" class="weekday">{{ name }}</text><view v-for="(cell,index) in cells" :key="index" class="date" :class="cell?.state ?? 'blank'"><text v-if="cell">{{ cell.day }}</text><text v-if="cell?.state === 'checked'" class="mark">✓</text><text v-if="cell?.state === 'makeup'" class="mark">补</text></view></view><view class="legend"><text>● 已打卡</text><text>■ 已补签</text><text>空白表示记录未确认</text></view></view>
    <view v-if="state" class="m-card action-card"><view><text class="m-card-title">{{ state.checked === true ? '今天已打卡' : pending ? '正在等待状态同步' : state.checked === false ? '今天还未打卡' : '今日状态待同步' }}</text><text class="muted">{{ state.makeUpCards === null ? '补签卡余额暂未返回' : `补签卡 ${state.makeUpCards} 张` }}</text></view><button class="m-button" :disabled="busy || pending || state.checked !== false" @click="submit">{{ busy ? '正在核对' : state.checked === true ? '已完成' : pending ? '待同步' : '今日打卡' }}</button></view>
    <view v-if="note" class="m-state" :class="{ error: note.startsWith('打卡请求未确认') }">{{ note }}</view><view class="m-state">补签需要服务端指定日期与扣卡回执，接口字段未明确前暂不开放。</view>
  </view></view>
</template>
<style scoped>.hero{padding:37rpx;border-radius:34rpx;background:linear-gradient(135deg,#244bbf,#567af6 65%,#9b83f7);color:#fff;margin-bottom:26rpx}.hero-label{display:block;color:#dce6ff;font-size:20rpx;font-weight:800;letter-spacing:3rpx}.hero-line{display:flex;align-items:baseline;gap:15rpx;margin:17rpx 0}.hero-count{font-size:114rpx;font-weight:850;line-height:1}.hero-unit{font-size:27rpx;font-weight:750}.hero-note{font-size:23rpx;color:#e5ebff}.month-heading,.action-card{display:flex;justify-content:space-between;align-items:center;gap:20rpx}.month-heading>text:first-child{font-size:29rpx;font-weight:800}.calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:10rpx;margin-top:23rpx}.weekday{text-align:center;color:#8290a5;font-size:21rpx}.date{height:70rpx;border-radius:17rpx;display:flex;align-items:center;justify-content:center;gap:2rpx;font-size:24rpx}.date.checked{background:#eaf5eb;color:#16794c}.date.makeup{background:#eaf0ff;color:#345ed0}.date.missed{color:#aa6070}.date.blank{background:transparent}.mark{font-size:17rpx;font-weight:800}.legend{display:flex;flex-wrap:wrap;gap:20rpx;margin-top:23rpx;color:#76849a;font-size:20rpx}.action-card .m-button{min-width:185rpx;font-size:23rpx}.link{display:inline;background:transparent;color:inherit;text-decoration:underline;font-size:23rpx}</style>
