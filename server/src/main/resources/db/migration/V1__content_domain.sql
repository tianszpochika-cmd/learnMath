-- ============================================================
-- V1__content_domain.sql — 内容域 23 表（03-数据库设计 §4/§8/§9/§10/§11 对齐）
-- 可重放：仅 CREATE（无 DROP/TRUNCATE）；执行顺序按 V*.sql 文件名。
-- 校验：node scripts/check-migrations.mjs（预期表清单比对）
-- ============================================================
-- 建库约定：数据库 learnmath（compose 已建），此处不 CREATE DATABASE。

-- T02 知识点（树）
CREATE TABLE knowledge_node (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    parent_id BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=根',
    name VARCHAR(64) NOT NULL COMMENT '节点名',
    description VARCHAR(500) NULL,
    difficulty_baseline TINYINT NOT NULL DEFAULT 3 COMMENT '1-5',
    sort INT NOT NULL DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1上架 2下架',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_parent_sort (parent_id, sort),
    KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识点树节点';

-- T03 前置依赖边（DAG，应用层无环校验 → 3310）
CREATE TABLE knowledge_edge (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    from_id BIGINT UNSIGNED NOT NULL COMMENT '前置节点',
    to_id BIGINT UNSIGNED NOT NULL COMMENT '后继节点',
    type TINYINT NOT NULL DEFAULT 1 COMMENT '1必须 2推荐',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_edge (from_id, to_id),
    KEY idx_to (to_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识点前置依赖边';

-- T04 标签
CREATE TABLE tag (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(32) NOT NULL,
    type TINYINT NOT NULL DEFAULT 1 COMMENT '1普通 2现实域(01 K-13)',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='横向标签';

-- T05 标签关联
CREATE TABLE tag_rel (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tag_id BIGINT UNSIGNED NOT NULL,
    target_type VARCHAR(32) NOT NULL COMMENT 'question/course/lesson/topic...',
    target_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_rel (tag_id, target_type, target_id),
    KEY idx_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签多对多';

-- T06 课程
CREATE TABLE course (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    cover VARCHAR(255) NULL,
    description TEXT NULL,
    level_base TINYINT NOT NULL DEFAULT 1 COMMENT '难度基线1-5',
    sort INT NOT NULL DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 3 COMMENT '1上架 2下架 3草稿',
    is_free TINYINT NOT NULL DEFAULT 1 COMMENT '1免费 2会员(预留门禁)',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_status_sort (status, sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课程';

-- T07 章节（树）
CREATE TABLE chapter (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    course_id BIGINT UNSIGNED NOT NULL,
    parent_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
    title VARCHAR(100) NOT NULL,
    sort INT NOT NULL DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_course_tree (course_id, parent_id, sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='章节树';

-- T08 课时
CREATE TABLE lesson (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chapter_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(100) NOT NULL,
    type TINYINT NOT NULL DEFAULT 1 COMMENT '1图文(MD+KaTeX) 2视频外链',
    content MEDIUMTEXT NULL,
    video_url VARCHAR(255) NULL,
    duration INT NOT NULL DEFAULT 0 COMMENT '秒',
    practice_json JSON NULL COMMENT '随堂练题组引用(冻结阈值版本见 BR-02)',
    completion_policy TINYINT NOT NULL DEFAULT 1 COMMENT '1 practice_required(默认) 2 read_only —— 首次进入冻结',
    sort INT NOT NULL DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 1,
    is_preview TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1游客可看正文(01 §2试看)',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_chapter_sort (chapter_id, sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课时';

-- T09 题目
CREATE TABLE question (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    type TINYINT NOT NULL COMMENT '1单选 2多选 3判断 4填空 5解答',
    kind TINYINT NOT NULL DEFAULT 1 COMMENT '1常规 2应用题(五步工作台)',
    stem MEDIUMTEXT NOT NULL,
    options JSON NULL COMMENT '[{key,text}]',
    answer VARCHAR(500) NOT NULL COMMENT '||分空 |分可接受',
    analysis MEDIUMTEXT NULL,
    difficulty TINYINT NOT NULL DEFAULT 3 COMMENT '1-5',
    coupling_degree TINYINT NOT NULL DEFAULT 0 COMMENT '交叉知识点数(01 K-02)',
    reasoning_steps TINYINT NOT NULL DEFAULT 0,
    needs_construction TINYINT(1) NOT NULL DEFAULT 0,
    source TINYINT NOT NULL DEFAULT 1 COMMENT '1官方 2导入 3AI',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1可用 2停用 3待审',
    judge_config JSON NULL COMMENT '归一化/容差/比例(02§5.4)',
    owner_user_id BIGINT UNSIGNED NULL COMMENT 'AI题归属',
    formula_id BIGINT UNSIGNED NULL COMMENT '公式小练来源(03§11.2)',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_status_difficulty (status, difficulty),
    KEY idx_source_status (source, status),
    KEY idx_formula (formula_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='题库';

-- T10 题目-知识点
CREATE TABLE question_knowledge (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    question_id BIGINT UNSIGNED NOT NULL,
    node_id BIGINT UNSIGNED NOT NULL,
    weight TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_qn (question_id, node_id),
    KEY idx_node (node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='题目-知识点(抽题主查询)';

-- T11 试卷
CREATE TABLE paper (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    type TINYINT NOT NULL DEFAULT 1 COMMENT '1手动 2规则',
    rule_json JSON NULL COMMENT '抽题规则(04 /papers/generate)',
    duration INT NOT NULL DEFAULT 0 COMMENT '分钟,0=不限',
    total_score INT NOT NULL DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 3 COMMENT '1上架 2下架 3草稿',
    path_ref VARCHAR(16) NULL COMMENT '路径引用标记',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='试卷';

-- T12 试卷-题目
CREATE TABLE paper_question (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    paper_id BIGINT UNSIGNED NOT NULL,
    question_id BIGINT UNSIGNED NOT NULL,
    seq INT NOT NULL,
    score INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_paper_seq (paper_id, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='试卷题目';

-- T13 专题（P5）
CREATE TABLE special_topic (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    cover VARCHAR(255) NULL,
    description TEXT NULL,
    difficulty_baseline TINYINT NOT NULL DEFAULT 3,
    achievement_code VARCHAR(64) NULL COMMENT '完成徽章',
    sort INT NOT NULL DEFAULT 0,
    status TINYINT NOT NULL DEFAULT 3 COMMENT '1上架 2下架 3草稿',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_status_sort (status, sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='专题研习(P5)';

-- T14 专题节点（序列）
CREATE TABLE topic_node (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    topic_id BIGINT UNSIGNED NOT NULL,
    ref_type TINYINT NOT NULL COMMENT '1课时 2试卷 3测评 4AI任务 5小作业',
    ref_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(100) NOT NULL,
    seq INT NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_topic_seq (topic_id, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='专题节点序列';

-- T50 解法链（subject 二型：1题目 2公式 —— 03§8.2）
CREATE TABLE solution_path (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    subject_type TINYINT NOT NULL DEFAULT 1 COMMENT '1题目 2公式',
    subject_id BIGINT UNSIGNED NOT NULL,
    question_id BIGINT UNSIGNED NULL COMMENT '历史列(与 subject 同义时冗余为空)',
    title VARCHAR(64) NOT NULL,
    kind TINYINT NOT NULL DEFAULT 1 COMMENT '1通法 2技巧法 3另解',
    view TINYINT NOT NULL DEFAULT 3 COMMENT '1综合(顺) 2分析(逆) 3并列',
    step_count TINYINT NOT NULL DEFAULT 0,
    quality TINYINT NOT NULL DEFAULT 2 COMMENT '1 curated 2 ai_draft (E1)',
    summary VARCHAR(500) NULL COMMENT '本题通法总结卡',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1上架 2草稿 3待校',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_subject (subject_type, subject_id),
    KEY idx_question (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='解法链(一题多解/公式推导)';

-- T51 推理步（四要素）
CREATE TABLE reasoning_step (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    path_id BIGINT UNSIGNED NOT NULL,
    seq SMALLINT NOT NULL,
    step_type TINYINT NOT NULL COMMENT '1读条件 2目标转化 3等价变形 4放缩 5构造 6论证 7回代检验 8工具选择',
    content MEDIUMTEXT NOT NULL,
    warrant TEXT NULL COMMENT '凭什么合法',
    warrant_nodes JSON NULL COMMENT '依据挂接知识点id[]',
    motive TEXT NULL COMMENT '为什么想到',
    off_ramp TEXT NULL COMMENT '岔路/常见错误',
    edge_from JSON NULL COMMENT '依赖步seq[] (DAG)',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_path_seq (path_id, seq)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='推理步(内容/依据/动机/岔路)';

-- T52 预测题（引导模式 · E2，参数=解法/版本/stepId —— 19 R09 复核）
CREATE TABLE step_prediction (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    path_id BIGINT UNSIGNED NOT NULL COMMENT '所属解法(唯一约束到步)',
    step_id BIGINT UNSIGNED NOT NULL,
    chain_version INT NOT NULL DEFAULT 1 COMMENT '链版本(19 复核:版本化预测)',
    mode TINYINT NOT NULL COMMENT '1选步型 2选依据 3填动机 4简答',
    stem VARCHAR(255) NOT NULL,
    options JSON NULL,
    answer VARCHAR(255) NULL,
    explain_right VARCHAR(500) NULL,
    explain_wrong VARCHAR(500) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_step (step_id, chain_version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='引导预测配置';

-- T53 概念四卡（发布快照规则 BR-06 同步适用）
CREATE TABLE concept_narrative (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    node_id BIGINT UNSIGNED NOT NULL,
    origin MEDIUMTEXT NULL COMMENT '起源卡',
    prototype MEDIUMTEXT NULL COMMENT '现实原型卡',
    capability TEXT NULL COMMENT '能力地图卡',
    ladder JSON NULL COMMENT '抽象阶梯 [{real,model,symbol}]',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1草稿 2待审 3已发布(与快照独立,03E3)',
    source TINYINT NOT NULL DEFAULT 2 COMMENT '1人工 2AI草稿',
    work_revision BIGINT NOT NULL DEFAULT 1 COMMENT '工作稿版本(expectedRevision)',
    published_version BIGINT NOT NULL DEFAULT 0,
    published_snapshot JSON NULL COMMENT 'BR-06:仅含已审核字段+missingCards;学员/官网只读此列',
    published_at DATETIME(3) NULL,
    unpublished_at DATETIME(3) NULL COMMENT '显式下线(BR-06,不靠status隐式)',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_node (node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='概念四卡(工作稿+发布快照分离·BR-06)';

-- T54 应用翻译对（双向训练/读题标注参考）
CREATE TABLE translation_pair (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    question_id BIGINT UNSIGNED NULL,
    pair_type TINYINT NOT NULL COMMENT '1句→量映射 2编题 3翻译(题→场景)',
    source_text TEXT NOT NULL,
    target_expr TEXT NOT NULL,
    mapping JSON NULL,
    domain TINYINT NOT NULL DEFAULT 8 COMMENT '1测量 2金融 3运动 4自然 5工程 6博弈 7艺术 8其他',
    status TINYINT NOT NULL DEFAULT 3,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_question (question_id),
    KEY idx_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='应用五步翻译对';

-- T55 公式（七件套；发布快照同 BR-06）
CREATE TABLE formula (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    alias JSON NULL COMMENT '别名集(题面可点匹配键)',
    latex TEXT NOT NULL,
    domain TINYINT NOT NULL COMMENT '领域分卷(11 §2.1)',
    tier TINYINT NOT NULL DEFAULT 1 COMMENT '1-5',
    proof_status TINYINT NOT NULL DEFAULT 2 COMMENT '1严格证明 2推导确立 3经验拟合 4猜想未证(F3)',
    origin MEDIUMTEXT NULL,
    applications TEXT NULL,
    memory_hook VARCHAR(500) NULL,
    variants JSON NULL COMMENT '{legal_forms[],error_forms[]}',
    quality TINYINT NOT NULL DEFAULT 2 COMMENT '1curated 2ai_draft(F2)',
    status TINYINT NOT NULL DEFAULT 3 COMMENT '1上架 2草稿 3待审',
    work_revision BIGINT NOT NULL DEFAULT 1,
    published_version BIGINT NOT NULL DEFAULT 0,
    published_snapshot JSON NULL COMMENT 'BR-06 同规则(公开摘要+审核字段)',
    published_at DATETIME(3) NULL,
    unpublished_at DATETIME(3) NULL,
    view_count INT NOT NULL DEFAULT 0,
    favorite_count INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_domain_tier_status (domain, tier, status),
    KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公式(馆)';

-- T56 公式符号表
CREATE TABLE formula_symbol (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    formula_id BIGINT UNSIGNED NOT NULL,
    symbol VARCHAR(16) NOT NULL,
    meaning VARCHAR(128) NOT NULL COMMENT '含义(BR-08:至少含含义/定义域/单位)',
    range_note VARCHAR(128) NULL COMMENT '定义域/取值/单位(无单位标"无量纲")',
    sort INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    KEY idx_formula (formula_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公式符号表';

-- T57 公式家族关系
CREATE TABLE formula_relation (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    from_id BIGINT UNSIGNED NOT NULL,
    to_id BIGINT UNSIGNED NOT NULL,
    rel_type TINYINT NOT NULL COMMENT '1推广 2特例 3等价 4逆 5可组合 6常用搭配',
    note VARCHAR(255) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_rel (from_id, to_id, rel_type),
    KEY idx_to (to_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公式家族关系';

-- T58 公式-知识点
CREATE TABLE formula_node_rel (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    formula_id BIGINT UNSIGNED NOT NULL,
    node_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_fn (formula_id, node_id),
    KEY idx_node (node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公式-知识点双向挂接';

-- T59 文章（博客/资讯/协议/公告/案例/帮助/年表/活动）
CREATE TABLE article (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    type TINYINT NOT NULL DEFAULT 1 COMMENT '1博客 2资讯 3协议 4公告 5案例 6帮助 7年表条目 8活动',
    category VARCHAR(32) NULL COMMENT '二级分类(帮助分组/博客栏目/年表世纪段)',
    title VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    summary VARCHAR(255) NULL,
    content MEDIUMTEXT NULL,
    cover VARCHAR(255) NULL,
    seo_title VARCHAR(128) NULL,
    seo_description VARCHAR(255) NULL,
    status TINYINT NOT NULL DEFAULT 1 COMMENT '1草稿 2发布 3下线',
    legal_version VARCHAR(16) NULL COMMENT 'type=3 必填;同slug多行版本化',
    published_at DATETIME(3) NULL,
    sort INT NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    UNIQUE KEY uk_slug_version (slug, legal_version),
    KEY idx_type_cat (type, category, status),
    KEY idx_published (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章/协议/公告(官网与端内共用)';
