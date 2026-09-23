<script setup lang="ts">
const props = withDefaults(defineProps<{ title: string; back?: boolean; fallback?: string }>(), { back: false, fallback: "/pages/home/index" });
function goBack(): void {
  const pages = getCurrentPages();
  if (pages.length > 1) uni.navigateBack({ delta: 1 });
  else uni.switchTab({ url: props.fallback });
}
</script>
<template>
  <view class="m-nav">
    <button v-if="back" class="nav-action" aria-label="返回" @click="goBack">‹</button>
    <view v-else class="nav-space" />
    <text class="nav-title">{{ title }}</text>
    <view class="nav-right"><slot name="right" /></view>
  </view>
</template>
<style scoped>
.m-nav{position:sticky;top:0;z-index:9;display:flex;align-items:center;min-height:calc(92rpx + env(safe-area-inset-top));padding:env(safe-area-inset-top) 20rpx 0;background:#f6f8fcf2;border-bottom:1rpx solid #e8edf5;color:#142136}
.nav-action,.nav-space,.nav-right{width:88rpx;min-width:88rpx;height:88rpx}.nav-action{display:flex;align-items:center;justify-content:center;padding:0;background:transparent;color:#203c66;font-size:56rpx}.nav-title{flex:1;text-align:center;font-size:31rpx;font-weight:800}.nav-right{display:flex;align-items:center;justify-content:flex-end}.nav-right :deep(button){min-width:88rpx;min-height:88rpx}
</style>
