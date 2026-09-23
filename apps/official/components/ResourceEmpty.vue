<script setup lang="ts">
defineProps<{ title?: string; message?: string; retry?: boolean }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="resource-empty" role="status">
    <span class="resource-empty-mark" aria-hidden="true">∅</span>
    <h2>{{ title || "暂无已发布内容" }}</h2>
    <p>{{ message || "这部分内容尚未通过发布审核。可以稍后再来，也可以先探索其他资源。" }}</p>
    <button v-if="retry" type="button" @click="$emit('retry')">重新读取</button>
    <NuxtLink to="/search">探索其他资源 <span aria-hidden="true">↗</span></NuxtLink>
  </div>
</template>

<style scoped>
.resource-empty{display:grid;justify-items:start;gap:13px;max-width:720px;padding:34px;border:1px solid var(--line,#dbe3ef);border-radius:24px;background:var(--card,#fff)}
.resource-empty-mark{display:grid;place-items:center;width:50px;height:50px;border-radius:16px;background:var(--p-soft,#eaf0ff);color:var(--p,#2f6bff);font:30px Georgia,serif}
h2{font-family:var(--serif,"Noto Serif SC",Georgia,serif);font-size:clamp(22px,3vw,29px);margin:0}
p{color:var(--ink3,#64748b);line-height:1.7;margin:0}
button,a{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:10px 17px;border-radius:10px;font-weight:700;text-decoration:none;cursor:pointer}
button{border:0;background:var(--p,#2f6bff);color:#fff}
a{color:var(--p,#2f6bff);padding-left:0}
</style>
