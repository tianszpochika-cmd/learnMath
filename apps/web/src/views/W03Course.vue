<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { courseList, coursePreview, type CoursePreview } from "../features/course/learningProjection";
import { learningApi, learningError, safeId } from "../services/learning";

type LoadState = "loading" | "ready" | "empty" | "unmapped" | "error";
const route = useRoute();
const router = useRouter();
const isPaths = computed(() => route.name === "paths");
const pathState = ref<LoadState>("loading");
const pathError = ref("");
const listState = ref<LoadState>("loading");
const listError = ref("");
const courses = ref<CoursePreview[]>([]);
const courseTotal = ref(0);
const detailState = ref<LoadState>("loading");
const detailError = ref("");
const course = ref<CoursePreview | null>(null);
const treeState = ref<LoadState>("loading");
const treeError = ref("");
let generation = 0;

/** 六路径的名称/用途是产品配置；用户进度和推荐标记只可由 /paths 响应给出。 */
const paths = [
  { code: "P1", name: "系统课程", description: "按章节顺序建立完整知识结构", mark: "01", href: "" },
  { code: "P2", name: "知识图谱", description: "沿知识关联探索前置与后继", mark: "02", href: "/graph" },
  { code: "P3", name: "测评计划", description: "从测评与计划找到当前起点", mark: "03", href: "/plans" },
  { code: "P4", name: "阶梯刷题", description: "按难度逐级练习与反馈", mark: "04", href: "" },
  { code: "P5", name: "专题研习", description: "围绕一个主题做深入学习", mark: "05", href: "" },
  { code: "P6", name: "闯关挑战", description: "以关卡串联复习与挑战", mark: "06", href: "" },
] as const;

async function loadPaths(current: number): Promise<void> {
  pathState.value = "loading";
  listState.value = "loading";
  pathError.value = "";
  listError.value = "";
  const [pathResult, courseResult] = await Promise.allSettled([learningApi.paths(), learningApi.courses()]);
  if (current !== generation) return;
  if (pathResult.status === "rejected") {
    pathError.value = learningError(pathResult.reason);
    pathState.value = "error";
  } else {
    pathState.value = pathResult.value === null || pathResult.value === undefined ? "empty" : "unmapped";
  }
  if (courseResult.status === "rejected") {
    listError.value = learningError(courseResult.reason);
    listState.value = "error";
  } else {
    const mapped = courseList(courseResult.value);
    if (!mapped) listState.value = "unmapped";
    else {
      courses.value = mapped.items;
      courseTotal.value = mapped.total;
      listState.value = mapped.total === 0 ? "empty" : "ready";
    }
  }
}

async function loadDetail(current: number, id: string): Promise<void> {
  detailState.value = "loading";
  treeState.value = "loading";
  detailError.value = "";
  treeError.value = "";
  course.value = null;
  try {
    safeId(id);
  } catch (cause) {
    detailState.value = "error";
    treeState.value = "error";
    detailError.value = learningError(cause);
    treeError.value = detailError.value;
    return;
  }
  const [detailResult, treeResult] = await Promise.allSettled([learningApi.course(id), learningApi.courseTree(id)]);
  if (current !== generation) return;
  if (detailResult.status === "rejected") {
    detailState.value = "error";
    detailError.value = learningError(detailResult.reason);
  } else {
    course.value = coursePreview(detailResult.value);
    detailState.value = course.value ? "ready" : detailResult.value === null ? "empty" : "unmapped";
  }
  if (treeResult.status === "rejected") {
    treeState.value = "error";
    treeError.value = learningError(treeResult.reason);
  } else {
    treeState.value = Array.isArray(treeResult.value) && treeResult.value.length === 0 ? "empty" : "unmapped";
  }
}

function reload(): void {
  const current = ++generation;
  if (isPaths.value) void loadPaths(current);
  else void loadDetail(current, String(route.params.id ?? ""));
}
watch(() => [route.name, route.params.id], reload, { immediate: true });
</script>

<template>
  <main class="course-page">
    <template v-if="isPaths">
      <header class="page-head">
        <div><span class="eyebrow">SIX WAYS TO LEARN</span><h1>选择你的学习路径</h1><p>路径介绍可以先浏览；个人进度与推荐状态只以服务端记录为准。</p></div>
        <span class="head-symbol" aria-hidden="true">⌁</span>
      </header>
      <div v-if="pathState === 'loading'" class="notice" role="status">正在获取路径状态…</div>
      <div v-else-if="pathState === 'error'" class="notice error" role="alert">路径状态暂不可用：{{ pathError }} <button @click="reload">重试</button></div>
      <div v-else class="notice">路径进度和推荐标记的响应字段尚未约定；下方为路径介绍，不代表已解锁或已完成。</div>
      <div class="path-grid">
        <article v-for="item in paths" :key="item.code" class="path-card" :class="item.code.toLowerCase()">
          <div class="card-top"><span>{{ item.code }}</span><small>{{ item.mark }} / 06</small></div>
          <h2>{{ item.name }}</h2><p>{{ item.description }}</p>
          <button v-if="item.href" class="card-action" @click="router.push(item.href)">打开页面 <span>↗</span></button>
          <span v-else class="card-muted">学习入口等待内容与接口确认</span>
        </article>
      </div>
      <section class="course-list">
        <div class="section-heading"><div><span class="eyebrow">P1 · COURSES</span><h2>系统课程</h2></div><span v-if="listState === 'ready'" class="count">{{ courseTotal }} 门课程</span></div>
        <div v-if="listState === 'loading'" class="list-state" role="status">正在读取已发布课程…</div>
        <div v-else-if="listState === 'error'" class="list-state error">课程列表暂不可用：{{ listError }} <button @click="reload">重试</button></div>
        <div v-else-if="listState === 'empty'" class="list-state">目前没有可展示的课程。</div>
        <div v-else-if="listState === 'unmapped'" class="list-state">课程列表已返回，但课程字段与当前界面尚未完成契约对齐。</div>
        <div v-else class="courses">
          <button v-for="item in courses" :key="item.id" class="course-item" @click="router.push('/paths/course/' + item.id)">
            <span class="course-icon">▤</span><span class="course-copy"><b>{{ item.title }}</b><small>{{ item.description || '查看课程详情' }}</small></span><span class="arrow">→</span>
          </button>
        </div>
      </section>
    </template>
    <template v-else>
      <button class="back" @click="router.push('/paths')">← 返回路径中心</button>
      <header class="detail-head">
        <div class="detail-cover">▤</div>
        <div><span class="eyebrow">SYSTEM COURSE · 系统课程</span><h1>{{ course?.title || '课程详情' }}</h1>
          <p v-if="detailState === 'ready'">{{ course?.description || '课程介绍暂未提供。' }}</p>
          <p v-else-if="detailState === 'loading'">正在读取课程资料…</p>
          <p v-else-if="detailState === 'error'">课程资料暂不可用：{{ detailError }}</p>
          <p v-else-if="detailState === 'empty'">这门课程尚未提供详情。</p>
          <p v-else>课程数据已返回，但详情字段尚未对齐。</p>
        </div>
        <button class="refresh" @click="reload">刷新</button>
      </header>
      <div class="detail-grid">
        <section class="detail-panel">
          <div class="panel-title"><span class="eyebrow">CONTENTS</span><h2>章节目录</h2></div>
          <div v-if="treeState === 'loading'" class="list-state" role="status">正在读取章节与课时…</div>
          <div v-else-if="treeState === 'error'" class="list-state error">章节目录暂不可用：{{ treeError }} <button @click="reload">重试</button></div>
          <div v-else-if="treeState === 'empty'" class="list-state">课程暂无已发布课时。</div>
          <div v-else class="list-state">服务端章节树已返回；节点、锁态与课时编号字段尚未形成已评审契约，暂不提供可能误导的进入链接。</div>
        </section>
        <aside class="detail-panel aside">
          <span class="eyebrow">YOUR PROGRESS</span><h2>学习进度</h2>
          <p>课时完成数、投入时长与正确率等待课程详情字段确认。这里不会用示例数据代替。</p>
          <div class="aside-rule"></div>
          <h3>从知识点开始</h3><p>也可以先在图谱中查看课程相关的前置知识。</p>
          <button class="aside-link" @click="router.push('/graph')">打开知识图谱 →</button>
        </aside>
      </div>
    </template>
  </main>
</template>

<style scoped>
.course-page{max-width:1240px;margin:auto;padding:28px 32px 70px}.page-head{position:relative;display:flex;justify-content:space-between;align-items:center;padding:39px 42px;border-radius:22px;background:#15244d;color:#fff;overflow:hidden}.page-head:after{content:"";position:absolute;width:320px;height:320px;right:-30px;top:-125px;border:1px solid #ffffff2b;border-radius:50%;box-shadow:0 0 0 45px #ffffff0b,0 0 0 90px #ffffff08}.page-head>div,.head-symbol{z-index:1}.eyebrow{font-size:11px;letter-spacing:.18em;font-weight:800;color:#7183a1}.page-head .eyebrow{color:#a8c0ef}.page-head h1,.detail-head h1{font-size:clamp(25px,3vw,37px);margin:12px 0;letter-spacing:-.03em}.page-head p{font-size:14px;color:#c2d0eb;line-height:1.7}.head-symbol{font:100px Georgia,serif;color:#abc7ff}.notice,.list-state{padding:15px 18px;background:#f0f5ff;border:1px solid #dce6f8;border-radius:11px;color:#446087;font-size:13px;line-height:1.7;margin-top:18px}.notice.error,.list-state.error{background:#fff5f5;border-color:#f0d2d2;color:#a04242}.notice button,.list-state button{border:0;background:none;color:inherit;text-decoration:underline;font:inherit;cursor:pointer}.path-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:18px}.path-card{display:flex;flex-direction:column;min-height:215px;padding:23px;border:1px solid #e2e9f2;border-top:4px solid var(--accent);border-radius:15px;background:#fff;box-shadow:0 8px 24px #1c36530b}.path-card.p1{--accent:#4271e8}.path-card.p2{--accent:#19a883}.path-card.p3{--accent:#895edb}.path-card.p4{--accent:#e9a832}.path-card.p5{--accent:#e269a6}.path-card.p6{--accent:#e6804b}.card-top{display:flex;justify-content:space-between;align-items:center}.card-top span{font-size:11px;font-weight:900;color:var(--accent);letter-spacing:.1em}.card-top small{font-size:11px;color:#9aa7bc}.path-card h2{font-size:20px;margin-top:22px}.path-card p{font-size:13px;line-height:1.65;color:#71809a;margin:8px 0 20px}.card-action,.card-muted{margin-top:auto;font-size:12px;font-weight:750}.card-action{display:flex;justify-content:space-between;color:var(--accent);background:none;border:0;border-top:1px solid #edf0f5;padding:13px 0 0;cursor:pointer}.card-muted{color:#99a5b7;border-top:1px solid #edf0f5;padding-top:13px}.course-list{margin-top:38px}.section-heading{display:flex;align-items:end;justify-content:space-between;margin-bottom:15px}.section-heading h2,.panel-title h2{font-size:22px;margin-top:7px}.count{font-size:12px;color:#657b9b}.courses{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.course-item{display:flex;align-items:center;gap:15px;background:#fff;border:1px solid #e2e9f2;border-radius:13px;padding:16px;text-align:left;cursor:pointer}.course-item:hover{border-color:#9db8ec}.course-icon{display:grid;place-items:center;width:43px;height:43px;border-radius:10px;background:#edf3ff;color:#406bdb;font-size:19px}.course-copy{display:flex;flex-direction:column;gap:5px;flex:1}.course-copy b{font-size:15px}.course-copy small{font-size:12px;color:#7c8ba1}.arrow{color:#4b71c4}.back{border:0;background:none;color:#4768a6;font-weight:700;font-size:13px;margin:0 0 16px;cursor:pointer}.detail-head{display:flex;align-items:center;gap:23px;background:#fff;border:1px solid #e2e9f2;border-radius:20px;padding:25px}.detail-cover{width:115px;height:115px;flex:none;display:grid;place-items:center;border-radius:15px;background:linear-gradient(145deg,#2756bb,#8a9deb);font-size:48px;color:#fff}.detail-head>div:nth-child(2){flex:1}.detail-head p{font-size:13px;line-height:1.7;color:#75839b}.refresh{border:1px solid #d6e1f2;background:#f6f9ff;color:#4266b7;border-radius:9px;padding:9px 13px;font-weight:700;cursor:pointer}.detail-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:17px;margin-top:17px}.detail-panel{min-height:330px;background:#fff;border:1px solid #e2e9f2;border-radius:17px;padding:25px}.detail-panel .list-state{margin-top:22px}.aside h2{font-size:22px;margin:8px 0 13px}.aside h3{font-size:15px;margin:18px 0 7px}.aside p{font-size:13px;line-height:1.75;color:#72819a}.aside-rule{height:1px;background:#edf0f5;margin:23px 0}.aside-link{border:0;background:#edf3ff;color:#3562c4;border-radius:9px;padding:10px 14px;margin-top:15px;font-weight:750;cursor:pointer}@media(max-width:900px){.path-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.detail-grid{grid-template-columns:1fr}}@media(max-width:640px){.course-page{padding:16px 16px 48px}.page-head{padding:28px 24px}.head-symbol{display:none}.path-grid,.courses{grid-template-columns:1fr}.detail-head{align-items:start;flex-wrap:wrap}.detail-cover{width:70px;height:70px;font-size:30px}.detail-head>div:nth-child(2){min-width:180px}.refresh{margin-left:auto}.detail-panel{min-height:240px}}
</style>
