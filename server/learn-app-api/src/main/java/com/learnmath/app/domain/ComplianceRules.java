package com.learnmath.app.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 合规三件套 + 每日一题排期（01 U-05~U-07 · 03 T61 · 02 §7 清理任务；纯函数）。
 *
 * 1) 数据导出（U-06）：站内信给下载链接，**7 天后过期**（清理任务同步删除）。
 * 2) 注销（U-07）：二次验证 → 冷静期（默认 7 天）→ 期满匿名化；
 *    冷静期内普通登录被拒（2008，提示先撤销）；撤销在到期前有效；到期=不可逆（2009）。
 *    匿名化：PII 清除/替换，社区存量内容作者显示"已注销用户"（01 U-07 三态）。
 * 3) 协议（U-05）：版本比对 —— 已由 ChannelPolicy.requireConsent 承担（B-06）。
 * 4) 每日一题排期（T61 + BR-01 公开口径）：**仅 curated 可排**；同日不可重复；
 *    每日题族公开曝光 → 不得进入测评/晋级战/Boss/挑战（BR-01 曝光隔离）。
 */
public final class ComplianceRules {

    public enum AccountState { ACTIVE, PENDING_COOL_DOWN, ANONYMIZED }

    /** 注销申请。 */
    public record DeletionRequest(AccountState state, Instant requestedAt, Instant dueAt) {}

    /** 登录裁决。 */
    public record LoginOutcome(boolean allowed, int code, String hint) {}

    /** 每日题排期裁决。 */
    public record ScheduleDecision(boolean allowed, String reason) {}

    private static final Duration COOL_DOWN = Duration.ofDays(7);
    private static final Duration EXPORT_LINK_TTL = Duration.ofDays(7);
    public static final String ANONYMIZED_NAME = "已注销用户";

    private ComplianceRules() {
    }

    // ---------- 注销 ----------

    /** 申请注销：必须过二次验证，否则拒绝（2007/1001 口径 → 上层映射）。 */
    public static DeletionRequest requestDeletion(boolean secondFactorVerified, Instant now) {
        if (!secondFactorVerified) {
            throw new IllegalArgumentException("注销需二次验证（验证码确认身份）");
        }
        return new DeletionRequest(AccountState.PENDING_COOL_DOWN, now, now.plus(COOL_DOWN));
    }

    /** 冷静期内可撤销；到期后不可（已匿名化不可逆）。 */
    public static boolean cancelAllowed(DeletionRequest req, Instant now) {
        return req != null && req.state() == AccountState.PENDING_COOL_DOWN && now.isBefore(req.dueAt());
    }

    /** 到期判定：now >= dueAt → ANONYMIZED（幂等，可由定时任务或读取时触发）。 */
    public static AccountState resolveState(DeletionRequest req, Instant now) {
        if (req == null) {
            return AccountState.ACTIVE;
        }
        if (now != null && !now.isBefore(req.dueAt())) {
            return AccountState.ANONYMIZED;
        }
        return req.state();
    }

    /** 普通登录在冷静期被拒（2008）；已匿名化（2009）；正常（allow）。 */
    public static LoginOutcome loginDecision(DeletionRequest req, Instant now) {
        AccountState s = resolveState(req, now);
        return switch (s) {
            case ACTIVE -> new LoginOutcome(true, 0, null);
            case PENDING_COOL_DOWN -> new LoginOutcome(false, 2008,
                    "账号注销冷静期中，请先撤销注销（到期 " + req.dueAt() + "）");
            case ANONYMIZED -> new LoginOutcome(false, 2009, "账号已注销");
        };
    }

    /** 匿名化投影：PII 清除/替换（清单式，落库字段与 03 user 表对齐）。 */
    public static Map<String, Object> anonymizePii(String nickname, String phone, String email, String avatarUrl) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("nickname", ANONYMIZED_NAME);
        out.put("phone", null);
        out.put("email", null);
        out.put("avatar_url", null);
        out.put("wechat_openid", null);
        out.put("password_hash", null);
        out.put("nickname_raw_hash", nickname == null ? null : Integer.toHexString(nickname.hashCode()));
        out.put("anonymized_at_hint", phone == null && email == null);
        out.put("avatar_backup_dropped", avatarUrl != null);
        return out;
    }

    /** 存量社区内容的作者展示（三态：公开→昵称 / 冷静期→原昵称 / 匿名→"已注销用户"）。 */
    public static String postAuthorDisplay(String nickname, AccountState state) {
        return state == AccountState.ANONYMIZED ? ANONYMIZED_NAME : nickname;
    }

    // ---------- 数据导出 ----------

    /** 导出链接 7 天有效（02 §7：清理任务删除导出文件）。 */
    public static boolean exportLinkValid(Instant createdAt, Instant now) {
        if (createdAt == null || now == null) {
            return false;
        }
        return now.isBefore(createdAt.plus(EXPORT_LINK_TTL));
    }

    public static Duration exportLinkTtl() {
        return EXPORT_LINK_TTL;
    }

    public static Duration coolDownDuration() {
        return COOL_DOWN;
    }

    // ---------- 每日一题排期 ----------

    /** 排期裁决：仅 curated；同日唯一。 */
    public static ScheduleDecision scheduleDailyQuestion(boolean curatedQuestion, boolean alreadyScheduledThisDate) {
        if (!curatedQuestion) {
            return new ScheduleDecision(false, "仅 curated 题可排（ai_draft 需先过人工校对）");
        }
        if (alreadyScheduledThisDate) {
            return new ScheduleDecision(false, "当日已有每日题（唯一约束）");
        }
        return new ScheduleDecision(true, "ok");
    }

    /**
     * 公开每日题族隔离（BR-01：公开每日题及其同族不得进入测评、晋级战、Boss、挑战赛；
     * 发布和开卷时均校验）。
     */
    public static boolean competitiveSourceBlocked(long familyId, java.util.Set<Long> publishedDailyFamilies) {
        return publishedDailyFamilies != null && publishedDailyFamilies.contains(familyId);
    }
}
