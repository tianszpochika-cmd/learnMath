<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  applyState,
  calibrationCopy,
  calibrationVisible,
  checkboxAction,
  conflictBanner,
  dayCellClass,
  monthMatrix,
  suggestionCard,
  taskStateView,
  undoEnabled,
  type SuggestionUi,
  type TaskRowUi,
} from "../features/plan/planUi";

/** W12 计划日历（16W12 · BR-10 前端：建议 diff/3011 冲突/undo 禁用/校准；apply 权威在服务端）。 */
const router = useRouter();

const year = 2026;
const month = 9;
const weeks = computed(() => monthMatrix(year, month));
const selectedDay = ref(15);

const dayTasks: Record<number, { todo: number; done: number }> = {
  14: { todo: 0, done: 3 },
  15: { todo: 2, done: 1 },
  16: { todo: 3, done: 0 },
};

const tasks = reactive<TaskRowUi[]>([
  { id: 1, title: "判别式课时 ×1（P1）", kind: "objective", state: "completed" },
  { id: 2, title: "每日一练 5 题（P4）", kind: "objective", state: "todo" },
  { id: 3, title: "读《求根公式的来历》", kind: "reading", state: "todo" },
  { id: 4, title: "错题重练 3 题", kind: "objective", state: "skipped" },
  { id: 5, title: "几何预习（改期）", kind: "reading", state: "rescheduled" },
  { id: 6, title: "周三巩固（未参与）", kind: "objective", state: "absent" },
]);

const suggestion = reactive<SuggestionUi>({
  kind: "RETEST",
  basePlanRevision: 7,
  diffs: [
    { dateLabel: "周三", target: "判别式课时", from: "按原计划推进", to: "插入复测/补先修", reason: "7 天正确率 50% < 60%" },
    { dateLabel: "周五", target: "每日一练", from: "10 题", to: "8 题（先补不等式）", reason: "前置缺口" },
  ],
  windowKey: "kw-38-retest",
});

const currentRevision = ref(7);
const dismissed = reactive(new Set<string>());
const appliedAtRevision = ref<number | null>(null);
const hasNewEvidence = ref(false);
const pendingPlacement = ref(true);
const evidenceCount = ref(12);

const card = computed(() => suggestionCard(suggestion));
const state = computed(() => applyState(suggestion, currentRevision.value, dismissed));
const banner = computed(() =>
  state.value === "conflict-3011" ? conflictBanner(suggestion, currentRevision.value) : "",
);
const canUndo = computed(() =>
  appliedAtRevision.value === null ? false : undoEnabled(appliedAtRevision.value, currentRevision.value, hasNewEvidence.value),
);

function onCheck(t: TaskRowUi): void {
  const action = checkboxAction(t);
  if (action === "self-report") {
    t.state = "completed";
  } else if (action === "request-confirm") {
    // 客观任务：仅发起校验，等服务端完成事件回执（BR-10）
    void router;
    alertLike("已发起校验：完成以服务端学习事件回执为准（BR-10）");
  }
}
let tipTimer: ReturnType<typeof setTimeout> | null = null;
const tip = ref("");
function alertLike(msg: string): void {
  tip.value = msg;
  if (tipTimer) clearTimeout(tipTimer);
  tipTimer = setTimeout(() => (tip.value = ""), 2600);
}

function applySuggestion(): void {
  if (state.value === "conflict-3011") {
    alertLike("3011：已展示新旧差异，请确认后重试");
    return;
  }
  if (state.value !== "ready") return;
  appliedAtRevision.value = currentRevision.value;
  currentRevision.value += 1; // apply 成功 → 新版本
  alertLike("已应用建议（新计划版本 v" + currentRevision.value + "）");
}
function dismissSuggestion(): void {
  dismissed.add(suggestion.windowKey);
  alertLike("已忽略本窗口（同证据窗口不再提醒）");
}
function simulateConflict(): void {
  currentRevision.value += 1; // 模拟他处改计划
  alertLike("计划被其他端修改 → 版本前进，触发 3011");
}
function simulateEvidence(): void {
  hasNewEvidence.value = true;
  alertLike("新增学习证据 → 不允许回滚（给新建议）");
}
function bumpEvidence(): void {
  evidenceCount.value += 1;
}
</script>

<template>
  <div class="pl pad">
    <div class="head">
      <span class="bk" @click="router.push('/me/settings')">‹</span>
      <h1>学习计划</h1>
      <span class="chip">计划 v{{ currentRevision }}</span>
      <span class="chip grey">本周完成率 71%</span>
      <div class="acts">
        <button class="btn gray" @click="simulateConflict">模拟他端改计划</button>
        <button class="btn gray" @click="simulateEvidence">模拟新增证据</button>
      </div>
    </div>

    <p v-if="banner" class="conflict">⚠ {{ banner }}</p>
    <p v-if="tip" class="tip">{{ tip }}</p>

    <div class="grid">
      <!-- 月历 -->
      <section class="card">
        <div class="calhead">
          <b>{{ year }} 年 {{ month }} 月</b>
          <span class="mut">周 ⟷ 月 · 有任务描边 / 全完成实心</span>
        </div>
        <div class="cal">
          <span v-for="w in ['一', '二', '三', '四', '五', '六', '日']" :key="w" class="hd">{{ w }}</span>
          <template v-for="(week, wi) in weeks" :key="wi">
            <span
              v-for="(cell, ci) in week"
              :key="ci"
              class="day"
              :class="[cell.inMonth ? '' : 'off', dayCellClass(dayTasks[cell.day ?? -1]), selectedDay === cell.day ? 'sel' : '']"
              @click="cell.day && (selectedDay = cell.day)"
            >
              {{ cell.day ?? "" }}
            </span>
          </template>
        </div>
        <p class="mut">任务点映射 dayTasks（接 04 计划聚合接口）</p>
      </section>

      <!-- 当日任务 -->
      <section>
        <div class="card">
          <div class="sect">9 月 {{ selectedDay }} 日任务（跨路径聚合）</div>
          <label v-for="t in tasks" :key="t.id" class="task" :class="taskStateView(t).cls">
            <input
              type="checkbox"
              :checked="t.state === 'completed'"
              @change.prevent="onCheck(t)"
            />
            <div class="tinfo">
              <b>{{ t.title }}</b>
              <span class="mut">{{ taskStateView(t).label }}</span>
            </div>
            <span class="ticon">{{ taskStateView(t).icon }}</span>
          </label>
          <p class="mut">absent 连续 3 日 → 触发「减少时长/改期」建议（只建议不降能力 · BR-10）</p>
        </div>

        <!-- 建议卡 -->
        <div class="card mt" :class="'tone-' + card.tone">
          <div class="sughead">
            <b>{{ card.title }}</b>
            <span class="mut">基于 v{{ suggestion.basePlanRevision }} · 窗口 {{ suggestion.windowKey }}</span>
          </div>
          <div v-for="(line, i) in card.diffLines" :key="i" class="diffl">{{ line }}</div>

          <p v-if="state === 'dismissed'" class="state muted">已忽略（同证据窗口不再提醒）</p>
          <p v-if="state === 'no-op'" class="state muted">无可应用的建议</p>

          <div class="acts">
            <button
              class="btn"
              :disabled="state !== 'ready'"
              @click="applySuggestion"
            >
              {{ state === "conflict-3011" ? "查看差异后确认" : "应用建议" }}
            </button>
            <button class="btn gray" :disabled="state === 'dismissed'" @click="dismissSuggestion">忽略本窗口</button>
            <button class="btn gray" :disabled="!canUndo" :title="canUndo ? '' : '版本已变或已有新证据，不回滚'" @click="alertLike('已撤销（计划回滚，学习事实不变）')">
              撤销 {{ canUndo ? "" : "（不可用）" }}
            </button>
          </div>
          <p class="mut">
            undo 条件：版本未变 && 无新增证据（当前 {{ appliedAtRevision === null ? "未应用" : "已应用 v" + appliedAtRevision }} /
            {{ hasNewEvidence ? "有新证据" : "无新证据" }}）
          </p>
        </div>

        <!-- 校准 -->
        <div class="card mt" v-if="calibrationVisible(pendingPlacement, evidenceCount)">
          <div class="sughead">
            <b>校准推荐起点</b>
            <span class="mut">placement=pending · 证据 {{ evidenceCount }}/10</span>
          </div>
          <p class="mut">{{ calibrationCopy() }}</p>
          <div class="acts">
            <button class="btn gray" @click="bumpEvidence">模拟证据 +1</button>
            <button class="btn" @click="alertLike('已确认校准（仅更新推荐起点）'); pendingPlacement = false">确认校准</button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pad {
  padding: 22px 32px 48px;
  max-width: 1200px;
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
.chip.grey {
  background: #f1f5f9;
  color: #64748b;
}
.acts {
  margin-left: auto;
  display: flex;
  gap: 10px;
}
.conflict {
  margin-top: 12px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  border-radius: 10px;
  padding: 11px 15px;
  font-size: 14px;
  font-weight: 600;
}
.tip {
  margin-top: 10px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 10px;
  padding: 10px 15px;
  font-size: 13.5px;
}
.grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
}
.mt {
  margin-top: 16px;
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
.calhead {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}
.cal {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.hd {
  text-align: center;
  color: var(--ink3);
  font-size: 12px;
  padding: 4px 0;
}
.day {
  aspect-ratio: 1;
  border: 1px solid var(--line);
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-size: 13.5px;
  background: #fff;
}
.day.off {
  border-color: transparent;
  color: transparent;
  background: transparent;
}
.day.has {
  border: 2px solid var(--brand);
  color: var(--brand);
  font-weight: 800;
}
.day.alldone {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #047857;
  font-weight: 800;
}
.day.sel {
  outline: 2px solid var(--violet);
}
.task {
  display: flex;
  gap: 11px;
  align-items: center;
  padding: 11px 4px;
  border-top: 1px solid #f1f3f7;
}
.task input {
  width: 17px;
  height: 17px;
  accent-color: var(--ok);
}
.tinfo {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.tinfo b {
  font-size: 14.5px;
}
.task.done .tinfo b {
  color: var(--ok);
}
.task.absent .tinfo b {
  color: var(--bad);
}
.task.muted .tinfo b {
  color: var(--ink3);
  text-decoration: line-through;
}
.ticon {
  font-size: 15px;
}
.sughead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.diffl {
  font-size: 13.5px;
  background: #f8fafc;
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 9px 12px;
  margin-top: 8px;
  line-height: 1.7;
}
.state {
  margin-top: 10px;
  font-size: 13.5px;
}
.state.muted {
  color: var(--ink3);
}
.tone-amber {
  border-left: 4px solid var(--warn);
}
.tone-blue {
  border-left: 4px solid var(--brand);
}
.tone-green {
  border-left: 4px solid var(--ok);
}
.tone-grey {
  border-left: 4px solid #cbd5e1;
}
.acts {
  display: flex;
  gap: 10px;
  margin-top: 12px;
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
.btn:disabled {
  opacity: 0.45;
  cursor: default;
}
.btn.gray {
  background: #eef0f4;
  color: var(--ink2);
}
.mut + .mut,
.card > .mut {
  margin-top: 8px;
}
@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
