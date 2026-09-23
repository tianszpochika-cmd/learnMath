import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = join(root, "apps/uniapp/src");
const config = JSON.parse(readFileSync(join(source, "pages.json"), "utf8"));
const routes = new Set(config.pages.map((entry) => entry.path));
const errors = [];
if (config.pages[0]?.path !== "pages/start/index") errors.push("启动页必须排在第一位");
for (const route of routes) if (!existsSync(join(source, `${route}.vue`))) errors.push(`未找到页面：${route}`);
for (const tab of config.tabBar.list) if (!routes.has(tab.pagePath)) errors.push(`Tab 未注册：${tab.pagePath}`);
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(vue|ts)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
      const text = readFileSync(path, "utf8");
      for (const match of text.matchAll(/\/pages\/[a-z0-9/_-]+\/index\b/g)) {
        const route = match[0].slice(1);
        if (!routes.has(route)) errors.push(`未注册导航：${relative(root, path)} → ${route}`);
      }
    }
  }
}
walk(source);
if (errors.length) { for (const error of errors) console.error(error); process.exitCode = 1; }
else console.log(`mobile routes: ${routes.size} registered pages, 5 tab entries, static links resolved`);
