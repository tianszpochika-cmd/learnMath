package com.learnmath.app.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * 官网返回目标 / 导航意图（20 §9 BR-09 / DR-09；纯函数）。
 *
 * - `from` 只记录来源；`intent={targetType,targetId,action,entrySource}` 记录意图；
 *   targetType 白名单 node/formula/question/event/path，action 白名单 read/drill/join/start；
 * - 后端解析 slug 并生成随机 **resumeToken（30 分钟有效）**，只指向已登记资源，不接受任意 URL；
 * - 兑换 token 绑定当前账号 → resumeId，**24 小时可重复读取同一目标**；导航完成后 consumed；
 *   不同账号不得读取已绑定 intent；解析**不创建成绩/报名记录**；
 * - 有目标 → 先返回资源（测评仅非阻塞提示）；无目标 → 默认计划进首页；
 * - 过期或下架 → 不丢已填输入：给原因 + 资源搜索/推荐 + 复制输入（不静默落首页）；
 * - 分享 URL 仅携公共目标与来源，不携账号私密数据。
 */
public final class NavigationIntent {

    public static final Set<String> TARGET_TYPES = Set.of("node", "formula", "question", "event", "path");
    public static final Set<String> ACTIONS = Set.of("read", "drill", "join", "start");

    public static final Duration TOKEN_TTL = Duration.ofMinutes(30);
    public static final Duration RESUME_READABLE = Duration.ofHours(24);

    /** 意图（slug 解析后的结构）。 */
    public record Intent(String targetType, long targetId, String action, String entrySource, String from) {}

    /** 解析结果。 */
    public record Resolved(Intent intent, String resumeToken, Instant expiresAt,
                           String displayTitle, boolean allowed) {

        public boolean expired(Instant now) {
            return now != null && !now.isBefore(expiresAt);
        }
    }

    /** 账号绑定（兑换后）。 */
    public record ResumeBinding(String resumeId, long accountId, Intent intent,
                                Instant boundAt, Instant readableUntil, boolean consumed) {

        public boolean readableAt(Instant now) {
            return !consumed && now != null && now.isBefore(readableUntil);
        }
    }

    /** 兑换回执。 */
    public record Exchange(boolean ok, String resumeId, Intent target, String reason) {}

    /** 落地策略（有目标先回资源；测评仅提示）。 */
    public enum Landing { RETURN_TARGET, DEFAULT_HOME }

    private NavigationIntent() {
    }

    // ---------- 白名单 ----------

    public static boolean validType(String targetType) {
        return targetType != null && TARGET_TYPES.contains(targetType.toLowerCase(Locale.ROOT));
    }

    public static boolean validAction(String action) {
        return action != null && ACTIONS.contains(action.toLowerCase(Locale.ROOT));
    }

    public static boolean valid(Intent i) {
        return i != null && validType(i.targetType()) && i.targetId() > 0
                && validAction(i.action()) && i.entrySource() != null;
    }

    // ---------- 解析 ----------

    /**
     * slug 解析（**只指向已登记资源**）。
     *
     * @param resourceExists 资源是否已登记且未下架
     * @param permitted      已登录时的目标权限校验结果
     */
    public static Resolved resolve(Intent intent, boolean resourceExists, boolean permitted,
                                   String displayTitle, Instant now) {
        if (!valid(intent)) {
            return new Resolved(intent, null, null, null, false);
        }
        if (!resourceExists) {
            // 目标下架：不生成 token（前端展示原因 + 搜索/推荐/复制输入）
            return new Resolved(intent, null, null, displayTitle, false);
        }
        if (!permitted) {
            return new Resolved(intent, null, null, displayTitle, false);
        }
        String token = newToken();
        return new Resolved(intent, token, now.plus(TOKEN_TTL), displayTitle, true);
    }

    /** 随机 resumeToken（不接受客户端自带）。 */
    public static String newToken() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    // ---------- 兑换 / 读取 / 消费 ----------

    /**
     * 兑换并绑定当前账号：
     *  - 无绑定 → 创建（24h 可重复读）；
     *  - 已绑定本账号 → 幂等返回同一 resumeId/目标（24h 内）；
     *  - 已绑定其他账号 → 拒绝（不同账号不得读取）。
     */
    public static Exchange exchange(ResumeBinding existing, long accountId, Intent intent, Instant now) {
        if (existing != null) {
            if (existing.accountId() != accountId) {
                return new Exchange(false, null, null, "该 intent 已绑定其他账号");
            }
            if (now != null && !now.isBefore(existing.readableUntil())) {
                return new Exchange(false, null, null, "恢复链接已过期（24h）");
            }
            return new Exchange(true, existing.resumeId(), existing.intent(), "same-account replay");
        }
        if (!valid(intent)) {
            return new Exchange(false, null, null, "intent 无效或目标不可用");
        }
        String resumeId = newToken();
        ResumeBinding created = new ResumeBinding(resumeId, accountId, intent, now,
                now.plus(RESUME_READABLE), false);
        return new Exchange(true, created.resumeId(), created.intent(), "bound");
    }

    /** 导航完成确认 → consumed（幂等）。 */
    public static ResumeBinding consume(ResumeBinding b, boolean navigationConfirmed) {
        if (b == null) {
            return null;
        }
        if (!navigationConfirmed || b.consumed()) {
            return b;
        }
        return new ResumeBinding(b.resumeId(), b.accountId(), b.intent(), b.boundAt(),
                b.readableUntil(), true);
    }

    // ---------- 落地与分享 ----------

    public static Landing choose(Intent resolvedIntentPresent) {
        return resolvedIntentPresent != null ? Landing.RETURN_TARGET : Landing.DEFAULT_HOME;
    }

    /** 分享 URL：仅公共目标与来源（无账号/私密数据）。 */
    public static String shareUrl(Intent i) {
        return "/go?t=" + i.targetType() + "&id=" + i.targetId()
                + "&action=" + i.action() + "&from=" + (i.from() == null ? "" : i.from());
    }

    /** 过期/下架文案：不丢输入 + 给搜索/推荐/复制出口（不静默落首页）。 */
    public static String unavailableMessage(boolean expired, boolean delisted, String preservedInputHint) {
        StringBuilder sb = new StringBuilder();
        sb.append(expired ? "恢复链接已过期" : "目标资源不可用（可能已下架）");
        sb.append("。你填写的内容已保留。可选：搜索资源 / 查看推荐 / 复制输入。");
        if (preservedInputHint != null && !preservedInputHint.isBlank()) {
            sb.append("（").append(preservedInputHint).append("）");
        }
        return sb.toString();
    }

    /** 解析展示标题提示（"完成后继续学习…"）。 */
    public static String continueHint(String displayTitle) {
        return "完成后继续学习：" + (displayTitle == null ? "（目标）" : displayTitle);
    }

    /** 解析阶段不得创建成绩/报名（join 才落报名）——纯口径供服务层自检。 */
    public static boolean createsRecordsOnResolve() {
        return false;
    }
}
