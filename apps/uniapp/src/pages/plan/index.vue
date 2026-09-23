<script setup lang="ts">
import { computed, ref } from "vue";
import { onPullDownRefresh, onShow } from "@dcloudio/uni-app";
import { isApiError } from "@learnmath/shared";
import MNavBar from "../../components/MNavBar.vue";
import MSheet from "../../components/MSheet.vue";
import { planApi, type Plan, type PlanDay, type PlanSuggestion } from "../../services/pathPlan";

const plan = ref<Plan | null>(null), days = ref<PlanDay[]>([]), suggestions = ref<PlanSuggestion[]>([]);
const anchor = ref(new Date()), viewMode = ref<"month"|"week">("month");
const loading = ref(false), busy = ref(false), error = ref(""), notice = ref(""), conflict = ref(false), selected = ref<PlanSuggestion | null>(null);
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const selectedDate = ref(dateKey(new Date()));
const staleSuggestion = ref<PlanSuggestion | null>(null);
const daysInView = computed(() => {
  if (viewMode.value === "week") { const date = new Date(`${selectedDate.value}T12:00:00`); date.setDate(date.getDate() - ((date.getDay()+6)%7)); return Array.from({ length: 7 }, (_, n) => { const d = new Date(date); d.setDate(date.getDate()+n); return dateKey(d); }); }
  const first = new Date(anchor.value.getFullYear(), anchor.value.getMonth(), 1, 12);
  const offset = (first.getDay()+6)%7; first.setDate(first.getDate()-offset);
  return Array.from({ length: 42 }, (_, n) => { const d = new Date(first); d.setDate(first.getDate()+n); return dateKey(d); });
});
const visibleTasks = computed(() => (plan.value?.tasks ?? []).filter(task => !task.date || task.date === selectedDate.value));
const currentDays = computed(() => new Map(days.value.map(day => [day.date, day])));
async function load() {
  loading.value = true; error.value = "";
  try {
    const current = await planApi.current(); plan.value = current;
    const dates = daysInView.value;
    const [calendar, incoming] = await Promise.all([planApi.calendar(dates[0], dates[dates.length-1]), current ? planApi.suggestions(current.id) : Promise.resolve([])]);
    days.value = calendar; suggestions.value = incoming; conflict.value = false;
  } catch (e) { error.value = e instanceof Error ? e.message : "计划暂不可用"; }
  finally { loading.value = false; }
}
async function changePeriod(step: number) { const next = new Date(anchor.value); if (viewMode.value === "month") next.setMonth(next.getMonth()+step); else next.setDate(next.getDate()+step*7); anchor.value = next; selectedDate.value = dateKey(next); await load(); }
async function changeMode(mode: "month"|"week") { viewMode.value = mode; await load(); }
function statusLabel(status: string) { return ({ todo: "待完成", completed: "已完成", skipped: "已跳过", absent: "缺席", rescheduled: "已改期", unknown: "待确认" })[status as "todo"] || "待确认"; }
async function act(action: "apply"|"dismiss") {
  const suggestion = selected.value, current = plan.value;
  if (!suggestion || !current || busy.value || current.revision === null || suggestion.basePlanRevision !== current.revision || ["applied","dismissed"].includes(suggestion.status.toLowerCase()) || (action === "apply" && !suggestion.diffs.length)) return;
  busy.value = true; error.value = ""; notice.value = "";
  try {
    if (action === "apply") await planApi.apply(current.id, suggestion.id, current.revision);
    else await planApi.dismiss(current.id, suggestion.id);
    const updated = await planApi.current(); const updatedSuggestions = updated ? await planApi.suggestions(updated.id) : [];
    if (!updated || (action === "apply" && updated.revision === current.revision) || updatedSuggestions.some(item => item.id === suggestion.id && !["applied","dismissed"].includes(item.status.toLowerCase()))) throw new Error("请求已发送，但回读尚未确认变更；请刷新后核对。不要重复提交。");
    plan.value = updated; suggestions.value = updatedSuggestions; selected.value = null; notice.value = action === "apply" ? "计划调整已由服务端确认。" : "本轮建议已由服务端确认忽略。";
  } catch (e) {
    if (isApiError(e) && e.code === 3011) { staleSuggestion.value = suggestion; selected.value = null; await load(); conflict.value = true; error.value = "计划版本已变化。请比较原建议与刷新后的计划，再决定是否应用。"; }
    else error.value = e instanceof Error ? e.message : "操作未确认";
  } finally { busy.value = false; }
}
async function undo() {
  const current = plan.value;
  if (!current || !current.undoAvailable || current.revision === null || busy.value) return;
  uni.showModal({ title: "撤销最近一次调整", content: "仅在没有新的相关学习事实且计划版本未变化时可以撤销。", success: async result => {
    if (!result.confirm) return; busy.value = true; error.value = "";
    try { await planApi.undo(current.id, current.revision); const updated = await planApi.current(); if (!updated || updated.revision === current.revision) throw new Error("撤销请求已发送，但服务端回读未确认。请刷新核对。"); plan.value = updated; suggestions.value = await planApi.suggestions(updated.id); notice.value = "撤销已由服务端确认。"; }
    catch (e) { error.value = isApiError(e) && e.code === 3011 ? "计划版本变化或已有新学习事实，无法撤销。请刷新计划。" : e instanceof Error ? e.message : "撤销未确认"; }
    finally { busy.value = false; }
  } });
}
onShow(() => { void load(); }); onPullDownRefresh(() => { void load().finally(() => uni.stopPullDownRefresh()); });
</script>
<template><view class="mobile-page plan"><MNavBar title="学习计划" back /><scroll-view scroll-y class="scroll"><view class="page-scroll"><view class="hero"><text class="eyebrow">YOUR LEARNING PLAN</text><text class="hero-title">每天一小步</text><text class="hero-copy">任务状态以学习事实和服务端计划为准。缺席不会被当成学习失败。</text><view v-if="plan" class="hero-row"><text>{{ plan.title }}</text><text>{{ plan.dailyMinutes === null ? '每日目标待确认' : `${plan.dailyMinutes} 分钟 / 天` }}</text></view></view>
  <view v-if="loading" class="m-state">正在读取计划…</view><view v-if="error" class="m-state error">{{ error }}<button class="retry" @click="load">重试</button></view><view v-if="notice" class="m-state success">{{ notice }}</view><view v-if="conflict" class="m-card conflict-card"><text class="m-card-title">版本变化，请先比较</text><text class="muted">当前计划版本 {{ plan?.revision ?? '待确认' }}；旧建议版本 {{ staleSuggestion?.basePlanRevision ?? '待确认' }}。旧差异不会自动应用。</text><view v-for="(diff,index) in staleSuggestion?.diffs || []" :key="index" class="diff"><text class="diff-target">原建议 · {{ diff.date }} {{ diff.target }}</text><text class="diff-from">{{ diff.from || '原内容未提供' }} → {{ diff.to || '新内容未提供' }}</text></view><text class="muted">刷新后的建议在下方。请结合当前任务逐项核对，再选择新版本的建议。</text></view><view v-if="!loading && !plan && !error" class="m-state">尚无当前计划。完成测评后可生成规则计划。</view>
  <template v-if="plan"><view class="calendar m-card"><view class="calendar-head"><button @click="changePeriod(-1)">‹</button><text>{{ anchor.getFullYear() }} 年 {{ anchor.getMonth()+1 }} 月</text><button @click="changePeriod(1)">›</button></view><view class="view-switch"><button :class="{active:viewMode==='week'}" @click="changeMode('week')">周</button><button :class="{active:viewMode==='month'}" @click="changeMode('month')">月</button></view><view class="weekday"><text v-for="name in ['一','二','三','四','五','六','日']" :key="name">{{ name }}</text></view><view class="day-grid"><button v-for="date in daysInView" :key="date" class="day" :class="{ selected:date===selectedDate, outside:date.slice(0,7)!==dateKey(anchor).slice(0,7), done:(currentDays.get(date)?.done ?? 0)>0 }" @click="selectedDate=date"><text>{{ Number(date.slice(-2)) }}</text><view v-if="(currentDays.get(date)?.todo ?? 0)>0 || (currentDays.get(date)?.done ?? 0)>0" class="dot" /></button></view></view>
    <view class="section-title"><text>{{ selectedDate }} 的任务</text><text>{{ visibleTasks.length }} 项</text></view><view v-if="!visibleTasks.length" class="m-state">服务端没有返回这一天的任务。</view><view v-for="task in visibleTasks" :key="task.id" class="m-list-row"><view class="task-icon" :class="task.status">{{ task.status==='completed'?'✓':task.status==='absent'?'—':'·' }}</view><view class="body"><text class="title">{{ task.title }}</text><text class="meta">{{ statusLabel(task.status) }}{{ task.reason ? ` · ${task.reason}` : '' }}</text></view></view><text class="task-note">客观学习任务须由关联学习事实确认；这里的任务卡不提供本地勾选完成。</text>
    <view class="section-title"><text>调整建议</text><text>{{ suggestions.length }} 条</text></view><view v-if="!suggestions.length" class="m-state">当前没有待处理的调整建议。</view><view v-for="suggestion in suggestions" :key="suggestion.id" class="m-card suggestion" @click="selected=suggestion"><view class="suggestion-top"><text class="m-chip">{{ suggestion.kind || '计划建议' }}</text><text class="revision">基于版本 {{ suggestion.basePlanRevision }}</text></view><text class="m-card-title">{{ suggestion.reason || '查看调整差异' }}</text><text class="muted">{{ suggestion.diffs.length }} 项差异 · 点开核对</text></view><button v-if="plan.undoAvailable" class="m-button secondary undo" :disabled="busy || plan.revision===null" @click="undo">撤销上次调整</button></template>
  </view></scroll-view><MSheet :model-value="!!selected" title="确认调整差异" height="expanded" @update:model-value="selected=null"><view v-if="selected" class="sheet-content"><text class="muted">{{ selected.reason || '服务端建议' }}</text><text class="muted">证据窗口：{{ selected.windowKey || '未返回' }} · 建议版本 {{ selected.basePlanRevision }} / 当前版本 {{ plan?.revision ?? '待确认' }}</text><view v-if="!selected.diffs.length" class="m-state warning">服务端未提供可核对的差异，不能应用此建议。</view><view v-for="(diff,index) in selected.diffs" :key="index" class="diff"><text class="diff-target">{{ diff.date }} {{ diff.target }}</text><text class="diff-from">原：{{ diff.from || '未提供' }}</text><text class="diff-to">新：{{ diff.to || '未提供' }}</text><text v-if="diff.reason" class="muted">{{ diff.reason }}</text></view></view><template #footer><view class="sheet-actions"><button class="m-button secondary" :disabled="busy || plan?.revision!==selected?.basePlanRevision" @click="act('dismiss')">忽略本轮</button><button class="m-button" :disabled="busy || !selected?.diffs.length || plan?.revision!==selected?.basePlanRevision" @click="act('apply')">确认应用</button></view></template></MSheet></view></template>
<style scoped>.plan{display:flex;flex-direction:column;height:100vh}.scroll{flex:1;min-height:0}.hero{padding:34rpx;border-radius:31rpx;background:linear-gradient(145deg,#17365c,#377fa2);color:#fff}.hero .eyebrow{color:#a9e3ef}.hero-title{display:block;font-size:40rpx;font-weight:850}.hero-copy{display:block;margin-top:10rpx;color:#d9f1f6;font-size:23rpx;line-height:1.6}.hero-row{display:flex;justify-content:space-between;gap:16rpx;margin-top:25rpx;font-size:22rpx;font-weight:750}.calendar{margin-top:24rpx}.calendar-head{display:flex;align-items:center;justify-content:space-between;font-size:29rpx;font-weight:800}.calendar-head button{width:57rpx;height:57rpx;padding:0;background:#edf3ff;color:#2856bd;font-size:37rpx}.view-switch{display:flex;justify-content:flex-end;gap:7rpx;margin:20rpx 0}.view-switch button{padding:7rpx 24rpx;border-radius:13rpx;background:#edf1f7;color:#687995;font-size:21rpx}.view-switch button.active{background:#dceaf7;color:#1c5a95;font-weight:800}.weekday,.day-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3rpx}.weekday text{text-align:center;color:#8492a6;font-size:19rpx}.day{display:flex;flex-direction:column;align-items:center;justify-content:center;height:68rpx;padding:0;border-radius:15rpx;background:transparent;color:#30435a;font-size:22rpx}.day.outside{opacity:.4}.day.selected{background:#315eac;color:white}.day.done:not(.selected){color:#168257}.dot{width:6rpx;height:6rpx;border-radius:50%;background:#5d8ce1}.day.selected .dot{background:#fff}.task-icon{display:flex;align-items:center;justify-content:center;width:54rpx;height:54rpx;border-radius:17rpx;background:#e9effa;color:#4262a0;font-size:27rpx}.task-icon.completed{background:#e0f6e9;color:#168359}.task-icon.absent{background:#fff0de;color:#a16a29}.task-note{display:block;margin:5rpx 0 30rpx;color:#73839b;font-size:21rpx;line-height:1.55}.suggestion-top{display:flex;justify-content:space-between;margin-bottom:15rpx}.revision{color:#7b8aa0;font-size:21rpx}.suggestion .muted{display:block;margin-top:12rpx}.undo{margin-top:20rpx}.sheet-content{display:flex;flex-direction:column;gap:15rpx}.diff{display:flex;flex-direction:column;gap:7rpx;padding:18rpx;border:1rpx solid #dce5f3;border-radius:18rpx;background:#f8fbff;font-size:22rpx}.diff-target{font-weight:800}.diff-from{color:#7b5d62}.diff-to{color:#246b51}.sheet-actions{display:flex;gap:10rpx}.sheet-actions button{flex:1;font-size:23rpx}.retry{display:block;margin-top:12rpx;background:transparent;color:#9e2d44;text-align:left;font-size:23rpx}</style>
