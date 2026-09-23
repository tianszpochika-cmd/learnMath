<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getAuthApi, getAppHttp } from "../services/client";
import { cancelAccountDeletion, markNoticesRead, readAccount, readNotices, requestDataExport, type AccountView, type Notice, type NotificationType } from "../services/me";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const section = computed(() => route.path.endsWith("/account") ? "account" : route.path.endsWith("/settings") ? "settings" : "notifications");
const notices = ref<Notice[]>([]);
const account = ref<AccountView | null>(null);
const loading = ref(true);
const busy = ref(false);
const error = ref("");
const notice = ref("");
const tab = ref<NotificationType>("SYSTEM");
const legalOpen = ref<"terms" | "privacy" | null>(null);
const legalText = ref("");
const tabs: Array<{ key: NotificationType; label: string }> = [
  { key: "SYSTEM", label: "系统" }, { key: "LEARNING", label: "学习" },
  { key: "COMMUNITY", label: "社区" }, { key: "MODERATION", label: "审核" },
];
const filtered = computed(() => notices.value.filter((item) => item.type === tab.value));
const unread = computed(() => notices.value.filter((item) => !item.read).length);
const deletionPending = computed(() => ["pending", "cooling", "cooldown"].includes((account.value?.status || "").toLowerCase()));

async function load() {
  loading.value = true;
  error.value = "";
  try {
    if (section.value === "notifications") notices.value = await readNotices();
    if (section.value === "account" || section.value === "settings") account.value = await readAccount();
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "个人信息暂时无法读取。"; }
  finally { loading.value = false; }
}

async function readCurrentTab() {
  const ids = filtered.value.filter((item) => !item.read).map((item) => item.id);
  if (!ids.length || busy.value) return;
  busy.value = true; error.value = "";
  try { await markNoticesRead(ids); notices.value = await readNotices(); notice.value = `当前已加载通知中，${ids.length} 条的已读状态已同步。`; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "标记已读失败。"; }
  finally { busy.value = false; }
}

async function exportData() {
  if (busy.value) return;
  busy.value = true; error.value = ""; notice.value = "";
  try { await requestDataExport(); notice.value = "导出申请已受理。下载链接会通过站内通知发送，链接有效期为 7 天。"; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "导出申请未确认，请重试。"; }
  finally { busy.value = false; }
}

async function cancelDeletion() {
  if (!deletionPending.value || busy.value) return;
  busy.value = true; error.value = ""; notice.value = "";
  try { await cancelAccountDeletion(); account.value = await readAccount(); notice.value = "撤销申请已由服务端确认。"; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "撤销未确认，请重试。"; }
  finally { busy.value = false; }
}

async function openLegal(type: "terms" | "privacy") {
  legalOpen.value = type; legalText.value = ""; error.value = "";
  try {
    const response = await getAppHttp().request<unknown>({ method: "GET", path: "/api/app/v1/legal/" + type });
    const value = response && typeof response === "object" ? response as Record<string, unknown> : {};
    legalText.value = typeof value.content === "string" ? value.content : "当前协议正文暂不可用。";
  } catch { legalText.value = "当前协议正文暂不可用，请稍后重试。"; }
}

async function logout() {
  if (busy.value) return;
  busy.value = true; error.value = "";
  try { await getAuthApi().auth.logout(); auth.clear(); await router.replace("/login"); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "退出未确认，请重试。"; }
  finally { busy.value = false; }
}

watch(section, () => { notice.value = ""; void load(); });
onMounted(() => { void load(); });
</script>

<template>
  <div class="me-page"><header class="hero"><p class="eyebrow">YOUR SPACE · 我的空间</p><h1>{{ account?.nickname || "继续你的学习旅程" }}</h1><p>通知、设置与个人数据都以当前账号的服务端状态为准。</p></header>
    <main class="main"><nav class="sections" aria-label="我的空间"><RouterLink to="/me/notifications" :aria-current="section === 'notifications' ? 'page' : undefined">通知<span v-if="unread" class="unread">{{ unread }}</span></RouterLink><RouterLink to="/me/settings" :aria-current="section === 'settings' ? 'page' : undefined">设置</RouterLink><RouterLink to="/me/account" :aria-current="section === 'account' ? 'page' : undefined">账号与数据</RouterLink></nav>
      <p v-if="loading" class="state" role="status">正在读取当前账号信息…</p><p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="notice" class="success" role="status">{{ notice }}</p>
      <section v-if="!loading && section === 'notifications'" class="panel"><div class="panel-head"><div><p class="eyebrow">INBOX</p><h2>通知中心</h2></div><button type="button" :disabled="busy || !filtered.some((item) => !item.read)" @click="readCurrentTab">标记当前已加载的未读通知</button></div><div class="tabs" role="group" aria-label="通知类型"><button v-for="item in tabs" :key="item.key" type="button" :aria-pressed="tab === item.key" @click="tab = item.key">{{ item.label }}</button></div><div v-if="filtered.length" class="notice-list"><article v-for="item in filtered" :key="item.id" class="notice-row"><span class="dot" :class="{ read: item.read }" aria-hidden="true"/><div><strong>{{ item.title }}</strong><small>{{ item.createdAt || "时间待同步" }}</small></div><span>{{ item.read ? "已读" : "未读" }}</span></article></div><p v-else class="empty">当前分类没有服务端通知。</p></section>
      <section v-if="!loading && section === 'settings'" class="panel"><p class="eyebrow">PREFERENCES</p><h2>设置</h2><div class="setting-row"><div><strong>用户协议与隐私政策</strong><p>阅读当前公开版本；协议状态以服务端为准。</p></div><div class="row-actions"><button type="button" @click="openLegal('terms')">用户协议</button><button type="button" @click="openLegal('privacy')">隐私政策</button></div></div><div class="setting-row"><div><strong>学习统计</strong><p>查看真实学习记录与趋势。</p></div><RouterLink to="/report">打开 →</RouterLink></div><div class="setting-row"><div><strong>学习计划</strong><p>查看任务、建议与版本状态。</p></div><RouterLink to="/plans">打开 →</RouterLink></div><div class="setting-row"><div><strong>退出登录</strong><p>退出后将清除当前用户在本设备尚未同步的作答草稿。</p></div><button type="button" :disabled="busy" @click="logout">退出登录</button></div></section>
      <section v-if="!loading && section === 'account'" class="account-grid"><div class="panel"><p class="eyebrow">DATA EXPORT</p><h2>导出我的数据</h2><p>提交申请后，导出文件的下载链接通过站内通知发送，有效期为 7 天。这里不生成临时下载链接。</p><button type="button" class="primary" :disabled="busy" @click="exportData">{{ busy ? "提交中…" : "申请数据导出" }}</button></div><div class="panel danger-panel"><p class="eyebrow">ACCOUNT</p><h2>注销与冷静期</h2><p v-if="deletionPending">当前账号处于注销冷静期。{{ account?.deletionDueAt ? `预计结束：${account.deletionDueAt}` : '结束时间以服务端通知为准。' }}</p><p v-else-if="account?.status">当前账号状态：{{ account.status }}。</p><p v-else>服务端尚未返回可核对的注销状态。</p><button v-if="deletionPending" type="button" :disabled="busy" @click="cancelDeletion">撤销注销申请</button><p class="boundary">发起注销须完成二次验证。当前接口文档未定义验证请求字段，入口待契约补齐后开放；页面不会在本地模拟进入冷静期。</p></div></section>
    </main>
    <div v-if="legalOpen" class="overlay" @click.self="legalOpen = null"><section class="legal-dialog" role="dialog" aria-modal="true" :aria-label="legalOpen === 'terms' ? '用户协议' : '隐私政策'"><div class="legal-head"><h2>{{ legalOpen === "terms" ? "用户协议" : "隐私政策" }}</h2><button type="button" @click="legalOpen = null">关闭</button></div><div class="legal-content">{{ legalText || "正在读取公开协议…" }}</div></section></div>
  </div>
</template>

<style scoped>
.me-page{min-height:100vh;background:var(--bg,#f8fafc);color:var(--ink,#0f172a)}.hero{padding:43px max(24px,calc((100vw - 1000px)/2));background:linear-gradient(125deg,#102245,#273e75);color:#fff}.eyebrow{margin:0 0 8px;color:var(--brand,#4e7bff);font-size:11px;font-weight:850;letter-spacing:.17em}.hero .eyebrow{color:#9db8ff}.hero h1{margin:0;font:700 clamp(28px,4vw,42px) var(--serif,Georgia,serif)}.hero>p:last-child{color:#d2ddf2;line-height:1.8}.main{max-width:1000px;margin:0 auto;padding:25px 24px 60px}.sections{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:23px}.sections a{display:inline-flex;align-items:center;gap:7px;min-height:42px;padding:9px 17px;border:1px solid var(--line);border-radius:99px;background:var(--card,#fff);color:var(--ink2);font-weight:750}.sections a[aria-current=page]{border-color:var(--brand);background:var(--brand-soft);color:var(--brand)}.unread{display:grid;place-items:center;min-width:20px;height:20px;border-radius:99px;background:var(--brand);color:#fff;font-size:11px}.panel{padding:27px;border:1px solid var(--line);border-radius:19px;background:var(--card);box-shadow:var(--shadow)}.panel h2{margin:0 0 14px;font:700 27px var(--serif,Georgia,serif)}.panel p{line-height:1.7;color:var(--ink3)}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:14px}.panel-head button,.setting-row button,.row-actions button,.account-grid button{min-height:42px;padding:8px 14px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);font-weight:750}.panel button:disabled{opacity:.5}.tabs{display:flex;flex-wrap:wrap;gap:6px;margin-top:22px;padding:5px;border:1px solid var(--line);border-radius:11px;background:var(--soft)}.tabs button{min-height:38px;padding:7px 15px;border:0;border-radius:8px;background:transparent;color:var(--ink2)}.tabs button[aria-pressed=true]{background:var(--card);color:var(--brand);font-weight:800}.notice-list{margin-top:15px}.notice-row{display:flex;align-items:center;gap:13px;padding:17px 4px;border-bottom:1px solid var(--line)}.notice-row>div{flex:1}.notice-row strong{display:block}.notice-row small{display:block;margin-top:4px;color:var(--ink3)}.notice-row>span:last-child{color:var(--ink3);font-size:12px}.dot{width:9px;height:9px;border-radius:50%;background:var(--brand)}.dot.read{background:var(--line)}.empty{margin-top:18px;padding:25px;background:var(--soft);border-radius:11px;text-align:center}.setting-row{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 0;border-top:1px solid var(--line)}.setting-row strong{font-size:16px}.setting-row p{margin:4px 0 0;font-size:13px}.setting-row a{color:var(--brand);font-weight:800}.row-actions{display:flex;gap:7px;flex-wrap:wrap}.account-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.account-grid .primary{background:var(--brand);border-color:var(--brand);color:#fff}.danger-panel{border-color:var(--danger,#b91c1c)}.boundary{margin-top:20px;padding:13px;border-radius:9px;background:var(--soft);font-size:13px}.state,.error,.success{padding:13px 16px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink2)}.error{border-color:var(--danger);background:var(--danger-bg);color:var(--danger)}.success{border-color:var(--good);background:var(--good-bg);color:var(--good)}.overlay{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:18px;background:#07122cb8}.legal-dialog{width:min(100%,700px);max-height:85vh;display:flex;flex-direction:column;padding:26px;border-radius:18px;background:var(--card);color:var(--ink)}.legal-head{display:flex;justify-content:space-between;align-items:center}.legal-head h2{font:700 27px var(--serif)}.legal-head button{min-height:40px;padding:8px 12px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink)}.legal-content{overflow:auto;white-space:pre-wrap;line-height:1.8}
@media(max-width:740px){.account-grid{grid-template-columns:1fr}.panel-head,.setting-row{align-items:flex-start;flex-direction:column}.hero{padding:30px 20px}.main{padding:16px}.panel{padding:21px}}
</style>
