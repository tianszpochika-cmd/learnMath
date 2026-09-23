<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import MNavBar from "../../../components/MNavBar.vue";
import { displayError } from "../../../features/mobileData";
import { list, obj, rankView, safeId, txt, type RankEntry } from "../../../features/socialSystemModel";
import { socialSystemApi } from "../../../services/socialSystemApi";
const tab = ref<"weekly"|"daily"|"challenge">("weekly"), rows = ref<RankEntry[] | null>(null), challenges = ref<{ id: string; title: string; state: string }[] | null>(null), loading = ref(false), error = ref("");
async function load(): Promise<void> {
  loading.value = true; error.value = "";
  try {
    if (tab.value === "challenge") { const raw = await socialSystemApi.challenges(); const entries = list(raw,"challenges","items","records"); if (!entries) throw new Error("赛事列表暂无法读取"); challenges.value = entries.map((entry) => { const row=obj(entry); return { id:safeId(row.id), title:txt(row.title ?? row.name), state:txt(row.status) }; }).filter((entry) => entry.id && entry.title); }
    else { rows.value = rankView(await socialSystemApi.rank(tab.value)); if (!rows.value) throw new Error("排行榜暂无法读取"); }
  } catch (cause) { error.value = displayError(cause); }
  finally { loading.value = false; }
}
function select(value: typeof tab.value): void { tab.value = value; void load(); }
onShow(() => { void load(); });
</script>
<template><view class="mobile-page"><MNavBar title="同路人" back /><view class="page-scroll"><view class="hero"><text class="eyebrow">KEEP GROWING</text><text class="headline">每一步都有回响</text><text class="muted">榜单按服务端匿名展示；专注自己的进步。</text></view><view class="tabs"><button v-for="item in [{key:'weekly',label:'本周'},{key:'daily',label:'今日'},{key:'challenge',label:'挑战'}]" :key="item.key" :class="{active:tab===item.key}" @click="select(item.key as typeof tab)">{{ item.label }}</button></view><view v-if="loading" class="m-state">正在读取排名…</view><view v-if="error" class="m-state error">{{ error }}<button class="retry" @click="load">重试</button></view><template v-if="!loading && !error"><view v-if="tab!=='challenge' && rows?.length===0" class="m-state">当前还没有上榜记录。</view><view v-for="(row,index) in tab!=='challenge' ? rows ?? [] : []" :key="row.id || index" class="m-list-row rank-row" :class="{ mine:row.mine }"><text class="position">{{ row.position ?? index+1 }}</text><view class="body"><text class="title">{{ row.nickname }} {{ row.mine ? '· 我' : '' }}</text><text class="meta">{{ row.tier || '段位待同步' }}</text></view><text class="score">{{ row.score ?? '—' }}</text></view><view v-if="tab==='challenge' && challenges?.length===0" class="m-state">当前没有开放中的挑战。</view><view v-for="item in tab==='challenge' ? challenges ?? [] : []" :key="item.id" class="m-card"><text class="m-card-title">{{ item.title }}</text><text class="muted">{{ item.state || '赛事状态待同步' }}</text><view class="m-state">参赛入口需由服务端返回考试资格与作答编号后开放。</view></view></template><view class="m-state footnote">接口仅提供周榜、日榜与赛事；总榜暂不展示。</view></view></view></template>
<style scoped>.hero{display:flex;flex-direction:column;gap:10rpx;padding:31rpx;border-radius:30rpx;background:#eef1ff;margin-bottom:22rpx}.headline{font-size:42rpx;font-weight:850;color:#233d86}.tabs{display:flex;gap:10rpx;margin:22rpx 0}.tabs button{flex:1;min-height:72rpx;border-radius:18rpx;background:#fff;color:#60728d;font-size:24rpx}.tabs button.active{background:#2f6bff;color:#fff;font-weight:800}.position{width:55rpx;color:#8b5cf6;font-size:31rpx;font-weight:850}.score{font-size:30rpx;color:#245acf;font-weight:850}.mine{border-color:#7c9fff;background:#f1f5ff}.retry{display:inline;background:transparent;color:inherit;text-decoration:underline;font-size:23rpx}.footnote{margin-top:24rpx}</style>
