<script setup lang="ts">
import { siteSections } from "../utils/siteContent";
</script>

<template>
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <NuxtLink to="/" class="brand"><span class="brand-mark" aria-hidden="true">π</span><span>数源 <small>MathOrigin</small></span></NuxtLink>
        <p>从现实与问题出发，走到每一步都有依据的数学学习。</p>
        <a href="/rss.xml" class="text-link">RSS 订阅</a>
      </div>
      <div v-for="section in siteSections" :key="section.title" class="footer-links">
        <h2>{{ section.title }}</h2>
        <NuxtLink v-for="link in section.links" :key="link.to" :to="link.to">{{ link.label }}</NuxtLink>
      </div>
      <div class="footer-newsletter"><h2>数学与世界</h2><p>每周一封，读数学从哪里来。</p><NewsletterForm /></div>
    </div>
    <div class="container footer-bottom"><span>© 2026 数源 MathOrigin</span><div><NuxtLink to="/legal/privacy">隐私政策</NuxtLink><NuxtLink to="/legal/terms">用户协议</NuxtLink><NuxtLink to="/status">服务状态</NuxtLink></div></div>
  </footer>
</template>
