import { describe, expect, it, vi } from "vitest";
import { createHttpClient } from "@learnmath/api-client";
import { clearMobileSession, createUniTransport, mobileUrl, setMobileSession } from "./mobileClient";

describe("移动端管理学员域请求", () => {
  it("只允许学员域路径，并安全编码查询", () => {
    expect(mobileUrl("https://example.test/", { method: "GET", path: "/api/app/v1/search", query: { q: "x+y", page: 2 } }))
      .toBe("https://example.test/api/app/v1/search?q=x%2By&page=2");
    expect(() => mobileUrl("", { method: "GET", path: "/api/admin/v1/users" })).toThrow();
  });
  it("uni.request 响应仍由统一客户端核对业务 code", async () => {
    const calls: Array<{ url: string; authorization: string | undefined }> = [];
    const transport = createUniTransport((options) => {
      calls.push({ url: options.url, authorization: options.header.authorization });
      options.success({ statusCode: 200, data: { code: 0, data: { ok: true } } });
    }, "https://api.example.test");
    const client = createHttpClient({ baseUrl: "", transport, getAccess: () => "access", onAccess: () => {} });
    await expect(client.request<{ ok: boolean }>({ method: "GET", path: "/api/app/v1/user/home" })).resolves.toEqual({ ok: true });
    expect(calls).toEqual([{ url: "https://api.example.test/api/app/v1/user/home", authorization: "Bearer access" }]);
  });
  it("网络失败不被当作成功", async () => {
    const transport = createUniTransport((options) => options.fail(new Error("offline")), "");
    await expect(transport({ method: "GET", path: "/api/app/v1/user/home" }, null)).rejects.toThrow();
  });
  it("退出清除当前账号草稿与作答标记，保留其他账号数据", () => {
    const removed: string[] = [];
    vi.stubGlobal("uni", {
      setStorageSync: () => {}, removeStorageSync: (key: string) => removed.push(key),
      getStorageInfoSync: () => ({ keys: ["lm.mobile.draft:u1:a1:1", "lm.mobile.draft:u2:a2:1", "unrelated"] }),
    });
    setMobileSession({ accessToken: "a", refreshToken: "r", userId: "u1" });
    clearMobileSession();
    expect(removed).toEqual(["lm.mobile.draft:u1:a1:1", "lm.mobile.activeAttempt:u1", "lm.mobile.auth"]);
    vi.unstubAllGlobals();
  });
});
