package com.learnmath.app.domain;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * 游戏化规则（02 §5.7 · 01 U-60/61/64 · 09 L9；纯函数）。
 *
 * - 打卡：每自然日一次（重复 → 3501）；**00:05 日结**后昨日未打卡 = 断签；
 *   补签消耗补签卡（余额不足 → 3502，复用 PointsRules.canAffordMakeup 口径）；
 * - 成就：规则挂 rule_json（配置化解释器，支持 STREAK_DAYS / QUESTIONS_TOTAL / LADDER_PASS 三型）；
 * - 每日任务：完成必须来自**服务端学习事件**（复选框仅发起校验，BR-10 同源）；
 * - 周榜：按积分降序、同分按达成时间早者靠前；**奖励经 PointsRules 入账**（幂等业务键）。
 */
public final class GamificationRules {

    /** 成就规则（rule_json 的最小三型；其余型随配置扩展）。 */
    public record AchievementRule(String code, String type, int threshold) {}

    /** 周榜条目。 */
    public record RankEntry(long userId, int points, long achievedAtEpochSec) {}

    public record Rank(int position, long userId, int points) {}

    /** 打卡回执。 */
    public record Checkin(boolean ok, int code, int streak, String reason) {}

    /** 打卡状态（按日集合推导）。 */
    public record StreakState(int streak, boolean checkedToday, Set<LocalDate> dates) {}

    public static final int ALREADY_CHECKED = 3501;
    public static final int MAKEUP_INSUFFICIENT = 3502;

    private GamificationRules() {
    }

    // ---------- 打卡 ----------

    /**
     * 打卡（幂等）。
     *
     * @param alreadyDates 已打卡日期集合
     * @param today        当前自然日（Asia/Shanghai；日结 00:05 由调度在服务层把昨日未打卡标断）
     */
    public static Checkin checkin(Set<LocalDate> alreadyDates, LocalDate today, int currentStreakBeforeToday) {
        Set<LocalDate> dates = alreadyDates == null ? new TreeSet<>() : new TreeSet<>(alreadyDates);
        if (dates.contains(today)) {
            return new Checkin(false, ALREADY_CHECKED, currentStreakBeforeToday,
                    "今日已打卡（3501）");
        }
        dates.add(today);
        int streak = computeStreak(dates, today);
        return new Checkin(true, 0, streak, "打卡成功");
    }

    /**
     * 连签计算：从 today 向前连续命中；今天未打则从昨天起算（与 StatsAggregation.streak 同语义）。
     */
    public static int computeStreak(Set<LocalDate> dates, LocalDate today) {
        if (dates == null || dates.isEmpty()) {
            return 0;
        }
        LocalDate cursor = today;
        if (!dates.contains(cursor)) {
            cursor = cursor.minusDays(1);
            if (!dates.contains(cursor)) {
                return 0;
            }
        }
        int n = 0;
        while (dates.contains(cursor)) {
            n++;
            cursor = cursor.minusDays(1);
        }
        return n;
    }

    /**
     * 补签（01 U-61）：目标日必须是"过去且未打卡"，消耗补签卡（余额守卫见 PointsRules.canAffordMakeup → 3502）。
     *
     * @param hasMakeupCard 补签卡数量是否 ≥1
     */
    public static Checkin makeup(Set<LocalDate> alreadyDates, LocalDate missedDay, LocalDate today,
                                 boolean hasMakeupCard) {
        if (missedDay == null || !missedDay.isBefore(today)) {
            return new Checkin(false, 1001, 0, "只能补签过去的日期");
        }
        Set<LocalDate> dates = alreadyDates == null ? new TreeSet<>() : new TreeSet<>(alreadyDates);
        if (dates.contains(missedDay)) {
            return new Checkin(false, ALREADY_CHECKED, computeStreak(dates, today), "该日已打卡");
        }
        if (!hasMakeupCard) {
            return new Checkin(false, MAKEUP_INSUFFICIENT, computeStreak(dates, today), "补签卡不足（3502）");
        }
        dates.add(missedDay);
        return new Checkin(true, 0, computeStreak(dates, today), "补签成功（消耗补签卡 ×1）");
    }

    // ---------- 成就规则解释器 ----------

    /** 统计输入（rule_json 三型所需）。 */
    public record Stats(int streakDays, int questionsTotal, int ladderPassed) {}

    /** 解释：达到 threshold → unlocked（边界含等号）。 */
    public static boolean achievementMet(AchievementRule rule, Stats stats) {
        if (rule == null || stats == null) {
            return false;
        }
        int value = switch (rule.type() == null ? "" : rule.type()) {
            case "STREAK_DAYS" -> stats.streakDays();
            case "QUESTIONS_TOTAL" -> stats.questionsTotal();
            case "LADDER_PASS" -> stats.ladderPassed();
            default -> -1; // 未知类型不解锁（配置错不误发）
        };
        if (value < 0) {
            return false;
        }
        return value >= rule.threshold();
    }

    /** 批量解锁（已拥有集合不重复发；返回本次新增 code）。 */
    public static List<String> newlyUnlocked(List<AchievementRule> rules, Stats stats, Set<String> owned) {
        List<String> out = new ArrayList<>();
        Set<String> have = owned == null ? new LinkedHashSet<>() : owned;
        if (rules == null) {
            return out;
        }
        for (AchievementRule r : rules) {
            if (!have.contains(r.code()) && achievementMet(r, stats)) {
                out.add(r.code());
            }
        }
        return out;
    }

    // ---------- 每日任务 ----------

    /**
     * 每日任务完成：必须由服务端学习事件确认（16/S29：复选框仅发起校验）。
     *
     * @param serverEvidenceRef 服务端事件引用（attempt/lesson 完成事件 id）
     */
    public static boolean dailyTaskComplete(String serverEvidenceRef) {
        return serverEvidenceRef != null && !serverEvidenceRef.isBlank();
    }

    // ---------- 周榜 ----------

    /** 排序：积分降序 → 达成时间早者靠前（稳定同分规则）。 */
    public static List<Rank> weeklyRanks(List<RankEntry> entries) {
        List<RankEntry> sorted = new ArrayList<>(entries == null ? List.of() : entries);
        sorted.sort(Comparator.comparingInt(RankEntry::points).reversed()
                .thenComparingLong(RankEntry::achievedAtEpochSec));
        List<Rank> out = new ArrayList<>();
        int pos = 1;
        for (RankEntry e : sorted) {
            out.add(new Rank(pos++, e.userId(), e.points()));
        }
        return out;
    }

    /** 我的名次定位（吸底展示）。 */
    public static Rank myRank(List<Rank> ranks, long userId) {
        if (ranks == null) {
            return null;
        }
        for (Rank r : ranks) {
            if (r.userId() == userId) {
                return r;
            }
        }
        return null;
    }
}
