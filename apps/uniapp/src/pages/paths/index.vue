<script setup lang="ts">
import { ref } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import MSheet from "../../components/MSheet.vue";
import MTabBar from "../../components/MTabBar.vue";
import { displayError, projectPaths, type MobilePath } from "../../features/mobileData";
import { enterTab } from "../../features/tabAccess";
import { mobileTabApi } from "../../services/mobileTabApi";

const paths = ref<MobilePath[] | null>(null);
const selected = ref<MobilePath | null>(null);
const loading = ref(false);
const error = ref("");
const loaded = ref(false);
const styleFor = (code: string): string => ({ P1: "#2f6bff", P2: "#20a0a0", P3: "#8960d1", P4: "#e49d2c", P5: "#dc6987", P6: "#6380c6" })[code as "P1" | "P2" | "P3" | "P4" | "P5" | "P6"] ?? "#2f6bff";
const destination = (code: string): string | null => ({ P2: "/pages/learn/graph/index", P3: "/pages/path/assessment/index", P4: "/pages/path/ladder/index", P6: "/pages/path/adventure/index" })[code as "P2" | "P3" | "P4" | "P6"] ?? null;
function enterSelected(): void {
  const url = selected.value && destination(selected.value.code);
  if (!url) return;
  selected.value = null;
  uni.navigateTo({ url, fail: () => uni.showToast({ title: "路径暂不可打开", icon: "none" }) });
}
async function load(): Promise<void> {
  loading.value = true; error.value = "";
  try {
    const result = projectPaths(await mobileTabApi.paths());
    if (!result) throw new Error("路径接口未返回可识别的列表。");
    paths.value = result; loaded.value = true;
  } catch (cause) { error.value = displayError(cause); }
  finally { loading.value = false; }
}
onShow(() => { void enterTab(async () => { if (!loaded.value) await load(); }); });
onPullDownRefresh(() => { void load().finally(() => uni.stopPullDownRefresh()); });
</script>
<template>
  <view class="mobile-page">
    <view class="page-scroll with-tab"><text class="eyebrow">SIX WAYS · ONE MAP</text><text class="page-title">选择你的学习路径</text><text class="muted intro">六条路径连接同一套知识与错题记录。卡片上的进度与状态来自你的账号。</text>
      <view v-if="loading && !loaded" class="m-state">正在读取路径…</view><view v-if="error" class="m-state error">{{ error }} <button class="retry" @click="load">重试</button></view><view v-if="paths !== null && !paths.length" class="m-state">当前没有可展示的学习路径。请稍后刷新。</view>
      <view v-for="path in paths" :key="path.code" class="path-card" :style="{ borderLeftColor: styleFor(path.code) }" @click="selected = path"><view class="card-top"><text class="path-code" :style="{ color: styleFor(path.code) }">{{ path.code }}</text><text v-if="path.recommended" class="m-chip">推荐</text><text v-if="path.status" class="status">{{ path.status }}</text></view><text class="name">{{ path.name }}</text><text v-if="path.description" class="muted">{{ path.description }}</text><view class="card-bottom"><text>{{ path.progress === null ? '进度由路径详情确认' : `当前进度 ${path.progress}${path.progress <= 1 ? '' : '%'}` }}</text><text>查看 ›</text></view></view>
    </view>
    <MTabBar current="paths" />
    <MSheet :model-value="selected !== null" :title="selected?.name || '路径详情'" height="compact" @update:model-value="selected = null"><view v-if="selected"><text class="sheet-code">{{ selected.code }}</text><text class="sheet-description">{{ selected.description || '路径介绍暂未返回。' }}</text><text class="muted">当前状态：{{ selected.status || '服务端未返回' }}；{{ selected.progress === null ? '进度暂未返回' : `进度 ${selected.progress}` }}。</text></view><template #footer><view class="sheet-actions"><button class="m-button secondary" @click="selected = null">继续浏览</button><button v-if="selected && destination(selected.code)" class="m-button" @click="enterSelected">进入路径</button></view></template></MSheet>
  </view>
</template>
<style scoped>
.intro{display:block;margin:15rpx 0 30rpx}.path-card{margin-bottom:18rpx;padding:25rpx 27rpx;border:1rpx solid #e0e7f1;border-left:8rpx solid #2f6bff;border-radius:26rpx;background:#fff;box-shadow:0 12rpx 26rpx -21rpx #28456e55}.card-top{display:flex;align-items:center;gap:12rpx}.path-code{font-size:23rpx;font-weight:850;letter-spacing:2rpx}.status{margin-left:auto;color:#687990;font-size:22rpx}.name{display:block;margin:15rpx 0 8rpx;font-size:32rpx;font-weight:850}.card-bottom{display:flex;justify-content:space-between;margin-top:20rpx;padding-top:18rpx;border-top:1rpx solid #e6ebf4;color:#2f6bff;font-size:22rpx;font-weight:750}.card-bottom text:first-child{color:#607188;font-weight:500}.retry{display:inline;background:transparent;color:#9e2d44;text-decoration:underline;font-size:23rpx}.sheet-code{display:block;margin-bottom:13rpx;color:#2f6bff;font-size:24rpx;font-weight:850}.sheet-description{display:block;margin-bottom:22rpx;color:#20344f;font-size:29rpx;line-height:1.55}.sheet-actions{display:grid;grid-template-columns:1fr 1fr;gap:12rpx}.sheet-actions .m-button{font-size:23rpx}
</style>
