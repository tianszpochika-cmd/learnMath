import { fileURLToPath } from "node:url";

/** Pure logic checks use workspace source aliases and never start the uni-app runtime. */
export default {
  root: fileURLToPath(new URL("../..", import.meta.url)),
  resolve: {
    alias: {
      "@learnmath/api-client": fileURLToPath(new URL("../../packages/api-client/src/index.ts", import.meta.url)),
      "@learnmath/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
    },
  },
  test: { include: ["apps/uniapp/src/**/*.test.ts"], environment: "node" },
};
