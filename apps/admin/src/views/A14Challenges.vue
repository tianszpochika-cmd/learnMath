<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  challengeDraftIssues,
  checkChallengePaper,
  readChallenge,
  readChallengeRecords,
  readChallenges,
  saveChallenge,
  type ChallengeDetail,
  type ChallengeRecord,
  type ChallengeSummary,
  type PaperGate,
} from "../services/challenges";

const router = useRouter();
const challenges = ref<ChallengeSummary[]>([]);
const draft = ref<ChallengeDetail | null>(null);
const saved = ref<ChallengeDetail | null>(null);
const records = ref<ChallengeRecord[]>([]);
const paperGate = ref<PaperGate | null>(null);
const listState = ref<"loading" | "ready" | "error">("loading");
const detailState = ref<"idle" | "loading" | "ready" | "error">("idle");
const recordState = ref<"idle" | "loading" | "ready" | "error">("idle");
const gateState = ref<"idle" | "loading" | "ready" | "error">("idle");
const busy = ref(false);
let detailRequest = 0;
const notice = ref("");
const tone = ref<"neutral" | "good" | "warn" | "bad">("neutral");
const dirty = computed(() => Boolean(draft.value && saved.value && ["title", "paperId", "startsAt", "endsAt"].some((field) =>
  String(draft.value?.[field as keyof ChallengeDetail] ?? "") !== String(saved.value?.[field as keyof ChallengeDetail] ?? "")
)));

function message(error: unknown): string { return error instanceof Error && error.message ? error.message : "请求失败，请稍后重试"; }
function status(text: string, kind: "neutral" | "good" | "warn" | "bad" = "neutral"): void { notice.value = text; tone.value = kind; }
function duration(seconds: number | null): string {
  if (seconds === null) return "—";
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}
function edit(): void { paperGate.value = null; gateState.value = "idle"; status("赛事配置已在本页修改，尚未保存。", "warn"); }

async function loadList(): Promise<void> {
  listState.value = "loading";
  try {
    challenges.value = await readChallenges();
    listState.value = "ready";
    if (!draft.value && challenges.value.length) await selectChallenge(challenges.value[0].id);
  } catch (error) { listState.value = "error"; status(message(error), "bad"); }
}
async function selectChallenge(id: string): Promise<void> {
  if (dirty.value && typeof window !== "undefined" && !window.confirm("当前赛事配置尚未保存，确定切换吗？")) return;
  const request = ++detailRequest;
  detailState.value = "loading";
  paperGate.value = null;
  gateState.value = "idle";
  status("");
  try {
    const detail = await readChallenge(id);
    if (request !== detailRequest) return;
    draft.value = { ...detail };
    saved.value = { ...detail };
    detailState.value = "ready";
    void loadRecords(id);
  } catch (error) { if (request !== detailRequest) return; detailState.value = "error"; status(message(error), "bad"); }
}
async function loadRecords(id = draft.value?.id): Promise<void> {
  if (!id) return;
  recordState.value = "loading";
  records.value = [];
  try {
    const result = await readChallengeRecords(id);
    if (draft.value?.id !== id) return;
    records.value = result;
    recordState.value = "ready";
  } catch (error) {
    if (draft.value?.id !== id) return;
    recordState.value = "error";
    status(`参赛明细读取失败：${message(error)}`, "bad");
  }
}
async function checkPaper(): Promise<void> {
  if (!draft.value) return;
  const issues = challengeDraftIssues(draft.value);
  if (issues.length) { status(issues.join("；"), "bad"); return; }
  gateState.value = "loading";
  paperGate.value = null;
  const paperId = draft.value.paperId;
  try {
    const gate = await checkChallengePaper(paperId);
    if (draft.value?.paperId !== paperId) return;
    paperGate.value = gate;
    gateState.value = "ready";
    status(gate.checked
      ? "试卷返回字段通过当前前置检查；发布与开赛仍须服务端再次核验题族、曝光和快照。"
      : `无法确认试卷可用于挑战：${gate.blockers.join("；")}`, gate.checked ? "warn" : "bad");
  } catch (error) { if (draft.value?.paperId !== paperId) return; gateState.value = "error"; status(`试卷校验未完成：${message(error)}`, "bad"); }
}
async function persist(): Promise<void> {
  if (!draft.value || busy.value) return;
  const issues = challengeDraftIssues(draft.value);
  if (issues.length) { status(issues.join("；"), "bad"); return; }
  busy.value = true;
  const attempted = { ...draft.value };
  try {
    await saveChallenge(attempted);
    const confirmed = await readChallenge(attempted.id);
    if (["title", "paperId", "startsAt", "endsAt"].some((field) =>
      String(confirmed[field as keyof ChallengeDetail] ?? "") !== String(attempted[field as keyof ChallengeDetail] ?? ""))) {
      status("保存请求已返回，但赛事详情回读与工作稿不一致。请刷新核对，暂不标记为已保存。", "warn");
      return;
    }
    saved.value = { ...confirmed };
    draft.value = { ...confirmed };
    challenges.value = challenges.value.map((item) => item.id === confirmed.id ? { id: confirmed.id, title: confirmed.title, status: confirmed.status } : item);
    paperGate.value = null;
    gateState.value = "idle";
    status("服务端已确认配置保存；本页没有发起发布或开赛操作。", "good");
  } catch (error) { status(message(error), "bad"); }
  finally { busy.value = false; }
}
onMounted(() => { void loadList(); });
</script>

<template>
  <div class="workspace-page">
    <header class="page-head"><div><p class="eyebrow">CHALLENGE OPERATIONS · A14</p><h1>挑战赛配置与监控</h1><p>赛事规则、试卷题池与参赛记录分别核对。异常标记供人工复核，不等于违规结论。</p></div><div class="head-actions"><button type="button" class="button" @click="router.push('/papers')">前往组卷</button><button type="button" class="button" :disabled="!draft || gateState === 'loading'" @click="checkPaper">核对关联试卷</button></div></header>
    <p v-if="notice" class="notice" :class="tone" role="status">{{ notice }}</p>
    <div class="layout">
      <aside class="panel list-panel"><div class="panel-head"><h2>赛事列表</h2><button type="button" class="text-button" :disabled="listState === 'loading'" @click="loadList">刷新</button></div><p v-if="listState === 'loading'" class="empty">正在读取赛事…</p><p v-else-if="listState === 'error'" class="empty">赛事列表读取失败。</p><p v-else-if="!challenges.length" class="empty">暂无可展示赛事。</p><button v-for="item in challenges" :key="item.id" type="button" class="list-choice" :class="{ selected: draft?.id === item.id }" @click="selectChallenge(item.id)"><strong>{{ item.title }}</strong><span>#{{ item.id }} · {{ item.status || '状态未返回' }}</span></button></aside>
      <template v-if="detailState === 'loading'"><section class="panel content-state">正在读取赛事详情…</section></template>
      <template v-else-if="draft">
        <section class="panel rules-panel">
          <div class="panel-head"><div><p class="eyebrow">EVENT CONFIGURATION</p><h2>赛事工作稿</h2></div><span class="pill">{{ draft.status || '状态未返回' }}</span></div>
          <div class="fields"><label class="field"><span>赛事名称</span><input v-model="draft.title" @input="edit"></label><label class="field"><span>关联试卷 ID</span><input v-model="draft.paperId" inputmode="numeric" @input="edit"></label><label class="field"><span>开始时间 · ISO 8601</span><input v-model="draft.startsAt" placeholder="2026-09-28T10:00:00" @input="edit"></label><label class="field"><span>结束时间 · ISO 8601</span><input v-model="draft.endsAt" placeholder="2026-09-29T10:00:00" @input="edit"></label></div>
          <div class="rule-snapshot"><h3>服务端返回的作答规则</h3><div><span>反馈时机</span><strong>{{ draft.feedbackMode || '未返回' }}</strong></div><div><span>辅助策略</span><strong>{{ draft.assistancePolicy || '未返回' }}</strong></div><p>作答时长和题池细节需从关联试卷确认；当前没有把展示字段假定为可写配置。</p></div>
          <div class="gate"><h3>题池与发布门禁</h3><p>挑战赛只允许审核客观题；排除公开每日题及同族、训练已曝光题族。发布与开赛时还需服务端再次检查。</p><p v-if="gateState === 'loading'">正在读取试卷字段…</p><p v-else-if="paperGate?.checked" class="success">本次读取的试卷字段通过前置检查；并非发布许可。</p><ul v-else-if="paperGate?.blockers.length"><li v-for="issue in paperGate.blockers" :key="issue">{{ issue }}</li></ul><p v-else>尚未核对关联试卷。</p></div>
          <div class="actions"><button type="button" class="button primary" :disabled="busy || !dirty" @click="persist">{{ busy ? '正在保存…' : '保存工作稿' }}</button><button type="button" class="button" disabled title="赛事独立发布接口与审核字段尚未定义">发布赛事 · 等待发布契约</button></div><p class="micro">保存接口只提交配置字段；不会把草稿状态改写成已发布。</p>
        </section>
        <section class="panel records-panel">
          <div class="panel-head"><div><p class="eyebrow">PARTICIPATION REVIEW</p><h2>参赛明细</h2></div><button type="button" class="text-button" :disabled="recordState === 'loading'" @click="loadRecords()">刷新记录</button></div>
          <p v-if="recordState === 'loading'" class="empty">正在读取参赛记录…</p><p v-else-if="recordState === 'error'" class="empty">参赛记录暂不可读取。</p><p v-else-if="recordState === 'ready' && !records.length" class="empty">暂无服务端确认的参赛记录。</p>
          <div v-else-if="recordState === 'ready'" class="table-wrap"><table><thead><tr><th>名次</th><th>参赛者</th><th>客观分</th><th>用时</th><th>复核状态</th></tr></thead><tbody><tr v-for="row in records" :key="row.id"><td>{{ row.position === null ? '—' : row.position }}</td><td>{{ row.displayName }}</td><td>{{ row.score === null ? '—' : row.score }}</td><td>{{ duration(row.durationSeconds) }}</td><td><span v-if="row.anomalyFlag" class="flag">服务端标记 · 待人工复核</span><span v-else>{{ row.reviewStatus || '—' }}</span></td></tr></tbody></table></div>
          <p class="micro">页面不按时长自行判定异常；记录顺序、名次和复核状态以服务端返回为准。</p>
        </section>
      </template>
      <section v-else class="panel content-state">{{ detailState === 'error' ? '赛事详情暂不可读取，请重新选择。' : '选择赛事查看配置与监控。' }}</section>
    </div>
  </div>
</template>

<style scoped>
.workspace-page{--paper-local:var(--ops-card);--soft-local:var(--ops-soft);--text-local:var(--ink);--muted-local:var(--ink2);--primary-local:var(--brand);max-width:1500px;margin:auto;padding:30px 28px 72px;color:var(--text-local)}.page-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:22px}.eyebrow{font-size:11px;letter-spacing:.14em;color:var(--brand-deep);font-weight:800}.page-head h1{font:700 clamp(28px,3vw,40px)/1.25 var(--serif,Georgia,serif);margin:7px 0 8px}.page-head p:last-child{color:var(--muted-local);max-width:720px}.head-actions,.actions{display:flex;gap:8px;flex-wrap:wrap}.button,.text-button{border:1px solid var(--line);background:var(--paper-local);color:var(--text-local);border-radius:9px;padding:8px 13px;min-height:36px;font-weight:700}.button:hover:not(:disabled){border-color:var(--primary-local);color:var(--primary-local)}.button:disabled{opacity:.48;cursor:not-allowed}.button.primary{background:var(--grad);color:var(--ops-on-brand);border-color:transparent}.text-button{border:0;color:var(--primary-local);padding:3px}.layout{display:grid;grid-template-columns:205px minmax(340px,.95fr) minmax(360px,1fr);gap:16px;align-items:start}.panel{background:var(--paper-local);border:1px solid var(--line);border-radius:15px;padding:20px;box-shadow:var(--shadow,0 10px 28px -22px #29467088);min-width:0}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.panel h2{font-size:18px}.list-panel{display:grid;gap:7px}.list-choice{border:1px solid var(--line);border-radius:9px;background:var(--paper-local);padding:10px;text-align:left;display:grid;gap:3px;color:var(--text-local)}.list-choice.selected{border-color:var(--primary-local);background:var(--brand-soft)}.list-choice span,.micro{color:var(--muted-local);font-size:12px}.pill{border-radius:99px;background:var(--brand-soft);color:var(--brand-deep);padding:4px 10px;font-size:12px;font-weight:800}.empty,.content-state{color:var(--muted-local);padding:24px 6px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:2px 12px}.field{display:grid;gap:6px;margin:8px 0}.field span{font-size:12px;font-weight:750}.field input{width:100%;border:1px solid var(--line);background:var(--paper-local);color:var(--text-local);border-radius:8px;padding:9px}.field:first-child{grid-column:1/-1}.rule-snapshot,.gate{background:var(--soft-local);border-radius:10px;padding:13px;margin:16px 0}.rule-snapshot h3,.gate h3{font-size:13px;margin-bottom:8px}.rule-snapshot div{display:flex;justify-content:space-between;gap:15px;padding:5px 0;font-size:12px}.rule-snapshot div span{color:var(--muted-local)}.rule-snapshot p,.gate p,.gate li{font-size:12px;color:var(--muted-local)}.gate ul{padding-left:18px}.gate li{color:var(--ink)}.gate .success{color:var(--ok)}.actions{margin:17px 0 10px}.notice{padding:11px 13px;border-radius:10px;border:1px solid var(--line);background:var(--soft-local);margin-bottom:15px;font-size:12px}.notice.good{background:var(--ops-soft);color:var(--ink)}.notice.warn{background:var(--ops-warn-bg);color:var(--ink)}.notice.bad{background:var(--ops-danger-bg);color:var(--ink)}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;min-width:510px;font-size:12px}th,td{text-align:left;border-bottom:1px solid var(--line);padding:10px 7px}th{color:var(--muted-local);font-weight:700}td{color:var(--text-local)}.flag{color:var(--warn);font-weight:750}.records-panel>.micro{margin-top:14px}
@media(max-width:1300px){.layout{grid-template-columns:210px minmax(0,1fr)}.records-panel{grid-column:2}}@media(max-width:760px){.workspace-page{padding:20px 14px 60px}.page-head{display:block}.head-actions{margin-top:14px}.layout{grid-template-columns:1fr}.records-panel{grid-column:auto}.fields{grid-template-columns:1fr}}
</style>
