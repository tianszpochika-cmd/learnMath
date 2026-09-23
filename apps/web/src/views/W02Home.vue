<script setup lang="ts">
import { onMounted, ref } from "vue";
import { isApiError } from "@learnmath/shared";
import { useRouter } from "vue-router";
import { learningApi, learningError } from "../services/learning";

/** W02：/user/home 是首屏聚合请求；04 未定义响应字段，禁止用 fixture 补数。 */
const router = useRouter();
const state = ref<"loading" | "empty" | "unmapped" | "error">("loading");
const error = ref("");
const checkinBusy = ref(false);
const checkinConfirmed = ref(false);
const checkinNote = ref("");

async function load(): Promise<void> {
  state.value = "loading";
  error.value = "";
  try {
    const result = await learningApi.home();
    state.value = result === null || result === undefined ? "empty" : "unmapped";
  } catch (cause) {
    error.value = learningError(cause);
    state.value = "error";
  }
}

async function checkin(): Promise<void> {
  if (checkinBusy.value || checkinConfirmed.value) return;
  checkinBusy.value = true;
  checkinNote.value = "";
  try {
    const result = await learningApi.checkin();
    if (result === null || result === undefined) {
      checkinNote.value = "打卡接口未返回可核实状态；暂不显示成功，请稍后查询。";
      return;
    }
    checkinConfirmed.value = true;
    checkinNote.value = "打卡请求已由服务端处理。连续天数仍以打卡状态接口为准。";
    await load();
  } catch (cause) {
    if (isApiError(cause) && cause.code === 3501) {
      checkinConfirmed.value = true;
      checkinNote.value = "服务端确认今天已打卡。";
    } else {
      checkinNote.value = "打卡未确认：" + learningError(cause);
    }
  } finally {
    checkinBusy.value = false;
  }
}
onMounted(() => { void load(); });
</script>

<template>
  <main class="home-page">
    <header class="hero">
      <div>
        <span class="eyebrow">LEARNING TODAY · 学习总览</span>
        <h1>今天，从下一步开始。</h1>
        <p>任务、课程与路径会以你的真实学习记录更新。先选一个方向，继续推进。</p>
        <div class="hero-actions">
          <button class="primary" @click="router.push('/paths')">浏览学习路径 <span aria-hidden="true">↗</span></button>
          <button class="secondary" @click="router.push('/wrongbook')">查看错题本</button>
        </div>
      </div>
      <div class="hero-mark" aria-hidden="true"><span>∑</span><small>ONE STEP<br>AT A TIME</small></div>
    </header>

    <div class="section-heading"><div><span class="eyebrow">YOUR DASHBOARD</span><h2>学习概览</h2></div><button class="text-button" :disabled="state === 'loading'" @click="load">重新获取 ↻</button></div>
    <div v-if="state === 'loading'" class="notice" role="status">正在读取你的学习概览…</div>
    <div v-else-if="state === 'error'" class="notice error" role="alert">学习概览暂时无法获取：{{ error }} <button @click="load">重试</button></div>
    <div v-else-if="state === 'empty'" class="notice">服务端尚未返回学习概览。完成一次学习后可回来查看。</div>
    <div v-else class="notice">学习概览接口已响应；任务、进度与推荐字段尚未形成已评审契约，暂不展示未经核实的数字。</div>

    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-top"><span class="icon">✓</span><span class="tag">今日</span></div>
        <h3>今日任务</h3>
        <p>任务完成由服务端学习事件判定。当前无法读取任务明细与完成进度。</p>
        <button class="panel-link" @click="router.push('/paths')">去路径中心选择内容 <span>→</span></button>
      </section>
      <section class="panel">
        <div class="panel-top"><span class="icon">✦</span><span class="tag">习惯</span></div>
        <h3>每日打卡</h3>
        <p>连续天数和本月日历等待状态接口字段确认；这里不会预填天数。</p>
        <button class="checkin-button" :disabled="checkinBusy || checkinConfirmed" @click="checkin">{{ checkinBusy ? '正在提交…' : checkinConfirmed ? '今日请求已处理' : '提交今日打卡' }}</button>
        <span v-if="checkinNote" class="feedback" role="status">{{ checkinNote }}</span>
      </section>
      <section class="panel">
        <div class="panel-top"><span class="icon">▤</span><span class="tag">继续</span></div>
        <h3>在学课程</h3>
        <p>课程进度和继续学习位置等待首页聚合字段确认；进入课程列表可查看已发布内容。</p>
        <button class="panel-link" @click="router.push('/paths')">查看课程与路径 <span>→</span></button>
      </section>
    </div>

    <section class="next-section">
      <div class="section-heading"><div><span class="eyebrow">EXPLORE</span><h2>按你的节奏学习</h2></div></div>
      <div class="next-grid">
        <button class="next-card" @click="router.push('/paths')"><span class="next-icon blue">01</span><b>系统课程</b><span>从章节目录开始，逐课推进。</span><strong>进入路径中心 ↗</strong></button>
        <button class="next-card" @click="router.push('/graph')"><span class="next-icon green">02</span><b>知识图谱</b><span>查看知识之间的连接与前置关系。</span><strong>打开图谱 ↗</strong></button>
        <button class="next-card" @click="router.push('/plans')"><span class="next-icon purple">03</span><b>学习计划</b><span>按计划安排下一次学习。</span><strong>查看计划 ↗</strong></button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.home-page{max-width:1240px;margin:auto;padding:28px 32px 64px}.hero{position:relative;overflow:hidden;display:flex;justify-content:space-between;min-height:285px;padding:42px 48px;border-radius:24px;background:#15244d;color:white;box-shadow:0 18px 46px #1a32612b}.hero:after{content:"";position:absolute;right:-110px;top:-250px;width:540px;height:540px;border:1px solid #ffffff36;border-radius:50%;box-shadow:0 0 0 66px #ffffff0c,0 0 0 132px #ffffff0a}.hero>div{position:relative;z-index:1}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.18em;color:#6b82ac}.hero .eyebrow{color:#9ec0ff}.hero h1{margin:18px 0 12px;font-size:clamp(27px,3vw,41px);letter-spacing:-.035em}.hero p{max-width:550px;line-height:1.8;color:#cbd7f3;font-size:14px}.hero-actions{display:flex;gap:10px;margin-top:29px;flex-wrap:wrap}button{font:inherit;cursor:pointer}.primary,.secondary{border:0;border-radius:10px;padding:12px 20px;font-size:14px;font-weight:750}.primary{background:#fff;color:#1e46a5}.primary span{margin-left:14px}.secondary{color:#fff;background:#ffffff1d;border:1px solid #ffffff52}.hero-mark{align-self:center;display:flex;flex-direction:column;align-items:center;min-width:190px}.hero-mark span{font-family:Georgia,serif;font-size:118px;line-height:1;color:#ffffffc7}.hero-mark small{text-align:center;letter-spacing:.22em;font-size:9px;line-height:1.6;color:#b8c9ef}.section-heading{display:flex;justify-content:space-between;align-items:end;margin:35px 0 17px}.section-heading h2{font-size:22px;margin-top:6px;letter-spacing:-.02em}.text-button{border:0;background:none;color:#3265db;font-size:13px;font-weight:700}.text-button:disabled{opacity:.5}.notice{padding:13px 17px;border:1px solid #d9e4f8;border-radius:11px;background:#eff5ff;color:#34527f;font-size:13px;line-height:1.6;margin-bottom:16px}.notice.error{border-color:#f2d5d5;background:#fff4f4;color:#9e3434}.notice button{border:0;background:none;color:inherit;text-decoration:underline;margin-left:6px}.dashboard-grid,.next-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.panel,.next-card{border:1px solid #e1e8f2;background:#fff;border-radius:18px;padding:22px;text-align:left;box-shadow:0 9px 24px #22345c08}.panel{min-height:245px;display:flex;flex-direction:column}.panel-top{display:flex;justify-content:space-between;align-items:center}.icon{width:37px;height:37px;display:grid;place-items:center;border-radius:10px;background:#eff4ff;color:#416ce5;font-weight:800}.tag{font-size:11px;color:#71809d;background:#f2f5fa;border-radius:20px;padding:5px 10px}.panel h3{font-size:19px;margin-top:19px}.panel p{font-size:13px;line-height:1.7;color:#6d7890;margin:10px 0 18px}.panel-link{display:flex;width:100%;justify-content:space-between;margin-top:auto;padding:11px 0 0;border:0;border-top:1px solid #edf0f5;background:none;color:#2862d2;font-size:13px;font-weight:750}.checkin-button{align-self:flex-start;margin-top:auto;border:0;border-radius:9px;background:#315fe2;color:#fff;padding:10px 16px;font-size:13px;font-weight:750}.checkin-button:disabled{background:#c6d0e0;cursor:default}.feedback{font-size:12px;line-height:1.5;color:#536885;margin-top:9px}.next-section{margin-top:8px}.next-card{display:flex;min-height:186px;flex-direction:column;gap:8px;transition:transform .18s,border-color .18s}.next-card:hover{transform:translateY(-3px);border-color:#a9bfea}.next-card b{font-size:18px}.next-card>span:not(.next-icon){font-size:13px;color:#71809d;line-height:1.6}.next-card strong{font-size:12px;color:#3465ce;margin-top:auto}.next-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;font-size:11px;font-weight:800;margin-bottom:8px}.blue{background:#eaf1ff;color:#426be1}.green{background:#e5f9f2;color:#159873}.purple{background:#f2edff;color:#7950cc}@media(max-width:900px){.dashboard-grid,.next-grid{grid-template-columns:1fr 1fr}.hero-mark{min-width:100px}.hero-mark span{font-size:82px}}@media(max-width:640px){.home-page{padding:16px 16px 45px}.hero{padding:30px 24px;min-height:270px}.hero-mark{display:none}.dashboard-grid,.next-grid{grid-template-columns:1fr}.panel{min-height:210px}.section-heading{margin-top:28px}}
</style>
