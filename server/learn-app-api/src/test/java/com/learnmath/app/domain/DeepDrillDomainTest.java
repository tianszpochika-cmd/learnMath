package com.learnmath.app.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 深钻域 —— typed 路由 / 预测键(19 R09) / 四型点评(E2)。 */
class DeepDrillDomainTest {

    @Test
    void typedRoutes_noIdCollision() {
        assertEquals("/deepdive/question/7", DeepDrillDomain.routeFor(DeepDrillDomain.SubjectType.QUESTION, 7));
        assertEquals("/deepdive/formula/7", DeepDrillDomain.routeFor(DeepDrillDomain.SubjectType.FORMULA, 7));
        assertNotEquals(DeepDrillDomain.routeFor(DeepDrillDomain.SubjectType.QUESTION, 7),
                DeepDrillDomain.routeFor(DeepDrillDomain.SubjectType.FORMULA, 7), "同 id 不碰撞");
        assertEquals("/deepdive/question/7", DeepDrillDomain.legacyQuestionRedirect(7), "旧题目路由 → 带类型");
    }

    @Test
    void predictionKey_solutionVersionStep_unified() {
        DeepDrillDomain.PredictionKey k = DeepDrillDomain.keyOf(10L, 2, 55L);
        assertEquals("10:2:55", k.key());
        assertEquals(k, DeepDrillDomain.keyOf(10L, 2, 55L));
        assertNotEquals(k, DeepDrillDomain.keyOf(10L, 3, 55L), "版本不同键不同");
    }

    @Test
    void submission_requiresCompleteKeyAndAnswer() {
        assertTrue(DeepDrillDomain.validSubmission(
                new DeepDrillDomain.PredictionSubmit(DeepDrillDomain.keyOf(1, 1, 1),
                        DeepDrillDomain.PredMode.PICK_STEP, "B")));
        assertFalse(DeepDrillDomain.validSubmission(
                new DeepDrillDomain.PredictionSubmit(DeepDrillDomain.keyOf(0, 1, 1),
                        DeepDrillDomain.PredMode.PICK_STEP, "B")), "缺解法 id");
        assertFalse(DeepDrillDomain.validSubmission(
                new DeepDrillDomain.PredictionSubmit(DeepDrillDomain.keyOf(1, 1, 1),
                        DeepDrillDomain.PredMode.PICK_STEP, "  ")), "空答案");
    }

    @Test
    void objectiveDualBranch_feedback() {
        // 正确分支：强化动机
        DeepDrillDomain.Feedback right = DeepDrillDomain.judgeObjective(
                DeepDrillDomain.PredMode.PICK_STEP, "S3", "S3",
                "零因子律正是此步依据；动机=目标降次。", "", "");
        assertTrue(right.objective());
        assertEquals(DeepDrillDomain.Judgement.RIGHT, right.judgement());
        assertTrue(right.headline().contains("正确"));
        assertTrue(right.body().contains("动机"));

        // 错误分支："你会这么想…但…" + 岔路
        DeepDrillDomain.Feedback wrong = DeepDrillDomain.judgeObjective(
                DeepDrillDomain.PredMode.PICK_WARRANT, "分配律", "零因子律",
                "", "你会这么想，因为除掉更快——", "(x−2) 可能为 0，同除会丢根");
        assertEquals(DeepDrillDomain.Judgement.WRONG, wrong.judgement());
        assertTrue(wrong.body().contains("你会这么想"));
        assertTrue(wrong.offRamp().contains("丢根"));

        // 主观型不能走客观判分
        assertThrows(IllegalArgumentException.class, () -> DeepDrillDomain.judgeObjective(
                DeepDrillDomain.PredMode.FILL_MOTIVE, "a", "a", "", "", ""));
    }

    @Test
    void subjective_neverAutoJudged_selfConfirmOnly() {
        DeepDrillDomain.Feedback f = DeepDrillDomain.judgeSubjective(
                DeepDrillDomain.PredMode.FILL_MOTIVE,
                "设未知 x 后列一元一次方程", "设 x 表示速度", true);
        assertFalse(f.objective(), "主观型不进客观判定");
        assertEquals(DeepDrillDomain.Judgement.SELF_CONFIRM, f.judgement());
        assertTrue(f.body().contains("对照参考"));
        assertTrue(f.body().contains("自评"));
        assertTrue(f.body().contains("不计入推理画像"));
        // 即便用户说会了，也仍是自报（不产生 observed）
        assertEquals(DeepDrillDomain.Judgement.SELF_CONFIRM,
                DeepDrillDomain.selfJudgement(true, true));
        assertEquals(DeepDrillDomain.Judgement.SELF_CONFIRM,
                DeepDrillDomain.selfJudgement(false, false));
        assertThrows(IllegalArgumentException.class, () -> DeepDrillDomain.judgeSubjective(
                DeepDrillDomain.PredMode.PICK_STEP, "a", "b", true));
    }

    @Test
    void objectiveModeFlags() {
        assertTrue(DeepDrillDomain.isObjective(DeepDrillDomain.PredMode.PICK_STEP));
        assertTrue(DeepDrillDomain.isObjective(DeepDrillDomain.PredMode.PICK_WARRANT));
        assertFalse(DeepDrillDomain.isObjective(DeepDrillDomain.PredMode.FILL_MOTIVE));
        assertFalse(DeepDrillDomain.isObjective(DeepDrillDomain.PredMode.SHORT_ANSWER));
    }
}
