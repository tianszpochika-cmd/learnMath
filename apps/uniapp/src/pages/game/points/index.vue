<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import MNavBar from "../../../components/MNavBar.vue";
import { displayError } from "../../../features/mobileData";
import { pointsView, type PointEntry } from "../../../features/socialSystemModel";
import { socialSystemApi } from "../../../services/socialSystemApi";
const balance = ref<number | null>(null), rows = ref<PointEntry[]>([]), page = ref(1), loading = ref(false), error = ref(""), loaded = ref(false), more = ref(true);
async function load(reset = false): Promise<void> {
  if (loading.value) return;
  if (reset) { page.value = 1; rows.value = []; more.value = true; }
  if (!more.value) return;
  loading.value = true; error.value = "";
  try { const view = pointsView(await socialSystemApi.points(page.value)); if (!view) throw new Error("积分明细格式暂无法读取"); balance.value = view.balance; rows.value = [...rows.value, ...view.rows]; more.value = view.rows.length === 20; page.value++; loaded.value = true; }
  catch (cause) { error.value = displayError(cause); }
  finally { loading.value = false; }
}
onShow(() => { void load(true); });
</script>
<template><view class="mobile-page"><MNavBar title="积分明细" back /><view class="page-scroll"><view class="hero"><text>当前积分</text><strong>{{ balance ?? '—' }}</strong><text>每笔变动以服务端流水为准</text></view><view class="section-title">积分流水</view><view v-if="error" class="m-state error">{{ error }}<button class="link" @click="load(!loaded)">重试</button></view><view v-if="loading && !loaded" class="m-state">正在读取积分流水…</view><view v-if="loaded && !rows.length" class="m-state">暂时没有积分变动记录。</view><view v-for="(row,index) in rows" :key="row.id || index" class="m-list-row"><view class="body"><text class="title">{{ row.title }}</text><text class="meta">{{ row.at || '时间待同步' }}</text></view><text class="amount" :class="{ negative: row.amount < 0 }">{{ row.amount > 0 ? '+' : '' }}{{ row.amount }}</text></view><button v-if="more && loaded" class="m-button secondary" :disabled="loading" @click="load()">{{ loading ? '加载中' : '加载更多' }}</button><view class="m-state tip">每日积分上限与扣费规则请以服务端活动说明为准。</view></view></view></template>
<style scoped>.hero{display:flex;flex-direction:column;gap:12rpx;padding:35rpx;border-radius:32rpx;background:#152b5b;color:#e3ebff}.hero strong{font-size:84rpx;line-height:1.2;color:#fff}.hero text:last-child{font-size:22rpx}.amount{font-size:31rpx;font-weight:850;color:#168866}.amount.negative{color:#a55065}.link{display:inline;background:transparent;color:inherit;text-decoration:underline;font-size:23rpx}.tip{margin-top:25rpx}</style>
