<script setup lang="ts">
import { computed, ref } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import MTabBar from "../../components/MTabBar.vue";
import { arrayValue, displayError, numberValue, projectPosts, projectTotal, stringValue, type MobilePost } from "../../features/mobileData";
import { enterTab, unavailable } from "../../features/tabAccess";
import { mobileTabApi } from "../../services/mobileTabApi";

const sort = ref<"latest" | "featured">("latest");
const posts = ref<MobilePost[] | null>(null);
const hot = ref<string[]>([]);
const pendingCount = ref<number | null>(null);
const page = ref(1);
const total = ref<number | null>(null);
const loading = ref(false);
const moreLoading = ref(false);
const error = ref("");
const loaded = ref(false);
const hasMore = computed(() => posts.value !== null && (total.value !== null ? posts.value.length < total.value : posts.value.length >= page.value * 20));
async function load(reset = true): Promise<void> {
  if (reset) { page.value = 1; loading.value = true; }
  else moreLoading.value = true;
  error.value = "";
  try {
    const result = await mobileTabApi.posts(sort.value, page.value);
    const projected = projectPosts(result);
    if (projected === null) throw new Error("帖子接口未返回可识别的列表。");
    posts.value = reset ? projected : [...(posts.value ?? []), ...projected];
    total.value = projectTotal(result);
    loaded.value = true;
  } catch (cause) { if (!reset) page.value = Math.max(1, page.value - 1); error.value = displayError(cause); }
  finally { loading.value = false; moreLoading.value = false; }
}
async function loadSupporting(): Promise<void> {
  const [mine, topics] = await Promise.allSettled([mobileTabApi.mine(), mobileTabApi.hot()]);
  if (mine.status === "fulfilled") {
    const source = mine.value && typeof mine.value === "object" ? mine.value as Record<string, unknown> : {};
    const count = numberValue(source.pendingCount);
    if (count !== null) pendingCount.value = count;
    else {
      const minePosts = projectPosts(source);
      if (minePosts !== null) pendingCount.value = minePosts.filter((post) => post.status === "1" || post.status === "pending").length;
    }
  }
  if (topics.status === "fulfilled") {
    const rows = arrayValue(topics.value, "items", "topics", "list");
    if (rows) hot.value = rows.map((entry) => {
      const row = entry && typeof entry === "object" && !Array.isArray(entry) ? entry as Record<string, unknown> : {};
      return stringValue(row.name ?? row.title);
    }).filter(Boolean).slice(0, 5);
  }
}
function changeSort(next: "latest" | "featured"): void { if (sort.value === next) return; sort.value = next; posts.value = null; void load(); }
function more(): void { if (!hasMore.value || moreLoading.value) return; page.value++; void load(false); }
function openPost(id: number): void { uni.navigateTo({ url: "/pages/social/post/index?id=" + id, fail: unavailable }); }
function compose(): void { uni.navigateTo({ url: "/pages/social/compose/index", fail: unavailable }); }
function retry(): void { void load(true); }
onShow(() => { void enterTab(async () => { if (!loaded.value) { await Promise.all([load(), loadSupporting()]); } }); });
onPullDownRefresh(() => { void Promise.all([load(), loadSupporting()]).finally(() => uni.stopPullDownRefresh()); });
</script>
<template>
  <view class="mobile-page"><view class="page-scroll with-tab">
    <view class="head"><view><text class="eyebrow">LEARN TOGETHER</text><text class="page-title">一起把这步想明白</text></view><button class="compose" aria-label="发帖" @click="compose">＋</button></view>
    <view v-if="pendingCount !== null && pendingCount > 0" class="m-state warning">{{ pendingCount }} 篇我的帖子正在审核中，仅自己可见。审核通过后才会公开。</view>
    <view class="filters"><button :class="{ active: sort === 'latest' }" @click="changeSort('latest')">最新</button><button :class="{ active: sort === 'featured' }" @click="changeSort('featured')">精华</button></view>
    <scroll-view v-if="hot.length" scroll-x class="topic-scroll"><view class="topic-list"><text v-for="topic in hot" :key="topic" class="m-chip"># {{ topic }}</text></view></scroll-view>
    <view v-if="loading && posts === null" class="m-state">正在读取社区内容…</view><view v-if="error" class="m-state error">{{ error }} <button class="retry" @click="retry">重试</button></view><view v-if="posts !== null && !posts.length && !error" class="m-state">目前还没有可展示的帖子。你可以发布一个问题，等待审核后与大家讨论。</view>
    <view v-for="post in posts" :key="post.id" class="m-card post" @click="openPost(post.id)"><view class="post-meta"><view class="avatar">{{ post.author?.slice(0, 1) || '·' }}</view><text>{{ post.author || '作者未返回' }}</text><text v-if="post.topic" class="topic">{{ post.topic }}</text></view><text v-if="post.title" class="post-title">{{ post.title }}</text><text v-if="post.content" class="post-content">{{ post.content.slice(0, 170) }}</text><view class="post-foot"><text>{{ post.replies === null ? '回复数未返回' : `${post.replies} 条回复` }}</text><text>查看讨论 ›</text></view></view>
    <button v-if="hasMore" class="load-more" :disabled="moreLoading" @click="more">{{ moreLoading ? '加载中…' : '加载更多帖子' }}</button>
  </view><MTabBar current="community" /></view>
</template>
<style scoped>
.head{display:flex;align-items:center;justify-content:space-between;gap:15rpx}.compose{display:grid;place-items:center;width:88rpx;height:88rpx;flex:none;margin:0;border-radius:26rpx;background:#edf3ff;color:#2f6bff;font-size:52rpx}.filters{display:flex;gap:12rpx;margin:28rpx 0 18rpx}.filters button{min-width:125rpx;min-height:72rpx;padding:0 24rpx;border-radius:18rpx;background:#e9eef6;color:#52647d;font-size:24rpx}.filters button.active{background:#2f6bff;color:#fff;font-weight:800}.topic-scroll{width:100%;margin-bottom:22rpx;white-space:nowrap}.topic-list{display:flex;gap:12rpx}.post{padding:26rpx}.post-meta{display:flex;align-items:center;gap:11rpx;color:#4d5e77;font-size:22rpx}.avatar{display:grid;place-items:center;width:53rpx;height:53rpx;border-radius:50%;background:#edf3ff;color:#2f6bff;font-size:26rpx;font-weight:800}.topic{margin-left:auto;color:#2f6bff}.post-title{display:block;margin-top:18rpx;font-size:30rpx;font-weight:850}.post-content{display:block;margin-top:12rpx;color:#41536b;font-size:26rpx;line-height:1.6;word-break:break-word}.post-foot{display:flex;justify-content:space-between;margin-top:23rpx;padding-top:16rpx;border-top:1rpx solid #e5eaf3;color:#74849b;font-size:22rpx}.post-foot text:last-child{color:#2f6bff}.load-more{width:100%;min-height:88rpx;margin:14rpx 0 30rpx;border-radius:22rpx;background:#fff;color:#2f6bff;font-size:24rpx}.retry{display:inline;background:transparent;color:#9e2d44;text-decoration:underline;font-size:23rpx}
</style>
