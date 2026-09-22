package com.learnmath.app.domain;

/**
 * 作答模式与辅助矩阵（20 §3 BR-03 / DR-03；纯函数）。
 *
 * mode 描述用途；feedback_mode 与 assistance_policy **服务端创建并冻结，客户端不能改**。
 * 未交卷期间：全局 AI、题目答案、关联社区、题/公式深钻、另开练习都按当前 attempt 的
 * 冻结策略检查（不能靠漏传 attemptId 绕过）；本次交卷事务提交后解除活动约束。
 * 开考页明确列出：辅助、时限、恢复、计分（{@link KickoffNotice}）。
 */
public final class AssistanceMatrix {

    /** 用途（04 mode 枚举）。 */
    public enum Mode {
        PRACTICE("自由练习"),
        DAILY_DRILL("每日一练"),
        IN_CLASS_QUIZ("随堂练"),
        NORMAL_LEVEL("普通关"),
        ASSESSMENT("入学/复测"),
        EXAM("普通考试"),
        PROMOTION("晋级战"),
        BOSS("Boss 战"),
        CHALLENGE("挑战赛"),
        OPEN_BOOK_EXAM("开卷考试(管理端明确配置)");

        private final String label;

        Mode(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    public enum FeedbackMode { IMMEDIATE, ON_SUBMIT }

    public enum AssistancePolicy { LEARNING, REFERENCE_ONLY, RESTRICTED, OPEN_BOOK }

    public enum Capability {
        FORMULA_SHEET,      // 公式条件摘要（open/reference=仅开卷时冻结的允许表：式子/符号/条件，无链接）
        FORMULA_DERIVATION, // 完整公式推导
        QUESTION_DEEPDRILL, // 本卷题目深钻
        QUESTION_ANSWER,    // 本卷题目答案/解析
        GLOBAL_AI,          // 已认证全局 AI
        COMMUNITY,          // 关联社区/关联问答
        NEW_PRACTICE        // 另开练习
    }

    public enum Phase { DURING, AFTER_SUBMIT }

    /** 冻结后的作答规则。 */
    public record Rule(FeedbackMode feedback, AssistancePolicy policy) {}

    /** 服务端解析：以服务端默认为准；客户端任何不一致的改写都被拒绝（flag=true 供上层 403）。 */
    public record Resolved(Rule rule, boolean clientTampered) {}

    /** 开考告知（BR-03：开考页明确列出辅助、时限、恢复与计分规则）。 */
    public record KickoffNotice(Mode mode, FeedbackMode feedback, AssistancePolicy policy,
                                String assistanceLine, String deadlineLine,
                                String recoveryLine, String scoringLine) {}

    private AssistanceMatrix() {
    }

    /** 用途 → 服务端默认（20 §3 矩阵五组）。 */
    public static Rule defaultsFor(Mode mode) {
        return switch (mode) {
            case PRACTICE, DAILY_DRILL, IN_CLASS_QUIZ, NORMAL_LEVEL ->
                    new Rule(FeedbackMode.IMMEDIATE, AssistancePolicy.LEARNING);
            case ASSESSMENT ->
                    new Rule(FeedbackMode.ON_SUBMIT, AssistancePolicy.RESTRICTED);
            case EXAM ->
                    new Rule(FeedbackMode.ON_SUBMIT, AssistancePolicy.REFERENCE_ONLY);
            case PROMOTION, BOSS, CHALLENGE ->
                    new Rule(FeedbackMode.ON_SUBMIT, AssistancePolicy.RESTRICTED);
            case OPEN_BOOK_EXAM ->
                    new Rule(FeedbackMode.ON_SUBMIT, AssistancePolicy.OPEN_BOOK);
        };
    }

    /**
     * 服务端创建并冻结：客户端传入的 feedback/assistance 若与服务端默认不符 → 仍返回默认 + 标记篡改。
     * null=客户端未传（正常）。
     */
    public static Resolved resolve(Mode mode, FeedbackMode clientFeedback, AssistancePolicy clientPolicy) {
        Rule def = defaultsFor(mode);
        boolean tampered = (clientFeedback != null && clientFeedback != def.feedback())
                || (clientPolicy != null && clientPolicy != def.policy());
        return new Resolved(tampered ? def : def, tampered);
    }

    /**
     * 能力判定。DURING=活动作答期间（快照策略优先）；AFTER_SUBMIT=交卷事务提交后（约束解除）。
     */
    public static boolean can(Rule rule, Capability cap, Phase phase) {
        if (phase == Phase.AFTER_SUBMIT) {
            // 交卷后活动约束解除（自评阶段已可看解析）；开卷卷标记不影响读取，只影响成绩用途
            return true;
        }
        return switch (rule.policy()) {
            case LEARNING -> true; // 可看/可问/可深钻 —— 但一律记帮助与曝光（BR-01 曝光记录）
            case RESTRICTED -> false; // 测评/晋级/Boss/挑战：全禁
            case REFERENCE_ONLY -> cap == Capability.FORMULA_SHEET;
                // 普通考试：仅开卷时冻结的允许公式表（式子/符号/条件，无链接）；深钻/答案/AI 待交卷
            case OPEN_BOOK -> switch (cap) {
                case FORMULA_SHEET, FORMULA_DERIVATION, GLOBAL_AI, COMMUNITY -> true;
                case QUESTION_DEEPDRILL, QUESTION_ANSWER, NEW_PRACTICE -> false;
                    // 本卷题目解析/深钻待交卷；另开练习不在允许矩阵
            };
        };
    }

    /** 同账号一次只能有一个未交卷的 on_submit 作答（BR-03 → 3007）。 */
    public static boolean rejectNewOnSubmitAttempt(boolean activeOnSubmitExists) {
        return activeOnSubmitExists;
    }

    /** 开考页文案组装（四项规则必须齐）。 */
    public static KickoffNotice buildNotice(Mode mode, Rule rule, String durationText,
                                            String recoveryText, String scoringText) {
        String assistance = switch (rule.policy()) {
            case LEARNING -> "辅助：公式/推导/深钻/AI 均可用（会记录帮助与曝光，影响掌握度证据有效性）";
            case RESTRICTED -> "辅助：不可查看公式、推导、题目深钻与 AI；离开页面不暂停";
            case REFERENCE_ONLY -> "辅助：仅开卷允许公式表（式子/符号/条件）；题目深钻与 AI 交卷后开放";
            case OPEN_BOOK -> "辅助：开卷——公式与推导可用、AI 可用（记帮助）；本卷解析/深钻交卷后开放";
        };
        return new KickoffNotice(mode, rule.feedback(), rule.policy(),
                assistance,
                "时限：" + durationText + "（以服务端截止为准，断网不暂停）",
                "恢复：" + recoveryText,
                "计分：" + scoringText);
    }

    /** 竞技口径：晋级/Boss/挑战发布时的题源硬约束（20 §3：拒绝解答题、未审核题、已公开同族）。 */
    public static boolean competitiveSourceAllowed(int questionType, int reviewStatus, boolean familyExposedPublicly) {
        boolean isEssay = questionType == 5; // 5=解答（03 T09）
        boolean reviewedOk = reviewStatus == 1; // 1=可用/审核通过
        return !isEssay && reviewedOk && !familyExposedPublicly;
    }

    /** 报告/成绩用途（开卷不进竞技榜/晋级/掌握度 —— AttemptLifecycle.countsForCompetitive 同口径）。 */
    public static boolean countsForMastery(Rule rule) {
        return rule.policy() != AssistancePolicy.OPEN_BOOK;
    }
}
