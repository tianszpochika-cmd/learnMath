import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import "./styles/tokens.css";

// 顺序关键：pinia 先于 router（首次导航的守卫依赖 useAuthStore）
createApp(App).use(createPinia()).use(router).mount("#app");
