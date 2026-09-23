<script setup lang="ts">
import { publicSearchResults } from "../utils/searchResults";
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const query = ref("");
const input = ref<HTMLInputElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const searching = ref(false);
const unavailable = ref(false);
const selected = ref(0);
const rows = ref<Array<{ title: string; description: string; to: string; group: string }>>([]);
let debounce: ReturnType<typeof setTimeout> | null = null;
let request = 0;

const shortcuts = [
  { title: "六条学习路径", description: "看看不同的学习入口", to: "/paths", group: "站内入口" },
  { title: "数学词条", description: "从概念起源开始", to: "/glossary", group: "站内入口" },
  { title: "公式馆", description: "先看成立条件", to: "/formulas", group: "站内入口" },
  { title: "每日一题", description: "今天的公开题目", to: "/daily", group: "站内入口" }
];
const visibleRows = computed(() => query.value.trim() && !unavailable.value ? rows.value : shortcuts);

watch(query, (value) => {
  if (debounce) clearTimeout(debounce);
  request += 1;
  const q = value.trim();
  if (!q) { rows.value = []; unavailable.value = false; searching.value = false; return; }
  debounce = setTimeout(async () => {
    const current = ++request;
    searching.value = true;
    try {
      const response = await $fetch<{ code: number; data?: unknown }>("/api/public/explore/search", { query: { q } });
      if (current !== request) return;
      rows.value = response.code === 0 ? publicSearchResults(response.data) : [];
      unavailable.value = response.code !== 0;
      selected.value = 0;
    } catch {
      if (current === request) { rows.value = []; unavailable.value = true; }
    } finally {
      if (current === request) searching.value = false;
    }
  }, 200);
});
watch(() => props.open, (open) => {
  if (open) nextTick(() => input.value?.focus());
  else { query.value = ""; selected.value = 0; }
});
onBeforeUnmount(() => { if (debounce) clearTimeout(debounce); request += 1; });

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") emit("close");
  else if (event.key === "Tab") {
    const focusables = [...(panel.value?.querySelectorAll<HTMLElement>("input,button,[href]") || [])].filter((element) => !element.hasAttribute("disabled"));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  else if (event.key === "ArrowDown") { event.preventDefault(); selected.value = Math.min(Math.max(0, visibleRows.value.length - 1), selected.value + 1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); selected.value = Math.max(0, selected.value - 1); }
  else if (event.key === "Enter" && visibleRows.value[selected.value]) {
    event.preventDefault(); choose(visibleRows.value[selected.value].to);
  }
}
function choose(to: string) {
  emit("close");
  void navigateTo(to);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="palette-overlay" @click.self="emit('close')" @keydown="onKeydown">
      <section ref="panel" class="palette-panel" role="dialog" aria-modal="true" aria-label="搜索数源">
        <div class="palette-search"><span aria-hidden="true">⌕</span><input ref="input" v-model="query" placeholder="搜索词条、公式、文章、路径…" aria-label="站内搜索" /><button type="button" class="quiet-button" @click="emit('close')">关闭</button></div>
        <div class="palette-results">
          <p v-if="searching" class="empty-message">正在查找公开内容…</p>
          <p v-else-if="unavailable" class="empty-message">搜索暂不可用。你仍可使用下方站内入口。</p>
          <p v-else-if="query && !visibleRows.length" class="empty-message">暂无匹配的已发布内容。试试“勾股”或“函数”。</p>
          <button v-for="(row, index) in visibleRows" :key="row.to" type="button" class="palette-row" :class="{ selected: index === selected }" @mouseenter="selected = index" @click="choose(row.to)">
            <span class="palette-icon" aria-hidden="true">∑</span><span><strong>{{ row.title }}</strong><small>{{ row.description || row.group }}</small></span><span class="palette-group">{{ row.group }}</span>
          </button>
        </div>
        <div class="palette-help">↑↓ 选择 · ↵ 打开 · Esc 关闭</div>
      </section>
    </div>
  </Teleport>
</template>
