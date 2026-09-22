package com.learnmath.app.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

/**
 * 作答生命周期（20 §4 BR-04 + §7 BR-07 / DR-04 · DR-07；纯函数）。
 *
 * 状态机：IN_PROGRESS → SUBMITTED → PENDING_SELF_ASSESS → FINALIZED
 *   无解答题：SUBMITTED 直接 FINALIZED；submitted 是可恢复的判分中状态；
 *   任务失败重试只产生一次领域事件（settle-once）；到期与人工交卷走同一状态机。
 * 成绩拆分：objectiveEarned/objectivePossible/objectiveRate 与 selfAssessment 分离；
 *   纯解答卷 rate=null 显示"本卷无客观成绩"，禁止 0 分/满分（BR-04）。
 * 时间：deadlineAt = min(startedAt+duration, challengeEndAt)，无时限=null；
 *   有效提交 = serverNow **严格小于** deadlineAt（等于即过期，BR-07）。
 * 草稿：以服务端为准，requestId 幂等重放、answerRevision 冲突回执、到期草稿拒绝。
 */
public final class AttemptLifecycle {

    public enum Status { IN_PROGRESS, SUBMITTED, PENDING_SELF_ASSESS, FINALIZED }

    /** 自评值与参考分（BR-04：unrated|cannot|partial|can|skipped → null/0/0.5/1/null）。 */
    public enum SelfValue {
        UNRATED(null), CANNOT(0d), PARTIAL(0.5d), CAN(1d), SKIPPED(null);

        private final Double ref;

        SelfValue(Double ref) {
            this.ref = ref;
        }

        public Double reference() {
            return ref;
        }

        public boolean countsAsAssessed() {
            return this != UNRATED;
        }
    }

    /** 状态推进回执。 */
    public record Transition(boolean allowed, Status next, String reason) {

        private static Transition to(Status s) {
            return new Transition(true, s, null);
        }

        private static Transition deny(String why) {
            return new Transition(false, null, why);
        }
    }

    /** 客观成绩（rate 仅由客观题构成；possible=0 → null）。 */
    public record Score(int objectiveEarned, int objectivePossible) {

        public Double rate() {
            if (objectivePossible <= 0) {
                return null;
            }
            return 100.0 * objectiveEarned / objectivePossible;
        }

        public boolean pureEssay() {
            return objectivePossible == 0;
        }

        public String rateDisplay() {
            Double r = rate();
            return r == null ? "本卷无客观成绩" : String.format("%.1f%%", r);
        }
    }

    /**
     * 结算台账：客观判分/错题入本/掌握度证据/奖励事件**只结算一次**（BR-04：
     * "掌握度/客观成绩及客观作答事件只结算一次"；BR-07：pending effects 与数据同事务、
     * 重试按 answerId/attemptId 去重 —— 域内以布尔台账表达，持久化在服务层）。
     */
    public static final class SettlementLedger {
        private boolean objectiveSettled;

        /** @return true=本次首次结算（应发事件）；false=重试/重复（不得重放）。 */
        public boolean trySettleObjective() {
            if (objectiveSettled) {
                return false;
            }
            objectiveSettled = true;
            return true;
        }

        public boolean settled() {
            return objectiveSettled;
        }
    }

    /** 草稿保存回执（BR-07：requestId 幂等、revision 冲突两份确认、到期拒绝）。 */
    public record DraftSave(boolean accepted, boolean replayed, boolean revisionConflict,
                            int currentRevision, String reason) {}

    private AttemptLifecycle() {
    }

    // ---------- 状态机 ----------

    /** 交卷（人工/到期任务共用同一入口）。 */
    public static Transition submit(Status current, boolean hasEssayQuestions) {
        if (current != Status.IN_PROGRESS) {
            return Transition.deny("仅进行中的作答可交卷（当前 " + current + "）");
        }
        return hasEssayQuestions
                ? Transition.to(Status.PENDING_SELF_ASSESS)
                : Transition.to(Status.FINALIZED);
    }

    /**
     * 自评推进：全部解答题已选（含 skipped）才可 finalized。
     * 未评（UNRATED）阻塞；pending 不阻塞客观部分（BR-04）。
     */
    public static Transition tryFinalize(Status current, Map<Long, SelfValue> essayAnswers, long essayQuestionCount) {
        if (current == Status.FINALIZED) {
            return Transition.deny("已 finalized；改评走 revision 更新，不重放结算");
        }
        if (current == Status.SUBMITTED) {
            // 无解答题路径已在 submit 直达 FINALIZED；走到这里说明状态推进顺序异常
            return Transition.deny("缺少中间态（SUBMITTED 不直接 finalize，应经自评态）");
        }
        if (current != Status.PENDING_SELF_ASSESS) {
            return Transition.deny("未交卷不能进入 finalized");
        }
        if (essayAnswers == null || essayAnswers.size() < essayQuestionCount) {
            return Transition.deny("尚有解答题未作答");
        }
        if (!allSelfAssessed(essayAnswers)) {
            return Transition.deny("尚有解答题未自评（unrated 不算已选，skipped 算）");
        }
        return Transition.to(Status.FINALIZED);
    }

    /** 全部解答题均已选（cannot/partial/can/skipped 均算已选）。 */
    public static boolean allSelfAssessed(Map<Long, SelfValue> answers) {
        if (answers == null || answers.isEmpty()) {
            return false;
        }
        for (SelfValue v : answers.values()) {
            if (v == null || !v.countsAsAssessed()) {
                return false;
            }
        }
        return true;
    }

    // ---------- 时间（BR-07） ----------

    public static Instant deadlineAt(Instant startedAt, Duration duration, Instant challengeEndAt) {
        if (duration == null || startedAt == null) {
            return challengeEndAt; // 无时限练习且无赛事截止 → null
        }
        Instant byDuration = startedAt.plus(duration);
        if (challengeEndAt == null) {
            return byDuration;
        }
        return byDuration.isBefore(challengeEndAt) ? byDuration : challengeEndAt;
    }

    /** 有效提交判定：serverNow **严格小于** deadline（等于即过期）。null deadline=无时限恒有效。 */
    public static boolean withinDeadline(Instant deadlineAt, Instant serverNow) {
        if (deadlineAt == null) {
            return true;
        }
        return serverNow.isBefore(deadlineAt);
    }

    // ---------- 草稿（BR-07） ----------

    /**
     * 服务端草稿保存。
     *
     * @param replayedIds  本 attempt 已处理过的 requestId 集合（服务层持久化，重放返回原回执）
     * @param requestId    本次请求幂等键
     * @param clientRevision 客户端持有的 answerRevision
     * @param serverRevision 当前服务端 revision
     * @param deadlineAt   截止（null=无时限）；serverNow 晚于等于截止 → 拒绝
     */
    public static DraftSave saveDraft(Set<String> replayedIds, String requestId,
                                      int clientRevision, int serverRevision,
                                      Instant deadlineAt, Instant serverNow) {
        if (replayedIds != null && requestId != null && replayedIds.contains(requestId)) {
            // 重复 requestId → 返回原回执（不覆盖）
            return new DraftSave(true, true, false, serverRevision, "重复 requestId，返回原回执");
        }
        if (!withinDeadline(deadlineAt, serverNow)) {
            return new DraftSave(false, false, false, serverRevision, "已到期，草稿被拒（不信客户端作答时间）");
        }
        if (clientRevision != serverRevision) {
            // 冲突：显示两份答案让用户确认，不静默覆盖（BR-07）
            return new DraftSave(false, false, true, serverRevision, "revision 冲突：两份答案待确认");
        }
        return new DraftSave(true, false, false, serverRevision + 1, "accepted");
    }

    /** 自评改评（finalized 后）：只更新自评证据 → 新报告版本；不重放积分/客观错题/成就/榜。 */
    public static boolean selfRevisionAllowed(Status current) {
        return current == Status.PENDING_SELF_ASSESS || current == Status.FINALIZED;
    }

    /** 开卷卷不进竞技/晋级/掌握度（BR-03 用途矩阵）。 */
    public static boolean countsForCompetitive(boolean openBook) {
        return !openBook;
    }

    /** 引用保留：任何辅助判定都不得由"历史做过同题"放宽（BR-03 快照优先，服务层守）。 */
    public static boolean snapshotGatesAccess(Status activeAttemptStatus) {
        return activeAttemptStatus == Status.IN_PROGRESS;
    }
}
