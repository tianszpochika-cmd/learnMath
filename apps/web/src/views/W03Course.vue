<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { courseRingPercent, type CourseNow } from "../features/home/homeAggregation";
import {
  chapterSummary,
  flattenVisible,
  lockLabel,
  pathCenterRows,
  toggleExpand,
  type TreeNode,
} from "../features/course/courseTree";

/** W03 路径中心 + 课程详情（16W03；树/锁态逻辑在 courseTree 单测锁定）。 */
const route = useRoute();
const router = useRouter();
const isPaths = computed(() => route.name === "paths");
const rows = pathCenterRows();

const course: CourseNow = {
  title: "一元二次方程 · 从因式分解到求根",
  doneLessons: 5,
  totalLessons: 8,
  resumeRoute: "/learn/1/5",
};
const ring = computed(() => courseRingPercent(course));
const summary = computed(() => chapterSummary({ lessons: 8, done: 5, accuracy: 83.4 }));

const nodes: TreeNode[] = [
  { id: 1, parentId: null, title: "第 1 章 等式的性质", status: "published" },
  { id: 11, parentId: 1, title: "1.1 等式的两边", status: "published", isLesson: true },
  { id: 12, parentId: 1, title: "1.2 移项法则", status: "published", isLesson: true },
  { id: 2, parentId: null, title: "第 2 章 因式分解", status: "published" },
  { id: 21, parentId: 2, title: "2.1 十字相乘", status: "published", isLesson: true },
  { id: 3, parentId: null, title: "第 3 章 求根公式", status: "published" },
  { id: 31, parentId: 3, title: "3.2 求根公式的来历", status: "published", isLesson: true, current: true },
  { id: 4, parentId: null, title: "第 4 章 应用与建模", status: "published", locked: true, lockReason: "前置：判别式掌握 ≥80" },
  { id: 9, parentId: null, title: "第 9 章 草稿未发布", status: "draft" },
  { id: 91, parentId: 9, title: "9.1 草稿课时", status: "published", isLesson: true },
];

const collapsed = ref(new Set<number>());
const flat = computed(() => flattenVisible(nodes, collapsed.value));
function toggle(id: number): void {
  collapsed.value = toggleExpand(collapsed.value, id);
}
function openLesson(n: TreeNode): void {
  if (n.locked) {
    return;
  }
  if (n.isLesson) {
    void router.push("/learn/1/32");
  }
}
</script>

<template>
  <!-- 路径中心 -->
  <div v-if="isPaths" class="pad">
    <h1>路径中心</h1>
    <p class="mut">同一个目标，六种走法 —— 共享掌握度与错题本</p>
    <div class="rows">
      <div v-for="r in rows" :key="r.code" class="rowline" @click="router.push(r.route)">
        <span class="code" :data-c="r.code">{{ r.code }}</span>
        <div class="info">
          <b>{{ r.name }}</b>
          <span class="mut">{{ r.desc }}</span>
        </div>
        <span v-if="r.badge" class="chip">{{ r.badge }}</span>
        <span class="ar">›</span>
      </div>
    </div>
  </div>

  <!-- 课程详情 -->
  <div v-else class="pad">
    <div class="head">
      <div class="ring" :style="{ '--v': ring / 100 }"><span>{{ ring }}%</span></div>
      <div class="hinfo">
        <h1>{{ course.title }}</h1>
        <p class="mut">{{ summary }} · 16WD3 双栏课时页 →</p>
      </div>
      <button class="btn" @click="router.push(course.resumeRoute)">继续学习 →</button>
    </div>

    <div class="grid2">
      <section class="card">
        <div class="sect">章节目录（草稿章不可见 · 🔒=前置锁态）</div>
        <div v-for="f in flat" :key="f.node.id" class="tnode" :class="{ lesson: f.node.isLesson, current: f.node.current, locked: f.node.locked }"
             :style="{ marginLeft: f.depth * 22 + 'px' }" @click="openLesson(f.node)">
          <span v-if="!f.node.isLesson" class="caret" @click.stop="toggle(f.node.id)">
            {{ collapsed.has(f.node.id) ? "▸" : "▾" }}
          </span>
          <span v-else class="caret dot">·</span>
          <b>{{ f.node.title }}</b>
          <span v-if="f.node.locked" class="lock">🔒 {{ lockLabel(f.node).text }}</span>
          <span v-else-if="f.node.current" class="chip">当前</span>
        </div>
      </section>

      <section>
        <div class="card">
          <div class="sect" style="margin-top: 0">本课前置</div>
          <div class="chips">
            <span class="chip ok">等式性质 ✓</span>
            <span class="chip ok">因式分解 ✓</span>
          </div>
          <p class="mut mt">未达标前置显示红色锁（01-D4 练习锁死）→「去图谱补先修」</p>
          <button class="btn ghost" style="margin-top: 10px" @click="router.push('/graph')">打开知识图谱</button>
        </div>
        <div class="card mt">
          <div class="sect" style="margin-top: 0">课程统计</div>
          <div class="stats">
            <div><b>5</b><span class="mut">课时完成</span></div>
            <div><b>2h18m</b><span class="mut">投入时长</span></div>
            <div><b>83%</b><span class="mut">随堂正确率</span></div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.pad {
  padding: 26px 32px 48px;
  max-width: 1200px;
  margin: 0 auto;
}
.mut {
  color: var(--ink3);
  font-size: 13.5px;
}
.mt {
  margin-top: 12px;
}
.rows {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rowline {
  display: flex;
  gap: 13px;
  align-items: center;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 16px;
  cursor: pointer;
}
.rowline:hover {
  border-color: #c7d6ff;
}
.code {
  font-size: 12px;
  font-weight: 800;
  background: var(--brand-soft);
  color: var(--brand);
  border-radius: 7px;
  padding: 4px 9px;
}
.info {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.info b {
  font-size: 15.5px;
}
.chip {
  font-size: 12px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 3px 12px;
  font-weight: 600;
}
.chip.ok {
  background: #ecfdf5;
  color: #047857;
}
.ar {
  color: var(--ink3);
}
.head {
  display: flex;
  gap: 16px;
  align-items: center;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
}
.hinfo {
  flex: 1;
}
.hinfo h1 {
  font-size: 22px;
}
.ring {
  --v: 0.63;
  width: 66px;
  height: 66px;
  border-radius: 50%;
  background: conic-gradient(var(--brand) calc(var(--v) * 360deg), #e5e7eb 0);
  display: grid;
  place-items: center;
  position: relative;
  flex: none;
}
.ring::before {
  content: "";
  position: inset: 7px;
  background: #fff;
  border-radius: 50%;
}
.ring span {
  position: relative;
  font-weight: 800;
}
.btn {
  border: none;
  border-radius: 11px;
  background: var(--grad);
  color: #fff;
  font-weight: 700;
  height: 40px;
  padding: 0 20px;
  cursor: pointer;
  font-size: 14.5px;
}
.btn.ghost {
  background: var(--brand-soft);
  color: var(--brand);
}
.grid2 {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 16px;
  margin-top: 16px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
}
.sect {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink3);
  margin: 14px 0 10px;
}
.tnode {
  display: flex;
  gap: 9px;
  align-items: center;
  padding: 11px 8px;
  border-radius: 9px;
  cursor: pointer;
}
.tnode:hover {
  background: #f6f8ff;
}
.tnode.lesson {
  color: var(--ink2);
  font-size: 14.5px;
}
.tnode.current {
  background: var(--brand-soft);
}
.tnode.locked {
  opacity: 0.65;
  cursor: not-allowed;
}
.caret {
  color: var(--ink3);
  width: 14px;
}
.caret.dot {
  text-align: center;
}
.lock {
  font-size: 12.5px;
  color: #b91c1c;
  background: #fee2e2;
  border-radius: 7px;
  padding: 2px 9px;
}
.chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  text-align: center;
  gap: 8px;
}
.stats b {
  display: block;
  font-size: 20px;
}
.mut + .mt {
  margin-top: 8px;
}
@media (max-width: 960px) {
  .grid2 {
    grid-template-columns: 1fr;
  }
}
</style>
