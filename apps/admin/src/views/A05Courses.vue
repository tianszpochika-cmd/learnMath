<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { readCourseDetail, readCourses, moveChapterOnServer, type AdminChapter, type AdminCourse } from "../services/content";

const router = useRouter();
const courses = ref<AdminCourse[]>([]);
const total = ref<number | null>(null);
const page = ref(1);
const keyword = ref("");
const status = ref("");
const loading = ref(true);
const error = ref("");
const notice = ref("");
const selected = ref<AdminCourse | null>(null);
const chapters = ref<AdminChapter[]>([]);
const detailLoading = ref(false);
const detailError = ref("");
const moving = ref(false);

async function load() {
  loading.value = true; error.value = "";
  try { const result = await readCourses(page.value, keyword.value.trim(), status.value); courses.value = result.items; total.value = result.total; }
  catch (cause) { courses.value = []; total.value = null; error.value = cause instanceof Error ? cause.message : "课程列表暂不可用"; }
  finally { loading.value = false; }
}
async function open(course: AdminCourse) {
  selected.value = course; chapters.value = []; detailError.value = ""; detailLoading.value = true;
  try { const detail = await readCourseDetail(course.id); chapters.value = detail.chapters; }
  catch (cause) { detailError.value = cause instanceof Error ? cause.message : "课程详情暂不可用"; }
  finally { detailLoading.value = false; }
}
async function move(index: number, direction: -1 | 1) {
  if (!selected.value || moving.value) return;
  const current = chapters.value[index], target = chapters.value[index + direction];
  if (!current || !target) return;
  moving.value = true; detailError.value = ""; notice.value = "";
  try {
    await moveChapterOnServer(current.id, current.parentId, target.sort ?? index + direction);
    await open(selected.value);
    notice.value = "管理服务已确认章节排序更新。";
  } catch (cause) { detailError.value = cause instanceof Error ? cause.message : "章节排序未获服务端确认"; }
  finally { moving.value = false; }
}
function search() { page.value = 1; void load(); }
function nextPage() { if (total.value !== null ? page.value * 20 >= total.value : courses.value.length < 20) return; page.value += 1; void load(); }
function prevPage() { if (page.value <= 1) return; page.value -= 1; void load(); }
const statusLabel = (value: AdminCourse["status"]) => value === "published" ? "上架" : value === "offline" ? "下架" : "草稿";
onMounted(() => { void load(); });
</script>

<template>
  <div class="ops-page">
    <header class="ops-heading"><div><p class="ops-eyebrow">A05 · COURSE CONTENT</p><h1>课程与章节</h1><p class="ops-lead">从管理服务读取课程，再进入真实章节树。排序操作按章节编号提交并回读结果。</p></div><div class="ops-actions"><button class="ops-btn secondary" type="button" @click="load">刷新列表</button></div></header>
    <div class="filters ops-card"><label class="ops-field"><span>课程关键词</span><input v-model="keyword" type="search" placeholder="搜索课程名称" @keyup.enter="search" /></label><label class="ops-field"><span>状态</span><select v-model="status"><option value="">全部状态</option><option value="published">上架</option><option value="draft">草稿</option><option value="offline">下架</option></select></label><button class="ops-btn" type="button" @click="search">查询</button></div>
    <p v-if="loading" class="ops-state" role="status">正在读取课程列表…</p><p v-else-if="error" class="ops-state error" role="alert">{{ error }}</p><p v-if="notice" class="ops-state" role="status">{{ notice }}</p>
    <div v-if="!loading && !error" class="ops-table-wrap"><table class="ops-table"><thead><tr><th>课程</th><th>章节 / 课时</th><th>状态</th><th>更新</th><th>操作</th></tr></thead><tbody><tr v-for="course in courses" :key="course.id"><td><strong>{{ course.title }}</strong><small>#{{ course.id }}</small></td><td>{{ course.chapterCount ?? "—" }} / {{ course.lessonCount ?? "—" }}</td><td><span class="badge" :class="course.status">{{ statusLabel(course.status) }}</span></td><td>{{ course.updatedAt || "—" }}</td><td><button class="text-action" type="button" @click="open(course)">查看章节 →</button></td></tr><tr v-if="courses.length === 0"><td colspan="5" class="empty">服务端没有返回符合条件的课程</td></tr></tbody></table></div>
    <div class="pager"><span>{{ total === null ? "总数未提供" : `共 ${total} 门` }} · 第 {{ page }} 页</span><div><button class="ops-btn secondary" type="button" :disabled="page <= 1 || loading" @click="prevPage">上一页</button><button class="ops-btn secondary" type="button" :disabled="loading || (total !== null ? page * 20 >= total : courses.length < 20)" @click="nextPage">下一页</button></div></div>
    <section v-if="selected" class="detail ops-card" aria-labelledby="course-detail-title"><div class="detail-head"><div><p class="ops-eyebrow">COURSE TREE</p><h2 id="course-detail-title">{{ selected.title }}</h2></div><button class="ops-btn secondary" type="button" @click="selected = null">关闭详情</button></div><p v-if="detailLoading" class="ops-state">正在读取章节…</p><p v-if="detailError" class="ops-state error" role="alert">{{ detailError }}</p><div v-if="!detailLoading" class="chapters"><article v-for="(chapter,index) in chapters" :key="chapter.id" class="chapter"><div class="chapter-head"><div><span class="order">{{ index + 1 }} / {{ chapters.length }}</span><strong>{{ chapter.title }}</strong></div><div class="ops-actions"><button class="icon-action" type="button" :disabled="index === 0 || moving" :aria-label="`上移${chapter.title}`" @click="move(index,-1)">↑</button><button class="icon-action" type="button" :disabled="index === chapters.length - 1 || moving" :aria-label="`下移${chapter.title}`" @click="move(index,1)">↓</button></div></div><div v-if="chapter.lessons.length" class="lessons"><button v-for="lesson in chapter.lessons" :key="lesson.id" type="button" @click="router.push('/lessons/' + encodeURIComponent(lesson.id) + '/edit')">{{ lesson.title }} <span>编辑课时 →</span></button></div><p v-else class="ops-muted">本章暂无服务端课时记录。</p></article><p v-if="chapters.length === 0 && !detailError" class="ops-state">服务端没有返回章节树；课时入口暂不可用。</p></div></section>
    <p class="foot">新建课程的表单字段与发布动作请求体尚未写入接口契约，本页不提供本地“新建成功”演示。</p>
  </div>
</template>

<style scoped>
.filters{display:flex;align-items:end;gap:12px;margin-bottom:14px}.filters .ops-field{min-width:210px}.ops-table td small{display:block;margin-top:4px;color:var(--ink3);font-size:11px}.badge{padding:4px 9px;border-radius:99px;font-size:11px;font-weight:800}.badge.published{background:#1e77452b;color:#20844b}.badge.draft{background:#bb801e2b;color:#a67012}.badge.offline{background:var(--ops-soft);color:var(--ink3)}.text-action{padding:5px;border:0;background:transparent;color:var(--brand-deep);font-size:12px;font-weight:800}.empty{text-align:center;color:var(--ink3);padding:26px!important}.pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;color:var(--ink3);font-size:12px}.pager>div{display:flex;gap:7px}.pager .ops-btn{min-height:32px}.detail{margin-top:22px}.detail-head,.chapter-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.detail-head h2{margin:0}.chapters{display:grid;gap:9px}.chapter{padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--ops-soft)}.chapter-head>div:first-child{display:flex;align-items:center;gap:10px}.order{color:var(--ink3);font-size:11px}.icon-action{min-width:32px;min-height:30px;border:1px solid var(--line);border-radius:7px;background:var(--ops-card);color:var(--brand-deep)}.lessons{display:grid;gap:6px;margin-top:10px}.lessons button{display:flex;justify-content:space-between;gap:10px;padding:9px 12px;border:1px solid var(--line);border-radius:8px;background:var(--ops-card);color:var(--ink);text-align:left}.lessons button span{color:var(--brand-deep);font-size:12px}.chapter>.ops-muted{margin:10px 0 0;font-size:12px}.foot{margin-top:14px;color:var(--ink3);font-size:12px;line-height:1.6}
@media(max-width:650px){.filters{align-items:stretch;flex-direction:column}.pager{align-items:flex-start;flex-direction:column}}
</style>
