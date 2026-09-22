package com.learnmath.app.auth;

import com.learnmath.app.common.BizException;
import com.learnmath.app.common.ErrorCode;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * 双域 JWT（02 §4.3 / 04 §2）：签发-解析回环、篡改、过期、跨域互用（B-06）。
 */
class TokenCodecTest {

    private static final String APP_SECRET = "app-secret-0123456789abcdef";
    private static final String ADMIN_SECRET = "admin-secret-0123456789abcdef";

    private final TokenCodec app = new TokenCodec(APP_SECRET, TokenCodec.DOMAIN_APP);
    private final TokenCodec admin = new TokenCodec(ADMIN_SECRET, TokenCodec.DOMAIN_ADMIN);

    @Test
    void issue_parse_roundTrip() {
        String token = app.issue("1001");
        TokenCodec.Claims claims = app.parse(token, TokenCodec.DOMAIN_APP);
        assertEquals("1001", claims.subject());
        assertEquals("app", claims.domain());
        assertTrue(claims.jti() != null && !claims.jti().isBlank());
        assertTrue(claims.expiresAt().isAfter(Instant.now()));
    }

    @Test
    void crossDomain_appTokenOnAdminApi_rejected2004() {
        // 04 §3：app/admin 双域独立，互用 → 2004
        String appToken = app.issue("1001");
        try {
            admin.parse(appToken, TokenCodec.DOMAIN_ADMIN);
            fail("should reject cross-domain token");
        } catch (BizException e) {
            assertEquals(ErrorCode.FORBIDDEN, e.error());
            assertEquals(2004, e.code());
        }
    }

    @Test
    void expired_rejected2003() {
        String token = app.issue("1001", Duration.ofSeconds(-5), TokenCodec.newJti());
        try {
            app.parse(token, TokenCodec.DOMAIN_APP);
            fail("should reject expired");
        } catch (BizException e) {
            assertEquals(ErrorCode.TOKEN_EXPIRED, e.error());
            assertEquals(2003, e.code());
        }
    }

    @Test
    void tamperedSignature_rejected2001() {
        String token = app.issue("1001");
        String[] parts = token.split("\\.");
        String forged = parts[0] + "." + parts[1] + "." +
                java.util.Base64.getUrlEncoder().withoutPadding().encodeToString("x".getBytes());
        try {
            app.parse(forged, TokenCodec.DOMAIN_APP);
            fail("should reject forged signature");
        } catch (BizException e) {
            assertEquals(2001, e.code());
        }
    }

    @Test
    void differentSecrets_produceDifferentSignatures() {
        String t1 = app.issue("1001");
        TokenCodec other = new TokenCodec("another-secret-0123456789ab", TokenCodec.DOMAIN_APP);
        try {
            other.parse(t1, TokenCodec.DOMAIN_APP);
            fail("secret must be independent");
        } catch (BizException e) {
            assertEquals(2001, e.code());
        }
        assertNotEquals(t1, admin.issue("1001"));
    }

    @Test
    void blankToken_notLogin2001() {
        try {
            app.parse("  ", TokenCodec.DOMAIN_APP);
            fail();
        } catch (BizException e) {
            assertEquals(2001, e.code());
        }
    }
}
