<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import MNavBar from "../../components/MNavBar.vue";
import { clearPendingSms, cooldownSeconds, getPendingSms, getResumeToken, normalizePhone, queueAssessmentInvite, setPendingSms, validSmsCode } from "../../features/entryFlow";
import { getMobileAuth, setMobileSession } from "../../services/mobileClient";

const flow = ref(getPendingSms());
const code = ref("");
const focused = ref(false);
const now = ref(Date.now());
const submitting = ref(false);
const resending = ref(false);
const error = ref("");
const remaining = computed(() => flow.value ? cooldownSeconds(flow.value.sentAt, now.value) : 0);
const maskedPhone = computed(() => flow.value ? flow.value.phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2") : "");
const message = (cause: unknown) => cause instanceof Error ? cause.message : "请求失败，请稍后重试。";
let interval: ReturnType<typeof setInterval> | null = null;
async function resend(): Promise<void> {
  if (!flow.value || remaining.value || resending.value) return;
  resending.value = true; error.value = "";
  try {
    await getMobileAuth().sendSmsCode(flow.value.phone, flow.value.mode);
    flow.value = { ...flow.value, sentAt: Date.now() };
    setPendingSms(flow.value); now.value = Date.now();
  } catch (cause) { error.value = message(cause); }
  finally { resending.value = false; }
}
async function submit(): Promise<void> {
  if (!flow.value || submitting.value) return;
  error.value = "";
  if (!validSmsCode(code.value)) { error.value = "请输入短信中的 6 位数字验证码。"; return; }
  submitting.value = true;
  try {
    const payload = { phone: normalizePhone(flow.value.phone), smsCode: code.value.trim(),
      ...(flow.value.consentVersion ? { consentVersion: flow.value.consentVersion } : {}) };
    const result = flow.value.mode === "register" ? await getMobileAuth().registerByPhone(payload) : await getMobileAuth().loginBySms(payload);
    setMobileSession({ accessToken: result.accessToken, refreshToken: result.refreshToken, userId: result.userId });
    if (!getResumeToken() && (flow.value.mode === "register" || result.needAssessment === true)) queueAssessmentInvite();
    clearPendingSms();
    uni.switchTab({ url: "/pages/home/index" });
  } catch (cause) { error.value = message(cause); }
  finally { submitting.value = false; }
}
onLoad(() => {
  flow.value = getPendingSms();
  if (!flow.value) { uni.redirectTo({ url: "/pages/login/index" }); return; }
  interval = setInterval(() => { now.value = Date.now(); }, 1000);
  focused.value = true;
});
onBeforeUnmount(() => { if (interval) clearInterval(interval); });
</script>
<template>
  <view class="mobile-page verify-page">
    <MNavBar title="验证手机号" back fallback="/pages/home/index" />
    <view class="page-scroll"><text class="eyebrow">SECURE SIGN IN</text><text class="headline">查收短信验证码</text><text class="muted">已发送至 +86 {{ maskedPhone }}。验证码由服务端校验，不会保存在设备上。</text>
      <view class="code-wrap" @click="focused = true"><view v-for="i in 6" :key="i" class="code-cell" :class="{ filled: code[i - 1] }">{{ code[i - 1] || '' }}</view><input v-model="code" type="number" maxlength="6" :focus="focused" class="code-input" @confirm="submit" /></view>
      <button class="resend" :disabled="remaining > 0 || resending" @click="resend">{{ remaining > 0 ? `${remaining}s 后可重发` : resending ? '发送中…' : '重新发送验证码' }}</button>
      <view v-if="error" class="m-state error">{{ error }}</view>
      <button class="m-button" :disabled="!validSmsCode(code) || submitting" @click="submit">{{ submitting ? '核验中…' : flow?.mode === 'register' ? '完成注册' : '登录并继续' }}</button>
      <text class="hint">{{ flow?.mode === 'register' ? '注册成功后可在“我的”设置昵称。' : '验证码错误或过期时可重发；请勿向他人透露验证码。' }}</text>
    </view>
  </view>
</template>
<style scoped>
.verify-page{background:#f6f8fc}.page-scroll{padding-top:90rpx}.headline{display:block;margin:15rpx 0 22rpx;font-size:48rpx;font-weight:850}.code-wrap{position:relative;display:flex;justify-content:space-between;gap:10rpx;margin:62rpx 0 10rpx}.code-cell{display:grid;place-items:center;width:15%;height:94rpx;border:1rpx solid #d7e1f0;border-radius:18rpx;background:#fff;color:#142136;font-size:42rpx;font-weight:800}.code-cell.filled{border-color:#4f7bff;background:#edf3ff}.code-input{position:absolute;inset:0;width:100%;height:94rpx;opacity:.01}.resend{display:block;min-height:88rpx;margin:0 0 32rpx auto;padding:0;background:transparent;color:#1e4fd6;font-size:24rpx}.resend[disabled]{color:#8292aa}.m-state{margin-bottom:24rpx}.hint{display:block;margin-top:27rpx;color:#8090a5;font-size:23rpx;line-height:1.6;text-align:center}
</style>
