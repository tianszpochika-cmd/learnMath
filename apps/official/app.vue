<script setup lang="ts">
import { jsonLd } from "./utils/jsonLd";
import { canonicalOrigin, canonicalUrl } from "./utils/seo";
import { siteSections } from "./utils/siteContent";

const route = useRoute();
const siteOrigin = canonicalOrigin(useRuntimeConfig().public.siteUrl);
const canonical = computed(() => siteOrigin ? canonicalUrl(siteOrigin, route.path) : null);
useSeoMeta({
  ogSiteName: "数源 MathOrigin",
  ogType: "website",
  ogLocale: "zh_CN",
  ogTitle: "数源 MathOrigin · 让数学的每一步都有依据",
  ogDescription: "从问题出发，沿六条学习路径理解概念、公式和推理。",
  twitterCard: "summary_large_image"
});
useHead(() => ({
  link: canonical.value ? [{ rel: "canonical", href: canonical.value }] : [],
  meta: canonical.value ? [{ property: "og:url", content: canonical.value }] : [],
  script: siteOrigin ? [{ type: "application/ld+json", innerHTML: jsonLd({
    "@context": "https://schema.org",
    "@graph": siteSections.flatMap((section) => section.links.map((link) => ({
      "@type": "SiteNavigationElement",
      name: link.label,
      url: canonicalUrl(siteOrigin, link.to)
    })))
  }) }] : []
}));
const progress = ref(0);

function updateProgress() {
  if (!import.meta.client) return;
  const height = document.documentElement.scrollHeight - window.innerHeight;
  progress.value = height > 0 ? Math.min(100, Math.max(0, window.scrollY / height * 100)) : 0;
}

onMounted(() => {
  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
});
onBeforeUnmount(() => {
  window.removeEventListener("scroll", updateProgress);
  window.removeEventListener("resize", updateProgress);
});
watch(() => route.fullPath, () => nextTick(updateProgress));
</script>

<template>
  <div class="site-shell">
    <div class="reading-progress" :style="{ transform: 'scaleX(' + progress / 100 + ')' }" aria-hidden="true" />
    <SiteHeader />
    <main id="main-content"><NuxtPage /></main>
    <SiteFooter />
  </div>
</template>
