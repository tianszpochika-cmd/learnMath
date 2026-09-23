<script setup lang="ts">
import { computed, ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import MNavBar from "../../../components/MNavBar.vue";
import { displayError } from "../../../features/mobileData";
import { noticeTarget, noticesView, type NoticeView } from "../../../features/socialSystemModel";
import { socialSystemApi } from "../../../services/socialSystemApi";
const tabs = [{ key: "all", label: "全部" }, { key: "system", label: "系统" }, { key: "learning", label: "学习" }, { key: "community", label: "社区" }, { key: "audit", label: "审核" }] as const;
const tab = ref<(typeof tabs)[number]["key"]>("all"), rows = ref<NoticeView[]>([]), page = ref(1), more = ref(true), loading = ref(false), busy = ref(false), error = ref(""), note = ref(""), loaded = ref(false);
const shown = computed(() => tab.value === "all" ? rows.value : rows.value.filter((row) => row.type.toLowerCase() === tab.value));
async function load(reset = false): Promise<void> {
  if (loading.value) return;
  if (reset) { rows.value = []; page.value = 1; more.value = true; loaded.value = false; }
  if (!more.value) return;
  loading.value = true; error.value = "";
  try { const next = noticesView(await socialSystemApi.notices(page.value)); if (!next) throw new Error("通知列表暂无法读取"); rows.value = [...rows.value, ...next]; more.value = next.length === 20; page.value++; loaded.value = true; }
  catch (cause) { error.value = displayError(cause); }
  finally { loading.value = false; }
}
async function markRead(): Promise<void> {
  const ids = shown.value.filter((row) => !row.read).map((row) => row.id);
  if (!ids.length || busy.value) return;
  busy.value = true; note.value = "";
  try { await socialSystemApi.readNotices(ids); await load(true); note.value = "已重新读取通知状态。"; }
  catch (cause) { note.value = `标记失败：${displayError(cause)}`; }
  finally { busy.value = false; }
}
function open(row: NoticeView): void { const target = noticeTarget(row); if (target) uni.navigateTo({ url: target }); else note.value = "这条通知没有可确认的端内目标。"; }
onShow(() => { void load(true); });
</script>
<template><view class="mobile-page"><MNavBar title="消息中心" back /><view class="page-scroll"><view class="heading"><view><text class="eyebrow">INBOX</text><text class="page-title">给你的消息</text></view><button :disabled="busy || !shown.some(row=>!row.read)" @click="markRead">已加载的标为已读</button></view><scroll-view scroll-x class="tabs"><view class="tab-row"><button v-for="item in tabs" :key="item.key" :class="{active:tab===item.key}" @click="tab=item.key">{{ item.label }}</button></view></scroll-view><view v-if="loading && !loaded" class="m-state">正在读取通知…</view><view v-if="error" class="m-state error">{{ error }}<button class="retry" @click="load(!loaded)">重试</button></view><view v-if="loaded && !shown.length" class="m-state">{{ more ? '当前已加载页面没有这类消息；可加载更多。' : '当前没有这类消息。' }}</view><button v-for="row in shown" :key="row.id" class="m-list-row notice" @click="open(row)"><view class="dot" :class="{read:row.read}" /><view class="body"><text class="title">{{ row.title }}</text><text v-if="row.body" class="meta excerpt">{{ row.body }}</text><text class="meta">{{ row.at || '时间待同步' }}</text></view><text class="chevron">{{ noticeTarget(row) ? '›' : '' }}</text></button><button v-if="more && loaded" class="m-button secondary" :disabled="loading" @click="load()">{{ loading ? '加载中' : '加载更多' }}</button><view v-if="note" class="m-state" :class="{error:note.startsWith('标记失败')}">{{ note }}</view></view></view></template>
<style scoped>.heading{display:flex;align-items:end;justify-content:space-between;gap:10rpx;margin:8rpx 0 25rpx}.heading button{padding:12rpx 0;background:transparent;color:#2f6bff;font-size:21rpx}.heading button[disabled]{color:#98a6b9}.tabs{white-space:nowrap;margin-bottom:23rpx}.tab-row{display:flex;gap:10rpx}.tab-row button{min-width:105rpx;min-height:67rpx;padding:0 17rpx;border-radius:19rpx;background:#fff;color:#5e708a;font-size:23rpx}.tab-row button.active{background:#2f6bff;color:#fff}.notice{width:100%;text-align:left}.dot{width:13rpx;height:13rpx;border-radius:50%;background:#f06d82}.dot.read{background:#d8e0ec}.excerpt{max-height:75rpx;overflow:hidden}.retry{display:inline;background:transparent;color:inherit;text-decoration:underline;font-size:23rpx}</style>
