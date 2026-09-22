<script setup lang="ts">
import { computed, reactive } from "vue";
import {
  buildFilterModel,
  pageRange,
  type FilterDef,
} from "../features/adminShell";

/**
 * AD2 列表页统一模板（17 §5）：查询栏 + 表格 + 分页 + 操作列。
 * 行渲染走具名插槽 `cell-{key}`；详情/编辑优先右侧 Drawer（17 §5 规范）。
 */
const props = defineProps<{
  title: string;
  filters?: FilterDef[];
  columns: Array<{ key: string; label: string; width?: number; sortable?: boolean }>;
  rows: Array<Record<string, unknown>>;
  total: number;
  page?: number;
  pageSize?: number;
}>();

const emit = defineEmits<{
  (e: "search", model: Record<string, string>): void;
  (e: "reset"): void;
  (e: "update:page", page: number): void;
  (e: "row-action", action: string, row: Record<string, unknown>): void;
}>();

const defs = computed(() => props.filters ?? []);
const model = reactive<Record<string, string>>(buildFilterModel(defs.value));
const page = computed(() => props.page ?? 1);
const pageSize = computed(() => props.pageSize ?? 20);
const range = computed(() => pageRange(props.total, page.value, pageSize.value));

function doSearch(): void {
  emit("search", { ...model });
}
function doReset(): void {
  Object.assign(model, buildFilterModel(defs.value));
  emit("reset");
}
function goPage(p: number): void {
  const maxPage = Math.max(1, Math.ceil(props.total / pageSize.value));
  emit("update:page", Math.min(Math.max(1, p), maxPage));
}
</script>

<template>
  <div class="lmp">
    <div class="phead">
      <h1>{{ title }}</h1>
      <div class="acts"><slot name="acts" /></div>
    </div>

    <!-- 查询栏 -->
    <div v-if="defs.length" class="filter">
      <template v-for="f in defs" :key="f.key">
        <input v-if="f.type === 'text'" v-model="model[f.key]" :placeholder="f.label" class="fi" @keyup.enter="doSearch" />
        <select v-else v-model="model[f.key]" class="fi">
          <option v-for="o in f.options ?? []" :key="o" :value="o">{{ o }}</option>
        </select>
      </template>
      <button class="btn" @click="doSearch">查询</button>
      <button class="btn ghost" @click="doReset">重置</button>
      <slot name="filter-extra" />
    </div>

    <!-- 表格 -->
    <div class="tablewrap">
      <table>
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key" :style="c.width ? { width: c.width + 'px' } : undefined">
              {{ c.label }}
            </th>
            <th class="ops">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="i">
            <td v-for="c in columns" :key="c.key">
              <slot :name="'cell-' + c.key" :row="row">
                {{ row[c.key] }}
              </slot>
            </td>
            <td class="ops">
              <a @click="emit('row-action', 'view', row)">查看</a>
              <a @click="emit('row-action', 'edit', row)">编辑</a>
              <a class="del" @click="emit('row-action', 'delete', row)">删除</a>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td :colspan="columns.length + 1" class="empty">暂无数据（AD2 空态）</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div class="pager">
      <span class="mut">{{ range }}</span>
      <button class="pg" :disabled="page <= 1" @click="goPage(page - 1)">‹</button>
      <span class="pnum">{{ page }}</span>
      <button class="pg" :disabled="page * pageSize >= total" @click="goPage(page + 1)">›</button>
      <select class="fi" :value="pageSize" disabled><option>{{ pageSize }} 条/页</option></select>
    </div>
  </div>
</template>

<style scoped>
.lmp {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.phead {
  display: flex;
  align-items: center;
}
.phead h1 {
  font-size: 20px;
}
.acts {
  margin-left: auto;
  display: flex;
  gap: 9px;
}
.filter {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 11px 13px;
}
.fi {
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 0 11px;
  font-size: 13.5px;
  outline: none;
  background: #fff;
  min-width: 150px;
}
.fi:focus {
  border-color: var(--brand);
}
.btn {
  height: 34px;
  border-radius: 8px;
  border: none;
  background: var(--brand);
  color: #fff;
  font-weight: 600;
  padding: 0 17px;
  cursor: pointer;
  font-size: 13.5px;
}
.btn.ghost {
  background: #fff;
  color: var(--ink2);
  border: 1px solid var(--line);
}
.tablewrap {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
th {
  background: #fafbfd;
  text-align: left;
  font-size: 12.5px;
  color: var(--ink2);
  padding: 10px 13px;
  border-bottom: 1px solid var(--line);
  font-weight: 700;
}
td {
  padding: 10px 13px;
  border-bottom: 1px solid #f1f3f7;
}
tr:hover td {
  background: #f8faff;
}
.ops {
  text-align: right;
  white-space: nowrap;
}
.ops a {
  color: var(--brand);
  cursor: pointer;
  margin-left: 12px;
  font-size: 12.5px;
}
.ops a.del {
  color: var(--bad, #ef4444);
}
.empty {
  text-align: center;
  color: var(--ink3);
  padding: 40px 0;
}
.pager {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}
.mut {
  color: var(--ink3);
  font-size: 12.5px;
  margin-right: auto;
}
.pg {
  width: 30px;
  height: 30px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}
.pg:disabled {
  opacity: 0.4;
  cursor: default;
}
.pnum {
  min-width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  background: var(--brand);
  color: #fff;
  border-radius: 6px;
  font-size: 13px;
}
</style>
