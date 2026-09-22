import { describe, expect, it } from "vitest";
import { createHttpClient, type Transport } from "../src/http.js";
import { createAuthApi } from "../src/modules/auth.js";

describe("auth 模块薄封装（04 §4.1 路径）", () => {
  it("loginBySms/refresh/logout 打到约定路径", async () => {
    const calls: string[] = [];
    const t: Transport = async (req) => {
      calls.push(`${req.method} ${req.path}`);
      return { status: 200, json: { code: 0, message: "ok", data: { accessToken: "a", refreshToken: "r", userId: "1", needAssessment: true } } };
    };
    const client = createHttpClient({
      baseUrl: "http://x",
      transport: t,
      getAccess: () => "a",
      onAccess: () => {},
    });
    const api = createAuthApi(client);
    const res = await api.loginBySms({ phone: "13800000000", smsCode: "123456" });
    expect(res.needAssessment).toBe(true);
    await api.refresh("r");
    await api.logout();
    expect(calls).toEqual([
      "POST /api/app/v1/auth/login",
      "POST /api/app/v1/auth/refresh",
      "POST /api/app/v1/auth/logout",
    ]);
  });
});
