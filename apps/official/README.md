# 数源 MathOrigin 官网

Nuxt 3.21 SSR 站点。视觉层使用项目内 CSS tokens 和亮暗主题，不依赖在线素材。页面结构对照 `docs/13-官网设计文档.md`、`docs/14-官网UI设计文档.md` 及 `docs/design/official/`。

## 页面与交互

- 首页 12 个模块、六条学习路径、八个功能详情，使用统一页头、页脚、移动导航、键盘搜索与主题切换。
- 词条、公式、每日题、年表、文章、案例、帮助、活动和协议读取公开 API；已发布内容缺失或上游不可用时显示空态。公式使用本地 KaTeX 严格模式排版，并为辅助技术提供 MathML；解析失败以纯文本回退。函数画板只解析白名单数学表达式。
- 学习目标按钮通过 `POST /navigation/intents` 取得 `resumeToken` 后跳转 Web 登录。Web 端还需完成兑换与恢复，参见开发状态表。
- `robots.txt`、站点地图和 RSS 在请求时生成，按运行时配置的 canonical 地址输出；动态索引只取已发布内容。搜索页和状态页不入索引。

## 配置

| 变量 | 作用 | 本地默认值 |
|---|---|---|
| `APP_API_BASE` | 服务端 App 公开接口前缀 | `http://127.0.0.1:8080/api/app/v1` |
| `NUXT_PUBLIC_WEB_BASE` | 学习 Web 端地址 | `http://localhost:28180` |
| `NUXT_PUBLIC_SITE_URL` | 官网 canonical origin，正式环境必须明确配置 | `http://localhost:28182` |

站点的 `/api/public/*` 代理仅放行公开读取、订阅和学习目标创建路径，不透传未列出的管理接口。

## 逻辑验证边界

本轮按项目文档的“只写代码和纯逻辑测试”口径工作，没有启动 Nuxt 站点、浏览器、容器或数据库。38 项纯逻辑测试通过，覆盖路径推荐、倒计时、公开路径白名单、表达式解析、KaTeX 严格模式、资源映射、SEO 分页与 XML 输出。Nuxt `prepare` 只生成类型文件，页面脚本和模板做静态解析；实际渲染、接口联调、键盘与触摸体验留待环境阶段验证。详见 `docs/review/frontend-implementation-2026-09-23.md`。
