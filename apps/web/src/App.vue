<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AiChatPanel from "./components/AiChatPanel.vue";
import { useAuthStore } from "./stores/auth";

type Theme = "light" | "dark";
const THEME_KEY = "lm.web.theme";
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const menuOpen = ref(false);
const menuButton = ref<HTMLButtonElement | null>(null);
const drawer = ref<HTMLElement | null>(null);
const drawerClose = ref<HTMLButtonElement | null>(null);

const mainLinks = [
  { to: "/", label: "今日" },
  { to: "/paths", label: "课程" },
  { to: "/graph", label: "图谱" },
  { to: "/wrongbook", label: "错题" },
  { to: "/formulas", label: "公式馆" },
];
const extraLinks = [
  { to: "/plans", label: "学习计划" },
  { to: "/report", label: "学习统计" },
  { to: "/community", label: "社区" },
  { to: "/me/notifications", label: "通知" },
  { to: "/me/settings", label: "个人设置" },
];

// 路由就绪并持有会话时才显示学习壳；服务端仍负责最终鉴权。
const showShell = computed(() => Boolean(route.name) && route.name !== "login" && auth.isAuthenticated);
const inAnswerFlow = computed(() => ["paper", "assessment"].includes(String(route.name)));
const aiPages = new Set([
  "home", "paths", "course", "lesson", "deepdive", "graph", "graph-node", "wrongbook", "plans", "formulas", "formula-detail",
]);
const showAi = computed(() => showShell.value && aiPages.has(String(route.name)));
function isActiveLink(to: string): boolean {
  return to === "/" ? route.path === "/" : route.path === to || route.path.startsWith(to + "/");
}

function storedTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}
function systemTheme(): Theme {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
const initialPreference = storedTheme();
const followsSystem = ref(initialPreference === null);
const theme = ref<Theme>(initialPreference ?? systemTheme());
let mediaQuery: MediaQueryList | null = null;
let previousBodyOverflow = "";
function applyTheme(): void {
  if (typeof document !== "undefined") document.documentElement.dataset.theme = theme.value;
}
applyTheme();
function onSystemThemeChange(event: MediaQueryListEvent): void {
  if (!followsSystem.value) return;
  theme.value = event.matches ? "dark" : "light";
  applyTheme();
}
function toggleTheme(): void {
  theme.value = theme.value === "dark" ? "light" : "dark";
  followsSystem.value = false;
  applyTheme();
  try {
    window.localStorage.setItem(THEME_KEY, theme.value);
  } catch {
    // 隐私模式下本次访问仍可切换主题。
  }
}

function closeMenu(restoreFocus = true): void {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  document.body.style.overflow = previousBodyOverflow;
  if (restoreFocus) void nextTick(() => menuButton.value?.focus());
}
async function openMenu(): Promise<void> {
  if (menuOpen.value) return;
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  menuOpen.value = true;
  await nextTick();
  drawerClose.value?.focus();
}
function toggleMenu(): void {
  if (menuOpen.value) closeMenu();
  else void openMenu();
}
function openSearch(): void {
  if (!showShell.value || inAnswerFlow.value) return;
  closeMenu(false);
  void router.push("/search");
}
function isEditable(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
}
function trapDrawerFocus(event: KeyboardEvent): void {
  const focusable = Array.from(drawer.value?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? []);
  if (!focusable.length) return;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && (document.activeElement === first || !drawer.value?.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !drawer.value?.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
}
function onGlobalKeydown(event: KeyboardEvent): void {
  if (menuOpen.value && event.key === "Escape") {
    event.preventDefault();
    closeMenu();
    return;
  }
  if (menuOpen.value && event.key === "Tab") {
    trapDrawerFocus(event);
    return;
  }
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "k") return;
  if (isEditable(event.target) || !showShell.value || inAnswerFlow.value) return;
  event.preventDefault();
  openSearch();
}
function onResize(): void {
  if (window.innerWidth >= 1024) closeMenu(false);
}
watch(() => route.fullPath, () => closeMenu(false));
onMounted(() => {
  document.addEventListener("keydown", onGlobalKeydown);
  window.addEventListener("resize", onResize);
  if (typeof window.matchMedia === "function") {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", onSystemThemeChange);
  }
});
onBeforeUnmount(() => {
  closeMenu(false);
  document.removeEventListener("keydown", onGlobalKeydown);
  window.removeEventListener("resize", onResize);
  mediaQuery?.removeEventListener("change", onSystemThemeChange);
});
</script>

<template>
  <div class="shell" :class="{ 'shell--login': !showShell }">
    <header v-if="showShell" class="site-nav">
      <div class="nav-inner">
        <RouterLink to="/" class="brand" aria-label="数源 MathOrigin，返回今日学习">
          <span class="brand-mark" aria-hidden="true">π</span>
          <span class="brand-word">数源 <span>MathOrigin</span></span>
        </RouterLink>
        <nav class="desktop-links" aria-label="学习主导航">
          <RouterLink v-for="link in mainLinks" :key="link.to" :to="link.to" :class="{ 'is-active': isActiveLink(link.to) }">{{ link.label }}</RouterLink>
        </nav>
        <div class="nav-actions">
          <button v-if="!inAnswerFlow" type="button" class="search-trigger" aria-keyshortcuts="Control+K Meta+K" aria-label="打开搜索，快捷键 Ctrl 或 Command 加 K" @click="openSearch">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4" /><path d="m15.7 15.7 4.2 4.2" /></svg>
            <span>搜索</span><kbd>Ctrl K</kbd>
          </button>
          <button type="button" class="icon-button" :aria-label="theme === 'dark' ? '切换至浅色主题' : '切换至深色主题'" :title="theme === 'dark' ? '浅色主题' : '深色主题'" @click="toggleTheme">
            <svg v-if="theme === 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M20.2 15.9A8.5 8.5 0 0 1 8.1 3.8 8.5 8.5 0 1 0 20.2 15.9Z" /></svg>
          </button>
          <RouterLink to="/me/notifications" class="icon-button desktop-utility" aria-label="通知" title="通知">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4" /></svg>
          </RouterLink>
          <RouterLink to="/me/settings" class="profile-link desktop-utility" aria-label="个人设置" title="个人设置">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.3" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>
          </RouterLink>
          <button ref="menuButton" type="button" class="icon-button menu-trigger" aria-controls="mobile-learning-nav" :aria-expanded="menuOpen" :aria-label="menuOpen ? '关闭导航菜单' : '打开导航菜单'" @click="toggleMenu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
        </div>
      </div>
    </header>
    <div v-show="showShell && menuOpen" class="mobile-layer">
      <button type="button" class="mobile-backdrop" aria-label="关闭导航菜单" tabindex="-1" @click="closeMenu()" />
      <aside id="mobile-learning-nav" ref="drawer" class="mobile-drawer" role="dialog" aria-modal="true" aria-label="学习导航">
        <div class="drawer-head">
          <span>学习导航</span>
          <button ref="drawerClose" type="button" class="icon-button" aria-label="关闭导航菜单" @click="closeMenu()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" /></svg>
          </button>
        </div>
        <nav aria-label="移动端学习主导航" class="drawer-links">
          <RouterLink v-for="link in mainLinks" :key="link.to" :to="link.to" :class="{ 'is-active': isActiveLink(link.to) }" @click="closeMenu(false)">{{ link.label }}</RouterLink>
        </nav>
        <div class="drawer-label">更多</div>
        <nav aria-label="更多学习页面" class="drawer-links drawer-extra">
          <RouterLink v-for="link in extraLinks" :key="link.to" :to="link.to" @click="closeMenu(false)">{{ link.label }}</RouterLink>
          <button v-if="!inAnswerFlow" type="button" @click="openSearch">搜索</button>
        </nav>
      </aside>
    </div>
    <main class="content" :class="{ 'content--login': !showShell }" :inert="menuOpen">
      <RouterView />
    </main>
    <div v-if="showAi" :inert="menuOpen" class="ai-region"><AiChatPanel /></div>
  </div>
</template>

<style scoped>
.shell { min-height: 100vh; display: flex; flex-direction: column; }
.shell--login { --nav-h: 0px; background: var(--deep); }
.site-nav { position: sticky; top: 0; z-index: 40; border-bottom: 1px solid var(--line); background: var(--paper); background: color-mix(in srgb, var(--paper) 92%, transparent); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
.nav-inner { max-width: 1440px; min-height: 68px; margin: auto; padding: 0 24px; display: flex; align-items: center; gap: 32px; }
.brand { display: inline-flex; align-items: center; gap: 10px; flex: none; color: var(--text); text-decoration: none; white-space: nowrap; }
.brand-mark { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 10px; background: var(--grad); color: #fff; font: italic 22px var(--serif); }
.brand-word { font: 700 18px var(--serif); letter-spacing: -.025em; }
.brand-word span { letter-spacing: -.035em; }
.desktop-links { display: flex; align-items: center; gap: 4px; min-width: 0; }
.desktop-links a { padding: 9px 14px; border-radius: 9px; color: var(--muted); font-size: 14px; font-weight: 650; text-decoration: none; white-space: nowrap; transition: color .18s, background-color .18s; }
.desktop-links a:hover, .desktop-links a.is-active { background: var(--primary-soft); color: var(--primary-deep); }
.nav-actions { display: flex; align-items: center; gap: 9px; margin-left: auto; }
.search-trigger, .icon-button, .profile-link { display: inline-flex; align-items: center; justify-content: center; height: 38px; border: 1px solid var(--line); border-radius: 10px; background: var(--paper); color: var(--body); cursor: pointer; text-decoration: none; }
.search-trigger:hover, .icon-button:hover, .profile-link:hover { border-color: var(--primary); color: var(--primary-deep); }
.search-trigger { gap: 8px; padding: 0 9px 0 10px; min-width: 142px; color: var(--muted); font-size: 13px; }
.search-trigger svg, .icon-button svg, .profile-link svg { display: block; width: 19px; height: 19px; flex: none; }
.search-trigger kbd { margin-left: auto; padding: 2px 5px; border: 1px solid var(--line); border-radius: 5px; font: 11px var(--sans); color: var(--faint); }
.icon-button { width: 38px; padding: 0; }
.profile-link { width: 36px; height: 36px; border-radius: 50%; background: var(--primary-soft); border-color: transparent; color: var(--primary-deep); }
.menu-trigger { display: none; }
.content { flex: 1; min-width: 0; }
.content--login { background: var(--deep); }
.mobile-layer { position: fixed; inset: 0; z-index: 60; }
.mobile-backdrop { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: rgba(3, 9, 22, .52); cursor: pointer; }
.mobile-drawer { position: absolute; top: 0; right: 0; bottom: 0; width: min(360px, 88vw); overflow-y: auto; padding: 20px; background: var(--paper); box-shadow: -20px 0 60px rgba(3, 9, 22, .22); }
.drawer-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; color: var(--text); font: 700 20px var(--serif); }
.drawer-links { display: grid; gap: 4px; }
.drawer-links a, .drawer-links button { display: block; width: 100%; padding: 13px 14px; border: 0; border-radius: 9px; background: transparent; color: var(--body); font: 650 15px var(--sans); text-align: left; text-decoration: none; cursor: pointer; }
.drawer-links a:hover, .drawer-links button:hover, .drawer-links a.is-active, .drawer-links a.router-link-exact-active { background: var(--primary-soft); color: var(--primary-deep); }
.drawer-label { margin: 22px 14px 8px; color: var(--muted); font-size: 12px; font-weight: 700; letter-spacing: .1em; }
.drawer-extra { border-top: 1px solid var(--line); padding-top: 8px; }
@media (max-width: 1190px) { .nav-inner { gap: 15px; } .desktop-links a { padding: 9px 10px; } .search-trigger { min-width: 38px; width: 38px; padding: 0; } .search-trigger span, .search-trigger kbd { display: none; } }
@media (max-width: 1023px) { .desktop-links, .desktop-utility { display: none; } .menu-trigger { display: inline-flex; } }
@media (max-width: 767px) { .nav-inner { min-height: 60px; padding: 0 16px; gap: 12px; } .brand-mark { width: 30px; height: 30px; font-size: 18px; } .brand-word { font-size: 15px; } .brand-word span { display: none; } .nav-actions { gap: 6px; } .icon-button, .search-trigger { width: 36px; height: 36px; min-width: 36px; } }
@media (prefers-reduced-motion: reduce) { .desktop-links a { transition: none; } }
</style>
