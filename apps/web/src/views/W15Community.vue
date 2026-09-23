<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { ApiError } from "@learnmath/shared";
import { useRoute, useRouter } from "vue-router";
import { acceptReply, createPost, createReply, likeCommunity, readCommunity, readPost, type CommunityPost } from "../services/community";

const route = useRoute();
const router = useRouter();
const mode = computed(() => route.name === "ask" ? "ask" : route.name === "post" ? "post" : "feed");
const postId = computed(() => String(route.params.id || ""));
const posts = ref<CommunityPost[]>([]);
const post = ref<CommunityPost | null>(null);
const total = ref<number | null>(null);
const page = ref(1);
const pageSize = 20;
const tab = ref<"latest" | "featured" | "topic">("latest");
const topic = ref("");
const loading = ref(false);
const busy = ref(false);
const error = ref("");
const notice = ref("");
const askTitle = ref("");
const askBody = ref("");
const replyBody = ref("");
const visible = computed(() => posts.value.filter((item) => tab.value === "latest" || tab.value === "featured" && item.featured || tab.value === "topic" && (!topic.value.trim() || item.topic.includes(topic.value.trim()))));
const hasNext = computed(() => total.value === null ? posts.value.length === pageSize : page.value * pageSize < total.value);

async function load() {
  if (mode.value === "ask") return;
  loading.value = true; error.value = "";
  try {
    if (mode.value === "feed") { const data = await readCommunity(page.value, pageSize); posts.value = data.posts; total.value = data.total; }
    else post.value = await readPost(postId.value);
  } catch (cause) { error.value = cause instanceof Error ? cause.message : "社区内容暂时无法读取。"; if (mode.value === "post") post.value = null; else posts.value = []; }
  finally { loading.value = false; }
}

async function turnPage(next: number) { if (next < 1 || next > page.value && !hasNext.value) return; page.value = next; await load(); }
async function publish() {
  if (busy.value || !askTitle.value.trim() || !askBody.value.trim()) return;
  busy.value = true; error.value = ""; notice.value = "";
  try {
    const created = await createPost(askTitle.value.trim(), askBody.value.trim());
    if (created?.status === "ACTIVE" && created.id) await router.push("/community/post/" + created.id);
    else notice.value = created?.status === "PENDING" || created?.status === "HELD" ? "帖子已提交审核，公开状态以服务端结果为准。" : "发布请求已受理，当前尚未收到可核验的公开状态。";
  } catch (cause) { error.value = cause instanceof ApiError && cause.code === 3401 ? "内容需要审核或调整，请按服务端提示修改后再提交。" : cause instanceof Error ? cause.message : "发帖未确认。"; }
  finally { busy.value = false; }
}
async function reply() {
  if (!post.value || !replyBody.value.trim() || busy.value) return;
  busy.value = true; error.value = ""; notice.value = "";
  try { await createReply(post.value.id, replyBody.value.trim()); replyBody.value = ""; await load(); notice.value = "回复请求已受理，是否公开以审核结果为准。"; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "回复未确认。"; }
  finally { busy.value = false; }
}
async function like(type: "post" | "reply", id: string) {
  if (busy.value) return;
  busy.value = true; error.value = "";
  try { await likeCommunity(type, id); await load(); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "点赞状态未确认。"; }
  finally { busy.value = false; }
}
async function accept(id: string) {
  if (busy.value || !post.value?.replies.some((entry) => entry.id === id && entry.canAccept)) return;
  busy.value = true; error.value = "";
  try { await acceptReply(id); await load(); notice.value = "采纳状态已由服务端更新。"; }
  catch (cause) { error.value = cause instanceof Error ? cause.message : "采纳未确认。"; }
  finally { busy.value = false; }
}
function insertSymbol(symbol: string) { askBody.value += symbol; }

watch([mode, postId], () => { notice.value = ""; void load(); });
onMounted(() => { void load(); });
</script>

<template>
  <div class="community-page"><header class="hero"><RouterLink v-if="mode !== 'feed'" to="/community" class="back">← 返回社区</RouterLink><p class="eyebrow">COMMUNITY · 共学与提问</p><h1>{{ mode === 'ask' ? '把问题说清楚' : mode === 'post' ? '一起把这一步想明白' : '让思考有回声' }}</h1><p>内容、审核状态与互动数均来自服务端；未确认的帖子不会当作已公开。</p></header>
    <main class="main"><p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="notice" class="success" role="status">{{ notice }}</p>
      <template v-if="mode === 'feed'"><div class="toolbar"><div class="tabs" role="group" aria-label="社区筛选"><button type="button" :aria-pressed="tab === 'latest'" @click="tab = 'latest'">最新</button><button type="button" :aria-pressed="tab === 'featured'" @click="tab = 'featured'">精华</button><button type="button" :aria-pressed="tab === 'topic'" @click="tab = 'topic'">按话题</button></div><RouterLink to="/community/ask" class="primary">提出问题 ↗</RouterLink></div><div v-if="tab === 'topic'" class="topic-filter"><label for="topic">话题关键词</label><input id="topic" v-model="topic" placeholder="如：三角学"></div><p class="hint">筛选作用于当前页；公开列表不显示待审核与扣留内容。</p><p v-if="loading" class="state" role="status">正在读取社区帖子…</p><div v-else-if="visible.length" class="feed"><RouterLink v-for="item in visible" :key="item.id" :to="'/community/post/' + item.id" class="post-card"><div class="post-meta"><span class="avatar">{{ item.author.slice(0, 1) }}</span><strong>{{ item.author }}</strong><span>{{ item.createdAt || '时间待同步' }}</span><span v-if="item.topic" class="tag">{{ item.topic }}</span><span v-if="item.featured" class="tag">精华</span></div><h2>{{ item.title }}</h2><p v-if="item.content">{{ item.content.slice(0, 130) }}</p><div class="counts"><span>回复 {{ item.replyCount ?? '—' }}</span><span>喜欢 {{ item.likeCount ?? '—' }}</span><span class="arrow">阅读讨论 ↗</span></div></RouterLink></div><div v-else class="state"><h2>当前没有可展示的帖子</h2><p>可以换个筛选，或在这里提出第一个问题。</p></div><nav v-if="posts.length" class="pagination" aria-label="帖子分页"><button type="button" :disabled="page <= 1 || loading" @click="turnPage(page - 1)">上一页</button><span>第 {{ page }} 页<span v-if="total !== null"> · 共 {{ total }} 条</span></span><button type="button" :disabled="!hasNext || loading" @click="turnPage(page + 1)">下一页</button></nav></template>
      <template v-else-if="mode === 'post'"><p v-if="loading" class="state" role="status">正在读取帖子与回复…</p><div v-else-if="!post" class="state"><h2>帖子暂不可用</h2><p>可能尚未公开、已经下线，或服务暂时不可用。</p><button type="button" @click="load">重试</button></div><template v-else><article class="post-detail"><div class="post-meta"><span class="avatar">{{ post.author.slice(0, 1) }}</span><strong>{{ post.author }}</strong><span>{{ post.createdAt || '时间待同步' }}</span><span v-if="post.topic" class="tag">{{ post.topic }}</span></div><h2>{{ post.title }}</h2><p class="body">{{ post.content || '正文待同步。' }}</p><div class="counts"><span>喜欢 {{ post.likeCount ?? '—' }}</span><button type="button" :disabled="busy" @click="like('post', post.id)">喜欢 / 取消喜欢</button><RouterLink v-if="/^[a-zA-Z0-9-]{1,80}$/.test(post.questionId)" :to="'/deepdive/question/' + post.questionId">查看关联题目 ↗</RouterLink></div></article><section class="replies"><h2>回复 {{ post.replies.length }}</h2><article v-for="entry in post.replies" :key="entry.id" class="reply-card"><div class="post-meta"><span class="avatar">{{ entry.author.slice(0, 1) }}</span><strong>{{ entry.author }}</strong><span>{{ entry.createdAt || '时间待同步' }}</span><span v-if="entry.adopted" class="tag adopted">已采纳</span></div><p class="body">{{ entry.content }}</p><div class="counts"><button type="button" :disabled="busy" @click="like('reply', entry.id)">喜欢 {{ entry.likeCount ?? '—' }}</button><button v-if="entry.canAccept && !entry.adopted" type="button" :disabled="busy" @click="accept(entry.id)">采纳为最佳答案</button></div></article><p v-if="!post.replies.length" class="state">还没有服务端可见的回复。</p></section><form class="reply-form" @submit.prevent="reply"><label for="reply-text">写下你的思路</label><textarea id="reply-text" v-model="replyBody" rows="4" placeholder="说清条件、依据与可能的误区…"/><button type="submit" class="primary" :disabled="busy || !replyBody.trim()">提交回复</button></form></template></template>
      <section v-else class="ask-card"><p class="eyebrow">ASK WITH CONTEXT</p><h2>先写清楚卡点</h2><p>题面、你尝试的步骤和疑问越具体，讨论越容易聚焦。是否公开由服务端审核决定。</p><form @submit.prevent="publish"><label for="ask-title">标题</label><input id="ask-title" v-model="askTitle" maxlength="120" placeholder="例如：为什么这一步可以两边同除？"><label for="ask-body">正文</label><textarea id="ask-body" v-model="askBody" rows="9" placeholder="写下题目、已知条件、你的尝试和具体疑问…"/><div class="mathbar" aria-label="插入数学符号"><button v-for="symbol in ['²', '√()', 'π', '±', '≤', '∫']" :key="symbol" type="button" @click="insertSymbol(symbol)">{{ symbol }}</button></div><button type="submit" class="primary" :disabled="busy || !askTitle.trim() || !askBody.trim()">{{ busy ? '提交中…' : '提交帖子审核' }}</button></form></section>
    </main>
  </div>
</template>

<style scoped>
.community-page{min-height:100vh;background:var(--bg,#f8fafc);color:var(--ink,#0f172a)}.hero{padding:42px max(24px,calc((100vw - 920px)/2));background:linear-gradient(125deg,#102245,#273e75);color:#fff}.back{display:inline-block;margin-bottom:21px;color:#cfddff}.eyebrow{margin:0 0 8px;color:var(--brand,#4e7bff);font-size:11px;font-weight:850;letter-spacing:.17em}.hero .eyebrow{color:#9bb8ff}.hero h1{margin:0;font:700 clamp(29px,4vw,43px) var(--serif,Georgia,serif)}.hero>p:last-child{color:#d2ddf2;line-height:1.8}.main{max-width:920px;margin:auto;padding:26px 24px 70px}.toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}.tabs{display:flex;gap:6px;padding:5px;border:1px solid var(--line);border-radius:11px;background:var(--card)}.tabs button{min-height:39px;padding:7px 14px;border:0;border-radius:8px;background:transparent;color:var(--ink2)}.tabs button[aria-pressed=true]{background:var(--brand-soft);color:var(--brand);font-weight:800}.primary{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:9px 17px;border:0;border-radius:10px;background:var(--brand);color:var(--on-brand,#fff);font-weight:800}.primary:disabled,button:disabled{opacity:.55}.hint{color:var(--ink3);font-size:12px}.topic-filter{display:flex;align-items:center;gap:12px;margin-top:17px}.topic-filter label{font-weight:700}.topic-filter input,.ask-card input,.ask-card textarea,.reply-form textarea{box-sizing:border-box;width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font:inherit}.topic-filter input{max-width:300px}.feed{display:grid;gap:13px;margin-top:22px}.post-card,.post-detail,.reply-card,.ask-card,.reply-form,.state{display:block;padding:24px;border:1px solid var(--line);border-radius:17px;background:var(--card);color:var(--ink)}.post-card:hover{border-color:var(--brand)}.post-meta{display:flex;align-items:center;flex-wrap:wrap;gap:9px;color:var(--ink3);font-size:12px}.post-meta strong{color:var(--ink)}.avatar{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--brand-soft);color:var(--brand);font-weight:850}.tag{padding:4px 8px;border-radius:99px;background:var(--soft);color:var(--ink2)}.tag.adopted{background:var(--good-bg,#dcfce7);color:var(--good,#15803d)}.post-card h2,.post-detail h2{margin:15px 0 10px;font:700 22px var(--serif,Georgia,serif)}.post-card>p{display:-webkit-box;overflow:hidden;-webkit-line-clamp:3;-webkit-box-orient:vertical;color:var(--ink3);line-height:1.7}.counts{display:flex;flex-wrap:wrap;align-items:center;gap:15px;margin-top:15px;padding-top:14px;border-top:1px solid var(--line);color:var(--ink3);font-size:12px}.counts button{min-height:34px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink2)}.counts a{color:var(--brand)}.arrow{margin-left:auto;color:var(--brand);font-weight:800}.post-detail,.replies,.reply-form{margin-top:18px}.body{white-space:pre-wrap;line-height:1.85;color:var(--ink2)}.replies>h2,.ask-card h2{font:700 25px var(--serif,Georgia,serif)}.reply-card{margin-top:12px}.reply-form{display:grid;gap:11px}.reply-form label,.ask-card label{font-weight:800;font-size:13px}.reply-form button{justify-self:start}.ask-card>p{color:var(--ink3);line-height:1.7}.ask-card form{display:grid;gap:11px;margin-top:23px}.ask-card form>.primary{justify-self:start;margin-top:10px}.mathbar{display:flex;flex-wrap:wrap;gap:7px}.mathbar button{min-width:38px;min-height:38px;border:1px solid var(--line);border-radius:8px;background:var(--soft);color:var(--ink)}.state{text-align:center;margin-top:22px;line-height:1.7}.state h2{font:700 25px var(--serif,Georgia,serif)}.state button,.pagination button{min-height:39px;padding:8px 13px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink)}.pagination{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:20px;color:var(--ink3);font-size:13px}.error,.success{padding:12px 15px;border-radius:9px;background:var(--danger-bg,#fee2e2);color:var(--danger,#b91c1c)}.success{background:var(--good-bg,#dcfce7);color:var(--good,#15803d)}
@media(max-width:600px){.hero{padding:28px 20px}.main{padding:16px}.post-card,.post-detail,.reply-card,.ask-card,.reply-form{padding:18px}.toolbar .primary{width:100%}.tabs{width:100%;justify-content:space-between}.tabs button{font-size:12px}}
</style>
