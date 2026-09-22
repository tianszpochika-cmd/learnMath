package com.learnmath.app.domain;

import com.learnmath.app.domain.JudgeService.JudgeResult;
import com.learnmath.app.domain.JudgeService.JudgeSpec;
import com.learnmath.app.domain.JudgeService.Outcome;
import com.learnmath.app.domain.JudgeService.QuestionType;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 判分引擎 —— 02 §5.4 归一化流水线 + 07 §3.1 用例表逐条落地。
 */
class JudgeServiceTest {

    private final JudgeService judge = new JudgeService();

    @Test
    void multiChoice_orderIndependent() {
        // 07：多选顺序无关（ACD vs DAC）
        assertEquals(Outcome.CORRECT,
                JudgeService.judgeDefault(QuestionType.MULTI, "ACD", "DAC").outcome());
        assertEquals(Outcome.CORRECT,
                JudgeService.judgeDefault(QuestionType.MULTI, "ACD", "A,C,D").outcome());
        assertEquals(Outcome.WRONG,
                JudgeService.judgeDefault(QuestionType.MULTI, "ACD", "AC").outcome());
    }

    @Test
    void singleChoice_and_judge() {
        assertEquals(Outcome.CORRECT, JudgeService.judgeDefault(QuestionType.SINGLE, "B", "b").outcome());
        assertEquals(Outcome.WRONG, JudgeService.judgeDefault(QuestionType.SINGLE, "B", "A").outcome());
        assertEquals(Outcome.CORRECT, JudgeService.judgeDefault(QuestionType.JUDGE, "T", "T").outcome());
    }

    @Test
    void fill_fullWidthAndThousandSeparator() {
        // 07：答案 1000，用户「１，０００」→ correct（全角+千分位归一）
        assertEquals(Outcome.CORRECT,
                JudgeService.judgeDefault(QuestionType.FILL, "1000", "１，０００").outcome());
    }

    @Test
    void fill_fractionEquivalent() {
        // 07：0.5 ≡ 1/2 ≡ ½
        assertEquals(Outcome.CORRECT, JudgeService.judgeDefault(QuestionType.FILL, "0.5", "1/2").outcome());
        assertEquals(Outcome.CORRECT, JudgeService.judgeDefault(QuestionType.FILL, "0.5", "½").outcome());
        assertEquals(Outcome.CORRECT, JudgeService.judgeDefault(QuestionType.FILL, "1/2", "0.50").outcome());
    }

    @Test
    void fill_multiAcceptableAlternatives() {
        // 07：答案「x=1|1」，用户「1」→ correct（空内可接受）
        assertEquals(Outcome.CORRECT,
                JudgeService.judgeDefault(QuestionType.FILL, "x=2|2", "2").outcome());
        assertEquals(Outcome.CORRECT,
                JudgeService.judgeDefault(QuestionType.FILL, "x=2|2", "x=2").outcome());
    }

    @Test
    void fill_numericTolerance_onOff() {
        // 07：3.14159 vs 3.1416 —— 容差关=错，开=对（judge_config 容差 1e-5）
        JudgeSpec off = JudgeSpec.defaults(QuestionType.FILL, "3.14159");
        assertEquals(Outcome.WRONG, judge.judge(off, "3.1416").outcome());

        JudgeSpec on = new JudgeSpec(QuestionType.FILL, "3.14159",
                true, true, false, true, 1e-5, false);
        assertEquals(Outcome.CORRECT, judge.judge(on, "3.1416").outcome());
    }

    @Test
    void fill_trailingZeros_equivalent() {
        assertEquals(Outcome.CORRECT, JudgeService.judgeDefault(QuestionType.FILL, "1", "1.00").outcome());
        assertEquals(Outcome.CORRECT, JudgeService.judgeDefault(QuestionType.FILL, "2000", "２０００").outcome());
    }

    @Test
    void fill_multiBlank_ratio() {
        // 07：多空部分对 → 2 空对 1 空 = 50%（按空比例，配置化）
        JudgeSpec proportional = new JudgeSpec(QuestionType.FILL, "2||3",
                true, true, false, true, 0d, true);

        JudgeResult partial = judge.judge(proportional, "2||5");
        assertEquals(Outcome.WRONG, partial.outcome(), "未全对 → 非 CORRECT；比例经 fillRatio 暴露");
        assertEquals(1, partial.matchedBlanks());
        assertEquals(2, partial.totalBlanks());
        assertTrue(Math.abs(judge.fillRatio(partial) - 0.5d) < 1e-9);

        JudgeResult all = judge.judge(proportional, "2||3");
        assertEquals(Outcome.CORRECT, all.outcome());
        assertTrue(judge.fillRatio(all) == 1.0d);

        // 空数不一致 → 直接错
        assertEquals(Outcome.WRONG, judge.judge(proportional, "2").outcome());
    }

    @Test
    void fill_default_allOrNothing() {
        JudgeSpec spec = JudgeSpec.defaults(QuestionType.FILL, "2||3");
        assertEquals(Outcome.WRONG, judge.judge(spec, "2||5").outcome());
        assertEquals(Outcome.CORRECT, judge.judge(spec, "2||3").outcome());
    }

    @Test
    void essay_pendingSelfAssess_neverJudged() {
        // 01 U-04 / 20 BR-04：解答题不判分 → 待自评
        JudgeResult r = JudgeService.judgeDefault(QuestionType.ESSAY, "要点1;要点2", "我的答案");
        assertEquals(Outcome.PENDING_SELF_ASSESS, r.outcome());
        assertFalse(r.correct());
    }

    @Test
    void emptyUser_wrong() {
        assertEquals(Outcome.WRONG, JudgeService.judgeDefault(QuestionType.SINGLE, "A", "").outcome());
        assertEquals(Outcome.WRONG, JudgeService.judgeDefault(QuestionType.FILL, "42", "").outcome());
    }

    @Test
    void currencyAndSpaceStripped() {
        assertEquals(Outcome.CORRECT,
                JudgeService.judgeDefault(QuestionType.FILL, "1200", "￥1,200").outcome());
    }
}
