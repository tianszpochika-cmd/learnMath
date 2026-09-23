<script setup lang="ts">
import { computed, ref } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import MNavBar from "../../components/MNavBar.vue";
import { formulaAccessFromMarker, formulaApi, type FormulaCard } from "../../services/resource";
const formulas = ref<FormulaCard[]>([]), search = ref(""), activeSearch = ref(""), domain = ref(""), tier = ref<number | null>(null), page = ref(1), more = ref(false), loading = ref(false), error = ref(""), access = ref<"blocked"|"reference"|"full">("full");
const domains = computed(() => [...new Set(formulas.value.map(f => f.domain).filter(Boolean))]);
const proofLabel = (status: number | null) => ({ 1: "严格证明", 2: "推导确立", 3: "经验拟合", 4: "尚未证明" })[status as 1] || "证明状态待确认";
async function load(reset = true) {
  access.value = formulaAccessFromMarker();
  if (access.value === "blocked") { formulas.value = []; error.value = "当前受限作答不开放公式馆，交卷后再查看。"; return; }
  if (loading.value) return;
  loading.value = true; error.value = "";
  try {
    const nextPage = reset ? 1 : page.value + 1;
    const rows = await formulaApi.list({ search: activeSearch.value || undefined, domain: domain.value || undefined, tier: tier.value ?? undefined, page: nextPage, size: 20 });
    formulas.value = reset ? rows : [...formulas.value, ...rows]; page.value = nextPage; more.value = rows.length === 20;
  } catch (e) { error.value = e instanceof Error ? e.message : "公式列表暂不可用"; if (reset) formulas.value = []; }
  finally { loading.value = false; }
}
function submitSearch() { activeSearch.value = search.value.trim(); void load(); }
function setDomain(value: string) { domain.value = value; void load(); }
function setTier(value: number | null) { tier.value = value; void load(); }
function openFormula(id: string) { uni.navigateTo({ url: `/pages/formula/index?id=${encodeURIComponent(id)}` }); }
onShow(() => { void load(); }); onPullDownRefresh(() => { void load().finally(() => uni.stopPullDownRefresh()); });
</script>
<template><view class="mobile-page formulas"><MNavBar title="公式馆" back /><scroll-view scroll-y class="scroll"><view class="page-scroll"><view class="hero"><text class="eyebrow">FORMULA ATLAS</text><text class="hero-title">看懂公式，也看懂边界</text><text class="hero-copy">从成立条件开始，逐步追到符号、推导与应用。</text></view>
  <view v-if="access==='reference'" class="m-state warning">当前作答仅开放公式、符号与条件参考；推导和小练在交卷后开放。</view><view v-if="access!=='blocked'" class="search-row"><input v-model="search" class="m-input" placeholder="搜索公式正名或别名" confirm-type="search" @confirm="submitSearch" /><button @click="submitSearch">搜索</button></view>
  <scroll-view v-if="access!=='blocked'" scroll-x class="filter-scroll"><view class="filter-row"><button :class="{active:!domain}" @click="setDomain('')">全部领域</button><button v-for="item in domains" :key="item" :class="{active:domain===item}" @click="setDomain(item)">{{ item }}</button></view></scroll-view><view v-if="access!=='blocked'" class="tier-row"><button :class="{active:tier===null}" @click="setTier(null)">全部难度</button><button v-for="level in 5" :key="level" :class="{active:tier===level}" @click="setTier(level)">T{{ level }}</button></view>
  <view v-if="loading && !formulas.length" class="m-state">正在读取公式…</view><view v-if="error" class="m-state error">{{ error }}<button v-if="access!=='blocked'" class="retry" @click="load()">重试</button></view><view v-if="!loading && !error && !formulas.length" class="m-state">当前筛选下没有已发布公式。</view>
  <view v-for="formula in formulas" :key="formula.id" class="m-card formula-card" @click="openFormula(formula.id)"><view class="card-head"><text class="domain">{{ formula.domain || '领域待确认' }}{{ formula.tier === null ? '' : ` · T${formula.tier}` }}</text><text class="proof" :class="{caution:(formula.proofStatus ?? 0)>=3}">{{ proofLabel(formula.proofStatus) }}</text></view><text class="name">{{ formula.name || '公式未命名' }}</text><text class="expression">{{ formula.latex || '表达式暂未返回' }}</text><text class="condition">成立条件：{{ formula.condition || '详情中核对' }}</text><text class="card-link">查看七区详情 ›</text></view><button v-if="more" class="m-button secondary more" :disabled="loading" @click="load(false)">{{ loading ? '正在加载…' : '加载更多' }}</button>
  </view></scroll-view></view></template>
<style scoped>.formulas{display:flex;flex-direction:column;height:100vh}.scroll{flex:1;min-height:0}.hero{padding:34rpx;border-radius:33rpx;background:linear-gradient(145deg,#21355c,#445f9c);color:#fff}.hero .eyebrow{color:#a9c4ff}.hero-title{display:block;font-size:39rpx;font-weight:850}.hero-copy{display:block;margin-top:13rpx;color:#e2eaff;font-size:23rpx;line-height:1.6}.search-row{display:flex;gap:9rpx;margin:25rpx 0}.search-row input{flex:1;min-width:0}.search-row button{padding:0 24rpx;border-radius:20rpx;background:#305fc2;color:#fff;font-size:23rpx}.filter-scroll{width:100%;white-space:nowrap}.filter-row{display:flex;gap:9rpx}.filter-row button,.tier-row button{padding:12rpx 20rpx;border-radius:99rpx;background:#fff;color:#5e708a;font-size:21rpx}.filter-row button.active,.tier-row button.active{background:#dfe9ff;color:#2556c1;font-weight:800}.tier-row{display:flex;gap:8rpx;margin:15rpx 0 25rpx}.tier-row button{flex:1;padding:12rpx 0}.formula-card{margin-bottom:16rpx}.card-head{display:flex;justify-content:space-between;gap:12rpx}.domain{color:#4d6aa0;font-size:21rpx;font-weight:750}.proof{color:#247457;font-size:20rpx}.proof.caution{color:#a34741}.name{display:block;margin-top:17rpx;font-size:30rpx;font-weight:800}.expression{display:block;margin:18rpx 0;overflow-x:auto;color:#233b70;font-size:30rpx;font-family:Georgia,serif;white-space:nowrap}.condition{display:block;padding:13rpx 16rpx;border-left:5rpx solid #d86162;background:#fff2f2;color:#9e363c;font-size:22rpx}.card-link{display:block;margin-top:18rpx;color:#2c5bc4;text-align:right;font-size:21rpx;font-weight:750}.more{margin-top:25rpx}.retry{display:block;margin-top:12rpx;background:transparent;color:#9e2d44;text-align:left;font-size:23rpx}</style>
