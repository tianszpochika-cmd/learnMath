<script setup lang="ts">
defineProps<{
  eyebrow: string;
  title: string;
  intro?: string;
  parent?: string;
  parentTo?: string;
}>();
</script>

<template>
  <div class="resource-page">
    <header class="resource-hero">
      <div class="resource-inner">
        <nav class="resource-crumb" aria-label="面包屑">
          <NuxtLink to="/">首页</NuxtLink>
          <span aria-hidden="true">/</span>
          <NuxtLink v-if="parentTo" :to="parentTo">{{ parent }}</NuxtLink>
          <span v-else-if="parent">{{ parent }}</span>
          <template v-if="parent">
            <span aria-hidden="true">/</span>
            <span aria-current="page">{{ title }}</span>
          </template>
        </nav>
        <p class="resource-eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <p v-if="intro" class="resource-intro">{{ intro }}</p>
        <slot name="hero" />
      </div>
    </header>
    <div class="resource-inner resource-main"><slot /></div>
  </div>
</template>

<style scoped>
.resource-page{--r-ink:var(--ink,#13213b);--r-muted:var(--ink3,#64748b);--r-line:var(--line,#dbe3ef);--r-blue:var(--p,#2f6bff);--r-surface:var(--card,#fff);color:var(--r-ink);min-height:70vh;background:var(--page,#f8faff)}
.resource-inner{width:min(1120px,calc(100% - 40px));margin-inline:auto}
.resource-hero{padding:72px 0 56px;background:radial-gradient(circle at 82% 17%,#697fff19,transparent 32%),linear-gradient(#6e95e009 1px,transparent 1px),linear-gradient(90deg,#6e95e009 1px,transparent 1px),var(--r-surface);background-size:auto,32px 32px,32px 32px}
.resource-crumb{display:flex;align-items:center;flex-wrap:wrap;gap:8px;color:var(--r-muted);font-size:13px;margin-bottom:42px}
.resource-crumb a{color:inherit;text-decoration:none}
.resource-crumb a:hover{color:var(--r-blue)}
.resource-eyebrow{color:var(--r-blue);font-size:12px;font-weight:800;letter-spacing:.17em;margin:0 0 12px;text-transform:uppercase}
h1{font-family:var(--serif,"Noto Serif SC",Georgia,serif);font-size:clamp(36px,5vw,66px);line-height:1.18;letter-spacing:-.035em;max-width:900px;margin:0}
.resource-intro{max-width:710px;color:var(--r-muted);line-height:1.8;font-size:16px;margin:18px 0 0}
.resource-main{padding-top:48px;padding-bottom:100px}
@media(max-width:640px){.resource-inner{width:min(100% - 30px,1120px)}.resource-hero{padding:38px 0 40px}.resource-crumb{margin-bottom:28px}.resource-main{padding-top:30px;padding-bottom:68px}}
</style>
