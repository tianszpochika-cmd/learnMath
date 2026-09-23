<script setup lang="ts">
import { resourceField, resourceFormulaId, resourceItems, resourceRecord, resourceSlug } from "~/components/ResourceData";

type GroupKey = "glossary" | "formulas" | "articles" | "paths" | "help";
const definitions: { key: GroupKey; label: string; path: string }[] = [
  { key: "glossary", label: "数学词条", path: "/glossary/" },
  { key: "formulas", label: "公式", path: "/formulas/" },
  { key: "articles", label: "文章", path: "/blog/" },
  { key: "paths", label: "学习路径", path: "/paths/" },
  { key: "help", label: "帮助", path: "/help/" }
];
const route = useRoute();
const router = useRouter();
const initial = typeof route.query.q === "string" ? route.query.q.slice(0, 80) : "";
const input = ref(initial);
const searched = ref(initial);
const active = ref<GroupKey | "all">("all");
const request = reactive<{ q?: string }>({ q: initial || undefined });
const { data, pending, refresh } = await usePublished<unknown>("public-search-" + initial, "explore/search", request);
let debounce: ReturnType<typeof setTimeout> | undefined;
const payload = computed(() => resourceRecord(data.value?.value));

function groupItems(key: GroupKey) {
  const direct = payload.value[key];
  if (direct != null) return resourceItems(direct);
  const nested = resourceRecord(payload.value.groups);
  if (nested[key] != null) return resourceItems(nested[key]);
  if (Array.isArray(payload.value.groups)) {
    const match = payload.value.groups.find((entry) => resourceField(entry, "type", "key") === key);
    return resourceItems(resourceRecord(match).items);
  }
  return [];
}

const groups = computed(() => definitions.map((item) => ({ ...item, items: groupItems(item.key).filter(resourceSlug) })));
const total = computed(() => groups.value.reduce((sum, group) => sum + group.items.length, 0));
const visible = computed(() => groups.value.filter((group) => (active.value === "all" || group.key === active.value) && group.items.length));

async function search() {
  if (debounce) clearTimeout(debounce);
  const value = input.value.trim().slice(0, 80);
  searched.value = value;
  request.q = value || undefined;
  active.value = "all";
  await router.replace({ query: value ? { q: value } : {} });
  if (value) await refresh();
}

function suggest(value: string) {
  input.value = value;
  void search();
}

watch(input, () => {
  if (!import.meta.client) return;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => { if (input.value.trim() !== searched.value) void search(); }, 200);
});
onBeforeUnmount(() => { if (debounce) clearTimeout(debounce); });

useSeoMeta({
  title: "站内搜索",
  description: "搜索已发布数学词条、公式、文章、路径与帮助内容。",
  robots: "noindex,follow"
});
</script>

<template>
  <ResourceShell eyebrow="SEARCH · 探索" title="从一个问题开始寻找" intro="搜索只返回公开的已发布内容。若还没有结果，可以换一种问法，或从资源目录继续浏览。">
    <form class="search-form" role="search" @submit.prevent="search">
      <label class="sr-only" for="site-search">搜索数学内容</label>
      <span aria-hidden="true">⌕</span>
      <input id="site-search" v-model="input" type="search" maxlength="80" autocomplete="off" placeholder="例如：三角函数起源、勾股定理条件">
      <button type="submit">搜索</button>
    </form>
    <div v-if="searched" class="search-tabs" role="tablist" aria-label="搜索结果分类">
      <button type="button" role="tab" :aria-selected="active === 'all'" @click="active = 'all'">全部 <span>{{ total }}</span></button>
      <button v-for="group in groups" :key="group.key" type="button" role="tab" :aria-selected="active === group.key" @click="active = group.key">{{ group.label }} <span>{{ group.items.length }}</span></button>
    </div>
    <p v-if="searched && pending" role="status">正在搜索已发布内容…</p>
    <template v-else-if="searched && visible.length">
      <section v-for="group in visible" :key="group.key" class="result-section">
        <h2>{{ group.label }} <small>{{ group.items.length }} 条</small></h2>
        <div class="result-list">
          <NuxtLink v-for="item in group.items" :key="resourceSlug(item)" :to="group.path + (group.key === 'formulas' ? (resourceFormulaId(item) || resourceSlug(item)) : resourceSlug(item))">
            <span class="result-mark" aria-hidden="true">{{ group.label.slice(0, 1) }}</span>
            <span><strong>{{ resourceField(item, "title", "name") || resourceSlug(item) }}</strong><small>{{ resourceField(item, "summary", "description", "conditionSummary") }}</small></span>
            <span class="result-arrow" aria-hidden="true">↗</span>
          </NuxtLink>
        </div>
      </section>
    </template>
    <ResourceEmpty v-else-if="searched" :title="data?.available ? '没有找到已发布结果' : '搜索暂时无法使用'"
      :message="data?.available ? '试试更短的关键词，或从词条、公式馆直接浏览。' : '公开搜索服务暂不可用；页面不会用演示结果替代。'"
      retry @retry="refresh()" />
    <section v-else class="suggestions" aria-labelledby="search-suggestions">
      <h2 id="search-suggestions">不知道从哪里开始？</h2>
      <p>试试这些查询词，或直接进入资源目录。</p>
      <div class="suggestion-list">
        <button type="button" @click="suggest('三角函数起源')">三角函数起源 ↗</button>
        <button type="button" @click="suggest('勾股定理条件')">勾股定理条件 ↗</button>
        <button type="button" @click="suggest('学习路径')">学习路径 ↗</button>
      </div>
      <div class="directory-links"><NuxtLink to="/glossary">数学词条</NuxtLink><NuxtLink to="/formulas">公式馆</NuxtLink><NuxtLink to="/daily">每日一题</NuxtLink></div>
    </section>
  </ResourceShell>
</template>

<style scoped>
.search-form{display:flex;align-items:center;gap:11px;max-width:780px;border:1px solid var(--line);border-radius:17px;padding:7px 7px 7px 19px;background:var(--card)}
.search-form>span{font-size:27px;color:var(--p)}
.search-form input{min-width:0;flex:1;min-height:42px;border:0;outline:0;background:transparent;color:var(--ink)}
.search-form button{min-height:43px;padding:8px 20px;border:0;border-radius:11px;background:var(--p);color:#fff;font-weight:800}
.search-tabs{display:flex;overflow:auto;gap:6px;margin:31px 0;border-bottom:1px solid var(--line)}
.search-tabs button{min-height:43px;flex:none;border:0;border-bottom:3px solid transparent;background:transparent;color:var(--ink3);padding:8px 13px;font-weight:700}
.search-tabs button[aria-selected=true]{border-bottom-color:var(--p);color:var(--p-strong)}
.search-tabs span{font-size:11px;color:var(--ink4)}
.result-section{margin-top:32px}.result-section h2,.suggestions h2{font:700 26px var(--serif);margin:0 0 13px}.result-section small{color:var(--ink4);font:500 12px var(--sans)}
.result-list{display:grid;gap:8px}.result-list a{display:flex;align-items:center;gap:14px;min-height:76px;padding:12px 16px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.result-list a:hover{border-color:var(--p);background:var(--p-soft)}
.result-mark{display:grid;place-items:center;flex:none;width:38px;height:38px;border-radius:10px;background:var(--p-soft);color:var(--p);font-family:var(--serif)}
.result-list a>span:nth-child(2){display:grid;gap:4px;min-width:0}
.result-list strong{font-size:15px}.result-list small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink3)}
.result-arrow{margin-left:auto;color:var(--ink4)}
.suggestions{margin-top:36px}.suggestions p{color:var(--ink3)}
.suggestion-list,.directory-links{display:flex;gap:9px;flex-wrap:wrap;margin-top:17px}
.suggestion-list button,.directory-links a{min-height:42px;padding:9px 14px;border:1px solid var(--line);border-radius:99px;background:var(--card);color:var(--ink2)}
.directory-links{margin-top:35px}.directory-links a{color:var(--p-strong);font-weight:800}
@media(max-width:600px){.search-form{padding-left:12px}.search-form button{padding-inline:13px}.result-list a{gap:9px}}
</style>
