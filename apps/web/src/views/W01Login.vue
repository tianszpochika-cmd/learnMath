<script setup lang="ts">
import { createNavigationIntentApi, type LegalDocument } from "@learnmath/api-client";
import { ApiError, messageForCode } from "@learnmath/shared";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { isNavigationFailure, useRoute, useRouter } from "vue-router";
import { normalizePhone, smsSubmitDecision } from "../features/auth/loginPolicy";
import { readResumeToken, resolveAfterLogin, resolveResumeTarget } from "../router/guard";
import { getAppHttp, getAuthApi } from "../services/client";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const mode = ref<"login" | "register">("login");
const phone = ref("");
const agreed = ref(false);
const step = ref<"phone" | "code">("phone");
const code = ref("");
const sending = ref(false);
const submitting = ref(false);
const smsAvailable = ref(true);
const cooldownSec = ref(0);
const error = ref("");
const terms = ref<LegalDocument | null>(null);
const privacy = ref<LegalDocument | null>(null);
const legalBusy = ref(false);
const legalError = ref("");
const legalOpen = ref<"terms" | "privacy" | null>(null);
const resumeBusy = ref(false);
const resumeError = ref("");
const resumeTitle = ref("");
let timer: ReturnType<typeof setInterval> | null = null;

const redirect = computed(() => typeof route.query.redirect === "string" ? route.query.redirect : null);
const hasResumeQuery = computed(() => "resumeToken" in route.query);
const legalReady = computed(() => Boolean(terms.value?.body && privacy.value?.body));
const consentVersion = computed(() => terms.value?.version && terms.value.version === privacy.value?.version ? terms.value.version : undefined);
const legalShown = computed(() => legalOpen.value === "terms" ? terms.value : privacy.value);
const canResend = computed(() => cooldownSec.value <= 0);
const resumeNotice = computed(() => resumeError.value || (route.query.resumeError ? "原学习目标暂时无法恢复。你可以搜索资源，或返回官网原页面查看试做内容。" : ""));

async function loadLegal(): Promise<void> {
  legalBusy.value = true;
  legalError.value = "";
  agreed.value = false;
  try {
    const api = getAuthApi().auth;
    const [nextTerms, nextPrivacy] = await Promise.all([api.getLegal("terms"), api.getLegal("privacy")]);
    terms.value = nextTerms;
    privacy.value = nextPrivacy;
    if (!nextTerms || !nextPrivacy) legalError.value = "协议正文尚未发布或暂时无法读取，当前不能继续注册或登录。";
  } catch {
    terms.value = null;
    privacy.value = null;
    legalError.value = "协议正文暂时无法读取，请稍后重试。";
  } finally { legalBusy.value = false; }
}

function changeMode(next: "login" | "register") {
  if (mode.value === next) return;
  mode.value = next;
  step.value = "phone";
  code.value = "";
  error.value = "";
}

function startCooldown() {
  if (timer) clearInterval(timer);
  cooldownSec.value = 60;
  timer = setInterval(() => {
    cooldownSec.value = Math.max(0, cooldownSec.value - 1);
    if (!cooldownSec.value && timer) { clearInterval(timer); timer = null; }
  }, 1000);
}

async function sendCode(): Promise<void> {
  if (sending.value || submitting.value) return;
  error.value = "";
  if (!legalReady.value) { error.value = "请先读取用户协议与隐私政策。"; return; }
  const decision = smsSubmitDecision({
    phoneRaw: phone.value, agreed: agreed.value, cooldownSec: cooldownSec.value,
    channelEnabled: smsAvailable.value
  });
  if (!decision.ok) { error.value = decision.message; return; }
  sending.value = true;
  try {
    await getAuthApi().auth.sendSmsCode(normalizePhone(phone.value), mode.value);
    step.value = "code";
    startCooldown();
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 3200) smsAvailable.value = false;
    error.value = cause instanceof ApiError ? cause.message : messageForCode(5004);
  } finally { sending.value = false; }
}

async function showResumeProblem(message: string, reason: string) {
  resumeError.value = message;
  await router.replace({ name: "login", query: { resumeError: reason } });
}

async function redeemAndNavigate(): Promise<void> {
  if (resumeBusy.value) return;
  const token = readResumeToken(route.query.resumeToken);
  if (!token) {
    await showResumeProblem("继续学习链接无效，请返回官网重新选择资源。", "invalid");
    return;
  }
  resumeBusy.value = true;
  try {
    const intent = createNavigationIntentApi(getAppHttp());
    const redeemed = await intent.redeem(token);
    resumeTitle.value = redeemed.title || "";
    const destination = resolveResumeTarget(redeemed.target);
    if (!destination || !router.resolve(destination).matched.length) {
      await showResumeProblem("目标已绑定到当前账号，但学习 Web 暂无可安全打开的对应页面；请从资源搜索继续。", "unsupported");
      return;
    }
    const navigation = await router.replace(destination);
    if (isNavigationFailure(navigation)) {
      await showResumeProblem("目标导航未完成，请从资源搜索重新进入。", "navigation");
      return;
    }
    // Only confirm consumption after a successful local navigation. The
    // server keeps read/redeem idempotent, so a failed confirmation is retryable.
    try { await intent.consume(redeemed.resumeId); } catch { /* 不伪报消费成功 */ }
  } catch (cause) {
    const expired = cause instanceof ApiError && cause.code === 3012;
    await showResumeProblem(expired
      ? "继续学习链接已过期，或目标已下架。原试做输入不会在这里自动提交。"
      : "暂时无法恢复学习目标，请稍后从官网重新进入。", expired ? "expired" : "unavailable");
  } finally { resumeBusy.value = false; }
}

async function submitCode(): Promise<void> {
  if (submitting.value) return;
  error.value = "";
  if (!/^\d{6}$/.test(code.value)) { error.value = "请输入 6 位数字验证码。"; return; }
  if (!agreed.value || !legalReady.value) { error.value = "请先阅读并同意当前用户协议与隐私政策。"; step.value = "phone"; return; }
  submitting.value = true;
  try {
    const payload = { phone: normalizePhone(phone.value), smsCode: code.value, ...(consentVersion.value ? { consentVersion: consentVersion.value } : {}) };
    const api = getAuthApi().auth;
    const result = mode.value === "login" ? await api.loginBySms(payload) : await api.registerByPhone(payload);
    auth.setSession({ accessToken: result.accessToken, refreshToken: result.refreshToken, userId: result.userId });
    if (hasResumeQuery.value) await redeemAndNavigate();
    else await router.replace(resolveAfterLogin(redirect.value));
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 2007) {
      step.value = "phone";
      await loadLegal();
    }
    error.value = cause instanceof ApiError ? cause.message : cause instanceof Error ? cause.message : messageForCode(5004);
  } finally { submitting.value = false; }
}

onMounted(async () => {
  if (auth.isAuthenticated) {
    if (hasResumeQuery.value) await redeemAndNavigate();
  } else await loadLegal();
});
onBeforeUnmount(() => { if (timer) clearInterval(timer); });
</script>

<template>
  <div class="login">
    <aside class="hero">
      <div class="logo"><i>π</i>数源 MathOrigin</div>
      <h1>每一步，<br />都讲清楚为什么</h1>
      <p>同一知识体系，六条到达路径。登录后可以继续你从官网选定的学习目标。</p>
      <div class="tags"><span>深钻五玩</span><span>全屏图谱</span><span>作答考试布局</span></div>
    </aside>

    <section class="panel">
      <div class="box">
        <div v-if="hasResumeQuery" class="resume">登录后继续官网选定的内容；目标仍需由服务端校验。</div>
        <div v-if="resumeBusy" class="resume" role="status">正在核验并打开学习目标…</div>
        <div v-if="resumeNotice" class="resume resume-warning" role="alert">
          <strong>{{ resumeTitle || "学习目标暂不可用" }}</strong><p>{{ resumeNotice }}</p>
          <p>若原官网标签页仍在，试做输入可返回原页查看或复制；这里不会自动提交答案。</p>
          <div class="resume-links"><RouterLink to="/search">搜索学习资源</RouterLink><RouterLink to="/">进入学习首页</RouterLink></div>
        </div>

        <template v-if="!auth.isAuthenticated">
          <div class="mode-tabs" role="tablist" aria-label="账号方式">
            <button type="button" role="tab" :aria-selected="mode === 'login'" @click="changeMode('login')">短信登录</button>
            <button type="button" role="tab" :aria-selected="mode === 'register'" @click="changeMode('register')">手机注册</button>
          </div>
          <h2>{{ step === "phone" ? (mode === "login" ? "欢迎回来" : "创建学习账号") : "输入验证码" }}</h2>
          <p class="mut">{{ step === 'phone' ? '使用真实短信验证码继续' : '验证码仅用于本次' + (mode === 'login' ? '登录' : '注册') }}</p>

          <template v-if="step === 'phone'">
            <label class="field"><b>+86</b><input v-model="phone" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="手机号" aria-label="手机号" /></label>
            <div class="legal-access">
              <button type="button" @click="legalOpen = legalOpen === 'terms' ? null : 'terms'">查看用户协议</button>
              <button type="button" @click="legalOpen = legalOpen === 'privacy' ? null : 'privacy'">查看隐私政策</button>
            </div>
            <section v-if="legalOpen && legalShown" class="legal-reader" :aria-label="legalShown.title">
              <h3>{{ legalShown.title }}</h3><small v-if="legalShown.version">版本 {{ legalShown.version }}</small>
              <pre>{{ legalShown.body }}</pre>
            </section>
            <p v-if="legalBusy" class="mut" role="status">正在读取当前协议…</p>
            <p v-if="legalError" class="err" role="alert">{{ legalError }} <button type="button" class="inline-retry" @click="loadLegal">重试</button></p>
            <label class="consent"><input v-model="agreed" type="checkbox" :disabled="!legalReady" /><span>我已阅读并同意当前《用户协议》与《隐私政策》</span></label>
            <button type="button" class="btn block" :disabled="sending || !smsAvailable || !legalReady" @click="sendCode">{{ sending ? "发送中…" : "获取验证码" }}</button>
            <p v-if="!smsAvailable" class="err">短信渠道尚未配置，请稍后再试。</p>
          </template>

          <template v-else>
            <label class="field"><input v-model="code" type="text" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="6 位验证码" aria-label="6 位短信验证码" /></label>
            <button type="button" class="btn block" :disabled="submitting" @click="submitCode">{{ submitting ? "验证中…" : (mode === 'login' ? '登录并继续' : '注册并继续') }}</button>
            <button type="button" class="link" :disabled="!canResend || sending" @click="sendCode">{{ canResend ? "重新发送" : `${cooldownSec}s 后可重发` }}</button>
            <button type="button" class="link" @click="step = 'phone'">修改手机号或协议选择</button>
          </template>
          <p v-if="error" class="err" role="alert">{{ error }}</p>
          <p class="mut foot">数源 MathOrigin · 学习从理解开始</p>
        </template>
        <template v-else-if="!resumeBusy && !resumeNotice"><p class="mut">已登录，正在准备学习入口…</p></template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login {
  min-height: calc(100vh - var(--nav-h));
  display: grid;
  grid-template-columns: 1.15fr 1fr;
}
.hero {
  background: linear-gradient(150deg, #0b1220, #1e293b);
  color: #e5e7eb;
  padding: 70px 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.hero .logo {
  display: flex;
  gap: 9px;
  align-items: center;
  font-weight: 800;
  color: #fff;
  font-size: 17px;
}
.hero .logo i {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: var(--grad);
  display: grid;
  place-items: center;
  font-style: italic;
}
.hero h1 {
  color: #fff;
  font-size: 40px;
  line-height: 1.25;
  margin-top: 26px;
}
.hero p {
  color: #94a3b8;
  margin-top: 14px;
  max-width: 420px;
  line-height: 1.9;
}
.tags {
  display: flex;
  gap: 9px;
  margin-top: 26px;
  flex-wrap: wrap;
}
.tags span {
  font-size: 12px;
  background: rgba(47, 107, 255, 0.25);
  color: #9bb4ff;
  border-radius: 6px;
  padding: 3px 9px;
  font-weight: 700;
}
.panel {
  background: #fff;
  display: grid;
  place-items: center;
  padding: 32px 16px;
}
.box {
  width: min(420px, 100%);
}
.resume {
  background: var(--brand-soft);
  color: var(--brand-deep);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13.5px;
  font-weight: 600;
  margin-bottom: 16px;
}
.resume p { margin: 7px 0 0; line-height: 1.6; }
.resume-warning { background: #fff7ed; color: #854d0e; }
.resume-links { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 11px; }
.resume-links a { color: var(--brand-deep); text-decoration: underline; }
.mode-tabs { display: flex; gap: 6px; margin-bottom: 22px; border-bottom: 1px solid var(--line); }
.mode-tabs button { flex: 1; padding: 11px; border: 0; border-bottom: 3px solid transparent; background: transparent; color: var(--ink3); font-weight: 700; cursor: pointer; }
.mode-tabs button[aria-selected="true"] { border-bottom-color: var(--brand); color: var(--brand-deep); }
.legal-access { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 15px; }
.legal-access button, .inline-retry { border: 0; padding: 0; background: transparent; color: var(--brand-deep); text-decoration: underline; cursor: pointer; }
.legal-reader { margin-top: 10px; padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: #f8fafc; }
.legal-reader h3 { margin: 0; font-size: 17px; }
.legal-reader small { color: var(--ink3); }
.legal-reader pre { max-height: 230px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: 12px; line-height: 1.65; color: var(--ink2); }
.box h2 {
  font-size: 26px;
}
.mut {
  color: var(--ink3);
  font-size: 13.5px;
  margin-top: 8px;
}
.field {
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1.5px solid var(--line);
  border-radius: 12px;
  padding: 4px 14px;
  margin-top: 18px;
  background: #fff;
}
.field:focus-within {
  border-color: var(--brand);
}
.field input {
  border: none;
  outline: none;
  font-size: 17px;
  flex: 1;
  height: 44px;
  letter-spacing: 0.5px;
}
.consent {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  font-size: 12.5px;
  color: var(--ink2);
  margin: 14px 2px;
  cursor: pointer;
}
.consent input {
  margin-top: 3px;
  width: 16px;
  height: 16px;
  accent-color: var(--brand);
}
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 46px;
  border: none;
  border-radius: 12px;
  background: var(--grad);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  margin-top: 6px;
}
.btn:disabled {
  opacity: 0.5;
}
.sep {
  text-align: center;
  color: var(--ink3);
  font-size: 13px;
  margin: 18px 0 10px;
}
.more {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.rowbtn {
  border: 1px solid var(--line);
  background: #fff;
  border-radius: 11px;
  height: 44px;
  font-size: 14.5px;
  cursor: pointer;
  color: var(--ink2);
}
.rowbtn:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.center {
  text-align: center;
}
.link {
  display: block;
  margin: 12px auto 0;
  background: none;
  border: none;
  color: var(--brand);
  font-size: 13.5px;
  cursor: pointer;
}
.link:disabled {
  color: var(--ink3);
}
.err {
  color: var(--bad);
  font-size: 13.5px;
  margin-top: 12px;
}
.foot {
  text-align: center;
  margin-top: 28px;
}
@media (max-width: 960px) {
  .login {
    grid-template-columns: 1fr;
  }
  .hero {
    display: none;
  }
}
</style>
