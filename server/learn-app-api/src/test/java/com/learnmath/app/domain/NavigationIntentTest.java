package com.learnmath.app.domain;

import com.learnmath.app.domain.NavigationIntent.Exchange;
import com.learnmath.app.domain.NavigationIntent.Intent;
import com.learnmath.app.domain.NavigationIntent.Landing;
import com.learnmath.app.domain.NavigationIntent.Resolved;
import com.learnmath.app.domain.NavigationIntent.ResumeBinding;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 导航意图 —— 20 §9 BR-09（DR-09：白名单/30min token/24h 兑换绑定/不丢输入）。 */
class NavigationIntentTest {

    private static final Instant NOW = Instant.parse("2026-09-22T10:00:00Z");
    private static final Intent INTENT =
            new Intent("formula", 7L, "drill", "weekly", "https://go.mathorigin.cn/x");

    @Test
    void whitelists_typeAndAction() {
        for (String t : Set.of("node", "formula", "question", "event", "path")) {
            assertTrue(NavigationIntent.validType(t), t);
        }
        assertFalse(NavigationIntent.validType("http"));
        assertFalse(NavigationIntent.validType("USER"), "类型大小写归一=小写白名单");
        assertFalse(NavigationIntent.validType("u"));
        for (String a : Set.of("read", "drill", "join", "start")) {
            assertTrue(NavigationIntent.validAction(a), a);
        }
        assertFalse(NavigationIntent.validAction("delete"));
        assertTrue(NavigationIntent.valid(INTENT));
        assertFalse(NavigationIntent.valid(new Intent("node", 0, "read", "x", null)), "targetId>0");
    }

    @Test
    void resolve_mints30minToken_onlyForRegisteredPermittedResources() {
        Resolved ok = NavigationIntent.resolve(INTENT, true, true, "勾股定理", NOW);
        assertTrue(ok.allowed());
        assertNotNull(ok.resumeToken());
        assertEquals(NOW.plus(Duration.ofMinutes(30)), ok.expiresAt(), "token 30 分钟");
        assertEquals("勾股定理", ok.displayTitle());
        assertEquals(NavigationIntent.continueHint("勾股定理"), "完成后继续学习：勾股定理");

        // 下架资源 → 不发 token
        Resolved delisted = NavigationIntent.resolve(INTENT, false, true, "勾股定理", NOW);
        assertFalse(delisted.allowed());
        assertNull(delisted.resumeToken());
        // 无权限
        Resolved denied = NavigationIntent.resolve(INTENT, true, false, "勾股定理", NOW);
        assertFalse(denied.allowed());
        // 非法 intent
        Resolved bad = NavigationIntent.resolve(new Intent("evil", 1, "read", "x", null), true, true, "t", NOW);
        assertFalse(bad.allowed());
        // 过期判定
        assertFalse(ok.expired(NOW.plus(Duration.ofMinutes(29))));
        assertTrue(ok.expired(NOW.plus(Duration.ofMinutes(31))));
        // token 随机性
        assertNotEquals(ok.resumeToken(),
                NavigationIntent.resolve(INTENT, true, true, "勾股定理", NOW).resumeToken());
    }

    @Test
    void exchange_bindSameAccount_idempotent24h_crossAccountRejected() {
        // 首次兑换 → 绑定
        Exchange first = NavigationIntent.exchange(null, 1001L, INTENT, NOW);
        assertTrue(first.ok());
        ResumeBinding bound = new ResumeBinding(first.resumeId(), 1001L, first.target(),
                NOW, NOW.plus(Duration.ofHours(24)), false);

        // 同账号 24h 内重复读 → 同一 resumeId/目标
        Exchange replay = NavigationIntent.exchange(bound, 1001L, INTENT, NOW.plus(Duration.ofHours(20)));
        assertTrue(replay.ok());
        assertEquals(bound.resumeId(), replay.resumeId());
        assertEquals(INTENT.targetId(), replay.target().targetId());

        // 其他账号 → 拒绝
        Exchange other = NavigationIntent.exchange(bound, 2002L, INTENT, NOW);
        assertFalse(other.ok());
        assertTrue(other.reason().contains("其他账号"));

        // 超 24h → 过期
        Exchange late = NavigationIntent.exchange(bound, 1001L, INTENT, NOW.plus(Duration.ofHours(25)));
        assertFalse(late.ok());
        assertTrue(late.reason().contains("24h"));
        assertFalse(bound.readableAt(NOW.plus(Duration.ofHours(25))));
        assertTrue(bound.readableAt(NOW.plus(Duration.ofHours(1))));
    }

    @Test
    void consume_afterNavigation_idempotent() {
        ResumeBinding b = new ResumeBinding("r1", 1001L, INTENT, NOW,
                NOW.plus(Duration.ofHours(24)), false);
        ResumeBinding consumed = NavigationIntent.consume(b, true);
        assertTrue(consumed.consumed());
        assertFalse(consumed.readableAt(NOW.plus(Duration.ofHours(1))), "consumed 后不再回放");
        ResumeBinding again = NavigationIntent.consume(consumed, true);
        assertTrue(again.consumed(), "幂等");
        assertFalse(NavigationIntent.consume(b, false).consumed(), "未确认导航不消费");
    }

    @Test
    void landingPolicy_targetFirst_assessmentNonBlocking() {
        assertEquals(Landing.RETURN_TARGET, NavigationIntent.choose(INTENT));
        assertEquals(Landing.DEFAULT_HOME, NavigationIntent.choose(null), "无目标才默认首页");
    }

    @Test
    void shareUrl_onlyPublicTargetAndFrom() {
        String url = NavigationIntent.shareUrl(INTENT);
        assertEquals("/go?t=formula&id=7&action=drill&from=https://go.mathorigin.cn/x", url);
        assertFalse(url.contains("1001"), "不携账号");
        assertFalse(url.contains("token"), "不携 token");
    }

    @Test
    void unavailable_keepsInput_offersExits() {
        String m = NavigationIntent.unavailableMessage(true, false, "已填 2 空");
        assertTrue(m.contains("已过期"));
        assertTrue(m.contains("保留"));
        assertTrue(m.contains("搜索"));
        assertTrue(m.contains("复制输入"));
        assertTrue(m.contains("已填 2 空"));
        assertFalse(m.contains("返回首页"), "不静默落首页");
        String m2 = NavigationIntent.unavailableMessage(false, true, null);
        assertTrue(m2.contains("下架"));
        assertFalse(NavigationIntent.createsRecordsOnResolve(), "解析不创建成绩/报名");
        assertTrue(Set.of("node", "formula", "question", "event", "path")
                .containsAll(Set.of("node", "path")));
    }
}
