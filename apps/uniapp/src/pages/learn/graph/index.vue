<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import MNavBar from "../../../components/MNavBar.vue";
import { learnApi } from "../../../services/learnApi";
import { graphOf, nodeStatus, type GraphNode } from "../../../features/learn/learnModel";
const nodes=ref<GraphNode[]>([]);const loading=ref(true);const error=ref("");const query=ref("");
const groups=computed(()=>{const filtered=nodes.value.filter(n=>!query.value||n.name.includes(query.value)||n.description.includes(query.value));const map=new Map<string,GraphNode[]>();for(const n of filtered){const label=n.domain||"未分组领域";map.set(label,[...(map.get(label)||[]),n]);}return [...map.entries()].map(([name,items])=>({name,items}));});
async function load(){loading.value=true;error.value="";try{const mapped=graphOf(await learnApi.graph());if(!mapped)throw new Error("图谱数据字段尚未对齐");nodes.value=mapped;}catch(e){nodes.value=[];error.value=e instanceof Error?e.message:"图谱暂不可用";}finally{loading.value=false;}}
function open(n:GraphNode){uni.navigateTo({url:`/pages/learn/node/index?id=${n.id}`});}
function inputValue(event:unknown):string{const e=event as {detail?:{value?:unknown}};return typeof e?.detail?.value==="string"?e.detail.value:"";}
onLoad(()=>{void load();});
</script>
<template><view class="mobile-page"><MNavBar title="知识图谱" back/><scroll-view scroll-y class="screen"><view class="page-scroll"><view class="head"><text class="eyebrow">KNOWLEDGE GRAPH</text><text class="page-title">沿着关系，找到下一步</text><text class="muted">领域分组和掌握状态均读取服务端图谱。</text></view><input class="m-input search" :value="query" placeholder="搜索知识点" @input="query=inputValue($event)"/>
  <view v-if="loading" class="m-state">正在读取图谱…</view><view v-else-if="error" class="m-state error">{{error}}<button class="retry" @click="load">重试</button></view><view v-else-if="!groups.length" class="m-state">{{query?'没有匹配知识点':'图谱暂无已发布节点'}}</view>
  <view v-for="group in groups" :key="group.name"><view class="section-title">{{group.name}} <text class="muted">{{group.items.length}} 个节点</text></view><button v-for="n in group.items" :key="n.id" class="m-list-row node" @click="open(n)"><view class="dot" :class="{mastered:nodeStatus(n)==='已掌握',weak:nodeStatus(n)==='待巩固',locked:n.locked===true,preparing:n.preparing===true}"/><view class="body"><text class="title">{{n.name}}</text><text class="meta">{{nodeStatus(n)}} · {{n.score!==null&&n.insufficientSample===false?n.score+'%':'掌握度待核实'}}</text></view><text class="chevron">›</text></button></view>
</view></scroll-view></view></template>
<style scoped>.screen{height:calc(100vh - 92rpx)}.head{display:flex;flex-direction:column;gap:12rpx;margin:8rpx 0 27rpx}.search{margin-bottom:20rpx}.node{width:100%;text-align:left}.dot{width:19rpx;height:19rpx;border-radius:99rpx;background:#bcc8d9}.dot.mastered{background:#31b66d}.dot.weak{background:#f4ae42}.dot.locked{background:#e47763}.dot.preparing{background:#9972db}.retry{margin-top:15rpx;color:#2454cc;background:#eef3ff}</style>
