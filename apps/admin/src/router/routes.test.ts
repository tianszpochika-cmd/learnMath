import { describe, expect, it } from "vitest";
import { routes } from "./index";
import { menuSections, menuRouteNames } from "../features/adminShell";

describe("管理端路由表（17 屏）", () => {
  it("name 唯一、全懒加载、仅 /login 公开", () => {
    const named = routes.filter((r) => r.name);
    const names = named.map((r) => r.name as string);
    expect(new Set(names).size).toBe(names.length);
    for (const r of named) {
      expect(typeof r.component).toBe("function"), `${String(r.name)} 必须懒加载`;
    }
    const publicPaths = routes.filter((r) => r.path === "/login" || r.redirect).map((r) => r.path);
    expect(publicPaths).toContain("/login");
    const openPages = named.filter((r) => r.meta?.requiresAuth !== true);
    expect(openPages.map((r) => r.name)).toEqual(["login"]);
  });

  it("19 屏齐备（A01-A19）", () => {
    const names = new Set(routes.filter((r) => r.name).map((r) => String(r.name)));
    const expectNames = [
      "login", "dashboard", "knowledge", "graph-edge", "courses", "lesson-edit",
      "questions", "question-edit", "papers", "assessment-config", "path-canvas",
      "chain-editor", "topics", "challenges", "users", "moderation", "ai", "stats", "system",
    ];
    for (const n of expectNames) {
      expect(names.has(n), `缺少路由 ${n}`).toBe(true);
    }
    expect(names.size).toBe(19);
  });

  it("菜单项都能在路由表找到；子页不在菜单", () => {
    const routeNames = new Set(routes.filter((r) => r.name).map((r) => String(r.name)));
    for (const n of menuRouteNames()) {
      expect(routeNames.has(n), `菜单指向不存在的路由 ${n}`).toBe(true);
    }
    const menuNames = new Set(menuSections().flatMap((s) => s.items.map((i) => i.name)));
    expect(menuNames.has("lesson-edit")).toBe(false);
    expect(menuNames.has("question-edit")).toBe(false);
    expect(routeNames.has("lesson-edit")).toBe(true);
  });
});
