import { describe, expect, it } from "vitest";
import { resolveAfterLogin, resolveGuard } from "./guard";

describe("登录守卫（BR-09 前端语义）", () => {
  it("开放重定向防护：仅站内相对路径放行", () => {
    expect(resolveAfterLogin(null)).toBe("/");
    expect(resolveAfterLogin(undefined)).toBe("/");
    expect(resolveAfterLogin("")).toBe("/");
    expect(resolveAfterLogin("/deepdive/question/1")).toBe("/deepdive/question/1");
    expect(resolveAfterLogin("/paper/9?mode=drill")).toBe("/paper/9?mode=drill");
    expect(resolveAfterLogin("//evil.com")).toBe("/");
    expect(resolveAfterLogin("/\\evil")).toBe("/");
    expect(resolveAfterLogin("https://evil.com")).toBe("/");
    expect(resolveAfterLogin("http://evil.com")).toBe("/");
    expect(resolveAfterLogin("javascript:alert(1)")).toBe("/");
  });

  it("未登录访问受保护页 → 跳登录并携带 redirect", () => {
    const out = resolveGuard(
      {
        name: "graph",
        meta: { requiresAuth: true },
        fullPath: "/graph",
        query: {},
      } as never,
      { isAuthenticated: () => false },
    );
    expect(out).not.toBeNull();
    const target = out as unknown as { name: string; query: { redirect: string } };
    expect(target.name).toBe("login");
    expect(target.query.redirect).toBe("/graph");
    expect(resolveAfterLogin(target.query.redirect)).toBe("/graph");
  });

  it("已登录访问受保护页 → 放行；访问登录页 → 按 redirect 落地", () => {
    expect(
      resolveGuard(
        { name: "home", meta: { requiresAuth: true }, fullPath: "/", query: {} } as never,
        { isAuthenticated: () => true },
      ),
    ).toBeNull();
    const back = resolveGuard(
      { name: "login", meta: {}, fullPath: "/login", query: { redirect: "/plans" } } as never,
      { isAuthenticated: () => true },
    );
    expect(back).toBe("/plans");
    const evil = resolveGuard(
      { name: "login", meta: {}, fullPath: "/login", query: { redirect: "https://evil" } } as never,
      { isAuthenticated: () => true },
    );
    expect(evil).toBe("/");
  });

  it("公开页未登录直接放行", () => {
    expect(
      resolveGuard({ name: "login", meta: {}, fullPath: "/login", query: {} } as never, {
        isAuthenticated: () => false,
      }),
    ).toBeNull();
  });
});
