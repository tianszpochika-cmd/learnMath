<script setup lang="ts">
import { defineAsyncComponent } from "vue";

const ResourceMath = defineAsyncComponent(() => import("./ResourceMath.vue"));
defineProps<{ to: string; eyebrow?: string; title: string; summary?: string; math?: string; detail?: string; notice?: string; noticeTone?: "warning" | "danger" }>();
</script>

<template>
  <NuxtLink class="resource-card" :to="to">
    <span class="resource-card-top">
      <span class="resource-card-symbol" aria-hidden="true">∑</span>
      <span class="resource-card-arrow" aria-hidden="true">↗</span>
    </span>
    <span v-if="eyebrow" class="resource-card-eyebrow">{{ eyebrow }}</span>
    <span v-if="notice" class="resource-card-notice" :class="noticeTone">{{ notice }}</span>
    <strong>{{ title }}</strong>
    <span v-if="math" class="resource-card-math"><ResourceMath :latex="math" /></span>
    <span v-else-if="summary" class="resource-card-summary">{{ summary }}</span>
    <span v-if="detail" class="resource-card-detail">{{ detail }}</span>
  </NuxtLink>
</template>

<style scoped>
.resource-card{display:flex;flex-direction:column;align-items:flex-start;min-height:250px;padding:26px;border:1px solid var(--line,#e2e8f0);border-radius:20px;background:var(--card,#fff);box-shadow:var(--shadow,0 20px 48px -36px #19396488);transition:transform .2s ease,border-color .2s ease}
.resource-card:hover{transform:translateY(-4px);border-color:var(--p,#2f6bff)}
.resource-card-top{display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:25px}
.resource-card-symbol{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:var(--p-soft,#eef4ff);color:var(--p,#2f6bff);font:italic 24px Georgia,serif}
.resource-card-arrow{color:var(--ink4,#8290a5);font-size:22px}
.resource-card-eyebrow{margin-bottom:6px;color:var(--p,#2f6bff);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.resource-card-notice{margin:5px 0 10px;padding:5px 9px;border-radius:8px;background:#fff5de;color:#805600;font-size:11px;font-weight:800}
.resource-card-notice.danger{background:#ffe9e9;color:#9b2525}
:root[data-theme=dark] .resource-card-notice{background:#433417;color:#ffe0a0}
:root[data-theme=dark] .resource-card-notice.danger{background:#4a2026;color:#ffc6c6}
strong{color:var(--ink,#0f172a);font:700 23px/1.35 var(--serif,serif)}
.resource-card-summary{margin-top:12px;color:var(--ink3,#64748b);font-size:14px;line-height:1.65}
.resource-card-math{display:block;max-width:100%;margin-top:12px;color:var(--ink2,#334155);font-size:19px;line-height:1.6;overflow-x:auto}
.resource-card-detail{margin-top:auto;padding-top:18px;color:var(--ink2,#334155);font-size:12px}
@media(prefers-reduced-motion:reduce){.resource-card{transition:none}.resource-card:hover{transform:none}}
</style>
