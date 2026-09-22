package com.learnmath.admin.common;

/** 管理域业务异常（与 app 同构）。 */
public class BizException extends RuntimeException {

    private final ErrorCode error;

    public BizException(ErrorCode error) {
        super(error.defaultMessage());
        this.error = error;
    }

    public ErrorCode error() {
        return error;
    }

    public int code() {
        return error.code();
    }
}
