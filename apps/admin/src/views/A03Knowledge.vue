<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import {
  parseKnowledgeCsv,
  toggleCollapsed,
  treeRows,
  type TreeNodeAdmin,
} from "../features/knowledge/knowledgeAdmin";

/** A03 知识点树（17A03：树形列表 + CSV 导入逐行报错 + 状态徽标）。 */
const router = useRouter();

const nodes = ref<TreeNodeAdmin[]>([
  { id: 1, parentId: null, title: "代数", status: "published", childrenCount: 2 },
  { id: 11, parentId: 1, title: "方程", status: "published", childrenCount: 0 },
  { id: 12, parentId: 1, title: "不等式", status: "draft", childrenCount: 0 },
  { id: 2, parentId: null, title: "几何", status: "published", childrenCount: 1 },
  { id: 21, parentId: 2, title: "三角函数", status: "published", childrenCount: 0 },
  { id: 3, parentId: null, title: "解析几何（筹备）", status: "draft", childrenCount: 0 },
]);
const collapsed = ref(new Set<number>());
const query = ref("");
const rows = computed(() => treeRows(nodes.value, collapsed.value, query.value));

function toggle(id: number): void {
  collapsed.value = toggleCollapsed(collapsed.value, id);
}

// CSV 导入弹层
const importOpen = ref(false);
const csvText = ref("");
const csvResult = ref<ReturnType<typeof parseKnowledgeCsv> | null>(null);
const SAMPLE_CSV = [
  "path,name,difficulty,description",
  "代数,方程,3,一到三次",
  "代数,,3,空名坏行",
  "代数/方程,一元一次,2,",
  "代数,函数,9,越界坏行",
].join("\n");

function openImport(): void {
  importOpen.value = true;
  csvText.value = SAMPLE_CSV;
  csvResult.value = null;
}
function runParse(): void {
  csvResult.value = parseKnowledgeCsv(csvText.value);
}
function commitImport(): void {
  const r = csvResult.value;
  if (!r || r.drafts.length === 0) return;
  // 演示：好行并入（真实=POST /knowledge/import，后端权威复检）
  const base = nodes.value.length * 10;
  r.drafts.forEach((d, i) => {
    nodes.value.push({
      id: base + i + 1,
      parentId: d.parentPath.length ? 1 : null,
      title: d.name,
      status: "draft",
      childrenCount: 0,
    });
  });
  importOpen.value = false;
}
</script>

<template>
  <div class="kp">
    <div class="phead">
      <h1>知识点树</h1>
      <span class="chip">61 节点（03 §3 口径）</span>
      <div class="acts">
        <input v-model="query" class="q" placeholder="搜索节点…" />
        <button class="btn ghost" @click="openImport">CSV 导入</button>
        <button class="btn" @click="router.push('/knowledge/edges')">配依赖边 →</button>
      </div>
    </div>

    <div class="tablewrap">
      <table>
        <thead>
          <tr><th>名称</th><th style="width:90px">状态</th><th style="width:170px">操作</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id" class="trow">
            <td :style="{ paddingLeft: 14 + r.depth * 22 + 'px' }">
              <span class="caret" @click="r.expandable && toggle(r.id)">
                {{ r.expandable ? (collapsed.has(r.id) ? "▸" : "▾") : "·" }}
              </span>
              <b>{{ r.title }}</b>
            </td>
            <td><span class="st" :class="r.statusClass">{{ r.statusLabel }}</span></td>
            <td class="ops">
              <a>编辑</a>
              <a @click="router.push('/knowledge/edges')">配边</a>
              <a class="del">删除</a>
            </td>
          </tr>
          <tr v-if="rows.length === 0"><td colspan="3" class="empty">无匹配节点</td></tr>
        </tbody>
      </table>
    </div>
    <p class="mut">草稿节点发布走 B-10 快照规则（BR-06）；删除被引用时后端列引用数拦截（03 §5）</p>

    <!-- CSV 导入弹层 -->
    <div v-if="importOpen" class="dim" @click.self="importOpen = false">
      <div class="dlg">
        <div class="dh">CSV 导入（提交前预检 · 后端权威复检）<span class="x" @click="importOpen = false">✕</span></div>
        <textarea v-model="csvText" class="csv" spellcheck="false" />
        <div class="dacts">
          <button class="btn ghost" @click="runParse">解析预检</button>
          <button class="btn" :disabled="!csvResult || csvResult.drafts.length === 0" @click="commitImport">
            导入好行（{{ csvResult ? csvResult.drafts.length : 0 }}）
          </button>
        </div>
        <div v-if="csvResult" class="cres">
          <b v-if="csvResult.ok" class="ok">✓ 全部通过（{{ csvResult.drafts.length }} 行）</b>
          <template v-else>
            <b class="bad">坏行 {{ csvResult.errors.length }} 条（好行不受影响）</b>
            <div v-for="(e, i) in csvResult.errors" :key="i" class="errline">
              行 {{ e.line }}：{{ e.reason }}
            </div>
            <div class="good">可导入好行：{{ csvResult.drafts.length }} 行</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kp {
  max-width: 980px;
}
.phead {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.phead h1 {
  font-size: 20px;
}
.chip {
  font-size: 12px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 3px 11px;
  font-weight: 600;
}
.acts {
  margin-left: auto;
  display: flex;
  gap: 9px;
}
.q {
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0 12px;
  outline: none;
  min-width: 180px;
}
.q:focus {
  border-color: var(--brand);
}
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
.btn.ghost {
  background: #fff;
  color: var(--ink2);
  border: 1px solid var(--line);
}
.btn:disabled {
  opacity: 0.45;
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
}
td {
  padding: 10px 13px;
  border-bottom: 1px solid #f1f3f7;
}
.trow:hover td {
  background: #f8faff;
}
.caret {
  display: inline-block;
  width: 16px;
  color: var(--ink3);
  cursor: pointer;
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
  color: #ef4444;
}
.empty {
  text-align: center;
  color: var(--ink3);
  padding: 30px;
}
.mut {
  color: var(--ink3);
  font-size: 12.5px;
  margin-top: 10px;
}
.dim {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.45);
  z-index: 60;
  display: grid;
  place-items: center;
}
.dlg {
  width: 620px;
  background: #fff;
  border-radius: 14px;
  padding: 18px;
}
.dh {
  font-weight: 800;
  font-size: 15.5px;
  display: flex;
  justify-content: space-between;
}
.x {
  cursor: pointer;
  color: var(--ink3);
}
.csv {
  width: 100%;
  height: 180px;
  border: 1.5px solid var(--line);
  border-radius: 10px;
  margin-top: 12px;
  padding: 10px 12px;
  font-family: ui-monospace, monospace;
  font-size: 13px;
  outline: none;
  resize: vertical;
}
.csv:focus {
  border-color: var(--brand);
}
.dacts {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.cres {
  margin-top: 12px;
  font-size: 13.5px;
}
.ok { color: var(--ok); }
.bad { color: #b91c1c; }
.errline {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  border-radius: 8px;
  padding: 6px 10px;
  margin-top: 6px;
  font-size: 12.5px;
}
.good {
  color: var(--ok);
  margin-top: 8px;
}
</style>
