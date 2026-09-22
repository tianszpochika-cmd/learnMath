package com.learnmath.app.domain;

/**
 * 积分规则（02 §5.7 定价与风控默认值 · 纯函数；全部数值可由 config 覆盖，
 * 此处提供设计文档的默认 {@link Pricing#defaults()}）。
 */
public final class PointsRules {

    /** 定价表（02 §5.7）。 */
    public record Pricing(
            int questionCorrectEach,        // 每题判对 +N
            int questionCorrectDailyCap,    // 做题类日上限
            int checkin,                    // 每日打卡
            int checkinStreak7Bonus,        // 连 7 天额外
            int makeupCost,                 // 补签消耗
            int aiChatCost,                 // AI 对话单价
            int aiChatFreePerDay,           // 每日前 N 次免费
            int aiQuizCost,                 // AI 出题
            int aiExplainCost,              // AI 讲解
            int dailyGlobalEarnCap,         // 单用户单日获取上限（防通胀）
            int balanceFloor                // 余额下限（管理员调整除外）
    ) {

        public static Pricing defaults() {
            return new Pricing(
                    1, 50,
                    5, 20,
                    20,
                    5, 3,
                    10, 5,
                    200,
                    0);
        }
    }

    private PointsRules() {
    }

    /** AI 对话消耗：每日前 N 次免费，其后按单价（3101 由余额检查在服务层给）。 */
    public static int aiChatCost(Pricing p, int usedToday) {
        return usedToday < p.aiChatFreePerDay() ? 0 : p.aiChatCost();
    }

    /** 做题奖励：单题 +N，受做题日上限与全局日上限双重封顶。 */
    public static int questionReward(Pricing p, int correctCount, int earnedTodayIncludingOthers) {
        if (correctCount <= 0) {
            return 0;
        }
        int raw = correctCount * p.questionCorrectEach();
        int roomByQuestionCap = Math.max(0, p.questionCorrectDailyCap() - Math.min(earnedTodayIncludingOthers, p.questionCorrectDailyCap()));
        int roomByGlobalCap = Math.max(0, p.dailyGlobalEarnCap() - earnedTodayIncludingOthers);
        return Math.min(raw, Math.min(roomByQuestionCap, roomByGlobalCap));
    }

    /** 扣减（消耗类不参与"日获取上限"）。 */
    public static int spend(Pricing p, int balance, int amount) {
        if (amount <= 0) {
            return balance;
        }
        return Math.max(p.balanceFloor(), balance - amount);
    }

    /**
     * 增加（收益类统一入口）：受全局日上限约束。
     * @return 实际入账（可能被截断为 0）
     */
    public static int earn(Pricing p, int balance, int amount, int earnedToday) {
        if (amount <= 0) {
            return balance;
        }
        int room = Math.max(0, p.dailyGlobalEarnCap() - earnedToday);
        return balance + Math.min(amount, room);
    }

    /** 余额计算：普通操作不允许低于下限；管理员调整豁免（02 §5.7）。 */
    public static int applyDelta(int balance, int delta, boolean adminAdjust) {
        int next = balance + delta;
        if (adminAdjust) {
            return next; // 管理员调整允许负值（审计必录）
        }
        return Math.max(0, next);
    }

    /** 补签：余额不足返回 false（3502）。 */
    public static boolean canAffordMakeup(int balance, Pricing p) {
        return balance >= p.makeupCost();
    }
}
