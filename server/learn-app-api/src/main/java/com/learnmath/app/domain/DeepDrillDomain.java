package com.learnmath.app.domain;

import java.util.Locale;
import java.util.Objects;

/**
 * 深钻域（04 §4.13 · 19 R09 复核 · 20 §8 BR-08 / E2；纯函数）。
 *
 * - **带类型路由**：/deepdive/question/{id} 与 /deepdive/formula/{id} 分离，避免 id 碰撞；
 *   旧题目路由 /deepdive/{id} 重定向到带类型版本（BR-08）；
 * - **预测提交参数统一为 解法/版本/stepId**（19 复核结论），stepSeq 仅历史显示；
 * - 四型预测点评：客观（选步/选依据）双分支——对=强化动机、错="你会这么想，因为…但…"；
 *   主观（填动机/简答）**一期对照参考后自报，不自动判对错、不计 observed**（BR-05）；
 * - 活动作答期间的能力拦截复用 AssistanceMatrix.can(QUESTION_DEEPDRILL, DURING)。
 */
public final class DeepDrillDomain {

    public enum SubjectType { QUESTION, FORMULA }

    /** 预测四型（03 T52 mode 1-4 同序）。 */
    public enum PredMode { PICK_STEP, PICK_WARRANT, FILL_MOTIVE, SHORT_ANSWER }

    /** 主观题判定（一期只能自报）。 */
    public enum Judgement { RIGHT, WRONG, SELF_CONFIRM }

    /** 预测键（19 R09：解法/版本/stepId 统一）。 */
    public record PredictionKey(long solutionPathId, int chainVersion, long stepId) {

        public String key() {
            return solutionPathId + ":" + chainVersion + ":" + stepId;
        }
    }

    /** 预测提交。 */
    public record PredictionSubmit(PredictionKey key, PredMode mode, String answer) {}

    /** 点评回执（E2 双分支）。 */
    public record Feedback(boolean objective, Judgement judgement,
                           String headline, String body, String offRamp) {

        public static Feedback correctObjective(String reinforceMotive) {
            return new Feedback(true, Judgement.RIGHT, "✓ 完全正确", reinforceMotive, null);
        }

        public static Feedback wrongObjective(String bridge, String offRamp) {
            return new Feedback(true, Judgement.WRONG, "点评（错）", bridge, offRamp);
        }
    }

    private DeepDrillDomain() {
    }

    // ---------- 路由 ----------

    public static String routeFor(SubjectType type, long id) {
        return type == SubjectType.FORMULA
                ? "/deepdive/formula/" + id
                : "/deepdive/question/" + id;
    }

    /** 旧路由（无类型）→ 题目带类型版本重定向（BR-08）。 */
    public static String legacyQuestionRedirect(long questionId) {
        return routeFor(SubjectType.QUESTION, questionId);
    }

    // ---------- 预测 ----------

    public static PredictionKey keyOf(long solutionPathId, int chainVersion, long stepId) {
        return new PredictionKey(solutionPathId, chainVersion, stepId);
    }

    /** 提交校验：键齐 + 答案非空。 */
    public static boolean validSubmission(PredictionSubmit s) {
        return s != null && s.key() != null && s.mode() != null
                && s.key().solutionPathId() > 0 && s.key().chainVersion() > 0 && s.key().stepId() > 0
                && s.answer() != null && !s.answer().isBlank();
    }

    public static boolean isObjective(PredMode mode) {
        return mode == PredMode.PICK_STEP || mode == PredMode.PICK_WARRANT;
    }

    /**
     * 客观型点评（双分支）。
     *
     * @param given            用户选择
     * @param expected         标准步/依据
     * @param reinforceMotive  正确分支的动机强化句
     * @param wrongBridge      错误分支的"你会想这么干，因为…"桥接句
     * @param offRamp          岔路/常见错误（错误分支展示）
     */
    public static Feedback judgeObjective(PredMode mode, String given, String expected,
                                          String reinforceMotive, String wrongBridge, String offRamp) {
        if (!isObjective(mode)) {
            throw new IllegalArgumentException("主观型不能走客观判分: " + mode);
        }
        boolean right = Objects.equals(normalize(given), normalize(expected));
        return right ? Feedback.correctObjective(reinforceMotive)
                : Feedback.wrongObjective(wrongBridge, offRamp);
    }

    /**
     * 主观型（填动机/简答）：**不自动判** —— 返回对照参考 + 自报问句（BR-05：不计 observed）。
     */
    public static Feedback judgeSubjective(PredMode mode, String referenceAnswer, String given,
                                           boolean userSaysGotIt) {
        if (isObjective(mode)) {
            throw new IllegalArgumentException("客观型不走自报: " + mode);
        }
        boolean similar = normalizedContains(referenceAnswer, given);
        Judgement j = userSaysGotIt ? Judgement.SELF_CONFIRM : Judgement.SELF_CONFIRM; // 一期恒自报
        String body = "对照参考：" + (referenceAnswer == null ? "（无参考）" : referenceAnswer)
                + " —— 你的答案" + (similar ? "方向接近" : "与参考不同")
                + "，请自评（不会/半会/会）。此反馈不计入推理画像。";
        return new Feedback(false, j, "自评参考（不自动判分）", body, null);
    }

    public static Judgement selfJudgement(boolean userSaysGotIt, boolean similarHint) {
        return Judgement.SELF_CONFIRM; // 一期口径：任何情况下都是自报（similar 仅展示提示）
    }

    private static String normalize(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT).replace(" ", "");
    }

    private static boolean normalizedContains(String reference, String given) {
        if (reference == null || given == null || given.isBlank()) {
            return false;
        }
        String r = normalize(reference);
        String g = normalize(given);
        return r.contains(g) || g.contains(r);
    }
}
