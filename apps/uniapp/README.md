# @learnmath/uniapp — 移动端

uni-app（Vue 3.5.41 + Vite 8.2.2 + TypeScript），一套代码编译到 H5 / 微信小程序 / App。

功能定位：与 Web 学习端复用学员 API，覆盖五个主 Tab 和 41 个已注册页面。页面与底部面板承载设计稿中的 44 屏学习、作答、路径、社区与账号流程；未知数据展示空态，写操作以服务端回执为准。

**S1 基线同步**：版本集与 cloudstudy `apps/mobile` 完全一致（开发机已验证可跑）——
`@dcloudio/* = 3.0.0-alpha-1000920260909822`、`@dcloudio/types 3.4.31`、`vue 3.5.41`（@vue/* 同步钉扎）、
`pinia ^2.1.0`、`vite 8.2.2`、`sass ^1.77`、`typescript ^5.4`；pnpm hoist/overrides 配置见根 `pnpm-workspace.yaml`。
脚手架与页面已初始化。`node scripts/check-mobile-routes.mjs` 检查页面注册和静态导航；`pnpm --filter @learnmath/uniapp typecheck` 与 `pnpm --filter @learnmath/uniapp test` 只检查类型和纯逻辑，不启动服务。

H5 的 AI 答疑通过带认证头的 `fetch` 消费 SSE；小程序通过 `uni.request` 等待完整响应后展示，流式效果、超时和平台响应格式仍需真机验证。小程序/App ID、授权域名待配置。作答草稿按用户、作答编号和题序隔离；登出清理该用户的草稿与活跃作答标记。未冻结的请求字段会阻断对应按钮，具体清单见 `docs/review/frontend-implementation-2026-09-23.md`。
