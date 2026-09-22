package com.learnmath.app.domain;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 通知与订阅（04 §4.11/§4.16 · 03 T60 · 16W17；纯函数）。
 *
 * - 站内信四类：SYSTEM / LEARNING / COMMUNITY / MODERATION（分类 → 前端 Tab 归属 + 深链）；
 * - 未读数聚合与已读口径（分类未读 / 总未读）；
 * - Newsletter 订阅幂等（T60 UNIQUE(email)）：重复订阅返回"已订"态而非报错；退订幂等；可再订。
 */
public final class NotifySubscribe {

    public enum Category { SYSTEM, LEARNING, COMMUNITY, MODERATION }

    /** 订阅回执（幂等状态）。 */
    public record SubscribeResult(boolean ok, boolean alreadySubscribed, String message) {}

    public record UnsubscribeResult(boolean ok, boolean wasSubscribed, String message) {}

    public record Unread(int system, int learning, int community, int moderation) {

        public int total() {
            return system + learning + community + moderation;
        }
    }

    private static final Pattern EMAIL = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private NotifySubscribe() {
    }

    // ---------- 分类与深链 ----------

    /**
     * 模板键 → 分类（04 通知模板表口径）。
     * 例：account.*→SYSTEM；daily_drill/plan/report/checkin→LEARNING；
     * reply/adopt/follow→COMMUNITY；audit_result/report_result→MODERATION。
     */
    public static Category classify(String templateKey) {
        if (templateKey == null || templateKey.isBlank()) {
            return Category.SYSTEM;
        }
        String key = templateKey.toLowerCase(Locale.ROOT);
        if (key.startsWith("audit") || key.startsWith("report_result") || key.startsWith("content_")) {
            return Category.MODERATION;
        }
        if (key.startsWith("reply") || key.startsWith("adopt") || key.startsWith("follow")
                || key.startsWith("like")) {
            return Category.COMMUNITY;
        }
        if (key.startsWith("daily") || key.startsWith("plan") || key.startsWith("report")
                || key.startsWith("checkin") || key.startsWith("streak") || key.startsWith("attempt")
                || key.startsWith("achievement")) {
            return Category.LEARNING;
        }
        return Category.SYSTEM;
    }

    /** 深链（点通知直达）。 */
    public static String deepLink(String templateKey, long targetId) {
        Category c = classify(templateKey);
        return switch (c) {
            case COMMUNITY -> "/community/post/" + targetId;
            case MODERATION -> "/me/notifications";
            case LEARNING -> switch (templateKey == null ? "" : templateKey) {
                case "daily_drill_ready" -> "/do";
                case "plan_reminder" -> "/plans";
                case "report_weekly" -> "/report";
                default -> "/me/notifications";
            };
            case SYSTEM -> "/me/notifications";
        };
    }

    // ---------- 未读聚合 ----------

    public static Unread unreadByCategory(List<Category> unreadCategories) {
        int s = 0;
        int l = 0;
        int c = 0;
        int m = 0;
        if (unreadCategories != null) {
            for (Category cat : unreadCategories) {
                switch (cat) {
                    case SYSTEM -> s++;
                    case LEARNING -> l++;
                    case COMMUNITY -> c++;
                    case MODERATION -> m++;
                }
            }
        }
        return new Unread(s, l, c, m);
    }

    /** 已读（分类维度）。 */
    public static List<Category> markRead(List<Category> unread, Category target) {
        List<Category> out = new ArrayList<>();
        if (unread != null) {
            for (Category c : unread) {
                if (c != target) {
                    out.add(c);
                }
            }
        }
        return out;
    }

    // ---------- Newsletter ----------

    public static boolean validEmail(String email) {
        return email != null && EMAIL.matcher(email.trim()).matches();
    }

    /** 订阅（幂等）：集合即订阅表（UNIQUE(email) 语义）。 */
    public static SubscribeResult subscribe(Set<String> subscribers, String email) {
        if (!validEmail(email)) {
            return new SubscribeResult(false, false, "邮箱格式不合法");
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        Set<String> set = subscribers == null ? new LinkedHashSet<>() : subscribers;
        if (set.contains(normalized)) {
            return new SubscribeResult(true, true, "已订阅（幂等返回已订态）");
        }
        return new SubscribeResult(true, false, "订阅成功，确认信已发（V4 双确认由服务层补）");
    }

    /** 退订（幂等）。 */
    public static UnsubscribeResult unsubscribe(Set<String> subscribers, String email) {
        if (!validEmail(email)) {
            return new UnsubscribeResult(false, false, "邮箱格式不合法");
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (subscribers == null || !subscribers.contains(normalized)) {
            return new UnsubscribeResult(true, false, "本就不在订阅列表（幂等）");
        }
        return new UnsubscribeResult(true, true, "已退订");
    }

    /** 退订后可再订（状态可回环）。 */
    public static boolean canResubscribeAfterUnsubscribe(Set<String> subscribers, String email) {
        return subscribers == null || !subscribers.contains(email.trim().toLowerCase(Locale.ROOT));
    }

    public static Set<String> copyOf(Set<String> in) {
        return in == null ? new LinkedHashSet<>() : new LinkedHashSet<>(in);
    }
}
