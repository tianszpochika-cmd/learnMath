export default defineNuxtConfig({
  compatibilityDate: "2025-07-01",
  devtools: { enabled: false },
  ssr: true,
  css: ["~/assets/styles/site.css"],
  runtimeConfig: {
    appApiBase: process.env.APP_API_BASE || "http://127.0.0.1:8080/api/app/v1",
    public: {
      webBase: process.env.NUXT_PUBLIC_WEB_BASE || "http://localhost:28180",
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:28182"
    }
  },
  app: {
    head: {
      htmlAttrs: { lang: "zh-CN" },
      titleTemplate: "%s · 数源 MathOrigin",
      meta: [
        { name: "theme-color", content: "#F8FAFC" },
        { name: "description", content: "数源 MathOrigin：把数学的每一步讲清楚。从课程、图谱、测评到推理链与公式馆，找到适合自己的学习路径。" }
      ],
      script: [{
        innerHTML: "(function(){try{var v=localStorage.getItem('lm-official-theme');document.documentElement.dataset.theme=v||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){document.documentElement.dataset.theme='light'}})()",
        tagPosition: "head"
      }]
    }
  },
  nitro: {
    routeRules: {
      "/rss": { redirect: { to: "/rss.xml", statusCode: 301 } }
    }
  }
});
