import type { RouteLocationNormalized } from "vue-router";

/**
 * 登录守卫（16 §5 · BR-09 前端语义：redirect/query 透传恢复目标）。
 * 纯函数化便于单测：resolveAfterLogin 亦承担开放重定向防护。
 */

export interface GuardDeps {
  isAuthenticated(): boolean;
}

/** 登录成功后的落地：仅接受站内相对路径（防开放重定向：`//`、`\`、`http(s)://` 一律回首页）。 */
export function resolveAfterLogin(redirect: string | null | undefined): string {
  if (!redirect) {
    return "/";
  }
  if (!redirect.startsWith("/") || redirect.startsWith("//") || redirect.startsWith("/\\")) {
    return "/";
  }
  if (/^https?:/i.test(redirect)) {
    return "/";
  }
  return redirect;
}

/** 路由守卫主逻辑。返回 null = 放行。 */
export function resolveGuard(to: RouteLocationNormalized, deps: GuardDeps): string | null {
  const requiresAuth = to.meta.requiresAuth === true;
  if (requiresAuth && !deps.isAuthenticated()) {
    // 未登录 → 带 redirect 回登录（BR-09：登录后回到原目标；intent 随 query 透传）
    return { name: "login", query: { redirect: to.fullPath } } as unknown as string;
  }
  if (to.name === "login" && deps.isAuthenticated()) {
    const redirect = typeof to.query.redirect === "string" ? to.query.redirect : null;
    return resolveAfterLogin(redirect);
  }
  return null;
}
