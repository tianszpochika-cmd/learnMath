package com.learnmath.app.domain;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 通知与订阅 —— 04 §4.11/§4.16 · 03 T60 幂等。 */
class NotifySubscribeTest {

    @Test
    void classify_fourCategories() {
        assertEquals(NotifySubscribe.Category.SYSTEM, NotifySubscribe.classify("account_locked"));
        assertEquals(NotifySubscribe.Category.SYSTEM, NotifySubscribe.classify(null));
        assertEquals(NotifySubscribe.Category.LEARNING, NotifySubscribe.classify("daily_drill_ready"));
        assertEquals(NotifySubscribe.Category.LEARNING, NotifySubscribe.classify("plan_reminder"));
        assertEquals(NotifySubscribe.Category.LEARNING, NotifySubscribe.classify("report_weekly"));
        assertEquals(NotifySubscribe.Category.LEARNING, NotifySubscribe.classify("achievement_unlock"));
        assertEquals(NotifySubscribe.Category.COMMUNITY, NotifySubscribe.classify("reply_created"));
        assertEquals(NotifySubscribe.Category.COMMUNITY, NotifySubscribe.classify("adopted"));
        assertEquals(NotifySubscribe.Category.MODERATION, NotifySubscribe.classify("audit_result"));
        assertEquals(NotifySubscribe.Category.MODERATION, NotifySubscribe.classify("report_result"));
    }

    @Test
    void deepLinks_perCategory() {
        assertEquals("/community/post/88", NotifySubscribe.deepLink("reply_created", 88));
        assertEquals("/do", NotifySubscribe.deepLink("daily_drill_ready", 0));
        assertEquals("/plans", NotifySubscribe.deepLink("plan_reminder", 0));
        assertEquals("/report", NotifySubscribe.deepLink("report_weekly", 0));
        assertEquals("/me/notifications", NotifySubscribe.deepLink("account_locked", 0));
        assertEquals("/me/notifications", NotifySubscribe.deepLink("unknown_x", 0));
    }

    @Test
    void unread_math_and_markRead() {
        List<NotifySubscribe.Category> unread = new ArrayList<>(List.of(
                NotifySubscribe.Category.LEARNING, NotifySubscribe.Category.LEARNING,
                NotifySubscribe.Category.COMMUNITY, NotifySubscribe.Category.SYSTEM));
        NotifySubscribe.Unread u = NotifySubscribe.unreadByCategory(unread);
        assertEquals(2, u.learning());
        assertEquals(1, u.community());
        assertEquals(1, u.system());
        assertEquals(0, u.moderation());
        assertEquals(4, u.total());
        assertEquals(0, NotifySubscribe.unreadByCategory(null).total());

        List<NotifySubscribe.Category> after = NotifySubscribe.markRead(unread, NotifySubscribe.Category.LEARNING);
        assertEquals(2, after.size(), "分类已读清掉该类全部");
        assertFalse(after.contains(NotifySubscribe.Category.LEARNING));
    }

    @Test
    void emailValidation() {
        assertTrue(NotifySubscribe.validEmail("a@b.co"));
        assertTrue(NotifySubscribe.validEmail(" user.name+tag@example.com "));
        assertFalse(NotifySubscribe.validEmail("bad@@x"));
        assertFalse(NotifySubscribe.validEmail("no-at.com"));
        assertFalse(NotifySubscribe.validEmail(null));
        assertFalse(NotifySubscribe.validEmail("a@b.c"), "单字符 TLD 不合法");
    }

    @Test
    void subscribe_idempotentState_unsubscribeIdempotent_resubscribeAllowed() {
        Set<String> subs = new LinkedHashSet<>();
        NotifySubscribe.SubscribeResult first = NotifySubscribe.subscribe(subs, "u@x.com");
        assertTrue(first.ok());
        assertFalse(first.alreadySubscribed());
        subs.add("u@x.com");

        // 重复订阅 → 幂等"已订"态（不报错，T60 UNIQUE 语义）
        NotifySubscribe.SubscribeResult again = NotifySubscribe.subscribe(subs, " U@X.COM ");
        assertTrue(again.ok());
        assertTrue(again.alreadySubscribed(), "大小写归一命中已订");

        // 非法邮箱
        assertFalse(NotifySubscribe.subscribe(subs, "not-email").ok());

        // 退订幂等
        NotifySubscribe.UnsubscribeResult un = NotifySubscribe.unsubscribe(subs, "u@x.com");
        assertTrue(un.ok());
        assertTrue(un.wasSubscribed());
        subs.remove("u@x.com");
        NotifySubscribe.UnsubscribeResult un2 = NotifySubscribe.unsubscribe(subs, "u@x.com");
        assertTrue(un2.ok());
        assertFalse(un2.wasSubscribed(), "重复退订幂等");
        assertTrue(NotifySubscribe.canResubscribeAfterUnsubscribe(subs, "u@x.com"), "退订后可再订");
        assertTrue(NotifySubscribe.copyOf(null).isEmpty());
    }
}
