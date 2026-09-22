<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import LmTablePage from "../components/LmTablePage.vue";
import type { FilterDef } from "../features/adminShell";
import {
  courseStatusBadge,
  moveChapter,
  orderLabel,
} from "../features/course/courseAdmin";

/** A05 课程章节（17A05：AD2 列表模板实战 + 章节排序 ↑↓）。 */
const router = useRouter();

const filters: FilterDef[] = [
  { key: "kw", label: "课程名/标签", type: "text" },
  { key: "status", label: "状态", type: "select", options: ["全部", "上架", "草稿", "下架"] },
];

interface CourseRow {
  id: number;
  title: string;
  chapters: number;
  lessons: number;
  status: "published" | "draft" | "offline";
  updated: string;
}

const allRows: CourseRow[] = [
  { id: 1, title: "一元二次方程 · 从因式分解到求根", chapters: 4, lessons: 8, status: "published", updated: "2026-09-20" },
  { id: 2, title: "解三角形：从测量到航海", chapters: 5, lessons: 10, status: "published", updated: "2026-09-18" },
  { id: 3, title: "数论入门（专题配套）", chapters: 2, lessons: 8, status: "draft", updated: "2026-09-22" },
  { id: 4, title: "旧版导数初步（待下架）", chapters: 3, lessons: 6, status: "offline", updated: "2026-08-01" },
];

const query = ref<Record<string, string>>({ kw: "", status: "全部" });
const page = ref(1);
const pageSize = 20;

const rows = computed(() =>
  allRows.filter((r) => {
    const kw = (query.value.kw ?? "").trim();
    if (kw && !r.title.includes(kw)) return false;
    const st = query.value.status;
    if (st && st !== "全部") {
      const label = courseStatusBadge(r.status).label;
      if (label !== st) return false;
    }
    return true;
  }),
);

function onSearch(model: Record<string, string>): void {
  query.value = model;
  page.value = 1;
}
function onRowAction(action: string, row: Record<string, unknown>): void {
  if (action === "edit") {
    void router.push(`/lessons/${row.id}/edit`);
  }
}

// 章节排序（选中课程 1 的章节演示 moveChapter）
const chapters = ref(["第 1 章 等式的性质", "第 2 章 因式分解", "第 3 章 求根公式", "第 4 章 应用与建模"]);
const msg = ref("");
function move(i: number, dir: -1 | 1): void {
  const next = moveChapter(chapters.value, i, dir);
  if (next.join("|") === chapters.value.join("|")) return; // 越界不动
  chapters.value = next;
  msg.value = `章节顺序已调整：${orderLabel(dir === -1 ? i - 1 : i + 1, chapters.value.length)}`;
  setTimeout(() => (msg.value = ""), 2000);
}
const columnDefs = [
  { key: "title", label: "课程" },
  { key: "chapters", label: "章节数", width: 90 },
  { key: "lessons", label: "课时数", width: 90 },
  { key: "status", label: "状态", width: 90 },
  { key: "updated", label: "更新时间", width: 120 },
];
</script>

<template>
  <div>
    <LmTablePage
      title="课程管理"
      :filters="filters"
      :columns="columnDefs"
      :rows="(rows as unknown) as Array<Record<string, unknown>>"
      :total="rows.length"
      :page="page"
      :page-size="pageSize"
      @search="onSearch"
      @reset="query = { kw: '', status: '全部' }"
      @update:page="page = $event"
      @row-action="onRowAction"
    >
      <template #acts>
        <button class="btn" @click="router.push('/lessons/1/edit')">＋ 新建课程</button>
      </template>
      <template #cell-status="{ row }">
        <span class="st" :class="courseStatusBadge(row.status as CourseRow['status']).cls">
          {{ courseStatusBadge(row.status as CourseRow["status"]).label }}
        </span>
      </template>
      <template #cell-chapters="{ row }">{{ row.chapters }} 章</template>
      <template #cell-lessons="{ row }">{{ row.lessons }} 课时</template>
    </LmTablePage>

    <div class="chblock">
      <div class="chhead">
        <b>章节排序 · 一元二次方程</b>
        <span v-if="msg" class="msg">{{ msg }}</span>
      </div>
      <div v-for="(c, i) in chapters" :key="c" class="chrow">
        <span class="ord">{{ orderLabel(i, chapters.length) }}</span>
        <span class="nm">{{ c }}</span>
        <span class="ops">
          <a :class="{ dis: i === 0 }" @click="move(i, -1)">↑</a>
          <a :class="{ dis: i === chapters.length - 1 }" @click="move(i, 1)">↓</a>
        </span>
      </div>
      <p class="mut">moveChapter 越界保持原序（纯函数单测）；拖拽落位复用同函数</p>
    </div>
  </div>
</template>

<style scoped>
.btn {
  height: 34px;
  border-radius: 8px;
  border: none;
  background: var(--brand);
  color: #fff;
  font-weight: 600;
  padding: 0 16px;
  cursor: pointer;
  font-size: 13.5px;
}
.st {
  font-size: 11.5px;
  font-weight: 800;
  border-radius: 6px;
  padding: 2px 9px;
}
.st.gr { background: #d1fae5; color: #047857; }
.st.warn { background: #fef3c7; color: #b45309; }
.st.grey { background: #f1f5f9; color: #64748b; }
.chblock {
  margin-top: 16px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 16px;
}
.chhead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.msg {
  font-size: 12.5px;
  color: var(--ok);
  font-weight: 600;
}
.chrow {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 6px;
  border-top: 1px solid #f1f3f7;
}
.ord {
  color: var(--ink3);
  font-size: 12.5px;
  min-width: 44px;
}
.nm {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
}
.ops a {
  cursor: pointer;
  color: var(--brand);
  font-weight: 800;
  margin-left: 14px;
  font-size: 15px;
}
.ops a.dis {
  color: #d1d5db;
  cursor: default;
}
.mut {
  color: var(--ink3);
  font-size: 12.5px;
  margin-top: 8px;
}
</style>
