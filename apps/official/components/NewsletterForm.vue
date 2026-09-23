<script setup lang="ts">
const emailId = useId();
const email = ref("");
const state = ref<"idle" | "submitting" | "done" | "error">("idle");
const message = ref("");

async function subscribe() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    state.value = "error";
    message.value = "请输入有效的邮箱地址。";
    return;
  }
  state.value = "submitting";
  message.value = "";
  try {
    const result = await $fetch<{ code: number; message?: string }>("/api/public/newsletter/subscribe", {
      method: "POST",
      body: { email: email.value.trim().toLowerCase() }
    });
    if (result.code !== 0) throw new Error(result.message || "订阅未完成");
    state.value = "done";
    message.value = "订阅已提交。请留意收件箱中的周报与退订入口。";
  } catch {
    state.value = "error";
    message.value = "暂时无法确认订阅结果。请稍后重试；重复提交会由服务端按邮箱处理。";
  }
}
</script>

<template>
  <form class="newsletter-form" @submit.prevent="subscribe">
    <label class="sr-only" :for="emailId">电子邮箱</label>
    <input :id="emailId" v-model="email" type="email" autocomplete="email" placeholder="你的邮箱地址" :disabled="state === 'done'" />
    <button class="button primary" type="submit" :disabled="state === 'submitting' || state === 'done'">
      {{ state === "submitting" ? "提交中…" : state === "done" ? "已订阅" : "订阅周报" }}
    </button>
    <p v-if="message" class="form-message" :class="state" role="status">{{ message }}</p>
  </form>
</template>
