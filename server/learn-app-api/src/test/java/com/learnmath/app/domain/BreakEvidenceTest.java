package com.learnmath.app.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 断链证据 —— 20 §5 BR-05（DR-05 DoD）。 */
class BreakEvidenceTest {

    @Test
    void objectiveWrong_observed_selfReportNot() {
        assertEquals(BreakEvidence.Status.OBSERVED,
                BreakEvidence.statusFor(BreakEvidence.PredictionKind.OBJECTIVE_STEP, false, BreakEvidence.Source.PREDICTION));
        assertEquals(BreakEvidence.Status.OBSERVED,
                BreakEvidence.statusFor(BreakEvidence.PredictionKind.OBJECTIVE_WARRANT, false, BreakEvidence.Source.PREDICTION));
        // 填动机/简答一期自报，不计 observed
        assertEquals(BreakEvidence.Status.SELF_REPORTED,
                BreakEvidence.statusFor(BreakEvidence.PredictionKind.FILL_MOTIVE, false, BreakEvidence.Source.USER));
        assertEquals(BreakEvidence.Status.SELF_REPORTED,
                BreakEvidence.statusFor(BreakEvidence.PredictionKind.SHORT_ANSWER, false, BreakEvidence.Source.USER));
        // 答对 → 无断链
        assertNull(BreakEvidence.statusFor(BreakEvidence.PredictionKind.OBJECTIVE_STEP, true, BreakEvidence.Source.PREDICTION));
    }

    @Test
    void aiSuggested_profileExcluded_confirmBecomesSelfReported() {
        BreakEvidence.Evidence ai = BreakEvidence.aiSuggested("ans-1", 10L, 2, 55L, 3L,
                List.of(1L, 2L, 3L), List.of(12L, 14L));
        assertEquals(BreakEvidence.Status.SUGGESTED, ai.status());
        assertFalse(BreakEvidence.countsTowardReasoningProfile(ai), "AI 建议不进推理画像");
        assertFalse(BreakEvidence.deterministicAssertion(ai), "不作确定断言");
        assertEquals("可能卡在这里，待确认", BreakEvidence.displayLabel(ai));

        BreakEvidence.Evidence confirmed = BreakEvidence.confirm(ai);
        assertEquals(BreakEvidence.Status.SELF_REPORTED, confirmed.status());
        assertFalse(BreakEvidence.countsTowardReasoningProfile(confirmed), "确认后仍非 observed");
        assertTrue(BreakEvidence.deterministicAssertion(confirmed));
    }

    @Test
    void observedOnly_countsInProfile_and_unlocatedLabel() {
        BreakEvidence.Evidence obs = new BreakEvidence.Evidence(
                BreakEvidence.Status.OBSERVED, BreakEvidence.Source.PREDICTION, "ans-2",
                10L, 1, 56L, 4L, List.of(1L, 3L), List.of(12L));
        assertTrue(BreakEvidence.countsTowardReasoningProfile(obs));

        BreakEvidence.Evidence un = BreakEvidence.unlocated("ans-3");
        assertEquals(BreakEvidence.Status.UNLOCATED, un.status());
        assertEquals("尚未定位", BreakEvidence.displayLabel(un));
        assertFalse(BreakEvidence.deterministicAssertion(un));
        assertFalse(BreakEvidence.snapshotDisplayable(un), "无链信息不可回放");
    }

    @Test
    void evidenceDedupKey_answer_source_step() {
        BreakEvidence.Evidence a = BreakEvidence.aiSuggested("ans-1", 10L, 2, 55L, 3L, List.of(1L), List.of());
        BreakEvidence.Evidence b = BreakEvidence.aiSuggested("ans-1", 99L, 9, 55L, 9L, List.of(9L), List.of());
        assertEquals(a.key(), b.key(), "key=evidenceAnswerId|source|stepId");
        BreakEvidence.Evidence c = BreakEvidence.aiSuggested("ans-2", 10L, 2, 55L, 3L, List.of(1L), List.of());
        assertFalse(a.key().equals(c.key()));
    }

    @Test
    void snapshotSurvivesRelayout_and_noCrossVersionJump() {
        BreakEvidence.Evidence e = BreakEvidence.aiSuggested("ans-1", 10L, 2, 55L, 3L,
                List.of(1L, 2L, 3L), List.of(12L));
        assertTrue(BreakEvidence.snapshotDisplayable(e), "快照可回放原解法");
        // 链重排 → 当前版本 3：禁止按同 seq 跳新版本，只能用快照
        assertTrue(BreakEvidence.crossVersionStepRelocation(e, 3));
        assertFalse(BreakEvidence.crossVersionStepRelocation(e, 2), "同版本可直接定位");
    }

    @Test
    void aiDownFallback_notBlockedByAi() {
        String fb = BreakEvidence.aiUnavailableFallback();
        assertTrue(fb.contains("尚未定位"));
        assertTrue(fb.contains("自报"));
        assertTrue(fb.contains("无需等待"), "流程不依赖 AI 即可提交");
    }

    @Test
    void remediation_honestCounts() {
        // ≥2 → "开始 2 题"
        BreakEvidence.RemedialPlan two = BreakEvidence.remediation(5, true);
        assertEquals(2, two.count());
        assertTrue(two.startButton());
        assertEquals("开始 2 题", two.message());
        // 1 → 如实 "开始 1 题"（禁止空列表报 2）
        BreakEvidence.RemedialPlan one = BreakEvidence.remediation(1, true);
        assertEquals(1, one.count());
        assertFalse(one.message().contains("开始 2 题"));
        // 0 + 有内容 → 内容+稍后复习，不显示开始按钮
        BreakEvidence.RemedialPlan zero = BreakEvidence.remediation(0, true);
        assertEquals(0, zero.count());
        assertFalse(zero.startButton());
        assertTrue(zero.message().contains("概念/公式"));
        // 0 + 无内容
        BreakEvidence.RemedialPlan none = BreakEvidence.remediation(0, false);
        assertFalse(none.startButton());
        assertTrue(none.message().contains("稍后复习"));
    }
}
