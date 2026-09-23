import type { HttpClient, HttpRequest } from "@learnmath/api-client";
import { describe, expect, it } from "vitest";
import { createFormulaApi } from "./formulas";

describe("formula API boundaries", () => {
  it("uses documented filters and creates a standard attempt before navigation", async () => {
    const calls: HttpRequest[] = [];
    const client: HttpClient = {
      refreshing: () => null,
      request: async <T>(request: HttpRequest): Promise<T> => {
        calls.push(request);
        return (request.method === "POST" ? { attemptId: 42 } : { items: [] }) as T;
      },
    };
    const api = createFormulaApi(client);
    await api.list({ keyword: "商高", domain: 3, tier: 2, proofStatus: 1, quality: null, page: 1, size: 12 });
    expect(calls[0]).toMatchObject({ method: "GET", path: "/api/app/v1/formulas",
      query: { keyword: "商高", domain: 3, tier: 2, proof_status: 1, page: 1, size: 12 } });
    expect(await api.drill(21, "VARIANT_RECOGNIZE")).toBe(42);
    expect(calls[1]).toMatchObject({ method: "POST", path: "/api/app/v1/formulas/21/drill", body: { type: "variant", count: 1 } });
  });

  it("rejects a success envelope with no actual attempt and invalid formula ids", async () => {
    const client: HttpClient = { refreshing: () => null, request: async <T>(): Promise<T> => ({} as T) };
    const api = createFormulaApi(client);
    await expect(api.drill(21, "CONDITION_JUDGE")).rejects.toThrow("作答编号");
    await expect(api.detail(0)).rejects.toThrow("公式编号");
  });
});
