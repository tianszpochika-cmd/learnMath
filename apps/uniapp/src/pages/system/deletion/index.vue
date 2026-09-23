<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import MNavBar from "../../../components/MNavBar.vue";
import { displayError } from "../../../features/mobileData";
import { deletionView } from "../../../features/socialSystemModel";
import { socialSystemApi } from "../../../services/socialSystemApi";
const state = ref<ReturnType<typeof deletionView> | null>(null), loading = ref(false), busy = ref(false), error = ref(""), note = ref("");
const deadlineText = computed(() => { const value = state.value?.deadline; if (!value) return "到期时间待服务端同步"; const timestamp = Date.parse(value); return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : "到期时间待服务端同步"; });
async function load(): Promise<void> {
  loading.value = true; error.value = "";
  try { state.value = deletionView(await socialSystemApi.profile()); }
  catch (cause) { error.value = displayError(cause); }
  finally { loading.value = false; }
}
async function cancel(): Promise<void> {
  if (busy.value || state.value?.state !== "cooling") return;
  busy.value = true; note.value = "";
  try { await socialSystemApi.cancelDeletion(); const verified = deletionView(await socialSystemApi.profile()); state.value = verified; note.value = verified.state === "active" ? "服务端确认已撤销注销申请。" : "撤销请求已处理；状态尚未确认，请稍后刷新。"; }
  catch (cause) { note.value = `撤销未完成：${displayError(cause)}`; }
  finally { busy.value = false; }
}
onShow(() => { void load(); });
function goExport(): void { uni.navigateTo({url:"/pages/system/export/index"}); }
</script>
<template><view class="mobile-page"><MNavBar title="账号注销" back /><view class="page-scroll"><view class="hero"><text class="eyebrow">ACCOUNT SAFETY</text><text class="page-title">你的决定，留有确认时间</text><text class="muted">注销申请有 7 天冷静期；状态以服务端账户记录为准。</text></view><view v-if="loading" class="m-state">正在核对账户状态…</view><view v-if="error" class="m-state error">{{ error }}<button class="link" @click="load">重试</button></view><view v-if="state?.state === 'cooling'" class="m-card cooling"><text class="state-label">冷静期中</text><text class="m-card-title">账号已进入注销等待期</text><text class="muted">预计到期：{{ deadlineText }}</text><text class="muted">在冷静期内，你可以撤销申请。</text><button class="m-button" :disabled="busy" @click="cancel">{{ busy ? '正在核对…' : '撤销注销申请' }}</button></view><view v-if="state?.state === 'active'" class="m-card"><text class="m-card-title">账号当前正常</text><text class="muted">注销申请需要二次验证。服务端尚未定义验证码与确认字段，因此这里暂不能发起申请。</text></view><view v-if="state?.state === 'unknown'" class="m-state warning">当前账户资料未返回可验证的注销状态。请稍后刷新，暂不进行任何账号变更。</view><view v-if="state?.state === 'deleted'" class="m-state warning">服务端标记此账号已注销。请联系支持团队核实。</view><view v-if="note" class="m-state" :class="{error:note.startsWith('撤销未完成')}">{{ note }}</view><view class="m-card"><text class="m-card-title">申请前请了解</text><text class="muted">到期后账户将按服务端规则匿名化；学习记录、积分、讨论等可能无法继续使用。数据需要留存时，可先申请导出。</text><button class="outline" @click="goExport">先看看数据导出 ›</button></view></view></view></template>
<style scoped>.hero{display:flex;flex-direction:column;gap:12rpx;padding:37rpx;border-radius:32rpx;background:#fff4f1;margin:12rpx 0 24rpx}.hero .eyebrow{color:#ba5a4c}.cooling{border-color:#f2c9b5}.state-label{display:inline-flex;padding:8rpx 16rpx;border-radius:99rpx;background:#fff0de;color:#a65d16;font-size:22rpx;font-weight:800}.cooling .m-card-title{margin:19rpx 0}.cooling .muted{display:block;margin:8rpx 0}.cooling .m-button{margin-top:25rpx}.outline{margin-top:23rpx;background:transparent;color:#2f6bff;font-size:24rpx}.link{display:inline;background:transparent;color:inherit;text-decoration:underline;font-size:23rpx}</style>
