import { createMemoryHistory, createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAdminAuthStore } from "../stores/auth";
import { ensureAdminSession } from "../services/client";
import { menuRouteNames } from "../features/adminShell";

/**
 * 管理端路由（17 屏 A01-A19；仅 /login 公开）。
 * 子页（lesson-edit / question-edit）不进菜单但独立可达。
 */
export const routes: RouteRecordRaw[] = [
  { path: "/login", name: "login", component: () => import("../views/A01Login.vue"), meta: { title: "登录" } },
  { path: "/", redirect: "/dashboard" },
  { path: "/dashboard", name: "dashboard", component: () => import("../views/A02Dashboard.vue"), meta: { requiresAuth: true, title: "运营大盘" } },
  { path: "/knowledge", name: "knowledge", component: () => import("../views/A03Knowledge.vue"), meta: { requiresAuth: true, title: "知识点树" } },
  { path: "/knowledge/edges", name: "graph-edge", component: () => import("../views/A04GraphEdge.vue"), meta: { requiresAuth: true, title: "图谱边编辑" } },
  { path: "/courses", name: "courses", component: () => import("../views/A05Courses.vue"), meta: { requiresAuth: true, title: "课程章节" } },
  { path: "/lessons/:id/edit", name: "lesson-edit", component: () => import("../views/A06LessonEdit.vue"), meta: { requiresAuth: true, title: "课时编辑" } },
  { path: "/questions", name: "questions", component: () => import("../views/A07Questions.vue"), meta: { requiresAuth: true, title: "题库" } },
  { path: "/questions/:id/edit", name: "question-edit", component: () => import("../views/A08QuestionEdit.vue"), meta: { requiresAuth: true, title: "题目编辑" } },
  { path: "/papers", name: "papers", component: () => import("../views/A09Papers.vue"), meta: { requiresAuth: true, title: "组卷" } },
  { path: "/assessments", name: "assessment-config", component: () => import("../views/A10Assessment.vue"), meta: { requiresAuth: true, title: "测评配置" } },
  { path: "/paths/editor", name: "path-canvas", component: () => import("../views/A11PathCanvas.vue"), meta: { requiresAuth: true, title: "路径编排器" } },
  { path: "/deepdive-editor", name: "chain-editor", component: () => import("../views/A12ChainEditor.vue"), meta: { requiresAuth: true, title: "推理链编辑" } },
  { path: "/topics", name: "topics", component: () => import("../views/A13Topics.vue"), meta: { requiresAuth: true, title: "专题编排" } },
  { path: "/challenges", name: "challenges", component: () => import("../views/A14Challenges.vue"), meta: { requiresAuth: true, title: "挑战赛" } },
  { path: "/users", name: "users", component: () => import("../views/A15Users.vue"), meta: { requiresAuth: true, title: "用户" } },
  { path: "/community/review", name: "moderation", component: () => import("../views/A16Moderation.vue"), meta: { requiresAuth: true, title: "社区审核" } },
  { path: "/ai", name: "ai", component: () => import("../views/A17Ai.vue"), meta: { requiresAuth: true, title: "AI/内容供给" } },
  { path: "/stats", name: "stats", component: () => import("../views/A18Stats.vue"), meta: { requiresAuth: true, title: "数据统计" } },
  { path: "/system", name: "system", component: () => import("../views/A19System.vue"), meta: { requiresAuth: true, title: "系统/日志" } },
];

export const router = createRouter({
  // 浏览器 history；node(vitest) 无 window → memory（零依赖可测）
  history: typeof window !== "undefined" ? createWebHistory() : createMemoryHistory(),
  routes,
});

/** 守卫：模块级注册（pinia 先装，main.ts 顺序保证）；title 同步。 */
router.beforeEach(async (to) => {
  const auth = useAdminAuthStore();
  if (to.meta.requiresAuth === true && !await ensureAdminSession()) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.name === "login" && (auth.isAuthenticated || (auth.refreshToken && await ensureAdminSession()))) {
    const redirect = typeof to.query.redirect === "string" ? to.query.redirect : "/dashboard";
    return redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/dashboard";
  }
  if (typeof document !== "undefined" && typeof to.meta.title === "string") {
    document.title = `${to.meta.title} · 数源管理端`;
  }
  return true;
});

export { menuRouteNames };
