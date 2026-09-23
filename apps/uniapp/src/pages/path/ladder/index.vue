<script setup lang="ts">
import { computed, ref } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import MNavBar from "../../../components/MNavBar.vue";
import MSheet from "../../../components/MSheet.vue";
import { pathApi, type PathNode, type PathDetail } from "../../../services/pathPlan";

const detail = ref<PathDetail | null>(null), picked = ref<PathNode | null>(null);
const loading = ref(false), busy = ref(false), error = ref(""), notice = ref("");
const levels = ["L1", "L2", "L3", "L4", "L5"];
const groups = computed(() => {
  const rows = new Map<string, PathNode[]>();
  for (const node of (detail.value?.nodes ?? []).filter(item => levels.includes(item.level))) {
    const key = node.group || node.title;
    rows.set(key, [...(rows.get(key) ?? []), node]);
  }
  return [...rows].map(([name, nodes]) => ({ name, nodes }));
});
const unplaced = computed(() => (detail.value?.nodes ?? []).filter(node => !levels.includes(node.level)));
async function load() { loading.value = true; error.value = ""; try { detail.value = await pathApi.detail("P4"); } catch (e) { detail.value = null; error.value = e instanceof Error ? e.message : "阶梯暂不可用"; } finally { loading.value = false; } }
async function enter() {
  if (!picked.value || picked.value.status !== "available" || busy.value) return;
  busy.value = true; error.value = "";
  try {
    const entry = await pathApi.enter("P4", picked.value.id);
    picked.value = null;
    if (entry.attemptId) uni.navigateTo({ url: `/pages/attempt/paper/index?id=${encodeURIComponent(entry.attemptId)}` });
    else if (entry.type === "lesson" && entry.id) uni.navigateTo({ url: `/pages/learn/lesson/index?id=${encodeURIComponent(entry.id)}` });
    else notice.value = "节点已进入，但服务端尚未提供可打开的作答或课时编号。";
  } catch (e) { error.value = e instanceof Error ? e.message : "进入节点失败"; } finally { busy.value = false; }
}
onShow(() => { void load(); });
onPullDownRefresh(() => { void load().finally(() => uni.stopPullDownRefresh()); });
</script>
<template>
  <view class="mobile-page ladder"><MNavBar title="抽象阶梯" back />
    <scroll-view scroll-y class="scroll"><view class="page-scroll">
      <view class="hero"><text class="eyebrow">PATH 04 · ABSTRACT LADDER</text><text class="hero-title">一步一步，升到下一层</text><text class="hero-copy">每个格子的解锁与晋级资格由服务端判定。达标证据不足时不会提前开放。</text><text v-if="detail?.progress !== null && detail" class="hero-progress">路径进度 {{ detail.progress }}%</text></view>
      <view v-if="loading" class="m-state">正在读取阶梯…</view><view v-if="error" class="m-state error">{{ error }}<button class="retry" @click="load">重试</button></view>
      <view v-if="detail && !detail.nodes.length" class="m-state">当前没有已发布的阶梯节点。</view>
      <template v-if="detail?.nodes.length"><view class="section-title"><text>知识阶梯</text><text>以服务端状态为准</text></view>
        <scroll-view scroll-x class="matrix"><view class="matrix-inner"><view class="matrix-head"><text>知识点</text><text v-for="level in levels" :key="level">{{ level }}</text></view><view v-for="group in groups" :key="group.name" class="matrix-row"><text class="row-name">{{ group.name }}</text><button v-for="level in levels" :key="level" class="step" :class="group.nodes.find(node => node.level.toUpperCase() === level)?.status || 'missing'" :disabled="!group.nodes.some(node => node.level.toUpperCase() === level)" @click="picked = group.nodes.find(node => node.level.toUpperCase() === level) || null">{{ group.nodes.find(node => node.level.toUpperCase() === level)?.status === 'done' ? '✓' : group.nodes.find(node => node.level.toUpperCase() === level)?.status === 'locked' ? '锁' : group.nodes.find(node => node.level.toUpperCase() === level)?.status === 'available' ? '→' : '·' }}</button></view></view></scroll-view>
        <view class="legend"><text>● 已通关</text><text>● 当前可学</text><text>● 未解锁</text></view>
        <view v-if="unplaced.length" class="m-card promotion"><text class="m-card-title">其他路径节点</text><text class="muted">以下节点未返回可识别的 L1–L5 层级，按服务端状态显示。</text><view v-for="node in unplaced" :key="node.id" class="m-list-row" @click="picked=node"><view class="body"><text class="title">{{ node.title }}</text><text class="meta">{{ node.status === 'available' ? '可进入' : node.status === 'done' ? '已完成' : '未解锁或状态待确认' }}</text></view><text class="chevron">›</text></view></view><view class="m-card promotion"><text class="m-card-title">晋级战</text><text class="muted">需满足有效练习题数、达标成绩与晋级考试。若服务端发布晋级节点，它会在路径中显示。</text></view></template>
      <view v-if="notice" class="m-state warning">{{ notice }}</view>
    </view></scroll-view>
    <MSheet :model-value="!!picked" :title="picked?.title || '阶梯节点'" height="compact" @update:model-value="picked = null"><view v-if="picked" class="sheet-body"><text class="m-chip">{{ picked.level || '难度未返回' }}</text><text class="sheet-line">{{ picked.status === 'done' ? '已完成' : picked.status === 'available' ? '当前可进入' : picked.status === 'locked' ? '尚未解锁' : '状态待确认' }}</text><text class="muted">{{ picked.lockReason || picked.description || '更多说明由节点入口提供。' }}</text></view><template #footer><button class="m-button" :disabled="picked?.status !== 'available' || busy" @click="enter">{{ busy ? '正在进入…' : '进入节点' }}</button></template></MSheet>
  </view>
</template>
<style scoped>
.ladder{display:flex;flex-direction:column;height:100vh}.scroll{flex:1;min-height:0}.hero{padding:35rpx;border-radius:32rpx;background:linear-gradient(145deg,#162b56,#425caa);color:#fff}.hero .eyebrow{color:#aecaef}.hero-title{display:block;font-size:39rpx;font-weight:850;line-height:1.3}.hero-copy{display:block;margin-top:15rpx;color:#dce7ff;font-size:24rpx;line-height:1.6}.hero-progress{display:block;margin-top:23rpx;font-size:25rpx;font-weight:750}.matrix{width:100%;white-space:nowrap}.matrix-inner{min-width:690rpx}.matrix-head,.matrix-row{display:grid;grid-template-columns:180rpx repeat(5,96rpx);align-items:center;gap:5rpx;min-height:93rpx}.matrix-head{color:#5c6d88;font-size:22rpx;font-weight:750;text-align:center}.matrix-head text:first-child{text-align:left}.matrix-row{margin-bottom:9rpx;padding:6rpx;border-radius:19rpx;background:#fff}.row-name{overflow:hidden;padding-left:10rpx;text-overflow:ellipsis;white-space:nowrap;font-size:22rpx;font-weight:700}.step{width:72rpx;height:72rpx;padding:0;border-radius:17rpx;background:#e8edf5;color:#7a8699;font-size:25rpx;font-weight:800}.step.done{background:#dcf6e8;color:#18784d}.step.available{background:#e4ebff;color:#2450cb;box-shadow:inset 0 0 0 2rpx #7e9dff}.step.locked{background:#f0f2f6;color:#9ba7b7}.step.missing{background:transparent;color:#b8c2cf}.legend{display:flex;justify-content:space-between;margin:17rpx 0 28rpx;color:#64748b;font-size:20rpx}.promotion{border-color:#d8def9}.promotion .muted{display:block;margin-top:13rpx}.sheet-body{display:flex;flex-direction:column;align-items:flex-start;gap:17rpx}.sheet-line{font-size:28rpx;font-weight:750}.retry{display:block;margin-top:12rpx;background:transparent;color:#a33045;text-align:left;font-size:23rpx}
</style>
