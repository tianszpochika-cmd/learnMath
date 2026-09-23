export interface SiteEntry {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  accent: string;
  steps: [string, string, string];
  suitable: string;
  boundary: string;
}

export const paths: SiteEntry[] = [
  { slug: "course", title: "系统课程", eyebrow: "P1 · 顺着主线", summary: "从概念出发，把例题、练习与复习串成一条看得见的学习线。", accent: "var(--p1)", steps: ["找到当前课时", "读懂概念与例题", "用随堂练确认理解"], suitable: "希望按清晰顺序打基础的学习者", boundary: "阅读记录与练习达标分开确认，点开课时不等于已经掌握。" },
  { slug: "graph", title: "知识图谱", eyebrow: "P2 · 看清连接", summary: "先看知识点之间的前置与关联，再决定从哪里补起。", accent: "var(--p2)", steps: ["搜索目标知识点", "查看一跳关联", "补齐真正需要的前置"], suitable: "知道题目难，却不确定卡在哪里的学习者", boundary: "没有足够证据时展示样本不足；内容筹备中与能力锁定分开。" },
  { slug: "plan", title: "学习计划", eyebrow: "P3 · 安排节奏", summary: "把目标拆到每天，并在证据变化时给出可审阅的建议。", accent: "var(--p3)", steps: ["设定时间与目标", "完成可验证任务", "比较建议前后差异"], suitable: "希望持续复习，又不愿被计划绑住的学习者", boundary: "计划建议要由你确认；缺席不会自动降低能力。" },
  { slug: "ladder", title: "阶梯刷题", eyebrow: "P4 · 逐级进阶", summary: "在同一个知识点上逐档练习，用有效证据开启晋级战。", accent: "var(--p4)", steps: ["选择当前难度", "积累有效客观题", "通过晋级战后升档"], suitable: "想针对一个知识点逐层加深的学习者", boundary: "达到练习门槛仅开启晋级战；通过晋级卷才解锁下一难度。" },
  { slug: "special", title: "专题探索", eyebrow: "P5 · 按主题深入", summary: "围绕一个主题，把课程、知识点与应用问题连起来。", accent: "var(--p5)", steps: ["选择主题", "沿主题线阅读", "完成对应练习与作品"], suitable: "喜欢从问题或兴趣主题进入数学的学习者", boundary: "只有已发布内容可进入；缺题时清楚标明筹备状态。" },
  { slug: "challenge", title: "闯关挑战", eyebrow: "P6 · 用行动检验", summary: "普通关练习后再挑战 Boss，用清楚的规则理解星级与进度。", accent: "var(--p6)", steps: ["从当前关开始", "检查星级条件", "开考前阅读 Boss 规则"], suitable: "喜欢明确目标与阶段反馈的学习者", boundary: "Boss 战的答案与辅助规则在开考时冻结，成绩以服务端确认为准。" }
];

export const features: SiteEntry[] = [
  { slug: "deepdive", title: "一题五玩", eyebrow: "推理内核", summary: "通读、预测、顺逆、多解和 AI 追问，让每一步都有依据。", accent: "var(--p1)", steps: ["从题面进入推理链", "在关键步骤作预测", "比较另一种解法"], suitable: "想知道为什么这样做，而不只想记答案", boundary: "受限作答期间，答案、完整深钻与 AI 由活动作答策略拦截。" },
  { slug: "graph", title: "知识图谱", eyebrow: "结构内核", summary: "把概念之间的依赖关系变成可以探索的地图。", accent: "var(--p2)", steps: ["定位知识点", "看前置与邻接", "进入概念四卡"], suitable: "想看清知识结构", boundary: "掌握状态需要合格证据；不以颜色替代文字解释。" },
  { slug: "formula", title: "公式馆", eyebrow: "公式内核", summary: "每个公式都有成立条件、符号说明、推导与误用边界。", accent: "var(--p3)", steps: ["先看成立条件", "再读符号与推导", "练习辨条件和应用"], suitable: "希望理解公式来历与适用范围", boundary: "公开页只展示已审核快照；完整推导与题目答案受权限约束。" },
  { slug: "ai", title: "AI 导师", eyebrow: "引导式对话", summary: "先问你如何想，再按当前步骤给出提示。", accent: "var(--p4)", steps: ["带入题目上下文", "说明自己的想法", "逐步检查依据"], suitable: "需要及时提示但仍想自己完成推理", boundary: "AI 内容必须标记为建议，不计为客观掌握证据。" },
  { slug: "wrongbook", title: "错题与断链", eyebrow: "错误复盘", summary: "分清尚未定位、AI 建议、自报与真实作答观测，再选补救。", accent: "var(--p5)", steps: ["先看错误证据", "确认薄弱步骤", "做已发布的补救题"], suitable: "总在相似步骤重复出错", boundary: "没有步骤证据时不会假称已定位断点。" },
  { slug: "community", title: "学习社区", eyebrow: "一起讲清楚", summary: "把问题、解法和解释放在同一个讨论里。", accent: "var(--p6)", steps: ["查看精选讨论", "提出具体问题", "确认有帮助的解答"], suitable: "希望和别人一起讨论推理", boundary: "发布、审核与采纳状态必须清楚，受限作答期间不开放关联问答。" },
  { slug: "gamification", title: "成长与挑战", eyebrow: "过程反馈", summary: "用关卡、星级与成就记录真实学习行动。", accent: "var(--p2)", steps: ["完成已发布任务", "看清奖励条件", "回顾成长记录"], suitable: "喜欢阶段目标与持续反馈", boundary: "奖励只在服务端确认后结算，演示数字不代表真实成绩。" },
  { slug: "assessment", title: "起点测评", eyebrow: "从这里出发", summary: "只在测到的领域给出建议，没测到的保持待校准。", accent: "var(--p3)", steps: ["开考前了解规则", "按题作答", "确认推荐起点与计划"], suitable: "不确定该从哪里开始", boundary: "测评可以跳过；建议不会自动覆盖自己的学习计划。" }
];

export const siteSections = [
  { title: "产品", links: [{ label: "六条路径", to: "/paths" }, { label: "核心功能", to: "/features" }, { label: "价格说明", to: "/pricing" }, { label: "路线图", to: "/roadmap" }] },
  { title: "资源", links: [{ label: "数学词条", to: "/glossary" }, { label: "公式馆", to: "/formulas" }, { label: "每日一题", to: "/daily" }, { label: "数学年表", to: "/timeline" }, { label: "探索工具", to: "/tools" }] },
  { title: "了解数源", links: [{ label: "产品宣言", to: "/manifesto" }, { label: "帮助中心", to: "/help" }, { label: "常见问题", to: "/faq" }, { label: "联系我们", to: "/contact" }] }
];

export function findEntry(entries: readonly SiteEntry[], slug: string): SiteEntry | undefined {
  return entries.find((entry) => entry.slug === slug);
}
