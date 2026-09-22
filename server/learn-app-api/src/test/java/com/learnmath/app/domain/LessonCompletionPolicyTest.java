package com.learnmath.app.domain;

import com.learnmath.app.domain.LessonCompletionPolicy.Decision;
import com.learnmath.app.domain.LessonCompletionPolicy.Input;
import com.learnmath.app.domain.LessonCompletionPolicy.PolicyType;
import com.learnmath.app.domain.LessonCompletionPolicy.Reason;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 课时完成 —— 20 §2 BR-02 矩阵逐行（DR-02 DoD）。 */
class LessonCompletionPolicyTest {

    @Test
    void matrix_notRead_anything_incomplete() {
        // 行1：未确认读 → 否/不新增解锁/0
        Decision d = LessonCompletionPolicy.decide(
                new Input(false, PolicyType.PRACTICE_REQUIRED, 5, 5, 100, false));
        assertFalse(d.completed());
        assertFalse(d.unlocksNext());
        assertEquals(0, d.reward());
        assertEquals(Reason.NOT_READ_CONFIRMED, d.reason());
    }

    @Test
    void matrix_read_confirmed_practice_notAnswered_incomplete() {
        // 行2：已确认 + practice_required + 未答 → 否/0
        Decision d = LessonCompletionPolicy.decide(
                new Input(true, PolicyType.PRACTICE_REQUIRED, 5, 0, -1, false));
        assertFalse(d.completed());
        assertEquals(0, d.reward());
        assertEquals(Reason.PRACTICE_PENDING, d.reason());
        assertTrue(d.message().contains("阅读已记录"), d.message());
    }

    @Test
    void matrix_read_confirmed_practice_below80_incomplete() {
        // 行2b：答了但 79.9% → 否
        Decision d = LessonCompletionPolicy.decide(
                new Input(true, PolicyType.PRACTICE_REQUIRED, 5, 5, 79.9, false));
        assertFalse(d.completed());
        assertEquals(Reason.PRACTICE_PENDING, d.reason());
    }

    @Test
    void matrix_read_confirmed_practice_allAnswered_80_complete() {
        // 行3：客观全答且≥80 → 是/解锁/首次+10
        Decision d = LessonCompletionPolicy.decide(
                new Input(true, PolicyType.PRACTICE_REQUIRED, 5, 5, 80, false));
        assertTrue(d.completed());
        assertTrue(d.unlocksNext());
        assertEquals(10, d.reward());
        assertEquals(Reason.COMPLETED_PRACTICE, d.reason());
        // 边界 79.9 拒绝 / 80 通过
        assertFalse(LessonCompletionPolicy.ratePassed(79.9));
        assertTrue(LessonCompletionPolicy.ratePassed(80));
    }

    @Test
    void matrix_readOnly_completed_withoutPractice() {
        // 行4：read_only → 是/解锁/首次+10（不代表掌握）
        Decision d = LessonCompletionPolicy.decide(
                new Input(true, PolicyType.READ_ONLY, 0, 0, -1, false));
        assertTrue(d.completed());
        assertTrue(d.unlocksNext());
        assertEquals(10, d.reward());
        assertEquals(Reason.COMPLETED_READ_ONLY, d.reason());
        assertTrue(d.message().contains("不代表掌握"));
    }

    @Test
    void matrix_alreadyCompleted_idempotent_noDoubleReward() {
        // 行5：已完成再请求 → 原结果/不重复/0
        Decision d = LessonCompletionPolicy.decide(
                new Input(true, PolicyType.PRACTICE_REQUIRED, 5, 5, 100, true));
        assertTrue(d.completed());
        assertEquals(0, d.reward(), "幂等不重复发 +10");
        assertEquals(Reason.ALREADY_COMPLETED, d.reason());
    }

    @Test
    void publishBlocker_practiceWithoutObjective_rejected() {
        // 无客观题却设 practice_required → 拒绝发布；分母 0 不可能得 100%
        assertNotNull(LessonCompletionPolicy.publishBlocker(PolicyType.PRACTICE_REQUIRED, 0));
        assertNull(LessonCompletionPolicy.publishBlocker(PolicyType.READ_ONLY, 0));
        assertNull(LessonCompletionPolicy.publishBlocker(PolicyType.PRACTICE_REQUIRED, 3));
        // 运行态防御
        assertThrows(IllegalStateException.class, () -> LessonCompletionPolicy.decide(
                new Input(true, PolicyType.PRACTICE_REQUIRED, 0, 0, -1, false)));
    }
}
