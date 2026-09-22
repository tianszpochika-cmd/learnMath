package com.learnmath.app.auth;

import com.learnmath.app.common.BizException;
import com.learnmath.app.common.ErrorCode;

import java.util.ArrayList;
import java.util.List;

/**
 * 认证渠道策略（01 U-01 · M2「验证码为主 + 更多方式折叠」· 未配置渠道降级隐藏，3200）。
 * 纯逻辑：配置开关由服务层从 config 表读入，本类只做可用性与顺序决策。
 */
public final class ChannelPolicy {

    /** 渠道配置开关（"是否已配置"语义：短信/微信第三方 Key 未配 → false）。 */
    public record ChannelConfig(
            boolean sms,          // 手机验证码（含短信发送）
            boolean wechat,       // 微信登录
            boolean email,        // 邮箱注册/登录
            boolean accountPassword // 账号密码（本地能力，恒可配）
    ) {
        public static ChannelConfig allOn() {
            return new ChannelConfig(true, true, true, true);
        }
    }

    public static final String CH_SMS = "sms";
    public static final String CH_WECHAT = "wechat";
    public static final String CH_EMAIL = "email";
    public static final String CH_PASSWORD = "password";

    private ChannelPolicy() {
    }

    /** 注册/登录主次顺序（M2：验证码为主 → 微信 → 邮箱 → 账号密码）。 */
    public static List<String> availableChannels(ChannelConfig cfg) {
        List<String> list = new ArrayList<>();
        if (cfg.sms()) {
            list.add(CH_SMS);
        }
        if (cfg.wechat()) {
            list.add(CH_WECHAT);
        }
        if (cfg.email()) {
            list.add(CH_EMAIL);
        }
        if (cfg.accountPassword()) {
            list.add(CH_PASSWORD);
        }
        return List.copyOf(list);
    }

    /** 主渠道（前端"验证码为主"按钮）：sms 未配置时回退 password；全关则无主渠道。 */
    public static String primaryChannel(ChannelConfig cfg) {
        if (cfg.sms()) {
            return CH_SMS;
        }
        if (cfg.accountPassword()) {
            return CH_PASSWORD;
        }
        if (cfg.wechat()) {
            return CH_WECHAT;
        }
        return cfg.email() ? CH_EMAIL : null;
    }

    /** 使用指定渠道；未配置 → 3200（该功能未配置，前端应已隐藏入口）。 */
    public static void requireChannel(ChannelConfig cfg, String channel) {
        if (channel == null || !availableChannels(cfg).contains(channel)) {
            throw new BizException(ErrorCode.THIRD_PARTY_NOT_CONFIGURED, "channel not configured: " + channel);
        }
    }

    /**
     * 协议同意校验（01 U-05：注册必须勾选；协议发新版本后存量用户下次登录需重新确认）。
     * @param providedChecked 用户是否勾选
     * @param providedVersion 用户同意时的协议版本（前端携带/登录时比对）
     * @param currentVersion  当前生效协议版本（article type=legal 最新 published）
     */
    public static void requireConsent(boolean providedChecked, String providedVersion, String currentVersion) {
        if (!providedChecked) {
            throw new BizException(ErrorCode.CONSENT_REQUIRED, "协议未勾选");
        }
        if (providedVersion == null || currentVersion == null || !providedVersion.equals(currentVersion)) {
            throw new BizException(ErrorCode.CONSENT_REQUIRED, "协议版本已更新，需重新确认");
        }
    }
}
