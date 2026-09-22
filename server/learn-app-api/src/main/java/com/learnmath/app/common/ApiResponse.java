package com.learnmath.app.common;

/**
 * 统一响应体（04 §1）：{ code, message, data }。
 * HTTP 恒 200（网关/系统级除外），业务态看 code。
 */
public record ApiResponse<T>(int code, String message, T data) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(0, "ok", data);
    }

    public static ApiResponse<Void> ok() {
        return new ApiResponse<>(0, "ok", null);
    }

    public static <T> ApiResponse<T> fail(ErrorCode error) {
        return new ApiResponse<>(error.code(), error.defaultMessage(), null);
    }

    public static <T> ApiResponse<T> fail(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }
}
