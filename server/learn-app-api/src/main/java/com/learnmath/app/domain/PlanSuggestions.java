package com.learnmath.app.domain;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * 计划建议而非自动能力降级（20 §10 BR-10 / DR-10；纯函数）。
 *
 * - plan_task 状态五态 + reason + evidenceRef；**有客观学习对象的完成只能由服务端关联完成
 *   事件确认**（复选框仅发起校验）；阅读/个人任务可自报完成但不影响能力或竞技奖励；
 * - 连续 3 个到期日 absent → 只**建议**减少时长/改期（不降能力、不插强制先修）；
 *   skipped/rescheduled/休息日不计入该连续序列；
 * - 证据窗（7 天同知识点 ≥10 条 BR-01 有效证据）：<10 只提示证据不足；正确率 <60% →
 *   复测/补先修；≥80% 且最近 3 个有任务日完成 → 加速；
 * - 建议挂 basePlanRevision 存 diff；apply 需版本匹配，冲突 → **3011 返回新旧差异**；
 *   dismiss 后同一 windowKey 不再提醒；
 * - undo 仅在"版本未变且受影响任务无新增学习证据"时允许，否则给新建议不回滚事实；
 * - placement=pending：首次 ≥10 条证据仅生成**校准建议**，确认才更新推荐起点，不覆盖手动任务。
 */
public final class PlanSuggestions {

    public enum TaskState { TODO, COMPLETED, SKIPPED, ABSENT, RESCHEDULED }

    public enum SuggestionKind { NONE, REDUCE_LOAD_RESCHEDULE, RETEST_PREREQ, ACCELERATE, EVIDENCE_INSUFFICIENT, CALIBRATION }

    public enum TaskKind { OBJECTIVE, READING_PERSONAL }

    /** 计划任务。 */
    public record PlanTask(long id, LocalDate dueDate, TaskState state, TaskKind kind,
                           String reason, String evidenceRef) {}

    /** 任务完成回执。 */
    public record Completion(boolean accepted, TaskState finalState, boolean selfReported, String reason) {}

    /** 7 天有效证据窗（已按 BR-01 筛选后的计数）。 */
    public record EvidenceWindow(int count, int correct) {

        public Double rate() {
            return count <= 0 ? null : 100.0 * correct / count;
        }
    }

    /** 建议 diff（改哪天/哪任务/原因）。 */
    public record Diff(LocalDate date, long taskId, String from, String to, String reason) {}

    /** 建议。 */
    public record Suggestion(SuggestionKind kind, long basePlanRevision, List<Diff> diffs, String windowKey, String message) {}

    /** apply 结果：3011 冲突返回新旧差异。 */
    public record ApplyResult(boolean applied, int code, String message, List<Diff> diffs) {}

    /** undo 结果。 */
    public record UndoResult(boolean allowed, String message, Suggestion followUpOrNull) {}

    public static final int MIN_EVIDENCE = 10;
    public static final double LOW_RATE = 60d;
    public static final double HIGH_RATE = 80d;
    public static final int ABSENT_STREAK = 3;

    private PlanSuggestions() {
    }

    // ---------- 任务完成 ----------

    /** 客观任务：必须携带服务端完成事件证据（复选框发起校验 ≠ 完成）。 */
    public static Completion completeTask(PlanTask t, String serverEvidenceRef) {
        if (t.kind() == TaskKind.OBJECTIVE) {
            if (serverEvidenceRef == null || serverEvidenceRef.isBlank()) {
                return new Completion(false, t.state(), false, "客观任务需服务端完成事件确认（无证据拒绝）");
            }
            return new Completion(true, TaskState.COMPLETED, false, "server evidence: " + serverEvidenceRef);
        }
        // 阅读/个人任务：可自报完成（不影响能力或竞技奖励）
        return new Completion(true, TaskState.COMPLETED, true, "self reported（不计能力/竞技）");
    }

    // ---------- absent 连续序列 ----------

    /**
     * 连续 3 个到期日 absent 计数：只统计有任务的到期日；
     * ABSENT 累加；COMPLETED 清零；SKIPPED/RESCHEDULED 与无任务日**不计**（不加不清）。
     */
    public static int absentStreak(List<PlanTask> dueOrdered) {
        int streak = 0;
        if (dueOrdered == null) {
            return 0;
        }
        for (PlanTask t : dueOrdered) {
            switch (t.state()) {
                case ABSENT -> streak++;
                case COMPLETED -> streak = 0;
                case SKIPPED, RESCHEDULED -> { /* 不计 */ }
                case TODO -> { /* 到期前不计 */ }
            }
        }
        return streak;
    }

    // ---------- 建议触发 ----------

    /**
     * @param absentStreak           {@link #absentStreak} 结果
     * @param window                 7 天证据窗
     * @param threeTaskDaysCompleted 最近 3 个有任务日是否全部完成（加速条件）
     * @param baseRevision           当前计划版本
     */
    public static Suggestion suggest(int absentStreak, EvidenceWindow window,
                                     boolean threeTaskDaysCompleted, long baseRevision, String windowKey) {
        if (absentStreak >= ABSENT_STREAK) {
            return new Suggestion(SuggestionKind.REDUCE_LOAD_RESCHEDULE, baseRevision,
                    List.of(new Diff(null, -1, "当前节奏", "建议减少时长或改期",
                            "连续 " + ABSENT_STREAK + " 个到期日缺席（只建议，不降能力/不插先修）")),
                    windowKey, "连续缺席：" + suggestReduceMessage(absentStreak));
        }
        if (window == null || window.count() < MIN_EVIDENCE) {
            return new Suggestion(SuggestionKind.EVIDENCE_INSUFFICIENT, baseRevision, List.of(),
                    windowKey, "证据不足（" + (window == null ? 0 : window.count()) + "/" + MIN_EVIDENCE
                            + " 条有效证据），暂不给建议");
        }
        Double rate = window.rate();
        if (rate != null && rate < LOW_RATE) {
            return new Suggestion(SuggestionKind.RETEST_PREREQ, baseRevision,
                    List.of(new Diff(null, -1, "按原计划推进", "插入复测/补先修",
                            "7 天正确率 " + String.format("%.0f%%", rate) + " < 60%")),
                    windowKey, "正确率偏低 → 建议复测/补先修（只建议，不自动插入）");
        }
        if (rate != null && rate >= HIGH_RATE && threeTaskDaysCompleted) {
            return new Suggestion(SuggestionKind.ACCELERATE, baseRevision,
                    List.of(new Diff(null, -1, "当前节奏", "建议加速",
                            "7 天正确率 " + String.format("%.0f%%", rate) + " ≥80% 且最近 3 个任务日完成")),
                    windowKey, "状态很好 → 建议加速（只建议）");
        }
        return new Suggestion(SuggestionKind.NONE, baseRevision, List.of(), windowKey, "无建议");
    }

    private static String suggestReduceMessage(int streak) {
        return "连续 " + streak + " 个到期日缺席，建议减少每日时长或改期（不降能力、不插强制先修）";
    }

    // ---------- apply / dismiss / undo ----------

    /** 应用建议：版本必须匹配（冲突 → 3011 + 新旧差异）；dismiss 过的窗口不再提醒。 */
    public static ApplyResult apply(Suggestion s, long currentRevision, Set<String> dismissedWindows) {
        if (dismissedWindows != null && s.windowKey() != null && dismissedWindows.contains(s.windowKey())) {
            return new ApplyResult(false, 0, "该建议窗口已忽略，不再提醒", List.of());
        }
        if (s.basePlanRevision() != currentRevision) {
            List<Diff> conflictDiffs = new ArrayList<>(s.diffs());
            conflictDiffs.add(new Diff(null, -1, "版本 " + s.basePlanRevision(),
                    "版本 " + currentRevision, "计划已被修改，请查看差异后确认"));
            return new ApplyResult(false, 3011, "计划已被修改，请查看差异后确认", List.copyOf(conflictDiffs));
        }
        if (s.kind() == SuggestionKind.EVIDENCE_INSUFFICIENT || s.kind() == SuggestionKind.NONE) {
            return new ApplyResult(false, 0, "无可应用的建议", List.of());
        }
        return new ApplyResult(true, 0, "applied → 新版本 = base+1", s.diffs());
    }

    /** 忽略建议（记窗口键）。 */
    public static String dismiss(Suggestion s) {
        return s.windowKey();
    }

    /** undo：版本未变且受影响任务无新增学习证据 → 允许；否则给新建议不回滚学习事实。 */
    public static UndoResult undo(long revisionAtApply, long currentRevision,
                                  boolean newLearningEvidenceSince, Suggestion followUp) {
        if (revisionAtApply == currentRevision && !newLearningEvidenceSince) {
            return new UndoResult(true, "undo 成功（计划回滚，学习事实不受影响）", null);
        }
        if (newLearningEvidenceSince) {
            return new UndoResult(false, "已有新增学习证据，不回滚已发生事实（提供新建议）",
                    followUp == null ? new Suggestion(SuggestionKind.NONE, currentRevision,
                            List.of(), "undo-fallback", "请基于新证据重新调整") : followUp);
        }
        return new UndoResult(false, "计划版本已变化，不回滚（提供新建议）",
                followUp == null ? new Suggestion(SuggestionKind.NONE, currentRevision,
                        List.of(), "undo-fallback", "计划已更新，请查看最新建议") : followUp);
    }

    // ---------- 校准（placement=pending） ----------

    /**
     * 首次有效证据达标 → 仅生成校准建议；确认动作由用户完成（不自动覆盖手动任务）。
     */
    public static Suggestion calibrationSuggestion(boolean placementPending, int eligibleEvidenceCount,
                                                   long baseRevision, String windowKey) {
        if (placementPending && eligibleEvidenceCount >= MIN_EVIDENCE) {
            return new Suggestion(SuggestionKind.CALIBRATION, baseRevision,
                    List.of(new Diff(null, -1, "推荐起点 L?", "校准推荐起点（待确认）",
                            "placement=pending 且已有 " + eligibleEvidenceCount + " 条有效证据")),
                    windowKey, "证据已够，确认后更新推荐起点（不自动覆盖手动任务）");
        }
        return new Suggestion(SuggestionKind.NONE, baseRevision, List.of(), windowKey,
                placementPending ? "证据不足，暂不校准" : "已有定级，无需校准");
    }
}
