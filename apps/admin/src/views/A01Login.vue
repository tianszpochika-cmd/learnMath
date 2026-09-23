<script setup lang="ts">
import { ref } from "vue";
import { ApiError } from "@learnmath/shared";
import { useRoute, useRouter } from "vue-router";
import { loginAdmin } from "../services/client";

const route = useRoute();
const router = useRouter();
const account = ref("");
const password = ref("");
const busy = ref(false);
const error = ref("");
const reveal = ref(false);

async function submit() {
  if (busy.value) return;
  error.value = "";
  busy.value = true;
  try {
    await loginAdmin(account.value, password.value);
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/dashboard";
    await router.replace(redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/dashboard");
  } catch (cause) {
    error.value = cause instanceof ApiError && cause.code === 2005
      ? "账号已由管理服务锁定，请稍后再试或联系管理员。"
      : cause instanceof Error ? cause.message : "管理登录未获服务端确认，请重试。";
  } finally { busy.value = false; }
}
</script>

<template>
  <main class="login">
    <section class="brand-panel">
      <div class="brand"><span class="mark">π</span><span>数源 MathOrigin <small>管理工作台</small></span></div>
      <div class="brand-copy"><p class="eyebrow">CONTENT OPERATIONS · 内容生产</p><h1>让每一条知识链，<br>都有可追溯的来处。</h1><p>从知识点和题目，到课程、图谱与推理链；在发布前看清校验结果，分辨工作稿与学员正在使用的版本。</p><div class="pills"><span>图谱边校验</span><span>路径编排</span><span>推理链精修</span></div></div>
      <div class="ghost-math" aria-hidden="true">∑</div>
    </section>
    <section class="form-panel">
      <form class="login-card" @submit.prevent="submit">
        <p class="ops-eyebrow">ADMIN DESK · 管理身份</p>
        <h2>进入管理工作台</h2>
        <p class="hint">请输入管理账号。登录、锁定和操作权限由管理服务确认。</p>
        <p v-if="route.query.logout === 'local'" class="ops-state warning" role="status">本机登录已退出；服务端令牌吊销未获确认。</p>
        <label class="ops-field"><span>管理员账号</span><input v-model="account" autocomplete="username" required placeholder="手机号、邮箱或账号" /></label>
        <label class="ops-field"><span>密码</span><span class="password"><input v-model="password" :type="reveal ? 'text' : 'password'" autocomplete="current-password" required placeholder="输入密码" /><button type="button" @click="reveal = !reveal">{{ reveal ? "隐藏" : "显示" }}</button></span></label>
        <p v-if="error" class="ops-state error" role="alert">{{ error }}</p>
        <button class="ops-btn submit" type="submit" :disabled="busy || !account.trim() || !password">{{ busy ? "正在验证…" : "登录管理工作台 →" }}</button>
        <p class="foot">连续失败后的账号锁定、令牌和权限判断以服务端结果为准。</p>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login{display:grid;grid-template-columns:minmax(360px,1.03fr) minmax(380px,.97fr);min-height:100vh;background:var(--bg-page)}.brand-panel{position:relative;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;padding:42px clamp(32px,5vw,86px);background:linear-gradient(150deg,#182e6b,#2945a0 55%,#5b51ad);color:#fff}.brand{position:relative;z-index:1;display:flex;align-items:center;gap:12px;font-weight:850;font-size:18px}.brand small{display:block;font-size:11px;letter-spacing:.13em;color:#c2d2ff}.mark{display:grid;place-items:center;width:42px;height:42px;border:1px solid #ffffff61;border-radius:11px;background:#ffffff1d;font:italic 800 25px Georgia,serif}.brand-copy{position:relative;z-index:1;max-width:600px;margin:auto 0}.eyebrow{color:#bcd0ff;font-size:11px;font-weight:850;letter-spacing:.17em}.brand-copy h1{margin:17px 0 20px;font-size:clamp(38px,4.4vw,64px);line-height:1.2;letter-spacing:-.025em}.brand-copy>p:not(.eyebrow){max-width:560px;line-height:1.9;color:#e1e9ff}.pills{display:flex;gap:9px;flex-wrap:wrap;margin-top:30px}.pills span{padding:7px 11px;border:1px solid #ffffff5e;border-radius:99px;background:#ffffff16;font-size:12px}.ghost-math{position:absolute;right:-15px;bottom:-160px;color:#ffffff14;font:700 460px Georgia,serif;pointer-events:none}.form-panel{display:grid;place-items:center;padding:28px}.login-card{width:min(100%,440px);padding:34px;border:1px solid var(--line);border-radius:18px;background:var(--ops-card);box-shadow:0 30px 60px -50px #0613358c}.login-card h2{font-size:30px;line-height:1.3;margin:7px 0}.hint,.foot{color:var(--ink2);line-height:1.7}.hint{margin:0 0 26px}.login-card .ops-field{margin:18px 0}.password{position:relative}.password button{position:absolute;right:7px;top:5px;padding:7px 9px;border:0;border-radius:6px;background:transparent;color:var(--brand-deep)}.password input{padding-right:62px}.submit{width:100%;min-height:46px;margin-top:10px}.foot{margin-top:19px;font-size:12px}.ops-state{margin-top:15px}
@media(max-width:850px){.login{grid-template-columns:1fr}.brand-panel{min-height:320px;padding:26px}.brand-copy{margin:38px 0 0}.brand-copy h1{font-size:36px}.ghost-math{font-size:300px;bottom:-110px}.form-panel{padding:26px 18px}.login-card{padding:24px}}
</style>
