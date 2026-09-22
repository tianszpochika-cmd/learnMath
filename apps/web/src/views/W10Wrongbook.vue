<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  aiUnavailableFallback,
  breakBadge,
  chainPreview,
  deterministic,
  dueText,
  filterWrong,
  profileNote,
  remediationPlan,
  showBreakDetail,
  snapshotDisplayable,
  versionNote,
  type BreakStatus,
  type WrongItem,
  type WrongTab,
} from "../features/wrongbook/wrongbookUi";

/** W10 错题本 + 断链详情（16W10 · 20 §5 BR-05 展示镜像）。 */
const router = useRouter();

const list = reactive<WrongItem[]>([
  { id: 1024, title: "#1024 因式分解基础", node: "因式分解", wrongCount: 2, dueDays: 0, mastered: false, breakStatus: "observed" },
  { id: 1102, title: "#1102 十字相乘", node: "十字相乘", wrongCount: 1, dueDays: 3, mastered: false, breakStatus: "none" },
  { id: 1310, title: "#1310 逆向构造（韦达）", node: "韦达定理", wrongCount: 5, dueDays: -2, mastered: false, breakStatus: "self_reported" },
  { id: 2044, title: "#2044 河宽测量", node: "解三角形", wrongCount: 1, dueDays: 1, mastered: false, breakStatus: "suggested" },
  { id: 2101, title: "#2101 尚未定位样例", node: "判别式", wrongCount: 1, dueDays: 2, mastered: false, breakStatus: "unlocated" },
]);

const tab = ref<WrongTab>("all");
const filtered = computed(() => filterWrong(list, tab.value));

const openId = ref<number | null>(1024);
function toggle(id: number): void {
  openId.value = openId.value === id ? null : id;
}

const CURRENT_CHAIN_VERSION = 3;
const evidenceOf: Record<number, { solutionPathId: number | null; chainVersion: number | null; minimalChainSteps: number[] }> = {
  1024: { solutionPathId: 77, chainVersion: 2, minimalChainSteps: [1, 2, 3] },
  1310: { solutionPathId: 88, chainVersion: 3, minimalChainSteps: [1, 2] },
  2044: { solutionPathId: 90, chainVersion: 3, minimalChainSteps: [1, 4] },
  2101: { solutionPathId: null, chainVersion: null, minimalChainSteps: [] },
};

function evidence(id: number) {
  return evidenceOf[id] ?? { solutionPathId: null, chainVersion: null, minimalChainSteps: [] };
}

const plan = remediationPlan(1, true); // 同知识点仅 1 题 → 如实展示
const aiFallback = aiUnavailableFallback();

const TABS: Array<{ key: WrongTab; label: string }> = [
  { key: "all", label: "全部" },
  { key: "due", label: "到期" },
  { key: "unmastered", label: "未掌握" },
  { key: "has-break", label: "有断链" },
];
</script>

<template>
  <div class="wb pad">
    <div class="head">
      <span class="bk" @click="router.push('/do')">‹</span>
      <h1>错题本</h1>
      <div class="tabs">
        <button v-for="t in TABS" :key="t.key" :class="{ on: tab === t.key }" @click="tab = t.key">
          {{ t.label }}
        </button>
      </div>
      <button class="btn" style="margin-left: auto" @click="router.push('/paper/9001')">一键重练 {{ filtered.length }}</button>
    </div>

    <div class="grid">
      <section>
        <div v-for="i in filtered" :key="i.id" class="card item" :class="{ open: openId === i.id }">
          <div class="ihead" @click="toggle(i.id)">
            <b>{{ i.title }}</b>
            <span class="tag">{{ i.node }}</span>
            <span v-if="i.breakStatus !== 'none'" class="bdg" :class="breakBadge(i.breakStatus).tone">
              {{ breakBadge(i.breakStatus).text }}
            </span>
            <span class="due" :class="{ over: i.dueDays <= 0 }">{{ dueText(i.dueDays) }}</span>
            <span class="mut">错 {{ i.wrongCount }} 次</span>
          </div>

          <!-- 断链详情（行内展开） -->
          <div v-if="openId === i.id && showBreakDetail(i.breakStatus)" class="breakbox">
            <div class="chainline" v-if="snapshotDisplayable(evidence(i.id))">
              <b>原解法步骤快照：</b>{{ chainPreview(evidence(i.id).minimalChainSteps) }}
              <span class="mut">（含 warrant_nodes 快照 · 链重排/下架仍回放）</span>
            </div>
            <p v-if="versionNote(evidence(i.id), CURRENT_CHAIN_VERSION)" class="vnote">
              ⚠ {{ versionNote(evidence(i.id), CURRENT_CHAIN_VERSION) }}
            </p>
            <p v-if="evidence(i.id).solutionPathId === null" class="mut">
              无链信息（unlocated）：仅可手选步骤/自报 —— 见右侧降级动作
            </p>
            <div class="meta">
              <span class="chip">{{ profileNote(i.breakStatus) }}</span>
              <span class="chip grey" v-if="!deterministic(i.breakStatus)">不作确定断言</span>
            </div>
            <div class="acts">
              <button class="btn ghost" @click="router.push('/deepdive/question/' + i.id)">在深钻里重走这题</button>
              <button class="btn gray" @click="router.push('/graph/node/12')">去补知识点</button>
            </div>
          </div>
        </div>

        <p v-if="filtered.length === 0" class="empty">该筛选下暂无错题 —— 换个 Tab 或去做每日一练</p>
      </section>

      <aside>
        <!-- 补救（如实数量） -->
        <div class="card">
          <div class="sect">补救推荐</div>
          <p class="planmsg">{{ plan.message }}</p>
          <button class="btn" style="width: 100%; margin-top: 10px" :disabled="!plan.startButton" @click="router.push('/paper/9001')">
            {{ plan.startButton ? plan.message : "暂不可开始" }}
          </button>
          <p class="mut">期望上限 2 题；不足显示实际数量、0 题给内容+稍后复习（BR-05）</p>
        </div>

        <!-- AI 降级 -->
        <div class="card">
          <div class="sect">AI 不可用降级（提交不等待）</div>
          <p class="fbhead">{{ aiFallback.headline }}</p>
          <div class="acts col">
            <button v-for="a in aiFallback.actions" :key="a" class="btn gray w" @click="router.push('/deepdive/question/1024')">
              {{ a }}
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.pad {
  padding: 22px 32px 48px;
  max-width: 1180px;
  margin: 0 auto;
}
.head {
  display: flex;
  gap: 16px;
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
  opacity: 0.45;
  cursor: default;
}
.btn.ghost {
  background: var(--brand-soft);
  color: var(--brand);
}
.btn.gray {
  background: #eef0f4;
  color: var(--ink2);
}
.btn.w {
  width: 100%;
}
.grid {
  display: grid;
  grid-template-columns: 1.7fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px 16px;
}
.item {
  margin-bottom: 12px;
  cursor: pointer;
}
.item.open {
  border-color: var(--brand);
}
.ihead {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.ihead b {
  font-size: 15.5px;
}
.tag {
  font-size: 11.5px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 7px;
  padding: 2px 9px;
  font-weight: 700;
}
.bdg {
  font-size: 11.5px;
  font-weight: 800;
  border-radius: 7px;
  padding: 2px 9px;
}
.bdg.red {
  background: #fee2e2;
  color: #b91c1c;
}
.bdg.amber {
  background: #fef3c7;
  color: #b45309;
}
.bdg.blue {
  background: #e0e7ff;
  color: #4338ca;
}
.bdg.grey {
  background: #f1f5f9;
  color: #64748b;
}
.due {
  font-size: 12.5px;
  color: var(--ok);
  font-weight: 700;
}
.due.over {
  color: var(--bad);
}
.mut {
  color: var(--ink3);
  font-size: 12.5px;
}
.breakbox {
  border-top: 1px dashed var(--line);
  margin-top: 12px;
  padding-top: 12px;
}
.chainline {
  font-size: 14px;
  background: #f8fafc;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 10px 12px;
}
.vnote {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  border-radius: 9px;
  padding: 9px 12px;
  font-size: 13px;
  margin-top: 10px;
}
.meta {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.chip {
  font-size: 12.5px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 3px 12px;
  font-weight: 600;
}
.chip.grey {
  background: #f1f5f9;
  color: #64748b;
}
.acts {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.acts.col {
  flex-direction: column;
}
.empty {
  color: var(--ink3);
  font-size: 14px;
  background: #fff;
  border: 1px dashed var(--line);
  border-radius: 12px;
  padding: 26px;
  text-align: center;
}
.sect {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink3);
  margin-bottom: 8px;
}
.planmsg {
  font-size: 14.5px;
  line-height: 1.7;
}
.fbhead {
  font-size: 13.5px;
  font-weight: 600;
  color: #92400e;
  background: #fffbeb;
  border-radius: 9px;
  padding: 9px 12px;
  margin-bottom: 10px;
}
@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
