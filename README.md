# learnMath — 数学学习平台

一个包含 **Web 学习端、管理端、官网、uniapp 移动端** 的全栈数学学习项目（纯 Agent 开发）。

> **对外品牌：数源 MathOrigin**（工程/仓库名保持 learnMath；品牌常量见 docs/13 §2，域名待注册商实测）

> **当前阶段：文档先行（M0）** —— 本机仅产出需求与设计文档；代码开发在开发机进行，`git pull` 获取全部文档。文档总入口：[docs/README.md](./docs/README.md)

> **技术基线（S1）**：与 **cloudstudy（开发机已验证能跑）全量同步** —— Node 20.19.5 · pnpm 10.19.0 · Vue 3.5.41 · Vite 6.4.3(web/admin) · Nuxt 3.21 · Pinia 2 · uni-app dcloudio 定版 · Java 25 + Spring Boot 4.1.1 · Redis 7(compose)。原则：**确定能跑 > 理论最新**（ADR 见 docs/02 §9 #8）

## 技术选型（已确认 · S1 基线）

| 模块 | 选型 | 版本（= cloudstudy 已验证） |
|------|------|------|
| 后端 API | Java + Spring Boot (Maven) | Java 25 LTS + Spring Boot 4.1.1（enforce-java-25） |
| Web 学习端 | Vue 3 + Vite + Pinia + TS | Vue 3.5.41 / Vite 6.4.3 / Pinia 2 |
| 管理端 | Vue 3 + Element Plus + TS | Element Plus 2.14.4 |
| 官网 (SSR) | Nuxt | 3.21（cloudstudy official-site 同系） |
| 移动端 | uni-app | dcloudio `3.0.0-alpha-1000920260909822` + vite 8.2.2 |
| 数据库 / 缓存 | MySQL 8 + Redis 7 | mysql:8.0 / redis:7-alpine（compose 同 cloudstudy 镜像） |
| 运行环境 | Node + pnpm + turbo | Node **20.19.5** + pnpm **10.19.0** + turbo 2.x |
| 部署 | Docker Compose | 2.40 |

## 仓库结构

```
learnMath/
├── server/                      # Java 后端（Maven 多模块）
│   ├── pom.xml                  # 父 POM（Spring Boot 4.1.1 / Java 25）
│   ├── learn-admin-api/         # 管理端接口（课程/题库/用户/统计）
│   └── learn-app-api/           # 学习端接口（做题/进度/错题本，Web+移动端复用）
├── apps/
│   ├── web/                     # Vue 3 Web 学习端
│   ├── admin/                   # Vue 3 + Element Plus 管理端
│   ├── official/                # Nuxt 3 官网（SSR/SEO）
│   └── uniapp/                  # uni-app 移动端（H5/小程序/App）
├── packages/
│   ├── shared/                  # 跨端共享类型、常量、工具
│   └── api-client/              # 统一接口层（web/admin/uniapp 复用）
├── docs/                        # 文档体系（入口：docs/README.md）
│   ├── README.md                # 文档索引与阅读顺序
│   ├── 01-需求文档.md           # 产品需求基线（六大学习路径）
│   ├── 02-概要设计文档.md       # 架构 + 核心领域设计
│   ├── 03-数据库设计文档.md     # ER + 61 表 + Redis 键空间
│   ├── 04-接口设计文档.md       # app-api 125 + admin-api 86 接口
│   ├── 05-前端与交互设计文档.md # 四端信息架构/组件/主题
│   ├── 06-开发文档.md           # 环境基线/规范/Git/里程碑（双机协作）
│   ├── 07-测试计划.md           # 分层测试 + P0 用例 + E2E（J1-J15）
│   ├── 08-部署运维文档.md       # 拓扑/构建/备份/上线清单
│   ├── 09-功能链与交互链文档.md # 14 功能链 + 10 交互链（已逐条确认）
│   ├── 10-学习引擎设计文档.md   # 内核一/二：推理链五玩/概念四卡/应用五步
│   ├── 11-公式馆设计文档.md     # 内核三：公式实体+全站可点+小练三型
│   ├── 12-内容生产计划.md       # 关键路径：MVC/分期目标/流水线/产能实验
│   ├── 13-官网设计文档.md       # 官网 2.0：六大区 40+ 页型/SEO/L0·L13 链/品牌
│   ├── 14-官网UI设计文档.md     # 官网UI 2.0：暗色/⌘K/mega-menu/线框/组件
│   ├── 15-移动端UI设计文档.md   # 移动端：5-Tab/44屏/五玩移动形态/用户流/组件
│   ├── 16-Web学习端UI设计文档.md # Web大屏：18屏/深钻三区/图谱画布/考试布局
│   ├── 17-管理端UI设计文档.md   # 管理端：19屏/列表模板/三大自研界面
│   ├── design/official/index.html  # 官网高保真原型 2.0（浏览器直接打开）
│   ├── design/mobile/index.html    # 移动端手机框原型 44 屏（浏览器直接打开）
│   ├── design/web/index.html       # Web学习端原型 18 屏（浏览器直接打开）
│   └── design/admin/index.html     # 管理端原型 19 屏（浏览器直接打开）
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## 常用命令（脚手架完成后生效）

```bash
pnpm install            # 安装全部前端依赖
pnpm dev:web            # 启动 Web 学习端
pnpm dev:admin          # 启动管理端
pnpm dev:official       # 启动官网
pnpm dev:uniapp:h5      # 启动移动端 H5

cd server && mvn spring-boot:run -pl learn-app-api   # 启动学习端 API
cd server && mvn spring-boot:run -pl learn-admin-api # 启动管理端 API
```

## 环境要求

- JDK 25（`C:\Program Files\Java\jdk-25`，构建 server 前需将 JAVA_HOME 指向它）
- Maven 3.9+
- Node **20.19.5**（`.nvmrc` / `nvm use 20.19.5`，与 cloudstudy 同版）+ pnpm **10.19.0**
- MySQL 8、Redis 7（`docker compose up -d`：宿主口 13307 / 16380）
- 基线自检：`pnpm toolchain:check` 与 `pnpm ports:check`（versionDrift=fail）
