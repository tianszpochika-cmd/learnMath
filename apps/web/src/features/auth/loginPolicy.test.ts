import { describe, expect, it } from "vitest";
import {
  ALL_CHANNELS_ON,
  availableChannels,
  assessmentPromptPlacement,
  consentOutdated,
  continueLearningHint,
  isValidCnMobile,
  loginSuccessRoute,
  normalizePhone,
  primaryChannel,
  smsSubmitDecision,
} from "./loginPolicy";

describe("渠道降级与主次（16W01 · M2 · 3200）", () => {
  it("全配置排序 验证码→微信→邮箱→密码", () => {
    expect(availableChannels(ALL_CHANNELS_ON)).toEqual(["sms", "wechat", "email", "password"]);
    expect(primaryChannel(ALL_CHANNELS_ON)).toBe("sms");
  });
  it("未配置渠道隐藏且主渠道回退", () => {
    const cfg = { sms: false, wechat: false, email: true, password: true };
    expect(availableChannels(cfg)).toEqual(["email", "password"]);
    expect(primaryChannel(cfg)).toBe("password");
    expect(primaryChannel({ sms: false, wechat: true, email: false, password: false })).toBe("wechat");
    expect(primaryChannel({ sms: false, wechat: false, email: false, password: false })).toBeNull();
  });
  it("渠道关闭时提交被 3200 拦截", () => {
    const d = smsSubmitDecision({
      phoneRaw: "13888888888",
      agreed: true,
      cooldownSec: 0,
      channelEnabled: false,
    });
    expect(d.ok).toBe(false);
    expect(d.block).toBe("no-channel");
    expect(d.message).toContain("3200");
  });
});

describe("表单校验（01 U-01/U-05 · 1004/2007）", () => {
  it("手机号归一与校验", () => {
    expect(normalizePhone("+86 138-8888-8888")).toBe("13888888888");
    expect(normalizePhone("86 138 8888 8888")).toBe("13888888888");
    expect(isValidCnMobile("13888888888")).toBe(true);
    expect(isValidCnMobile("12888888888")).toBe(false);
    expect(isValidCnMobile("1388888888")).toBe(false);
    expect(isValidCnMobile("")).toBe(false);
    expect(isValidCnMobile("+86 138 8888 8888")).toBe(true);
  });

  it("拦截优先级：协议(2007) → 手机号 → 频控(1004)", () => {
    const base = { phoneRaw: "13888888888", agreed: true, cooldownSec: 0, channelEnabled: true };
    expect(smsSubmitDecision(base).ok).toBe(true);

    const noConsent = smsSubmitDecision({ ...base, agreed: false });
    expect(noConsent.block).toBe("consent");
    expect(noConsent.message).toContain("2007");

    const badPhone = smsSubmitDecision({ ...base, phoneRaw: "110" });
    expect(badPhone.block).toBe("phone");

    const cooling = smsSubmitDecision({ ...base, cooldownSec: 42 });
    expect(cooling.block).toBe("cooldown");
    expect(cooling.message).toContain("42s");
  });

  it("协议版本过期 → 需重新确认", () => {
    expect(consentOutdated("v1.1", "v1.1")).toBe(false);
    expect(consentOutdated("v1.0", "v1.1")).toBe(true);
    expect(consentOutdated(null, "v1.1")).toBe(true);
    expect(consentOutdated("v1.1", null)).toBe(true);
  });
});

describe("登录落地与测评提示（20 §9 BR-09）", () => {
  it("有目标先回资源（开放重定向已被兜底）", () => {
    expect(loginSuccessRoute("/deepdive/question/12")).toBe("/deepdive/question/12");
    expect(loginSuccessRoute("/paper/9?from=weekly")).toBe("/paper/9?from=weekly");
    expect(loginSuccessRoute("https://evil.com")).toBe("/");
    expect(loginSuccessRoute(null)).toBe("/");
  });

  it("测评提示形态：有目标=banner(非阻塞)，无目标=modal(S03)", () => {
    expect(assessmentPromptPlacement("/graph")).toBe("banner");
    expect(assessmentPromptPlacement(null)).toBe("modal");
    expect(assessmentPromptPlacement(undefined)).toBe("modal");
    expect(assessmentPromptPlacement("https://evil")).toBe("modal"); // 拦截后视为无目标
  });

  it("继续学习提示语", () => {
    expect(continueLearningHint("勾股定理")).toBe("完成后继续学习：勾股定理");
    expect(continueLearningHint("  ")).toBe("完成后继续学习：（目标）");
    expect(continueLearningHint(null)).toBe("完成后继续学习：（目标）");
  });
});
