<script setup lang="ts">
const route = useRoute();
const slug = String(route.params.slug || "");
if (!/^[a-zA-Z0-9-]{1,100}$/.test(slug)) throw createError({ statusCode: 404, statusMessage: "活动不存在" });
const canSaveIntent = /^[a-zA-Z0-9-]{1,80}$/.test(slug);
definePageMeta({ key: (route) => route.fullPath });
</script>
<template>
  <ArticleDetail :slug="slug" :type="8" base="/events" eyebrow="EVENTS · 活动详情" fallback-title="活动">
    <template #after="{ present }">
      <ResourceIntent v-if="present && canSaveIntent" target-type="event" :slug="slug" action="read"
        :from="'events/' + slug" label="去学习端查看并确认规则" />
      <p v-else-if="present" class="event-intent-note">此活动暂未配置可恢复的学习端目标，请先阅读公开规则。</p>
    </template>
  </ArticleDetail>
</template>
<style scoped>.event-intent-note{margin-top:35px;padding:17px;border:1px solid var(--line);border-radius:12px;color:var(--ink3)}</style>
