import { describe, expect, it } from "vitest";
import { ApiError } from "@learnmath/shared";
import { createHttpClient, type HttpRequest, type Transport } from "../src/http.js";

/** 假 token 存储（测试内聚）。 */
function tokenBox(initial: string) {
  let cur = initial;
  return {
    get: () => cur,
    set: (t: string | null) => {
      if (t !== null) cur = t;
    },
  };
}

describe("api-client HTTP（业务解包 + 401 单飞刷新）", () => {
  it("code!==0 抛 ApiError；code===0 返回 data", async () => {
    const t: Transport = async () => ({
      status: 200,
      json: { code: 0, message: "ok", data: { id: 7 } },
    });
    const c = createHttpClient({
      baseUrl: "http://x",
      transport: t,
      getAccess: () => "a",
      onAccess: () => {},
    });
    expect(await c.request<{ id: number }>({ method: "GET", path: "/y" })).toEqual({ id: 7 });

    const t2: Transport = async () => ({
      status: 200,
      json: { code: 3101, message: "AI 次数或积分不足", data: null },
    });
    const c2 = createHttpClient({
      baseUrl: "http://x",
      transport: t2,
      getAccess: () => "a",
      onAccess: () => {},
    });
    await expect(c2.request({ method: "GET", path: "/y" })).rejects.toMatchObject({
      name: "ApiError",
      code: 3101,
      message: "AI 次数或积分不足",
    });
  });

  it("并发 401 → 刷新只发生 1 次，全部带新 token 重试成功", async () => {
    const box = tokenBox("v1");
    let refreshCount = 0;
    let transportCalls = 0;
    const t: Transport = async (req: HttpRequest, access: string | null) => {
      transportCalls++;
      if (access !== "v2") {
        return { status: 401, json: undefined }; // 旧 token 一律 401
      }
      return { status: 200, json: { code: 0, message: "ok", data: { path: req.path, access } } };
    };
    const c = createHttpClient({
      baseUrl: "http://x",
      transport: t,
      getAccess: box.get,
      onAccess: box.set,
      refreshCall: async () => {
        refreshCount++;
        await new Promise((r) => setTimeout(r, 5)); // 制造并发窗口
        return "v2";
      },
    });

    const results = await Promise.all([
      c.request<{ path: string; access: string }>({ method: "GET", path: "/a" }),
      c.request<{ path: string; access: string }>({ method: "GET", path: "/b" }),
      c.request<{ path: string; access: string }>({ method: "GET", path: "/c" }),
      c.request<{ path: string; access: string }>({ method: "GET", path: "/d" }),
      c.request<{ path: string; access: string }>({ method: "GET", path: "/e" }),
    ]);

    expect(refreshCount).toBe(1), "并发共享同一刷新 Promise（单飞）";
    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.access).toBe("v2");
    }
    // 每个请求：1 次 401 + 1 次成功 = 10 次调用（不是额外风暴）
    expect(transportCalls).toBe(10);
    expect(box.get()).toBe("v2");
    expect(c.refreshing()).toBeNull();
  });

  it("刷新失败 → 集体拒绝且在飞标记被清理（下轮可再刷）", async () => {
    const box = tokenBox("v1");
    let refreshCount = 0;
    const t: Transport = async (_req, access) => {
      if (access !== "v2") {
        return { status: 401 };
      }
      return { status: 200, json: { code: 0, message: "ok", data: "ok" } };
    };
    let failNext = true;
    const c = createHttpClient({
      baseUrl: "http://x",
      transport: t,
      getAccess: box.get,
      onAccess: box.set,
      refreshCall: async () => {
        refreshCount++;
        if (failNext) {
          throw new Error("refresh boom");
        }
        return "v2";
      },
    });

    const batch = await Promise.allSettled([
      c.request({ method: "GET", path: "/a" }),
      c.request({ method: "GET", path: "/b" }),
    ]);
    expect(batch.every((r) => r.status === "rejected")).toBe(true);
    expect(refreshCount).toBe(1);
    expect(c.refreshing()).toBeNull(), "失败也必须清理（否则永久卡死）";

    // 下一轮可再次尝试并成功
    failNext = false;
    await expect(c.request({ method: "GET", path: "/a" })).resolves.toBe("ok");
    expect(refreshCount).toBe(2);
  });

  it("未配置刷新 → 401 直接 2001 拒绝不重试", async () => {
    let calls = 0;
    const t: Transport = async () => {
      calls++;
      return { status: 401 };
    };
    const c = createHttpClient({
      baseUrl: "http://x",
      transport: t,
      getAccess: () => null,
      onAccess: () => {},
    });
    await expect(c.request({ method: "GET", path: "/a" })).rejects.toBeInstanceOf(ApiError);
    await expect(c.request({ method: "GET", path: "/a" })).rejects.toMatchObject({ code: 2001 });
    expect(calls).toBe(2);
  });

  it("HTTP 403/500 → 2004/5000", async () => {
    const mk = (status: number) =>
      createHttpClient({
        baseUrl: "http://x",
        transport: async () => ({ status }),
        getAccess: () => "a",
        onAccess: () => {},
      });
    await expect(mk(403).request({ method: "GET", path: "/a" })).rejects.toMatchObject({ code: 2004 });
    await expect(mk(500).request({ method: "GET", path: "/a" })).rejects.toMatchObject({ code: 5000 });
    await expect(mk(404).request({ method: "GET", path: "/a" })).rejects.toMatchObject({ code: 5004 });
    await expect(mk(429).request({ method: "GET", path: "/a" })).rejects.toMatchObject({ code: 1004 });
  });

  it("HTTP 200 缺少规范 code/data 时拒绝，避免把接口缺失或 HTML 当成功", async () => {
    for (const json of [undefined, null, "<html>not found</html>", {}, { code: 0 }, { code: "0", data: {} }]) {
      const c = createHttpClient({
        baseUrl: "http://x", transport: async () => ({ status: 200, json }),
        getAccess: () => null, onAccess: () => {}
      });
      await expect(c.request({ method: "POST", path: "/api/app/v1/attempts/1/submit" }))
        .rejects.toMatchObject({ code: 5004 });
    }
  });

  it("query 构建：空值省略、编码正确（经 URL 断言）", async () => {
    let seen = "";
    const t: Transport = async (req) => {
      const qs = new URLSearchParams();
      if (req.query) {
        for (const [k, v] of Object.entries(req.query)) {
          if (v !== undefined && v !== "") qs.append(k, String(v));
        }
      }
      seen = req.path + (qs.toString() ? `?${qs}` : "");
      return { status: 200, json: { code: 0, message: "ok", data: null } };
    };
    const c = createHttpClient({
      baseUrl: "http://x/",
      transport: t,
      getAccess: () => "a",
      onAccess: () => {},
    });
    await c.request({ method: "GET", path: "/api/app/v1/items", query: { page: 2, keyword: "勾股", empty: "" } });
    expect(seen).toBe("/api/app/v1/items?page=2&keyword=%E5%8B%BE%E8%82%A1");
  });
});
