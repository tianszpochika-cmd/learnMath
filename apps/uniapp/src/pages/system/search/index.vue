<script setup lang="ts">
import { ref } from "vue";
import MNavBar from "../../../components/MNavBar.vue";
import { displayError } from "../../../features/mobileData";
import { searchView, type SearchEntry } from "../../../features/socialSystemModel";
import { socialSystemApi, type SearchType } from "../../../services/socialSystemApi";
const tabs: { key: SearchType; label: string }[] = [{key:"all",label:"全部"},{key:"course",label:"课程"},{key:"question",label:"题目"},{key:"node",label:"知识点"},{key:"topic",label:"专题"},{key:"post",label:"讨论"}];
const query = ref(""), active = ref<SearchType>("all"), results = ref<SearchEntry[] | null>(null), loading = ref(false), error = ref(""), last = ref("");
let requestNo = 0;
async function search(): Promise<void> {
  const q = query.value.trim(); if (q.length < 2) { error.value = "至少输入 2 个字再搜索"; return; }
  const serial = ++requestNo; loading.value = true; error.value = ""; last.value = q;
  try { const view = searchView(await socialSystemApi.search(q, active.value)); if (serial !== requestNo) return; if (!view) throw new Error("搜索结果暂无法读取"); results.value = view; }
  catch (cause) { if (serial === requestNo) { error.value = displayError(cause); results.value = null; } }
  finally { if (serial === requestNo) loading.value = false; }
}
function change(type: SearchType): void { active.value = type; if (last.value) void search(); }
function open(row: SearchEntry): void { if (row.target) uni.navigateTo({ url: row.target }); else uni.showToast({title:"该结果暂无可确认的移动端入口",icon:"none"}); }
function openFormulas(): void { uni.navigateTo({url:"/pages/formulas/index"}); }
</script>
<template><view class="mobile-page"><MNavBar title="全站搜索" back /><view class="page-scroll"><view class="search-box"><input v-model="query" class="m-input" confirm-type="search" focus placeholder="搜索课程、题目、知识点…" @confirm="search" /><button class="m-button" :disabled="loading" @click="search">搜索</button></view><scroll-view scroll-x class="tabs"><view class="tab-row"><button v-for="item in tabs" :key="item.key" :class="{active:active===item.key}" @click="change(item.key)">{{ item.label }}</button></view></scroll-view><view v-if="!last && !error" class="empty"><text class="symbol">⌕</text><text class="m-card-title">从一个问题开始</text><text class="muted">输入关键词，寻找课程与讨论。</text><button class="formula-link" @click="openFormulas">想查公式？打开公式馆 ›</button></view><view v-if="loading" class="m-state">正在搜索“{{ last }}”…</view><view v-if="error" class="m-state error">{{ error }}</view><view v-if="results && !results.length" class="m-state">没有找到“{{ last }}”相关结果，试试更短的关键词。</view><button v-for="row in results ?? []" :key="row.type+'-'+row.id" class="m-list-row result" @click="open(row)"><view class="body"><text class="m-chip">{{ row.type || '结果' }}</text><text class="title">{{ row.title }}</text><text class="meta">{{ row.description || (row.target ? '查看详情' : '移动端详情暂不可打开') }}</text></view><text class="chevron">{{ row.target ? '›' : '' }}</text></button><view v-if="last" class="m-state footnote">当前搜索接口不含公式分类；公式内容请前往公式馆。</view></view></view></template>
<style scoped>.search-box{display:flex;gap:10rpx;margin:12rpx 0 23rpx}.search-box .m-input{flex:1;min-width:0}.search-box .m-button{min-width:120rpx;font-size:23rpx}.tabs{white-space:nowrap;margin-bottom:22rpx}.tab-row{display:flex;gap:10rpx}.tab-row button{min-height:68rpx;min-width:102rpx;padding:0 15rpx;border-radius:18rpx;background:#fff;color:#60728a;font-size:23rpx}.tab-row button.active{background:#2f6bff;color:#fff}.empty{display:flex;align-items:center;flex-direction:column;gap:13rpx;padding:95rpx 20rpx;text-align:center}.symbol{font-size:105rpx;color:#819ee9}.formula-link{margin-top:25rpx;background:transparent;color:#2f6bff;font-size:23rpx}.result{width:100%;text-align:left}.result .title{margin-top:9rpx}.footnote{margin-top:22rpx}</style>
