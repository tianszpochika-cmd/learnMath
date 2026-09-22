package com.learnmath.app.domain;

import com.learnmath.app.domain.AssistanceMatrix.Capability;
import com.learnmath.app.domain.AssistanceMatrix.FeedbackMode;
import com.learnmath.app.domain.AssistanceMatrix.KickoffNotice;
import com.learnmath.app.domain.AssistanceMatrix.Mode;
import com.learnmath.app.domain.AssistanceMatrix.Phase;
import com.learnmath.app.domain.AssistanceMatrix.Resolved;
import com.learnmath.app.domain.AssistanceMatrix.Rule;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 辅助矩阵 —— 20 §3 BR-03（DR-03 DoD）。 */
class AssistanceMatrixTest {

    @Test
    void defaults_fiveGroups_matchMatrix() {
        // learning + immediate：练习/每日/随堂/普通关
        for (Mode m : new Mode[]{Mode.PRACTICE, Mode.DAILY_DRILL, Mode.IN_CLASS_QUIZ, Mode.NORMAL_LEVEL}) {
            Rule r = AssistanceMatrix.defaultsFor(m);
            assertEquals(FeedbackMode.IMMEDIATE, r.feedback(), m.name());
            assertEquals(AssistanceMatrix.AssistancePolicy.LEARNING, r.policy(), m.name());
        }
        // restricted + on_submit：测评/晋级/Boss/挑战
        for (Mode m : new Mode[]{Mode.ASSESSMENT, Mode.PROMOTION, Mode.BOSS, Mode.CHALLENGE}) {
            Rule r = AssistanceMatrix.defaultsFor(m);
            assertEquals(FeedbackMode.ON_SUBMIT, r.feedback());
            assertEquals(AssistanceMatrix.AssistancePolicy.RESTRICTED, r.policy());
        }
        // reference_only + on_submit：普通考试
        Rule exam = AssistanceMatrix.defaultsFor(Mode.EXAM);
        assertEquals(AssistanceMatrix.AssistancePolicy.REFERENCE_ONLY, exam.policy());
        // open_book：明确配置开卷
        Rule ob = AssistanceMatrix.defaultsFor(Mode.OPEN_BOOK_EXAM);
        assertEquals(AssistanceMatrix.AssistancePolicy.OPEN_BOOK, ob.policy());
        assertEquals(FeedbackMode.ON_SUBMIT, ob.feedback());
    }

    @Test
    void clientCannotChangeFrozenRule_tamperFlagged() {
        // 客户端试图把测评改成 learning/即时反馈 → 仍返回服务端默认 + 篡改标记（上层 403）
        Resolved r = AssistanceMatrix.resolve(Mode.ASSESSMENT,
                FeedbackMode.IMMEDIATE, AssistanceMatrix.AssistancePolicy.LEARNING);
        assertTrue(r.clientTampered());
        assertEquals(AssistanceMatrix.AssistancePolicy.RESTRICTED, r.rule().policy());
        assertEquals(FeedbackMode.ON_SUBMIT, r.rule().feedback());

        Resolved ok = AssistanceMatrix.resolve(Mode.PRACTICE, null, null);
        assertFalse(ok.clientTampered());
    }

    @Test
    void restricted_allCapabilitiesDeniedDuring() {
        Rule r = AssistanceMatrix.defaultsFor(Mode.PROMOTION);
        for (Capability c : Capability.values()) {
            assertFalse(AssistanceMatrix.can(r, c, Phase.DURING), "restricted 应禁: " + c);
        }
    }

    @Test
    void referenceOnly_formulaSheetOnly_noLinks() {
        Rule r = AssistanceMatrix.defaultsFor(Mode.EXAM);
        assertTrue(AssistanceMatrix.can(r, Capability.FORMULA_SHEET, Phase.DURING));
        assertFalse(AssistanceMatrix.can(r, Capability.FORMULA_DERIVATION, Phase.DURING));
        assertFalse(AssistanceMatrix.can(r, Capability.QUESTION_DEEPDRILL, Phase.DURING));
        assertFalse(AssistanceMatrix.can(r, Capability.QUESTION_ANSWER, Phase.DURING));
        assertFalse(AssistanceMatrix.can(r, Capability.GLOBAL_AI, Phase.DURING));
        assertFalse(AssistanceMatrix.can(r, Capability.NEW_PRACTICE, Phase.DURING));
    }

    @Test
    void learning_allAllowed_butRecorded() {
        Rule r = AssistanceMatrix.defaultsFor(Mode.PRACTICE);
        for (Capability c : Capability.values()) {
            assertTrue(AssistanceMatrix.can(r, c, Phase.DURING), "learning 应放行: " + c);
        }
    }

    @Test
    void openBook_formulaDerivationYes_questionDrillNo() {
        Rule r = AssistanceMatrix.defaultsFor(Mode.OPEN_BOOK_EXAM);
        assertTrue(AssistanceMatrix.can(r, Capability.FORMULA_SHEET, Phase.DURING));
        assertTrue(AssistanceMatrix.can(r, Capability.FORMULA_DERIVATION, Phase.DURING), "公式推导可");
        assertTrue(AssistanceMatrix.can(r, Capability.GLOBAL_AI, Phase.DURING), "AI 可（记帮助）");
        assertFalse(AssistanceMatrix.can(r, Capability.QUESTION_DEEPDRILL, Phase.DURING), "本卷深钻待交卷");
        assertFalse(AssistanceMatrix.can(r, Capability.QUESTION_ANSWER, Phase.DURING));
        assertFalse(AssistanceMatrix.can(r, Capability.NEW_PRACTICE, Phase.DURING), "不在允许矩阵");
        // 开卷不计掌握度/竞技
        assertFalse(AssistanceMatrix.countsForMastery(r));
    }

    @Test
    void afterSubmit_constraintLifted_allReadsAllowed() {
        for (AssistanceMatrix.AssistancePolicy p : AssistanceMatrix.AssistancePolicy.values()) {
            Rule r = new Rule(FeedbackMode.ON_SUBMIT, p);
            for (Capability c : Capability.values()) {
                assertTrue(AssistanceMatrix.can(r, c, Phase.AFTER_SUBMIT), p + "/" + c);
            }
        }
    }

    @Test
    void kickoffNotice_fourLinesPresent() {
        Rule r = AssistanceMatrix.defaultsFor(Mode.ASSESSMENT);
        KickoffNotice n = AssistanceMatrix.buildNotice(Mode.ASSESSMENT, r, "25 分钟",
                "断网不暂停，草稿服务端自动保存，刷新可续答", "客观题定级，不计掌握度与竞技排名");
        assertNotNull(n.assistanceLine());
        assertNotNull(n.deadlineLine());
        assertNotNull(n.recoveryLine());
        assertNotNull(n.scoringLine());
        assertTrue(n.assistanceLine().contains("AI"));
        assertTrue(n.deadlineLine().contains("服务端截止"));
        assertEquals(Mode.ASSESSMENT, n.mode());
    }

    @Test
    void singleActiveOnSubmitAttempt_guard3007_and_competitiveSource() {
        assertTrue(AssistanceMatrix.rejectNewOnSubmitAttempt(true), "已有进行中 → 3007");
        assertFalse(AssistanceMatrix.rejectNewOnSubmitAttempt(false));
        // 晋级/Boss/挑战题源：解答题/未审题/已公开同族 拒绝
        assertFalse(AssistanceMatrix.competitiveSourceAllowed(5, 1, false), "解答题拒绝");
        assertFalse(AssistanceMatrix.competitiveSourceAllowed(1, 3, false), "未审题拒绝");
        assertFalse(AssistanceMatrix.competitiveSourceAllowed(1, 1, true), "已公开同族拒绝");
        assertTrue(AssistanceMatrix.competitiveSourceAllowed(1, 1, false));
    }
}
