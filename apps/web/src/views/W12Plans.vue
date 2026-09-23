<script setup lang="ts">
import { ApiError } from "@learnmath/shared";
import { computed, nextTick, onMounted, ref } from "vue";
import { dayCellClass, monthMatrix } from "../features/plan/planUi";
import {
  actOnSuggestion,
  createRulePlan,
  readCurrentPlan,
  readPlanCalendar,
  readPlanSuggestions,
  undoPlan,
  type PlanDay,
  type PlanSuggestion,
  type PlanTask,
  type PlanView,
} from "../services/plans";

type Action = { kind: "apply" | "dismiss"; suggestion: PlanSuggestion; revision: number } | { kind: "undo"; revision: number };
const now = new Date();
const todayKey = dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
const monthYear = ref(now.getFullYear());
const monthNumber = ref(now.getMonth() + 1);
const selectedDate = ref(todayKey);
const weeks = computed(() => monthMatrix(monthYear.value, monthNumber.value));
const plan = ref<PlanView | null>(null);
const calendar = ref<PlanDay[]>([]);
const suggestions = ref<PlanSuggestion[]>([]);
const loading = ref(false);
const calendarLoading = ref(false);
const suggestionLoading = ref(false);
const busy = ref(false);
const error = ref("");
const calendarError = ref("");
const suggestionError = ref("");
const notice = ref("");
const conflict = ref<{ previous: PlanSuggestion; current: PlanSuggestion | null } | null>(null);
const action = ref<Action | null>(null);
const confirmPanel = ref<HTMLElement | null>(null);
const goal = ref("");
const dailyMinutes = ref<number | null>(30);
let planSerial = 0;
let calendarSerial = 0;
let suggestionSerial = 0;
let priorFocus: HTMLElement | null = null;

function dateKey(year: number, month: number, day: number): string {
  return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}
function monthBounds(): { from: string; to: string } {
  const finalDay = new Date(monthYear.value, monthNumber.value, 0).getDate();
  return { from: dateKey(monthYear.value, monthNumber.value, 1), to: dateKey(monthYear.value, monthNumber.value, finalDay) };
}
function dayRecord(day: number): PlanDay | undefined {
  return calendar.value.find((entry) => entry.date === dateKey(monthYear.value, monthNumber.value, day));
}
function cellClass(day: number | null): string {
  if (day === null) return "";
  const record = dayRecord(day);
  return record?.todo !== null && record?.done !== null && record?.todo !== undefined && record?.done !== undefined
    ? dayCellClass({ todo: record.todo, done: record.done })
    : "";
}
const activeDay = computed(() => calendar.value.find((entry) => entry.date === selectedDate.value) ?? null);
const selectedTasks = computed(() => {
  if (!plan.value) return [];
  return plan.value.tasks.filter((task) => task.date === selectedDate.value || (!task.date && selectedDate.value === todayKey));
});
const selectedDayLabel = computed(() => {
  const [year, month, day] = selectedDate.value.split("-").map(Number);
  return `${year} 年 ${month} 月 ${day} 日`;
});
const canCreate = computed(() => Boolean(goal.value.trim()) && dailyMinutes.value !== null && Number.isInteger(dailyMinutes.value) && dailyMinutes.value > 0);
const actionableSuggestions = computed(() => suggestions.value.filter((item) => !["dismissed", "applied"].includes(item.status)));
const kindTitle: Record<string, string> = {
  REDUCE: "建议减少时长或改期",
  RETEST: "建议复测或补先修",
  ACCELERATE: "建议加速",
  EVIDENCE_INSUFFICIENT: "当前证据不足",
  CALIBRATION: "校准推荐起点",
  NONE: "暂无调整建议",
};
function suggestionTitle(item: PlanSuggestion): string {
  return kindTitle[item.kind] ?? "计划调整建议";
}
function suggestionReady(item: PlanSuggestion): boolean {
  return plan.value?.revision !== null && plan.value?.revision !== undefined &&
    item.basePlanRevision === plan.value.revision &&
    !["NONE", "EVIDENCE_INSUFFICIENT"].includes(item.kind);
}
function stateLabel(state: PlanTask["state"]): string {
  return {
    todo: "待办", completed: "已完成", skipped: "已跳过", absent: "缺席", rescheduled: "已改期", unknown: "状态待确认",
  }[state];
}
function taskNote(task: PlanTask): string {
  if (task.state === "todo" && task.kind === "objective") return "完成由关联学习事件确认";
  if (task.state === "todo" && (task.kind === "reading" || task.kind === "personal")) return "自报完成接口尚未明确，当前只展示服务端状态";
  return task.reason;
}
function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : "请求暂未完成，请稍后重试";
}

async function loadCalendar(): Promise<void> {
  if (!plan.value) return;
  const serial = ++calendarSerial;
  const bounds = monthBounds();
  calendarLoading.value = true;
  calendarError.value = "";
  calendar.value = [];
  try {
    const next = await readPlanCalendar(bounds.from, bounds.to);
    if (serial === calendarSerial) calendar.value = next;
  } catch (cause) {
    if (serial === calendarSerial) calendarError.value = message(cause);
  } finally {
    if (serial === calendarSerial) calendarLoading.value = false;
  }
}
async function loadSuggestions(id: string): Promise<void> {
  const serial = ++suggestionSerial;
  suggestionLoading.value = true;
  suggestionError.value = "";
  suggestions.value = [];
  try {
    const next = await readPlanSuggestions(id);
    if (serial === suggestionSerial) suggestions.value = next;
  } catch (cause) {
    if (serial === suggestionSerial) suggestionError.value = message(cause);
  } finally {
    if (serial === suggestionSerial) suggestionLoading.value = false;
  }
}
async function reload(): Promise<void> {
  const serial = ++planSerial;
  loading.value = true;
  error.value = "";
  action.value = null;
  try {
    const next = await readCurrentPlan();
    if (serial !== planSerial) return;
    plan.value = next;
    if (next) await Promise.all([loadCalendar(), loadSuggestions(next.id)]);
    else {
      ++calendarSerial;
      ++suggestionSerial;
      calendar.value = [];
      suggestions.value = [];
      calendarError.value = "";
      suggestionError.value = "";
      calendarLoading.value = false;
      suggestionLoading.value = false;
    }
  } catch (cause) {
    if (serial === planSerial) {
      ++calendarSerial;
      ++suggestionSerial;
      plan.value = null;
      calendar.value = [];
      suggestions.value = [];
      error.value = message(cause);
    }
  } finally {
    if (serial === planSerial) loading.value = false;
  }
}
onMounted(() => { void reload(); });

function changeMonth(delta: number): void {
  const next = new Date(monthYear.value, monthNumber.value - 1 + delta, 1);
  monthYear.value = next.getFullYear();
  monthNumber.value = next.getMonth() + 1;
  selectedDate.value = dateKey(monthYear.value, monthNumber.value, 1);
  void loadCalendar();
}
function chooseDay(day: number): void {
  selectedDate.value = dateKey(monthYear.value, monthNumber.value, day);
}
async function create(): Promise<void> {
  if (!canCreate.value || dailyMinutes.value === null || busy.value) return;
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    await createRulePlan(goal.value, dailyMinutes.value);
    await reload();
    notice.value = plan.value ? "已读取服务端当前计划。" : "创建请求已返回，当前计划尚未出现，请稍后刷新确认。";
  } catch (cause) {
    error.value = message(cause);
  } finally {
    busy.value = false;
  }
}
function reviewSuggestion(item: PlanSuggestion, kind: "apply" | "dismiss"): void {
  if (plan.value?.revision === null || plan.value?.revision === undefined) {
    notice.value = "缺少服务端计划版本，请刷新后再操作。";
    return;
  }
  if (kind === "apply" && !suggestionReady(item)) {
    notice.value = "建议版本已与当前计划不同，请刷新并核对新差异。";
    void reload();
    return;
  }
  action.value = { kind, suggestion: item, revision: plan.value.revision };
  notice.value = "";
  priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  void nextTick(() => confirmPanel.value?.focus());
}
function reviewUndo(): void {
  if (!plan.value?.undoAvailable || plan.value.revision === null) return;
  action.value = { kind: "undo", revision: plan.value.revision };
  priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  void nextTick(() => confirmPanel.value?.focus());
}
function cancelAction(): void {
  action.value = null;
  void nextTick(() => priorFocus?.focus());
}
async function confirmAction(): Promise<void> {
  const current = action.value;
  const currentPlan = plan.value;
  if (!current || !currentPlan || busy.value) return;
  if (currentPlan.revision !== current.revision || (current.kind === "undo" && !currentPlan.undoAvailable)) {
    cancelAction();
    notice.value = "服务端计划状态已改变，请刷新后重新核对。";
    return;
  }
  busy.value = true;
  notice.value = "";
  conflict.value = null;
  try {
    if (current.kind === "undo") await undoPlan(currentPlan.id, current.revision);
    else await actOnSuggestion(currentPlan.id, current.suggestion.id, current.kind, current.revision);
    const beforeRevision = currentPlan.revision;
    await reload();
    if (error.value || !plan.value) {
      notice.value = "请求已返回，但最新计划尚未读取成功，请刷新确认。";
    } else if (current.kind === "dismiss" && !actionableSuggestions.value.some((item) => item.id === current.suggestion.id)) {
      notice.value = "已从服务端读取更新后的建议列表。";
    } else if (plan.value.revision !== beforeRevision && plan.value.revision !== null) {
      notice.value = `已读取服务端更新后的计划 v${plan.value.revision}。`;
    } else {
      notice.value = "请求已返回；当前计划未显示新版本，请稍后重新读取确认。";
    }
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 3011) {
      const previous = current.kind === "undo" ? null : current.suggestion;
      await reload();
      if (!error.value && plan.value) {
        if (previous) conflict.value = { previous, current: suggestions.value.find((item) => item.id === previous.id) ?? null };
        notice.value = "3011：计划版本已改变。已重新读取当前计划与建议，请核对差异后再次确认。";
      } else notice.value = "3011：计划版本已改变，但重新读取失败。请稍后刷新后再操作。";
    } else error.value = message(cause);
  } finally {
    busy.value = false;
    action.value = null;
  }
}
</script>

<template>
  <div class="plans-page">
    <div class="topline">
      <div>
        <div class="eyebrow">LEARNING PLAN · 学习计划</div>
        <h1>让每天的一步，都有清楚的来处。</h1>
        <p>任务、进度和调整建议来自服务端。建议须经你确认后才会提交。</p>
      </div>
      <button type="button" class="button" :disabled="loading || busy" @click="reload">刷新计划</button>
    </div>
    <p v-if="notice" class="status" role="status">{{ notice }}</p>
    <p v-if="error" class="status error" role="alert">{{ error }}</p>
    <p v-if="loading" class="status" role="status">正在读取当前计划…</p>

    <section v-if="!loading && !plan && !error" class="card create-card">
      <div class="eyebrow">START WITH A GOAL</div>
      <h2>当前没有服务端计划</h2>
      <p>可以按规则生成一份计划。提交后再读取服务端确认，不会在此页模拟生成结果。</p>
      <form class="create-form" @submit.prevent="create">
        <label>学习目标 <input v-model="goal" type="text" maxlength="120" placeholder="例如：巩固一元二次方程" /></label>
        <label>每日学习分钟 <input v-model.number="dailyMinutes" type="number" min="1" step="1" /></label>
        <button type="submit" class="button primary" :disabled="!canCreate || busy">{{ busy ? "正在提交…" : "按规则生成计划" }}</button>
      </form>
    </section>

    <template v-if="!loading && plan">
      <div class="plan-heading">
        <div><span class="eyebrow">CURRENT PLAN</span><h2>{{ plan.title }}</h2></div>
        <div class="heading-side">
          <span class="pill">版本 {{ plan.revision === null ? "待确认" : "v" + plan.revision }}</span>
          <span v-if="plan.dailyMinutes !== null" class="pill neutral">每日 {{ plan.dailyMinutes }} 分钟</span>
        </div>
      </div>
      <section class="layout">
        <div class="card calendar-card">
          <div class="calendar-head">
            <button type="button" class="icon-button" aria-label="上个月" @click="changeMonth(-1)">‹</button>
            <h2>{{ monthYear }} 年 {{ monthNumber }} 月</h2>
            <button type="button" class="icon-button" aria-label="下个月" @click="changeMonth(1)">›</button>
          </div>
          <p v-if="calendarLoading" class="substatus" role="status">正在读取本月日历…</p>
          <p v-if="calendarError" class="substatus error" role="alert">日历暂不可用：{{ calendarError }}</p>
          <div class="calendar" aria-label="计划月历">
            <span v-for="weekday in ['一', '二', '三', '四', '五', '六', '日']" :key="weekday" class="weekday">{{ weekday }}</span>
            <template v-for="(week, weekIndex) in weeks" :key="weekIndex">
              <span v-for="(cell, cellIndex) in week" :key="cellIndex" class="cell-slot">
                <button v-if="cell.day !== null" type="button" class="day" :class="[cellClass(cell.day), { selected: selectedDate === dateKey(monthYear, monthNumber, cell.day) }]" :aria-label="`${monthNumber} 月 ${cell.day} 日`" :aria-pressed="selectedDate === dateKey(monthYear, monthNumber, cell.day)" @click="chooseDay(cell.day)">{{ cell.day }}</button>
              </span>
            </template>
          </div>
          <div class="legend"><span><i class="outlined" /> 有待办</span><span><i class="filled" /> 已完成</span><span class="muted">仅表示服务端返回的日期汇总</span></div>
        </div>

        <div class="right-column">
          <section class="card">
            <div class="card-head"><div><span class="eyebrow">DAILY TASKS</span><h2>{{ selectedDayLabel }}</h2></div></div>
            <p v-if="activeDay && activeDay.todo !== null && activeDay.done !== null" class="muted">已完成 {{ activeDay.done }} · 待办 {{ activeDay.todo }}</p>
            <div v-if="selectedTasks.length" class="task-list">
              <div v-for="task in selectedTasks" :key="task.id" class="task">
                <span class="task-dot" :class="task.state" aria-hidden="true" />
                <div><strong>{{ task.title }}</strong><small>{{ stateLabel(task.state) }}<template v-if="taskNote(task)"> · {{ taskNote(task) }}</template></small></div>
              </div>
            </div>
            <p v-else class="empty-copy">{{ selectedDate === todayKey ? "服务端当前没有返回今日任务明细。" : "接口仅提供今日任务明细；这一天可查看日历汇总。" }}</p>
            <p class="footnote">客观任务的完成由关联学习事件确认；此处不提供本地勾选完成。</p>
          </section>

          <section class="card suggestions">
            <div class="card-head"><div><span class="eyebrow">PLAN SUGGESTIONS</span><h2>调整建议</h2></div></div>
            <p v-if="suggestionLoading" class="substatus" role="status">正在读取建议…</p>
            <p v-if="suggestionError" class="substatus error" role="alert">建议暂不可用：{{ suggestionError }}</p>
            <p v-else-if="!suggestionLoading && !actionableSuggestions.length" class="empty-copy">当前没有待确认的服务端建议。</p>
            <article v-for="suggestion in actionableSuggestions" :key="suggestion.id" class="suggestion">
              <h3>{{ suggestionTitle(suggestion) }}</h3>
              <p v-if="suggestion.reason">{{ suggestion.reason }}</p>
              <span class="muted">基于计划 v{{ suggestion.basePlanRevision }}<template v-if="suggestion.windowKey"> · 证据窗口 {{ suggestion.windowKey }}</template></span>
              <div v-if="suggestion.diffs.length" class="diffs">
                <div v-for="(diff, index) in suggestion.diffs" :key="index" class="diff">
                  <strong>{{ diff.date || "日期未提供" }} · {{ diff.target || "计划内容" }}</strong>
                  <span>{{ diff.from || "原安排未提供" }} → {{ diff.to || "新安排未提供" }}</span>
                  <small v-if="diff.reason">{{ diff.reason }}</small>
                </div>
              </div>
              <p v-else class="empty-copy">服务端未返回可展示的调整差异，暂不可应用。</p>
              <div class="actions">
                <button type="button" class="button primary" :disabled="!suggestionReady(suggestion) || !suggestion.diffs.length || busy" @click="reviewSuggestion(suggestion, 'apply')">审阅并应用</button>
                <button type="button" class="button" :disabled="plan.revision === null || busy" @click="reviewSuggestion(suggestion, 'dismiss')">忽略本窗口</button>
              </div>
              <p v-if="!suggestionReady(suggestion)" class="muted">建议版本与当前计划不一致，刷新后核对最新差异。</p>
            </article>
          </section>

          <section class="card">
            <h2>撤销上次计划调整</h2>
            <p class="muted">{{ plan.undoAvailable ? "服务端当前允许申请撤销；提交时仍会校验版本及新增学习证据。" : "服务端尚未返回可撤销许可。" }} 已发生的学习事实不会回滚。</p>
            <button type="button" class="button" :disabled="!plan.undoAvailable || plan.revision === null || busy" @click="reviewUndo">审阅撤销</button>
          </section>
        </div>
      </section>

      <section v-if="conflict" class="card conflict-card" aria-live="polite">
        <h2>计划版本冲突后的差异</h2>
        <div class="conflict-grid">
          <div><strong>原建议 · v{{ conflict.previous.basePlanRevision }}</strong><p v-for="(diff, index) in conflict.previous.diffs" :key="index">{{ diff.date }} {{ diff.target }}：{{ diff.from }} → {{ diff.to }}</p></div>
          <div><strong>重新读取的建议</strong><template v-if="conflict.current"><p v-for="(diff, index) in conflict.current.diffs" :key="index">{{ diff.date }} {{ diff.target }}：{{ diff.from }} → {{ diff.to }}</p></template><p v-else>原建议已不在当前列表。</p></div>
        </div>
        <p class="muted">不会自动重试应用。请在最新建议卡中重新审阅并确认。</p>
      </section>
    </template>

    <section v-if="action && plan" ref="confirmPanel" class="confirm-panel" role="region" aria-label="确认计划操作" tabindex="-1" @keydown.esc="cancelAction">
      <h2>{{ action.kind === "undo" ? "确认撤销请求" : action.kind === "apply" ? "确认应用这条建议" : "确认忽略这条建议" }}</h2>
      <p>将携带计划版本 v{{ action.revision }} 提交。服务端仍会校验当前版本与操作条件。</p>
      <div v-if="action.kind !== 'undo'" class="review-diff">
        <p v-for="(diff, index) in action.suggestion.diffs" :key="index">{{ diff.date }} · {{ diff.target }}：{{ diff.from }} → {{ diff.to }}<template v-if="diff.reason">（{{ diff.reason }}）</template></p>
      </div>
      <div class="actions"><button type="button" class="button primary" :disabled="busy" @click="confirmAction">{{ busy ? "正在提交…" : "确认提交" }}</button><button type="button" class="button" :disabled="busy" @click="cancelAction">取消</button></div>
    </section>
  </div>
</template>

<style scoped>
.plans-page { max-width: 1320px; margin: auto; padding: 37px 24px 90px; color: var(--body); }
.topline, .plan-heading, .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.topline h1 { margin: 6px 0 8px; color: var(--text); font: 700 clamp(31px, 3.4vw, 45px)/1.3 var(--serif); }
.topline p, .muted, .empty-copy, .footnote { color: var(--muted); }
.eyebrow { color: var(--primary-deep); font-size: 12px; font-weight: 800; letter-spacing: .13em; }
.button, .icon-button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 8px 15px; border: 1px solid var(--line); border-radius: 10px; background: var(--paper); color: var(--text); font-weight: 700; cursor: pointer; }
.button.primary { border-color: transparent; background: var(--grad); color: #fff; }
.button:disabled { cursor: not-allowed; opacity: .48; }
.icon-button { min-width: 38px; padding: 0; font-size: 25px; }
.status, .substatus { padding: 11px 14px; margin: 18px 0; border-radius: 10px; background: var(--primary-soft); color: var(--primary-deep); }
.status.error, .substatus.error { background: var(--danger-bg); color: var(--danger); }
.substatus { margin: 10px 0; font-size: 13px; }
.card { padding: 24px; border: 1px solid var(--line); border-radius: 18px; background: var(--paper); box-shadow: var(--shadow); }
.card h2 { color: var(--text); font-size: 23px; }
.create-card { max-width: 760px; margin-top: 22px; }
.create-card h2 { margin: 8px 0; }
.create-form { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; margin-top: 24px; }
.create-form label { display: grid; gap: 6px; color: var(--text); font-size: 13px; font-weight: 700; }
.create-form label:first-child { flex: 1 1 270px; }
.create-form input { width: 100%; min-height: 42px; padding: 8px 11px; border: 1px solid var(--line); border-radius: 9px; background: var(--paper); color: var(--text); }
.create-form input[type=number] { width: 130px; }
.plan-heading { align-items: center; margin: 32px 0 18px; }
.plan-heading h2 { margin-top: 5px; color: var(--text); font: 700 29px var(--serif); }
.heading-side { display: flex; flex-wrap: wrap; gap: 8px; }
.pill { padding: 5px 11px; border-radius: 99px; background: var(--primary-soft); color: var(--primary-deep); font-size: 12px; font-weight: 750; }
.pill.neutral { background: var(--soft); color: var(--muted); }
.layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr); gap: 18px; align-items: start; }
.right-column { display: grid; gap: 18px; }
.calendar-card { position: sticky; top: 88px; }
.calendar-head { display: flex; justify-content: center; align-items: center; gap: 18px; margin-bottom: 18px; }
.calendar-head h2 { min-width: 145px; font-size: 19px; text-align: center; }
.calendar { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; }
.weekday { padding: 5px; color: var(--muted); font-size: 12px; text-align: center; }
.cell-slot { aspect-ratio: 1; min-width: 0; }
.day { display: grid; place-items: center; width: 100%; height: 100%; border: 1px solid var(--line); border-radius: 10px; background: var(--paper); color: var(--text); font-size: 14px; }
.day:hover { border-color: var(--primary); }
.day.has { border: 2px solid var(--primary); color: var(--primary-deep); font-weight: 800; }
.day.alldone { border-color: var(--good); background: var(--good-bg); color: var(--good); font-weight: 800; }
.day.selected { outline: 2px solid var(--violet); outline-offset: 2px; }
.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 15px; margin-top: 20px; color: var(--muted); font-size: 12px; }
.legend span { display: inline-flex; align-items: center; gap: 5px; }
.legend i { display: inline-block; width: 11px; height: 11px; border-radius: 3px; }
.legend i.outlined { border: 2px solid var(--primary); }.legend i.filled { background: var(--good-bg); border: 1px solid var(--good); }
.card-head { align-items: center; margin-bottom: 12px; }
.card-head h2 { margin-top: 3px; }
.task-list { margin-top: 13px; }
.task { display: flex; gap: 11px; align-items: flex-start; padding: 13px 0; border-top: 1px solid var(--line); }
.task-dot { flex: none; width: 11px; height: 11px; margin-top: 6px; border: 2px solid var(--primary); border-radius: 50%; }
.task-dot.completed { border-color: var(--good); background: var(--good); }
.task-dot.skipped, .task-dot.rescheduled, .task-dot.unknown { border-color: var(--faint); }
.task-dot.absent { border-color: var(--danger); background: var(--danger); }
.task strong { display: block; color: var(--text); font-size: 14px; }
.task small { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; }
.footnote { margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--line); font-size: 12px; }
.empty-copy { margin: 16px 0; font-size: 13px; }
.suggestion { padding: 17px 0; border-top: 1px solid var(--line); }
.suggestion h3 { color: var(--text); font-size: 17px; }
.suggestion > p { margin: 7px 0; }
.suggestion .muted { font-size: 12px; }
.diffs { display: grid; gap: 8px; margin: 13px 0; }
.diff { display: grid; gap: 3px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--soft); font-size: 13px; }
.diff strong { color: var(--text); }.diff small { color: var(--muted); }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 15px; }
.conflict-card { margin-top: 20px; border-color: var(--warning); }
.conflict-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 17px 0; }
.conflict-grid > div { padding: 14px; border-radius: 10px; background: var(--soft); }
.conflict-grid strong { color: var(--text); }.conflict-grid p { margin-top: 9px; font-size: 13px; }
.confirm-panel { position: fixed; right: 24px; bottom: 24px; z-index: 70; width: min(480px, calc(100vw - 32px)); max-height: min(80vh, 650px); overflow-y: auto; padding: 24px; border: 1px solid var(--primary); border-radius: 16px; background: var(--paper); box-shadow: 0 20px 70px rgba(0, 0, 0, .24); }
.confirm-panel h2 { color: var(--text); font-size: 22px; }.confirm-panel p { margin-top: 10px; }.review-diff { padding: 11px 13px; margin-top: 12px; border-radius: 9px; background: var(--soft); font-size: 13px; }
@media (max-width: 920px) { .layout { grid-template-columns: 1fr; } .calendar-card { position: static; } }
@media (max-width: 600px) { .plans-page { padding: 25px 16px 75px; } .topline { display: block; } .topline > .button { margin-top: 18px; } .card { padding: 17px; } .calendar { gap: 4px; } .day { font-size: 12px; border-radius: 7px; } .plan-heading { display: block; } .heading-side { margin-top: 10px; } .conflict-grid { grid-template-columns: 1fr; } .confirm-panel { right: 16px; bottom: 16px; } }
</style>
