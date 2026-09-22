package com.learnmath.app.domain;

import com.learnmath.app.domain.AttemptLifecycle.Status;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 作答状态机 —— 20 §4 BR-04 + §7 BR-07（DR-04/DR-07 DoD）。 */
class AttemptLifecycleTest {

    // ---------- 状态机 ----------

    @Test
    void submit_noEssay_goesStraightFinalized() {
        AttemptLifecycle.Transition t = AttemptLifecycle.submit(Status.IN_PROGRESS, false);
        assertTrue(t.allowed());
        assertEquals(Status.FINALIZED, t.next());
    }

    @Test
    void submit_withEssay_pendingSelfAssess() {
        AttemptLifecycle.Transition t = AttemptLifecycle.submit(Status.IN_PROGRESS, true);
        assertEquals(Status.PENDING_SELF_ASSESS, t.next());
    }

    @Test
    void submit_onlyInProgress() {
        assertFalse(AttemptLifecycle.submit(Status.SUBMITTED, true).allowed());
        assertFalse(AttemptLifecycle.submit(Status.FINALIZED, false).allowed());
        assertFalse(AttemptLifecycle.submit(Status.PENDING_SELF_ASSESS, false).allowed());
    }

    @Test
    void finalize_blockedByUnrated_completedByAllChosen() {
        Map<Long, AttemptLifecycle.SelfValue> answers = new LinkedHashMap<>();
        answers.put(1L, AttemptLifecycle.SelfValue.CANNOT);
        answers.put(2L, AttemptLifecycle.SelfValue.UNRATED);
        AttemptLifecycle.Transition blocked = AttemptLifecycle.tryFinalize(
                Status.PENDING_SELF_ASSESS, answers, 2);
        assertFalse(blocked.allowed());
        assertFalse(AttemptLifecycle.allSelfAssessed(answers));

        answers.put(2L, AttemptLifecycle.SelfValue.SKIPPED); // "暂不评价"也算已选
        AttemptLifecycle.Transition done = AttemptLifecycle.tryFinalize(
                Status.PENDING_SELF_ASSESS, answers, 2);
        assertTrue(done.allowed());
        assertEquals(Status.FINALIZED, done.next());
        assertTrue(AttemptLifecycle.allSelfAssessed(answers));
    }

    @Test
    void finalize_missingAnswer_blocked() {
        Map<Long, AttemptLifecycle.SelfValue> answers = Map.of(1L, AttemptLifecycle.SelfValue.CAN);
        AttemptLifecycle.Transition t = AttemptLifecycle.tryFinalize(
                Status.PENDING_SELF_ASSESS, answers, 3);
        assertFalse(t.allowed());
        assertTrue(t.reason().contains("未作答"));
    }

    @Test
    void finalized_isTerminal_selfRevisionStillAllowed() {
        AttemptLifecycle.Transition again = AttemptLifecycle.tryFinalize(Status.FINALIZED, Map.of(1L, AttemptLifecycle.SelfValue.CAN), 1);
        assertFalse(again.allowed(), "已 finalized 不再推进");
        assertTrue(again.reason().contains("revision"), again.reason());
        assertTrue(AttemptLifecycle.selfRevisionAllowed(Status.FINALIZED), "改评允许（只更新自评证据）");
        assertFalse(AttemptLifecycle.selfRevisionAllowed(Status.IN_PROGRESS));
    }

    @Test
    void selfValueReferenceMapping() {
        assertEquals(null, AttemptLifecycle.SelfValue.UNRATED.reference());
        assertEquals(0d, AttemptLifecycle.SelfValue.CANNOT.reference());
        assertEquals(0.5d, AttemptLifecycle.SelfValue.PARTIAL.reference());
        assertEquals(1d, AttemptLifecycle.SelfValue.CAN.reference());
        assertEquals(null, AttemptLifecycle.SelfValue.SKIPPED.reference());
    }

    // ---------- 成绩拆分 ----------

    @Test
    void pureEssay_rateNull_neverZeroNorHundred() {
        AttemptLifecycle.Score s = new AttemptLifecycle.Score(0, 0);
        assertNull(s.rate(), "纯解答卷 rate=null");
        assertTrue(s.pureEssay());
        assertEquals("本卷无客观成绩", s.rateDisplay());
    }

    @Test
    void objectiveRate_computed() {
        AttemptLifecycle.Score s = new AttemptLifecycle.Score(8, 10);
        assertEquals(80.0, s.rate(), 1e-9);
        assertEquals("80.0%", s.rateDisplay());
        assertFalse(s.pureEssay());
    }

    // ---------- 结算一次 ----------

    @Test
    void objectiveSettle_happensExactlyOnce() {
        AttemptLifecycle.SettlementLedger ledger = new AttemptLifecycle.SettlementLedger();
        assertTrue(ledger.trySettleObjective(), "首次结算 → 发事件");
        assertFalse(ledger.trySettleObjective(), "重试/重复 → 不重放");
        assertFalse(ledger.trySettleObjective());
        assertTrue(ledger.settled());
    }

    // ---------- 时间（BR-07） ----------

    @Test
    void deadline_minOfDurationAndChallengeEnd() {
        Instant start = Instant.parse("2026-09-22T10:00:00Z");
        // 仅时限
        assertEquals(start.plus(Duration.ofMinutes(40)),
                AttemptLifecycle.deadlineAt(start, Duration.ofMinutes(40), null));
        // 赛事截更早 → 取赛事
        Instant challenge = start.plus(Duration.ofMinutes(25));
        assertEquals(challenge,
                AttemptLifecycle.deadlineAt(start, Duration.ofMinutes(40), challenge));
        // 无时限无赛事 → null
        assertNull(AttemptLifecycle.deadlineAt(start, null, null));
        // 只有赛事
        assertEquals(challenge, AttemptLifecycle.deadlineAt(start, null, challenge));
    }

    @Test
    void withinDeadline_strictlyLess_equalIsExpired() {
        Instant d = Instant.parse("2026-09-22T11:00:00Z");
        assertTrue(AttemptLifecycle.withinDeadline(d, d.minusSeconds(1)));
        assertFalse(AttemptLifecycle.withinDeadline(d, d), "等于截止 = 过期");
        assertFalse(AttemptLifecycle.withinDeadline(d, d.plusSeconds(1)));
        assertTrue(AttemptLifecycle.withinDeadline(null, d), "无时限恒有效");
    }

    // ---------- 草稿（BR-07） ----------

    @Test
    void draft_requestIdReplay_returnsOriginal_noOverwrite() {
        Set<String> ids = new java.util.HashSet<>(Set.of("req-1"));
        AttemptLifecycle.DraftSave replay = AttemptLifecycle.saveDraft(ids, "req-1", 3, 5, null, Instant.now());
        assertTrue(replay.accepted());
        assertTrue(replay.replayed());
        assertEquals(5, replay.currentRevision(), "不覆盖服务端 revision");
    }

    @Test
    void draft_revisionConflict_notSilentlyOverwritten() {
        AttemptLifecycle.DraftSave conflict = AttemptLifecycle.saveDraft(
                new java.util.HashSet<>(), "req-2", 2, 4, null, Instant.now());
        assertFalse(conflict.accepted());
        assertTrue(conflict.revisionConflict(), "两份答案待确认");
        assertEquals(4, conflict.currentRevision());
    }

    @Test
    void draft_afterDeadline_rejected() {
        Instant deadline = Instant.parse("2026-09-22T11:00:00Z");
        AttemptLifecycle.DraftSave late = AttemptLifecycle.saveDraft(
                new java.util.HashSet<>(), "req-3", 0, 0, deadline, Instant.parse("2026-09-22T11:00:01Z"));
        assertFalse(late.accepted());
        assertFalse(late.revisionConflict());
        assertTrue(late.reason().contains("到期"));
        // 正常接受 → revision+1
        AttemptLifecycle.DraftSave ok = AttemptLifecycle.saveDraft(
                new java.util.HashSet<>(), "req-4", 0, 0, deadline, Instant.parse("2026-09-22T10:59:00Z"));
        assertTrue(ok.accepted());
        assertEquals(1, ok.currentRevision());
    }

    // ---------- 快照优先与竞技口径 ----------

    @Test
    void snapshotGates_and_openBookExcluded() {
        assertTrue(AttemptLifecycle.snapshotGatesAccess(Status.IN_PROGRESS), "活动作答 → 一切能力检查走快照策略");
        assertFalse(AttemptLifecycle.snapshotGatesAccess(Status.FINALIZED));
        assertFalse(AttemptLifecycle.countsForCompetitive(true), "开卷不进竞技/晋级/掌握度");
        assertTrue(AttemptLifecycle.countsForCompetitive(false));
        assertNotNull(Status.SUBMITTED.name());
    }
}
