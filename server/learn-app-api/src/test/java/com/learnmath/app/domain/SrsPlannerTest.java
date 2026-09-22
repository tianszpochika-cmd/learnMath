package com.learnmath.app.domain;

import com.learnmath.app.domain.SrsPlanner.Outcome;
import com.learnmath.app.domain.SrsPlanner.Plan;
import com.learnmath.app.domain.SrsPlanner.State;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * SRS —— 10 §5.5 间隔重复 + 20 §1.3 复习规则（B-04 DoD）。
 */
class SrsPlannerTest {

    private final SrsPlanner planner = new SrsPlanner();
    private final LocalDate due = LocalDate.of(2026, 9, 10);

    @Test
    void correct_ladder_1_3_7() {
        // 档0→1d，档1→3d，档2→7d，之后 ×EF
        State s = State.initial();
        assertEquals(1, SrsPlanner.intervalFor(0, s.easeFactor()));
        assertEquals(3, SrsPlanner.intervalFor(1, s.easeFactor()));
        assertEquals(7, SrsPlanner.intervalFor(2, s.easeFactor()));
        double ef23 = 2.3;
        assertEquals(Math.round(7 * Math.pow(ef23, 1)), SrsPlanner.intervalFor(3, ef23));
    }

    @Test
    void correct_onDue_dayAfter_lastCorrectDifferentDay_countsAndSchedules() {
        State s = State.initial();
        Plan p = planner.plan(s, Outcome.CORRECT, due, due.plusDays(1), false, due.minusDays(3));
        assertTrue(p.counted());
        assertEquals(1, p.intervalDays());
        assertEquals(due.plusDays(2), p.nextDue());
        assertEquals(1, p.state().consecutiveCorrectDays());
        assertTrue(p.state().easeFactor() > s.easeFactor(), "EF +0.1");
    }

    @Test
    void wrong_resetsInterval_efDrop_consecutiveZero() {
        State s = new SrsPlanner.State(2.5, 3, 2);
        Plan p = planner.plan(s, Outcome.WRONG, due, due.plusDays(1), false, due.minusDays(1));
        assertTrue(p.counted());
        assertEquals(1, p.intervalDays());
        assertEquals(0, p.state().intervalIndex());
        assertEquals(0, p.state().consecutiveCorrectDays());
        assertEquals(2.3, p.state().easeFactor(), 1e-9);
    }

    @Test
    void efFloor_at_1_3() {
        State s = new SrsPlanner.State(1.35, 0, 0);
        Plan p = planner.plan(s, Outcome.WRONG, due, due.plusDays(1), false, null);
        assertEquals(1.3, p.state().easeFactor(), 1e-9);
    }

    @Test
    void assisted_neverAdvances() {
        // 20 §1.3：使用帮助的重练不推进 SRS/连对
        State s = State.initial();
        Plan p = planner.plan(s, Outcome.CORRECT, due, due.plusDays(1), true, null);
        assertFalse(p.counted());
        assertEquals(s, p.state());
    }

    @Test
    void earlyPractice_beforeDue_doesNotAdvance() {
        State s = State.initial();
        Plan p = planner.plan(s, Outcome.CORRECT, due, due.minusDays(1), false, null);
        assertFalse(p.counted(), "未到期提前重练不推进");
        assertEquals(s, p.state());
    }

    @Test
    void sameCalendarDay_doubleCorrect_notCounted() {
        // 20：连续两次正确要求分属不同自然日
        State s = new State(2.4, 1, 1);
        Plan p = planner.plan(s, Outcome.CORRECT, due, due.plusDays(1), false, due.plusDays(1));
        assertFalse(p.counted(), "同一自然日重复正确不增连对");
        assertEquals(1, p.state().consecutiveCorrectDays());
    }

    @Test
    void consecutiveMastered_needsTwoDistinctDays() {
        State s1 = new State(2.3, 0, 1);
        assertFalse(SrsPlanner.consecutiveMastered(s1));
        State s2 = new State(2.3, 1, 2);
        assertTrue(SrsPlanner.consecutiveMastered(s2));
    }
}
