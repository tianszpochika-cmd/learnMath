<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { setResumeToken } from "../../features/entryFlow";
import { ensureMobileSession } from "../../services/mobileClient";
const enter = async (): Promise<void> => {
  const signedIn = await ensureMobileSession();
  if (signedIn) { uni.switchTab({ url: "/pages/home/index" }); return; }
  let seen = false;
  try { seen = uni.getStorageSync("lm.mobile.onboarded") === true; } catch { /* use onboarding */ }
  uni.reLaunch({ url: seen ? "/pages/login/index" : "/pages/onboarding/index" });
};
onLoad((query) => {
  if (query?.resumeToken) setResumeToken(query.resumeToken);
  setTimeout(() => { void enter(); }, 520);
});
</script>
<template>
  <view class="splash mobile-page"><view class="orb orb-one"/><view class="orb orb-two"/><view class="brand-mark">π</view><text class="brand-name">数源 MathOrigin</text><text class="tagline">数之源 · 每一步都讲清楚为什么</text><view class="loading"><view class="loading-line"/><text>正在准备你的学习空间</text></view></view>
</template>
<style scoped>
.splash{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;min-height:100vh;background:#0f1e36;color:#f3f7ff}.orb{position:absolute;border-radius:50%;filter:blur(5rpx)}.orb-one{width:540rpx;height:540rpx;top:-150rpx;right:-250rpx;background:#294cad44}.orb-two{width:420rpx;height:420rpx;bottom:-170rpx;left:-170rpx;background:#7e59cb33}.brand-mark{display:flex;align-items:center;justify-content:center;width:178rpx;height:178rpx;border-radius:46rpx;background:linear-gradient(135deg,#4f7bff,#8b5cf6);color:#fff;font:italic 126rpx Georgia,serif;box-shadow:0 35rpx 90rpx #3957d944}.brand-name{margin-top:31rpx;font-size:51rpx;font-weight:850;letter-spacing:-2rpx}.tagline{margin-top:15rpx;color:#afbed6;font-size:26rpx}.loading{position:absolute;bottom:calc(84rpx + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:16rpx;color:#8197b9;font-size:21rpx}.loading-line{width:134rpx;height:5rpx;border-radius:99rpx;background:linear-gradient(90deg,#4f7bff,#8b5cf6);animation:soft 1.5s ease-in-out infinite}@keyframes soft{50%{opacity:.3;transform:scaleX(.65)}}
</style>
