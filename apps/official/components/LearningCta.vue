<script setup lang="ts">
import type { IntentPayload } from "../utils/publicPolicy";

const props = withDefaults(defineProps<{
  label?: string;
  from: string;
  targetType?: IntentPayload["targetType"];
  slug?: string;
  action?: IntentPayload["action"];
  subtle?: boolean;
}>(), { label: "开始学习", action: "read", subtle: false });

const config = useRuntimeConfig();
const busy = ref(false);
const error = ref("");

function loginUrl(token?: string): string {
  const url = new URL("/login", String(config.public.webBase));
  url.searchParams.set("from", props.from);
  if (token) url.searchParams.set("resumeToken", token);
  return url.toString();
}

async function continueLearning() {
  error.value = "";
  if (!props.targetType || !props.slug) {
    await navigateTo(loginUrl(), { external: true });
    return;
  }
  busy.value = true;
  try {
    const response = await $fetch<{ code: number; data?: { resumeToken?: string } }>("/api/public/navigation/intents", {
      method: "POST",
      body: { targetType: props.targetType, slug: props.slug, action: props.action, from: props.from }
    });
    if (response.code !== 0 || !response.data?.resumeToken) throw new Error("目标未创建");
    await navigateTo(loginUrl(response.data.resumeToken), { external: true });
  } catch {
    error.value = "暂时无法保留这个学习目标。你可以稍后再试，或先进入学习端登录。";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="learning-cta">
    <button type="button" class="button" :class="subtle ? 'subtle' : 'primary'" :disabled="busy" @click="continueLearning">
      {{ busy ? "正在准备学习入口…" : label }}
    </button>
    <div v-if="error" class="inline-message warning" role="status">
      {{ error }}
      <a :href="loginUrl()" class="text-link">直接前往登录</a>
    </div>
  </div>
</template>
