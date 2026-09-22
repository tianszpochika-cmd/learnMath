package com.learnmath.app.common;

/**
 * 业务异常：携带错误码，由全局异常处理器转为 ApiResponse（02 §4.1：禁止 controller 吞错）。
 */
public class BizException extends RuntimeException {

    private final ErrorCode error;
    private final String detail;

    public BizException(ErrorCode error) {
        this(error, null);
    }

    public BizException(ErrorCode error, String detail) {
        super(detail == null ? error.defaultMessage() : detail);
        this.error = error;
        this.detail = detail;
    }

    public ErrorCode error() {
        return error;
    }

    public String detail() {
        return detail;
    }

    public int code() {
        return error.code();
    }
}
