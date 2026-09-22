import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

// 端口 28180（06 §4 端口登记表；strictPort 禁止漂移）
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 28180,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
