<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { menuSections } from "./features/adminShell";
import { logoutAdmin } from "./services/client";
import { useAdminAuthStore } from "./stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAdminAuthStore();
const sections = menuSections();
const collapsed = ref(false);
const mobileMenu = ref(false);
const theme = ref<"light" | "dark">("light");
const isLogin = computed(() => route.name === "login");
const title = computed(() => typeof route.meta.title === "string" ? route.meta.title : "管理工作台");
watch(() => route.fullPath, () => { mobileMenu.value = false; });
watch(theme, (value) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = value;
  try { localStorage.setItem("lm.admin.theme", value); } catch { /* storage unavailable */ }
});
onMounted(() => {
  try {
    const saved = localStorage.getItem("lm.admin.theme");
    theme.value = saved === "dark" || saved === "light" ? saved : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  } catch { theme.value = "light"; }
});

async function logout() {
  let remoteFailed = false;
  try { await logoutAdmin(); }
  catch { remoteFailed = true; }
  await router.replace(remoteFailed ? { path: "/login", query: { logout: "local" } } : "/login");
}
function toggleMenu() {
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches) mobileMenu.value = !mobileMenu.value;
  else collapsed.value = !collapsed.value;
}
</script>

<template>
  <RouterView v-if="isLogin" />
  <div v-else class="shell" :class="{ collapsed, 'mobile-open': mobileMenu }">
    <aside class="menu" aria-label="管理导航">
      <RouterLink class="mlogo" to="/dashboard"><span class="mark">π</span><span v-if="!collapsed" class="brand-text">数源 <small>管理工作台</small></span></RouterLink>
      <div v-for="section in sections" :key="section.group" class="menu-section">
        <p v-if="!collapsed" class="mgrp">{{ section.group }}</p>
        <RouterLink v-for="entry in section.items" :key="entry.name" :to="entry.path" class="mi" :class="{ on: route.name === entry.name }" :title="entry.label" :aria-current="route.name === entry.name ? 'page' : undefined">
          <span class="ico">{{ entry.label.slice(0, 1) }}</span><span v-if="!collapsed" class="lbl">{{ entry.label }}</span><span v-if="entry.star && !collapsed" class="star">★</span>
        </RouterLink>
      </div>
    </aside>
    <button v-if="mobileMenu" class="menu-backdrop" type="button" aria-label="关闭导航" @click="mobileMenu = false" />
    <div class="main">
      <header class="top">
        <button class="fold" type="button" :aria-label="mobileMenu ? '关闭导航' : '展开或折叠导航'" @click="toggleMenu">☰</button>
        <span class="crumb">数源管理端 <span>/</span> <strong>{{ title }}</strong></span>
        <div class="right">
          <button class="top-action" type="button" :aria-label="theme === 'dark' ? '切换浅色主题' : '切换深色主题'" @click="theme = theme === 'dark' ? 'light' : 'dark'">{{ theme === "dark" ? "☀" : "☾" }}</button>
          <span class="account">{{ auth.adminName || "管理员" }}</span>
          <button class="top-action logout" type="button" @click="logout">退出</button>
        </div>
      </header>
      <main class="body"><RouterView /></main>
    </div>
  </div>
</template>

<style scoped>
.shell{display:flex;min-height:100vh;background:var(--bg-page);color:var(--ink)}.menu{position:sticky;top:0;align-self:flex-start;flex:none;width:224px;height:100vh;overflow:auto;background:var(--ops-card);border-right:1px solid var(--line);transition:width .2s}.collapsed .menu{width:68px}.mlogo{display:flex;align-items:center;gap:10px;min-height:70px;padding:15px;color:var(--ink);text-decoration:none;font-weight:850;white-space:nowrap;border-bottom:1px solid var(--line)}.mark{display:grid;place-items:center;width:36px;height:36px;flex:none;border-radius:10px;background:var(--grad);color:var(--ops-on-brand);font:italic 800 22px Georgia,serif}.brand-text small{display:block;color:var(--ink3);font-size:10px;letter-spacing:.13em}.menu-section{padding-top:8px}.mgrp{padding:13px 18px 6px;color:var(--ink3);font-size:10px;font-weight:800;letter-spacing:.13em}.mi{display:flex;align-items:center;gap:10px;min-height:42px;margin:2px 8px;padding:8px 10px;border-radius:9px;color:var(--ink2);text-decoration:none;font-size:13px}.mi:hover,.mi.on{background:var(--brand-soft);color:var(--brand-deep)}.mi.on{font-weight:800}.ico{width:25px;flex:none;text-align:center;font-weight:850}.star{margin-left:auto;color:var(--brand-deep)}.main{display:flex;flex:1;min-width:0;flex-direction:column}.top{display:flex;align-items:center;gap:13px;min-height:62px;padding:0 24px;background:var(--ops-card);border-bottom:1px solid var(--line)}.fold,.top-action{min-width:34px;min-height:34px;padding:6px 9px;border:1px solid var(--line);border-radius:8px;background:var(--ops-card);color:var(--ink)}.crumb{font-size:13px;color:var(--ink2)}.crumb span{padding:0 5px;color:var(--ink3)}.crumb strong{color:var(--ink)}.right{display:flex;align-items:center;gap:9px;margin-left:auto}.account{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink2);font-size:12px}.body{flex:1;padding:28px;min-width:0}.shell-notice{margin:12px 28px 0;padding:10px 13px;border-radius:9px;background:var(--ops-warn-bg);color:var(--ink)}.menu-backdrop{display:none}
@media(max-width:800px){.menu{position:fixed;z-index:80;transform:translateX(-101%);width:224px!important;transition:transform .2s}.mobile-open .menu{transform:translateX(0)}.menu-backdrop{display:block;position:fixed;inset:0;z-index:70;border:0;background:#0711269c}.body{padding:18px}.top{padding:0 16px}.account{display:none}.collapsed .menu .brand-text,.collapsed .menu .mgrp,.collapsed .menu .lbl{display:block}}
@media(max-width:520px){.crumb{font-size:11px}.logout{font-size:12px}.body{padding:14px}}
</style>
