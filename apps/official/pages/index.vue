<script setup lang="ts">
import { countdownLabel, publicCards, quizQuestions, recommendPath } from "../utils/homeLogic";
import { features, findEntry, paths } from "../utils/siteContent";
import { jsonLd } from "../utils/jsonLd";

interface DailyQuestion {
  id?: string | number;
  slug?: string;
  stem?: string;
  question?: string;
  options?: Array<string | { key?: string; text?: string; label?: string; content?: string }>;
  correctOption?: string;
  correctAnswer?: string;
  answer?: string;
  explanation?: string;
  publicExplanation?: string;
  analysis?: string;
  chainSummary?: Array<string | { text?: string; content?: string; summary?: string }>;
  nextRevealAt?: string;
  nextAt?: string;
  nextQuestionAt?: string;
}

useSeoMeta({
  title: "让数学的每一步都有依据",
  description: "数源 MathOrigin 用六条学习路径、一题五玩、概念四卡与公式馆，帮助你从问题出发，真正理解数学。"
});
useHead({ script: [{ type: "application/ld+json", innerHTML: jsonLd({
  "@context": "https://schema.org",
  "@type": "Quiz",
  name: "从哪条路径探索数学？",
  hasPart: quizQuestions.map((question) => ({
    "@type": "Question",
    name: question.prompt,
    suggestedAnswer: question.options.map((option) => ({ "@type": "Answer", text: option.label }))
  }))
}) }] });

const dailyState = await usePublished<DailyQuestion>("home-daily", "daily-question");
const glossaryState = await usePublished<unknown>("home-glossary", "glossary", { size: 3 });
const formulaState = await usePublished<unknown>("home-formulas", "formulas", { size: 3 });
const blogState = await usePublished<unknown>("home-blog", "articles", { type: 1, size: 3 });

const daily = computed(() => dailyState.data.value?.value ?? null);
const dailyOptions = computed(() => {
  const options = daily.value?.options;
  if (!Array.isArray(options)) return [];
  return options.map((item, index) => ({
    key: typeof item === "string" ? String.fromCharCode(65 + index) : item.key || String.fromCharCode(65 + index),
    text: typeof item === "string" ? item : item.text || item.label || item.content || ""
  })).filter((option) => option.text);
});
const featuredGlossary = computed(() => publicCards(glossaryState.data.value?.value, 3));
const featuredFormulas = computed(() => publicCards(formulaState.data.value?.value, 3, true));
const latestBlog = computed(() => publicCards(blogState.data.value?.value, 3));

const selectedDaily = ref<string | null>(null);
const publishedDailyAnswer = computed(() => (daily.value?.correctOption || daily.value?.correctAnswer || daily.value?.answer || "").toUpperCase());
const dailyFeedback = computed(() => {
  if (!selectedDaily.value) return "";
  if (!publishedDailyAnswer.value) return "已选择 " + selectedDaily.value + "。公开数据没有可核对的标准选项，请阅读下方解析。";
  return selectedDaily.value.toUpperCase() === publishedDailyAnswer.value
    ? "回答正确。你可以继续阅读完整解析，核对每一步依据。"
    : "这次选择与公开答案不同。请展开解析，看看关键条件在哪里。";
});
const dailyExpanded = ref(false);
const nowMs = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;
onMounted(() => { clock = setInterval(() => { nowMs.value = Date.now(); }, 1000); });
onBeforeUnmount(() => { if (clock) clearInterval(clock); });
const nextDaily = computed(() => countdownLabel(daily.value?.nextRevealAt || daily.value?.nextAt || daily.value?.nextQuestionAt, nowMs.value));
const dailyExplanation = computed(() => daily.value?.publicExplanation || daily.value?.explanation || daily.value?.analysis || "");
const dailySteps = computed(() => (daily.value?.chainSummary || []).map((step) => typeof step === "string" ? step : step.text || step.content || step.summary || "").filter(Boolean));

const quizStep = ref(0);
const answers = ref<number[]>([]);
const recommended = computed(() => recommendPath(answers.value));
const recommendedEntry = computed(() => recommended.value ? findEntry(paths, recommended.value) : null);
function chooseQuiz(index: number) {
  answers.value[quizStep.value] = index;
  answers.value = answers.value.slice(0, quizStep.value + 1);
  if (quizStep.value < quizQuestions.length - 1) quizStep.value += 1;
}
function restartQuiz() { answers.value = []; quizStep.value = 0; }
function previousQuiz() {
  quizStep.value = Math.max(0, quizStep.value - 1);
  answers.value = answers.value.slice(0, quizStep.value);
}
</script>

<template>
  <div>
    <!-- 01 Hero -->
    <section class="hero">
      <div class="container hero-inner">
        <div>
          <p class="eyebrow">数源 MathOrigin · 从理解开始</p>
          <h1>数学不只要会做，<br /><em>更要知道为什么。</em></h1>
          <p class="lead">同一个知识体系，六条到达路径。读概念、看连接、拆推理、辨公式，再由自己决定下一步怎样学。</p>
          <div class="action-row"><LearningCta label="从这里开始学习" from="official/hero" /><NuxtLink class="button subtle" to="/features/deepdive">看看一题五玩</NuxtLink></div>
          <p class="hero-note">先探索公开内容，再决定是否进入学习端。</p>
        </div>
        <div class="hero-visual" role="img" aria-label="一个方程从观察结构、因式分解到零因子律的三步推理示意">
          <p class="eyebrow">REASONING, STEP BY STEP</p>
          <div class="reason-step"><span class="step-number">01</span>观察结构 <strong>x² − 5x + 6 = 0</strong><small>先看什么信息值得使用？</small></div>
          <div class="reason-step"><span class="step-number">02</span>因式分解 <strong>(x−2)(x−3)=0</strong><small>两个因数为什么取负号？</small></div>
          <div class="reason-step"><span class="step-number">03</span>零因子律 <strong>x=2 或 x=3</strong><small>不跳步，也不漏解。</small></div>
        </div>
      </div>
    </section>

    <!-- 02 六路径 -->
    <section class="section">
      <div class="container">
        <div class="section-heading"><p class="eyebrow">01 · FIND YOUR WAY</p><h2>同一个目的地，可以有六种走法。</h2><p>从最适合你此刻的问题出发。每条路径连接同一套知识，不必把自己固定在一种学习方式里。</p></div>
        <div class="card-grid">
          <NuxtLink v-for="entry in paths" :key="entry.slug" class="card path-card" :style="{ '--accent': entry.accent }" :to="'/paths/' + entry.slug">
            <span class="card-kicker">{{ entry.eyebrow }}</span><h3>{{ entry.title }}</h3><p>{{ entry.summary }}</p><span class="card-link">了解这条路径 →</span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- 03 三内核 -->
    <section class="section alt">
      <div class="container">
        <div class="section-heading"><p class="eyebrow">02 · THE THREE ENGINES</p><h2>看懂题、看清知识、看透公式。</h2><p>一题五玩、概念四卡和公式七区，让学习从“记住答案”转向“知道依据”。</p></div>
        <div class="card-grid">
          <NuxtLink v-for="(entry, index) in features.slice(0, 3)" :key="entry.slug" class="card" :to="'/features/' + entry.slug"><span class="card-kicker">0{{ index + 1 }} · {{ entry.eyebrow }}</span><h3>{{ entry.title }}</h3><p>{{ entry.summary }}</p><span class="text-link">看看怎么学 →</span></NuxtLink>
        </div>
      </div>
    </section>

    <!-- 04 每日一题 -->
    <section class="section">
      <div class="container">
        <div class="section-heading"><p class="eyebrow">03 · TODAY'S QUESTION</p><h2>今天，花一点时间想清一题。</h2><p>每日题与解析都公开。选择答案后，仍可以读完整的解法依据。</p></div>
        <div v-if="daily" class="daily-preview">
          <div class="card">
            <span class="status-label">今日公开题</span>
            <p class="question" style="margin-top:19px">{{ daily.stem || daily.question }}</p>
            <div v-if="dailyOptions.length" class="answer-options">
              <button v-for="option in dailyOptions" :key="option.key" type="button" :class="{ selected: selectedDaily === option.key }" @click="selectedDaily = option.key">{{ option.key }} · {{ option.text }}</button>
            </div>
            <p v-if="dailyFeedback" class="inline-message" role="status">{{ dailyFeedback }}</p>
            <button class="button subtle" type="button" :aria-expanded="dailyExpanded" @click="dailyExpanded = !dailyExpanded">{{ dailyExpanded ? "收起解析" : "查看公开解析" }}</button>
            <div v-if="dailyExpanded" class="prose" style="margin-top:19px"><h3>解析与推理摘要</h3><p>{{ dailyExplanation || "这道题的公开解析尚未发布。" }}</p><ol v-if="dailySteps.length"><li v-for="step in dailySteps" :key="step">{{ step }}</li></ol></div>
          </div>
          <div class="card countdown-card"><span>下一题发布倒计时</span><strong>{{ nextDaily || "等待排期" }}</strong><small>发布时间由公开排期提供</small><NuxtLink class="button subtle" to="/daily" style="margin-top:20px">打开每日题页</NuxtLink></div>
        </div>
        <div v-else class="empty-state">今日公开题暂不可用。我们不会用占位题或假倒计时替代已发布内容。你可以先浏览 <NuxtLink class="text-link" to="/glossary">数学词条</NuxtLink>。</div>
      </div>
    </section>

    <!-- 05 路径测验 -->
    <section class="section alt">
      <div class="container">
        <div class="section-heading"><p class="eyebrow">04 · A SHORT QUIZ</p><h2>你会从哪条路走进去？</h2><p>三道题，只给一个探索建议；它不会创建画像，也不会替你决定计划。</p></div>
        <div class="card quiz-panel">
          <template v-if="!recommendedEntry">
            <span class="card-kicker">问题 {{ quizStep + 1 }} / {{ quizQuestions.length }}</span>
            <div class="quiz-progress" aria-hidden="true"><span v-for="(_, index) in quizQuestions" :key="index" :class="{ current: index <= quizStep }" /></div>
            <h3>{{ quizQuestions[quizStep].prompt }}</h3>
            <div class="quiz-options"><button v-for="(option, index) in quizQuestions[quizStep].options" :key="index" type="button" @click="chooseQuiz(index)">{{ option.label }}</button></div>
            <button v-if="quizStep > 0" type="button" class="button text" @click="previousQuiz">上一题</button>
          </template>
          <template v-else>
            <span class="card-kicker">探索建议 · 本地测验</span><h3>或许可以先试试「{{ recommendedEntry.title }}」。</h3><p>{{ recommendedEntry.summary }}</p>
            <div class="action-row" style="margin-top:20px"><LearningCta label="从这条路径开始" from="official/quiz" target-type="path" :slug="recommendedEntry.slug" action="start" /><NuxtLink class="button subtle" :to="'/paths/' + recommendedEntry.slug">了解详情</NuxtLink><button type="button" class="button text" @click="restartQuiz">重新选择</button></div>
          </template>
        </div>
      </div>
    </section>

    <!-- 06 结构背书 -->
    <section class="section dark">
      <div class="container">
        <div class="section-heading"><p class="eyebrow">05 · ONE CONNECTED SYSTEM</p><h2>一套知识体系，几种理解方式。</h2><p>这里展示的是产品结构，不是未核验的题库数量或学习成绩。</p></div>
        <div class="metric-strip"><div><strong>6</strong><span>学习路径</span></div><div><strong>3</strong><span>内容内核</span></div><div><strong>4</strong><span>概念阅读卡</span></div><div><strong>1</strong><span>连贯知识体系</span></div></div>
      </div>
    </section>

    <!-- 07 AI -->
    <section class="section">
      <div class="container split-section">
        <div class="card"><span class="card-kicker">苏格拉底式引导 · 界面示意</span><div class="reason-step">学员：为什么不能两边同除 x−2？</div><div class="reason-step">提示：如果 x−2 恰好等于 0，同除会漏掉什么？</div><p style="color:var(--ink3);font-size:12px;margin-bottom:0">对话为设计示意；AI 服务与题目上下文须由学习端按权限提供。</p></div>
        <div><p class="eyebrow">06 · ASK BETTER QUESTIONS</p><h2>先问一句“为什么”，再往下走。</h2><p class="lead">AI 导师的目标是帮助你检查推理，而不是让提示替你完成作答。受限测评与考试期间，辅助会按开考规则关闭。</p><NuxtLink class="button subtle" to="/features/ai">了解 AI 导师</NuxtLink></div>
      </div>
    </section>

    <!-- 08 已发布资源 -->
    <section class="section alt">
      <div class="container">
        <div class="section-heading"><p class="eyebrow">07 · PUBLIC LIBRARY</p><h2>先读一点公开内容。</h2><p>词条与公式来自公开发布内容；没有已发布数据时，我们会明确显示空态。</p></div>
        <div v-if="featuredGlossary.length || featuredFormulas.length" class="resource-grid">
          <NuxtLink v-for="entry in featuredGlossary" :key="'g-' + entry.slug" class="card" :to="'/glossary/' + entry.slug"><small>数学词条</small><strong>{{ entry.title }}</strong><p>{{ entry.summary || "查看概念起源与四卡。" }}</p></NuxtLink>
          <NuxtLink v-for="entry in featuredFormulas" :key="'f-' + entry.slug" class="card" :to="'/formulas/' + entry.slug"><small>公式馆</small><strong>{{ entry.title }}</strong><p>{{ entry.summary || "先看成立条件，再读推导摘要。" }}</p></NuxtLink>
        </div>
        <div v-else class="empty-state">精选内容尚未取得已发布数据。<NuxtLink class="text-link" to="/search">查看其他公开资源</NuxtLink></div>
      </div>
    </section>

    <!-- 09 方法论 -->
    <section class="section">
      <div class="container split-section">
        <div><p class="eyebrow">08 · THE WAY WE LEARN</p><h2>先从现实问题开始，再走向抽象。</h2><p class="lead">概念有起源，公式有条件，解法有依据。我们把这些内容放在同一个学习旅程里，让“我会做”逐渐变成“我能解释”。</p><NuxtLink class="text-link" to="/manifesto">阅读产品宣言 →</NuxtLink></div>
        <div class="card"><div class="reason-step"><span class="step-number">01</span>提出问题<small>为什么需要这个概念？</small></div><div class="reason-step"><span class="step-number">02</span>建立工具<small>在什么条件下成立？</small></div><div class="reason-step"><span class="step-number">03</span>解释和检验<small>每一步有没有依据？</small></div></div>
      </div>
    </section>

    <!-- 10 理念卡 -->
    <section class="section alt">
      <div class="container"><div class="section-heading"><p class="eyebrow">09 · OUR PRINCIPLES</p><h2>好的反馈，应该让下一步更清楚。</h2></div><div class="quote-grid"><div class="card"><blockquote>“不知道”也是一个有价值的学习状态。</blockquote><p>样本不足时，我们不会硬给掌握结论。</p></div><div class="card"><blockquote>“可能卡在这里”不能写成“已经发现断点”。</blockquote><p>建议、自报与作答观测各有自己的名字。</p></div><div class="card"><blockquote>计划应该跟着证据调整，也尊重你的决定。</blockquote><p>每次改动都先展示差异，再由你确认。</p></div></div></div>
    </section>

    <!-- 11 下载 -->
    <section class="section">
      <div class="container"><div class="section-heading"><p class="eyebrow">10 · LEARN ANYWHERE</p><h2>换个屏幕，继续同一个问题。</h2><p>Web 学习端提供大屏推理与图谱；手机端面向碎片时间与单手操作。下载渠道按实际上线状态展示。</p></div><div class="card-grid"><div class="card"><span class="card-kicker">WEB</span><h3>学习 Web 端</h3><p>适合长题、推理链和知识图谱。</p><LearningCta label="前往学习端" from="official/download-web" subtle style="margin-top:17px" /></div><div class="card"><span class="card-kicker">MOBILE</span><h3>手机学习端</h3><p>五个主入口，把续学、做题与复盘放在触手可及的位置。</p><NuxtLink class="text-link" to="/download">查看可用渠道 →</NuxtLink></div><div class="card"><span class="card-kicker">ACCESS</span><h3>公开内容无需登录</h3><p>先读词条、公式和每日题，再决定要不要保存学习进度。</p><NuxtLink class="text-link" to="/glossary">开始探索 →</NuxtLink></div></div></div>
    </section>

    <!-- 12 订阅与文章 -->
    <section class="section alt">
      <div class="container"><div class="newsletter-band split-section"><div><p class="eyebrow">11 · LETTERS FROM MATH</p><h2>每周一封，数学与世界。</h2><p class="lead">读一个概念的来处、一种解法的依据，以及它怎样进入现实问题。</p></div><NewsletterForm /></div><div class="section-heading" style="margin-top:65px"><p class="eyebrow">12 · FROM THE JOURNAL</p><h2>继续阅读。</h2></div><div v-if="latestBlog.length" class="resource-grid"><NuxtLink v-for="entry in latestBlog" :key="entry.slug" class="card" :to="'/blog/' + entry.slug"><small>已发布文章</small><strong>{{ entry.title }}</strong><p>{{ entry.summary }}</p></NuxtLink></div><div v-else class="empty-state">文章尚未取得已发布数据。<NuxtLink class="text-link" to="/blog">查看博客页面</NuxtLink></div></div>
    </section>
  </div>
</template>
