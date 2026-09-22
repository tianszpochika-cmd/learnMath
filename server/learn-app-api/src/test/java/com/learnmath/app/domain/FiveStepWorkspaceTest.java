package com.learnmath.app.domain;

import com.learnmath.app.domain.FiveStepWorkspace.ProcessScore;
import com.learnmath.app.domain.FiveStepWorkspace.SaveOutcome;
import com.learnmath.app.domain.FiveStepWorkspace.Step;
import com.learnmath.app.domain.FiveStepWorkspace.StepPayload;
import com.learnmath.app.domain.FiveStepWorkspace.VerifyTrace;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 应用五步 —— 逐题隔离(seq/revision/requestId) / 过程分不进客观 / 回代留痕(E4)。 */
class FiveStepWorkspaceTest {

    @Test
    void cellKey_perQuestionIsolation_samePaperTwoQuestionsNeverShare() {
        String a = FiveStepWorkspace.cellKey("ans-101", Step.MODEL);
        String b = FiveStepWorkspace.cellKey("ans-102", Step.MODEL); // 同卷另一道应用题
        assertNotEquals(a, b, "同 step 不同题必须隔离（20 §4 末条）");
        assertEquals("ans-101|MODEL", a);
        assertThrows(IllegalArgumentException.class, () -> FiveStepWorkspace.cellKey(" ", Step.MODEL));
    }

    @Test
    void validate_seqMustMatchStepOrdinal() {
        StepPayload ok = new StepPayload("ans-1", 3, Step.MODEL, "设速度为 x", 0, "r1");
        assertTrue(FiveStepWorkspace.validate(ok).isEmpty());

        StepPayload badSeq = new StepPayload("ans-1", 5, Step.MODEL, "…", 0, "r2");
        assertFalse(FiveStepWorkspace.validate(badSeq).isEmpty());
        assertTrue(FiveStepWorkspace.validate(badSeq).get(0).contains("seq"));

        StepPayload emptyContent = new StepPayload("ans-1", 1, Step.TRANSLATE, "  ", 0, "r3");
        assertTrue(FiveStepWorkspace.validate(emptyContent).get(0).contains("content"));

        StepPayload noAnswer = new StepPayload(null, 1, Step.TRANSLATE, "拆句", 0, "r4");
        assertTrue(FiveStepWorkspace.validate(noAnswer).get(0).contains("attemptAnswerId"));
    }

    @Test
    void save_replayIdempotent_and_revisionConflict() {
        Set<String> ids = new HashSet<>(Set.of("req-1"));
        SaveOutcome replay = FiveStepWorkspace.save(ids, "req-1", 9, 9);
        assertTrue(replay.accepted());
        assertTrue(replay.replayed());

        SaveOutcome conflict = FiveStepWorkspace.save(new HashSet<>(), "req-2", 1, 3);
        assertFalse(conflict.accepted());
        assertTrue(conflict.revisionConflict());
        assertEquals(3, conflict.currentRevision());

        SaveOutcome fresh = FiveStepWorkspace.save(new HashSet<>(), "req-3", 3, 3);
        assertTrue(fresh.accepted());
        assertEquals(4, fresh.currentRevision());
    }

    @Test
    void processScore_fourStepsOnly_verifyExcluded_fromObjective() {
        ProcessScore full = FiveStepWorkspace.score(Map.of(
                Step.TRANSLATE, true, Step.SET_VAR, true, Step.MODEL, true, Step.SOLVE, true,
                Step.VERIFY, false));
        assertEquals(4, full.possible(), "回代不计分母（E4 可跳过）");
        assertEquals(4, full.earned());
        assertEquals(100.0, full.rate(), 1e-9);

        ProcessScore partial = FiveStepWorkspace.score(Map.of(
                Step.TRANSLATE, true, Step.SET_VAR, false, Step.MODEL, true));
        assertEquals(2, partial.earned());
        assertEquals(3, partial.possible());

        ProcessScore none = FiveStepWorkspace.score(Map.of());
        assertEquals(0, none.possible());
        assertNull(none.rate());

        // 过程分永不进客观成绩
        assertFalse(FiveStepWorkspace.countsForObjective());
    }

    @Test
    void verifyTrace_skipIsTraceNotFailure() {
        VerifyTrace skipped = FiveStepWorkspace.skipVerify();
        assertTrue(skipped.skipped());
        assertFalse(skipped.attempted());
        assertTrue(skipped.note().contains("不计分"));

        VerifyTrace notSubmitted = FiveStepWorkspace.traceVerify(null);
        assertFalse(notSubmitted.attempted());
        assertFalse(notSubmitted.skipped());
        assertTrue(notSubmitted.note().contains("未提交"));

        VerifyTrace passed = FiveStepWorkspace.traceVerify(true);
        assertTrue(passed.attempted());
        assertTrue(passed.note().contains("通过"));

        VerifyTrace failed = FiveStepWorkspace.traceVerify(false);
        assertTrue(failed.attempted());
        assertFalse(failed.note().contains("不计分"));
    }

    @Test
    void cellKeyOrDefault_normalizesStepName() {
        assertEquals("ans-9|SOLVE", FiveStepWorkspace.cellKeyOrDefault("ans-9", "solve"));
        assertEquals("ans-9|VERIFY", FiveStepWorkspace.cellKeyOrDefault("ans-9", "Verify"));
        assertThrows(IllegalArgumentException.class, () -> FiveStepWorkspace.cellKeyOrDefault("a", "NOPE"));
    }
}
