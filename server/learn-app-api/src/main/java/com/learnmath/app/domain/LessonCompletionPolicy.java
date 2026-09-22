package com.learnmath.app.domain;

/**
 * 课时完成策略（20 §2 BR-02 / DR-02；纯函数）。
 *
 * read_completed = 用户主动确认读完（不把滚动/视频时长等同理解）。
 * lesson_completed 控制 P1 进度与下一课；practice_passed 表示达标 —— 三态分离。
 *
 * 矩阵（20 §2）：
 *  未确认读 → 任意          ：否 / 不解锁 / 0
 *  已确认+practice_required+未答或<80% ：否 / 0（"阅读已记录，完成随堂练后继续"）
 *  已确认+practice_required+客观全答且≥80% ：是 / 解锁 / 首次+10
 *  已确认+read_only        ：是 / 解锁 / 首次+10（不代表掌握）
 *  已完成再请求            ：原结果 / 不重复 / 0（幂等）
 */
public final class LessonCompletionPolicy {

    public enum PolicyType { PRACTICE_REQUIRED, READ_ONLY }

    public enum Reason {
        NOT_READ_CONFIRMED,
        PRACTICE_PENDING,   // 阅读已记录，随堂未达标
        COMPLETED_PRACTICE,
        COMPLETED_READ_ONLY,
        ALREADY_COMPLETED
    }

    /** 输入：阅读确认、策略、客观题统计（自评/解答不进这里 —— BR-02 解答自评不充当门槛）。 */
    public record Input(boolean readConfirmed, PolicyType policy,
                        int objectiveTotal, int objectiveAnswered,
                        double correctRate,   // 0..100；无已答 → 传 -1
                        boolean alreadyCompleted) {}

    public record Decision(boolean completed, boolean unlocksNext, int reward,
                           Reason reason, String message) {

        public static final int FIRST_COMPLETION_REWARD = 10;
    }

    private static final double PASS_RATE = 80d;

    private LessonCompletionPolicy() {
    }

    /** 发布校验：practice_required 但无客观题 → 拒绝发布（无客观题不允许"分母为 0"得 100%）。 */
    public static String publishBlocker(PolicyType policy, int objectiveTotal) {
        if (policy == PolicyType.PRACTICE_REQUIRED && objectiveTotal <= 0) {
            return "无客观题的课时不能设 practice_required（BR-02：请改 read_only）";
        }
        return null;
    }

    public static Decision decide(Input in) {
        // 5) 幂等：已完成再请求 → 原结果，不重复奖励/解锁
        if (in.alreadyCompleted()) {
            return new Decision(true, true, 0, Reason.ALREADY_COMPLETED, "已完成（幂等返回原结果）");
        }
        // 1) 未确认读 → 否
        if (!in.readConfirmed()) {
            return new Decision(false, false, 0, Reason.NOT_READ_CONFIRMED,
                    "请先确认已读完本课时（read_completed）");
        }
        // 4) read_only：读完即完成（不代表掌握）
        if (in.policy() == PolicyType.READ_ONLY) {
            return new Decision(true, true, Decision.FIRST_COMPLETION_REWARD,
                    Reason.COMPLETED_READ_ONLY, "阅读完成（read_only 策略；不代表掌握）");
        }
        // PRACTICE_REQUIRED：防御（发布已拦；运行态再兜一层）
        if (in.objectiveTotal() <= 0) {
            throw new IllegalStateException("practice_required 课时不允许无客观题（发布校验被绕过）");
        }
        // 2) 未答齐 或 正确率 < 80 → 进行中
        boolean allAnswered = in.objectiveAnswered() >= in.objectiveTotal();
        boolean rateOk = in.correctRate() >= PASS_RATE;
        if (!allAnswered || !rateOk) {
            return new Decision(false, false, 0, Reason.PRACTICE_PENDING,
                    "阅读已记录，完成随堂练后继续（" + in.objectiveAnswered() + "/" + in.objectiveTotal()
                            + "，正确率 " + Math.max(0, (int) in.correctRate()) + "% < 80%）");
        }
        // 3) 达标
        return new Decision(true, true, Decision.FIRST_COMPLETION_REWARD,
                Reason.COMPLETED_PRACTICE, "课时完成（随堂练达标）");
    }

    /** 边界：80.0 通过 / 79.9 不通过（20 §2）。 */
    public static boolean ratePassed(double rate) {
        return rate >= PASS_RATE;
    }
}
