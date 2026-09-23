import { describe, expect, it } from "vitest";
import type { HttpClient } from "@learnmath/api-client";
import { createOperationsApi, pageResult, publicConfigEntries, safeId, userStatusLabel } from "./operations";

describe("管理端运营数据边界", () => {
  it("空响应不补演示记录或总数，拒绝不安全编号", () => {
    expect(pageResult({})).toEqual({ items: [], total: null });
    expect(() => safeId("../other")).toThrow();
  });
  it("审核删除必须带原因，且只向管理域发请求", async () => {
    const calls: string[] = [];
    const client = { request: async ({ path }: { path: string }) => { calls.push(path); return { items: [] }; }, refreshing: () => null } as unknown as HttpClient;
    const api = createOperationsApi(client);
    await expect(api.audit("post", "12", "delete", "  ")).rejects.toThrow();
    await api.audit("post", "12", "delete", "广告");
    expect(calls).toEqual(["/api/admin/v1/community/post/12/audit"]);
  });
  it("配置展示隐藏凭证键", () => {
    expect(publicConfigEntries({ enabled: true, apiKey: "sensitive", accessToken: "sensitive", model: "alpha" }))
      .toEqual([{ key: "enabled", value: "是" }, { key: "model", value: "alpha" }]);
  });
  it("账号状态使用已定义的 1/2 编码，冷静期不当作正常", async () => {
    const bodies: unknown[] = [];
    const client = { request: async ({ body }: { body?: unknown }) => { bodies.push(body); return {}; }, refreshing: () => null } as unknown as HttpClient;
    await createOperationsApi(client).setUserStatus("7", "disabled", "用户申请");
    expect(bodies).toEqual([{ status: 2, reason: "用户申请" }]);
    expect(userStatusLabel(3)).toBe("注销冷静期");
  });
});
