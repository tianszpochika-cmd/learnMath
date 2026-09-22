package com.learnmath.admin.common;

/** 管理域常用错误码子集（全量见 04 §3；与 app 同码同义）。 */
public enum ErrorCode {

    NOT_LOGIN(2001, "未登录"),
    TOKEN_EXPIRED(2003, "登录已过期"),
    FORBIDDEN(2004, "无权限"),
    GRAPH_CYCLE(3310, "图谱成环"),
    REVISION_CONFLICT(3012, "内容版本冲突，请刷新后重试"),
    PARAM_INVALID(1001, "参数校验失败"),
    INTERNAL_ERROR(5000, "内部错误");

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
