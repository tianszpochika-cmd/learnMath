<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  NOTIFY_TABS,
  cancelView,
  exportLinkView,
  filterNotify,
  loginOutcomeText,
  tabUnread,
  totalUnread,
  type AccountFlowState,
  type NotifyCat,
  type NotifyItem,
} from "../features/rank/rankUi";

/**
 * W17 我的（16W17：通知四类 / 设置 / 账号数据导出与注销流展示镜像）。
 * 注：排行区在同一 W16Rank.vue（route=rank 时渲染榜；/me/* 渲染本组件）。
 */
const route = useRoute();
const router = useRouter();

const section = computed<"notify" | "settings" | "account">(() => {
  if (route.path.includes("settings")) return "settings";
  if (route.path.includes("account") || route.path.includes("export")) return "account";
  return "notify";
});

const notifications = reactive<NotifyItem[]>([
  { id: 1, category: "SYSTEM", title: "协议已更新，需重新确认", timeLabel: "刚刚", read: false },
  { id: 2, category: "SYSTEM", title: "系统公告：本周维护", timeLabel: "昨天", read: true },
  { id: 3, category: "LEARNING", title: "每日一练已为你排好 5 题", timeLabel: "09:00", read: false },
  { id: 4, category: "LEARNING", title: "第 38 周周报已生成", timeLabel: "昨天", read: true },
  { id: 5, category: "COMMUNITY", title: "你的问题收到 3 个新回复", timeLabel: "2h", read: false },
  { id: 6, category: "MODERATION", title: "你的帖子已通过审核", timeLabel: "3h", read: true },
]);
const notifyTab = ref<NotifyCat>("SYSTEM");
const unread = computed(() => tabUnread(notifications));
const filtered = computed(() => filterNotify(notifications, notifyTab.value));
const total = computed(() => totalUnread(notifications));
function readAll(cat: NotifyCat): void {
  for (const n of notifications) {
    if (n.category === cat) n.read = true;
  }
}

const exportCreated = ref<number | null>(null);
const exportView = computed(() => exportLinkView(exportCreated.value, Date.now()));
function requestExport(): void {
  exportCreated.value = Date.now();
}
function expireExport(): void {
  exportCreated.value = Date.now() - 8 * 24 * 3600 * 1000;
}

const accountState = ref<AccountFlowState>("active");
const dueAt = ref<number | null>(null);
const anchorNow = ref(Date.now());
const flow = computed(() => cancelView(accountState.value, dueAt.value, anchorNow.value));
const loginText = computed(() => loginOutcomeText(accountState.value));

function applyDeletion(): void {
  accountState.value = "pending";
  dueAt.value = anchorNow.value + 7 * 24 * 3600 * 1000 + 23 * 3600 * 1000;
}
function cancelDeletion(): void {
  accountState.value = "active";
  dueAt.value = null;
}
function expireDue(): void {
  anchorNow.value = Date.now() + 8 * 24 * 3600 * 1000;
  accountState.value = "anonymized";
}
</script>

<template>
  <div class="me pad">
    <div class="head">
      <span class="bk" @click="router.push('/do')">‹</span>
      <h1>我的</h1>
      <span class="chip">🔔 未读 {{ total }}</span>
      <button class="btn ghost" style="margin-left: auto" @click="router.push('/rank')">🏆 榜单/赛事</button>
    </div>

    <nav class="menu">
      <RouterLink to="/me/notifications" class="menubtn" :class="{ on: section === 'notify' }">通知中心</RouterLink>
      <RouterLink to="/me/settings" class="menubtn" :class="{ on: section === 'settings' }">设置</RouterLink>
      <RouterLink to="/me/account" class="menubtn" :class="{ on: section === 'account' }">账号与数据</RouterLink>
    </nav>

    <!-- 通知 -->
    <template v-if="section === 'notify'">
      <div class="ntabs">
        <button v-for="t in NOTIFY_TABS" :key="t.key" :class="{ on: notifyTab === t.key }" @click="notifyTab = t.key">
          {{ t.icon }} {{ t.label }}
          <i v-if="unread[t.key] > 0">{{ unread[t.key] }}</i>
        </button>
        <button class="plain" @click="readAll(notifyTab)">全部已读</button>
      </div>
      <div v-for="n in filtered" :key="n.id" class="card nrow">
        <span class="dot" :class="{ off: n.read }" />
        <div class="ninfo">
          <b>{{ n.title }}</b>
          <span class="mut">{{ n.timeLabel }}</span>
        </div>
        <span class="ar">›</span>
      </div>
      <p v-if="filtered.length === 0" class="mut">该分类暂无通知</p>
    </template>

    <!-- 设置 -->
    <template v-else-if="section === 'settings'">
      <div class="card srow"><b>用户协议 / 隐私政策</b><span class="mut">v1.1 · 端内与官网 /legal 双端可查</span><span class="ar">›</span></div>
      <div class="card srow">
        <b>消息通知</b>
        <span class="mut">每日一练 · 社区回复 · 审核结果</span>
        <input type="checkbox" checked style="accent-color: var(--ok); width: 18px; height: 18px" />
      </div>
      <div class="card srow">
        <b>判分振动</b>
        <span class="mut">移动端设置同源（05 §5 语义四色+振动）</span>
        <input type="checkbox" checked style="accent-color: var(--ok); width: 18px; height: 18px" />
      </div>
      <div class="card srow" @click="router.push('/report')"><b>学习统计</b><span class="mut">看板</span><span class="ar">›</span></div>
      <div class="card srow" @click="router.push('/plans')"><b>学习计划</b><span class="mut">日历与建议</span><span class="ar">›</span></div>
    </template>

    <!-- 账号与数据 -->
    <template v-else>
      <div class="card">
        <div class="sect" style="margin-top: 0">数据导出（01 U-06 · 7 天链接）</div>
        <div class="exrow">
          <span class="badge" :class="exportView.state === 'valid' ? 'ok' : exportView.state === 'expired' ? 'bad' : 'grey'">
            {{ exportView.state === "valid" ? "已生成" : exportView.state === "expired" ? "已失效" : "未申请" }}
          </span>
          <span class="mut">{{ exportView.daysLeftText }}</span>
          <button class="btn" @click="requestExport">申请导出</button>
          <button class="btn ghost" @click="expireExport">模拟过期</button>
        </div>
        <p class="mut">JSON+CSV → 站内信链接；02 §7 清理任务到期删除</p>
      </div>

      <div class="card" :class="{ dangerbox: accountState !== 'active' }">
        <div class="sect" style="margin-top: 0">注销账号（01 U-07 · 冷静期 7 天）</div>

        <p v-if="loginText" class="loginblock">⛔ {{ loginText }}</p>

        <template v-if="accountState === 'active'">
          <p class="mut">流程：验证码二次验证 → 申请 → 冷静期（可撤销）→ 到期匿名化。</p>
          <button class="btn" @click="applyDeletion">申请注销（需二次验证）</button>
        </template>

        <template v-else>
          <div class="flow">
            <b class="cd">{{ flow.countdownText }}</b>
            <span class="mut">{{ flow.note }}</span>
          </div>
          <div class="acts">
            <button v-if="flow.canCancel" class="btn" @click="cancelDeletion">{{ flow.primaryLabel }}</button>
            <button v-if="accountState === 'pending'" class="btn ghost" @click="expireDue">模拟到期 → 匿名化</button>
            <span v-if="accountState === 'anonymized'" class="badge bad">不可恢复 · 社区显示「已注销用户」</span>
          </div>
        </template>
        <p class="mut">匿名化=后端 anonymizePii：nickname→已注销用户；phone/email/openid/hash 清除</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pad {
  padding: 22px 32px 48px;
  max-width: 940px;
  margin: 0 auto;
}
.head {
  display: flex;
  gap: 14px;
  align-items: center;
}
.bk {
  font-size: 24px;
  cursor: pointer;
  color: var(--ink3);
}
.head h1 {
  font-size: 24px;
}
.chip {
  font-size: 12.5px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 3px 12px;
  font-weight: 600;
}
.menu {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.menubtn {
  padding: 8px 18px;
  border-radius: 99px;
  border: 1px solid var(--line);
  background: #fff;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--ink3);
  cursor: pointer;
  text-decoration: none;
}
.menubtn.on {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}
.ntabs {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.ntabs button {
  padding: 8px 16px;
  border-radius: 99px;
  border: 1px solid var(--line);
  background: #fff;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--ink3);
  cursor: pointer;
  position: relative;
}
.ntabs button.on {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}
.ntabs button.plain {
  background: var(--brand-soft);
  color: var(--brand-deep);
}
.ntabs button i {
  font-style: normal;
  background: var(--bad);
  color: #fff;
  border-radius: 99px;
  font-size: 11px;
  padding: 1px 7px;
  margin-left: 5px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 15px 16px;
}
.nrow,
.srow {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 10px;
  cursor: pointer;
}
.ninfo {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--bad);
  flex: none;
}
.dot.off {
  background: #e5e7eb;
}
.ar {
  color: var(--ink3);
}
.mut {
  color: var(--ink3);
  font-size: 12.5px;
}
.sect {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink3);
  margin-bottom: 10px;
}
.exrow {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.badge {
  font-size: 11.5px;
  font-weight: 800;
  border-radius: 7px;
  padding: 3px 10px;
  background: #f1f5f9;
  color: #64748b;
}
.badge.ok { background: #ecfdf5; color: #047857; }
.badge.bad { background: #fee2e2; color: #b91c1c; }
.badge.grey { background: #f1f5f9; color: #64748b; }
.card.dangerbox {
  border-color: #fecaca;
}
.loginblock {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  border-radius: 9px;
  padding: 9px 13px;
  font-size: 13.5px;
  font-weight: 600;
  margin-bottom: 10px;
}
.flow {
  display: flex;
  gap: 14px;
  align-items: baseline;
}
.cd {
  font-size: 30px;
  color: var(--brand);
}
.acts {
  display: flex;
  gap: 10px;
  margin-top: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.btn {
  border: none;
  border-radius: 11px;
  background: var(--grad);
  color: #fff;
  font-weight: 700;
  height: 40px;
  padding: 0 20px;
  cursor: pointer;
  font-size: 14.5px;
}
.btn.ghost {
  background: var(--brand-soft);
  color: var(--brand);
}
.mut {
  margin-top: 8px;
}
</style>
