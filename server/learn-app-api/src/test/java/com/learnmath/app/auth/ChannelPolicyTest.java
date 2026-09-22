package com.learnmath.app.auth;

import com.learnmath.app.auth.ChannelPolicy.ChannelConfig;
import com.learnmath.app.common.BizException;
import com.learnmath.app.common.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 认证渠道降级 + 协议同意版本（01 U-01/U-05 · M2 · 3200/2007）。
 */
class ChannelPolicyTest {

    @Test
    void allConfigured_orderMatchesM2() {
        List<String> ch = ChannelPolicy.availableChannels(ChannelConfig.allOn());
        assertEquals(List.of("sms", "wechat", "email", "password"), ch);
        assertEquals("sms", ChannelPolicy.primaryChannel(ChannelConfig.allOn()), "验证码为主（M2）");
    }

    @Test
    void unconfiguredChannels_hiddenAnd3200() {
        // 短信/微信未配置 → 自动隐藏（降级原则）；误调 → 3200
        ChannelConfig cfg = new ChannelConfig(false, false, true, true);
        List<String> ch = ChannelPolicy.availableChannels(cfg);
        assertEquals(List.of("email", "password"), ch);
        assertEquals("password", ChannelPolicy.primaryChannel(cfg), "sms 未配 → 回退账号密码");

        BizException ex = assertThrows(BizException.class, () -> ChannelPolicy.requireChannel(cfg, "sms"));
        assertEquals(ErrorCode.THIRD_PARTY_NOT_CONFIGURED, ex.error());
        assertEquals(3200, ex.code());

        // 已配置渠道放行（无异常）
        ChannelPolicy.requireChannel(cfg, "email");
    }

    @Test
    void allDisabled_noPrimary() {
        ChannelConfig none = new ChannelConfig(false, false, false, false);
        assertTrue(ChannelPolicy.availableChannels(none).isEmpty());
        assertEquals(null, ChannelPolicy.primaryChannel(none));
    }

    @Test
    void consent_unchecked_rejected2007() {
        BizException ex = assertThrows(BizException.class,
                () -> ChannelPolicy.requireConsent(false, "v1.1", "v1.1"));
        assertEquals(2007, ex.code());
    }

    @Test
    void consent_versionMismatch_rejected2007() {
        // 01 U-05：协议发新版本后，存量用户下次登录需重新确认
        BizException ex = assertThrows(BizException.class,
                () -> ChannelPolicy.requireConsent(true, "v1.0", "v1.1"));
        assertEquals(2007, ex.code());
        assertEquals(ErrorCode.CONSENT_REQUIRED, ex.error());
    }

    @Test
    void consent_ok() {
        ChannelPolicy.requireConsent(true, "v1.1", "v1.1");
    }
}
