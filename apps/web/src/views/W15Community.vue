<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ASK_PATH,
  adoptView,
  authorView,
  duplicateLikeMessage,
  filterFeed,
  likeView,
  postPath,
  sortedReplies,
  submitFeedback,
  visibleToOthers,
  type FeedTab,
  type PostCard,
} from "../features/community/communityUi";

/** W15 社区三屏（16W15：feed/post/ask · 状态渲染在 communityUi 单测锁定）。 */
const route = useRoute();
const router = useRouter();

const mode = computed<"feed" | "post" | "ask">(() => {
  if (route.name === "ask") return "ask";
  if (route.name === "post") return "post";
  return "feed";
});

// ---- feed ----
const tab = ref<FeedTab>("latest");
const topic = ref("三角学");
const posts = reactive<PostCard[]>([
  { id: 1024, title: "这步为什么要除以 sinC？我总在这里卡住…", author: "小B", timeLabel: "2 小时前", topic: "三角学", replyCount: 6, likeCount: 12 },
  { id: 1102, title: "均值不等式取等条件的三个检查位，总结给你…", author: "小C", timeLabel: "5 小时前", topic: "不等式", replyCount: 12, likeCount: 40, adopted: true },
  { id: 1310, title: "为什么配方后一定要写 ±？", author: "小A", timeLabel: "昨天", topic: "方程", replyCount: 3, likeCount: 8 },
]);
const filtered = computed(() => filterFeed(posts, tab.value, topic.value));
const myHeld = { state: "审核中（暂不可见）" }; // 作者自己的扣留帖（fixture）

// ---- post detail ----
const replies = [
  { id: 1, author: "答主D", content: "因为 C 是内角，sinC∈(0,1] 恒不为 0——除式安全。丢风险在「两边同除含变量的式子」。", adopted: true, likeCount: 24 },
  { id: 2, author: "答主E", content: "补充：正弦定理的 a/sinA 本来就是比值恒等结构。", adopted: false, likeCount: 8 },
  { id: 3, author: "答主F", content: "楼上正解，我补个反例：x(x−1)=x 两边除 x 丢根。", adopted: false, likeCount: 15 },
];
const sorted = computed(() => sortedReplies(replies));
const likes = reactive<Record<number, boolean>>({});
const adoptedAnswerId = ref<string | null>("1");

function toggleLike(id: number): void {
  if (likes[id]) {
    alertTip(duplicateLikeMessage());
    return;
  }
  likes[id] = true;
}
function likeCountOf(id: number, base: number): number {
  return likeView(base, Boolean(likes[id])).count + (likes[id] ? 1 : 0);
}

// ---- ask ----
const askTitle = ref("");
const askBody = ref("");
const asked = ref(false);
const feedback = ref("");
function publish(): void {
  const text = askTitle.value + " " + askBody.value;
  const fb = submitFeedback(text);
  feedback.value = `[${fb.code}] ${fb.message}`;
  asked.value = fb.ok; // 命中 → 未发布，仅本地"审核中"
}
const previewVisible = visibleToOthers("ACTIVE");

let tipTimer: ReturnType<typeof setTimeout> | null = null;
const tip = ref("");
function alertTip(msg: string): void {
  tip.value = msg;
  if (tipTimer) clearTimeout(tipTimer);
  tipTimer = setTimeout(() => (tip.value = ""), 2400);
}
</script>

<template>
  <div class="cm pad">
    <!-- FEED -->
    <template v-if="mode === 'feed'">
      <div class="head">
        <span class="bk" @click="router.push('/do')">‹</span>
        <h1>社区</h1>
        <div class="tabs">
          <button :class="{ on: tab === 'latest' }" @click="tab = 'latest'">最新</button>
          <button :class="{ on: tab === 'essence' }" @click="tab = 'essence'">精华</button>
          <button :class="{ on: tab === 'topic' }" @click="tab = 'topic'">话题 · {{ topic }}</button>
        </div>
        <button class="btn" style="margin-left: auto" @click="router.push(ASK_PATH)">✎ 发帖</button>
      </div>

      <div class="heldbanner">🛡 我的帖「{{ myHeld.state }}」—— 作者可见，他人不可见（3401）</div>

      <div v-for="p in filtered" :key="p.id" class="card" @click="router.push(postPath(p.id))">
        <div class="prow">
          <span class="ava">{{ p.author.slice(-1) }}</span>
          <b>{{ p.author }}</b>
          <span class="mut">{{ p.timeLabel }}</span>
          <span v-if="p.topic" class="chip">{{ p.topic }}</span>
          <span v-if="p.adopted" class="chip ok">✓ 已采纳</span>
        </div>
        <p class="ptitle">{{ p.title }}</p>
        <div class="pmeta mut">💬 {{ p.replyCount }} · ♥ {{ p.likeCount }}</div>
      </div>
      <p v-if="filtered.length === 0" class="mut empty">该 Tab 暂无内容</p>
    </template>

    <!-- POST DETAIL -->
    <template v-else-if="mode === 'post'">
      <div class="head">
        <span class="bk" @click="router.push('/community')">‹</span>
        <h1>帖子详情</h1>
        <span class="chip" :class="{ ok: previewVisible }">可见性：{{ previewVisible ? "公开" : "隐藏" }}</span>
      </div>

      <div class="card">
        <div class="prow">
          <span class="ava">B</span><b>小B</b><span class="mut">2 小时前 · 三角学</span>
          <span class="chip" style="margin-left: auto" @click="router.push('/deepdive/question/1024')">原题卡 #1024 ›</span>
        </div>
        <p class="ptitle big">这步为什么要除以 sinC？</p>
        <p class="body">解三角形那步直接除了，心里不踏实——什么条件保证这样做不丢解？</p>
      </div>

      <div class="sect">回复 {{ sorted.length }}（已采纳置顶）</div>
      <div v-for="r in sorted" :key="r.id" class="card reply" :class="{ top: r.adopted }">
        <div class="prow">
          <span class="ava grey">{{ r.author.slice(-1) }}</span>
          <b>{{ r.author }}</b>
          <span v-if="r.adopted" class="chip ok">✓ 最佳答案</span>
          <span class="sp"></span>
          <span class="like" @click="toggleLike(r.id)">{{ likes[r.id] ? "♥" : "♡" }} {{ likeCountOf(r.id, r.likeCount) }}</span>
          <span
            class="adoptbtn"
            :class="adoptView(adoptedAnswerId, String(r.id)).cls"
            @click="adoptedAnswerId = String(r.id)"
          >{{ adoptView(adoptedAnswerId, String(r.id)).label }}</span>
        </div>
        <p class="body">{{ r.content }}</p>
      </div>

      <div class="replybar">
        <input placeholder="写下你的回复…" />
        <button class="btn" @click="alertTip('回复已提交（先发后审）')">发送</button>
      </div>
    </template>

    <!-- ASK -->
    <template v-else>
      <div class="head">
        <span class="bk" @click="router.push('/community')">‹</span>
        <h1>发帖</h1>
        <button class="btn" style="margin-left: auto" @click="publish">发布</button>
      </div>

      <p v-if="tip" class="tip">{{ tip }}</p>
      <div v-if="feedback" class="fb" :class="asked ? 'ok' : 'held'">{{ feedback }}</div>

      <div class="card">
        <input v-model="askTitle" class="titlein" placeholder="标题：说清楚你的问题" />
        <textarea v-model="askBody" class="bodyin" placeholder="正文：贴题面、贴步骤、说清卡点…（真实词库检测在服务端 AC）" />
        <div class="mbar">
          <button>x²</button><button>√</button><button>sin()</button><button>π</button><button>±</button><button>∫</button>
        </div>
      </div>

      <div class="card">
        <div class="sect" style="margin-top: 0">关联（可选）</div>
        <span class="chip">已关联题目 #1024</span>
        <span class="chip grey">知识点：解三角形</span>
      </div>

      <div class="card warn">
        <b>发布前提示（02 §5.9）</b>
        <p class="mut">命中词库 → 扣留 3401（你见"审核中"，他人不可见）；未命中 → 先发后审进入抽审队列。
        试试标题含「领答案」看扣留态。</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pad {
  padding: 22px 32px 48px;
  max-width: 900px;
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
.tabs {
  display: flex;
  gap: 8px;
}
.tabs button {
  padding: 8px 18px;
  border-radius: 99px;
  border: 1px solid var(--line);
  background: #fff;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--ink3);
  cursor: pointer;
}
.tabs button.on {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}
.heldbanner {
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  border-radius: 10px;
  padding: 11px 15px;
  font-size: 13.5px;
  margin-top: 14px;
}
.card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 15px 16px;
  margin-top: 12px;
  cursor: pointer;
}
.card.reply {
  cursor: default;
}
.card.reply.top {
  border-color: var(--ok);
  background: #fafffe;
}
.card.warn {
  background: #fffbEB;
  background: #FFFBEB;
  border-color: #fde68a;
  cursor: default;
}
.prow {
  display: flex;
  gap: 10px;
  align-items: center;
}
.ava {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand-deep);
  display: grid;
  place-items: center;
  font-weight: 800;
}
.ava.grey {
  background: #f1f5f9;
  color: #64748b;
}
.chip {
  font-size: 12px;
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 99px;
  padding: 3px 11px;
  font-weight: 600;
  cursor: pointer;
}
.chip.ok {
  background: #ecfdf5;
  color: #047857;
}
.chip.grey {
  background: #f1f5f9;
  color: #64748b;
}
.mut {
  color: var(--ink3);
  font-size: 12.5px;
}
.ptitle {
  font-size: 16px;
  font-weight: 600;
  margin-top: 10px;
  line-height: 1.6;
}
.ptitle.big {
  font-size: 19px;
}
.body {
  font-size: 14.5px;
  line-height: 1.85;
  margin-top: 8px;
  color: var(--ink2);
}
.pmeta {
  margin-top: 8px;
}
.empty {
  text-align: center;
  padding: 30px;
}
.sect {
  font-size: 13px;
  font-weight: 800;
  color: var(--ink3);
  margin: 18px 0 4px;
}
.sp {
  flex: 1;
}
.like {
  cursor: pointer;
  color: var(--bad);
  font-size: 14px;
}
.adoptbtn {
  font-size: 12.5px;
  border-radius: 8px;
  padding: 4px 12px;
  cursor: pointer;
  border: 1px solid var(--line);
}
.adoptbtn.available {
  border-color: var(--brand);
  color: var(--brand);
  font-weight: 700;
}
.adoptbtn.adopted {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #047857;
  font-weight: 800;
}
.adoptbtn.disabled {
  color: var(--ink3);
  cursor: default;
}
.replybar {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  position: sticky;
  bottom: 0;
  background: var(--bg-page);
  padding: 10px 0;
}
.replybar input {
  flex: 1;
  height: 44px;
  border-radius: 11px;
  border: 1.5px solid var(--line);
  padding: 0 14px;
  outline: none;
}
.tip {
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 10px;
  padding: 10px 15px;
  font-size: 13.5px;
  margin-top: 12px;
}
.fb {
  border-radius: 10px;
  padding: 11px 15px;
  font-size: 13.5px;
  margin-top: 12px;
  font-weight: 600;
}
.fb.ok {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #047857;
}
.fb.held {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}
.titlein {
  width: 100%;
  height: 46px;
  border: 1.5px solid var(--line);
  border-radius: 11px;
  padding: 0 14px;
  font-size: 16px;
  font-weight: 700;
  outline: none;
}
.titlein:focus,
.bodyin:focus {
  border-color: var(--brand);
}
.bodyin {
  width: 100%;
  min-height: 170px;
  border: none;
  outline: none;
  font-size: 15px;
  line-height: 1.8;
  margin-top: 10px;
  resize: vertical;
}
.mbar {
  display: flex;
  gap: 7px;
  border-top: 1px solid #f1f3f7;
  padding-top: 10px;
}
.mbar button {
  min-width: 40px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #fff;
  cursor: pointer;
  font-family: var(--font-math);
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
</style>
