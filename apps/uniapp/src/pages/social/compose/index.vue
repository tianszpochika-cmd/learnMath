<script setup lang="ts">
import { computed, ref } from "vue";
import MNavBar from "../../../components/MNavBar.vue";
import { displayError } from "../../../features/mobileData";
import { obj, postStatus, safeId } from "../../../features/socialSystemModel";
import { socialSystemApi } from "../../../services/socialSystemApi";
const title = ref(""), content = ref(""), busy = ref(false), error = ref(""), receipt = ref(""), createdId = ref("");
const canSubmit = computed(() => title.value.trim().length >= 4 && content.value.trim().length >= 10 && !busy.value && !receipt.value);
function insert(value: string): void { content.value += value; }
async function submit(): Promise<void> {
  if (!canSubmit.value) return;
  busy.value = true; error.value = "";
  try {
    const raw = obj(await socialSystemApi.createPost(title.value.trim(), content.value.trim()));
    createdId.value = safeId(raw.id ?? obj(raw.post).id);
    const status = postStatus(raw.status ?? obj(raw.post).status);
    receipt.value = status === "ACTIVE" ? "服务端已确认发布；可打开帖子查看。" : status === "PENDING" ? "内容已提交审核，审核通过后才会公开。" : "请求已由服务端接收；审核状态待同步，请在「我的帖子」核对。";
  } catch (cause) { error.value = displayError(cause); }
  finally { busy.value = false; }
}
function openPost(): void { if (createdId.value) uni.redirectTo({ url: '/pages/social/post/index?id=' + createdId.value }); }
</script>
<template><view class="mobile-page"><MNavBar title="写一条讨论" back /><view class="page-scroll"><view class="intro"><text class="eyebrow">COMMUNITY · SHARE</text><text class="page-title">把问题说出来</text><text class="muted">写清楚已尝试的思路，也许能帮到下一位同学。</text></view><view v-if="receipt" class="m-state success">{{ receipt }}<button v-if="createdId" class="text-link" @click="openPost">查看帖子 ›</button></view><template v-else><text class="m-field-label">标题</text><input v-model="title" class="m-input" maxlength="80" placeholder="例如：这一步为什么要设未知数？" /><text class="m-field-label">正文</text><view class="editor"><textarea v-model="content" class="editor-body" maxlength="5000" placeholder="写出你的题目背景、尝试过程和卡住的地方…" /><view class="tools"><button v-for="symbol in ['²','√','π','θ','≤','∞']" :key="symbol" @click="insert(symbol)">{{ symbol }}</button><text>{{ content.length }}/5000</text></view></view><view class="m-state">发帖可能进入人工审核；在审核通过前，他人不会看到。关联题与知识点需要明确的服务端字段，当前仅支持正文说明。</view><view v-if="error" class="m-state error">{{ error }}</view><button class="m-button submit" :disabled="!canSubmit" @click="submit">{{ busy ? '正在提交…' : '提交讨论' }}</button></template></view></view></template>
<style scoped>.intro{display:flex;flex-direction:column;gap:10rpx;margin:13rpx 0 28rpx}.editor{border:1rpx solid #d9e3f2;border-radius:25rpx;background:#fff;overflow:hidden}.editor-body{width:100%;min-height:340rpx;padding:25rpx;font-size:27rpx;line-height:1.65;color:#142136}.tools{display:flex;align-items:center;gap:8rpx;padding:14rpx 17rpx;background:#f5f7fc}.tools button{width:53rpx;height:55rpx;padding:0;border-radius:10rpx;background:#fff;color:#315dd0;font-size:26rpx}.tools text{margin-left:auto;color:#8390a3;font-size:20rpx}.submit{margin-top:28rpx}.text-link{display:block;padding:14rpx 0 0;background:transparent;color:#11643c;text-decoration:underline;font-size:24rpx}</style>
