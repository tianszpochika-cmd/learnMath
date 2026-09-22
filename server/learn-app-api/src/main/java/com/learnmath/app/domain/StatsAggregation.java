package com.learnmath.app.domain;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * 学习统计聚合（02 §7 · 01 U-70 · 16 W13；纯函数）。
 *
 * - 周汇总：时长/题量/正确率（题量 0 → accuracy=null，禁止除零 100%）；
 * - 环比：上期为 0 → delta=null（不显示 0% 或 ∞）；
 * - 推理能力画像：rate = correct/attempted（**仅 observed 证据**，见 BR-05），样本 0 → null；
 * - 连续打卡：从 asOf 向前连续命中日期（缺口断链；今天没学但从昨天算）；
 * - 热力分级：按分钟数分 0-4 级（cap 可配）；
 * - 周报规则文案（AI 无 Key=模板回落，01 U-45 口径）。
 */
public final class StatsAggregation {

    /** 单日统计（stat_daily 聚合行）。 */
    public record DailyStat(LocalDate date, int minutes, int questions, int correct) {}

    /** 环比值。 */
    public record Delta(Double pct, boolean available) {}

    /** 周汇总。 */
    public record WeekSummary(int totalMinutes, int questions, Double accuracy,
                              Delta minutesDelta, Delta questionsDelta, Delta accuracyDelta) {}

    /** 推理画像条目。 */
    public record ProfileEntry(String stepType, int attempted, int correct,
                               Double rate, boolean smallSample) {}

    private static final int SMALL_SAMPLE = 5;
    private static final int HEAT_CAP = 60; // 分钟 → 满级

    private StatsAggregation() {
    }

    // ---------- 周汇总 ----------

    public static WeekSummary summarize(List<DailyStat> thisWeek, List<DailyStat> lastWeek) {
        int minutes = 0;
        int questions = 0;
        int correct = 0;
        if (thisWeek != null) {
            for (DailyStat d : thisWeek) {
                minutes += d.minutes();
                questions += d.questions();
                correct += d.correct();
            }
        }
        int lastMinutes = 0;
        int lastQuestions = 0;
        int lastCorrect = 0;
        if (lastWeek != null) {
            for (DailyStat d : lastWeek) {
                lastMinutes += d.minutes();
                lastQuestions += d.questions();
                lastCorrect += d.correct();
            }
        }
        Double acc = questions == 0 ? null : 100.0 * correct / questions;
        Double lastAcc = lastQuestions == 0 ? null : 100.0 * lastCorrect / lastQuestions;
        return new WeekSummary(minutes, questions, acc,
                delta(minutes, lastMinutes), delta(questions, lastQuestions),
                deltaNullable(acc, lastAcc));
    }

    /** 环比：上期=0 → 不可用（available=false）。 */
    public static Delta delta(int now, int prev) {
        if (prev <= 0) {
            return new Delta(null, false);
        }
        return new Delta(100.0 * (now - prev) / prev, true);
    }

    private static Delta deltaNullable(Double now, Double prev) {
        if (now == null || prev == null || prev == 0) {
            return new Delta(null, false);
        }
        return new Delta(now - prev, true); // 正确率环比给百分点差
    }

    // ---------- 推理能力画像 ----------

    /**
     * @param observed 每类 step_type 的 [attempted, correct]（**仅 observed 证据**喂入，BR-05）
     */
    public static List<ProfileEntry> profile(Map<String, int[]> observed) {
        List<ProfileEntry> out = new ArrayList<>();
        if (observed == null) {
            return out;
        }
        observed.keySet().stream().sorted().forEach(type -> {
            int[] v = observed.get(type);
            int attempted = v == null || v.length < 1 ? 0 : v[0];
            int correct = v == null || v.length < 2 ? 0 : v[1];
            if (attempted <= 0) {
                out.add(new ProfileEntry(type, 0, 0, null, true));
            } else {
                double rate = 100.0 * correct / attempted;
                out.add(new ProfileEntry(type, attempted, correct, rate, attempted < SMALL_SAMPLE));
            }
        });
        return out;
    }

    /** 画像中的最弱项（有样本且 rate 最低；无样本返回 null）。 */
    public static ProfileEntry weakest(List<ProfileEntry> profile) {
        return profile == null ? null : profile.stream()
                .filter(p -> p.rate() != null)
                .min((a, b) -> Double.compare(a.rate(), b.rate()))
                .orElse(null);
    }

    // ---------- 连续打卡 ----------

    /**
     * 连续打卡天数：从 asOf 向前逐日命中；今天缺失时允许从昨天起算（当天还没学）；
     * 缺口即断。
     */
    public static int streak(Set<LocalDate> activeDays, LocalDate asOf) {
        if (activeDays == null || activeDays.isEmpty() || asOf == null) {
            return 0;
        }
        LocalDate cursor = asOf;
        if (!activeDays.contains(cursor)) {
            cursor = cursor.minusDays(1);
            if (!activeDays.contains(cursor)) {
                return 0;
            }
        }
        int streakCount = 0;
        while (activeDays.contains(cursor)) {
            streakCount++;
            cursor = cursor.minusDays(1);
        }
        return streakCount;
    }

    // ---------- 热力分级 ----------

    /** 0 无 / 1-4 递增（cap=60 分钟满级）。 */
    public static int heatLevel(int minutes) {
        if (minutes <= 0) {
            return 0;
        }
        if (minutes >= HEAT_CAP) {
            return 4;
        }
        return Math.min(4, (int) Math.ceil(minutes / (HEAT_CAP / 4.0)));
    }

    // ---------- 周报规则文案（AI 无 Key 回落模板） ----------

    public static String ruleBasedComment(WeekSummary week, ProfileEntry weakestProfile,
                                          Integer streakDays) {
        StringBuilder sb = new StringBuilder();
        if (week.questions() == 0) {
            return "本周还没有学习记录，从 10 分钟开始吧。";
        }
        Double acc = week.accuracy();
        if (acc != null && acc >= 85) {
            sb.append("本周正确率 ").append(String.format("%.0f%%", acc))
              .append("，状态在线");
        } else if (acc != null && acc >= 60) {
            sb.append("本周正确率 ").append(String.format("%.0f%%", acc))
              .append("，中等但有提升空间");
        } else {
            sb.append("本周正确率 ").append(String.format("%.0f%%", acc))
              .append("，建议放慢节奏先补基础");
        }
        if (weakestProfile != null && weakestProfile.rate() != null) {
            sb.append("；「").append(weakestProfile.stepType())
              .append("」最弱（").append(String.format("%.0f%%", weakestProfile.rate()))
              .append("），优先补它");
        }
        if (streakDays != null && streakDays >= 3) {
            sb.append("。连签 ").append(streakDays).append(" 天，保持节奏");
        }
        sb.append("。");
        return sb.toString();
    }

    // ---------- 工具 ----------

    public static List<DailyStat> sortedByDate(List<DailyStat> stats) {
        List<DailyStat> out = stats == null ? new ArrayList<>() : new ArrayList<>(stats);
        out.sort((a, b) -> a.date().compareTo(b.date()));
        return Collections.unmodifiableList(out);
    }

    public static Set<LocalDate> datesOf(List<DailyStat> stats) {
        Set<LocalDate> set = new TreeSet<>();
        if (stats != null) {
            for (DailyStat d : stats) {
                if (d.minutes() > 0 || d.questions() > 0) {
                    set.add(d.date());
                }
            }
        }
        return set;
    }
}
