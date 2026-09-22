package com.learnmath.app.domain;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 应用五步工作台（01 K-11 · 04 /attempt/{id}/five-steps · 20 §4 末条 / E4；纯函数）。
 *
 * 五步：TRANSLATE 拆句标注 → SET_VAR 设未知 → MODEL 列式 → SOLVE 求解 → VERIFY 回代检验。
 * 规则：
 *  - **按 attempt_answer 逐题保存**（请求含 seq/revision/requestId），同卷多道应用题
 *    不得共用一份 five_steps（cellKey = answerId + step 隔离）；
 *  - requestId 幂等重放、revision 冲突回执（复用草稿三型语义）；
 *  - **过程分仅作各题反馈**，不跨题覆盖、不加入客观成绩（countsForObjective 恒 false）；
 *  - 回代 VERIFY 可跳过留痕（E4）：不计过程分分母，只留 trace。
 */
public final class FiveStepWorkspace {

    public enum Step { TRANSLATE, SET_VAR, MODEL, SOLVE, VERIFY }

    public record StepPayload(String attemptAnswerId, int seq, Step step, String content,
                              int revision, String requestId) {}

    public record SaveOutcome(boolean accepted, boolean replayed, boolean revisionConflict,
                              int currentRevision, String reason) {}

    /** 过程分（仅本题反馈）。 */
    public record ProcessScore(int earned, int possible) {

        public Double rate() {
            return possible <= 0 ? null : 100.0 * earned / possible;
        }
    }

    /** 回代留痕。 */
    public record VerifyTrace(boolean attempted, boolean skipped, String note) {}

    private FiveStepWorkspace() {
    }

    /** 逐题+逐步隔离键（同卷两道题永不共用）。 */
    public static String cellKey(String attemptAnswerId, Step step) {
        if (attemptAnswerId == null || attemptAnswerId.isBlank()) {
            throw new IllegalArgumentException("attemptAnswerId 必填（逐题隔离）");
        }
        return attemptAnswerId + "|" + step.name();
    }

    /** seq 校验：1..5 且与 step 序位一致（step.ordinal()+1 == seq）。 */
    public static List<String> validate(StepPayload p) {
        java.util.ArrayList<String> errs = new java.util.ArrayList<>();
        if (p == null) {
            errs.add("payload 为空");
            return errs;
        }
        if (p.attemptAnswerId() == null || p.attemptAnswerId().isBlank()) {
            errs.add("attemptAnswerId 必填");
        }
        if (p.step() == null) {
            errs.add("step 必填");
            return errs;
        }
        int expected = p.step().ordinal() + 1;
        if (p.seq() != expected) {
            errs.add("seq 与 step 不匹配：期望 " + expected + "（" + p.step().name() + "），实际 " + p.seq());
        }
        if (p.content() == null || p.content().isBlank()) {
            errs.add("content 为空");
        }
        if (p.revision() < 0) {
            errs.add("revision 非法");
        }
        return errs;
    }

    /**
     * 保存一步（cell 级幂等/冲突；到期语义由 AttemptLifecycle.deadlineAt 统一在服务层把关）。
     */
    public static SaveOutcome save(Set<String> replayedIds, String requestId,
                                   int clientRevision, int serverRevision) {
        if (replayedIds != null && requestId != null && replayedIds.contains(requestId)) {
            return new SaveOutcome(true, true, false, serverRevision, "重复 requestId，返回原回执");
        }
        if (clientRevision != serverRevision) {
            return new SaveOutcome(false, false, true, serverRevision, "revision 冲突：两份内容待确认");
        }
        return new SaveOutcome(true, false, false, serverRevision + 1, "accepted");
    }

    /**
     * 过程分：前四步（TRANSLATE..SOLVE）计入 possible，逐步对错累加；
     * VERIFY 不计分母（回代可跳过留痕）。**永不计入客观成绩。**
     */
    public static ProcessScore score(Map<Step, Boolean> stepCorrect) {
        int earned = 0;
        int possible = 0;
        if (stepCorrect != null) {
            for (Step s : new Step[]{Step.TRANSLATE, Step.SET_VAR, Step.MODEL, Step.SOLVE}) {
                Boolean v = stepCorrect.get(s);
                if (v != null) {
                    possible++;
                    if (v) {
                        earned++;
                    }
                }
            }
        }
        return new ProcessScore(earned, possible);
    }

    /** 过程分永不进客观成绩（01 U-19/20 §4）。 */
    public static boolean countsForObjective() {
        return false;
    }

    /** 回代留痕：主动跳过 ≠ 失败；未提交也只记录未尝试。 */
    public static VerifyTrace traceVerify(Boolean verifyResult) {
        if (verifyResult == null) {
            return new VerifyTrace(false, false, "未提交回代（留痕）");
        }
        if (verifyResult) {
            return new VerifyTrace(true, false, "回代通过");
        }
        return new VerifyTrace(true, false, "回代未通过（提示检查建模）");
    }

    /** 显式跳过（E4 允许）—— 只留痕，不阻塞提交。 */
    public static VerifyTrace skipVerify() {
        return new VerifyTrace(false, true, "已跳过回代（记录留痕，不计分）");
    }

    public static String cellKeyOrDefault(String answerId, String stepName) {
        return cellKey(answerId, Step.valueOf(stepName.toUpperCase(Locale.ROOT)));
    }
}
