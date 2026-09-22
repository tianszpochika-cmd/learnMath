import { describe, expect, it } from "vitest";
import { ApiError, ERROR_MESSAGES, isApiError, messageForCode } from "../src/errors.js";

describe("错误码镜像（04 §3）", () => {
  it("关键错误码文案与后端一致", () => {
    expect(messageForCode(2001)).toBe("未登录");
    expect(messageForCode(3011)).toBe("计划已被修改，请查看差异后确认");
    expect(messageForCode(3101)).toBe("AI 次数或积分不足");
    expect(messageForCode(3310)).toBe("图谱成环");
    expect(messageForCode(3401)).toBe("内容命中审核，暂不可见");
  });

  it("未知码兜底", () => {
    expect(messageForCode(9999)).toContain("9999");
    expect(ERROR_MESSAGES[1234]).toBeUndefined();
  });

  it("ApiError 类型与文案回落", () => {
    const e = new ApiError(3502);
    expect(isApiError(e)).toBe(true);
    expect(e.message).toBe("补签卡不足");
    const custom = new ApiError(42, "自定义说明");
    expect(custom.message).toBe("自定义说明");
    expect(isApiError(new Error("x"))).toBe(false);
  });
});
