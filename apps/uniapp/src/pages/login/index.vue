<script setup lang="ts">
import type { LegalDocument } from "@learnmath/api-client";
import { ApiError } from "@learnmath/shared";
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import MSheet from "../../components/MSheet.vue";
import { getResumeToken, normalizePhone, setPendingSms, validMainlandPhone, type SmsMode } from "../../features/entryFlow";
import { ensureMobileSession, getMobileAuth } from "../../services/mobileClient";

const phone = ref("");
const mode = ref<SmsMode>("login");
const agreed = ref(false);
const legal = ref<{ terms: LegalDocument | null; privacy: LegalDocument | null }>({ terms: null, privacy: null });
const legalLoading = ref(false);
const legalError = ref("");
const sheet = ref<"terms" | "privacy" | null>(null);
const sending = ref(false);
const smsAvailable = ref(true);
const error = ref("");
const legalReady = computed(() => Boolean(legal.value.terms?.body && legal.value.privacy?.body));
const selectedLegal = computed(() => sheet.value ? legal.value[sheet.value] : null);
const consentVersion = computed(() => legal.value.terms?.version && legal.value.terms.version === legal.value.privacy?.version ? legal.value.terms.version : undefined);
const canSend = computed(() => !sending.value && smsAvailable.value && legalReady.value && agreed.value && validMainlandPhone(phone.value));
const message = (cause: unknown) => cause instanceof Error ? cause.message : "网络暂不可用，请稍后重试。";

async function loadLegal(): Promise<void> {
  legalLoading.value = true; legalError.value = ""; agreed.value = false;
  try {
    const auth = getMobileAuth();
    const [terms, privacy] = await Promise.all([auth.getLegal("terms"), auth.getLegal("privacy")]);
    legal.value = { terms, privacy };
    if (!terms || !privacy) legalError.value = "协议正文尚未发布或暂时无法读取，请稍后重试。";
  } catch (cause) { legal.value = { terms: null, privacy: null }; legalError.value = message(cause); }
  finally { legalLoading.value = false; }
}
async function sendCode(): Promise<void> {
  error.value = "";
  if (!canSend.value) { error.value = "请输入有效手机号，并阅读同意当前用户协议与隐私政策。"; return; }
  sending.value = true;
  try {
    const normalized = normalizePhone(phone.value);
    await getMobileAuth().sendSmsCode(normalized, mode.value);
    setPendingSms({ phone: normalized, mode: mode.value, consentVersion: consentVersion.value, sentAt: Date.now() });
    uni.navigateTo({ url: "/pages/verify/index" });
  } catch (cause) {
    if (cause instanceof ApiError && cause.code === 3200) smsAvailable.value = false;
    error.value = message(cause);
  } finally { sending.value = false; }
}
onLoad(() => {
  void (async () => {
    if (await ensureMobileSession()) { uni.switchTab({ url: "/pages/home/index" }); return; }
    await loadLegal();
  })();
});
</script>
<template>
  <view class="mobile-page login-page">
    <view class="brand"><view class="mark">π</view><text>数源 MathOrigin</text></view>
    <view class="intro"><text class="eyebrow">WELCOME BACK</text><text class="headline">从这里，继续<br/>想明白每一步</text><text class="sub">手机号验证码登录 · 每次学习都有去处</text></view>
    <view v-if="getResumeToken()" class="m-state resume">登录后将先尝试恢复原学习目标。原试做输入不会自动提交。</view>
    <view class="form m-card">
      <view class="mode"><button :class="{ active: mode === 'login' }" @click="mode = 'login'">验证码登录</button><button :class="{ active: mode === 'register' }" @click="mode = 'register'">手机号注册</button></view>
      <text class="m-field-label">手机号</text><view class="phone-field"><text>+86</text><view class="line"/><input v-model="phone" type="number" maxlength="11" placeholder="请输入 11 位手机号" /></view>
      <view class="consent"><checkbox-group @change="agreed = !agreed"><label><checkbox :checked="agreed" color="#2F6BFF" :disabled="!legalReady" /><text>我已阅读并同意</text></label></checkbox-group><button @click="sheet = 'terms'">《用户协议》</button><text>与</text><button @click="sheet = 'privacy'">《隐私政策》</button></view>
      <view v-if="legalLoading" class="m-state">正在读取当前协议…</view><view v-if="legalError" class="m-state error">{{ legalError }} <button class="retry" @click="loadLegal">重试</button></view>
      <button class="m-button send" :disabled="!canSend" @click="sendCode">{{ sending ? '正在发送…' : mode === 'register' ? '获取注册验证码' : '获取登录验证码' }}</button>
      <view v-if="error" class="m-state error">{{ error }}</view>
      <text class="alternate">目前仅提供已接通的短信验证码方式</text>
    </view>
    <text class="foot">数之源 · 每一步都讲清楚为什么</text>
    <MSheet :model-value="sheet !== null" :title="selectedLegal?.title || '协议正文'" height="expanded" @update:model-value="sheet = null">
      <view v-if="selectedLegal" class="legal-text"><text class="version">版本：{{ selectedLegal.version || '以正文为准' }}</text><text>{{ selectedLegal.body }}</text></view>
      <view v-else class="m-state error">协议暂不可读取。请关闭后重试。</view>
      <template #footer><button class="m-button secondary" @click="sheet = null">我已阅读</button></template>
    </MSheet>
  </view>
</template>
<style scoped>
.login-page{min-height:100vh;padding:calc(48rpx + env(safe-area-inset-top)) 36rpx calc(42rpx + env(safe-area-inset-bottom));background:radial-gradient(circle at 82% 8%,#dbe5ff 0,transparent 35%),#f6f8fc}.brand{display:flex;align-items:center;gap:13rpx;color:#1e3150;font-size:25rpx;font-weight:850}.mark{display:grid;place-items:center;width:55rpx;height:55rpx;border-radius:16rpx;background:linear-gradient(135deg,#4f7bff,#8b5cf6);color:#fff;font:italic 39rpx Georgia,serif}.intro{margin:90rpx 0 50rpx}.headline{display:block;font-size:55rpx;line-height:1.2;font-weight:850;letter-spacing:-2rpx}.sub{display:block;margin-top:19rpx;color:#64748b;font-size:26rpx}.resume{margin-bottom:22rpx;background:#edf3ff;color:#234b96}.form{padding:31rpx}.mode{display:flex;gap:8rpx;margin-bottom:16rpx;padding:5rpx;border-radius:19rpx;background:#eef2f8}.mode button{flex:1;min-height:72rpx;background:transparent;color:#66758b;font-size:25rpx}.mode button.active{border-radius:15rpx;background:#fff;color:#1e4fd6;font-weight:800;box-shadow:0 7rpx 16rpx #1b4e9b15}.phone-field{display:flex;align-items:center;min-height:94rpx;padding:0 20rpx;border:1rpx solid #d9e3f2;border-radius:20rpx;background:#fff}.phone-field text{font-weight:700}.phone-field .line{width:1rpx;height:32rpx;margin:0 18rpx;background:#d9e3f2}.phone-field input{flex:1;min-width:0;height:86rpx;font-size:30rpx}.consent{display:flex;align-items:center;flex-wrap:wrap;gap:3rpx;margin:25rpx 0 18rpx;color:#52647d;font-size:22rpx}.consent label{display:flex;align-items:center;gap:4rpx}.consent checkbox{transform:scale(.75)}.consent button{min-height:60rpx;padding:0 1rpx;background:transparent;color:#1e4fd6;font-size:22rpx}.send{margin-top:22rpx}.form .m-state{margin-top:18rpx}.retry{display:inline;background:transparent;color:#9e2d44;text-decoration:underline;font-size:23rpx}.alternate{display:block;margin:30rpx 0 5rpx;text-align:center;color:#8190a5;font-size:22rpx}.foot{display:block;margin-top:80rpx;text-align:center;color:#8b98aa;font-size:21rpx}.legal-text{display:flex;flex-direction:column;gap:18rpx;color:#263a56;font-size:26rpx;line-height:1.8;white-space:pre-wrap}.legal-text .version{color:#74849b;font-size:22rpx}
</style>
