<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import MNavBar from "../../../components/MNavBar.vue";
import { attemptAction, readAttempt } from "../../../services/attemptApi";
import { finished, reportReady, objectiveLabel, type Attempt } from "../../../features/attempt/attemptModel";
const id=ref("");const report=ref<Attempt|null>(null);const loading=ref(true);const error=ref("");const note=ref("");const busySeq=ref<number|null>(null);
const essays=computed(()=>report.value?.questions.filter(q=>q.kind==="essay")||[]);
async function load(){loading.value=true;error.value="";try{report.value=await readAttempt(id.value);}catch(e){report.value=null;error.value=e instanceof Error?e.message:"报告读取失败";}finally{loading.value=false;}}
async function assess(seq:number,value:0|1|2|3){if(!report.value||!reportReady(report.value)||report.value.revision===null||busySeq.value!==null)return;busySeq.value=seq;error.value="";note.value="";
  try{await attemptAction(id.value,"self-assess",{seq,assess:value,expectedRevision:report.value.revision,requestId:`${Date.now()}-${Math.random().toString(36).slice(2)}`});await load();note.value="自评已由服务端确认；客观成绩不因此重新结算。";}
  catch(e){error.value=e instanceof Error?e.message:"自评未保存";}finally{busySeq.value=null;}}
function toWrong(){uni.navigateTo({url:"/pages/attempt/wrongbook/index"});}
function toPaper(){uni.navigateTo({url:`/pages/attempt/paper/index?id=${encodeURIComponent(id.value)}`});}
onLoad(q=>{id.value=String(q?.id||q?.attemptId||"");void load();});
</script>
<template><view class="mobile-page"><MNavBar title="学习报告" back/><scroll-view scroll-y class="screen"><view class="page-scroll">
  <view class="head"><text class="eyebrow">LEARNING REPORT</text><text class="page-title">看清结果，再决定下一步</text><text>客观成绩与解答题自评分开展示</text></view>
  <view v-if="loading" class="m-state">正在读取服务端报告…</view><view v-else-if="!report" class="m-state error">{{error||'报告暂不可用'}}<button class="retry" @click="load">重试</button></view>
  <view v-else-if="!finished(report)" class="m-card"><text class="m-card-title">作答尚未结束</text><text class="muted">交卷后才能查看成绩和解析。</text><button class="m-button secondary" @click="toPaper">继续作答</button></view>
  <template v-else><view v-if="!reportReady(report)" class="m-state warning">交卷已接收，服务端仍在判分；此时不提前展示答案与解析。<button class="retry" @click="load">刷新报告</button></view><view v-else class="score m-card"><text class="eyebrow">客观部分</text><text class="score-value">{{objectiveLabel(report)}}</text><text class="muted">只统计客观题；解答题自评不并入这一成绩。</text></view>
    <view class="summary"><view class="m-card"><text class="muted">报告状态</text><text class="metric">{{report.state==='pending_self_assess'?'待继续自评':report.state==='finalized'?'已完成':'判分处理中'}}</text></view><view class="m-card"><text class="muted">待自评题数</text><text class="metric">{{report.pendingSelfAssess??'待服务端确认'}}</text></view></view>
    <view v-if="reportReady(report)" class="section-title">解答题自评</view><view v-if="reportReady(report)&&!essays.length" class="m-state">服务端未返回可自评题目。</view>
    <view v-for="q in reportReady(report)?essays:[]" :key="q.seq" class="m-card essay"><text class="m-card-title">第 {{q.seq}} 题</text><text class="stem">{{q.stem}}</text><text v-if="q.analysis" class="analysis">服务端对照解析：{{q.analysis}}</text><view class="assess"><button v-for="choice in [{v:0,t:'不会'},{v:1,t:'半会'},{v:2,t:'会'},{v:3,t:'暂不评价'}] as const" :key="choice.v" :class="{selected:q.selfAssess===choice.v}" :disabled="busySeq!==null||report.revision===null" @click="assess(q.seq,choice.v)">{{choice.t}}</button></view></view>
    <view v-if="note" class="m-state success">{{note}}</view><view v-if="error" class="m-state error">{{error}}</view><button class="m-button secondary" @click="toWrong">查看错题与断链证据</button><text class="footnote">改评仅更新自评证据，不重复结算客观成绩与奖励。</text>
  </template></view></scroll-view></view></template>
<style scoped>.screen{height:calc(100vh - 92rpx)}.head{display:flex;flex-direction:column;gap:12rpx;margin-bottom:26rpx;padding:36rpx;border-radius:31rpx;background:#142b51;color:white}.head .eyebrow{color:#9bbfff}.head .page-title{color:white}.head text:last-child{font-size:24rpx;color:#c7d6ee}.score{border-color:#c2d4ff;background:linear-gradient(145deg,#f1f5ff,#fff)}.score-value{display:block;margin:20rpx 0;font-size:49rpx;font-weight:850;color:#2158d4}.summary{display:flex;gap:14rpx}.summary .m-card{flex:1;min-width:0}.metric{display:block;margin-top:12rpx;font-size:27rpx;font-weight:800;color:#263e68}.stem{display:block;white-space:pre-wrap;line-height:1.7;margin:18rpx 0;color:#2d3e5a}.analysis{display:block;padding:18rpx;background:#f4f7fc;border-radius:16rpx;color:#4f6078;font-size:23rpx;line-height:1.6}.assess{display:flex;flex-wrap:wrap;gap:10rpx;margin-top:22rpx}.assess button{min-height:72rpx;padding:12rpx 20rpx;border:1rpx solid #d8e3f2;border-radius:15rpx;background:white;color:#415470;font-size:23rpx}.assess button.selected{border-color:#4271ec;background:#ebf2ff;color:#2455d7;font-weight:800}.assess button[disabled]{opacity:.55}.footnote{display:block;margin:16rpx 0 30rpx;color:#718097;font-size:21rpx;line-height:1.5}.retry{margin-top:14rpx;color:#2255cc;background:#eef3ff}</style>
