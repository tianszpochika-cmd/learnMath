<script setup lang="ts">
import { formulaProofStatus, resourceBody, resourceField, resourceFormulaId, resourceItems, resourcePublished, resourceRecord, resourceRows, resourceSlug } from "~/components/ResourceData";

const route = useRoute();
const slug = String(route.params.slug || "");
definePageMeta({ key: (route) => route.fullPath });
const lookup = /^\d+$/.test(slug) ? null : await usePublished<unknown>("public-formula-lookup-" + slug, "formulas", { keyword: slug, size: 100 });
const match = resourceItems(lookup?.data.value?.value).find((item) => resourceField(item, "slug") === slug);
const identifier = /^\d+$/.test(slug) ? slug : resourceFormulaId(match);
const publication = identifier ? await usePublished<unknown>("public-formula-" + identifier, "formulas/" + identifier) : null;
const data = computed(() => publication?.data.value ?? null);
const pending = computed(() => Boolean(lookup?.pending.value || publication?.pending.value));
async function refresh() {
  if (lookup) await lookup.refresh();
  if (publication) await publication.refresh();
}
const detail = computed(() => resourceRecord(data.value?.value));
const hasSnapshot = computed(() => !("publishedSnapshot" in detail.value) || detail.value.publishedSnapshot != null);
const present = computed(() => data.value?.available && resourcePublished(detail.value, "formula") && hasSnapshot.value && Boolean(resourceField(detail.value, "name", "title")));
const snapshot = computed(() => resourceRecord(detail.value.publishedSnapshot ?? detail.value.snapshot ?? detail.value));
const proof = computed(() => formulaProofStatus({ ...snapshot.value, ...detail.value }));
const name = computed(() => resourceField(detail.value, "name", "title") || "公式");
const expression = computed(() => resourceField(snapshot.value, "latex", "formula", "expression") || resourceField(detail.value, "latex", "formula", "expression"));
const conditions = computed(() => resourceBody(snapshot.value.conditions ?? snapshot.value.fullConditions ?? detail.value.conditions));
const conditionSummary = computed(() => resourceField(snapshot.value, "conditionSummary") || resourceField(detail.value, "conditionSummary"));
const origin = computed(() => resourceBody(snapshot.value.origin ?? detail.value.origin));
const teaser = computed(() => resourceRows(snapshot.value.derivationTeaser ?? snapshot.value.derivationSteps ?? snapshot.value.proofSteps));
const application = computed(() => resourceBody(snapshot.value.application ?? snapshot.value.applications));
const family = computed(() => resourceItems(snapshot.value.family ?? snapshot.value.familyRelations).filter((item) => resourceFormulaId(item) || resourceSlug(item)));
const errors = computed(() => resourceRows(snapshot.value.commonErrors ?? snapshot.value.misuses));
const practice = computed(() => resourceRecord(snapshot.value.practicePreview ?? snapshot.value.firstDrill));
const practiceOptions = computed(() => resourceRows(practice.value.options));
const selectedPractice = ref("");
const copyMessage = ref("");

onMounted(() => {
  try { selectedPractice.value = sessionStorage.getItem("lm-official-formula-preview:" + slug) || ""; } catch { /* 存储不可用 */ }
});
watch(selectedPractice, (value) => {
  if (!import.meta.client) return;
  try { sessionStorage.setItem("lm-official-formula-preview:" + slug, value); } catch { /* 存储不可用 */ }
});

async function copyFormula() {
  try {
    await navigator.clipboard.writeText(expression.value);
    copyMessage.value = "公式已复制";
  } catch {
    copyMessage.value = "复制失败，请手动选择公式";
  }
}

useSeoMeta({
  title: computed(() => present.value ? name.value + "推导过程与成立条件" : "公式暂不可用"),
  description: computed(() => conditionSummary.value || conditions.value.slice(0, 110) || "数源公式馆"),
  ogTitle: computed(() => present.value ? name.value + "｜数源公式馆" : "公式暂不可用"),
  ogDescription: computed(() => conditionSummary.value || conditions.value.slice(0, 110) || "数源公式馆"),
  robots: computed(() => present.value ? "index,follow" : "noindex,follow")
});
</script>

<template>
  <ResourceShell eyebrow="FORMULAS · 公式研习" :title="name" :intro="present ? resourceField(detail, 'summary') : '当前公式尚无可展示的已审核版本。'"
    parent="公式馆" parent-to="/formulas">
    <template #hero>
      <div v-if="present" class="formula-meta">
        <span v-if="resourceField(detail, 'domain', 'category')">{{ resourceField(detail, "domain", "category") }}</span>
        <span v-if="resourceField(detail, 'tier')">Tier {{ resourceField(detail, "tier") }}</span>
        <span :class="'proof-' + proof.tone">{{ proof.label }}</span>
      </div>
    </template>
    <p v-if="pending" role="status">正在读取公式…</p>
    <ResourceEmpty v-else-if="!present" title="公式尚未发布或暂不可用" message="公开页只读取审核后的版本。你可以返回公式馆查看其他内容。" retry @retry="refresh()" />
    <template v-else>
      <div v-if="proof.tone !== 'neutral'" class="proof-warning" :class="'proof-' + proof.tone" role="note">
        <strong>{{ proof.label }}</strong>
        <p>{{ proof.tone === 'danger' ? '这条公式的证明尚未成立。请勿将其作为定理引用；学习和使用前请核对成立条件与来源。' : '这条公式的证明状态需要留意。请结合成立条件、来源与适用范围判断，避免直接推广。' }}</p>
      </div>
      <section aria-labelledby="formula-expression">
        <h2 id="formula-expression" class="sr-only">公式表达式</h2>
        <div class="formula-display">
          <ResourceMath v-if="expression" :latex="expression" display />
          <span v-else>已发布版本尚未提供表达式</span>
          <span class="corner-mark" aria-hidden="true">∬</span>
        </div>
        <div class="conditions" role="note"><strong>成立条件</strong><p>{{ conditionSummary || conditions || "当前已发布版本的成立条件待补全；使用前请核对完整条件。" }}</p><a v-if="conditions" href="#full-conditions">查看完整条件与误用边界 ↓</a></div>
        <div class="formula-actions">
          <button type="button" :disabled="!expression" @click="copyFormula">复制公式</button>
          <span v-if="copyMessage" role="status">{{ copyMessage }}</span>
        </div>
      </section>
      <section class="resource-section" aria-labelledby="formula-origin">
        <p class="section-index">01 / ORIGIN</p><h2 id="formula-origin">它从哪里来</h2>
        <p v-if="origin" class="prose">{{ origin }}</p><p v-else class="missing-copy">起源内容待补全。</p>
      </section>
      <section class="resource-section" aria-labelledby="formula-proof">
        <p class="section-index">02 / DERIVATION</p><h2 id="formula-proof">推导摘要</h2>
        <div v-if="teaser.length" class="proof-steps">
          <div v-for="(step, index) in teaser.slice(0, 3)" :key="index" class="proof-step">
            <span>0{{ index + 1 }}</span><strong>{{ resourceField(step, "title", "name") || "第 " + (index + 1) + " 步" }}</strong>
            <p>{{ resourceBody(step) }}</p>
          </div>
        </div>
        <p v-else class="missing-copy">已发布快照尚无推导摘要。</p>
      </section>
      <section id="full-conditions" class="resource-section" aria-labelledby="formula-condition-title">
        <p class="section-index">03 / CONDITIONS</p><h2 id="formula-condition-title">完整条件与误用边界</h2>
        <p v-if="conditions" class="prose">{{ conditions }}</p><p v-else class="missing-copy">完整条件待补全。</p>
        <div v-if="errors.length" class="error-list">
          <div v-for="(item, index) in errors" :key="index"><strong>{{ resourceField(item, "wrongForm", "title") || "常见误用 " + (index + 1) }}</strong><p>{{ resourceBody(item) }}</p></div>
        </div>
      </section>
      <section v-if="application" class="resource-section" aria-labelledby="formula-application">
        <p class="section-index">04 / APPLICATION</p><h2 id="formula-application">它用在哪里</h2><p class="prose">{{ application }}</p>
      </section>
      <section v-if="family.length" class="resource-section" aria-labelledby="formula-family">
        <p class="section-index">05 / FAMILY</p><h2 id="formula-family">公式家族</h2>
        <div class="family-list"><NuxtLink v-for="item in family" :key="resourceFormulaId(item) || resourceSlug(item)" :to="'/formulas/' + (resourceFormulaId(item) || resourceSlug(item))">{{ resourceField(item, "name", "title") || resourceFormulaId(item) || resourceSlug(item) }} ↗</NuxtLink></div>
      </section>
      <section v-if="resourceField(practice, 'stem', 'question', 'title')" class="practice-preview resource-section">
        <p class="section-index">06 / TRY</p><h2>公开试做题面</h2>
        <p class="prose">{{ resourceField(practice, "stem", "question", "title") }}</p>
        <fieldset v-if="practiceOptions.length">
          <legend class="sr-only">选择你的试做答案</legend>
          <label v-for="(option, index) in practiceOptions" :key="index">
            <input v-model="selectedPractice" type="radio" :value="resourceField(option, 'key', 'id') || String(index)">
            {{ resourceField(option, "text", "label", "content") }}
          </label>
        </fieldset>
        <p class="practice-note">本页只临时保留所选项，不提交或判分。进入学习端后请确认目标和答案。</p>
      </section>
      <ResourceIntent target-type="formula" :target-id="identifier" action="drill" :from="'formula/' + slug" label="到学习端完整研习" />
    </template>
  </ResourceShell>
</template>

<style scoped>
.formula-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:23px}
.formula-meta span{padding:6px 11px;border-radius:99px;background:var(--p-soft);color:var(--p-strong);font-size:12px;font-weight:750}
.formula-meta .proof-warning{background:#fff5de;color:#805600}
.formula-meta .proof-danger{background:#ffe9e9;color:#9b2525}
.proof-warning{margin:0 0 20px;padding:17px 20px;border:1px solid #efcb79;border-radius:13px;background:#fff9e9;color:#704b00}
.proof-warning.proof-danger{border-color:#e8a0a0;background:#fff1f1;color:#8d2525}
.proof-warning p{margin:5px 0 0;line-height:1.65}
:root[data-theme=dark] .proof-warning{border-color:#8a6934;background:#362b18;color:#ffe0a0}
:root[data-theme=dark] .proof-warning.proof-danger{border-color:#9b5555;background:#3e2228;color:#ffc6c6}
.formula-display{position:relative;overflow:auto;margin-bottom:14px;padding:45px 36px;border:1px solid var(--line);border-radius:22px;background:var(--card);font:600 clamp(26px,5vw,46px)/1.3 Georgia,var(--serif);white-space:pre-wrap;overflow-wrap:anywhere}
.formula-display .corner-mark{position:absolute;right:28px;bottom:11px;font:italic 50px Georgia,serif;color:var(--p-soft)}
.conditions{padding:18px 22px;border-left:5px solid #cf4545;border-radius:0 13px 13px 0;background:color-mix(in srgb,var(--card) 88%,#f66);color:var(--ink)}
.conditions strong{color:#b83333}.conditions p{margin:7px 0;line-height:1.7}.conditions a{color:#b83333;font-weight:750;font-size:13px}
.formula-actions{display:flex;align-items:center;gap:14px;margin-top:15px;color:var(--ink3);font-size:13px}
.formula-actions button{min-height:42px;padding:8px 16px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);font-weight:700}
.formula-actions button:disabled{opacity:.5}
.resource-section{margin-top:58px}
.section-index{color:var(--p);font:800 11px var(--sans);letter-spacing:.16em;margin:0 0 8px}
h2{font:700 clamp(25px,3vw,35px)/1.3 var(--serif);margin:0 0 18px}
.prose{max-width:850px;white-space:pre-line;color:var(--ink2);font-size:16px;line-height:1.9}
.missing-copy{color:var(--ink3)}
.proof-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}
.proof-step{padding:22px;border:1px solid var(--line);border-radius:16px;background:var(--card)}
.proof-step span{display:block;color:var(--p);font:700 14px Georgia,serif;margin-bottom:14px}
.proof-step strong{font-size:16px}.proof-step p{color:var(--ink3);font-size:14px;line-height:1.7}
.error-list{display:grid;gap:10px;margin-top:18px}
.error-list>div{padding:17px 20px;border:1px solid #f1b4b4;border-radius:12px;background:color-mix(in srgb,var(--card) 89%,#f66)}
.error-list strong{color:#b83333}.error-list p{margin:5px 0 0;color:var(--ink2)}
.family-list{display:flex;flex-wrap:wrap;gap:9px}.family-list a{padding:10px 15px;border:1px solid var(--line);border-radius:999px;background:var(--card);font-weight:700}
.practice-preview{padding:27px;border:1px solid var(--line);border-radius:18px;background:var(--card)}
fieldset{display:grid;gap:9px;max-width:550px;border:0;padding:0;margin:18px 0}
fieldset label{display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 12px;border:1px solid var(--line);border-radius:9px}
fieldset input{accent-color:var(--p);width:18px;height:18px}
.practice-note{color:var(--ink3);font-size:13px}
@media(max-width:680px){.proof-steps{grid-template-columns:1fr}.formula-display{padding:30px 22px}}
</style>
