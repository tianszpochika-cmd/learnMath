<script setup lang="ts">
import { ref } from "vue";
import MNavBar from "../../../components/MNavBar.vue";
import MSheet from "../../../components/MSheet.vue";
import { displayError } from "../../../features/mobileData";
import { obj, txt } from "../../../features/socialSystemModel";
import { clearMobileSession, getMobileAuth } from "../../../services/mobileClient";
import { socialSystemApi } from "../../../services/socialSystemApi";
const legalOpen = ref(false), legalTitle = ref(""), legalBody = ref(""), legalLoading = ref(false), note = ref(""), busy = ref(false);
async function legal(type: "terms"|"privacy"): Promise<void> {
  legalTitle.value = type === "terms" ? "用户协议" : "隐私政策"; legalBody.value = ""; legalOpen.value = true; legalLoading.value = true;
  try { const raw = await socialSystemApi.legal(type); const row = obj(raw); legalBody.value = typeof raw === "string" ? raw : txt(row.content ?? obj(row.article).content); if (!legalBody.value) throw new Error("协议正文暂未发布"); }
  catch (cause) { legalBody.value = displayError(cause); }
  finally { legalLoading.value = false; }
}
async function logout(): Promise<void> {
  if (busy.value) return;
  busy.value = true; note.value = "";
  try { await getMobileAuth().logout(); }
  catch { clearMobileSession(); note.value = "已清除本机登录信息，服务端会话失效暂未确认。"; }
  finally { busy.value = false; uni.reLaunch({ url: "/pages/login/index" }); }
}
function go(url: string): void { uni.navigateTo({ url }); }
</script>
<template><view class="mobile-page"><MNavBar title="设置" back /><view class="page-scroll"><view class="header"><text class="eyebrow">PREFERENCES</text><text class="page-title">安心地继续学习</text><text class="muted">账号与数据操作会明确告知状态。</text></view><view class="section-title">账号与数据</view><button class="m-list-row row" @click="go('/pages/system/export/index')"><view class="body"><text class="title">数据导出</text><text class="meta">申请后通过站内通知领取</text></view><text class="chevron">›</text></button><button class="m-list-row row" @click="go('/pages/system/deletion/index')"><view class="body"><text class="title">账号注销</text><text class="meta">查看冷静期与撤销状态</text></view><text class="chevron">›</text></button><view class="section-title">协议</view><button class="m-list-row row" @click="legal('terms')"><text class="body title">用户协议</text><text class="chevron">›</text></button><button class="m-list-row row" @click="legal('privacy')"><text class="body title">隐私政策</text><text class="chevron">›</text></button><view class="section-title">应用</view><view class="m-list-row"><view class="body"><text class="title">LearnMath</text><text class="meta">让数学学习更有方向</text></view></view><view class="m-state">改密、绑定、通知订阅和缓存策略需要服务端或平台配置确认，入口暂不开放。</view><view v-if="note" class="m-state warning">{{ note }}</view><button class="logout" :disabled="busy" @click="logout">{{ busy ? '正在退出…' : '退出登录' }}</button></view><MSheet v-model="legalOpen" :title="legalTitle" height="expanded"><view v-if="legalLoading" class="m-state">正在读取正文…</view><text v-else class="legal-body">{{ legalBody }}</text></MSheet></view></template>
<style scoped>.header{display:flex;flex-direction:column;gap:10rpx;margin:15rpx 0 25rpx}.row{width:100%;text-align:left}.logout{display:block;width:100%;min-height:88rpx;margin-top:33rpx;border:1rpx solid #e9c5ca;border-radius:20rpx;background:#fff;color:#ac4054;font-size:26rpx;font-weight:750}.legal-body{white-space:pre-wrap;word-break:break-word;font-size:25rpx;line-height:1.8;color:#34445c}</style>
