import { describe, expect, it } from "vitest";
import { createHttpClient, type Transport } from "../src/http.js";
import { createAuthApi, createNavigationIntentApi, normalizeLegalDocument, normalizeLoginResult } from "../src/modules/auth.js";

describe("auth 模块薄封装（04 §4.1 路径）", () => {
  it("短信发送、登录、注册和刷新使用 04 §4.1 路径", async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    const t: Transport = async (req) => {
      calls.push({ path: req.path, body: req.body });
      return { status: 200, json: { code: 0, message: "ok", data: { accessToken: "a", refreshToken: "r", user: { id: 1 }, needAssessment: true } } };
    };
    const client = createHttpClient({
      baseUrl: "http://x",
      transport: t,
      getAccess: () => "a",
      onAccess: () => {},
    });
    const api = createAuthApi(client);
    await api.sendSmsCode("13800000000", "register");
    const res = await api.loginBySms({ phone: "13800000000", smsCode: "123456" });
    expect(res.needAssessment).toBe(true);
    expect(res.userId).toBe("1");
    await api.registerByPhone({ phone: "13800000000", smsCode: "123456", consentVersion: "v1" });
    await api.refresh("r");
    await api.logout();
    expect(calls.map((call) => call.path)).toEqual([
      "/api/app/v1/auth/sms/send", "/api/app/v1/auth/login/sms",
      "/api/app/v1/auth/register/phone", "/api/app/v1/auth/refresh", "/api/app/v1/auth/logout"
    ]);
    expect(calls[0].body).toEqual({ phone: "13800000000", scene: "register" });
    expect(calls[2].body).toEqual({ phone: "13800000000", smsCode: "123456", consentVersion: "v1" });
  });

  it("不接受缺失令牌的成功响应；协议必须有正文", () => {
    expect(() => normalizeLoginResult({ accessToken: "a" })).toThrow("完整令牌");
    expect(normalizeLegalDocument("terms", { article: { title: "协议", content: "正文", legalVersion: "v2" } })?.version).toBe("v2");
    expect(normalizeLegalDocument("privacy", { article: { title: "隐私" } })).toBeNull();
  });

  it("恢复目标只发送 token，并在消费前校验 resumeId", async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    const client = createHttpClient({
      baseUrl: "http://x", getAccess: () => "a", onAccess: () => {},
      transport: async (req) => {
        calls.push({ path: req.path, body: req.body });
        return { status: 200, json: { code: 0, data: { resumeId: "r-1", target: { targetType: "formula", targetId: 12 } } } };
      }
    });
    const api = createNavigationIntentApi(client);
    expect((await api.redeem("opaque-token")).resumeId).toBe("r-1");
    await api.consume("r-1");
    await expect(api.consume("../../bad")).rejects.toThrow("编号无效");
    expect(calls).toEqual([
      { path: "/api/app/v1/navigation/intents/redeem", body: { resumeToken: "opaque-token" } },
      { path: "/api/app/v1/navigation/intents/r-1/consume", body: undefined }
    ]);
  });
});
