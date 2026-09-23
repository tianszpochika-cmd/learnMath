<script setup lang="ts">
import MNavBar from "../../components/MNavBar.vue";
function backToLogin(): void { uni.redirectTo({ url: "/pages/login/index" }); }
</script>
<template>
  <view class="mobile-page"><MNavBar title="微信登录" back /><view class="page-scroll fallback"><text class="symbol">✦</text><text class="page-title">当前未开放微信登录</text><text class="muted">此安装环境尚未配置微信授权通道。请使用手机号验证码登录。</text><button class="m-button" @click="backToLogin">返回验证码登录</button></view></view>
</template>
<style scoped>.fallback{display:flex;flex-direction:column;align-items:center;padding-top:170rpx;text-align:center}.symbol{display:grid;place-items:center;width:118rpx;height:118rpx;margin-bottom:35rpx;border-radius:32rpx;background:#edf3ff;color:#2f6bff;font-size:64rpx}.fallback .muted{max-width:570rpx;margin:20rpx 0 55rpx}.fallback .m-button{width:100%}</style>
