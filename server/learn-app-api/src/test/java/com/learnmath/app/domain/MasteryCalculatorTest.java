package com.learnmath.app.domain;

import com.learnmath.app.domain.MasteryCalculator.Evidence;
import com.learnmath.app.domain.MasteryCalculator.GraphColor;
import com.learnmath.app.domain.MasteryCalculator.MasteryScore;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 掌握度 —— 20 §1「BR-01 唯一计算公式」样例逐条落地（DR-01 DoD）。
 */
class MasteryCalculatorTest {

    private static final Instant T0 = Instant.parse("2026-09-01T00:00:00Z");

    private static List<Evidence> days(int n, boolean correct, int difficulty) {
        // n 条证据，间隔 1 小时，最后一条 = T0
        return java.util.stream.IntStream.rangeClosed(1, n)
                .mapToObj(i -> new Evidence(correct, difficulty, T0.minus(Duration.ofHours(n - i))))
                .toList();
    }

    private static List<Evidence> withLast(List<Evidence> base, Instant last) {
        java.util.ArrayList<Evidence> list = new java.util.ArrayList<>(base);
        Evidence oldLast = list.remove(list.size() - 1);
        list.add(new Evidence(oldLast.correct(), oldLast.difficulty(), last));
        return list;
    }

    @Test
    void noEvidence_scoreNull() {
        MasteryScore s = MasteryCalculator.compute(Collections.emptyList(), T0);
        assertNull(s.score());          // "尚未测量"
        assertEquals(0, s.sampleCount());
        assertEquals(GraphColor.NO_DATA, MasteryCalculator.colorOf(false, false, s));
    }

    @Test
    void sampleSpec_fiveL3AllCorrect_day0_is100_unlockable() {
        // 20 §1.3：5 道不同族 L3 全对，日 0 → 100；可获得 mastery 解锁
        MasteryScore s = MasteryCalculator.compute(days(5, true, 3), T0);
        assertEquals(new BigDecimal("100.00"), s.score());
        assertFalse(s.insufficientSample());
        assertTrue(MasteryCalculator.unlockable(s));
        assertEquals(GraphColor.GREEN, MasteryCalculator.colorOf(false, false, s));
    }

    @Test
    void fiveL1AllCorrect_is90() {
        // 20：5 道 L1 全对 → 90（factor = 1+0.05*(1-3) = 0.9）
        MasteryScore s = MasteryCalculator.compute(days(5, true, 1), T0);
        assertEquals(new BigDecimal("90.00"), s.score());
    }

    @Test
    void fiveL3AllWrong_is0_yellowButNotUnlockable() {
        MasteryScore s = MasteryCalculator.compute(days(5, false, 3), T0);
        assertEquals(new BigDecimal("0.00"), s.score());
        assertFalse(MasteryCalculator.unlockable(s));
        assertEquals(GraphColor.YELLOW, MasteryCalculator.colorOf(false, false, s));
    }

    @Test
    void selfAssessmentOnly_noEvidence_null() {
        // 20：无有效题、只有自评"半会" → null（自评参考值独立显示，不进本计算器）
        MasteryScore s = MasteryCalculator.compute(Collections.emptyList(), T0);
        assertNull(s.score());
    }

    @Test
    void singleL3Correct_is100ButSampleInsufficient_noUnlock() {
        // 20：1 道 L3 全对 → 100 + 样本不足；不解锁
        MasteryScore s = MasteryCalculator.compute(days(1, true, 3), T0);
        assertEquals(new BigDecimal("100.00"), s.score());
        assertTrue(s.insufficientSample());
        assertFalse(MasteryCalculator.unlockable(s));
        assertEquals(GraphColor.SAMPLE_LOW, MasteryCalculator.colorOf(false, false, s));
    }

    @Test
    void decay_day14_15_30_31() {
        // 20 样例：baseScore=100 → 第 14/15/30/31 天 = 100 / 98.5 / 76 / 74.5
        List<Evidence> base = days(5, true, 3);
        assertEquals(new BigDecimal("100.00"), scoreAt(base, 14));
        assertEquals(new BigDecimal("98.50"), scoreAt(base, 15));
        assertEquals(new BigDecimal("76.00"), scoreAt(base, 30));
        assertEquals(new BigDecimal("74.50"), scoreAt(base, 31));
    }

    private BigDecimal scoreAt(List<Evidence> base, long daysAfterLast) {
        Instant asOf = base.get(base.size() - 1).eligibleAt().plus(daysAfterLast, ChronoUnit.DAYS);
        MasteryScore s = MasteryCalculator.compute(base, asOf);
        return s.score();
    }

    @Test
    void idempotent_sameDayRecompute_noDoubleDecay() {
        // 20：同一天读取与批量各算两次 → 与首次一致，不重复衰减
        List<Evidence> base = days(5, true, 3);
        Instant asOf = base.get(4).eligibleAt().plus(20, ChronoUnit.DAYS);
        BigDecimal first = MasteryCalculator.compute(base, asOf).score();
        BigDecimal second = MasteryCalculator.compute(base, asOf).score();
        BigDecimal third = MasteryCalculator.compute(withLast(base, base.get(4).eligibleAt()), asOf).score();
        assertEquals(first, second);
        assertEquals(first, third);
    }

    @Test
    void unlockBoundary_7999refused_80passed() {
        // 20：5 个有效样本，score=79.9 / 80 → 拒绝 / 放行
        assertFalse(MasteryCalculator.unlockable(scoreWith(new BigDecimal("79.90"), 5)));
        assertFalse(MasteryCalculator.unlockable(scoreWith(new BigDecimal("79.99"), 5)));
        assertTrue(MasteryCalculator.unlockable(scoreWith(new BigDecimal("80.00"), 5)));
    }

    private MasteryScore scoreWith(BigDecimal score, int n) {
        return new MasteryScore(score, n, false, score, 0, T0);
    }

    @Test
    void graphColor_priority() {
        // 20 §1.1 优先级：筹备 > 锁定 > 无数据 > 样本不足 > 分数档
        MasteryScore ok = MasteryCalculator.compute(days(5, true, 3), T0);
        assertEquals(GraphColor.PREPARING, MasteryCalculator.colorOf(true, true, ok));
        assertEquals(GraphColor.LOCKED, MasteryCalculator.colorOf(false, true, ok));
        assertEquals(GraphColor.NO_DATA, MasteryCalculator.colorOf(false, false, null));
        assertEquals(GraphColor.GREEN, MasteryCalculator.colorOf(false, false, ok));
    }

    @Test
    void mixedEvidence_weightedNewerCounts() {
        // 结构性：新证据权重更高（4 对 1 错，错的在最新）→ 应低于 80 但 >0
        java.util.ArrayList<Evidence> ev = new java.util.ArrayList<>(days(5, true, 3));
        ev.set(4, new Evidence(false, 3, T0));
        MasteryScore s = MasteryCalculator.compute(ev, T0);
        assertNotNull(s.score());
        double v = s.score().doubleValue();
        assertTrue(v > 0 && v < 80, "score=" + v);
    }
}
