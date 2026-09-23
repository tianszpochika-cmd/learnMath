import { afterEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { getAppHttp } from "./client";
import { useAuthStore } from "../stores/auth";

afterEach(() => vi.unstubAllGlobals());

describe("app HTTP session renewal", () => {
  it("refreshes once for business 2003 and retries with the new access token", async () => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.setSession({ accessToken: "old", refreshToken: "refresh-1", userId: "7" });
    const accesses: string[] = [];
    let refreshes = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
      const path = new URL(input, "http://example.test").pathname;
      if (path.endsWith("/auth/refresh")) {
        refreshes += 1;
        expect((init.headers as Record<string, string>).authorization).toBeUndefined();
        return new Response(JSON.stringify({ code: 0, data: { accessToken: "new", refreshToken: "refresh-2" } }), { status: 200 });
      }
      const access = (init.headers as Record<string, string>).authorization;
      accesses.push(access);
      return new Response(JSON.stringify(access === "Bearer old"
        ? { code: 2003, message: "过期", data: null }
        : { code: 0, data: { ok: true } }), { status: 200 });
    }));
    const results = await Promise.all([
      getAppHttp().request<{ ok: boolean }>({ method: "GET", path: "/api/app/v1/graph" }),
      getAppHttp().request<{ ok: boolean }>({ method: "GET", path: "/api/app/v1/plans" })
    ]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(accesses).toEqual(["Bearer old", "Bearer old", "Bearer new", "Bearer new"]);
    expect(refreshes).toBe(1);
    expect(auth.refreshToken).toBe("refresh-2");
  });
});
