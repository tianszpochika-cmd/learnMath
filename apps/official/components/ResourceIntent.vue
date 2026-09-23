<script setup lang="ts">
import type { IntentPayload } from "~/utils/publicPolicy";

const props = defineProps<{ targetType: IntentPayload["targetType"]; slug?: string; targetId?: string; action?: IntentPayload["action"]; from: string; label?: string }>();
const busy = ref(false);
const error = ref("");
const config = useRuntimeConfig();

async function continueLearning() {
  const target = props.targetId || props.slug || "";
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(target) || busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await $fetch<{ code: number; data?: { resumeToken?: string }; message?: string }>("/api/public/navigation/intents", {
      method: "POST",
      body: { targetType: props.targetType, ...(props.targetId ? { targetId: props.targetId } : { slug: props.slug }), action: props.action || "read", from: props.from }
    });
    const token = result.code === 0 ? result.data?.resumeToken : "";
    if (!token) throw new Error(result.message || "暂时无法保存继续学习目标");
    const webBase = String(config.public.webBase || "").replace(/\/$/, "");
    await navigateTo(webBase + "/login?resumeToken=" + encodeURIComponent(token), { external: true });
  } catch {
    error.value = "目标暂时无法保存。请稍后重试；当前页面仍可继续阅读。";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="resource-intent">
    <div>
      <p class="resource-intent-kicker">从公开阅读走向亲手练习</p>
      <h2>继续学这个主题</h2>
      <p>登录后由学习端核验目标是否仍可用；这个公开页面不会创建成绩。</p>
    </div>
    <button type="button" :disabled="busy || (!slug && !targetId)" @click="continueLearning">
      {{ busy ? "正在保存目标…" : (label || "打开学习端") }} <span aria-hidden="true">↗</span>
    </button>
    <p v-if="error" class="resource-intent-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.resource-intent{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px;margin-top:44px;padding:30px;border-radius:23px;border:1px solid #b9c7ec;background:linear-gradient(120deg,#edf3ff,#f8f6ff)}
.resource-intent-kicker{color:#3154ae;font-size:11px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;margin:0 0 7px}
h2{font:700 clamp(23px,3vw,31px)/1.3 var(--serif,"Noto Serif SC",Georgia,serif);margin:0 0 9px;color:#172747}
p{margin:0;color:#52627a;line-height:1.6}
button{min-height:48px;border:0;border-radius:12px;padding:12px 20px;color:#fff;background:#2f6bff;font-weight:800;cursor:pointer}
button:disabled{opacity:.65;cursor:wait}
.resource-intent-error{flex-basis:100%;color:#a63232}
:global(:root[data-theme="dark"]) .resource-intent{border-color:#394a6e;background:linear-gradient(120deg,#162546,#261e41)}
:global(:root[data-theme="dark"]) .resource-intent-kicker{color:#9eb8ff}
:global(:root[data-theme="dark"]) .resource-intent h2{color:#f8faff}
:global(:root[data-theme="dark"]) .resource-intent p{color:#c9d4ea}
:global(:root[data-theme="dark"]) .resource-intent .resource-intent-error{color:#ffb7b7}
</style>
