<script setup lang="ts">
import { TAB_ITEMS, TAB_PATHS, type TabKey } from "../features/entryFlow";
const props = defineProps<{ current: TabKey }>();
function choose(key: TabKey): void {
  if (key === props.current) { uni.pageScrollTo({ scrollTop: 0, duration: 250 }); return; }
  uni.switchTab({ url: TAB_PATHS[key] });
}
</script>
<template>
  <!-- #ifdef H5 -->
  <view class="m-tabbar" role="tablist" aria-label="主导航">
    <button v-for="item in TAB_ITEMS" :key="item.key" class="tab" :class="{ active: item.key === current }" role="tab" :aria-selected="item.key === current" @click="choose(item.key)"><text class="icon">{{ item.icon }}</text><text>{{ item.label }}</text></button>
  </view>
  <!-- #endif -->
</template>
<style scoped>
.m-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;align-items:stretch;height:calc(132rpx + env(safe-area-inset-bottom));padding:10rpx 10rpx env(safe-area-inset-bottom);background:#fffffff2;box-shadow:0 -12rpx 35rpx -26rpx #274d8580;backdrop-filter:blur(14px)}
.tab{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rpx;min-height:100rpx;padding:4rpx 0;border-radius:22rpx;background:transparent;color:#687990;font-size:20rpx}
.tab .icon{font-size:38rpx;font-weight:800;line-height:1.1}.tab.active{background:#edf3ff;color:#1e4fd6}.tab.active:before{content:"";position:absolute;top:-10rpx;width:38rpx;height:5rpx;border-radius:99rpx;background:#4f7bff}
</style>
