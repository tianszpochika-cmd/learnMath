package com.learnmath.app.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * 掌握度计算器 —— 20 §1.2「唯一计算公式」的唯一实现（BR-01 / DR-01）。
 *
 * 规则要点（20 §1）：
 *  - 输入为「已筛选合格的证据」按时间旧→新；筛选（同族 7×24h 首条、assisted/曝光排除）
 *    属于写路径（B-14 作答域），本类只做计算，不重复过滤。
 *  - correct ∈ {0,1}；n=0 → score=null（尚未测量）；1≤n<5 → 可算参考分但 insufficientSample（不解锁）。
 *  - 衰减按完整天数 UTC 计算，每次从原始证据重算，不叠加（同日重复计算结果一致）。
 *  - roundHalfUp 两位小数；门槛比较使用同一份两位 score，前端不二次计算。
 *  - 纯函数，禁止 Spring 依赖。
 */
public final class MasteryCalculator {

    /** 单条合格证据（客观判分后的）。 */
    public record Evidence(boolean correct, int difficulty, Instant eligibleAt) {}

    /** 计算结果：score=null 表示尚未测量。 */
    public record MasteryScore(
            BigDecimal score,          // 两位小数；n=0 时 null
            int sampleCount,
            boolean insufficientSample, // 1≤n<5
            BigDecimal baseScore,       // 衰减前（审计/展示）
            int decayDays,              // 已计衰减的整天数（>14 部分生效）
            Instant lastEligibleAt) {

        public boolean measurable() {
            return score != null;
        }
    }

    /** 图谱节点着色（20 §1.1 优先级）。 */
    public enum GraphColor {
        PREPARING,   // 内容筹备独立标记
        LOCKED,      // 前置锁定（红锁）
        NO_DATA,     // 无证据（灰）
        SAMPLE_LOW,  // 样本不足（灰，参考分不参与解锁）
        YELLOW,      // 有足够样本且 score<80（0–79.99）
        GREEN        // score≥80
    }

    private static final int HALF_LIFE_DAYS = 14;
    private static final double DECAY_PER_DAY = 1.5;
    private static final int MIN_SAMPLE = 5;
    private static final BigDecimal UNLOCK_THRESHOLD = new BigDecimal("80");

    private MasteryCalculator() {
    }

    /**
     * @param eligibleOldToNew 合格证据，时间旧 → 新
     * @param asOf             计算时刻（UTC Instant；页面展示时区由上层处理）
     */
    public static MasteryScore compute(List<Evidence> eligibleOldToNew, Instant asOf) {
        int n = eligibleOldToNew == null ? 0 : eligibleOldToNew.size();
        if (n == 0) {
            return new MasteryScore(null, 0, false, null, 0, null);
        }

        double sumW = 0, sumWCorrect = 0, sumWDiff = 0;
        int i = 0;
        for (Evidence e : eligibleOldToNew) {
            i++;
            if (e.difficulty() < 1 || e.difficulty() > 5) {
                throw new IllegalArgumentException("difficulty must be in [1,5]: " + e.difficulty());
            }
            double w = Math.pow(2.0, (i - n) / (double) n); // i=1..n（旧→新），w=2^((i-n)/n)
            sumW += w;
            sumWCorrect += w * (e.correct() ? 1 : 0);
            sumWDiff += w * e.difficulty();
        }

        double base = sumWCorrect / sumW;                     // 0..1
        double avgDifficulty = sumWDiff / sumW;               // 1..5
        double factor = 1 + 0.05 * (avgDifficulty - 3);       // 0.90..1.10
        double baseScoreRaw = clamp(100 * base * factor, 0, 100);

        Instant lastEligibleAt = eligibleOldToNew.get(n - 1).eligibleAt();
        long days = lastEligibleAt == null || asOf == null
                ? 0
                : Duration.between(lastEligibleAt, asOf).toDays(); // 完整天数（floor）
        double decay = Math.max(0, days - HALF_LIFE_DAYS) * DECAY_PER_DAY;

        double finalRaw = clamp(baseScoreRaw - decay, 0, 100);
        BigDecimal score = round2(finalRaw);
        BigDecimal baseScore = round2(baseScoreRaw);

        return new MasteryScore(score, n, n < MIN_SAMPLE, baseScore, (int) Math.max(0, days - HALF_LIFE_DAYS), lastEligibleAt);
    }

    /** 新解锁判定（20 §1.3）：score≥80 且有效样本≥5 —— 前置边求值在 UnlockRuleEvaluator。 */
    public static boolean unlockable(MasteryScore s) {
        return s != null && s.score() != null
                && s.sampleCount() >= MIN_SAMPLE
                && s.score().compareTo(UNLOCK_THRESHOLD) >= 0;
    }

    /**
     * 图谱着色（20 §1.1 优先级：筹备 > 锁定 > 无数据/样本不足 > 分数档）。
     * 注意：已获得的解锁不在此处判定（持久 unlocked_nodes 由求值器处理，变黄仍可进入）。
     */
    public static GraphColor colorOf(boolean contentPreparing, boolean prerequisiteLocked, MasteryScore s) {
        if (contentPreparing) {
            return GraphColor.PREPARING;
        }
        if (prerequisiteLocked) {
            return GraphColor.LOCKED;
        }
        if (s == null || s.score() == null) {
            return GraphColor.NO_DATA;
        }
        if (s.insufficientSample()) {
            return GraphColor.SAMPLE_LOW;
        }
        return s.score().compareTo(UNLOCK_THRESHOLD) >= 0 ? GraphColor.GREEN : GraphColor.YELLOW;
    }

    private static double clamp(double v, double lo, double hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    static BigDecimal round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}
