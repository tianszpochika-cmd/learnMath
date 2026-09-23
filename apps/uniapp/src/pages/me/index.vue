<script setup lang="ts">
import { ref } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import MTabBar from "../../components/MTabBar.vue";
import { displayError, projectProfile, type MobileProfile } from "../../features/mobileData";
import { enterTab, unavailable } from "../../features/tabAccess";
import { clearMobileSession, getMobileAuth } from "../../services/mobileClient";
import { mobileTabApi } from "../../services/mobileTabApi";

const profile = ref<MobileProfile | null>(null);
const loading = ref(false);
const error = ref("");
const loaded = ref(false);
const signingOut = ref(false);
const shortcuts = [
  { icon: "▦", label: "打卡日历", url: "/pages/game/checkin/index" },
  { icon: "◈", label: "积分明细", url: "/pages/game/points/index" },
  { icon: "☆", label: "收藏笔记", url: "/pages/learn/library/index" },
  { icon: "✎", label: "我的作答", url: "/pages/practice/index" },
  { icon: "♜", label: "挑战排行", url: "/pages/game/rank/index" },
  { icon: "♢", label: "通知", url: "/pages/system/notices/index" },
  { icon: "⚙", label: "设置", url: "/pages/system/settings/index" },
  { icon: "◇", label: "学习路径", url: "/pages/paths/index" },
] as const;
async function load(): Promise<void> {
  loading.value = true; error.value = "";
  try {
    const result = projectProfile(await mobileTabApi.profile());
    if (!result) throw new Error("个人资料接口未返回可识别的数据。");
    profile.value = result; loaded.value = true;
  } catch (cause) { error.value = displayError(cause); }
  finally { loading.value = false; }
}
function open(url: string): void {
  if (url === "/pages/practice/index" || url === "/pages/paths/index") { uni.switchTab({ url }); return; }
  uni.navigateTo({ url, fail: unavailable });
}
function askSignOut(): void {
  if (signingOut.value) return;
  uni.showModal({ title: "退出登录", content: "退出后，此设备需重新验证手机号才能查看个人学习记录。", success: (result) => { if (result.confirm) void signOut(); } });
}
async function signOut(): Promise<void> {
  signingOut.value = true;
  let revoked = true;
  try { await getMobileAuth().logout(); } catch { revoked = false; }
  clearMobileSession(); profile.value = null; loaded.value = false;
  uni.reLaunch({ url: "/pages/login/index", success: () => {
    if (!revoked) uni.showToast({ title: "已退出此设备；远端会话吊销未确认", icon: "none", duration: 3000 });
  } });
  signingOut.value = false;
}
onShow(() => { void enterTab(async () => { if (!loaded.value) await load(); }); });
onPullDownRefresh(() => { void load().finally(() => uni.stopPullDownRefresh()); });
</script>
<template>
  <view class="mobile-page"><view class="page-scroll with-tab"><text class="eyebrow">YOUR SPACE</text><text class="page-title">我的学习空间</text>
    <view v-if="loading && !loaded" class="m-state">正在读取个人资料…</view><view v-if="error" class="m-state error">{{ error }} <button class="retry" @click="load">重试</button></view>
    <view class="m-card profile-card"><view class="profile-avatar">{{ profile?.nickname?.slice(0, 1) || 'π' }}</view><view class="profile-copy"><text class="profile-name">{{ profile?.nickname || '资料未返回' }}</text><text class="muted">{{ profile?.rank || '段位暂未返回' }}{{ profile?.level ? ` · ${profile.level}` : '' }}</text></view></view>
    <view class="stats"><view class="stat-card"><text class="stat-value">{{ profile?.points ?? '—' }}</text><text>积分余额</text></view><view class="stat-card"><text class="stat-value">{{ profile?.unreadCount ?? '—' }}</text><text>未读通知</text></view></view>
    <view class="section-title"><text>常用入口</text></view><view class="shortcut-grid"><button v-for="item in shortcuts" :key="item.label" class="shortcut" @click="open(item.url)"><text class="shortcut-icon">{{ item.icon }}</text><text>{{ item.label }}</text></button></view>
    <view class="section-title"><text>账户与数据</text></view><view class="m-list-row" @click="open('/pages/system/export/index')"><view class="body"><text class="title">导出学习数据</text><text class="meta">由服务端生成可下载文件</text></view><text class="chevron">›</text></view><view class="m-list-row" @click="open('/pages/system/deletion/index')"><view class="body"><text class="title">账号注销</text><text class="meta">二次验证与冷静期说明</text></view><text class="chevron">›</text></view>
    <button class="signout" :disabled="signingOut" @click="askSignOut">{{ signingOut ? '正在退出…' : '退出登录' }}</button>
  </view><MTabBar current="me" /></view>
</template>
<style scoped>
.profile-card{display:flex;align-items:center;gap:24rpx;margin-top:31rpx}.profile-avatar{display:grid;place-items:center;width:105rpx;height:105rpx;flex:none;border-radius:31rpx;background:linear-gradient(135deg,#4f7bff,#8b5cf6);color:#fff;font-size:46rpx;font-weight:850}.profile-copy{flex:1}.profile-name{display:block;margin-bottom:7rpx;font-size:34rpx;font-weight:850}.stats{display:grid;grid-template-columns:1fr 1fr;gap:17rpx}.stat-card{display:flex;flex-direction:column;gap:7rpx;padding:23rpx 27rpx;border:1rpx solid #e0e7f1;border-radius:25rpx;background:#fff;color:#64748b;font-size:22rpx}.stat-value{color:#1e3150;font-size:39rpx;font-weight:850}.shortcut-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13rpx}.shortcut{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12rpx;min-height:136rpx;padding:10rpx 3rpx;border:1rpx solid #e2e9f3;border-radius:23rpx;background:#fff;color:#52647d;font-size:21rpx}.shortcut-icon{display:grid;place-items:center;width:53rpx;height:53rpx;border-radius:16rpx;background:#edf3ff;color:#2f6bff;font-size:33rpx;font-weight:800}.signout{width:100%;min-height:88rpx;margin-top:39rpx;border:1rpx solid #ebcbd1;border-radius:22rpx;background:#fff;color:#a83951;font-size:26rpx;font-weight:750}.retry{display:inline;background:transparent;color:#9e2d44;text-decoration:underline;font-size:23rpx}
</style>
