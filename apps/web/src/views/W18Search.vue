<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { SEARCH_SUGGESTIONS, searchPath, type SearchDoc, type SearchGroup } from "../features/ai/aiPanel";
import { searchAll } from "../services/search";

const route = useRoute();
const router = useRouter();
const q = ref(typeof route.query.q === "string" ? route.query.q : "");
const groups = ref<SearchGroup[]>([]);
const loading = ref(false);
const error = ref("");
const activeIndex = ref(0);
const flat = computed(() => groups.value.flatMap((group) => group.items));
let timer: ReturnType<typeof setTimeout> | null = null;
let revision = 0;

watch(q, (value) => {
  revision += 1;
  const current = revision;
  if (timer) clearTimeout(timer);
  groups.value = [];
  activeIndex.value = 0;
  error.value = "";
  if (!value.trim()) { loading.value = false; return; }
  loading.value = true;
  timer = setTimeout(async () => {
    try {
      const result = await searchAll(value);
      if (current === revision) groups.value = result;
    } catch (cause) {
      if (current === revision) error.value = cause instanceof Error ? cause.message : "搜索暂时不可用，请稍后重试。";
    } finally { if (current === revision) loading.value = false; }
  }, 260);
}, { immediate: true });

function go(doc: SearchDoc) { void router.push(searchPath(doc)); }
function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") { q.value = ""; return; }
  if (!flat.value.length) return;
  if (event.key === "ArrowDown") { event.preventDefault(); activeIndex.value = Math.min(flat.value.length - 1, activeIndex.value + 1); }
  if (event.key === "ArrowUp") { event.preventDefault(); activeIndex.value = Math.max(0, activeIndex.value - 1); }
  if (event.key === "Enter") { event.preventDefault(); const item = flat.value[activeIndex.value]; if (item) go(item); }
}
onUnmounted(() => { if (timer) clearTimeout(timer); revision += 1; });
</script>

<template>
  <div class="search-page"><header class="hero"><RouterLink to="/" class="back">← 返回首页</RouterLink><p class="eyebrow">FIND YOUR NEXT STEP</p><h1>从一个问题出发</h1><p>搜索课程、知识点、题目、公式与讨论。结果来自当前服务端索引。</p></header>
    <main class="search-main"><div class="search-box"><span aria-hidden="true">⌕</span><label class="sr-only" for="global-search">搜索学习内容</label><input id="global-search" v-model="q" type="search" autofocus autocomplete="off" placeholder="试试：判别式、因式分解、勾股定理…" @keydown="onKey"><button v-if="q" type="button" aria-label="清空搜索" @click="q = ''">清空</button></div><p class="hint">输入后自动搜索 · ↑↓ 选结果 · Enter 打开 · Esc 清空</p>
      <p v-if="loading" class="state" role="status">正在查找…</p><div v-else-if="error" class="state error" role="alert"><h2>搜索暂时不可用</h2><p>{{ error }}</p><p>当前不会显示本地演示结果。你可以稍后重试。</p></div>
      <div v-else-if="groups.length" class="results"><section v-for="group in groups" :key="group.key" class="group"><div class="group-head"><h2>{{ group.label }}</h2><span>{{ group.total }} 条</span></div><button v-for="doc in group.items" :key="group.key + doc.id" type="button" class="result" :class="{ active: flat.indexOf(doc) === activeIndex }" @mouseenter="activeIndex = flat.indexOf(doc)" @click="go(doc)"><span class="result-icon">{{ group.label.slice(0, 1) }}</span><span><strong>{{ doc.name }}</strong><small v-if="doc.sub">{{ doc.sub }}</small></span><span class="arrow" aria-hidden="true">↗</span></button></section></div>
      <div v-else class="state"><h2>{{ q.trim() ? "暂未找到结果" : "想先从哪里开始？" }}</h2><p>{{ q.trim() ? "可以换一个关键词；结果以服务端索引为准。" : "输入想学的概念，也可以从下面的词开始。" }}</p><div class="suggestions"><button v-for="item in SEARCH_SUGGESTIONS" :key="item" type="button" @click="q = item">{{ item }} ↗</button></div></div>
    </main>
  </div>
</template>

<style scoped>
.search-page{min-height:100vh;background:var(--bg,#f8fafc);color:var(--ink,#0f172a)}.hero{padding:42px max(24px,calc((100vw - 850px)/2));background:linear-gradient(125deg,#102245,#24396f);color:#fff}.back{display:inline-block;margin-bottom:27px;color:#cbd9ff}.eyebrow{margin:0 0 8px;color:#9db9ff;font-size:11px;font-weight:850;letter-spacing:.18em}.hero h1{margin:0;font:700 clamp(30px,4vw,45px) var(--serif,Georgia,serif)}.hero>p:last-child{color:#d2ddf2;line-height:1.8}.search-main{max-width:850px;margin:0 auto;padding:27px 24px 70px}.search-box{display:flex;align-items:center;gap:12px;padding:7px 15px;border:2px solid var(--brand,#2f6bff);border-radius:16px;background:var(--card,#fff);box-shadow:var(--shadow,0 10px 28px -20px #1e376080)}.search-box>span{font-size:28px;color:var(--brand)}.search-box input{flex:1;min-width:0;min-height:48px;border:0;outline:0;background:transparent;color:var(--ink);font:inherit}.search-box button{min-height:38px;padding:6px 10px;border:0;background:transparent;color:var(--brand);font-weight:800}.hint{margin:9px 4px;color:var(--ink3,#64748b);font-size:12px}.group{margin-top:28px;border:1px solid var(--line,#e2e8f0);border-radius:18px;background:var(--card,#fff);overflow:hidden}.group-head{display:flex;align-items:center;justify-content:space-between;padding:17px 20px;border-bottom:1px solid var(--line)}.group-head h2{margin:0;font:700 20px var(--serif,Georgia,serif)}.group-head span{color:var(--ink3);font-size:12px}.result{display:flex;align-items:center;gap:14px;width:100%;min-height:69px;padding:11px 20px;border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--ink);text-align:left;cursor:pointer}.result:last-child{border-bottom:0}.result:hover,.result.active{background:var(--brand-soft,#eef4ff)}.result-icon{display:grid;place-items:center;width:35px;height:35px;border-radius:10px;background:var(--soft,#f1f5f9);color:var(--brand);font-weight:850}.result strong{display:block;font-size:15px}.result small{display:block;margin-top:4px;color:var(--ink3);font-size:12px}.arrow{margin-left:auto;color:var(--ink3)}.state{margin-top:27px;padding:34px;border:1px solid var(--line);border-radius:18px;background:var(--card);line-height:1.7}.state h2{margin:0 0 7px;font:700 24px var(--serif,Georgia,serif)}.state p{color:var(--ink3)}.state.error{border-color:var(--danger,#b91c1c)}.suggestions{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.suggestions button{min-height:39px;padding:7px 13px;border:1px solid var(--line);border-radius:99px;background:var(--soft);color:var(--ink2);font-weight:700}
@media(max-width:600px){.hero{padding:27px 19px}.search-main{padding:17px}.state{padding:23px}.result{padding:11px 14px}}
</style>
