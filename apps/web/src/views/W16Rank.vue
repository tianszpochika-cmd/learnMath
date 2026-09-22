<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import {
  anomalyMark,
  challengeCard,
  formatDuration,
  leagueOf,
  myRankView,
  weeklyRanks,
} from "../features/rank/rankUi";

/** W16 排行榜/挑战赛（16W16：周榜同分时间序、我的差距吸底、赛事三态、时长异常标记）。
 *  我的/设置/通知 → W17Me.vue（本文件只管 rank 路由）。 */
const router = useRouter();

const tab = ref<"week" | "total" | "event">("week");
const myId = 8;

const entries = [
  { userId: 5, name: "甲同学", points: 2410, achievedAtEpochSec: 111 },
  { userId: 6, name: "乙同学", points: 2120, achievedAtEpochSec: 222 },
  { userId: 7, name: "丙同学", points: 1980, achievedAtEpochSec: 333 },
  { userId: 8, name: "我（同学A）", points: 1240, achievedAtEpochSec: 444 },
  { userId: 9, name: "丁同学", points: 980, achievedAtEpochSec: 555 },
];
const ranks = computed(() => weeklyRanks(entries));
const mine = computed(() => myRankView(ranks.value, myId));
const myLeague = computed(() => leagueOf(mine.value?.points ?? 0));
const top3 = computed(() => ranks.value.slice(0, 3));

const event = ref(challengeCard("upcoming"));
const anomaly = anomalyMark(271, 2292); // 4:31 vs 38:12 → 异常
function joinEvent(): void {
  event.value = { ...event.value, buttonLabel: "✓ 已报名", buttonEnabled: false };
}
</script>

<template>
  <div class="rk pad">
    <div class="head">
      <span class="bk" @click="router.push('/do')">‹</span>
      <h1>排行榜 / 挑战赛</h1>
      <div class="tabs">
        <button :class="{ on: tab === 'week' }" @click="tab = 'week'">周榜</button>
        <button :class="{ on: tab === 'total' }" @click="tab = 'total'">总榜</button>
        <button :class="{ on: tab === 'event' }" @click="tab = 'event'">赛事</button>
      </div>
      <span class="chip" style="margin-left: auto">我：{{ myLeague }}</span>
      <button class="btn ghost" @click="router.push('/me/notifications')">🔔 我的</button>
    </div>

    <template v-if="tab !== 'event'">
      <div class="grid">
        <section>
          <div v-for="r in ranks" :key="r.userId" class="card row" :class="{ top3: r.position <= 3, me: r.userId === myId }">
            <span class="pos" :class="'p' + r.position">{{ r.position }}</span>
            <span class="ava">{{ r.name.slice(0, 1) }}</span>
            <div class="info">
              <b>{{ r.name }}</b>
              <span v-if="r.userId === myId" class="chip">本人</span>
            </div>
            <b class="pts">{{ r.points }}</b>
          </div>
          <p class="mut">排序：积分降序 → 同分达成时间早者靠前（与服务端 GamificationRules 同口径）</p>
        </section>
        <aside>
          <div class="card mecard" v-if="mine">
            <div class="sect" style="margin-top: 0">我的战况（吸底展示同款）</div>
            <div class="merow">
              <span>第 <b>{{ mine.position }}</b> 名</span>
              <span>{{ mine.points }} 分</span>
              <span class="gap">{{ mine.gapText }}</span>
            </div>
            <div class="sect">段位</div>
            <b class="league">{{ myLeague }}</b>
            <p class="mut">段位阈值=配置（SAMPLE_LEAGUES 仅样例，默认表可换）</p>
          </div>
          <div class="card">
            <div class="sect" style="margin-top: 0">前三快照</div>
            <div v-for="r in top3" :key="'t' + r.userId" class="topline">
              <span>{{ r.position === 1 ? "🥇" : r.position === 2 ? "🥈" : "🥉" }}</span>
              <b>{{ r.name }}</b>
              <span class="mut">{{ r.points }}</span>
            </div>
          </div>
        </aside>
      </div>
    </template>

    <template v-else>
      <div class="card">
        <div class="evhead">
          <div>
            <span class="badge" :class="event.badgeClass">{{ event.badgeText }}</span>
            <b class="evt">九月阶梯挑战 · 限时 48h</b>
            <p class="mut">Top10 +100 分 · 参与 +10 · 试卷 #77（BR-11 题源不复用曝光族）</p>
          </div>
          <button class="btn" :disabled="!event.buttonEnabled" @click="joinEvent">{{ event.buttonLabel }}</button>
        </div>
        <div class="hr" />
        <div class="sect">榜单监控（防作弊 · 01 P6-5）</div>
        <table class="tbl">
          <thead><tr><th>#</th><th>选手</th><th>得分</th><th>用时</th><th>检测</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>甲同学</td><td>96</td><td>{{ formatDuration(2292) }}</td><td><span class="badge ok">正常</span></td></tr>
            <tr>
              <td>2</td><td>乙同学</td><td>94</td><td class="danger">{{ formatDuration(271) }}</td>
              <td><span v-if="anomaly.flagged" class="badge bad">{{ anomaly.text }}</span><span v-else class="badge ok">{{ anomaly.text }}</span></td>
            </tr>
          </tbody>
        </table>
        <p class="mut">异常=显著短于均值（阈值 50%）→ 标记抽查；星级仅按客观分+用时（BR-04）</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pad {
  padding: 22px 32px 48px;
  max-width: 1060px;
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
.tabs {
  display: flex;
  gap: 8px;
}
.tabs button {
  padding: 8px 18px;
  border-radius: 99px;
  border: 1px solid var(--line);
  background: #fff;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--ink3);
  cursor: pointer;
}
.tabs button.on {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}
.chip {
  font-size: 12.5px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 3px 12px;
  font-weight: 600;
}
.grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 15px 16px;
}
.row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}
.row.top3 {
  border-color: #fde68a;
  background: #fffdf5;
}
.row.me {
  border-color: var(--brand);
}
.pos {
  width: 26px;
  text-align: center;
  font-weight: 900;
  color: var(--ink3);
}
.pos.p1 { color: #d97706; }
.pos.p2 { color: #64748b; }
.pos.p3 { color: #b45309; }
.ava {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand-deep);
  display: grid;
  place-items: center;
  font-weight: 800;
}
.info {
  flex: 1;
  display: flex;
  gap: 8px;
  align-items: center;
}
.pts {
  font-variant-numeric: tabular-nums;
}
.mecard {
  border-left: 4px solid var(--brand);
}
.merow {
  display: flex;
  gap: 16px;
  align-items: center;
  font-size: 15px;
}
.merow .gap {
  color: var(--brand);
  font-weight: 700;
  font-size: 13.5px;
}
.league {
  font-size: 24px;
  background: var(--grad);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.topline {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 0;
  border-top: 1px solid #f1f3f7;
  font-size: 14.5px;
}
.topline .mut {
  margin-left: auto;
}
.mut {
  color: var(--ink3);
  font-size: 12.5px;
}
.sect {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink3);
  margin: 14px 0 8px;
}
.evhead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
}
.evt {
  display: block;
  font-size: 18px;
  margin-top: 8px;
}
.badge {
  font-size: 11.5px;
  font-weight: 800;
  border-radius: 7px;
  padding: 3px 10px;
  background: #f1f5f9;
  color: #64748b;
}
.badge.warn { background: #fef3c7; color: #b45309; }
.badge.ok { background: #ecfdf5; color: #047857; }
.badge.grey { background: #f1f5f9; color: #64748b; }
.badge.bad { background: #fee2e2; color: #b91c1c; }
.hr {
  height: 1px;
  background: var(--line);
  margin: 14px 0;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.tbl th {
  text-align: left;
  color: var(--ink3);
  font-size: 12.5px;
  padding: 8px 6px;
  border-bottom: 1px solid var(--line);
}
.tbl td {
  padding: 9px 6px;
  border-bottom: 1px solid #f1f3f7;
}
.danger {
  color: var(--bad);
  font-weight: 800;
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
.btn:disabled {
  opacity: 0.55;
  cursor: default;
}
.btn.ghost {
  background: var(--brand-soft);
  color: var(--brand);
}
@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
