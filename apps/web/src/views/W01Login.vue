<script setup lang="ts">
import { ApiError, messageForCode } from "@learnmath/shared";
import { computed, onBeforeUnmount, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ALL_CHANNELS_ON,
  availableChannels,
  assessmentPromptPlacement,
  continueLearningHint,
  loginSuccessRoute,
  normalizePhone,
  primaryChannel,
  smsSubmitDecision,
} from "../features/auth/loginPolicy";
import { getAuthApi } from "../services/client";
import { useAuthStore } from "../stores/auth";

/** W01 登录/注册（16W01 · M2 验证码为主 · 策略在 loginPolicy.ts 纯函数单测）。 */
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const channels = ALL_CHANNELS_ON; // 生产由 config 注入；未配渠道自动隐藏（降级）
const visible = availableChannels(channels);
const primary = primaryChannel(channels);

const phone = ref("138 8888 8888");
const agreed = ref(false);
const step = ref<"phone" | "code">("phone");
const code = ref("");
const sending = ref(false);
const cooldownSec = ref(0);
const error = ref("");
const moreOpen = ref(false);
const needAssessment = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

const redirect = computed(() => (typeof route.query.redirect === "string" ? route.query.redirect : null));
const continueHint = computed(() => (redirect.value && assessmentPromptPlacement(redirect.value) === "banner" ? continueLearningHint((route.query.title as string) || null) : ""));
const canResend = computed(() => cooldownSec.value <= 0);

async function sendCode(): Promise<void> {
  error.value = "";
  const decision = smsSubmitDecision({
    phoneRaw: phone.value,
    agreed: agreed.value,
    cooldownSec: cooldownSec.value,
    channelEnabled: visible.includes(primary ?? "sms"),
  });
  if (!decision.ok) {
    error.value = decision.message;
    return;
  }
  sending.value = true;
  try {
    await getAuthApi().auth.sendSmsCode(normalizePhone(phone.value));
    step.value = "code";
    cooldownSec.value = 60;
    timer = setInterval(() => {
      cooldownSec.value -= 1;
      if (cooldownSec.value <= 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    }, 1000);
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : messageForCode(5000);
  } finally {
    sending.value = false;
  }
}

async function login(): Promise<void> {
  error.value = "";
  if (code.value.length !== 6) {
    error.value = "请输入 6 位验证码";
    return;
  }
  try {
    const res = await getAuthApi().auth.loginBySms({
      phone: normalizePhone(phone.value),
      smsCode: code.value,
    });
    auth.setSession({ accessToken: res.accessToken, refreshToken: res.refreshToken, userId: res.userId });
    needAssessment.value = res.needAssessment;
    // BR-09：有目标先回资源（测评仅 banner 非阻塞）；落地经防开放重定向兜底
    void router.replace(loginSuccessRoute(redirect.value));
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : messageForCode(5000);
  }
}

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div class="login">
    <aside class="hero">
      <div class="logo"><i>π</i>数源 MathOrigin</div>
      <h1>每一步，<br />都讲清楚为什么</h1>
      <p>同一知识体系，六条到达路径 —— 大屏是深度学习的主场。</p>
      <div class="tags">
        <span>深钻五玩</span><span>全屏图谱</span><span>作答考试布局</span>
      </div>
    </aside>

    <section class="panel">
      <div class="box">
        <div v-if="continueHint" class="resume">{{ continueHint }}</div>
        <h2>{{ step === "phone" ? "欢迎回来" : "输入验证码" }}</h2>
        <p class="mut" v-if="step === 'phone'">
          {{ primary === "sms" ? "手机号验证码登录" : "当前主渠道：" + primary }}
        </p>

        <template v-if="step === 'phone'">
          <div class="field"><b>+86</b><input v-model="phone" placeholder="手机号" /></div>
          <label class="consent">
            <input v-model="agreed" type="checkbox" />
            <span>我已阅读并同意《用户协议》《隐私政策》（协议版本更新需重新确认）</span>
          </label>
          <button class="btn block" :disabled="sending" @click="sendCode">
            {{ sending ? "发送中…" : "获取验证码" }}
          </button>

          <div class="sep">更多方式</div>
          <div class="more">
            <template v-for="c in visible" :key="c">
              <button v-if="c !== 'sms'" class="rowbtn" @click="error = ''">
                {{ c === "wechat" ? "✆ 微信一键登录" : c === "email" ? "✉ 邮箱登录 / 注册" : "🔑 账号密码登录" }}
              </button>
            </template>
            <p v-if="!moreOpen" class="mut center">未配置的渠道自动隐藏（3200）</p>
          </div>
        </template>

        <template v-else>
          <div class="field"><input v-model="code" maxlength="6" inputmode="numeric" placeholder="6 位验证码" /></div>
          <button class="btn block" @click="login">登录</button>
          <button class="link" :disabled="!canResend" @click="sendCode">
            {{ canResend ? "重新发送" : `${cooldownSec}s 后可重发` }}
          </button>
        </template>

        <p v-if="error" class="err">{{ error }}</p>
        <p class="mut foot">京ICP备XXXXXXXX号 · 数源 MathOrigin</p>
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
}
.box {
  width: 360px;
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
