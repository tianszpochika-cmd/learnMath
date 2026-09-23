import { createMemoryHistory, createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { ensureAuthSession } from "../services/client";
import { resolveGuard } from "./guard";

/**
 * 路由表（16 §3 · 16 §4 深钻 typed 路由 · BR-09 intent 经 redirect/query 透传）。
 * 公开页仅 /login；其余 requiresAuth。
 */
export const routes: RouteRecordRaw[] = [
  { path: "/login", name: "login", component: () => import("../views/W01Login.vue"), meta: { title: "登录" } },
  { path: "/", name: "home", component: () => import("../views/W02Home.vue"), meta: { requiresAuth: true, title: "首页" } },
  { path: "/paths", name: "paths", component: () => import("../views/W03Course.vue"), meta: { requiresAuth: true, title: "路径中心" } },
  { path: "/paths/course/:id", name: "course", component: () => import("../views/W03Course.vue"), meta: { requiresAuth: true, title: "课程详情" } },
  { path: "/learn/:courseId/:lessonId", name: "lesson", component: () => import("../views/W04Lesson.vue"), meta: { requiresAuth: true, title: "课时" } },
  { path: "/deepdive/:type/:id", name: "deepdive", component: () => import("../views/W05Deepdive.vue"), meta: { requiresAuth: true, title: "深钻" } },
  { path: "/graph", name: "graph", component: () => import("../views/W06Graph.vue"), meta: { requiresAuth: true, title: "知识图谱" } },
  { path: "/graph/node/:id", name: "graph-node", component: () => import("../views/W07Node.vue"), meta: { requiresAuth: true, title: "知识点" } },
  { path: "/paper/:attemptId", name: "paper", component: () => import("../views/W08Paper.vue"), meta: { requiresAuth: true, title: "作答" } },
  { path: "/report/attempt/:id", name: "attempt-report", component: () => import("../views/W09Report.vue"), meta: { requiresAuth: true, title: "成绩报告" } },
  { path: "/wrongbook", name: "wrongbook", component: () => import("../views/W10Wrongbook.vue"), meta: { requiresAuth: true, title: "错题本" } },
  { path: "/assessment/:id", name: "assessment", component: () => import("../views/W11Assessment.vue"), meta: { requiresAuth: true, title: "测评" } },
  { path: "/assessment/result/:id", name: "assessment-result", component: () => import("../views/W11Assessment.vue"), meta: { requiresAuth: true, title: "测评报告" } },
  { path: "/plans", name: "plans", component: () => import("../views/W12Plans.vue"), meta: { requiresAuth: true, title: "学习计划" } },
  { path: "/report", name: "stats", component: () => import("../views/W13Stats.vue"), meta: { requiresAuth: true, title: "学习统计" } },
  { path: "/formulas", name: "formulas", component: () => import("../views/W14Formulas.vue"), meta: { requiresAuth: true, title: "公式馆" } },
  { path: "/formulas/:id", name: "formula-detail", component: () => import("../views/W14Formulas.vue"), meta: { requiresAuth: true, title: "公式详情" } },
  { path: "/community", name: "community", component: () => import("../views/W15Community.vue"), meta: { requiresAuth: true, title: "社区" } },
  { path: "/community/post/:id", name: "post", component: () => import("../views/W15Community.vue"), meta: { requiresAuth: true, title: "帖子" } },
  { path: "/community/ask", name: "ask", component: () => import("../views/W15Community.vue"), meta: { requiresAuth: true, title: "发帖" } },
  { path: "/rank", name: "rank", component: () => import("../views/W16Rank.vue"), meta: { requiresAuth: true, title: "排行榜" } },
  { path: "/me/settings", name: "settings", component: () => import("../views/W17Me.vue"), meta: { requiresAuth: true, title: "设置" } },
  { path: "/me/account", name: "account", component: () => import("../views/W17Me.vue"), meta: { requiresAuth: true, title: "账户" } },
  { path: "/me/notifications", name: "notifications", component: () => import("../views/W17Me.vue"), meta: { requiresAuth: true, title: "通知" } },
  { path: "/search", name: "search", component: () => import("../views/W18Search.vue"), meta: { requiresAuth: true, title: "搜索" } },
];

export const router = createRouter({
  // 浏览器用 history 模式；node（vitest）无 window → memory 模式（零依赖可测）
  history: typeof window !== "undefined" ? createWebHistory() : createMemoryHistory(),
  routes,
});

/**
 * 守卫（逻辑在 guard.ts 纯函数化）。
 * 注册于模块级：首次导航发生在 app.use(router) 时，pinia 已先行安装（main.ts 顺序保证）；
 * 单测只 import routes，不触发导航，故无全局态依赖。
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.accessToken && auth.refreshToken) await ensureAuthSession();
  const redirect = resolveGuard(to as never, { isAuthenticated: () => auth.isAuthenticated });
  if (typeof document !== "undefined" && typeof to.meta.title === "string") {
    document.title = `${to.meta.title} · 数源 MathOrigin`;
  }
  return redirect ?? true;
});
