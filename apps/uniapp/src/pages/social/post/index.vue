<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { ApiError } from "@learnmath/shared";
import MNavBar from "../../../components/MNavBar.vue";
import { displayError } from "../../../features/mobileData";
import { postView, safeId, type PostView } from "../../../features/socialSystemModel";
import { socialSystemApi } from "../../../services/socialSystemApi";
import { currentMobileUserId } from "../../../services/mobileClient";
const postId = ref(""), post = ref<PostView | null>(null), reply = ref(""), loading = ref(false), busy = ref(false), error = ref(""), note = ref(""), deleted = ref(false);
const canReply = computed(() => post.value?.status.toUpperCase() === "ACTIVE" && reply.value.trim().length >= 2 && !busy.value);
async function load(): Promise<void> {
  if (!postId.value) return;
  loading.value = true; error.value = ""; deleted.value = false;
  try { const result = postView(await socialSystemApi.post(postId.value), currentMobileUserId() ?? ""); if (!result) throw new Error("帖子暂不可查看，可能仍在审核中。"); post.value = result; }
  catch (cause) { post.value = null; deleted.value = cause instanceof ApiError && cause.code === 3402; error.value = deleted.value ? "这条讨论已被移除。" : displayError(cause); }
  finally { loading.value = false; }
}
async function sendReply(): Promise<void> {
  if (!canReply.value) return;
  busy.value = true; note.value = "";
  try { await socialSystemApi.reply(postId.value, reply.value.trim()); reply.value = ""; await load(); note.value = "回复请求已处理；请以服务端返回的审核状态为准。"; }
  catch (cause) { note.value = `回复未提交：${displayError(cause)}`; }
  finally { busy.value = false; }
}
async function like(): Promise<void> {
  if (!post.value || busy.value) return;
  busy.value = true; note.value = "";
  try { await socialSystemApi.likePost(postId.value); await load(); note.value = "点赞请求已处理。"; }
  catch (cause) { note.value = `点赞未确认：${displayError(cause)}`; }
  finally { busy.value = false; }
}
onLoad((query) => { postId.value = safeId(query?.id); if (postId.value) void load(); else error.value = "帖子编号无效"; });
</script>
<template><view class="mobile-page"><MNavBar title="讨论详情" back /><view class="page-scroll"><view v-if="loading" class="m-state">正在读取讨论…</view><view v-if="error" class="m-state" :class="{ error:!deleted }"><text class="empty-icon">{{ deleted ? '◇' : '!' }}</text>{{ error }}<button v-if="!deleted && postId" class="retry" @click="load">重试</button></view><template v-if="post"><view class="m-card article"><view class="author"><view class="avatar">{{ post.author.slice(0,1) }}</view><view><text class="m-card-title">{{ post.author }}</text><text class="muted">{{ post.status.toUpperCase()==='PENDING' ? '审核中 · 仅自己可见' : '讨论中' }}</text></view></view><text class="article-title">{{ post.title || '未命名讨论' }}</text><text class="article-body">{{ post.content }}</text><view class="article-actions"><button :disabled="busy || post.status.toUpperCase()!=='ACTIVE'" @click="like">♡ 点赞</button><text>请文明交流</text></view></view><view class="section-title">回复 {{ post.replies.length }}</view><view v-if="!post.replies.length" class="m-state">暂无可见回复。</view><view v-for="item in post.replies" :key="item.id" class="m-card reply"><text class="m-card-title">{{ item.author }} <text v-if="item.accepted" class="m-chip">已采纳</text></text><text class="article-body">{{ item.content }}</text></view><view class="m-card"><text class="m-card-title">参与讨论</text><textarea v-model="reply" class="reply-input" maxlength="2000" placeholder="写下你的思路…" /><button class="m-button" :disabled="!canReply" @click="sendReply">{{ busy ? '处理中' : '提交回复' }}</button></view><view class="m-state">举报与采纳需要后端明确权限和请求字段，当前暂不开放。</view></template><view v-if="note" class="m-state" :class="{error:note.includes('未提交') || note.includes('未确认')}">{{ note }}</view></view></view></template>
<style scoped>.empty-icon{display:block;font-size:60rpx;text-align:center}.retry{display:inline;background:transparent;color:inherit;text-decoration:underline;font-size:23rpx}.author{display:flex;align-items:center;gap:18rpx}.avatar{display:grid;place-items:center;width:75rpx;height:75rpx;border-radius:25rpx;background:#eaf1ff;color:#2f6bff;font-size:32rpx;font-weight:850}.article-title{display:block;margin:35rpx 0 18rpx;font-size:39rpx;font-weight:850;line-height:1.4}.article-body{display:block;white-space:pre-wrap;word-break:break-word;font-size:26rpx;line-height:1.8;color:#344259}.article-actions{display:flex;align-items:center;justify-content:space-between;margin-top:28rpx;padding-top:19rpx;border-top:1rpx solid #edf1f7;color:#8a96a8;font-size:22rpx}.article-actions button{padding:10rpx 22rpx;border-radius:17rpx;background:#f0f4fc;color:#2f6bff;font-size:23rpx}.reply .article-body{margin-top:15rpx}.reply-input{width:100%;min-height:180rpx;margin:20rpx 0;padding:20rpx;border:1rpx solid #d9e3f2;border-radius:20rpx;background:#fbfcff;font-size:27rpx}</style>
