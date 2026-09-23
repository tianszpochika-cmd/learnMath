<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { breakBadge, chainPreview, dueText, profileNote, snapshotDisplayable, type WrongTab } from "../features/wrongbook/wrongbookUi";
import { masterWrong, readWrongbook, redoWrongbook, type WrongbookRow } from "../services/wrongbook";

const router = useRouter();
const rows = ref<WrongbookRow[]>([]);
const total = ref<number | null>(null);
const page = ref(1);
const size = 20;
const loading = ref(true);
const busy = ref(false);
const error = ref("");
const notice = ref("");
const tab = ref<WrongTab>("all");
const openId = ref<string | null>(null);
const confirmMaster = ref<string | null>(null);
const tabs: Array<{ key: WrongTab; label: string }> = [
  { key: "all", label: "全部" }, { key: "due", label: "到期" },
  { key: "unmastered", label: "未掌握" }, { key: "has-break", label: "有断链" },
];
const visible = computed(() => rows.value.filter((item) => tab.value === "all" ||
  tab.value === "due" && item.dueDays !== null && item.dueDays <= 0 && !item.mastered ||
  tab.value === "unmastered" && !item.mastered ||
  tab.value === "has-break" && item.breakStatus !== "none"));
const hasNext = computed(() => total.value === null ? rows.value.length === size : page.value * size < total.value);

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const result = await readWrongbook(page.value, size);
    rows.value = result.rows;
    total.value = result.total;
    openId.value = null;
  } catch (cause) {
    rows.value = [];
    error.value = cause instanceof Error ? cause.message : "错题本暂时无法读取。";
  } finally { loading.value = false; }
}

async function changePage(next: number) {
  if (next < 1 || next > page.value && !hasNext.value) return;
  page.value = next;
  await load();
}

async function redo() {
  if (busy.value || !rows.value.length) return;
  busy.value = true;
  error.value = "";
  try { const attemptId = await redoWrongbook(Math.min(2, rows.value.length)); await router.push("/paper/" + encodeURIComponent(attemptId)); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "重练暂不可用，请稍后重试。"; }
  finally { busy.value = false; }
}

async function markMastered(row: WrongbookRow) {
  if (confirmMaster.value !== row.questionId) { confirmMaster.value = row.questionId; return; }
  busy.value = true;
  error.value = "";
  notice.value = "";
  try { await masterWrong(row.questionId); confirmMaster.value = null; await load(); notice.value = "已按服务端结果更新掌握状态。"; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "标记未保存，请重试。"; }
  finally { busy.value = false; }
}

onMounted(() => { void load(); });
</script>

<template>
  <div class="wrongbook-page">
    <header class="hero"><p class="eyebrow">WRONGBOOK · 错题与断链</p><h1>每道错题，都是下一步的线索</h1><p>先看服务端保存的错因与原解法证据，再决定重练或补前置。</p></header>
    <main class="main"><div class="toolbar"><div class="tabs" role="group" aria-label="本页错题筛选"><button v-for="entry in tabs" :key="entry.key" type="button" :aria-pressed="tab === entry.key" @click="tab = entry.key">{{ entry.label }}</button></div><button type="button" class="redo" :disabled="loading || busy || !rows.length" @click="redo">{{ busy ? "正在创建重练…" : "开始错题重练" }}</button></div>
      <p class="filter-note">筛选仅作用于当前页；重练请求最多 2 题，实际题量与作答编号由服务端返回。</p>
      <p v-if="loading" class="state" role="status">正在读取错题与断链证据…</p>
      <div v-else-if="error && !rows.length" class="state" role="alert"><h2>暂时无法读取错题本</h2><p>{{ error }}</p><button type="button" @click="load">重试</button></div>
      <div v-else-if="!rows.length" class="state"><h2>当前没有错题</h2><p>这里不会使用示例题代替你的真实练习记录。</p><RouterLink to="/paths">从学习路径开始 →</RouterLink></div>
      <div v-else class="layout"><section class="list" aria-label="错题列表"><article v-for="row in visible" :key="row.questionId" class="wrong-card"><button type="button" class="card-head" :aria-expanded="openId === row.questionId" @click="openId = openId === row.questionId ? null : row.questionId"><span class="q-number">#{{ row.questionId }}</span><span class="title">{{ row.title }}</span><span v-if="row.breakStatus !== 'none'" class="badge" :class="row.breakStatus">{{ breakBadge(row.breakStatus).text }}</span><span class="expand">{{ openId === row.questionId ? "收起 −" : "详情 +" }}</span></button><div class="meta"><span v-if="row.node">{{ row.node }}</span><span>{{ row.dueDays === null ? "复习时间待同步" : dueText(row.dueDays) }}</span><span v-if="row.wrongCount !== null">错 {{ row.wrongCount }} 次</span><span v-if="row.mastered">已标记掌握</span></div><div v-if="openId === row.questionId" class="detail"><div v-if="snapshotDisplayable(row.evidence)" class="snapshot"><p><strong>原解法步骤编号快照：</strong>{{ chainPreview(row.evidence!.minimalChainSteps) }}</p><p v-if="row.evidence!.stepDetails?.length">{{ row.evidence!.stepDetails!.map((step) => `S${step.id}：${step.content}`).join("；") }}</p><p v-else>服务端尚未返回步骤正文；这些编号仅用于核对原链，不据此推断具体推理内容。</p><p v-if="row.evidence!.warrantNodeSnapshot?.length">原依据节点编号：{{ row.evidence!.warrantNodeSnapshot!.join("、") }}</p></div><p v-else>目前没有可回放的断链步骤快照，不会推测你卡在了哪一步。</p><p v-if="row.breakStatus !== 'none'" class="evidence">{{ profileNote(row.breakStatus) }} · {{ row.breakStatus === 'suggested' || row.breakStatus === 'unlocated' ? '这是待确认的线索，不作确定断言。' : '请结合实际作答核对证据。' }}</p><div class="card-actions"><RouterLink :to="'/deepdive/question/' + row.questionId">重走这道题 →</RouterLink><button v-if="!row.mastered" type="button" :disabled="busy" @click="markMastered(row)">{{ confirmMaster === row.questionId ? "确认标记已掌握" : "标记已掌握" }}</button></div></div></article><div v-if="!visible.length" class="state compact">当前页没有符合筛选条件的错题。可切换筛选或翻页查看。</div><nav class="pagination" aria-label="错题分页"><button type="button" :disabled="loading || page <= 1" @click="changePage(page - 1)">上一页</button><span>第 {{ page }} 页<span v-if="total !== null"> · 共 {{ total }} 条</span></span><button type="button" :disabled="loading || !hasNext" @click="changePage(page + 1)">下一页</button></nav></section><aside class="aside"><p class="eyebrow">EVIDENCE FIRST</p><h2>先看证据，再做判断</h2><p>“可能卡住”与“预测答错”表示不同的证据强度。未确认的建议不会计入你的推理画像。</p><RouterLink to="/graph">查看相关知识图谱 →</RouterLink><p class="side-note">如果 AI 服务不可用，仍可阅读原解法、手动标记掌握并继续重练。</p></aside></div>
      <p v-if="notice" class="notice" role="status">{{ notice }}</p><p v-if="error && rows.length" class="error" role="alert">{{ error }}</p>
    </main>
  </div>
</template>

<style scoped>
.wrongbook-page{min-height:100vh;background:var(--bg,#f5f7fb);color:var(--ink,#14213b)}.hero{padding:45px max(24px,calc((100vw - 1180px)/2));background:linear-gradient(125deg,#102245,#263c73);color:#fff}.eyebrow{margin:0 0 10px;color:var(--brand,#4e7bff);font-size:11px;font-weight:850;letter-spacing:.16em}.hero .eyebrow{color:#9bb8ff}.hero h1{margin:0;font:700 clamp(28px,4vw,44px)/1.25 var(--serif,Georgia,serif)}.hero>p:last-child{color:#cfdbf3;line-height:1.8}.main{max-width:1180px;margin:auto;padding:28px 24px 60px}.toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px}.tabs{display:flex;flex-wrap:wrap;gap:6px;padding:5px;border:1px solid var(--line);border-radius:13px;background:var(--card,#fff)}.tabs button{min-height:39px;padding:7px 14px;border:0;border-radius:9px;background:transparent;color:var(--ink2,#334155);font-weight:700}.tabs button[aria-pressed=true]{background:var(--brand-soft,#eef3ff);color:var(--brand,#2f6bff)}.redo{min-height:47px;padding:10px 18px;border:0;border-radius:11px;background:var(--brand);color:#fff;font-weight:800}.redo:disabled,button:disabled{opacity:.5}.filter-note{color:var(--ink3,#64748b);font-size:12px;line-height:1.6}.layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(260px,.9fr);align-items:start;gap:19px;margin-top:24px}.list{display:grid;gap:13px}.wrong-card,.aside,.state{border:1px solid var(--line,#e0e5ed);border-radius:17px;background:var(--card,#fff);padding:20px}.card-head{display:flex;align-items:center;flex-wrap:wrap;gap:10px;width:100%;border:0;background:transparent;color:var(--ink);text-align:left;cursor:pointer}.q-number{color:var(--brand);font-size:13px;font-weight:800}.title{flex:1;min-width:160px;font:700 18px var(--serif,Georgia,serif)}.badge{padding:5px 9px;border-radius:99px;background:#eaf1ff;color:#315cad;font-size:11px;font-weight:800}.badge.observed{background:#ffebe8;color:#ac3939}.badge.suggested{background:#fff3d8;color:#855a00}.badge.unlocated{background:var(--soft);color:var(--ink3)}.expand{color:var(--ink3);font-size:12px}.meta{display:flex;flex-wrap:wrap;gap:14px;margin:12px 0 0 43px;color:var(--ink3);font-size:12px}.detail{margin-top:19px;padding-top:16px;border-top:1px solid var(--line);color:var(--ink2);line-height:1.7}.detail .evidence{padding:11px 13px;border-radius:9px;background:var(--brand-soft);font-size:13px}.card-actions{display:flex;flex-wrap:wrap;gap:15px;align-items:center;margin-top:15px}.card-actions a,.aside a,.state a{color:var(--brand);font-weight:800}.card-actions button{min-height:40px;padding:8px 12px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink)}.aside{position:sticky;top:22px;padding:25px}.aside h2,.state h2{margin:0 0 10px;font:700 25px var(--serif,Georgia,serif)}.aside p{line-height:1.7;color:var(--ink3)}.side-note{margin-top:25px;padding-top:18px;border-top:1px solid var(--line);font-size:13px}.state{text-align:center;line-height:1.7}.state button,.pagination button{min-height:40px;padding:8px 14px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink)}.state.compact{padding:25px}.pagination{display:flex;align-items:center;justify-content:center;gap:18px;padding:15px;color:var(--ink3);font-size:13px}.notice,.error{margin-top:16px;padding:11px 14px;border-radius:10px;background:#eaf5ec;color:#23713d}.error{background:#fff0ef;color:#a53535}
@media(max-width:820px){.layout{grid-template-columns:1fr}.aside{position:static}.hero{padding:30px 22px}}@media(max-width:560px){.main{padding:16px}.toolbar{align-items:stretch}.tabs{width:100%;justify-content:space-between}.tabs button{font-size:12px;padding:7px}.redo{width:100%}.meta{margin-left:0}}
</style>
