<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow, onHide, onUnload } from "@dcloudio/uni-app";
import { isApiError } from "@learnmath/shared";
import MNavBar from "../../../components/MNavBar.vue";
import MSheet from "../../../components/MSheet.vue";
import { currentMobileUserId, ensureMobileSession } from "../../../services/mobileClient";
import { attemptAction, readAttempt } from "../../../services/attemptApi";
import { active, countdown, draftKey, finished, insertMath, kindLabel, mathSymbols, parseDraft, recovery, remainingMs, submitText, writeAllowed, type Attempt, type LocalDraft, type Question } from "../../../features/attempt/attemptModel";

const attemptId=ref(""); const view=ref<Attempt|null>(null); const loading=ref(true); const busy=ref(false); const saving=ref(false);
const error=ref(""); const notice=ref(""); const currentSeq=ref(1); const answer=ref(""); const offline=ref(false); const lastSaved=ref("");
const sheetOpen=ref(false); const sheetSize=ref<"compact"|"expanded">("compact"); const flags=ref<number[]>([]);
const conflict=ref<{local:LocalDraft;server:string;mode:"compare"|"copy-only"}|null>(null);
const elapsed=ref(0); let startClock=0; let tick:ReturnType<typeof setInterval>|undefined; let timer:ReturnType<typeof setTimeout>|undefined;
let saveQueue:Promise<boolean>=Promise.resolve(true); let generation=0;
let expiryQueried=false;
let shownOnce=false;
const item=computed(()=>view.value?.questions.find(q=>q.seq===currentSeq.value)||null);
const remaining=computed(()=>view.value?remainingMs(view.value,elapsed.value):null);
const writable=computed(()=>!!view.value&&!!item.value&&!!currentMobileUserId()&&writeAllowed(view.value,item.value,remaining.value)&&!conflict.value);
const answered=computed(()=>view.value?.questions.filter(q=>q.submitted||!!q.draft).length||0);
const feedback=computed(()=>!!view.value&&!!item.value&&(finished(view.value)||(view.value.feedbackMode==="immediate"&&item.value.submitted)));
function reqId(){ return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function syncActiveMarker(a:Attempt){const user=currentMobileUserId();if(!user)return;const marker=`lm.mobile.activeAttempt:${user}`;try{if(active(a))uni.setStorageSync(marker,{attemptId:attemptId.value,assistancePolicy:a.assistancePolicy,feedbackMode:a.feedbackMode,capabilities:a.capabilities,state:a.state});else {const prior=uni.getStorageSync(marker) as {attemptId?:string}|null;if(prior?.attemptId===attemptId.value)uni.removeStorageSync(marker);}}catch{/* marker only controls UI; service policy is authoritative */}}
function key(seq:number){ const user=currentMobileUserId(); return user?draftKey(user,attemptId.value,seq):""; }
function local(seq:number):LocalDraft|null { try { const k=key(seq); return k?parseDraft(uni.getStorageSync(k)):null; } catch { return null; } }
function storeLocal(){ if(!view.value||!item.value||!writable.value)return; try { const k=key(item.value.seq); if(k) uni.setStorageSync(k,{value:answer.value,baseRevision:view.value.revision,updatedAt:Date.now()}); }catch { notice.value="本机草稿保存失败，请保持本页并重试同步。"; } schedule(); }
function clearLocal(seq:number){ try { const k=key(seq); if(k)uni.removeStorageSync(k); }catch { /* storage unavailable */ } }
function stopTimer(){ if(timer)clearTimeout(timer); timer=undefined; }
function resetClock(){ startClock=Date.now(); elapsed.value=0; if(remaining.value!==0)expiryQueried=false; if(tick)clearInterval(tick); tick=setInterval(()=>{elapsed.value=Date.now()-startClock;if(view.value&&remaining.value===0&&active(view.value)&&!expiryQueried){expiryQueried=true;void reload(true);}},1000); }
function restore(q:Question|null){ const server=q?.draft||""; answer.value=server; conflict.value=null; if(!q||!view.value)return; const draft=local(q.seq); const mode=recovery(server,view.value.revision,draft,writeAllowed(view.value,q,remaining.value)); if(draft&&mode!=="none")conflict.value={local:draft,server,mode}; else if(draft)clearLocal(q.seq); }
async function reload(keep=true){ const thisGen=++generation; loading.value=true; error.value=""; try { if(!await ensureMobileSession())throw new Error("请先登录后继续作答"); const next=await readAttempt(attemptId.value); if(thisGen!==generation)return; view.value=next;syncActiveMarker(next); lastSaved.value=next.lastSavedAt; resetClock(); if(!keep||!next.questions.some(q=>q.seq===currentSeq.value)) currentSeq.value=next.questions[0]?.seq||1; restore(next.questions.find(q=>q.seq===currentSeq.value)||null); offline.value=false; }catch(e){ if(thisGen===generation){error.value=e instanceof Error?e.message:"作答暂时不可用";view.value=null;} }finally{if(thisGen===generation)loading.value=false;} }
function schedule(){stopTimer(); if(writable.value&&item.value&&answer.value!==item.value.draft)timer=setTimeout(()=>{void flush();},2000);}
async function saveOne():Promise<boolean>{ const a=view.value,q=item.value;if(!a||!q||!writable.value)return false;if(answer.value===q.draft){clearLocal(q.seq);return true;}
  const seq=q.seq, value=answer.value, base=a.revision; saving.value=true; error.value="";
  try { const receipt=await attemptAction(attemptId.value,"draft",{seq,answer:value,expectedRevision:base,requestId:reqId()});
    const r=receipt&&typeof receipt==="object"?receipt as Record<string,unknown>:{};
    if(!r.lastSavedAt||!r.serverNow||!("deadlineAt" in r))throw new Error("服务端未返回完整草稿回执，仍需核对");
    const next=await readAttempt(attemptId.value);view.value=next;syncActiveMarker(next);lastSaved.value=String(r.lastSavedAt);resetClock();
    const confirmed=next.questions.find(x=>x.seq===seq);if(!confirmed||confirmed.draft!==value)throw new Error("草稿回读不一致，请检查服务端版本");
    clearLocal(seq);offline.value=false;if(currentSeq.value===seq&&answer.value!==value)storeLocal();return true;
  }catch(e){offline.value=true;error.value=e instanceof Error?e.message:"草稿同步失败";
    if(isApiError(e)&&e.code===3008){try{const next=await readAttempt(attemptId.value);view.value=next;resetClock();const server=next.questions.find(x=>x.seq===seq)?.draft||"";conflict.value={local:local(seq)||{value,baseRevision:base??0,updatedAt:Date.now()},server,mode:"compare"};answer.value=server;error.value="草稿版本冲突，请核对两份答案后选择。";}catch{/* keep local */}}
    if(isApiError(e)&&e.code===3009){await reload(true);notice.value="已到截止时间。本机未同步内容可复制为学习笔记，不能再交卷。";}
    return false;
  }finally{saving.value=false;}
}
function flush():Promise<boolean>{stopTimer();saveQueue=saveQueue.then(saveOne,saveOne);return saveQueue;}
async function select(seq:number){if(seq===currentSeq.value){sheetOpen.value=false;return;}if(conflict.value?.mode==="compare"){error.value="先处理当前题的草稿冲突";return;}if(item.value&&answer.value!==item.value.draft&&writable.value){const ok=await flush();if(!ok)return;}
  currentSeq.value=seq;restore(view.value?.questions.find(q=>q.seq===seq)||null);sheetOpen.value=false;notice.value="";
}
function choose(source:"local"|"server"){const c=conflict.value;if(!c)return;answer.value=source==="local"?c.local.value:c.server;conflict.value=null;if(source==="server")clearLocal(currentSeq.value);else storeLocal();}
function edit(value:string){answer.value=value;storeLocal();}
function inputValue(event:unknown):string{const e=event as {detail?:{value?:unknown}};return typeof e?.detail?.value==="string"?e.detail.value:"";}
function addSymbol(symbol:string){edit(insertMath(answer.value,symbol).value);}
async function submitQuestion(){if(!view.value||!item.value||!writable.value||busy.value)return;busy.value=true;error.value="";
  try{await attemptAction(attemptId.value,"answer",{seq:item.value.seq,answer:answer.value,expectedRevision:view.value.revision,requestId:reqId()});clearLocal(item.value.seq);await reload(true);notice.value=view.value?.feedbackMode==="immediate"?"本题已提交，反馈以服务端判分为准。":"本题已提交，交卷后查看结果。";}
  catch(e){error.value=e instanceof Error?e.message:"提交本题失败";if(isApiError(e)&&[3008,3009].includes(e.code))await reload(true);}finally{busy.value=false;}
}
function requestSubmit(){if(!view.value||!active(view.value)||busy.value)return;uni.showModal({title:"确认交卷",content:submitText(view.value.questions)+(view.value.feedbackMode==="on_submit"?"交卷后服务端统一判分。":""),success:r=>{if(r.confirm)void submitAll();}});}
async function submitAll(){if(!view.value||busy.value)return;busy.value=true;error.value="";try{if(item.value&&answer.value!==item.value.draft&&writable.value){const ok=await flush();if(!ok)return;}
  await attemptAction(attemptId.value,"submit",{expectedRevision:view.value?.revision,requestId:reqId()});const next=await readAttempt(attemptId.value);view.value=next;syncActiveMarker(next);
  if(finished(next))uni.redirectTo({url:`/pages/attempt/report/index?id=${encodeURIComponent(attemptId.value)}`});else notice.value="交卷处理中，请稍后刷新报告。";
}catch(e){error.value=e instanceof Error?e.message:"交卷失败";if(isApiError(e)&&e.code===3009)await reload(true);}finally{busy.value=false;}}
onLoad(q=>{attemptId.value=String(q?.id||q?.attemptId||"");void reload(false);});
onShow(()=>{if(!shownOnce){shownOnce=true;return;}if(view.value)void saveQueue.then(()=>reload(true));});
onHide(()=>{stopTimer();if(writable.value&&item.value&&answer.value!==item.value.draft)void flush();});onUnload(()=>{stopTimer();if(tick)clearInterval(tick);});
</script>
<template>
  <view class="mobile-page paper"><MNavBar title="专注作答" back><template #right><button class="nav-submit" :disabled="!view||!active(view)||busy" @click="requestSubmit">交卷</button></template></MNavBar>
    <scroll-view scroll-y class="paper-scroll"><view class="page-scroll">
      <view v-if="loading" class="m-state">正在读取服务端作答快照…</view><view v-else-if="!view" class="m-state error">{{error||'作答暂不可用'}}<button class="retry" @click="reload(true)">重试</button></view>
      <template v-else><view class="hero"><text class="eyebrow">{{view.mode||'ATTEMPT'}} · {{view.feedbackMode==='on_submit'?'交卷后反馈':'逐题反馈'}}</text><text class="hero-title">{{view.title}}</text><view class="hero-row"><text>进度 {{answered}} / {{view.questions.length}}</text><text :class="{danger:remaining===0}">{{countdown(remaining)}}</text></view><view class="track"><view :style="{width:view.questions.length?`${answered/view.questions.length*100}%`:'0%'}" /></view></view>
        <view class="policy"><text>辅助权限：{{view.assistancePolicy||'待服务端确认'}}</text><text>当前作答的答案与解析以服务端规则开放</text></view>
        <view v-if="offline" class="m-state warning">连接中断或保存未确认；本机草稿仍保留。考试计时不会暂停。最后确认：{{lastSaved||'暂无'}}。</view>
        <view v-if="conflict" class="m-card conflict"><text class="m-card-title">{{conflict.mode==='compare'?'草稿版本冲突':'本地未同步草稿'}}</text><text class="muted">本机输入</text><text class="compare-text">{{conflict.local.value||'（空）'}}</text><text class="muted">服务端已保存</text><text class="compare-text">{{conflict.server||'（空）'}}</text><view class="compare-actions"><button class="m-button secondary" @click="choose('server')">使用服务端</button><button v-if="conflict.mode==='compare'" class="m-button" @click="choose('local')">使用本机并重存</button></view><text v-if="conflict.mode==='copy-only'" class="muted">作答已结束或不能同步；请复制本机文本留作笔记。</text></view>
        <view v-if="item" class="m-card question"><view class="question-meta"><text>第 {{item.seq}} 题 / {{view.questions.length}}</text><text>{{kindLabel(item.kind)}}</text></view><text class="stem">{{item.stem}}</text>
          <view v-if="!item.optionValid" class="m-state error">{{item.issue}}</view>
          <view v-else-if="item.options.length" class="options"><button v-for="option in item.options" :key="option.key" class="option" :class="{selected:answer===option.key}" :disabled="!writable||busy" @click="edit(option.key)"><text class="option-key">{{option.key}}</text><text>{{option.text}}</text></button></view>
          <view v-else><textarea class="answer-box" :value="answer" :disabled="!writable||busy" :maxlength="6000" placeholder="写下你的解答，离开前会尝试同步到服务端" @input="edit(inputValue($event))"/><view class="math-tools"><button v-for="s in mathSymbols" :key="s" :disabled="!writable||busy" @click="addSymbol(s)">{{s}}</button></view></view>
          <view v-if="feedback&&item.judgement" class="feedback" :class="item.judgement"><text>服务端反馈：{{item.judgement==='correct'?'正确':item.judgement==='incorrect'?'待巩固':item.judgement}}</text><text v-if="item.analysis">{{item.analysis}}</text></view>
          <button v-if="view.feedbackMode==='immediate'&&active(view)&&!item.submitted" class="m-button submit-one" :disabled="!writable||busy" @click="submitQuestion">{{busy?'提交中…':'提交本题'}}</button>
          <text class="save-status">{{saving?'正在同步草稿…':lastSaved?'上次服务端确认：'+lastSaved:'尚无服务端保存时间'}}</text></view>
        <view v-if="error" class="m-state error">{{error}}</view><view v-if="notice" class="m-state">{{notice}}</view>
      </template>
    </view></scroll-view>
    <view v-if="view" class="bottom"><button :disabled="!item||view.questions[0]?.seq===currentSeq" @click="select(view.questions[Math.max(0,view.questions.findIndex(q=>q.seq===currentSeq)-1)]?.seq||currentSeq)">上一题</button><button :class="{flagged:flags.includes(currentSeq)}" @click="flags=flags.includes(currentSeq)?flags.filter(x=>x!==currentSeq):[...flags,currentSeq]">⚑</button><button class="card-trigger" @click="sheetOpen=true;sheetSize='compact'">答题卡</button><button :disabled="!item||view.questions[view.questions.length-1]?.seq===currentSeq" @click="select(view.questions[Math.min(view.questions.length-1,view.questions.findIndex(q=>q.seq===currentSeq)+1)]?.seq||currentSeq)">下一题</button></view>
    <MSheet v-model="sheetOpen" title="答题卡" :height="sheetSize" :dismissible="view?.feedbackMode!=='on_submit'"><view class="sheet-top"><text>服务端已答 {{answered}} / {{view?.questions.length||0}} · 标记 {{flags.length}}</text><button @click="sheetSize=sheetSize==='compact'?'expanded':'compact'">{{sheetSize==='compact'?'展开全览':'收起'}}</button></view><view class="sheet-grid"><button v-for="q in view?.questions||[]" :key="q.seq" :class="{done:q.submitted||q.draft,flag:flags.includes(q.seq),current:q.seq===currentSeq}" @click="select(q.seq)">{{q.seq}}</button></view><template #footer><view class="sheet-actions"><button class="m-button secondary" @click="sheetOpen=false">回到题目</button><button class="m-button" :disabled="!view||!active(view)||busy" @click="requestSubmit">确认交卷</button></view></template></MSheet>
  </view>
</template>
<style scoped>
.paper{display:flex;flex-direction:column;height:100vh}.paper-scroll{flex:1;min-height:0}.page-scroll{padding-bottom:170rpx}.nav-submit{min-width:88rpx;background:transparent;color:#2f6bff;font-size:25rpx;font-weight:800}.hero{padding:37rpx;border-radius:34rpx;background:linear-gradient(130deg,#12284b,#2e4b84);color:white}.hero .eyebrow{color:#a8c7ff}.hero-title{display:block;margin:13rpx 0 30rpx;font-size:39rpx;font-weight:800}.hero-row{display:flex;justify-content:space-between;font-size:25rpx;font-weight:700}.hero-row .danger{color:#ffb7a9}.track{height:9rpx;margin-top:19rpx;border-radius:99rpx;background:#ffffff40}.track view{height:100%;border-radius:99rpx;background:#9fbcff}.policy{display:flex;justify-content:space-between;gap:20rpx;padding:20rpx 6rpx;color:#637591;font-size:21rpx}.policy text:last-child{text-align:right}.question{margin-top:10rpx}.question-meta{display:flex;justify-content:space-between;color:#4f6b96;font-size:23rpx;font-weight:750}.stem{display:block;margin:25rpx 0 34rpx;white-space:pre-wrap;color:#142136;font-size:31rpx;font-weight:700;line-height:1.75}.options{display:flex;flex-direction:column;gap:17rpx}.option{display:flex;align-items:center;gap:20rpx;min-height:106rpx;padding:17rpx 20rpx;text-align:left;border:2rpx solid #dce5f4;border-radius:24rpx;background:#f9fbff;color:#23354c;font-size:27rpx}.option.selected{border-color:#567bff;background:#edf3ff;color:#184acc}.option[disabled]{opacity:.72}.option-key{display:flex;align-items:center;justify-content:center;min-width:50rpx;height:50rpx;border-radius:14rpx;background:white;font-weight:800}.answer-box{width:100%;min-height:260rpx;padding:23rpx;border:2rpx solid #dce5f4;border-radius:23rpx;background:#f9fbff;color:#142136;font-size:27rpx;line-height:1.6}.math-tools{display:flex;flex-wrap:wrap;gap:9rpx;margin-top:16rpx}.math-tools button{min-width:68rpx;padding:11rpx;background:#edf3ff;color:#234ec0;border-radius:13rpx;font-size:27rpx}.submit-one{margin-top:28rpx}.save-status{display:block;margin-top:19rpx;color:#73839a;font-size:21rpx}.feedback{display:flex;flex-direction:column;gap:10rpx;margin-top:25rpx;padding:24rpx;border-radius:20rpx;background:#f1f8f1;color:#216544;font-size:25rpx}.feedback.incorrect{background:#fff3f0;color:#a34237}.bottom{position:fixed;left:0;right:0;bottom:0;z-index:10;display:flex;align-items:center;gap:8rpx;padding:16rpx 20rpx calc(16rpx + env(safe-area-inset-bottom));border-top:1rpx solid #e1e7f0;background:#fff}.bottom button{flex:1;min-height:84rpx;padding:5rpx;background:#f3f6fb;color:#2c4e79;border-radius:17rpx;font-size:23rpx;font-weight:750}.bottom button.card-trigger{flex:1.4;background:#315eee;color:white}.bottom button.flagged{color:#d65f26}.bottom button[disabled]{opacity:.4}.sheet-top{display:flex;justify-content:space-between;align-items:center;color:#536882;font-size:23rpx}.sheet-top button{background:#edf3ff;color:#285acb;font-size:23rpx}.sheet-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:15rpx;margin-top:26rpx}.sheet-grid button{height:75rpx;border:2rpx solid #dfe6f1;border-radius:17rpx;background:#fff;color:#4a5c76;font-size:25rpx}.sheet-grid button.done{background:#e8f2eb;border-color:#a9d9b3;color:#257143}.sheet-grid button.flag{border-color:#eab165}.sheet-grid button.current{border-color:#567bff;background:#eaf0ff;color:#2853cc;font-weight:800}.sheet-actions{display:flex;gap:12rpx}.sheet-actions button{flex:1;font-size:23rpx}.conflict{border-color:#f0bd78}.compare-text{display:block;white-space:pre-wrap;margin:8rpx 0 20rpx;padding:18rpx;border-radius:14rpx;background:#f6f8fc;color:#20354e;font-size:24rpx}.compare-actions{display:flex;gap:10rpx}.compare-actions button{flex:1;font-size:22rpx}.retry{margin-top:15rpx;color:#254fcc;background:#edf3ff}
</style>
