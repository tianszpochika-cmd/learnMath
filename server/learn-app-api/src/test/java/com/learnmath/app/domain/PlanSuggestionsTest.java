package com.learnmath.app.domain;

import com.learnmath.app.domain.PlanSuggestions.ApplyResult;
import com.learnmath.app.domain.PlanSuggestions.Completion;
import com.learnmath.app.domain.PlanSuggestions.EvidenceWindow;
import com.learnmath.app.domain.PlanSuggestions.PlanTask;
import com.learnmath.app.domain.PlanSuggestions.Suggestion;
import com.learnmath.app.domain.PlanSuggestions.SuggestionKind;
import com.learnmath.app.domain.PlanSuggestions.TaskKind;
import com.learnmath.app.domain.PlanSuggestions.TaskState;
import com.learnmath.app.domain.PlanSuggestions.UndoResult;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 计划建议 —— 20 §10 BR-10（DR-10 DoD）。 */
class PlanSuggestionsTest {

    private static final LocalDate D1 = LocalDate.of(2026, 9, 20);
    private static final LocalDate D2 = LocalDate.of(2026, 9, 21);
    private static final LocalDate D3 = LocalDate.of(2026, 9, 22);

    private static PlanTask task(long id, TaskState st) {
        return new PlanTask(id, D1, st, TaskKind.OBJECTIVE, null, null);
    }

    @Test
    void objectiveCompletion_requiresServerEvidence_readingSelfReportOk() {
        // 客观任务无证据 → 拒绝（复选框仅发起校验）
        Completion denied = PlanSuggestions.completeTask(task(1, TaskState.TODO), null);
        assertFalse(denied.accepted());
        assertTrue(denied.reason().contains("服务端"));

        Completion ok = PlanSuggestions.completeTask(task(1, TaskState.TODO), "attempt#9:e12");
        assertTrue(ok.accepted());
        assertEquals(TaskState.COMPLETED, ok.finalState());
        assertFalse(ok.selfReported());

        // 阅读/个人 → 自报允许，但打自报标（不计能力/竞技）
        PlanTask reading = new PlanTask(2, D1, TaskState.TODO, TaskKind.READING_PERSONAL, null, null);
        Completion self = PlanSuggestions.completeTask(reading, null);
        assertTrue(self.accepted());
        assertTrue(self.selfReported());
    }

    @Test
    void absentStreak_countsOnlyAbsent_completedResets_skipRescheduleIgnored() {
        // 连 3 absent → 3
        assertEquals(3, PlanSuggestions.absentStreak(List.of(
                task(1, TaskState.ABSENT), task(2, TaskState.ABSENT), task(3, TaskState.ABSENT))));
        // completed 清零
        assertEquals(1, PlanSuggestions.absentStreak(List.of(
                task(1, TaskState.ABSENT), task(2, TaskState.COMPLETED), task(3, TaskState.ABSENT))));
        // skipped/rescheduled 不计（不加也不清）
        assertEquals(2, PlanSuggestions.absentStreak(List.of(
                task(1, TaskState.ABSENT), task(2, TaskState.SKIPPED),
                task(3, TaskState.RESCHEDULED), task(4, TaskState.ABSENT))));
        // TODO 不计
        assertEquals(1, PlanSuggestions.absentStreak(List.of(
                task(1, TaskState.TODO), task(2, TaskState.ABSENT))));
    }

    @Test
    void suggest_priority_absentFirst_thenEvidenceRules() {
        // 缺席 3 → REDUCE（即便证据也好；不降能力/不插先修——diff 文案）
        Suggestion reduce = PlanSuggestions.suggest(3, new EvidenceWindow(20, 19), true, 7L, "w1");
        assertEquals(SuggestionKind.REDUCE_LOAD_RESCHEDULE, reduce.kind());
        assertTrue(reduce.diffs().get(0).reason().contains("不降能力"));

        // 证据 <10 → INSUFFICIENT（不给建议）
        Suggestion insuf = PlanSuggestions.suggest(0, new EvidenceWindow(9, 9), false, 7L, "w1");
        assertEquals(SuggestionKind.EVIDENCE_INSUFFICIENT, insuf.kind());
        assertTrue(insuf.message().contains("9/10"));

        // <60% → RETEST_PREREQ
        Suggestion retest = PlanSuggestions.suggest(0, new EvidenceWindow(20, 10), false, 7L, "w1"); // 50%
        assertEquals(SuggestionKind.RETEST_PREREQ, retest.kind());

        // ≥80% 但三任务日未全完成 → NONE
        Suggestion none = PlanSuggestions.suggest(0, new EvidenceWindow(20, 16), false, 7L, "w1");
        assertEquals(SuggestionKind.NONE, none.kind());

        // ≥80% + 三任务日全完成 → ACCELERATE
        Suggestion fast = PlanSuggestions.suggest(0, new EvidenceWindow(20, 17), true, 7L, "w1"); // 85%
        assertEquals(SuggestionKind.ACCELERATE, fast.kind());

        // 中间带（60≤r<80）→ NONE
        Suggestion mid = PlanSuggestions.suggest(0, new EvidenceWindow(20, 14), true, 7L, "w1"); // 70%
        assertEquals(SuggestionKind.NONE, mid.kind());
    }

    @Test
    void apply_versionMatchAndConflict3011_withDiffs() {
        Suggestion s = PlanSuggestions.suggest(3, new EvidenceWindow(0, 0), false, 7L, "w1");
        // 版本匹配 → applied
        ApplyResult ok = PlanSuggestions.apply(s, 7L, Set.of());
        assertTrue(ok.applied());
        // 版本冲突 → 3011 + 新旧差异
        ApplyResult conflict = PlanSuggestions.apply(s, 9L, Set.of());
        assertFalse(conflict.applied());
        assertEquals(3011, conflict.code());
        assertTrue(conflict.message().contains("差异"));
        assertTrue(conflict.diffs().stream().anyMatch(d -> "版本 7".equals(d.from())));
        // dismissed 窗口 → 不再提醒
        ApplyResult dismissed = PlanSuggestions.apply(s, 7L, Set.of("w1"));
        assertFalse(dismissed.applied());
        assertEquals(0, dismissed.code());
        assertTrue(dismissed.message().contains("已忽略"));
    }

    @Test
    void undo_onlyWhenNoNewEvidenceAndSameRevision() {
        UndoResult ok = PlanSuggestions.undo(7L, 7L, false, null);
        assertTrue(ok.allowed());

        UndoResult newEvidence = PlanSuggestions.undo(7L, 7L, true, null);
        assertFalse(newEvidence.allowed());
        assertTrue(newEvidence.message().contains("不回滚已发生事实"));
        assertFalse(newEvidence.followUpOrNull() == null, "给新建议");

        UndoResult newRevision = PlanSuggestions.undo(7L, 8L, false, null);
        assertFalse(newRevision.allowed());
        assertTrue(newRevision.message().contains("版本已变化"));
    }

    @Test
    void calibration_pendingOnly_neverAutoOverwrite() {
        Suggestion cal = PlanSuggestions.calibrationSuggestion(true, 10, 5L, "cal-1");
        assertEquals(SuggestionKind.CALIBRATION, cal.kind());
        assertTrue(cal.message().contains("确认"));
        assertTrue(cal.message().contains("不自动覆盖"));

        assertEquals(SuggestionKind.NONE, PlanSuggestions.calibrationSuggestion(true, 9, 5L, "cal-1").kind());
        assertEquals(SuggestionKind.NONE, PlanSuggestions.calibrationSuggestion(false, 30, 5L, "cal-1").kind(),
                "已有定级不校准");
    }
}
