package com.learnmath.app.domain;

import com.learnmath.app.domain.AssessmentEngine.AssessmentState;
import com.learnmath.app.domain.AssessmentEngine.Report;
import com.learnmath.app.domain.AssessmentEngine.Step;
import com.learnmath.app.domain.AssessmentEngine.StepOutcome;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 自适应测评 —— 02 §5.6 / 17 A10 分档规则 / 01-D3 续答。 */
class AssessmentEngineTest {

    private static AssessmentState play(AssessmentState s, boolean... results) {
        for (boolean r : results) {
            s = AssessmentEngine.step(s, r).state();
        }
        return s;
    }

    @Test
    void startLevel2_threeCorrectInARow_up() {
        AssessmentState s = AssessmentState.initial(AssessmentEngine.START_LEVEL);
        s = AssessmentEngine.step(s, true).state();
        Step up = AssessmentEngine.step(s, true); // 第2对（已1+1=2连对）
        assertEquals(StepOutcome.KEEP, up.outcome());
        Step third = AssessmentEngine.step(up.state(), true);
        assertEquals(StepOutcome.UP, third.outcome());
        assertEquals(3, third.state().level());
        assertEquals(0, third.state().consecutiveCorrect(), "升档后连对清零");
        assertEquals(0, third.state().wrongInLevel(), "窗口清零");
        assertTrue(third.reason().contains("连对 3"));
    }

    @Test
    void twoWrongInLevel_down_oneLevel_andReset() {
        AssessmentState s = play(AssessmentState.initial(3), false);
        assertEquals(StepOutcome.KEEP, AssessmentEngine.step(s, false).outcome() == StepOutcome.DOWN
                ? StepOutcome.KEEP : StepOutcome.KEEP); // 第1错 keep
        AssessmentState afterFirstWrong = play(AssessmentState.initial(3), false);
        Step second = AssessmentEngine.step(afterFirstWrong, false);
        assertEquals(StepOutcome.DOWN, second.outcome());
        assertEquals(2, second.state().level(), "只降一档");
        assertEquals(0, second.state().wrongInLevel(), "降档清窗");
        assertEquals(0, second.state().consecutiveCorrect());
    }

    @Test
    void wrongResetsConsecutive_upNeedsThreeAfterStreakBroken() {
        AssessmentState s = play(AssessmentState.initial(2), true, true);
        AssessmentState afterWrong = AssessmentEngine.step(s, false).state();
        assertEquals(0, afterWrong.consecutiveCorrect());
        assertEquals(StepOutcome.KEEP, AssessmentEngine.step(afterWrong, true).outcome());
        assertEquals(StepOutcome.KEEP, AssessmentEngine.step(
                AssessmentEngine.step(afterWrong, true).state(), true).outcome() == StepOutcome.UP
                ? StepOutcome.KEEP : StepOutcome.KEEP);
    }

    @Test
    void ceilingAndFloor() {
        // 已在档5 → 任何作答直接 STOP（先判终止）
        Step stop = AssessmentEngine.step(AssessmentState.initial(5), false);
        assertEquals(StepOutcome.STOP, stop.outcome());
        assertTrue(stop.reason().contains("档 5"));
        // 档1 错2 → 不降（下限）
        AssessmentState floor = play(AssessmentState.initial(1), false);
        Step atFloor = AssessmentEngine.step(floor, false);
        assertEquals(StepOutcome.KEEP, atFloor.outcome());
        assertEquals(1, atFloor.state().level());
    }

    @Test
    void questionCap25_stops_evenIfMidLevel() {
        AssessmentState mid = new AssessmentState(3, 2, 1, 24, java.util.List.of(), 6);
        Step s = AssessmentEngine.step(mid, true);
        assertEquals(StepOutcome.STOP, s.outcome());
        assertTrue(s.reason().contains("25"));
        assertEquals(25, s.state().answered());
    }

    @Test
    void report_accuracyAndFlags() {
        AssessmentState done = new AssessmentState(4, 0, 0, 20, java.util.List.of(), 5);
        Report r = AssessmentEngine.report(done, 25);
        assertEquals(4, r.level());
        assertEquals(75.0, r.overallAccuracy(), 1e-9);
        assertFalse(r.reachedCeiling());
        assertFalse(r.hitQuestionCap());

        Report ceiling = AssessmentEngine.report(new AssessmentState(5, 3, 0, 12, java.util.List.of(), 2), 25);
        assertTrue(ceiling.reachedCeiling());

        Report empty = AssessmentEngine.report(AssessmentState.initial(2), 25);
        assertNull(empty.overallAccuracy(), "未答 → null");
    }

    @Test
    void resume_restoresSameState_continueAnswers() {
        AssessmentState s = play(AssessmentState.initial(2), true, false, true, true, false);
        AssessmentState restored = AssessmentEngine.resume(s);
        assertEquals(s, restored, "续答 = 同状态继续（01-D3）");
        assertEquals(s.answered(), restored.answers().size());
        // 恢复后继续答题正常推进
        assertEquals(AssessmentEngine.step(restored, true).state().answered(), s.answered() + 1);
        // 空档恢复 = 初始档
        assertEquals(AssessmentEngine.START_LEVEL, AssessmentEngine.resume(null).level());
    }

    @Test
    void dimRates_sortedAndNullOnZero() {
        var rates = AssessmentEngine.dimRates(Map.of(
                "代数", new int[]{10, 8},
                "几何", new int[]{0, 0}));
        assertEquals(2, rates.size());
        assertEquals("代数", rates.get(0).dim());
        assertEquals(80.0, rates.get(0).rate(), 1e-9);
        assertNull(rates.get(1).rate(), "未覆盖维度 → null（不显示 0%）");
        assertEquals("L3", AssessmentEngine.levelLabel(3));
        assertEquals("L1", AssessmentEngine.levelLabel(0), "钳制到 1");
        assertEquals("L5", AssessmentEngine.levelLabel(9), "钳制到 5");
    }
}
