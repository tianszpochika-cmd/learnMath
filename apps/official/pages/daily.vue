<script setup lang="ts">
import { resourceBody, resourceField, resourceRecord, resourceRows, resourceSlug } from "~/components/ResourceData";

const request = reactive<{ date?: string }>({});
const { data, pending, refresh } = await usePublished<unknown>("public-daily-question", "daily-question", request);
const question = computed(() => resourceRecord(data.value?.value));
const title = computed(() => resourceField(question.value, "stem", "question", "title"));
const date = computed(() => resourceField(question.value, "date") || request.date || "");
const options = computed(() => resourceRows(question.value.options));
const answer = computed(() => {
  const value = resourceField(question.value, "correctOption", "correctAnswer", "answer").toUpperCase();
  const keys = options.value.map((option, index) => (resourceField(option, "key", "id") || String.fromCharCode(65 + index)).toUpperCase());
  return keys.includes(value) ? value : "";
});
const explanation = computed(() => resourceBody(question.value.publicExplanation ?? question.value.explanation ?? question.value.analysis));
const chain = computed(() => resourceRows(question.value.chainSummary ?? question.value.reasoningSteps));
const questionId = computed(() => resourceSlug({ id: resourceField(question.value, "questionId", "id") }));
const nextAt = computed(() => resourceField(question.value, "nextAt", "nextQuestionAt"));
const selected = ref("");
const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

const remaining = computed(() => {
  const end = new Date(nextAt.value).getTime();
  if (!Number.isFinite(end)) return "";
  const seconds = Math.max(0, Math.ceil((end - now.value) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return hours + " 小时 " + String(minutes).padStart(2, "0") + " 分";
});
const feedback = computed(() => {
  if (!selected.value) return "";
  if (!answer.value) return "选项已记录。当前公开数据没有标准答案，无法在本页判对错。";
  return selected.value.toUpperCase() === answer.value ? "回答正确。解析已在下方完全公开。" : "再看看解析，找出关键的一步。";
});
const baseDate = computed(() => {
  if (date.value && /^\d{4}-\d{2}-\d{2}$/.test(date.value)) return date.value;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(now.value));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return [value.year, value.month, value.day].join("-");
});
const pastDates = computed(() => {
  const start = new Date(baseDate.value + "T12:00:00Z");
  return Array.from({ length: 7 }, (_, index) => {
    const copy = new Date(start);
    copy.setUTCDate(copy.getUTCDate() - index - 1);
    return copy.toISOString().slice(0, 10);
  });
});

async function chooseDate(value?: string) {
  request.date = value;
  selected.value = "";
  await refresh();
}

onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 60_000); });
onBeforeUnmount(() => { if (timer) clearInterval(timer); });

useSeoMeta({
  title: computed(() => date.value ? "每日一题 " + date.value : "每日一题"),
  description: computed(() => title.value || "每天公开一道已审核的数学题，解析无需登录即可阅读。"),
  robots: computed(() => data.value?.available && title.value ? "index,follow" : "noindex,follow")
});
</script>

<template>
  <ResourceShell eyebrow="DAILY · 每日一题" title="每天一题，想透一步" intro="题目和解析完整公开。先自己选，再往下看推理；登录只用于继续更深入的练习。">
    <div class="daily-meta">
      <span>{{ request.date ? "往期查询 · " + request.date : "今日题目" }}</span>
      <span v-if="remaining">下一题约 {{ remaining }} 后更新</span>
    </div>
    <p v-if="pending" role="status">正在读取公开题目…</p>
    <ResourceEmpty v-else-if="!data?.available || !title" :title="data?.available ? '这一天暂无已发布题目' : '每日题暂时无法读取'"
      :message="data?.available ? '这一天尚未排期公开题目。可以查询其他日期。' : '公开题目服务暂不可用；此处不会用虚构题目代替。'"
      retry @retry="refresh()" />
    <template v-else>
      <article class="daily-card">
        <p class="daily-kicker">{{ date || "公开题目" }} · 题面</p>
        <h2>{{ title }}</h2>
        <div v-if="options.length" class="daily-options" aria-label="选择答案">
          <button v-for="(option, index) in options" :key="index" type="button"
            :aria-pressed="selected === (resourceField(option, 'key', 'id') || String.fromCharCode(65 + index))"
            :class="{ chosen: selected === (resourceField(option, 'key', 'id') || String.fromCharCode(65 + index)) }"
            @click="selected = resourceField(option, 'key', 'id') || String.fromCharCode(65 + index)">
            <strong>{{ resourceField(option, "key", "id") || String.fromCharCode(65 + index) }}</strong>
            {{ resourceField(option, "text", "label", "content") }}
          </button>
        </div>
        <p v-else class="daily-input-note">此题没有公开选项。请先在心里或纸上作答，再看解析。</p>
        <p v-if="feedback" class="daily-feedback" :class="{ correct: answer && selected.toUpperCase() === answer }" role="status">{{ feedback }}</p>
        <details class="daily-analysis" open>
          <summary>完整公开解析 <span aria-hidden="true">⌄</span></summary>
          <p v-if="explanation">{{ explanation }}</p>
          <p v-else class="missing-copy">已发布题目尚未提供公开解析，待补全。</p>
          <ol v-if="chain.length" class="chain-list">
            <li v-for="(step, index) in chain.slice(0, 3)" :key="index"><span>S{{ index + 1 }}</span>{{ resourceBody(step) }}</li>
          </ol>
        </details>
      </article>
      <ResourceIntent v-if="questionId" target-type="question" :slug="questionId" action="drill" from="daily" label="到学习端探索完整推理" />
    </template>
    <section class="past-section" aria-labelledby="past-title">
      <h2 id="past-title">查询往期 7 天</h2>
      <p>日期只用于查询已发布题目；没有排期时会显示空态。</p>
      <div class="past-list">
        <button type="button" :aria-pressed="!request.date" @click="chooseDate(undefined)">今天</button>
        <button v-for="day in pastDates" :key="day" type="button" :aria-pressed="request.date === day" @click="chooseDate(day)">{{ day.slice(5) }}</button>
      </div>
    </section>
  </ResourceShell>
</template>

<style scoped>
.daily-meta{display:flex;justify-content:space-between;gap:15px;flex-wrap:wrap;margin-bottom:19px;color:var(--ink3);font-size:13px}
.daily-meta span:first-child{color:var(--p-strong);font-weight:800}
.daily-card{padding:clamp(23px,5vw,50px);border:1px solid var(--line);border-radius:23px;background:var(--card);box-shadow:var(--shadow)}
.daily-kicker{color:var(--p);font-size:12px;font-weight:800;letter-spacing:.15em;margin:0 0 18px}
.daily-card h2{max-width:840px;font:700 clamp(25px,4vw,42px)/1.48 var(--serif);margin:0 0 30px}
.daily-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;max-width:820px}
.daily-options button{display:flex;align-items:center;gap:12px;min-height:58px;padding:12px 15px;border:1px solid var(--line);border-radius:13px;background:var(--page);color:var(--ink);text-align:left}
.daily-options button.chosen{border-color:var(--p);background:var(--p-soft)}
.daily-options strong{display:grid;place-items:center;flex:none;width:30px;height:30px;border-radius:8px;background:var(--card);color:var(--p);font-size:13px}
.daily-input-note,.missing-copy{color:var(--ink3)}
.daily-feedback{margin:20px 0 0;padding:11px 15px;border-radius:10px;background:#fff5e3;color:#8c5b00}
.daily-feedback.correct{background:#eaf9ef;color:#176c3c}
.daily-analysis{margin-top:32px;padding-top:20px;border-top:1px solid var(--line)}
.daily-analysis summary{display:flex;align-items:center;justify-content:space-between;min-height:48px;cursor:pointer;font-weight:800;font-size:18px}
.daily-analysis>p{max-width:850px;white-space:pre-line;color:var(--ink2);line-height:1.9}
.chain-list{display:grid;gap:9px;list-style:none;padding:0;margin-top:22px}
.chain-list li{display:flex;gap:12px;padding:13px 16px;border-radius:11px;background:var(--alt);color:var(--ink2)}
.chain-list span{color:var(--p);font-weight:800}
.past-section{margin-top:55px}.past-section h2{font:700 27px var(--serif);margin:0 0 5px}.past-section p{margin:0 0 17px;color:var(--ink3);font-size:13px}
.past-list{display:flex;flex-wrap:wrap;gap:8px}.past-list button{min-height:42px;padding:8px 14px;border:1px solid var(--line);border-radius:99px;background:var(--card);color:var(--ink2)}
.past-list button[aria-pressed=true]{border-color:var(--p);color:var(--p-strong);background:var(--p-soft);font-weight:800}
@media(max-width:600px){.daily-options{grid-template-columns:1fr}.daily-card h2{margin-bottom:23px}}
</style>
