<script setup lang="ts">
import { computed, ref } from "vue";
import {
  findExistingCycle,
  validateEdgeAdd,
  type DepEdge,
} from "../features/knowledge/knowledgeAdmin";

/** A04 图谱边编辑（17A04 · AD5：加边模式 · 成环红链回显 3310 · 无环即时预检）。 */
interface GNode {
  id: number;
  name: string;
  x: number;
  y: number;
  preparing?: boolean;
}

const nodes = ref<GNode[]>([
  { id: 1, name: "等式的性质", x: 10, y: 20 },
  { id: 2, name: "因式分解", x: 33, y: 38 },
  { id: 3, name: "不等式性质", x: 33, y: 72 },
  { id: 4, name: "求根公式", x: 58, y: 28 },
  { id: 5, name: "判别式", x: 58, y: 66 },
  { id: 6, name: "根的分布", x: 82, y: 50 },
  { id: 7, name: "解三角形应用", x: 82, y: 16, preparing: true },
]);

const edges = ref<DepEdge[]>([
  { from: 1, to: 2 },
  { from: 2, to: 4 },
  { from: 3, to: 5 },
  { from: 4, to: 6 },
  { from: 5, to: 6 },
]);

const mode = ref(true); // 加边模式
const srcId = ref<number | null>(null);
const cyclePath = ref<number[]>([]);
const toast = ref("");
const blocked = ref(false);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function flash(msg: string, bad = false): void {
  toast.value = msg;
  blocked.value = bad;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ""), 3200);
}

function clickNode(n: GNode): void {
  if (!mode.value) return;
  if (srcId.value === null) {
    srcId.value = n.id;
    cyclePath.value = [];
    flash(`起点：${n.name} → 再点终点`);
    return;
  }
  if (srcId.value === n.id) {
    srcId.value = null;
    flash("已取消起点");
    return;
  }
  const r = validateEdgeAdd(edges.value, srcId.value, n.id);
  if (r.ok) {
    edges.value = [...edges.value, { from: srcId.value, to: n.id }];
    flash(r.message);
    srcId.value = null;
    cyclePath.value = [];
  } else if (r.reason === "duplicate") {
    flash(r.message);
    srcId.value = null;
  } else {
    // 成环：红链回显 2.6s（后端入库同样拒绝 3310）
    cyclePath.value = r.cyclePath;
    flash(r.message, true);
    srcId.value = null;
    setTimeout(() => (cyclePath.value = []), 2600);
  }
}

function healthCheck(): void {
  const c = findExistingCycle(edges.value);
  if (c) {
    cyclePath.value = c;
    flash(`体检发现环：${c.join(" → ")}（3310）`, true);
    setTimeout(() => (cyclePath.value = []), 3200);
  } else {
    flash("体检通过：当前为 DAG，无环");
  }
}

function removeEdge(i: number): void {
  edges.value = edges.value.filter((_, idx) => idx !== i);
}

const nodeById = computed(() => new Map(nodes.value.map((n) => [n.id, n])));
function label(id: number): string {
  return nodeById.value.get(id)?.name ?? String(id);
}
function inCycle(id: number): boolean {
  return cyclePath.value.includes(id);
}

const posOf = (id: number): { x: number; y: number } => {
  const n = nodeById.value.get(id);
  return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
};
</script>

<template>
  <div class="ge">
    <div class="phead">
      <h1>图谱边编辑（前置依赖）</h1>
      <span class="light" :class="{ bad: blocked }">
        <i :class="{ bad: blocked }" />{{ blocked ? "3310 图谱成环 · 禁保存" : "校验通过 · 无环" }}
      </span>
      <div class="acts">
        <button class="btn ghost" @click="healthCheck">体检报告</button>
        <button class="btn" :disabled="blocked" @click="flash('边已保存（与后端无环校验同口径）')">保存</button>
      </div>
    </div>

    <div class="toolbar">
      <button class="chip" :class="{ on: mode }" @click="mode = !mode">
        {{ mode ? "● 加边模式：点 from → 点 to" : "○ 加边模式已关（可只浏览）" }}
      </button>
      <span class="mut">AD5：即时无环预检（镜像后端 GraphCycleDetector）· 成环红链回显后拒绝入库</span>
      <button class="btn ghost sm" @click="flash('导入边：粘贴 CSV（from,to）——真实实现走 04 /knowledge/edges/import')">导入边</button>
    </div>

    <div class="canvas">
      <svg class="edges" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <marker id="ar" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="#94a3b8" />
          </marker>
          <marker id="arRed" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="#ef4444" />
          </marker>
        </defs>
        <template v-for="(e, i) in edges" :key="i">
          <line
            :x1="posOf(e.from).x + 5"
            :y1="posOf(e.from).y + 5"
            :x2="posOf(e.to).x + 5"
            :y2="posOf(e.to).y + 5"
            :stroke="cyclePath.length && inCycle(e.from) && inCycle(e.to) ? '#ef4444' : '#94a3b8'"
            stroke-width="0.4"
            :marker-end="cyclePath.length && inCycle(e.from) && inCycle(e.to) ? 'url(#arRed)' : 'url(#ar)'"
          />
        </template>
      </svg>

      <button
        v-for="n in nodes"
        :key="n.id"
        class="gn"
        :class="{ src: srcId === n.id, cyc: inCycle(n.id), prep: n.preparing }"
        :style="{ left: n.x + '%', top: n.y + '%' }"
        @click="clickNode(n)"
      >
        {{ n.name }}
      </button>

      <div v-if="cyclePath.length" class="cyclebar">
        🔴 成环路径（回显）：{{ cyclePath.join(" → ") }} —— 同环同序仅允许单向（3310）
      </div>
    </div>

    <div class="tablewrap">
      <table>
        <thead><tr><th>from</th><th>→</th><th>to</th><th class="ops">操作</th></tr></thead>
        <tbody>
          <tr v-for="(e, i) in edges" :key="'e' + i" :class="{ badrow: cyclePath.length && inCycle(e.from) && inCycle(e.to) }">
            <td>{{ label(e.from) }}</td>
            <td>→</td>
            <td>{{ label(e.to) }}</td>
            <td class="ops"><a class="del" @click="removeEdge(i)">删除</a></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="toast" class="toast" :class="{ bad: blocked }">{{ toast }}</div>
  </div>
</template>

<style scoped>
.ge {
  max-width: 1040px;
}
.phead {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
}
.phead h1 {
  font-size: 20px;
}
.light {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--ok);
}
.light i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ok);
}
.light.bad,
.light.bad + * {
  color: #b91c1c;
}
.light.bad i {
  background: #ef4444;
}
.acts {
  margin-left: auto;
  display: flex;
  gap: 9px;
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
.btn.sm {
  height: 30px;
  font-size: 12.5px;
  padding: 0 12px;
}
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 14px;
}
.chip {
  font-size: 13px;
  background: #f1f5f9;
  color: #64748b;
  border: none;
  border-radius: 99px;
  padding: 6px 14px;
  font-weight: 700;
  cursor: pointer;
}
.chip.on {
  background: var(--brand-soft);
  color: var(--brand-deep);
}
.mut {
  color: var(--ink3);
  font-size: 12.5px;
}
.canvas {
  position: relative;
  height: 420px;
  background:
    repeating-linear-gradient(0deg, #f3f5f9 0 1px, transparent 1px 30px),
    repeating-linear-gradient(90deg, #f3f5f9 0 1px, transparent 1px 30px), #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  margin-top: 12px;
  overflow: hidden;
}
.edges {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.gn {
  position: absolute;
  transform: translate(-50%, -50%);
  min-width: 84px;
  padding: 9px 12px;
  border-radius: 99px;
  border: 2.5px solid var(--brand);
  background: #fff;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.12s;
}
.gn:hover {
  transform: translate(-50%, -50%) scale(1.08);
}
.gn.src {
  box-shadow: 0 0 0 4px rgba(47, 107, 255, 0.25);
}
.gn.cyc {
  border-color: #ef4444;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.22);
}
.gn.prep {
  border-style: dashed;
  border-color: #8b5cf6;
  color: #6d28d9;
}
.cyclebar {
  position: absolute;
  left: 12px;
  bottom: 12px;
  right: 12px;
  background: #fef2f2;
  border: 1.5px solid #fecaca;
  color: #b91c1c;
  border-radius: 9px;
  padding: 9px 13px;
  font-size: 13px;
  font-weight: 700;
}
.tablewrap {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: auto;
  margin-top: 12px;
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
  padding: 9px 13px;
  border-bottom: 1px solid #f1f3f7;
}
.badrow td {
  background: #fef2f2;
}
.ops {
  text-align: right;
}
.ops a {
  color: #ef4444;
  cursor: pointer;
  font-size: 12.5px;
}
.toast {
  position: fixed;
  left: 50%;
  bottom: 46px;
  transform: translateX(-50%);
  background: rgba(31, 41, 55, 0.95);
  color: #fff;
  font-size: 13.5px;
  border-radius: 99px;
  padding: 10px 22px;
  z-index: 90;
}
.toast.bad {
  background: #b91c1c;
}
</style>
