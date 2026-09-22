package com.learnmath.app.domain;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 合规三件套 + 每日题排期（01 U-06/U-07 · 03 T61 · BR-01 隔离）。 */
class ComplianceRulesTest {

    private static final Instant NOW = Instant.parse("2026-09-22T00:00:00Z");

    @Test
    void deletion_requiresSecondFactor() {
        assertThrows(IllegalArgumentException.class,
                () -> ComplianceRules.requestDeletion(false, NOW));
        ComplianceRules.DeletionRequest req = ComplianceRules.requestDeletion(true, NOW);
        assertEquals(ComplianceRules.AccountState.PENDING_COOL_DOWN, req.state());
        assertEquals(NOW.plus(Duration.ofDays(7)), req.dueAt(), "冷静期 7 天");
    }

    @Test
    void coolDown_states_and_loginCodes() {
        ComplianceRules.DeletionRequest req = ComplianceRules.requestDeletion(true, NOW);
        Instant day6 = NOW.plus(Duration.ofDays(6).plusHours(23));
        // 第 6 天 23h：仍在冷静期 → 2008 + 撤销提示
        assertEquals(ComplianceRules.AccountState.PENDING_COOL_DOWN,
                ComplianceRules.resolveState(req, day6));
        ComplianceRules.LoginOutcome blocked = ComplianceRules.loginDecision(req, day6);
        assertFalse(blocked.allowed());
        assertEquals(2008, blocked.code());
        assertTrue(blocked.hint().contains("撤销"));
        assertTrue(ComplianceRules.cancelAllowed(req, day6), "到期前可撤销");

        // 到期 → 匿名化 2009，不可撤销
        Instant due = NOW.plus(Duration.ofDays(7));
        assertEquals(ComplianceRules.AccountState.ANONYMIZED, ComplianceRules.resolveState(req, due));
        assertFalse(ComplianceRules.cancelAllowed(req, due));
        ComplianceRules.LoginOutcome gone = ComplianceRules.loginDecision(req, due);
        assertEquals(2009, gone.code());
        assertFalse(gone.allowed());

        // 正常账号
        assertTrue(ComplianceRules.loginDecision(null, NOW).allowed());
    }

    @Test
    void anonymize_clearsPii_and_postsShowAnonymized() {
        Map<String, Object> out = ComplianceRules.anonymizePii("老张", "13800000000", "a@b.c", "av.png");
        assertEquals(ComplianceRules.ANONYMIZED_NAME, out.get("nickname"));
        assertNull(out.get("phone"));
        assertNull(out.get("email"));
        assertNull(out.get("wechat_openid"));
        assertNull(out.get("password_hash"));
        assertNotNull(out.get("nickname_raw_hash"), "原昵称只留哈希");

        // 社区三态作者展示
        assertEquals("老张", ComplianceRules.postAuthorDisplay("老张", ComplianceRules.AccountState.ACTIVE));
        assertEquals("老张", ComplianceRules.postAuthorDisplay("老张", ComplianceRules.AccountState.PENDING_COOL_DOWN));
        assertEquals(ComplianceRules.ANONYMIZED_NAME,
                ComplianceRules.postAuthorDisplay("老张", ComplianceRules.AccountState.ANONYMIZED));
    }

    @Test
    void exportLink_7days_validity() {
        assertTrue(ComplianceRules.exportLinkValid(NOW, NOW.plus(Duration.ofDays(6).plusHours(23))));
        assertFalse(ComplianceRules.exportLinkValid(NOW, NOW.plus(Duration.ofDays(7))), "7 天过期");
        assertFalse(ComplianceRules.exportLinkValid(null, NOW));
        assertEquals(Duration.ofDays(7), ComplianceRules.exportLinkTtl());
    }

    @Test
    void dailySchedule_curatedOnly_uniquePerDate() {
        assertFalse(ComplianceRules.scheduleDailyQuestion(false, false).allowed(),
                "ai_draft 拒绝（仅 curated 可排）");
        assertTrue(ComplianceRules.scheduleDailyQuestion(false, false).reason().contains("curated"));
        assertFalse(ComplianceRules.scheduleDailyQuestion(true, true).allowed(), "同日重复拒绝");
        assertTrue(ComplianceRules.scheduleDailyQuestion(true, false).allowed());
    }

    @Test
    void dailyFamily_blockedFromCompetitive() {
        Set<Long> publishedDaily = Set.of(1001L, 1002L);
        assertTrue(ComplianceRules.competitiveSourceBlocked(1001L, publishedDaily), "公开每日题族禁入测评/晋级/Boss/挑战");
        assertFalse(ComplianceRules.competitiveSourceBlocked(2001L, publishedDaily));
        assertFalse(ComplianceRules.competitiveSourceBlocked(1001L, Set.of()), "未公开不受限");
    }
}
