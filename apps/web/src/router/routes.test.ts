import { describe, expect, it } from "vitest";
import { routes } from "./index";

describe("路由表（16 §3）", () => {
  it("name 唯一且全部 lazy 组件", () => {
    const names = routes.map((r) => r.name as string);
    expect(new Set(names).size).toBe(names.length);
    for (const r of routes) {
      expect(typeof r.component).toBe("function"), `${String(r.name)} 必须懒加载`;
    }
  });

  it("仅 /login 公开，其余 requiresAuth", () => {
    const publicRoutes = routes.filter((r) => r.meta?.requiresAuth !== true);
    expect(publicRoutes.map((r) => r.path)).toEqual(["/login"]);
  });

  it("typed 深钻路由与关键路径齐备（16 §4）", () => {
    const paths = routes.map((r) => r.path);
    expect(paths).toContain("/deepdive/:type/:id");
    expect(paths).toContain("/graph");
    expect(paths).toContain("/paper/:attemptId");
    expect(paths).toContain("/wrongbook");
    expect(paths).toContain("/formulas/:id");
    expect(paths).toContain("/assessment/result/:id");
  });
});
