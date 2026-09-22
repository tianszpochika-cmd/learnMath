<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import {
  SEARCH_SUGGESTIONS,
  searchEmptyState,
  searchGroups,
  searchPath,
  type SearchDoc,
} from "../features/ai/aiPanel";

/** W18 全站搜索（16W18 · Ctrl+K 唤起；分组投影在 aiPanel 单测锁定）。 */
const router = useRouter();
const q = ref("");

const corpus: SearchDoc[] = [
  { type: "node", id: 12, name: "因式分解", sub: "代数 · 薄弱 61" },
  { type: "node", id: 13, name: "判别式", sub: "Δ=b²−4ac · 未测量" },
  { type: "node", id: 14, name: "根的分布", sub: "前置锁定" },
  { type: "formula", id: 7, name: "勾股定理", sub: "毕达哥拉斯定理 · 仅直角" },
  { type: "formula", id: 12, name: "求根公式", sub: "根号公式 · a≠0" },
  { type: "question", id: 1024, name: "x²−5x+6=0 分解", sub: "因式分解基础 · 可深钻" },
  { type: "question", id: 1087, name: "双直角勾股逆用", sub: "勾股 · L2" },
  { type: "course", id: 1, name: "一元二次方程", sub: "从因式分解到求根 · 进行中 64%" },
  { type: "post", id: 88, name: "这步为什么除 sinC", sub: "三角学 · 已采纳" },
  { type: "node", id: 15, name: "正弦起源", sub: "弦表 · 弧之旅" },
];

const groups = computed(() => searchGroups(corpus, q.value));
const hasQuery = computed(() => q.value.trim().length > 0);
const emptyText = computed(() => searchEmptyState(hasQuery.value));

function go(doc: SearchDoc): void {
  void router.push(searchPath(doc));
  q.value = "";
}
function suggest(s: string): void {
  q.value = s;
}
</script>

<template>
  <div class="se pad">
    <div class="head">
      <span class="bk" @click="router.push('/do')">‹</span>
      <h1>全站搜索</h1>
      <span class="kbd">Ctrl+K 任意页唤起（输入框内不劫持 · 16 §5）</span>
    </div>

    <div class="searchbox">
      <span class="mag">🔍</span>
      <input v-model="q" autofocus placeholder="课程 / 题目 / 知识点 / 公式 / 帖子…" />
      <button v-if="q" class="clear" @click="q = ''">✕</button>
    </div>

    <!-- 分组结果 -->
    <template v-if="groups.length > 0">
      <section v-for="g in groups" :key="g.key" class="group">
        <div class="ghead">
          {{ g.label }}
          <span class="mut">{{ g.total }} 条{{ g.total > g.items.length ? "（显示前 " + g.items.length + "）" : "" }}</span>
        </div>
        <div v-for="d in g.items" :key="g.key + d.id" class="row" @click="go(d)">
          <div class="info">
            <b>{{ d.name }}</b>
            <span class="mut">{{ d.sub }}</span>
          </div>
          <span class="tag" :class="'t-' + g.key">{{ g.label }}</span>
          <span class="ar">›</span>
        </div>
      </section>
    </template>

    <!-- 空态 -->
    <div v-else class="empty card">
      <p>{{ emptyText }}</p>
      <div class="sugs">
        <button v-for="s in SEARCH_SUGGESTIONS" :key="s" class="chip" @click="suggest(s)">{{ s }}</button>
        <button class="chip" @click="suggest('因式')">因式</button>
        <button class="chip" @click="suggest('sinC')">sinC</button>
      </div>
    </div>

    <p class="mut">命中即直达（searchPath 与路由表同口径）；键盘 ↑↓/Enter 选择版随 B30 契约期补</p>
  </div>
</template>

<style scoped>
.pad {
  padding: 26px 32px 48px;
  max-width: 860px;
  margin: 0 auto;
}
.head {
  display: flex;
  gap: 14px;
  align-items: center;
}
.bk {
  font-size: 24px;
  cursor: pointer;
  color: var(--ink3);
}
.head h1 {
  font-size: 24px;
}
.kbd {
  margin-left: auto;
  font-size: 12px;
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 5px 11px;
  color: var(--ink3);
}
.searchbox {
  display: flex;
  gap: 10px;
  align-items: center;
  background: #fff;
  border: 2px solid var(--brand);
  border-radius: 14px;
  padding: 4px 16px;
  margin-top: 16px;
  box-shadow: 0 10px 26px -14px rgba(47, 107, 255, 0.5);
}
.mag {
  font-size: 17px;
}
.searchbox input {
  flex: 1;
  height: 50px;
  border: none;
  outline: none;
  font-size: 17px;
}
.clear {
  border: none;
  background: #f1f5f9;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  cursor: pointer;
  color: var(--ink3);
}
.group {
  margin-top: 18px;
}
.ghead {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink3);
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.row {
  display: flex;
  gap: 12px;
  align-items: center;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 11px;
  padding: 12px 15px;
  margin-top: 8px;
  cursor: pointer;
}
.row:hover {
  border-color: var(--brand);
}
.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.mut {
  color: var(--ink3);
  font-size: 12.5px;
}
.tag {
  font-size: 11px;
  font-weight: 800;
  border-radius: 6px;
  padding: 3px 9px;
}
.t-node { background: #ede9fe; color: #6d28d9; }
.t-formula { background: #e0e7ff; color: #4338ca; }
.t-question { background: #e4edff; color: #2f6bff; }
.t-course { background: #d1fae5; color: #047857; }
.t-post { background: #fce7f3; color: #be185d; }
.ar {
  color: var(--ink3);
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px;
}
.empty {
  text-align: center;
  margin-top: 18px;
}
.empty p {
  color: var(--ink3);
  font-size: 14.5px;
}
.sugs {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 12px;
}
.chip {
  font-size: 13px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border: none;
  border-radius: 99px;
  padding: 6px 15px;
  font-weight: 600;
  cursor: pointer;
}
.chip:hover {
  background: var(--brand);
  color: #fff;
}
.mut {
  margin-top: 16px;
}
</style>
