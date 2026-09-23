<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { features, paths, siteSections } from "../utils/siteContent";

const CommandPalette = defineAsyncComponent(() => import("./CommandPalette.vue"));

const route = useRoute();
const root = ref<HTMLElement | null>(null);
const searchButton = ref<HTMLButtonElement | null>(null);
let paletteTrigger: HTMLElement | null = null;
const mobileOpen = ref(false);
const paletteOpen = ref(false);
const menu = ref<"product" | "resources" | null>(null);
const theme = ref<"light" | "dark">("light");
const webLoginUrl = new URL("/login", String(useRuntimeConfig().public.webBase)).toString();

function closeMenus() { menu.value = null; mobileOpen.value = false; }
function openPalette() {
  paletteTrigger = import.meta.client ? document.activeElement as HTMLElement | null : null;
  paletteOpen.value = true;
  closeMenus();
}
function toggleTheme() {
  theme.value = theme.value === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = theme.value;
  try { localStorage.setItem("lm-official-theme", theme.value); } catch { /* 私密模式只保留当前页面 */ }
}
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  const editing = target?.matches("input,textarea,[contenteditable='true']");
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" || (!editing && event.key === "/")) {
    event.preventDefault(); openPalette();
  } else if (event.key === "Escape") {
    paletteOpen.value = false; closeMenus();
  }
}
function onOutside(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) menu.value = null;
}
function onMenuFocusOut(event: FocusEvent) {
  const next = event.relatedTarget;
  if (next instanceof Node && (event.currentTarget as HTMLElement).contains(next)) return;
  menu.value = null;
}

onMounted(() => {
  theme.value = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  window.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onOutside);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  document.removeEventListener("click", onOutside);
  document.body.classList.remove("mobile-nav-open");
});
watch(mobileOpen, (open) => {
  if (import.meta.client) document.body.classList.toggle("mobile-nav-open", open);
});
watch(paletteOpen, (open) => {
  if (!open && import.meta.client) nextTick(() => {
    const target = paletteTrigger?.isConnected ? paletteTrigger : searchButton.value;
    target?.focus();
  });
});
watch(() => route.fullPath, () => { closeMenus(); paletteOpen.value = false; });
</script>

<template>
  <header ref="root" class="site-header">
    <a class="skip-link" href="#main-content">跳到正文</a>
    <div class="container header-inner">
      <NuxtLink to="/" class="brand" aria-label="数源 MathOrigin 首页"><span class="brand-mark" aria-hidden="true">π</span><span>数源 <small>MathOrigin</small></span></NuxtLink>
      <nav class="desktop-nav" aria-label="主导航">
        <div class="nav-parent" @mouseenter="menu = 'product'" @mouseleave="menu = null">
          <button type="button" :aria-expanded="menu === 'product'" aria-controls="product-menu" @click="menu = menu === 'product' ? null : 'product'" @focus="menu = 'product'">产品 <span aria-hidden="true">⌄</span></button>
          <div v-if="menu === 'product'" id="product-menu" class="mega-menu" @focusout="onMenuFocusOut">
            <div><h3>六条路径</h3><NuxtLink v-for="item in paths" :key="item.slug" :to="'/paths/' + item.slug" @click="closeMenus"><span class="menu-dot" :style="{ background: item.accent }" />{{ item.title }}<small>{{ item.summary }}</small></NuxtLink></div>
            <div><h3>三内核与功能</h3><NuxtLink v-for="item in features.slice(0, 8)" :key="item.slug" :to="'/features/' + item.slug" @click="closeMenus">{{ item.title }}<small>{{ item.eyebrow }}</small></NuxtLink></div>
            <div><h3>开始了解</h3><NuxtLink to="/features" @click="closeMenus">功能总览</NuxtLink><NuxtLink to="/pricing" @click="closeMenus">价格说明</NuxtLink><NuxtLink to="/roadmap" @click="closeMenus">产品路线图</NuxtLink></div>
          </div>
        </div>
        <div class="nav-parent" @mouseenter="menu = 'resources'" @mouseleave="menu = null">
          <button type="button" :aria-expanded="menu === 'resources'" aria-controls="resource-menu" @click="menu = menu === 'resources' ? null : 'resources'" @focus="menu = 'resources'">资源 <span aria-hidden="true">⌄</span></button>
          <div v-if="menu === 'resources'" id="resource-menu" class="mega-menu resource-menu" @focusout="onMenuFocusOut">
            <div><h3>公开学习资源</h3><NuxtLink to="/glossary" @click="closeMenus">数学词条<small>概念四卡与接龙</small></NuxtLink><NuxtLink to="/formulas" @click="closeMenus">公式馆<small>条件、符号与推导摘要</small></NuxtLink><NuxtLink to="/daily" @click="closeMenus">每日一题<small>题目与解析公开</small></NuxtLink><NuxtLink to="/timeline" @click="closeMenus">数学年表</NuxtLink><NuxtLink to="/tools" @click="closeMenus">探索工具</NuxtLink></div>
            <div><h3>阅读与帮助</h3><NuxtLink to="/blog" @click="closeMenus">文章</NuxtLink><NuxtLink to="/help" @click="closeMenus">帮助中心</NuxtLink><NuxtLink to="/faq" @click="closeMenus">常见问题</NuxtLink></div>
          </div>
        </div>
        <NuxtLink to="/blog">博客</NuxtLink><NuxtLink to="/download">下载</NuxtLink><NuxtLink to="/manifesto">关于</NuxtLink>
      </nav>
      <div class="header-actions">
        <button ref="searchButton" type="button" class="icon-button search-button" aria-label="搜索公开内容" @click="openPalette">⌕ <span>⌘K</span></button>
        <button type="button" class="icon-button" :aria-label="theme === 'light' ? '切换暗色主题' : '切换亮色主题'" @click="toggleTheme">{{ theme === "light" ? "☾" : "☀" }}</button>
        <a class="login-link" :href="webLoginUrl">登录</a>
        <LearningCta class="header-start" label="免费开始" from="official/header" />
        <button type="button" class="icon-button mobile-toggle" :aria-expanded="mobileOpen" aria-label="打开导航菜单" @click="mobileOpen = !mobileOpen">{{ mobileOpen ? "×" : "☰" }}</button>
      </div>
    </div>
    <nav v-if="mobileOpen" class="mobile-menu" aria-label="手机导航">
      <div v-for="section in siteSections" :key="section.title"><h2>{{ section.title }}</h2><NuxtLink v-for="link in section.links" :key="link.to" :to="link.to" @click="closeMenus">{{ link.label }}</NuxtLink></div>
      <button type="button" class="button subtle" @click="openPalette">搜索站内内容</button>
      <LearningCta label="免费开始" from="official/mobile-menu" />
    </nav>
    <CommandPalette v-if="paletteOpen" :open="paletteOpen" @close="paletteOpen = false" />
  </header>
</template>
