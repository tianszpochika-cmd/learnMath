package com.learnmath.app.domain;

import java.time.LocalDate;

/**
 * 间隔重复规划（10 §5.5 简化 SM-2 + 20 §1.3/§4.3 复习规则；纯函数）。
 *
 * 规则：
 *  - 答对：EF' = max(1.3, EF + 0.1)；间隔序列 1d → 3d → 7d → round(上次间隔 × EF)。
 *  - 答错：间隔重置 1d、EF − 0.2（下限 1.3）、连续正确天数清零、进入错题重练。
 *  - 「连续两次正确」要求分属不同自然日的**到期**重练，且 assisted（使用帮助）不计（20 §1.3）。
 *  - 手动"我已掌握"只改错题整理状态，不进入本规划（不在本类职责）。
 */
public final class SrsPlanner {

    public enum Outcome { CORRECT, WRONG }

    /** 状态：EF、间隔档位索引、连续不同自然日正确次数。 */
    public record State(double easeFactor, int intervalIndex, int consecutiveCorrectDays) {

        public static State initial() {
            return new State(2.3, 0, 0);
        }
    }

    /** 规划结果；counted=false 表示本次不计入连续（未到期/同日/assisted），状态不变。 */
    public record Plan(State state, int intervalDays, LocalDate nextDue, boolean counted) {

        public static Plan unchanged(State s, LocalDate due) {
            return new Plan(s, s.intervalIndex >= 3 ? -1 : -1, due, false);
        }
    }

    private static final double EF_FLOOR = 1.3;
    private static final double EF初始 = 2.3;

    public SrsPlanner() {
    }

    /** 是否为"合格的连续计数"作答：必须到期、不同自然日、未使用帮助（20 §1.3）。 */
    public static boolean eligibleForConsecutive(State state, LocalDate dueDate, LocalDate assessedOn, boolean assisted) {
        if (assisted) {
            return false;
        }
        if (dueDate == null || assessedOn.isBefore(dueDate)) {
            return false; // 未到期的提前重做不计连对
        }
        // 连续要求"分属不同自然日"：由调用方保证上一次正确日 < assessedOn；
        // 这里以 dueDate==assessedOn 的到期重练为准（到期日与作答日同一天也合格，
        // 与上一次的"不同自然日"由 consecutive 记录的 lastCorrectOn 校验——上层传入时判断）。
        return true;
    }

    /**
     * 生成复习计划。
     *
     * @param dueDate  当前到期日（可为过去）；assessedOn &lt; dueDate 视为提前重做
     * @param assisted 是否使用帮助（AI/深钻/看解析跟练）→ 不计任何状态推进
     */
    public Plan plan(State state, Outcome outcome, LocalDate dueDate, LocalDate assessedOn,
                     boolean assisted, LocalDate lastCorrectOn) {
        if (assisted) {
            return new Plan(state, -1, dueDate, false);
        }
        if (dueDate == null || assessedOn.isBefore(dueDate)) {
            return new Plan(state, -1, dueDate, false); // 未到期：练习可以，但不推进 SRS
        }
        if (outcome == Outcome.WRONG) {
            double ef = Math.max(EF_FLOOR, state.easeFactor() - 0.2);
            State next = new State(ef, 0, 0);
            return new Plan(next, 1, assessedOn.plusDays(1), true);
        }
        // CORRECT
        if (lastCorrectOn != null && lastCorrectOn.equals(assessedOn)) {
            // 同一自然日重复正确不增加"连续不同自然日"计数
            State same = new State(state.easeFactor(), state.intervalIndex(), state.consecutiveCorrectDays());
            return new Plan(same, intervalOf(state), dueDate.plusDays(intervalOf(state)), false);
        }
        double ef = Math.min(3.0, Math.max(EF_FLOOR, state.easeFactor() + 0.1));
        int idx = state.intervalIndex();
        int interval = intervalFor(idx, state.easeFactor());
        State next = new State(ef, idx + 1, state.consecutiveCorrectDays() + 1);
        return new Plan(next, interval, assessedOn.plusDays(interval), true);
    }

    /** 间隔序列：档 0/1/2 → 1/3/7；档 ≥3 → round(7 × EF^(idx-2))。 */
    static int intervalFor(int intervalIndex, double ef) {
        switch (intervalIndex) {
            case 0: return 1;
            case 1: return 3;
            case 2: return 7;
            default:
                double v = 7 * Math.pow(ef, intervalIndex - 2);
                return Math.max(7, (int) Math.round(v));
        }
    }

    private static int intervalOf(State state) {
        return intervalFor(state.intervalIndex(), state.easeFactor());
    }

    public static double initialEaseFactor() {
        return EF初始;
    }

    /** "连对 2 次"达成判定（不同自然日、非 assisted 的合格作答计数）。 */
    public static boolean consecutiveMastered(State state) {
        return state.consecutiveCorrectDays() >= 2;
    }
}
