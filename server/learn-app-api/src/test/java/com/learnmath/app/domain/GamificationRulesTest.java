package com.learnmath.app.domain;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 游戏化 —— 02 §5.7 / 01 U-60/61（打卡幂等/补签/成就解释器/周榜）。 */
class GamificationRulesTest {

    private static final LocalDate D1 = LocalDate.of(2026, 9, 20);

    @Test
    void checkin_idempotent3501_and_streakExtend() {
        Set<LocalDate> dates = new TreeSet<>(Set.of(D1.minusDays(1), D1.minusDays(2)));
        GamificationRules.Checkin first = GamificationRules.checkin(dates, D1, 2);
        assertTrue(first.ok());
        assertEquals(3, first.streak(), "2 天连续 + 今日 = 3");
        // 幂等：同日再打 → 3501
        dates.add(D1);
        GamificationRules.Checkin dup = GamificationRules.checkin(dates, D1, 3);
        assertFalse(dup.ok());
        assertEquals(3501, dup.code());
        assertTrue(dup.reason().contains("3501"));
    }

    @Test
    void streak_breakOnGap_todaysMissingCountFromYesterday() {
        // 今天未打 → 从昨天起算：{昨天,前天,大前天} = 3
        Set<LocalDate> three = new TreeSet<>(Set.of(
                D1.minusDays(1), D1.minusDays(2), D1.minusDays(3)));
        assertEquals(3, GamificationRules.computeStreak(three, D1));
        // 昨天也缺 → 断链归 0（序列必须贴着今天或昨天）
        Set<LocalDate> stale = new TreeSet<>(Set.of(
                D1.minusDays(2), D1.minusDays(3), D1.minusDays(4)));
        assertEquals(0, GamificationRules.computeStreak(stale, D1));
        // 孤立日证明断链：asOf=昨天，仅前天有记录 → 1
        assertEquals(1, GamificationRules.computeStreak(Set.of(D1.minusDays(2)), D1.minusDays(1)));
        assertEquals(0, GamificationRules.computeStreak(Set.of(), D1));
    }

    @Test
    void makeup_pastOnly_costCard_thenStitch() {
        Set<LocalDate> dates = new TreeSet<>(Set.of(D1.minusDays(2), D1.minusDays(1)));
        // 正常补昨天 → 连签接上 3
        GamificationRules.Checkin ok = GamificationRules.makeup(dates, D1.minusDays(1).minusDays(0), D1, true);
        // 昨天已打 → 3501
        assertFalse(ok.ok());
        assertEquals(3501, ok.code());
        // 补前天（缺的那天）→ 成功，streak 3
        GamificationRules.Checkin fixed = GamificationRules.makeup(dates, D1.minusDays(3), D1, true);
        // D1-3 加入 → 序列 D1-3,D1-2,D1-1 连续 3（今天没打 → 从昨天算）
        assertTrue(fixed.ok());
        assertEquals(3, fixed.streak());
        // 卡不足 → 3502
        GamificationRules.Checkin noCard = GamificationRules.makeup(dates, D1.minusDays(3), D1, false);
        assertFalse(noCard.ok());
        assertEquals(3502, noCard.code());
        // 未来日期 → 参数错
        assertFalse(GamificationRules.makeup(dates, D1.plusDays(1), D1, true).ok());
        assertFalse(GamificationRules.makeup(dates, D1, D1, true).ok(), "今天不算补签");
    }

    @Test
    void achievement_interpreter_threeTypes_boundaryInclusive() {
        GamificationRules.Stats s7 = new GamificationRules.Stats(7, 500, 1);
        assertTrue(GamificationRules.achievementMet(
                new GamificationRules.AchievementRule("A_STREAK_7", "STREAK_DAYS", 7), s7));
        assertFalse(GamificationRules.achievementMet(
                new GamificationRules.AchievementRule("A_STREAK_7", "STREAK_DAYS", 8), s7));
        assertTrue(GamificationRules.achievementMet(
                new GamificationRules.AchievementRule("A_Q_500", "QUESTIONS_TOTAL", 500), s7));
        assertTrue(GamificationRules.achievementMet(
                new GamificationRules.AchievementRule("A_L1", "LADDER_PASS", 1), s7));
        // 未知类型不解锁（配置错不误发）
        assertFalse(GamificationRules.achievementMet(
                new GamificationRules.AchievementRule("A_X", "UNKNOWN_TYPE", 1), s7));
        assertFalse(GamificationRules.achievementMet(null, s7));
    }

    @Test
    void newlyUnlocked_dedupAgainstOwned() {
        List<GamificationRules.AchievementRule> rules = List.of(
                new GamificationRules.AchievementRule("A1", "STREAK_DAYS", 3),
                new GamificationRules.AchievementRule("A2", "STREAK_DAYS", 10),
                new GamificationRules.AchievementRule("A3", "QUESTIONS_TOTAL", 100));
        GamificationRules.Stats s = new GamificationRules.Stats(5, 120, 0);
        List<String> fresh = GamificationRules.newlyUnlocked(rules, s, Set.of("A1"));
        assertEquals(List.of("A3"), fresh, "A1 已拥有不重发；A2 未达标");
    }

    @Test
    void dailyTask_needsServerEvidence() {
        assertTrue(GamificationRules.dailyTaskComplete("lesson#55:completed"));
        assertFalse(GamificationRules.dailyTaskComplete(null), "复选框发起 ≠ 完成");
        assertFalse(GamificationRules.dailyTaskComplete("  "));
    }

    @Test
    void weeklyRanks_pointsDesc_timeAscTie_myRank() {
        List<GamificationRules.RankEntry> entries = List.of(
                new GamificationRules.RankEntry(1L, 2000, 50),
                new GamificationRules.RankEntry(2L, 2100, 90),
                new GamificationRules.RankEntry(3L, 2000, 20));
        List<GamificationRules.Rank> ranks = GamificationRules.weeklyRanks(entries);
        assertEquals(2L, ranks.get(0).userId(), "2100 第一");
        assertEquals(3L, ranks.get(1).userId(), "同 2000 → 早者(20) 靠前");
        assertEquals(1L, ranks.get(2).userId());
        assertEquals(1, ranks.get(0).position());
        GamificationRules.Rank me = GamificationRules.myRank(ranks, 3L);
        assertEquals(2, me.position());
        assertEquals(null, GamificationRules.myRank(ranks, 99L));
        assertEquals(0, GamificationRules.weeklyRanks(null).size());
    }
}
