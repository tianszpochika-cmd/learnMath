<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import MNavBar from "../../../components/MNavBar.vue";
import { displayError } from "../../../features/mobileData";
import { list, obj, safeId, txt } from "../../../features/socialSystemModel";
import { activeAttemptMarked, aiTransportSupported, chatMessages, streamMobileChat, streamSupported, type ChatMessage } from "../../../services/mobileAi";
import { socialSystemApi } from "../../../services/socialSystemApi";
const enabled = ref(false), loading = ref(true), error = ref(""), note = ref(""), question = ref(""), conversationId = ref(""), questionId = ref(""), messages = ref<ChatMessage[]>([]), history = ref<{id:string;title:string}[]>([]), busy = ref(false), restricted = ref(false);
let controller: AbortController | null = null;
const canSend = computed(() => enabled.value && aiTransportSupported() && !restricted.value && !busy.value && !!question.value.trim());
async function load(): Promise<void> {
  loading.value = true; error.value = ""; restricted.value = activeAttemptMarked();
  try {
    const status = obj(await socialSystemApi.aiStatus());
    enabled.value = status.enabled === true || obj(status.chat).enabled === true;
    if (!enabled.value) { note.value = "AI 答疑当前未开放。"; return; }
    const raw = await socialSystemApi.conversations();
    const entries = list(raw, "conversations", "items", "records");
    history.value = entries?.map((entry) => { const row=obj(entry); return { id:safeId(row.id), title:txt(row.title ?? row.lastQuestion) || "历史对话" }; }).filter((entry) => entry.id) ?? [];
  } catch (cause) { error.value = displayError(cause); enabled.value = false; }
  finally { loading.value = false; }
}
async function openHistory(id: string): Promise<void> {
  if (busy.value) return;
  error.value = "";
  try { const raw = await socialSystemApi.conversation(id), parsed = chatMessages(raw); if (!parsed) throw new Error("历史消息格式暂无法读取"); conversationId.value = id; messages.value = parsed; }
  catch (cause) { error.value = displayError(cause); }
}
async function send(): Promise<void> {
  if (!canSend.value) return;
  restricted.value = activeAttemptMarked();
  if (restricted.value) { note.value = "进行中的考试暂不可使用 AI。"; return; }
  const text = question.value.trim(); question.value = ""; busy.value = true; error.value = ""; note.value = "";
  messages.value.push({ role: "user", content: text }, { role: "assistant", content: "" });
  const answer = messages.value[messages.value.length-1]; controller = new AbortController();
  try { await streamMobileChat({ question: text, ...(conversationId.value ? { conversationId: conversationId.value } : {}), ...(questionId.value ? { questionId: questionId.value } : {}) }, { delta: (chunk) => { answer.content += chunk; }, meta: (id) => { conversationId.value = id; } }, controller.signal); }
  catch (cause) { answer.failed = true; error.value = displayError(cause); }
  finally { busy.value = false; controller = null; }
}
onLoad((query) => { questionId.value = safeId(query?.questionId); void load(); });
onUnload(() => { controller?.abort(); });
</script>
<template><view class="mobile-page"><MNavBar title="AI 导师" back /><view class="page-scroll chat-page"><view class="hero"><text class="eyebrow">ASK BETTER · LEARN DEEPER</text><text class="page-title">从卡住的那一步开始</text><text class="muted">试着描述你的思路，答案由服务端生成。</text></view><view v-if="questionId" class="m-state">当前关联题目 #{{ questionId }}。服务端会检查作答状态与辅助策略。</view><view v-if="loading" class="m-state">正在确认答疑服务…</view><view v-if="restricted" class="m-state warning">当前有进行中的作答，AI 入口暂时收起；请先完成作答。</view><view v-if="!streamSupported() && aiTransportSupported()" class="m-state">小程序端会在服务端完整返回后显示答疑，请耐心等待。</view><view v-if="!aiTransportSupported()" class="m-state warning">当前环境暂不支持答疑请求。</view><view v-if="note" class="m-state">{{ note }}</view><view v-if="error" class="m-state error">{{ error }}</view><view v-if="history.length && !conversationId" class="history"><text class="section-title">最近的对话</text><button v-for="item in history" :key="item.id" class="m-list-row" @click="openHistory(item.id)"><text class="body title">{{ item.title }}</text><text class="chevron">›</text></button></view><view v-if="!messages.length && !history.length && enabled" class="m-state">这里还没有对话。可以从一个具体问题开始。</view><view v-for="(message,index) in messages" :key="index" class="bubble" :class="message.role"><text>{{ message.content || (busy && message.role==='assistant' ? '正在思考…' : '') }}</text><text v-if="message.failed" class="failed">这次回答没有完成</text></view></view><view class="composer"><input v-model="question" class="m-input" :disabled="!enabled || restricted || busy || !aiTransportSupported()" maxlength="1000" placeholder="我卡在了哪一步…" @confirm="send" /><button class="m-button" :disabled="!canSend" @click="send">{{ busy ? '回答中' : '发送' }}</button></view></view></template>
<style scoped>.chat-page{padding-bottom:235rpx}.hero{display:flex;flex-direction:column;gap:10rpx;margin:12rpx 0 25rpx}.hero .muted{font-size:22rpx}.history .m-list-row{width:100%;text-align:left}.bubble{max-width:87%;margin:20rpx 0;padding:24rpx 27rpx;border-radius:27rpx;white-space:pre-wrap;word-break:break-word;font-size:26rpx;line-height:1.75}.bubble.user{margin-left:auto;background:#2f6bff;color:#fff;border-bottom-right-radius:7rpx}.bubble.assistant{background:#fff;color:#253854;border:1rpx solid #e0e7f1;border-bottom-left-radius:7rpx}.failed{display:block;margin-top:10rpx;color:#ab4152;font-size:21rpx}.composer{position:fixed;left:0;right:0;bottom:0;display:flex;gap:12rpx;padding:17rpx 25rpx calc(20rpx + env(safe-area-inset-bottom));background:#fff;border-top:1rpx solid #e1e8f2}.composer .m-input{flex:1;min-width:0}.composer .m-button{min-width:125rpx;font-size:24rpx}</style>
