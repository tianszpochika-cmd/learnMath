# learnMath — 数学学习平台

一个包含 **Web 学习端、管理端、官网、uniapp 移动端** 的全栈数学学习项目（纯 Agent 开发）。

> **当前阶段：文档先行（M0）** —— 本机仅产出需求与设计文档；代码开发在开发机进行，`git pull` 获取全部文档。文档总入口：[docs/README.md](./docs/README.md)

## 技术选型（已确认）

| 模块 | 选型 | 版本 |
|------|------|------|
| 后端 API | Java + Spring Boot (Maven) | Java 25 LTS + Spring Boot 4.1.1 |
| Web 学习端 | Vue 3 + Vite + Pinia + TS | Vue 3.5.43 / Vite 8.3 |
| 管理端 | Vue 3 + Element Plus + TS | Element Plus 2.14.6 |
| 官网 (SSR) | Nuxt | 4.5.2 |
| 移动端 | uni-app (Vue3 + Vite) | 官方脚手架锁定 |
| 数据库 / 缓存 | MySQL 8 + Redis | 8.0.44 本地 / Redis 8.4.0 |
| 运行环境 | Node LTS + pnpm | Node 24.21.0 + pnpm 10 |
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
│   ├── official/                # Nuxt 4 官网（SSR/SEO）
│   └── uniapp/                  # uni-app 移动端（H5/小程序/App）
├── packages/
│   ├── shared/                  # 跨端共享类型、常量、工具
│   └── api-client/              # 统一接口层（web/admin/uniapp 复用）
├── docs/                        # 文档体系（入口：docs/README.md）
│   ├── README.md                # 文档索引与阅读顺序
│   ├── 01-需求文档.md           # 产品需求基线（六大学习路径）
│   ├── 02-概要设计文档.md       # 架构 + 核心领域设计
│   ├── 03-数据库设计文档.md     # ER + 49 表 + Redis 键空间
│   ├── 04-接口设计文档.md       # app-api 96 + admin-api 71 接口
│   ├── 05-前端与交互设计文档.md # 四端信息架构/组件/主题
│   ├── 06-开发文档.md           # 环境基线/规范/Git/里程碑（双机协作）
│   ├── 07-测试计划.md           # 分层测试 + P0 用例 + E2E
│   ├── 08-部署运维文档.md       # 拓扑/构建/备份/上线清单
│   └── 09-功能链与交互链文档.md # 9 功能链 + 7 交互链（已逐条确认）
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
- Node 24.21.0 LTS（nvm 已切换）+ pnpm 10
- MySQL 8、Redis 8（或 `docker compose up -d mysql redis`）
