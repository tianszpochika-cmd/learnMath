<script setup lang="ts">
const props = withDefaults(defineProps<{ modelValue: boolean; title: string; height?: "compact" | "medium" | "expanded"; dismissible?: boolean }>(), { height: "medium", dismissible: true });
const emit = defineEmits<{ (e: "update:modelValue", value: boolean): void }>();
let touchStartY = 0;
function close(): void { if (props.dismissible) emit("update:modelValue", false); }
function start(event: { touches?: ArrayLike<{ clientY: number }> }): void { touchStartY = event.touches?.[0]?.clientY ?? 0; }
function end(event: { changedTouches?: ArrayLike<{ clientY: number }> }): void {
  const delta = (event.changedTouches?.[0]?.clientY ?? touchStartY) - touchStartY;
  if (delta > 72) close();
}
</script>
<template>
  <view v-if="modelValue" class="sheet-layer">
    <view class="scrim" @click="close" />
    <view class="sheet" :class="height" role="dialog" :aria-label="title">
      <view class="grab" @touchstart="start" @touchend="end" />
      <view class="sheet-head"><text>{{ title }}</text><button v-if="dismissible" aria-label="关闭" @click="close">×</button></view>
      <scroll-view scroll-y class="sheet-body"><slot /></scroll-view>
      <view class="sheet-foot"><slot name="footer" /></view>
    </view>
  </view>
</template>
<style scoped>
.sheet-layer{position:fixed;inset:0;z-index:80}.scrim{position:absolute;inset:0;background:#07162899}.sheet{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;max-height:92vh;min-height:40vh;padding-bottom:env(safe-area-inset-bottom);border-radius:38rpx 38rpx 0 0;background:#fff;box-shadow:0 -24rpx 60rpx -20rpx #0a244e77}.sheet.compact{height:40vh}.sheet.medium{height:60vh}.sheet.expanded{height:90vh}.grab{height:70rpx;flex:none;display:flex;align-items:center;justify-content:center}.grab:after{content:"";width:76rpx;height:8rpx;border-radius:99rpx;background:#becbdd}.sheet-head{display:flex;align-items:center;justify-content:space-between;min-height:78rpx;padding:0 32rpx;border-bottom:1rpx solid #e9eef6;font-size:31rpx;font-weight:800}.sheet-head button{display:flex;align-items:center;justify-content:center;width:88rpx;height:88rpx;background:transparent;color:#52647e;font-size:48rpx}.sheet-body{flex:1;min-height:0;padding:26rpx 32rpx}.sheet-foot{flex:none;padding:15rpx 32rpx 20rpx}
</style>
