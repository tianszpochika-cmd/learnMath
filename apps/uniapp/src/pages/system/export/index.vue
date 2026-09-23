<script setup lang="ts">
import { ref } from "vue";
import MNavBar from "../../../components/MNavBar.vue";
import { displayError } from "../../../features/mobileData";
import { socialSystemApi } from "../../../services/socialSystemApi";
const busy = ref(false), requested = ref(false), error = ref("");
async function request(): Promise<void> {
  if (busy.value || requested.value) return;
  busy.value = true; error.value = "";
  try { await socialSystemApi.exportData(); requested.value = true; }
  catch (cause) { error.value = displayError(cause); }
  finally { busy.value = false; }
}
function notices(): void { uni.navigateTo({ url: "/pages/system/notices/index" }); }
</script>
<template><view class="mobile-page"><MNavBar title="导出我的数据" back /><view class="page-scroll"><view class="hero"><text class="eyebrow">YOUR DATA</text><text class="page-title">把学习记录带走</text><text class="muted">向服务端申请数据包，完成后在站内通知领取。</text></view><view class="m-card"><text class="m-card-title">导出流程</text><view class="step"><text class="number">01</text><view><text class="title">提交申请</text><text class="muted">请求交由服务端处理</text></view></view><view class="step"><text class="number">02</text><view><text class="title">等待站内通知</text><text class="muted">下载链接将在通知中提供</text></view></view><view class="step"><text class="number">03</text><view><text class="title">及时保存</text><text class="muted">下载链接按接口约定 7 天后失效</text></view></view></view><view v-if="requested" class="m-state success">服务端已接收导出申请。处理进度与下载链接请到通知中心查看；此页不显示本地模拟进度。<button class="link" @click="notices">查看通知 ›</button></view><view v-if="error" class="m-state error">{{ error }}</view><button class="m-button" :disabled="busy || requested" @click="request">{{ busy ? '正在提交…' : requested ? '申请已提交' : '申请数据导出' }}</button><view class="m-state footnote">当前接口没有导出历史查询能力，历史下载请在站内通知中核对。</view></view></view></template>
<style scoped>.hero{display:flex;flex-direction:column;gap:10rpx;padding:38rpx 25rpx 35rpx;background:linear-gradient(160deg,#edf3ff,#f8f8ff);border-radius:32rpx;margin:9rpx 0 24rpx}.step{display:flex;gap:22rpx;padding:25rpx 0;border-top:1rpx solid #e9eef6}.step:first-of-type{margin-top:18rpx}.number{color:#7c9fff;font-size:30rpx;font-weight:850}.title{display:block;font-size:27rpx;font-weight:750}.step .muted{display:block;margin-top:6rpx}.link{display:block;padding:14rpx 0;background:transparent;color:#146b42;font-size:23rpx;text-decoration:underline}.footnote{margin-top:22rpx}</style>
