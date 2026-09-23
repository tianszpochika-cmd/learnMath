<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import {
  joinChallenge,
  readChallengeRank,
  readChallenges,
  readRank,
  type Challenge,
  type ChallengeRankRow,
  type RankBoard,
  type RankScope,
} from "../services/rank";

type PageTab = RankScope | "challenges";
type LoadState = "idle" | "loading" | "ready" | "error";

const router = useRouter();
const auth = useAuthStore();
const tab = ref<PageTab>("weekly");
const board = ref<RankBoard | null>(null);
const boardState = ref<LoadState>("idle");
const boardError = ref("");
const challenges = ref<Challenge[]>([]);
const challengeState = ref<LoadState>("idle");
const challengeError = ref("");
const selectedChallengeId = ref("");
const challengeRanks = ref<ChallengeRankRow[]>([]);
const challengeRankState = ref<LoadState>("idle");
const challengeRankError = ref("");
const confirmId = ref("");
const joiningId = ref("");
const awaitingVerification = ref<Set<string>>(new Set());
const actionMessage = ref("");
const cancelButton = ref<HTMLButtonElement | null>(null);
const dialogElement = ref<HTMLElement | null>(null);
let joinTrigger: HTMLButtonElement | null = null;
let boardRequest = 0;
let challengesRequest = 0;
let challengeRankRequest = 0;

const selectedChallenge = computed(() => challenges.value.find((item) => item.id === selectedChallengeId.value) ?? null);
const confirmingChallenge = computed(() => challenges.value.find((item) => item.id === confirmId.value) ?? null);
const topRows = computed(() => (board.value?.rows ?? []).filter((row) => row.position !== null && row.position <= 3));

function reason(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "暂时无法读取，请稍后重试";
}

async function loadBoard(): Promise<void> {
  if (tab.value === "challenges") return;
  const scope = tab.value;
  const request = ++boardRequest;
  boardState.value = "loading";
  boardError.value = "";
  board.value = null;
  try {
    const result = await readRank(scope, auth.userId);
    if (request !== boardRequest || tab.value !== scope) return;
    board.value = result;
    boardState.value = "ready";
  } catch (error) {
    if (request !== boardRequest || tab.value !== scope) return;
    boardError.value = reason(error);
    boardState.value = "error";
  }
}

async function loadChallenges(): Promise<void> {
  const request = ++challengesRequest;
  challengeState.value = "loading";
  challengeError.value = "";
  try {
    const result = await readChallenges();
    if (request !== challengesRequest) return;
    challenges.value = result;
    awaitingVerification.value = new Set([...awaitingVerification.value].filter((id) => !result.find((item) => item.id === id)?.joined));
    challengeState.value = "ready";
  } catch (error) {
    if (request !== challengesRequest) return;
    challengeError.value = reason(error);
    challengeState.value = "error";
  }
}

async function showChallengeRank(id: string): Promise<void> {
  if (selectedChallengeId.value === id) {
    selectedChallengeId.value = "";
    challengeRanks.value = [];
    return;
  }
  selectedChallengeId.value = id;
  const request = ++challengeRankRequest;
  challengeRankState.value = "loading";
  challengeRankError.value = "";
  challengeRanks.value = [];
  try {
    const result = await readChallengeRank(id, auth.userId);
    if (request !== challengeRankRequest || selectedChallengeId.value !== id) return;
    challengeRanks.value = result;
    challengeRankState.value = "ready";
  } catch (error) {
    if (request !== challengeRankRequest || selectedChallengeId.value !== id) return;
    challengeRankError.value = reason(error);
    challengeRankState.value = "error";
  }
}

function canJoin(item: Challenge): boolean {
  return challengeState.value === "ready" && item.status === "live" && Boolean(item.rules)
    && !item.joined && !awaitingVerification.value.has(item.id) && !joiningId.value;
}

async function requestJoin(item: Challenge, event: MouseEvent): Promise<void> {
  if (!canJoin(item)) return;
  joinTrigger = event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null;
  confirmId.value = item.id;
  await nextTick();
  cancelButton.value?.focus();
}

function closeConfirm(): void {
  if (joiningId.value) return;
  confirmId.value = "";
  nextTick(() => joinTrigger?.focus());
}

function keepDialogFocus(event: KeyboardEvent): void {
  if (event.key !== "Tab" || !dialogElement.value) return;
  const focusable = [...dialogElement.value.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

/** POST 只发起参赛；“已参赛”和作答入口必须由 GET /challenges 再次确认。 */
async function confirmJoin(): Promise<void> {
  const id = confirmId.value;
  if (!id || joiningId.value) return;
  const current = challenges.value.find((item) => item.id === id);
  if (!current || !canJoin(current)) {
    actionMessage.value = "赛事规则或状态已变化，请刷新后重新确认。";
    closeConfirm();
    return;
  }
  joiningId.value = id;
  actionMessage.value = "";
  let posted = false;
  try {
    await joinChallenge(id);
    posted = true;
    awaitingVerification.value = new Set([...awaitingVerification.value, id]);
    const latest = await readChallenges();
    challenges.value = latest;
    challengeState.value = "ready";
    const serverItem = latest.find((item) => item.id === id);
    if (!serverItem?.joined) {
      actionMessage.value = "参赛请求已发出，但赛事列表尚未确认状态。请刷新查看，暂勿重复提交。";
      return;
    }
    awaitingVerification.value = new Set([...awaitingVerification.value].filter((itemId) => itemId !== id));
    actionMessage.value = serverItem.attemptId
      ? "赛事列表已确认参赛，正在进入作答。"
      : "赛事列表已确认参赛，但作答入口尚未返回。请稍后刷新赛事状态。";
    if (serverItem.attemptId) await router.push(`/paper/${serverItem.attemptId}`);
  } catch (error) {
    actionMessage.value = posted
      ? "参赛请求已发出，但回读失败。请刷新赛事状态，暂勿重复提交。"
      : reason(error);
  } finally {
    joiningId.value = "";
    confirmId.value = "";
    nextTick(() => joinTrigger?.focus());
  }
}

function statusText(item: Challenge): string {
  if (item.status === "upcoming") return "即将开始";
  if (item.status === "live") return "进行中";
  if (item.status === "ended") return "已结束";
  return "状态待确认";
}
function actionText(item: Challenge): string {
  if (awaitingVerification.value.has(item.id)) return "等待状态确认";
  if (item.joined) return item.attemptId ? "继续作答" : "已参赛";
  if (item.status === "live" && !item.rules) return "规则未返回";
  if (item.status === "live") return "参赛";
  if (item.status === "upcoming") return "尚未开始";
  return item.status === "ended" ? "已结束" : "暂不可参赛";
}
function openAttempt(item: Challenge): void {
  if (item.joined && item.attemptId) void router.push(`/paper/${item.attemptId}`);
}

watch(tab, (value) => {
  actionMessage.value = "";
  if (value === "challenges") void loadChallenges();
  else void loadBoard();
});
onMounted(() => { void loadBoard(); });
</script>

<template>
  <div class="rank-page">
    <div class="hero">
      <div>
        <p class="eyebrow">MATHORIGIN · LEARNING JOURNEY</p>
        <h1 class="page-title">每一步，都有自己的位置。</h1>
        <p class="hero-copy">查看本期榜单与进行中的挑战。名次、成绩和参赛状态以账号数据为准。</p>
      </div>
      <div class="hero-mark" aria-hidden="true">π</div>
    </div>

    <div class="page-body">
      <div class="toolbar">
        <div class="tab-list" aria-label="榜单与赛事">
          <button type="button" :aria-pressed="tab === 'weekly'" :class="{ active: tab === 'weekly' }" @click="tab = 'weekly'">周榜</button>
          <button type="button" :aria-pressed="tab === 'daily'" :class="{ active: tab === 'daily' }" @click="tab = 'daily'">日榜</button>
          <button type="button" :aria-pressed="tab === 'challenges'" :class="{ active: tab === 'challenges' }" @click="tab = 'challenges'">挑战赛</button>
        </div>
        <button v-if="tab !== 'challenges'" type="button" class="quiet-button" :disabled="boardState === 'loading'" @click="loadBoard">刷新榜单</button>
        <button v-else type="button" class="quiet-button" :disabled="challengeState === 'loading'" @click="loadChallenges">刷新赛事</button>
      </div>

      <template v-if="tab !== 'challenges'">
        <div class="rank-layout">
          <section class="panel" aria-label="榜单列表">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">{{ tab === 'weekly' ? 'WEEKLY RANKING' : 'DAILY RANKING' }}</p>
                <h2>{{ tab === 'weekly' ? '本周榜单' : '今日日榜' }}</h2>
              </div>
              <span class="period-pill">{{ tab === 'weekly' ? '本周' : '今日' }}</span>
            </div>
            <p v-if="boardState === 'loading'" class="state" role="status">正在读取榜单…</p>
            <div v-else-if="boardState === 'error'" class="state error" role="alert"><p>{{ boardError }}</p><button type="button" class="text-button" @click="loadBoard">重试</button></div>
            <p v-else-if="boardState === 'ready' && !board?.rows.length" class="state">目前没有可展示的榜单记录。</p>
            <ol v-else-if="boardState === 'ready'" class="rank-list">
              <li v-for="row in board?.rows" :key="row.key" class="rank-row" :class="{ featured: row.position !== null && row.position <= 3, own: row.isSelf }">
                <span class="position" :class="{ winner: row.position === 1 }">{{ row.position === null ? '—' : String(row.position).padStart(2, '0') }}</span>
                <span class="avatar" aria-hidden="true">{{ row.displayName.slice(0, 1) }}</span>
                <span class="person"><strong>{{ row.displayName }}</strong><small v-if="row.tier">{{ row.tier }}</small></span>
                <span v-if="row.isSelf" class="self-pill">本人</span>
                <span class="points">{{ row.points === null ? '—' : row.points.toLocaleString('zh-CN') }} <small>分</small></span>
              </li>
            </ol>
            <p class="footnote">榜单顺序与名次由服务端提供；未返回名次时显示“—”。</p>
          </section>

          <aside class="side-stack" aria-label="我的榜单摘要">
            <section class="panel own-panel">
              <p class="eyebrow">MY POSITION</p>
              <h2>我的位置</h2>
              <template v-if="boardState === 'ready' && board?.mine">
                <p class="own-number">{{ board.mine.position === null ? '—' : `#${board.mine.position}` }}</p>
                <p class="muted">{{ board.mine.position === null ? '尚无明确名次' : '本期名次' }}</p>
                <div class="own-detail"><span>本期积分</span><strong>{{ board.mine.points === null ? '—' : board.mine.points.toLocaleString('zh-CN') }}</strong></div>
                <div v-if="board.mine.tier" class="own-detail"><span>段位</span><strong>{{ board.mine.tier }}</strong></div>
              </template>
              <p v-else class="muted side-empty">{{ boardState === 'loading' ? '正在读取…' : '本期暂无个人名次' }}</p>
            </section>
            <section v-if="topRows.length" class="panel summary-panel">
              <p class="eyebrow">TOP THREE</p>
              <h2>榜单前列</h2>
              <div v-for="row in topRows" :key="row.key" class="summary-row"><span>#{{ row.position }}</span><strong>{{ row.displayName }}</strong><small>{{ row.points === null ? '—' : row.points.toLocaleString('zh-CN') }} 分</small></div>
            </section>
          </aside>
        </div>
      </template>

      <template v-else>
        <p v-if="actionMessage" class="action-message" role="status">{{ actionMessage }}</p>
        <p v-if="challengeState === 'loading'" class="state panel" role="status">正在读取赛事…</p>
        <div v-else-if="challengeState === 'error'" class="state panel error" role="alert"><p>{{ challengeError }}</p><button type="button" class="text-button" @click="loadChallenges">重试</button></div>
        <p v-else-if="challengeState === 'ready' && !challenges.length" class="state panel">目前没有可展示的挑战赛。</p>
        <div v-else-if="challengeState === 'ready'" class="challenge-grid">
          <section v-for="item in challenges" :key="item.id" class="panel challenge-card">
            <div class="challenge-top"><span class="challenge-status" :class="item.status">{{ statusText(item) }}</span><span v-if="item.joined" class="self-pill">已参赛</span></div>
            <h2>{{ item.title }}</h2>
            <p v-if="item.description" class="muted">{{ item.description }}</p>
            <dl class="challenge-times">
              <div v-if="item.startsAt"><dt>开始</dt><dd>{{ item.startsAt }}</dd></div>
              <div v-if="item.endsAt"><dt>结束</dt><dd>{{ item.endsAt }}</dd></div>
            </dl>
            <dl v-if="item.rules" class="rules-list">
              <div><dt>作答时限</dt><dd>{{ item.rules.timeLimit }}</dd></div>
              <div><dt>辅助</dt><dd>{{ item.rules.assistance }}</dd></div>
              <div><dt>反馈</dt><dd>{{ item.rules.feedback }}</dd></div>
              <div><dt>恢复</dt><dd>{{ item.rules.resume }}</dd></div>
              <div><dt>计分</dt><dd>{{ item.rules.scoring }}</dd></div>
            </dl>
            <p v-else class="rules-missing">赛事规则未返回，暂不能参赛。请稍后刷新。</p>
            <div class="challenge-actions">
              <button v-if="item.joined && item.attemptId" type="button" class="primary-button" @click="openAttempt(item)">{{ actionText(item) }}</button>
              <button v-else type="button" class="primary-button" :disabled="!canJoin(item)" @click="requestJoin(item, $event)">{{ actionText(item) }}</button>
              <button type="button" class="quiet-button" :aria-expanded="selectedChallengeId === item.id" @click="showChallengeRank(item.id)">{{ selectedChallengeId === item.id ? '收起赛榜' : '查看赛榜' }}</button>
            </div>
            <div v-if="selectedChallengeId === item.id" class="challenge-rank">
              <p class="eyebrow">CHALLENGE RANKING</p>
              <p v-if="challengeRankState === 'loading'" class="muted" role="status">正在读取赛榜…</p>
              <p v-else-if="challengeRankState === 'error'" class="error" role="alert">{{ challengeRankError }}</p>
              <p v-else-if="challengeRankState === 'ready' && !challengeRanks.length" class="muted">暂无已确认赛榜记录。</p>
              <ol v-else class="challenge-rank-list"><li v-for="row in challengeRanks" :key="row.key"><span>{{ row.position === null ? '—' : `#${row.position}` }}</span><strong>{{ row.displayName }}<small v-if="row.isSelf"> · 本人</small></strong><span>{{ row.score === null ? '—' : row.score }} 分</span></li></ol>
            </div>
          </section>
        </div>
      </template>
    </div>

    <div v-if="confirmingChallenge?.rules" class="dialog-backdrop" @click.self="closeConfirm">
      <div ref="dialogElement" class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="join-title" @keydown.esc.stop="closeConfirm" @keydown="keepDialogFocus">
        <p class="eyebrow">CONFIRM CHALLENGE</p>
        <h2 id="join-title">确认参加“{{ confirmingChallenge.title }}”？</h2>
        <p>确认后将向服务端申请一次挑战作答。请核对以下赛事规则：</p>
        <dl class="rules-list dialog-rules">
          <div><dt>作答时限</dt><dd>{{ confirmingChallenge.rules.timeLimit }}</dd></div>
          <div><dt>辅助</dt><dd>{{ confirmingChallenge.rules.assistance }}</dd></div>
          <div><dt>反馈</dt><dd>{{ confirmingChallenge.rules.feedback }}</dd></div>
          <div><dt>恢复</dt><dd>{{ confirmingChallenge.rules.resume }}</dd></div>
          <div><dt>计分</dt><dd>{{ confirmingChallenge.rules.scoring }}</dd></div>
        </dl>
        <p>参赛状态以再次读取的赛事列表为准。</p>
        <div class="dialog-actions"><button ref="cancelButton" type="button" class="quiet-button" :disabled="Boolean(joiningId)" @click="closeConfirm">先不参加</button><button type="button" class="primary-button" :disabled="Boolean(joiningId)" @click="confirmJoin">{{ joiningId ? '正在确认…' : '确认参赛' }}</button></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rank-page{min-height:calc(100vh - var(--nav-h));background:var(--bg);color:var(--body)}
.hero{min-height:230px;background:var(--deep) var(--grid);color:#d7e4ff;padding:46px max(24px,calc((100vw - 1200px)/2));display:flex;align-items:center;justify-content:space-between;gap:32px;overflow:hidden}
.hero .eyebrow{color:#92b5ff}.page-title{font-size:clamp(30px,3.7vw,48px);line-height:1.25;color:#fff;margin:13px 0}.hero-copy{max-width:640px;color:#b9c9e2;font-size:15px}.hero-mark{font:italic 180px/1 var(--serif);opacity:.11;transform:rotate(-15deg);pointer-events:none}
.page-body{max-width:1248px;margin:0 auto;padding:28px 24px 76px}.toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}.tab-list{display:flex;gap:7px;padding:5px;border:1px solid var(--line);border-radius:13px;background:var(--paper);width:max-content}.tab-list button{border:0;border-radius:9px;background:transparent;color:var(--muted);padding:8px 19px;font-weight:750}.tab-list button.active{background:var(--primary-soft);color:var(--primary-deep)}
.rank-layout{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.75fr);gap:18px;align-items:start}.side-stack{display:grid;gap:18px}.panel{border:1px solid var(--line);border-radius:18px;background:var(--paper);box-shadow:var(--shadow);padding:24px}.panel-heading{display:flex;justify-content:space-between;gap:15px;align-items:start;margin-bottom:18px}.panel h2{font-size:21px;line-height:1.35;color:var(--text);margin:5px 0 14px}.panel-heading h2{margin-bottom:0}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.13em;color:var(--primary-deep)}.period-pill,.self-pill{display:inline-flex;align-items:center;border-radius:99px;background:var(--primary-soft);color:var(--primary-deep);font-size:12px;font-weight:750;padding:4px 10px;white-space:nowrap}
.rank-list,.challenge-rank-list{list-style:none}.rank-row{display:flex;align-items:center;gap:14px;padding:15px 13px;border-top:1px solid var(--line);min-width:0}.rank-row.featured{background:color-mix(in srgb,var(--primary-soft) 25%,var(--paper))}.rank-row.own{box-shadow:inset 3px 0 var(--primary)}.position{font:700 17px var(--math);color:var(--muted);width:35px;flex:none}.position.winner{color:var(--primary-deep)}.avatar{width:38px;height:38px;border-radius:11px;background:var(--soft);color:var(--primary-deep);display:grid;place-items:center;font-weight:800;flex:none}.person{min-width:0;display:flex;flex-direction:column;line-height:1.4;flex:1}.person strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)}.person small{color:var(--muted);margin-top:2px}.points{color:var(--text);font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap}.points small{font-weight:500;color:var(--muted)}.footnote{font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px;margin-top:5px}
.own-panel{border-top:3px solid var(--primary)}.own-number{font:700 48px/1.1 var(--serif);color:var(--primary-deep);margin:20px 0 5px}.muted{color:var(--muted);font-size:13px}.side-empty{padding:18px 0}.own-detail,.summary-row{display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid var(--line);padding:11px 0;font-size:13px}.own-detail:first-of-type{margin-top:20px}.own-detail span,.summary-row span,.summary-row small{color:var(--muted)}.own-detail strong,.summary-row strong{color:var(--text)}.summary-row strong{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.state{padding:30px 5px;color:var(--muted)}.state.panel{padding:32px}.error{color:var(--danger)}.text-button{border:0;background:transparent;color:var(--primary-deep);font-weight:750;text-decoration:underline;margin-top:10px}.quiet-button,.primary-button{display:inline-flex;justify-content:center;align-items:center;min-height:40px;padding:8px 15px;border-radius:10px;font-weight:750}.quiet-button{border:1px solid var(--line);background:var(--paper);color:var(--body)}.quiet-button:hover{border-color:var(--primary);color:var(--primary-deep)}.primary-button{border:1px solid transparent;background:var(--grad);color:#fff}.primary-button:disabled,.quiet-button:disabled{opacity:.5;cursor:not-allowed}.action-message{border:1px solid var(--primary);background:var(--primary-soft);color:var(--primary-deep);padding:12px 16px;border-radius:11px;margin-bottom:16px;font-size:13px}
.challenge-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.challenge-card{min-width:0}.challenge-top{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:20px}.challenge-status{border-radius:99px;background:var(--soft);color:var(--muted);padding:4px 11px;font-size:12px;font-weight:750}.challenge-status.upcoming{background:var(--warning-bg);color:var(--warning)}.challenge-status.live{background:var(--good-bg);color:var(--good)}.challenge-card h2{font-family:var(--serif);font-size:24px}.challenge-times{margin:18px 0;display:grid;gap:6px}.challenge-times div{display:flex;gap:15px;font-size:13px}.challenge-times dt{color:var(--muted);min-width:28px}.challenge-times dd{color:var(--body)}.challenge-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:22px}.challenge-rank{border-top:1px solid var(--line);padding-top:18px;margin-top:20px}.challenge-rank-list{margin-top:8px}.challenge-rank-list li{display:flex;align-items:center;gap:12px;border-top:1px solid var(--line);padding:9px 0;font-size:13px}.challenge-rank-list li span:first-child{color:var(--primary-deep);min-width:28px}.challenge-rank-list strong{color:var(--text);flex:1}.challenge-rank-list small{color:var(--muted);font-weight:500}.challenge-rank-list li span:last-child{white-space:nowrap}
.rules-list{display:grid;gap:8px;margin:18px 0;border-top:1px solid var(--line);padding-top:15px}.rules-list div{display:grid;grid-template-columns:74px minmax(0,1fr);gap:10px;font-size:13px}.rules-list dt{color:var(--muted)}.rules-list dd{color:var(--text);font-weight:600}.rules-missing{background:var(--warning-bg);color:var(--warning);border-radius:10px;padding:10px 12px;font-size:13px;margin-top:16px}.dialog-rules{margin-bottom:18px}
.dialog-backdrop{position:fixed;inset:0;background:rgba(2,8,23,.64);display:grid;place-items:center;padding:20px;z-index:100}.confirm-dialog{width:min(100%,480px);background:var(--paper);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);padding:28px}.confirm-dialog h2{font:700 24px/1.4 var(--serif);color:var(--text);margin:12px 0}.confirm-dialog p:not(.eyebrow){color:var(--muted);font-size:14px}.dialog-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:28px}
@media(max-width:900px){.rank-layout{grid-template-columns:1fr}.side-stack{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.hero{min-height:210px;padding:34px 20px}.hero-mark{display:none}.page-body{padding:20px 16px 60px}.toolbar{align-items:stretch;flex-direction:column}.tab-list{width:100%;display:grid;grid-template-columns:repeat(3,1fr)}.tab-list button{padding:8px 4px}.side-stack,.challenge-grid{grid-template-columns:1fr}.panel{padding:19px}.rank-row{gap:9px;padding:13px 4px}.avatar{width:32px;height:32px}.self-pill{padding:3px 7px}.person strong{font-size:13px}.points{font-size:13px}.dialog-actions{flex-direction:column-reverse}.dialog-actions button{width:100%}}
</style>
