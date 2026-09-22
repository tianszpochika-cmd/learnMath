# @learnmath/uniapp — 移动端

uni-app（Vue 3.5.41 + Vite 8.2.2 + TypeScript），一套代码编译到 H5 / 微信小程序 / App。

功能定位：与 Web 学习端复用同一套 learn-app-api —— 做题、练习、错题本、学习进度、打卡。

**S1 基线同步**：版本集与 cloudstudy `apps/mobile` 完全一致（开发机已验证可跑）——
`@dcloudio/* = 3.0.0-alpha-1000920260909822`、`@dcloudio/types 3.4.31`、`vue 3.5.41`（@vue/* 同步钉扎）、
`pinia ^2.1.0`、`vite 8.2.2`、`sass ^1.77`、`typescript ^5.4`；pnpm hoist/overrides 配置见根 `pnpm-workspace.yaml`。
脚手架按该版本集初始化（M1）。
