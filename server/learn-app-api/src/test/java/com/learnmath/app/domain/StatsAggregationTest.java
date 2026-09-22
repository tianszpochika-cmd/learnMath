package com.learnmath.app.domain;

import com.learnmath.app.domain.StatsAggregation.DailyStat;
import com.learnmath.app.domain.StatsAggregation.Delta;
import com.learnmath.app.domain.StatsAggregation.ProfileEntry;
import com.learnmath.app.domain.StatsAggregation.WeekSummary;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 统计聚合 —— 02 §7 · 01 U-70（纯函数）。 */
class StatsAggregationTest {

    private static DailyStat d(int day, int min, int q, int c) {
        return new DailyStat(LocalDate.of(2026, 9, day), min, q, c);
    }

    @Test
    void weekSummary_totalsAndAccuracy() {
        WeekSummary w = StatsAggregation.summarize(
                List.of(d(1, 30, 10, 8), d(2, 45, 20, 12), d(3, 0, 0, 0)), List.of());
        assertEquals(75, w.totalMinutes());
        assertEquals(30, w.questions());
        assertEquals(100.0 * 20 / 30, w.accuracy(), 1e-9);
    }

    @Test
    void accuracy_nullWhenNoQuestions_neverDivZero100() {
        WeekSummary w = StatsAggregation.summarize(List.of(d(1, 30, 0, 0)), List.of());
        assertNull(w.accuracy(), "题量 0 → null，禁止除零得 100%");
    }

    @Test
    void delta_unavailableWhenPrevZero() {
        Delta d1 = StatsAggregation.delta(50, 0);
        assertFalse(d1.available());
        assertNull(d1.pct());
        Delta d2 = StatsAggregation.delta(150, 100);
        assertTrue(d2.available());
        assertEquals(50.0, d2.pct(), 1e-9);
        Delta d3 = StatsAggregation.delta(80, 100);
        assertEquals(-20.0, d3.pct(), 1e-9);
    }

    @Test
    void accuracyDelta_isPointDifference() {
        WeekSummary w = StatsAggregation.summarize(
                List.of(d(1, 10, 10, 9)), List.of(d(1, 10, 10, 7)));
        assertTrue(w.accuracyDelta().available());
        assertEquals(20.0, w.accuracyDelta().pct(), 1e-9, "90% vs 70% → +20 个百分点");
    }

    @Test
    void profile_ratesAndSmallSample() {
        List<ProfileEntry> p = StatsAggregation.profile(Map.of(
                "等价变形", new int[]{20, 16},
                "回代检验", new int[]{3, 1},
                "构造", new int[]{0, 0}));
        assertEquals(3, p.size());
        ProfileEntry transform = p.stream().filter(e -> e.stepType().equals("等价变形")).findFirst().orElseThrow();
        assertEquals(80.0, transform.rate(), 1e-9);
        assertFalse(transform.smallSample());
        ProfileEntry back = p.stream().filter(e -> e.stepType().equals("回代检验")).findFirst().orElseThrow();
        assertTrue(back.smallSample(), "n=3 <5 标小样本");
        ProfileEntry none = p.stream().filter(e -> e.stepType().equals("构造")).findFirst().orElseThrow();
        assertNull(none.rate(), "无样本 → null 不显示 0%");

        ProfileEntry weak = StatsAggregation.weakest(p);
        assertNotNull(weak);
        assertEquals("回代检验", weak.stepType());
    }

    @Test
    void streak_consecutiveUntilGap() {
        Set<LocalDate> days = Set.of(
                LocalDate.of(2026, 9, 20),
                LocalDate.of(2026, 9, 21),
                LocalDate.of(2026, 9, 22));
        assertEquals(3, StatsAggregation.streak(days, LocalDate.of(2026, 9, 22)), "今天已学");
        assertEquals(3, StatsAggregation.streak(days, LocalDate.of(2026, 9, 23)), "今天还没学 → 从昨天起算");
        assertEquals(0, StatsAggregation.streak(days, LocalDate.of(2026, 9, 25)), "缺口断链");
        Set<LocalDate> gap = Set.of(LocalDate.of(2026, 9, 20), LocalDate.of(2026, 9, 22));
        assertEquals(1, StatsAggregation.streak(gap, LocalDate.of(2026, 9, 22)));
        assertEquals(0, StatsAggregation.streak(Set.of(), LocalDate.of(2026, 9, 22)));
    }

    @Test
    void heatLevel_buckets() {
        assertEquals(0, StatsAggregation.heatLevel(0));
        assertEquals(1, StatsAggregation.heatLevel(15));
        assertEquals(2, StatsAggregation.heatLevel(30));
        assertEquals(4, StatsAggregation.heatLevel(60), "60 分钟满级");
        assertEquals(4, StatsAggregation.heatLevel(120), "超 cap 封顶");
    }

    @Test
    void ruleBasedComment_templates() {
        // 无记录
        WeekSummary empty = StatsAggregation.summarize(List.of(), List.of());
        assertTrue(StatsAggregation.ruleBasedComment(empty, null, 0).contains("还没有学习记录"));

        // 健康周 + 最弱项 + 连签
        WeekSummary good = StatsAggregation.summarize(
                List.of(d(1, 30, 10, 9), d(2, 30, 10, 9)), List.of());
        ProfileEntry weak = new ProfileEntry("回代检验", 10, 5, 50.0, false);
        String c = StatsAggregation.ruleBasedComment(good, weak, 5);
        assertTrue(c.contains("回代检验"));
        assertTrue(c.contains("连签 5 天"));
        assertTrue(c.endsWith("。"));

        // 低正确率 → 补基础模板
        WeekSummary bad = StatsAggregation.summarize(List.of(d(1, 30, 10, 4)), List.of());
        assertTrue(StatsAggregation.ruleBasedComment(bad, null, null).contains("补基础"));
    }

    @Test
    void helper_sortAndDates() {
        List<DailyStat> sorted = StatsAggregation.sortedByDate(List.of(d(3, 1, 1, 1), d(1, 1, 1, 1), d(2, 1, 1, 1)));
        assertEquals(LocalDate.of(2026, 9, 1), sorted.get(0).date());
        assertEquals(LocalDate.of(2026, 9, 3), sorted.get(2).date());
        Set<LocalDate> dates = StatsAggregation.datesOf(List.of(d(1, 0, 0, 0), d(2, 20, 5, 4)));
        assertFalse(dates.contains(LocalDate.of(2026, 9, 1)), "空学习日不计入活跃日期");
        assertTrue(dates.contains(LocalDate.of(2026, 9, 2)));
    }
}
