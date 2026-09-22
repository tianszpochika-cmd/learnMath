package com.learnmath.app.domain;

import java.util.ArrayList;
import java.util.List;

/**
 * 入学/复测自适应测评（02 §5.6 · 01 P3 · 17 A10 分档规则 · 16W11；纯函数）。
 *
 * 规则（A10 表单默认）：起始档=中考水平（档 2）；连对 3 题升一档；错 2 题降一档；
 * 终止=达档 5 或 答满 25 题；**可中断续答**（状态可序列化/恢复，01-D3）。
 * 服务端逐题调档但**未交卷不对外返正误**（BR-03 restricted 投影由服务层控制）。
 * 降/升切换时窗口计数清零；计数按"当前档内"统计。
 */
public final class AssessmentEngine {

    public enum StepOutcome { KEEP, UP, DOWN, STOP }

    /** 一步推进事件。 */
    public record Step(StepOutcome outcome, AssessmentState state, String reason) {}

    /** 可序列化的测评状态（续答恢复用）。 */
    public record AssessmentState(int level, int consecutiveCorrect,
                                  int wrongInLevel, int answered,
                                  List<Boolean> answers, int wrongTotal) {

        public static AssessmentState initial(int startLevel) {
            return new AssessmentState(Math.max(1, Math.min(5, startLevel)), 0, 0, 0, List.of(), 0);
        }

        public AssessmentState serializeableCopy() {
            return new AssessmentState(level, consecutiveCorrect, wrongInLevel,
                    answered, List.copyOf(answers), wrongTotal);
        }
    }

    /** 维度得分率（dims_json 映射：维度 → 答对/答总）。 */
    public record DimRate(String dim, int answered, int correct) {

        public Double rate() {
            return answered <= 0 ? null : 100.0 * correct / answered;
        }
    }

    /** 定级报告。 */
    public record Report(int level, int answered, int wrongTotal,
                         Double overallAccuracy, boolean reachedCeiling, boolean hitQuestionCap) {}

    public static final int START_LEVEL = 2;
    public static final int MAX_LEVEL = 5;
    public static final int MIN_LEVEL = 1;
    public static final int UP_STREAK = 3;
    public static final int DOWN_WRONG = 2;
    public static final int QUESTION_CAP = 25;

    private AssessmentEngine() {
    }

    /** 提交一题结果 → 状态推进与档位动作（顺序：先判终止，再判升降）。 */
    public static Step step(AssessmentState s, boolean correct) {
        int level = s.level();
        int cons = correct ? s.consecutiveCorrect() + 1 : 0;
        int wrongInLevel = correct ? s.wrongInLevel() : s.wrongInLevel() + 1;
        int answered = s.answered() + 1;
        int wrongTotal = s.wrongTotal() + (correct ? 0 : 1);
        List<Boolean> answers = new ArrayList<>(s.answers());
        answers.add(correct);

        // 终止
        if (level >= MAX_LEVEL) {
            return new Step(StepOutcome.STOP,
                    new AssessmentState(level, cons, wrongInLevel, answered, answers, wrongTotal),
                    "已达档 5 → 终止出定级");
        }
        if (answered >= QUESTION_CAP) {
            return new Step(StepOutcome.STOP,
                    new AssessmentState(level, cons, wrongInLevel, answered, answers, wrongTotal),
                    "答满 " + QUESTION_CAP + " 题 → 终止出定级");
        }
        // 升档：档内连对 3
        if (correct && cons >= UP_STREAK && level < MAX_LEVEL) {
            return new Step(StepOutcome.UP,
                    new AssessmentState(level + 1, 0, 0, answered, answers, wrongTotal),
                    "连对 " + UP_STREAK + " → 升至档 " + (level + 1));
        }
        // 降档：档内错 2
        if (!correct && wrongInLevel >= DOWN_WRONG && level > MIN_LEVEL) {
            return new Step(StepOutcome.DOWN,
                    new AssessmentState(level - 1, 0, 0, answered, answers, wrongTotal),
                    "错 " + DOWN_WRONG + " → 降至档 " + (level - 1));
        }
        return new Step(StepOutcome.KEEP,
                new AssessmentState(level, cons, wrongInLevel, answered, answers, wrongTotal),
                null);
    }

    /** 终止状态 → 定级报告。 */
    public static Report report(AssessmentState s, int questionCap) {
        int answered = s.answered();
        Double acc = answered == 0 ? null : 100.0 * (answered - s.wrongTotal()) / answered;
        return new Report(s.level(), answered, s.wrongTotal(), acc,
                s.level() >= MAX_LEVEL, answered >= questionCap);
    }

    /** 中断续答：反序列化（服务端存档 → 恢复同一状态继续）。 */
    public static AssessmentState resume(AssessmentState stored) {
        if (stored == null) {
            return AssessmentState.initial(START_LEVEL);
        }
        return stored.serializeableCopy();
    }

    /** 维度得分率聚合（dims 映射输入：dim → [answered, correct]）。 */
    public static List<DimRate> dimRates(java.util.Map<String, int[]> dims) {
        List<DimRate> out = new ArrayList<>();
        if (dims == null) {
            return out;
        }
        dims.keySet().stream().sorted().forEach(k -> {
            int[] v = dims.get(k);
            int a = v == null || v.length < 1 ? 0 : v[0];
            int c = v == null || v.length < 2 ? 0 : v[1];
            out.add(new DimRate(k, a, c));
        });
        return out;
    }

    /** 定级 → 报告的推荐起点展示（L?，20 §10：入学定级只依据测评覆盖领域）。 */
    public static String levelLabel(int level) {
        return "L" + Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
    }
}
