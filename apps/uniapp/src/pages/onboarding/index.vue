<script setup lang="ts">
import { ref } from "vue";
const index = ref(0);
const slides = [
  { art: "6 ≫ 1", title: "同一个目标，六种走法", body: "课程、图谱、测评、阶梯、专题与闯关。按适合你的方式，抵达同一个知识点。", note: "从今天的一件小事开始" },
  { art: "∵ ?", title: "盯着一步，看透推理", body: "一道题不只看答案。每一步凭什么成立，为什么想到，还有怎样的走法。", note: "卡住时，总有下一步" },
  { art: "§ → A", title: "先听概念从哪来", body: "从起源、现实和能力地图走向抽象。让数学变成能理解、能使用的工具。", note: "把知识连成自己的地图" },
] as const;
let touchX = 0;
function finish(): void {
  try { uni.setStorageSync("lm.mobile.onboarded", true); } catch { /* repeat on next launch */ }
  uni.reLaunch({ url: "/pages/login/index" });
}
function next(): void { if (index.value < slides.length - 1) index.value++; else finish(); }
function touchStart(event: { touches?: ArrayLike<{ clientX: number }> }): void { touchX = event.touches?.[0]?.clientX ?? 0; }
function touchEnd(event: { changedTouches?: ArrayLike<{ clientX: number }> }): void {
  const dx = (event.changedTouches?.[0]?.clientX ?? touchX) - touchX;
  if (dx < -50 && index.value < 2) index.value++;
  if (dx > 50 && index.value > 0) index.value--;
}
</script>
<template>
  <view class="onboarding mobile-page" @touchstart="touchStart" @touchend="touchEnd">
    <view class="top"><text class="mini-logo">π 数源</text><button class="skip" @click="finish">跳过</button></view>
    <view class="visual"><view class="visual-ring ring-a"/><view class="visual-ring ring-b"/><text class="art">{{ slides[index].art }}</text><text class="visual-note">{{ slides[index].note }}</text></view>
    <view class="copy"><text class="step">0{{ index + 1 }} / 03</text><text class="headline">{{ slides[index].title }}</text><text class="body">{{ slides[index].body }}</text></view>
    <view class="bottom"><view class="dots"><view v-for="(_, dot) in slides" :key="dot" :class="{ current: dot === index }"/></view><button class="m-button" @click="next">{{ index === 2 ? '开始学习' : '下一步' }}</button></view>
  </view>
</template>
<style scoped>
.onboarding{display:flex;flex-direction:column;min-height:100vh;padding:calc(34rpx + env(safe-area-inset-top)) 36rpx calc(36rpx + env(safe-area-inset-bottom));background:#0f1e36;color:#f5f8ff}.top{display:flex;justify-content:space-between;align-items:center}.mini-logo{font-size:27rpx;font-weight:850}.skip{min-width:90rpx;min-height:88rpx;padding:0;background:transparent;color:#a8b9d3;font-size:26rpx}.visual{position:relative;display:flex;flex:1;min-height:470rpx;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}.visual-ring{position:absolute;border:1rpx solid #6b83c84d;border-radius:50%}.ring-a{width:430rpx;height:430rpx}.ring-b{width:620rpx;height:620rpx}.art{z-index:1;font:italic 112rpx Georgia,serif;color:#bdcfff;text-shadow:0 0 90rpx #597bff}.visual-note{z-index:1;margin-top:20rpx;color:#9bb4dc;font-size:23rpx}.copy{min-height:270rpx;padding:10rpx 10rpx 0}.step{display:block;color:#9db5ff;font-size:20rpx;font-weight:800;letter-spacing:4rpx}.headline{display:block;margin-top:18rpx;font-size:45rpx;font-weight:850;line-height:1.25}.body{display:block;margin-top:23rpx;color:#c4d2e7;font-size:27rpx;line-height:1.75}.bottom{margin-top:auto}.dots{display:flex;gap:13rpx;justify-content:center;margin:16rpx 0 35rpx}.dots view{width:12rpx;height:12rpx;border-radius:99rpx;background:#627698}.dots view.current{width:38rpx;background:#8ea9ff}
</style>
