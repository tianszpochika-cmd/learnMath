package com.learnmath.app.common;

/**
 * 错误码（04 §3 分段总表的落地枚举；新增错误码必须同步 04）。
 */
public enum ErrorCode {

    // 1xxx 参数
    PARAM_INVALID(1001, "参数校验失败"),
    CAPTCHA_ERROR(1002, "验证码错误或过期"),
    TOO_FREQUENT(1004, "请求过于频繁"),

    // 2xxx 认证授权
    NOT_LOGIN(2001, "未登录"),
    TOKEN_EXPIRED(2003, "登录已过期，请重新登录"),
    FORBIDDEN(2004, "无权限"),
    ACCOUNT_LOCKED(2005, "账号已锁定，请稍后再试"),
    ACCOUNT_EXISTS(2006, "账号已存在"),
    CONSENT_REQUIRED(2007, "请先同意用户协议与隐私政策"),
    ACCOUNT_IN_COOL_DOWN(2008, "账号注销冷静期，不可登录"),
    ACCOUNT_ANONYMIZED(2009, "账号已注销"),
    CONCURRENT_ATTEMPT_EXISTS(3007, "存在进行中的作答"),
    PLAN_REVISION_CONFLICT(3011, "计划已被修改，请查看差异后确认"),

    // 31xx AI
    AI_DISABLED(3100, "AI 未启用"),
    AI_LIMITED(3101, "AI 次数或积分不足"),
    AI_UPSTREAM_ERROR(3102, "AI 服务暂时不可用"),

    // 32xx 第三方
    THIRD_PARTY_NOT_CONFIGURED(3200, "该功能未配置"),

    // 33xx 图谱/路径
    GRAPH_CYCLE(3310, "图谱成环"),
    PREREQUISITE_NOT_MET(3311, "前置条件未满足"),
    LADDER_NOT_MET(3312, "晋级条件未达"),

    // 34xx 社区
    CONTENT_PENDING_REVIEW(3401, "内容命中审核，暂不可见"),
    CONTENT_DELETED(3402, "内容已删除"),
    DUPLICATE_LIKE(3403, "请勿重复点赞"),

    // 35xx 游戏化
    ALREADY_CHECKED_IN(3501, "今日已打卡"),
    MAKEUP_CARD_INSUFFICIENT(3502, "补签卡不足"),
    POINTS_INSUFFICIENT(3503, "积分余额不足"),

    // 5xxx 系统
    INTERNAL_ERROR(5000, "内部错误"),
    RATE_LIMITED(5003, "触发限流"),
    SERVICE_UNAVAILABLE(5004, "服务暂不可用");

    private final int code;
    private final String defaultMessage;

    ErrorCode(int code, String defaultMessage) {
        this.code = code;
        this.defaultMessage = defaultMessage;
    }

    public int code() {
        return code;
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}
