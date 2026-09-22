package com.learnmath.app.domain;

import java.util.List;
import java.util.Objects;

/**
 * 断链证据与补救（20 §5 BR-05 / DR-05；纯函数）。
 *
 * 要点：
 *  - status=unlocated|suggested|observed|self_reported；source=prediction|user|ai；
 *    证据 key = evidenceAnswerId + source + stepId（stepSeq 仅历史显示值）；
 *  - 只知最终答案 → unlocated；AI 建议 → suggested（"可能卡在这里，待确认"，**不作确定断言**）；
 *  - observed（预测题客观答错）才进推理画像；AI suggested 不参与分数；用户确认 → self_reported（不伪装客观观察）；
 *  - 每条证据带**最小链步骤与 warrant_nodes 快照**：链重排/下架后仍显示原快照，禁止跳新版本同 seq；
 *  - AI 未启用/失败 → "尚未定位" + 错因标签/自报/同知识点练习，流程不等待 AI；
 *  - 预测"填动机/简答"一期对照参考后自报，不计 observed；客观选步/选依据才 observed；
 *  - 补救推荐 2 题为期望上限：不足显示实际数量，0 题给已发布内容+稍后复习，禁止空列表报"开始 2 题"。
 */
public final class BreakEvidence {

    public enum Status { UNLOCATED, SUGGESTED, OBSERVED, SELF_REPORTED }

    public enum Source { PREDICTION, USER, AI }

    /** 预测题题型（决定能否产生 observed）。 */
    public enum PredictionKind {
        OBJECTIVE_STEP,     // 选步型 → 客观
        OBJECTIVE_WARRANT,  // 选依据型 → 客观
        FILL_MOTIVE,        // 填动机 → 一期自报
        SHORT_ANSWER        // 简答 → 一期自报
    }

    /** 一条断链证据（含展示所需的链快照 —— 资源下架后仍可回放）。 */
    public record Evidence(
            Status status,
            Source source,
            String evidenceAnswerId,
            Long solutionPathId,
            Integer chainVersion,
            Long stepId,
            Long stepSeq,               // 历史显示值（不用于跨版本定位）
            List<Long> minimalChainSteps,   // 最小链步骤快照
            List<Long> warrantNodeSnapshot) { // 依据挂点快照

        /** 去重键（BR-05）。 */
        public String key() {
            return (evidenceAnswerId == null ? "" : evidenceAnswerId)
                    + "|" + source + "|" + stepId;
        }
    }

    /** 补救计划（如实数量）。 */
    public record RemedialPlan(int count, boolean startButton, String message) {}

    private BreakEvidence() {
    }

    /** 预测结果 → 证据状态（客观错=observed；主观对照参考=自报；对=不构成断链）。 */
    public static Status statusFor(PredictionKind kind, boolean correct, Source source) {
        if (correct) {
            return null; // 无断链
        }
        if (source == Source.AI) {
            return Status.SUGGESTED;
        }
        return switch (kind) {
            case OBJECTIVE_STEP, OBJECTIVE_WARRANT -> Status.OBSERVED;
            case FILL_MOTIVE, SHORT_ANSWER -> Status.SELF_REPORTED; // 一期不计 observed
        };
    }

    /** 仅知最终答案（无步级信息）。 */
    public static Evidence unlocated(String evidenceAnswerId) {
        return new Evidence(Status.UNLOCATED, Source.USER, evidenceAnswerId,
                null, null, null, null, List.of(), List.of());
    }

    /** AI 建议（未确认前不作确定断言）。 */
    public static Evidence aiSuggested(String evidenceAnswerId, long solutionPathId,
                                       int chainVersion, long stepId, long stepSeq,
                                       List<Long> minimalChain, List<Long> warrantNodes) {
        return new Evidence(Status.SUGGESTED, Source.AI, evidenceAnswerId,
                solutionPathId, chainVersion, stepId, stepSeq, minimalChain, warrantNodes);
    }

    /** 用户确认 AI 建议 → self_reported（不伪装成客观观察）。 */
    public static Evidence confirm(Evidence e) {
        if (e == null || e.status() != Status.SUGGESTED) {
            throw new IllegalArgumentException("仅 suggested 可确认");
        }
        return new Evidence(Status.SELF_REPORTED, e.source(), e.evidenceAnswerId(),
                e.solutionPathId(), e.chainVersion(), e.stepId(), e.stepSeq(),
                e.minimalChainSteps(), e.warrantNodeSnapshot());
    }

    /** 是否计入推理能力画像（BR-05：仅 observed）。 */
    public static boolean countsTowardReasoningProfile(Evidence e) {
        return e != null && e.status() == Status.OBSERVED;
    }

    /** 展示标签（suggested 不作确定断言）。 */
    public static String displayLabel(Evidence e) {
        return switch (e.status()) {
            case SUGGESTED -> "可能卡在这里，待确认";
            case UNLOCATED -> "尚未定位";
            case OBSERVED -> "预测答错，已定位到步骤";
            case SELF_REPORTED -> "你的自报标记";
        };
    }

    /** 是否给出确定断言（suggested/unlocated → 否）。 */
    public static boolean deterministicAssertion(Evidence e) {
        return e.status() == Status.OBSERVED || e.status() == Status.SELF_REPORTED;
    }

    /**
     * 展示投影：链资源不可用（下架/重排）时，用证据内快照回放原解法与步骤说明；
     * 禁止跳到新版本同 seq（stepId 属于旧 chainVersion）。
     */
    public static boolean snapshotDisplayable(Evidence e) {
        return e != null && e.solutionPathId() != null
                && e.minimalChainSteps() != null && !e.minimalChainSteps().isEmpty();
    }

    /** 换版本定位是否被禁止（旧 stepId ≠ 新版本）。 */
    public static boolean crossVersionStepRelocation(Evidence e, int currentChainVersion) {
        if (e.chainVersion() == null) {
            return false;
        }
        return e.chainVersion() != currentChainVersion; // true=禁止跳，只能用快照
    }

    /** AI 不可用时的降级出口（不等待 AI 才提交）。 */
    public static String aiUnavailableFallback() {
        return "尚未定位：可选错因标签 / 手选解法步骤 / 自报 / 同知识点练习（无需等待 AI）";
    }

    /**
     * 补救推荐（期望上限 2）。
     *
     * @param availableExercises     同知识点可用练习题数
     * @param hasPublishedContent    是否有已发布概念/公式内容
     */
    public static RemedialPlan remediation(int availableExercises, boolean hasPublishedContent) {
        int target = 2;
        if (availableExercises >= target) {
            return new RemedialPlan(target, true, "开始 " + target + " 题");
        }
        if (availableExercises > 0) {
            return new RemedialPlan(availableExercises, true,
                    "开始 " + availableExercises + " 题（同知识点仅 " + availableExercises + " 题）");
        }
        if (hasPublishedContent) {
            return new RemedialPlan(0, false,
                    "暂无可用练习：先读已发布概念/公式内容，稍后复习（0 题如实展示）");
        }
        return new RemedialPlan(0, false, "暂无可用内容，请稍后复习");
    }

    @Override
    public boolean equals(Object o) {
        return super.equals(o);
    }

    static boolean sameEvidence(Evidence a, Evidence b) {
        return Objects.equals(a.key(), b.key());
    }
}
