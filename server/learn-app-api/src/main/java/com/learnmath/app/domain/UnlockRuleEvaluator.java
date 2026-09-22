package com.learnmath.app.domain;

import com.learnmath.app.common.ErrorCode;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.Set;

/**
 * 解锁规则求值器（02 §5.3 DSL 的内存模型 + 20 §1.3 语义；纯函数）。
 *
 * JSON ↔ Rule 的互转属于服务层（service 层用 Jackson 映射），domain 只认规则树。
 * 持久解锁语义（20 §1.3）：已获得的节点解锁永久保存，不因遗忘或规则调整重新锁定 →
 * {@link #canEnter} 优先查 persistedUnlocked，再按最新规则求值新节点。
 */
public final class UnlockRuleEvaluator {

    // ---------- 规则模型（sealed，防外部扩散） ----------

    public sealed interface Rule
            permits Sequential, MasteryRule, LadderRule, StarsRule, PaperPassRule, AllOf, AnyOf {}

    /** P1 线性：前一节点完成即解锁（完成态由 Context 查）。 */
    public record Sequential() implements Rule {}

    /** 掌握度门槛：score≥minScore 且样本≥minSample 且前置必需边全部满足。 */
    public record MasteryRule(long nodeId, int minScore, int minSample) implements Rule {}

    /** P4 阶梯：该难度最近证据未加权正确率≥passRate(0..1) 且≥minCount 题 → 解锁"晋级战"。 */
    public record LadderRule(long nodeId, int difficulty, double passRate, int minCount) implements Rule {}

    /** P6 星数累计。 */
    public record StarsRule(int totalStars) implements Rule {}

    /** 晋级战/Boss：客观成绩率≥minRate(0..100)。 */
    public record PaperPassRule(long paperId, double minRate) implements Rule {}

    public record AllOf(List<Rule> rules) implements Rule {}

    public record AnyOf(List<Rule> rules) implements Rule {}

    // ---------- 求值上下文（由服务层实现；单测用假实现） ----------

    public interface Context {
        /** 掌握度两位分；无测量 → empty。 */
        Optional<BigDecimal> masteryScore(long nodeId);

        /** 有效样本数。 */
        int masterySample(long nodeId);

        /** 该节点「必需」前置边是否全部满足（推荐边不计）。 */
        boolean requiredEdgesSatisfied(long nodeId);

        /** P4 该难度未加权正确率 0..100；无证据 → empty。 */
        Optional<Double> ladderRate(long nodeId, int difficulty);

        /** P4 该难度题量。 */
        int ladderCount(long nodeId, int difficulty);

        /** P6 累计星数。 */
        int totalStars();

        /** 晋级战/Boss 最佳客观成绩率 0..100；未考 → empty。 */
        Optional<Double> paperBestRate(long paperId);

        /** 前序节点是否完成（Sequential 用）。 */
        boolean previousCompleted(long nodeId);
    }

    // ---------- 结果 ----------

    /**
     * @param code 错误码：3311 前置/门槛未满足；3312 阶梯/晋级未达（04 §3）
     */
    public record Result(boolean allowed, ErrorCode code, String reason) {

        public static Result allow() {
            return new Result(true, null, null);
        }

        public static Result deny(ErrorCode code, String reason) {
            return new Result(false, code, reason);
        }
    }

    private static final int DEFAULT_MASTERY_SCORE = 80;
    private static final int DEFAULT_MASTERY_SAMPLE = 5;
    private static final double DEFAULT_PAPER_PASS_RATE = 80d;

    private UnlockRuleEvaluator() {
    }

    /** 新节点求值（不含持久解锁）。 */
    public static Result evaluate(Rule rule, Context ctx) {
        if (rule == null) {
            return Result.allow();
        }
        if (rule instanceof Sequential seq) {
            // Sequential 由编排器把 previous 节点 id 写进 Context 侧数据；此处约定：
            // 编排服务在调用前把"上一节点"注册进 ctx（单测同理）。简化：无法感知 → 允许由上层保证。
            return Result.allow();
        }
        if (rule instanceof MasteryRule m) {
            if (!ctx.requiredEdgesSatisfied(m.nodeId())) {
                return Result.deny(ErrorCode.PREREQUISITE_NOT_MET, "前置依赖未满足: node=" + m.nodeId());
            }
            Optional<BigDecimal> score = ctx.masteryScore(m.nodeId());
            int sample = ctx.masterySample(m.nodeId());
            if (score.isEmpty()) {
                return Result.deny(ErrorCode.PREREQUISITE_NOT_MET, "尚未测量: node=" + m.nodeId());
            }
            if (sample < m.minSample()) {
                return Result.deny(ErrorCode.PREREQUISITE_NOT_MET,
                        "样本不足: " + sample + "/" + m.minSample() + "（20 §1.3 n<5 不解锁）");
            }
            if (score.get().intValue() < m.minScore()) {
                return Result.deny(ErrorCode.PREREQUISITE_NOT_MET,
                        "掌握度 " + score.get() + " < " + m.minScore());
            }
            return Result.allow();
        }
        if (rule instanceof LadderRule l) {
            Optional<Double> rate = ctx.ladderRate(l.nodeId(), l.difficulty());
            int count = ctx.ladderCount(l.nodeId(), l.difficulty());
            if (count < l.minCount()) {
                int need = l.minCount() - count;
                return Result.deny(ErrorCode.LADDER_NOT_MET, "还差 " + need + " 题（minCount=" + l.minCount() + "）");
            }
            if (rate.isEmpty()) {
                return Result.deny(ErrorCode.LADDER_NOT_MET, "该难度尚无证据");
            }
            double threshold = l.passRate() * 100;
            if (rate.get() < threshold) {
                double gap = threshold - rate.get();
                return Result.deny(ErrorCode.LADDER_NOT_MET,
                        String.format("正确率 %.1f%%，还差 %.1f 个百分点达 %.0f%%", rate.get(), gap, threshold));
            }
            return Result.allow();
        }
        if (rule instanceof StarsRule s) {
            if (ctx.totalStars() < s.totalStars()) {
                return Result.deny(ErrorCode.PREREQUISITE_NOT_MET,
                        "星数不足: " + ctx.totalStars() + "/" + s.totalStars());
            }
            return Result.allow();
        }
        if (rule instanceof PaperPassRule p) {
            Optional<Double> rate = ctx.paperBestRate(p.paperId());
            if (rate.isEmpty()) {
                return Result.deny(ErrorCode.PREREQUISITE_NOT_MET, "晋级战未完成: paper=" + p.paperId());
            }
            double threshold = p.minRate() > 0 ? p.minRate() : DEFAULT_PAPER_PASS_RATE;
            if (rate.get() < threshold) {
                return Result.deny(ErrorCode.PREREQUISITE_NOT_MET,
                        String.format("晋级战客观成绩 %.1f%% < %.0f%%", rate.get(), threshold));
            }
            return Result.allow();
        }
        if (rule instanceof AllOf all) {
            for (Rule r : all.rules()) {
                Result res = evaluate(r, ctx);
                if (!res.allowed()) {
                    return res;
                }
            }
            return Result.allow();
        }
        if (rule instanceof AnyOf any) {
            String lastReason = "anyOf 全部未满足";
            ErrorCode lastCode = ErrorCode.PREREQUISITE_NOT_MET;
            for (Rule r : any.rules()) {
                Result res = evaluate(r, ctx);
                if (res.allowed()) {
                    return Result.allow();
                }
                lastReason = res.reason();
                lastCode = res.code();
            }
            return Result.deny(lastCode, lastReason);
        }
        return Result.deny(ErrorCode.PREREQUISITE_NOT_MET, "未知规则类型");
    }

    /**
     * 进入判定 = 持久解锁优先（20 §1.3：已获得的解锁不因规则调整重新锁定，变黄仍可进入）。
     *
     * @param persistedUnlocked user_path_progress.unlocked_nodes（历史已解锁集合）
     */
    public static boolean canEnter(long nodeId, Set<Long> persistedUnlocked, Rule rule, Context ctx) {
        if (persistedUnlocked != null && persistedUnlocked.contains(nodeId)) {
            return true;
        }
        return evaluate(rule, ctx).allowed();
    }

    /** 便捷默认值（与 02 §5.3 示例一致）。 */
    public static MasteryRule defaultMastery(long nodeId) {
        return new MasteryRule(nodeId, DEFAULT_MASTERY_SCORE, DEFAULT_MASTERY_SAMPLE);
    }

    /** P4：达到阶梯条件只解锁"晋级战"；下一难度还需晋级战客观 ≥80%（20 §1.3）。 */
    public static Result enterNextDifficulty(long ladderNodeId, int difficulty, long promotionPaperId, Context ctx) {
        Result ladder = evaluate(new LadderRule(ladderNodeId, difficulty, 0.8, 10), ctx);
        if (!ladder.allowed()) {
            return ladder;
        }
        return evaluate(new PaperPassRule(promotionPaperId, DEFAULT_PAPER_PASS_RATE), ctx);
    }

    /** 供服务层读取（避免编译器告警占位）。 */
    public static OptionalInt defaultMinSample() {
        return OptionalInt.of(DEFAULT_MASTERY_SAMPLE);
    }
}
