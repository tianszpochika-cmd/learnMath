/* 数源移动学习端：S01–S44 本地 UI/UX 评审交互。所有状态均为演示。 */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const vp=$("#vp");
const TABS=["s08","s09","s10","s11","s12"];
const ASSESSMENT_ALLOWED=new Set(["s08","s09","s10","s12","s19","s20","s40","s42"]);
const aiEnabled=true; // 评审环境能力开关；正式环境由服务端能力配置决定
const screenScroll=new Map();
const screenOrigin=new Map();
let current="s01",pendingIntent=null,toastTimer=null,returnFocus=null;
let lessonRead=false,lessonAnswer="",lessonPassed=false;
let assessmentOpen=false,flowOpen=false;
function h(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function mto(message){
  const el=$("#mto");el.textContent=message;el.classList.add("on");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("on"),3300);
}
window.mto=mto;
function setStatus(selector,message,kind){
  const el=$(selector);if(!el)return;el.textContent=message;
  el.classList.remove("good","bad","warn");if(kind)el.classList.add(kind);
}
function directGo(id){
  if(!document.getElementById(id))return;
  const prev=$("#"+current);
  if(prev)screenScroll.set(current,prev.scrollTop);
  const repeated=id===current;
  $$(".scr").forEach(el=>{el.classList.remove("on");el.setAttribute("aria-hidden","true");});
  const screen=$("#"+id);screen.classList.add("on");screen.setAttribute("aria-hidden","false");
  vp.classList.toggle("has-tab",TABS.includes(id));
  $$(".side [data-go],.tb[data-go]").forEach(el=>{
    const selected=el.dataset.go===id;el.classList.toggle("on",selected);
    if(el.classList.contains("tb"))el.setAttribute("aria-selected",String(selected));
    if(selected)el.setAttribute("aria-current","page");else el.removeAttribute("aria-current");
  });
  screen.scrollTop=repeated&&TABS.includes(id)?0:(screenScroll.get(id)||0);
  current=id;
  if(id==="s19")renderAttempt();
  if(id==="s21")renderReport();
  if(id==="s20")renderFullGrid();
  if(id==="s15")refreshDeepDive();
  $$(".fab").forEach(fab=>fab.hidden=!aiEnabled||aiRestricted());
  screen.focus({preventScroll:true});
}
function go(id,backNavigation=false){
  closeFlowSheet();
  if(answerSheetOpen)toggleAnswerSheet(false);
  if(assessmentActive()&&!ASSESSMENT_ALLOWED.has(id)){
    mto("本地测评演示仍在受限状态；请返回作答，或明确结束本地演示");return;
  }
  if(id==="s39"&&!aiEnabled){mto("AI 能力未启用，入口不可用");return;}
  if((current==="s19"||current==="s20")&&!["s19","s20","s21"].includes(id)&&!attempt.submitted){
    confirmLocal("保留草稿并离开？","作答内容仅在本机会话保存，服务端同步未验证。返回可从当前题继续；测评辅助限制仍保持。",()=>{if(backNavigation)screenOrigin.delete(current);else screenOrigin.set(id,current);directGo(id);},"保留并离开");
    return;
  }
  if(id==="s39"&&current==="s15"){openAiHalf();return;}
  if(id==="s03"){directGo("s08");showAssessmentSheet();return;}
  if(backNavigation)screenOrigin.delete(current);
  if(id!==current&&!backNavigation)screenOrigin.set(id,current);
  directGo(id);
}
window.go=go;
const confirmLayer=document.createElement("div");
confirmLayer.id="mobileConfirm";confirmLayer.className="mobile-modal";confirmLayer.hidden=true;
confirmLayer.innerHTML='<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="mobileConfirmTitle"><div class="review-kicker">设计示例 · 二次确认</div><h3 id="mobileConfirmTitle"></h3><p id="mobileConfirmBody"></p><div class="actions"><button type="button" class="btn gray" id="mobileConfirmCancel">返回</button><button type="button" class="btn" id="mobileConfirmProceed">继续</button></div></div>';
vp.appendChild(confirmLayer);
let confirmAction=null;
function confirmLocal(title,body,action,proceedLabel="继续"){
  returnFocus=document.activeElement;
  $("#mobileConfirmTitle").textContent=title;$("#mobileConfirmBody").textContent=body;
  $("#mobileConfirmProceed").textContent=proceedLabel;confirmAction=action;
  confirmLayer.hidden=false;$("#mobileConfirmCancel").focus();
}
function closeConfirm(){confirmLayer.hidden=true;confirmAction=null;if(returnFocus?.isConnected)returnFocus.focus();}
$("#mobileConfirmCancel").addEventListener("click",closeConfirm);
$("#mobileConfirmProceed").addEventListener("click",()=>{const action=confirmAction;closeConfirm();if(action)action();});
confirmLayer.addEventListener("click",e=>{if(e.target===confirmLayer)closeConfirm();});
const flowLayer=document.createElement("div");
flowLayer.id="flowLayer";flowLayer.className="flow-layer";flowLayer.hidden=true;
flowLayer.innerHTML='<div class="flow-dim"></div><section class="flow-sheet" role="dialog" aria-modal="true" aria-label="移动端辅助面板"><div class="flow-h"><span id="flowTitle"></span><button type="button" id="flowClose" aria-label="关闭面板">×</button></div><div id="flowBody" class="flow-b"></div></section>';
vp.appendChild(flowLayer);
function openFlowSheet(title,html,large=false){
  flowOpen=true;returnFocus=document.activeElement;
  $("#flowTitle").textContent=title;$("#flowBody").innerHTML=html;
  flowLayer.classList.toggle("large",large);flowLayer.hidden=false;
  $(".scr.on").inert=true;$("#flowClose").focus();
}
function closeFlowSheet(){
  if(!flowOpen)return;
  flowOpen=false;flowLayer.hidden=true;
  const active=$(".scr.on");if(active)active.inert=false;
  if(returnFocus?.isConnected)returnFocus.focus();
}
$("#flowClose").addEventListener("click",closeFlowSheet);
flowLayer.querySelector(".flow-dim").addEventListener("click",closeFlowSheet);
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    if(!confirmLayer.hidden)closeConfirm();else if(flowOpen)closeFlowSheet();else if(answerSheetOpen)toggleAnswerSheet(false);
  }
  if(e.key!=="Tab"||(!flowOpen&&confirmLayer.hidden&&!answerSheetOpen))return;
  const root=flowOpen?flowLayer:!confirmLayer.hidden?confirmLayer:asSheet;
  const items=Array.from(root.querySelectorAll("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex='0']"));
  if(!items.length)return;
  if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items[items.length-1].focus();}
  else if(!e.shiftKey&&document.activeElement===items[items.length-1]){e.preventDefault();items[0].focus();}
});
$$(".scr").forEach(el=>{el.tabIndex=-1;el.setAttribute("aria-hidden","true");});
$$("[data-go]").forEach(el=>{
  if(el.tagName==="A"){el.setAttribute("href","#"+el.dataset.go);}
  else if(!["BUTTON","INPUT"].includes(el.tagName)){el.setAttribute("role","button");el.tabIndex=0;}
});
$$(".tb").forEach(el=>{el.setAttribute("role","tab");el.setAttribute("aria-selected","false");});
$("#tabbar").setAttribute("role","tablist");
document.addEventListener("click",e=>{
  const target=e.target.closest("[data-go]");
  if(!target||e.target.closest("input,textarea"))return;
  if(target.closest("#s06")&&e.target.closest("#agreeAll"))return;
  e.preventDefault();
  if(target.closest("#s10")&&target.textContent.includes("试卷中心")){showPaperChoices();return;}
  const back=target.closest(".nav .bk");
  let destination=back?(screenOrigin.get(current)||target.dataset.go):target.dataset.go;
  if(back&&assessmentActive()&&!ASSESSMENT_ALLOWED.has(destination))destination="s10";
  go(destination,Boolean(back));
});
document.addEventListener("keydown",e=>{
  if((e.key==="Enter"||e.key===" ")&&e.target.matches('[role="button"],[role="tab"]')){
    e.preventDefault();e.target.click();
  }
});
if(window.visualViewport){
  const trackKeyboard=()=>{
    const open=window.visualViewport.height<window.innerHeight-150;
    vp.classList.toggle("keyboard-open",open);
    vp.style.setProperty("--visible-height",open?Math.round(window.visualViewport.height)+"px":"100dvh");
  };
  window.visualViewport.addEventListener("resize",trackKeyboard);
  trackKeyboard();
}

/* M3：三屏引导；登录后先进入首页，再展示可跳过测评 Sheet。 */
let onboardingIndex=0;
function renderOnboarding(){
  $("#obTrack").style.transform="translateX("+(-onboardingIndex*100)+"%)";
  $$("#obDots i").forEach((dot,index)=>dot.classList.toggle("on",index===onboardingIndex));
  $("#obBtn").textContent=onboardingIndex===2?"开始学习 →":"下一步";
}
$$("#obDots i").forEach((dot,index)=>{dot.tabIndex=0;dot.setAttribute("role","button");dot.setAttribute("aria-label","查看引导第"+(index+1)+"页");dot.addEventListener("click",()=>{onboardingIndex=index;renderOnboarding();});});
$("#obBtn").removeAttribute("data-go");
$("#obBtn").addEventListener("click",()=>{if(onboardingIndex<2){onboardingIndex++;renderOnboarding();}else go("s04");});
$("#s01 [data-go='s04']").dataset.go="s02";
$("#moreToggle").setAttribute("role","button");$("#moreToggle").tabIndex=0;
$("#moreToggle").addEventListener("click",()=>{
  const el=$("#moreLogin"),open=el.style.display==="none";
  el.style.display=open?"block":"none";
  $("#moreToggle").textContent=open?"收起其他方式 ↑":"更多方式 ↓";
});
$("#moreLogin").innerHTML='<div class="status-strip warn">当前评审稿仅展示验证码登录流程。微信、密码与邮箱渠道未配置，因此不提供可点击入口。</div>';
$("#smsBtn").insertAdjacentHTML("afterend",'<button type="button" class="btn ghost block" id="intentPreview" style="margin-top:10px">模拟官网进入：求根公式课时</button><button type="button" class="btn gray block" id="intentUnavailable" style="margin-top:8px">预览原目标已下架</button><div id="intentStatus" class="status-strip" style="margin-top:8px" hidden></div>');
$("#intentPreview").addEventListener("click",()=>{
  pendingIntent="s14";
  const status=$("#intentStatus");status.hidden=false;status.textContent="已保留本地演示目标：课时 3.2。完成验证码示例后先回到这节课，测评邀请不会抢先出现。";
});
$("#intentUnavailable").addEventListener("click",()=>{
  pendingIntent="unavailable";
  const status=$("#intentStatus");status.hidden=false;status.textContent="已保留一个本地失效目标示例。完成登录后先解释目标不可用，再给搜索与继续学习出口。";
});
$("#smsBtn").addEventListener("click",()=>{
  const phone=$("#phoneIn").value.replace(/\D/g,"");
  if(!$("#agreeCk").checked){mto("请先阅读并同意协议");$("#agreeCk").focus();return;}
  if(!/^1\d{10}$/.test(phone)){mto("请输入 11 位手机号");$("#phoneIn").focus();return;}
  go("s05");
  setStatus("#smsHelp","输入任意 6 位数字体验界面；本稿没有发送短信。","warn");
});
$("#agreeAll").addEventListener("click",e=>{e.stopPropagation();$("#agreeCk").checked=true;go("s04");mto("本地演示：已勾选协议");});
$("#s05 .pad").insertAdjacentHTML("afterbegin",'<div class="status-strip warn" id="smsHelp">本地验证码界面演示；没有发送真实短信。</div>');
$("#codeBox").innerHTML='<label for="smsCode" class="review-kicker" style="margin-top:18px">六位验证码</label><input id="smsCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="六位验证码" placeholder="输入 6 位数字" style="width:100%;height:52px;border:1.5px solid var(--line);border-radius:12px;padding:0 15px;font-size:22px;letter-spacing:.28em;background:white">';
$("#s05 .pad .muted.mt8").textContent="填任意 6 位数字演示登录；不会验证账号或发送短信。";
$("#s05 .pad > p.muted:first-of-type").textContent="演示手机号 · 本稿没有发送验证码";
$("#loginBtn").textContent="进入本地演示";
$("#smsCode").addEventListener("input",e=>{e.target.value=e.target.value.replace(/\D/g,"").slice(0,6);$("#loginBtn").disabled=e.target.value.length!==6;});
$("#loginBtn").addEventListener("click",()=>{
  if($("#smsCode").value.length!==6)return;
  if(pendingIntent==="unavailable"){
    pendingIntent=null;directGo("s08");
    openFlowSheet("原学习目标暂不可用",'<p>你从官网打开的学习资源已下架或暂不可访问。页面不会把你直接送进测评。</p><div class="status-strip warn">本稿只展示失败恢复界面；正式原因、权限与原输入回填需服务端确认。</div><button type="button" class="btn block" id="intentSearch">搜索相关内容</button><button type="button" class="btn gray block" id="intentContinue">返回首页选其他课程</button>');
    $("#intentSearch").addEventListener("click",()=>{closeFlowSheet();go("s41");});
    $("#intentContinue").addEventListener("click",()=>{closeFlowSheet();go("s08");});
  }
  else if(pendingIntent){const destination=pendingIntent;pendingIntent=null;go(destination);mto("已恢复本地演示目标；正式入口需服务端校验");}
  else{directGo("s08");showAssessmentSheet();}
});
function showAssessmentSheet(){
  assessmentOpen=true;
  openFlowSheet("三分钟定位起点",'<div class="assessment-art" aria-hidden="true">◎</div><h3>先了解自己，再决定从哪出发</h3><p>这份测评可以跳过。跳过后保持待校准，首次练习只提供建议，不会自动认定掌握度。</p><div class="status-strip">开答前会告知时限、交卷后反馈与限制辅助；本稿不创建真实作答。</div><button type="button" class="btn block" id="assessmentStart">预览测评说明</button><button type="button" class="btn gray block" id="assessmentSkip" style="margin-top:9px">先逛逛 · 保持待校准</button>');
  $("#assessmentStart").addEventListener("click",()=>{assessmentOpen=false;closeFlowSheet();go("s27");});
  $("#assessmentSkip").addEventListener("click",()=>{assessmentOpen=false;closeFlowSheet();mto("已跳过测评；推荐起点仍待校准");});
}
$("#s07 [data-go='s08']").removeAttribute("data-go");
$("#s07 .btn.block").addEventListener("click",()=>mto("微信授权仅为界面示例；请用验证码流程评审"));
const agreementBackdrop=$("#s06 > div");
agreementBackdrop.removeAttribute("data-go");
agreementBackdrop.addEventListener("click",e=>{if(e.target===agreementBackdrop)go("s04");});

/* 首页：一次只强调一个续学动作，其余信息层级让位于今日学习。 */
$("#s08 .pad").innerHTML=[
  '<div class="row" style="padding:6px 0 12px;background:none;border:0;box-shadow:none;margin:0"><div style="width:40px;height:40px;border-radius:14px;background:var(--grad);color:white;display:grid;place-items:center;font-weight:800">A</div><div style="flex:1"><strong>今天，接着学。</strong><div class="microcopy">同学 A · 本地设计示例</div></div><button type="button" class="btn gray" data-go="s40" aria-label="查看通知" style="min-height:42px;padding:8px 11px">通知</button></div>',
  '<div class="daily-hero"><span class="review-kicker" style="color:#D9E5FF">CONTINUE LEARNING</span><strong>从上次停下的地方继续。</strong><p>一元二次方程 · 第 5/8 课时<br>求根公式为什么有 ±？</p><button type="button" class="btn" data-go="s14">继续这节课 →</button></div>',
  '<div class="metric-pair"><div class="card"><span class="microcopy">今日到期</span><br><strong>5 题</strong><p class="microcopy">约 6 分钟 · 可以稍后做</p></div><div class="card"><span class="microcopy">掌握证据</span><br><strong>3 条</strong><p class="microcopy">样本不足 · 继续积累</p></div></div>',
  '<div class="sect">今日要做的</div><button type="button" class="row" data-go="s14"><div style="flex:1"><div class="t">01 · 完成当前课时</div><div class="d">先读，再做随堂题；两个条件分开记录</div></div><span class="ar">›</span></button><button type="button" class="row" data-go="s19"><div style="flex:1"><div class="t">02 · 每日一练</div><div class="d">本地草稿会保留；交卷前看未答题</div></div><span class="ar">›</span></button><button type="button" class="row" data-go="s22"><div style="flex:1"><div class="t">03 · 错题重练</div><div class="d">先分辨未定位、建议与真实观测</div></div><span class="ar">›</span></button>',
  '<div class="sect">按自己的方式继续</div><div class="choice-row"><button type="button" data-go="s09">六条路径</button><button type="button" data-go="s16">知识图谱</button><button type="button" data-go="s29">学习计划</button><button type="button" data-go="s32">公式馆</button></div>',
  '<div class="status-strip" style="margin-top:16px">页面中的进度、题量与人物均为演示；完成与掌握仍需真实服务端证据。</div>'
].join("");
$("#s08 .fab").setAttribute("role","button");$("#s08 .fab").tabIndex=0;$("#s08 .fab").setAttribute("aria-label","打开全屏 AI 对话示例");
$("#s10 .pad").insertAdjacentHTML("afterbegin",'<div class="status-strip warn" style="margin-bottom:12px">本页题量、计时与成绩是版式示例，未读取作答服务。</div>');
const answerRecord=$("#s10 .row[data-go='s21'] .d");
if(answerRecord)answerRecord.textContent="查看本地报告结构；正式成绩以服务端记录为准";

/* BR-02：阅读确认与随堂练成绩是两个条件。 */
const lessonMark=$$("#s14 button").find(b=>b.textContent.includes("标记完成"));
lessonMark.removeAttribute("data-go");lessonMark.textContent="预览课时完成条件";
lessonMark.disabled=true;lessonMark.id="lessonMark";
const lessonQuizOptions=$$("#s14 .quiz1");
lessonMark.insertAdjacentHTML("beforebegin",'<div class="card" id="lessonGate" style="background:#F8FAFF"><label style="display:flex;gap:10px;align-items:center;min-height:44px;font-size:14px"><input type="checkbox" id="lessonRead" style="width:20px;height:20px;accent-color:var(--p)">我已读完本节内容</label><div class="status-strip warn" id="lessonGateStatus">阅读未确认；随堂题未提交。完成课时还需审核客观题全部作答且正确率至少 80%。</div><button type="button" class="btn ghost block" id="lessonQuizSubmit" style="margin-top:11px">提交随堂练示例</button></div>');
function lessonRefresh(){
  $("#lessonMark").disabled=!(lessonRead&&lessonPassed);
  const status=lessonRead?(lessonPassed?"本地条件均满足；正式完成仍需服务端确认，积分和掌握度不在本稿变动。":"阅读已确认；随堂题还未达标。"):"请先确认阅读，再完成随堂练。";
  setStatus("#lessonGateStatus",status,lessonRead&&lessonPassed?"good":"warn");
}
$("#lessonRead").addEventListener("change",e=>{lessonRead=e.target.checked;lessonRefresh();});
lessonQuizOptions.forEach(option=>{
  option.setAttribute("role","button");option.tabIndex=0;
  option.addEventListener("click",()=>{lessonAnswer=option.dataset.r;lessonPassed=false;lessonQuizOptions.forEach(el=>{el.classList.toggle("selected",el===option);el.classList.remove("right","wrong");});lessonRefresh();});
});
$("#lessonQuizSubmit").addEventListener("click",()=>{
  if(!lessonAnswer){mto("先选一个答案");return;}
  lessonPassed=lessonAnswer==="1";
  lessonQuizOptions.forEach(el=>{el.classList.remove("right","wrong");if(el.classList.contains("selected"))el.classList.add(lessonPassed?"right":"wrong");});
  lessonRefresh();if(!lessonPassed)mto("本地练习示例：未达 80%，可重新选择");
});
$("#lessonMark").addEventListener("click",()=>confirmLocal("课时完成条件预览","本地演示已满足阅读与 1 道随堂题条件。正式完成、首次积分和掌握证据都需要服务端核验。",()=>{go("s13");mto("仅预览下一步；未写入课时进度");},"继续浏览"));

/* BR-03/04/07：练习与测评分别反馈；答案只在本机会话留作草稿。 */
const QUESTIONS=[
  {stem:"2x²−4x−6=0 的较大根是多少？",kind:"fill",answer:"3",explain:"2(x−3)(x+1)=0，两个根是 3 和 −1。"},
  {stem:"x²−6x+5=0 的较大根是多少？",kind:"fill",answer:"5",explain:"(x−1)(x−5)=0，较大根为 5。"},
  {stem:"(x−2)(x−3)=0 的全部解是？",kind:"choice",options:[["A","只有 2"],["B","2 或 3"],["C","只有 3"],["D","无实数解"]],answer:"B",explain:"零因子律：两个因子中至少一个为 0。"},
  {stem:"x²−4=0 的全部解是？",kind:"choice",options:[["A","只有 2"],["B","只有 −2"],["C","−2 或 2"],["D","0 或 4"]],answer:"C",explain:"平方差分解：(x−2)(x+2)=0。"},
  {stem:"x²−5x+6 的正确分解式是？",kind:"choice",options:[["A","(x−2)(x−3)"],["B","(x+2)(x+3)"],["C","(x−1)(x−6)"],["D","不能分解"]],answer:"A",explain:"两数积为 6、和为 5；原式中一次项为 −5x，所以均取负号。"}
];
function blankAttempt(mode="practice"){return {mode,index:0,answers:{},flags:[],feedback:{},submitted:false,selfRating:null,localTime:null};}
function assessmentActive(){return attempt.mode==="assessment";}
function showPaperChoices(){
  if(assessmentActive()){mto("当前本地测评演示仍在进行；请先返回作答");return;}
  openFlowSheet("选择试卷用途",'<p class="microcopy">不同试卷的反馈与辅助策略在开考时冻结；本稿仅展示本地流程。</p><button type="button" class="btn ghost block" id="paperPractice">学习练习 · 逐题反馈</button><button type="button" class="btn ghost block" id="paperExam" style="margin-top:9px">普通考试 · 交卷后反馈</button><button type="button" class="btn block" id="paperPromotion" style="margin-top:9px">晋级战 · 交卷后反馈</button>');
  $("#paperPractice").addEventListener("click",()=>{closeFlowSheet();go("s19");});
  $("#paperExam").addEventListener("click",()=>{closeFlowSheet();showRestrictedBrief("普通考试");});
  $("#paperPromotion").addEventListener("click",()=>{closeFlowSheet();showRestrictedBrief("晋级战");});
}
function showRestrictedBrief(purpose){
  if(assessmentActive()){mto("已有一份本地受限作答演示，不能另开试卷");return;}
  const formula=purpose==="普通考试"?"仅允许开考时冻结的条件摘要；本稿不开放公式入口。":"公式摘要、推导、深钻和 AI 均不可用。";
  const minutes=purpose==="Boss 战"?40:20;
  const localDraft=current==="s19"&&Object.keys(attempt.answers).length?'<div class="status-strip bad" style="margin-top:10px">你正在编辑本地练习草稿。进入新的受限作答示例会清空这份虚构草稿；没有服务端作答受到影响。</div>':"";
  openFlowSheet(purpose+" · 开考前说明",'<div class="status-strip warn">本地设计示例：5 道客观题，每题 20 分，满分 100；限时 '+minutes+' 分钟的版式说明。未连接服务端计时，不产生真实成绩或晋级。</div>'+localDraft+'<div class="card" style="margin-top:12px"><strong>辅助与反馈</strong><p class="microcopy" style="margin-top:7px">'+formula+' 答案与正误只在服务端交卷确认后解锁。</p></div><div class="card"><strong>中断与恢复</strong><p class="microcopy" style="margin-top:7px">本稿只保留同一浏览器会话的草稿；正式产品按服务端截止时间恢复，到期仍按最后确认答案交卷。</p></div><button type="button" class="btn block" id="restrictedBegin">开始本地受限作答示例</button>');
  $("#restrictedBegin").addEventListener("click",()=>{
    closeFlowSheet();attempt=blankAttempt("assessment");attempt.purpose=purpose;persistAttempt();go("s19");
  });
}
let attempt=blankAttempt();
try{
  const saved=JSON.parse(sessionStorage.getItem("lm-mobile-v2-attempt")||"null");
  if(saved&&["practice","assessment"].includes(saved.mode)&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<QUESTIONS.length&&saved.answers&&typeof saved.answers==="object")attempt={...blankAttempt(saved.mode),...saved};
}catch(error){/* 本地隐私模式不阻断原型 */ }
function persistAttempt(){
  attempt.localTime=new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"});
  try{sessionStorage.setItem("lm-mobile-v2-attempt",JSON.stringify(attempt));}catch(error){/* 会话存储不可用时只保留内存 */ }
  setStatus("#attemptSave","本机草稿已更新 · "+attempt.localTime+"；服务端同步未验证。","warn");
}
$("#s19 .pad").innerHTML=[
  '<div class="choice-row" id="attemptMode"><button type="button" data-attempt-mode="practice">学习练习</button><button type="button" data-attempt-mode="assessment">测评 / 考试示例</button></div>',
  '<div class="status-strip warn" id="attemptPolicy" style="margin-top:12px"></div>',
  '<div class="status-strip warn" id="attemptSave" style="margin-top:8px">本地草稿尚未生成；服务端同步未验证。</div>',
  '<div class="row" style="margin:16px 0 10px"><span class="review-pill" id="questionNumber"></span><span class="microcopy" style="margin-left:auto" id="questionProgress"></span></div>',
  '<section class="card"><span class="review-kicker">QUESTION · 每题独立保存</span><h2 id="questionStem" style="font-size:19px;line-height:1.55;margin:0 0 18px"></h2><div id="answerArea"></div></section>',
  '<button type="button" class="btn ghost block" id="subAns">提交本题示例</button>',
  '<div id="answerFeedback" class="status-strip" style="margin-top:10px" hidden></div>',
  '<div class="status-strip" style="margin-top:14px">离开页面再返回，当前题与本机草稿会恢复。正式作答需要服务端 revision、requestId 与到期校验。</div>',
  '<button type="button" class="btn gray block" id="resetAttemptDemo" style="margin-top:10px">结束并重置本地作答演示</button>',
  '<div class="ansbar"><button type="button" class="sq" id="previousQ" aria-label="上一题">‹</button><button type="button" class="sq" id="flagQ" aria-label="标记本题">⚑</button><button type="button" class="sq" id="openSheet" aria-label="打开答题卡">▦</button><button type="button" class="btn ghost" id="nextQ" style="flex:1">下一题</button><button type="button" class="btn" id="handIn">交卷</button></div>'
].join("");
$("#s19 .nav b").textContent="作答 · 本地交互示例";
$("#s19 .nav .rt").textContent="未连接计时服务";
let answerSheetOpen=false;
const asDim=$("#asDim"),asSheet=$("#asSheet");
vp.append(asDim,asSheet);
asSheet.classList.add("preview");
asSheet.inert=true;asSheet.setAttribute("aria-hidden","true");
  asSheet.querySelector(".sheet-h").innerHTML='<span>答题卡 <small id="answerSheetCount" style="font-size:12px;color:var(--ink3)"></small></span><div style="display:flex;gap:6px"><button type="button" class="btn gray" id="sheetExpand" style="min-height:44px;padding:6px 9px">展开</button><button type="button" class="btn gray" id="closeSheet" style="min-height:44px;padding:6px 9px">收起</button></div>';
asSheet.querySelector(".sheet-b").innerHTML='<p class="microcopy">已答 / 未答 / 标记同时显示；点题号回到草稿。</p><div class="agrid" id="aGrid"></div><button type="button" class="btn ghost block" id="closeSheet2" style="margin-top:14px">回到题目</button>';
function renderAnswerGrid(){
  const done=Object.values(attempt.answers).filter(v=>String(v).trim()).length;
  $("#answerSheetCount").textContent="· 已答 "+done+" / "+QUESTIONS.length+"，标记 "+attempt.flags.length;
  $("#aGrid").innerHTML=QUESTIONS.map((question,index)=>{
    const classes=["acell"];
    if(attempt.answers[index])classes.push("done");
    if(index===attempt.index)classes.push("cur");
    if(attempt.flags.includes(index))classes.push("flag");
    return '<button type="button" class="'+classes.join(" ")+'" data-question-index="'+index+'" aria-label="第 '+(index+1)+' 题'+(attempt.answers[index]?"，已答":"，未答")+(attempt.flags.includes(index)?"，已标记":"")+'">'+(index+1)+'</button>';
  }).join("");
}
function toggleAnswerSheet(open){
  answerSheetOpen=open;
  asDim.classList.toggle("on",open);asSheet.classList.toggle("on",open);
  asSheet.inert=!open;asSheet.setAttribute("aria-hidden",String(!open));
  const active=$(".scr.on");if(active)active.inert=open;
  if(open){asSheet.classList.add("preview");asSheet.classList.remove("expanded");renderAnswerGrid();$("#closeSheet").focus();}
  else $("#openSheet").focus();
}
$("#openSheet").addEventListener("click",()=>toggleAnswerSheet(true));
$("#closeSheet").addEventListener("click",()=>toggleAnswerSheet(false));
$("#closeSheet2").addEventListener("click",()=>toggleAnswerSheet(false));
$("#sheetExpand").addEventListener("click",()=>{
  const full=asSheet.classList.toggle("expanded");
  asSheet.classList.toggle("preview",!full);
  $("#sheetExpand").textContent=full?"收窄":"展开";
});
asDim.addEventListener("click",()=>mto("答题卡请用“收起”返回，避免误触"));
$("#aGrid").addEventListener("click",e=>{
  const cell=e.target.closest("[data-question-index]");if(!cell)return;
  attempt.index=Number(cell.dataset.questionIndex);persistAttempt();toggleAnswerSheet(false);renderAttempt();
});
let dragY=null;
asSheet.querySelector(".grab").addEventListener("pointerdown",e=>{dragY=e.clientY;asSheet.setPointerCapture(e.pointerId);});
asSheet.addEventListener("pointerup",e=>{
  if(dragY===null)return;const delta=e.clientY-dragY;dragY=null;
  if(delta< -48){asSheet.classList.add("expanded");asSheet.classList.remove("preview");$("#sheetExpand").textContent="收窄";}
  else if(delta>48&&asSheet.classList.contains("expanded")){asSheet.classList.remove("expanded");asSheet.classList.add("preview");$("#sheetExpand").textContent="展开";}
  else if(delta>75)toggleAnswerSheet(false);
});
function answerText(){return String(attempt.answers[attempt.index]||"").trim();}
function questionLocked(){return attempt.submitted||(attempt.mode==="practice"&&Boolean(attempt.feedback[attempt.index]));}
function renderAttempt(){
  if(current!=="s19")return;
  $("#attemptMode [data-attempt-mode='practice']").classList.toggle("on",attempt.mode==="practice");
  $("#attemptMode [data-attempt-mode='assessment']").classList.toggle("on",attempt.mode==="assessment");
  setStatus("#attemptPolicy",attempt.submitted?(attempt.mode==="assessment"?"本地交卷版式已预览：答案冻结；未取得服务端交卷确认，辅助仍受限。":"本地交卷版式已预览：答案冻结；正式成绩和同步仍待服务端。"):(attempt.mode==="practice"?"练习态：提交本题后才展示本地反馈；AI 可在离开作答后使用。":(attempt.purpose||"测评")+"：交卷前不展示答案、解析、深钻或 AI；仅保存本机草稿。正式策略由服务端开卷时冻结。"),attempt.mode==="assessment"?"bad":"");
  setStatus("#attemptSave",attempt.localTime?"本机草稿已更新 · "+attempt.localTime+"；服务端同步未验证。":"本地草稿尚未生成；服务端同步未验证。","warn");
  const q=QUESTIONS[attempt.index];
  $("#questionNumber").textContent="第 "+(attempt.index+1)+" / "+QUESTIONS.length+" 题";
  $("#questionProgress").textContent="已答 "+Object.values(attempt.answers).filter(v=>String(v).trim()).length+" 题";
  $("#questionStem").textContent=q.stem;
  if(q.kind==="fill"){
    $("#answerArea").innerHTML='<label class="review-kicker" for="fillIn">填写答案</label><input class="fillin" id="fillIn" inputmode="decimal" autocomplete="off" placeholder="输入你的答案"><div class="mathbar" aria-label="数学输入工具"><button type="button" data-ins="²">x²</button><button type="button" data-ins="√()">√</button><button type="button" data-ins="/">分数线</button><button type="button" data-ins="±">±</button></div>';
    $("#fillIn").value=attempt.answers[attempt.index]||"";
  }else{
    $("#answerArea").innerHTML=q.options.map(([key,text])=>'<button type="button" class="opt answer-choice'+(attempt.answers[attempt.index]===key?" selected":"")+'" data-answer="'+key+'" style="width:100%;text-align:left"><span class="k">'+key+'</span><span>'+h(text)+'</span></button>').join("");
  }
  $("#answerFeedback").hidden=true;
  if(attempt.mode==="practice"&&attempt.feedback[attempt.index]){
    setStatus("#answerFeedback",attempt.feedback[attempt.index].text,attempt.feedback[attempt.index].right?"good":"bad");
    $("#answerFeedback").hidden=false;
  }
  $("#subAns").textContent=attempt.submitted?"本地答案已冻结":questionLocked()?"本题已反馈 · 重做需新草稿":attempt.mode==="practice"?"提交本题并看反馈":"保存本题 · 暂不揭答案";
  $("#subAns").disabled=questionLocked();
  $("#handIn").disabled=attempt.submitted;
  $("#handIn").textContent=attempt.submitted?"已预览交卷":"交卷";
  $("#flagQ").disabled=attempt.submitted;
  $$("#answerArea input,#answerArea button").forEach(control=>control.disabled=questionLocked());
  $("#flagQ").setAttribute("aria-pressed",String(attempt.flags.includes(attempt.index)));
  $("#flagQ").style.color=attempt.flags.includes(attempt.index)?"var(--warn)":"";
  $("#previousQ").disabled=attempt.index===0;
  $("#nextQ").textContent=attempt.index===QUESTIONS.length-1?"回第一题":"下一题";
  renderAnswerGrid();
}
$("#answerArea").addEventListener("input",e=>{
  if(questionLocked())return;
  if(e.target.id!=="fillIn")return;attempt.answers[attempt.index]=e.target.value;
  delete attempt.feedback[attempt.index];persistAttempt();$("#answerFeedback").hidden=true;
});
$("#answerArea").addEventListener("click",e=>{
  if(questionLocked())return;
  const choice=e.target.closest("[data-answer]");
  if(choice){
    attempt.answers[attempt.index]=choice.dataset.answer;
    delete attempt.feedback[attempt.index];persistAttempt();renderAttempt();return;
  }
  const tool=e.target.closest("[data-ins]");
  if(tool&&$("#fillIn")){
    const input=$("#fillIn"),start=input.selectionStart,end=input.selectionEnd;
    input.setRangeText(tool.dataset.ins,start,end,"end");input.dispatchEvent(new Event("input",{bubbles:true}));input.focus();
  }
});
$("#attemptMode").addEventListener("click",e=>{
  const mode=e.target.closest("[data-attempt-mode]")?.dataset.attemptMode;
  if(!mode||mode===attempt.mode)return;
  if(assessmentActive()){mto("测评演示期间不能切换为逐题反馈；如要结束，请明确重置本地演示");return;}
  if(mode==="assessment")showRestrictedBrief("入学测评");
});
$("#resetAttemptDemo").addEventListener("click",()=>confirmLocal("结束本地演示作答？","这只会清除本机这份虚构草稿并返回练习模式；不会取消任何真实测评、考试或服务端作答。",()=>{attempt=blankAttempt();persistAttempt();renderAttempt();mto("本地演示草稿已重置；没有操作真实考试");},"仅重置演示"));
$("#subAns").addEventListener("click",()=>{
  if(questionLocked())return;
  const value=answerText();if(!value){mto("先填写或选择答案，再提交本题");return;}
  if(attempt.mode==="assessment"){persistAttempt();mto("本题仅保存到本机；交卷前不揭答案");return;}
  const q=QUESTIONS[attempt.index],right=value.toLocaleLowerCase()===q.answer.toLocaleLowerCase();
  attempt.feedback[attempt.index]={right,text:(right?"本地练习反馈：正确。":"本地练习反馈：再想一想。")+" "+q.explain+" 正式判分仍以服务端为准。"};
  persistAttempt();renderAttempt();
});
$("#previousQ").addEventListener("click",()=>{if(attempt.index>0){attempt.index--;persistAttempt();renderAttempt();}});
$("#nextQ").addEventListener("click",()=>{attempt.index=(attempt.index+1)%QUESTIONS.length;persistAttempt();renderAttempt();});
$("#flagQ").addEventListener("click",()=>{
  if(attempt.submitted)return;
  const index=attempt.flags.indexOf(attempt.index);
  if(index<0)attempt.flags.push(attempt.index);else attempt.flags.splice(index,1);
  persistAttempt();renderAttempt();
});
$("#handIn").addEventListener("click",()=>{
  const unanswered=QUESTIONS.map((_,index)=>index).filter(index=>!String(attempt.answers[index]||"").trim());
  confirmLocal("交卷前再核对",unanswered.length?"还有 "+unanswered.length+" 题未答（第 "+unanswered.map(index=>index+1).join("、")+" 题）。标记 "+attempt.flags.length+" 题。本稿只展示交卷确认，不提交服务端。":"五题已答，标记 "+attempt.flags.length+" 题。本稿只展示交卷确认与报告版式，不提交服务端。",()=>{
    attempt.submitted=true;persistAttempt();screenOrigin.set("s21","s19");directGo("s21");
  },"查看报告示例");
});
$("#s20 .pad").innerHTML='<div class="status-strip warn">答题卡全览样式 · 当前本地演示 5 题；正式题数随服务端快照确定。</div><div class="agrid" id="fullAnswerGrid" style="margin:16px 0"></div><button type="button" class="btn block" data-go="s19">返回作答</button>';
function renderFullGrid(){
  $("#fullAnswerGrid").innerHTML=QUESTIONS.map((_,index)=>'<button type="button" class="acell'+(attempt.answers[index]?" done":"")+(attempt.flags.includes(index)?" flag":"")+'" data-full-index="'+index+'">'+(index+1)+'</button>').join("");
}
$("#fullAnswerGrid").addEventListener("click",e=>{const cell=e.target.closest("[data-full-index]");if(!cell)return;attempt.index=Number(cell.dataset.fullIndex);persistAttempt();go("s19");});

/* BR-04：客观结果和主观自评分开；纯解答卷没有客观成绩。 */
$("#s21 .pad").innerHTML=[
  '<span class="review-kicker">REPORT · 本地版式预览</span><h2 style="font-size:24px;line-height:1.25;margin:0 0 8px">把结果讲清楚，才知道下一步。</h2>',
  '<div class="status-strip warn" id="reportBoundary">演示报告不代表服务端已判分或交卷。</div>',
  '<div class="card" style="margin-top:15px"><span class="microcopy">客观题</span><div class="bigscore" id="objectiveScore"></div><p class="microcopy" id="objectiveNote"></p><button type="button" class="btn ghost block" id="pureSubjectiveToggle">预览纯解答卷口径</button></div>',
  '<div class="card" id="subjectiveSample" hidden><div class="review-kicker">另一份纯解答卷 · 独立版式示例</div><strong>解释：为什么边长平方根取正？</strong><details style="margin-top:10px"><summary style="min-height:44px;cursor:pointer;color:var(--p-d)">查看参考解析</summary><p class="microcopy">边长取正实数；从平方关系还原边长时取正根。</p></details><p class="microcopy" id="selfStatus" role="status">待自评 · 不计入客观分与榜单。</p><div class="choice-row" id="selfOptions"><button type="button" data-self="不会">不会</button><button type="button" data-self="半会">半会</button><button type="button" data-self="会">会</button><button type="button" data-self="暂不评价">暂不评价</button></div></div>',
  '<div class="card"><strong>知识点观察</strong><p class="microcopy" style="margin-top:8px">因式分解：当前示例只有 3 条合格证据，样本不足；不能据此报确定掌握。</p></div>',
  '<div class="row" data-go="s22"><div style="flex:1"><div class="t">去错题本</div><div class="d">先辨证据状态，再选择补救</div></div><span class="ar">›</span></div>',
  '<button type="button" class="btn ghost block" id="reportBack" style="margin-top:10px">回到本地作答草稿</button>'
].join("");
let pureSubjective=false;
function renderReport(){
  if(current!=="s21")return;
  const correct=QUESTIONS.reduce((sum,q,index)=>sum+(String(attempt.answers[index]||"").trim().toLocaleLowerCase()===q.answer.toLocaleLowerCase()?1:0),0);
  const restricted=assessmentActive();
  $("#objectiveScore").textContent=restricted?"服务端判分待确认":pureSubjective?"本卷无客观成绩":!attempt.submitted?"尚无交卷结果":(correct*20)+" / 100";
  $("#objectiveScore").classList.toggle("pending-score",restricted||!attempt.submitted||pureSubjective);
  $("#objectiveNote").textContent=restricted?"本地交卷版式不揭示测评得分、答案或解析；待真实服务端确认后才能解锁。":pureSubjective?"这是另一份纯解答卷的版式示例；客观得分字段保持空值。":!attempt.submitted?"当前只保留本地草稿；完成交卷确认后才可查看练习样例分数。":"根据当前本地练习答案计算 · 共 "+QUESTIONS.length+" 道客观题；正式成绩须服务端判分。";
  $("#pureSubjectiveToggle").hidden=restricted;
  $("#pureSubjectiveToggle").textContent=pureSubjective?"返回当前客观练习报告":"预览另一份纯解答卷口径";
  $("#subjectiveSample").hidden=restricted||!pureSubjective;
  setStatus("#reportBoundary",restricted?"已查看本地交卷确认，但没有服务端确认；仍维持测评辅助限制。":attempt.submitted?"已查看本地交卷确认；没有创建正式成绩或积分。":"尚未完成本地交卷确认；以下只展示报告结构与当前草稿示例。","warn");
  $("#selfStatus").textContent=attempt.selfRating?"本题自评："+attempt.selfRating+"；客观成绩不变。":"待自评 · 不计入客观分与榜单。";
  $$("#selfOptions button").forEach(button=>button.classList.toggle("on",button.dataset.self===attempt.selfRating));
}
$("#pureSubjectiveToggle").addEventListener("click",()=>{pureSubjective=!pureSubjective;renderReport();});
$("#selfOptions").addEventListener("click",e=>{const button=e.target.closest("[data-self]");if(!button)return;attempt.selfRating=button.dataset.self;persistAttempt();renderReport();});
$("#reportBack").addEventListener("click",()=>go("s19"));

/* BR-05：四种断链证据状态，AI 建议不能被写成确定观察。 */
const breakCases={
  unlocated:{label:"尚未定位",tone:"warn",headline:"目前只能确认这道题答错了。",body:"缺少能定位到具体推理步的证据。不要把最终答案错误推断成第 2 步必然断链。",path:"先看题目解析，再做 1 道短预测题。"},
  suggested:{label:"AI 建议 · 待确认",tone:"warn",headline:"可能卡在 S2 的符号判断。",body:"这是内容建议，不是能力观测。你可以确认、忽略，或先做预测题找证据。",path:"建议先复习因式分解符号规则。"},
  observed:{label:"预测作答观测示例",tone:"good",headline:"预测题在 S2 出现依据错误。",body:"若由服务端记录的预测作答产生，可标 observed 并携带题号、解法版本与步骤 ID。此处为虚构样例。",path:"回看 S2 依据，再做 1 道同类题。"},
  self_reported:{label:"学习者自报",tone:"good",headline:"你说自己卡在 S2。",body:"这是自报状态，应与真实观测分开；可随时重新查看依据。",path:"从 S2 的依据与动机开始补。"}
};
let breakState="suggested";
$("#s22 .pad").innerHTML=[
  '<div class="status-strip warn">错题证据状态示例；未定位、AI 建议、观测和自报不混为一个“断点”。</div>',
  '<div class="sect">需要处理</div>',
  '<button type="button" class="row" data-break-state="unlocated"><div style="flex:1"><div class="t">#1024 · 因式分解</div><div class="d">尚未定位 · 只有最终答案错误</div></div><span class="ar">›</span></button>',
  '<button type="button" class="row" data-break-state="suggested"><div style="flex:1"><div class="t">#1310 · 根的分布</div><div class="d">AI 建议：可能缺前置不等式，待确认</div></div><span class="ar">›</span></button>',
  '<button type="button" class="row" data-break-state="observed"><div style="flex:1"><div class="t">#1102 · 零因子律</div><div class="d">预测作答观测示例 · 有步骤证据</div></div><span class="ar">›</span></button>',
  '<div class="card"><strong>到期重练</strong><p class="microcopy" style="margin-top:7px">当前链接为五题通用练习流程；定向补救题是否可用需核对已发布内容清单。</p><button type="button" class="btn ghost block" data-go="s19">进入五题练习示例</button></div>'
].join("");
$("#s22 .pad").addEventListener("click",e=>{
  const row=e.target.closest("[data-break-state]");if(!row)return;
  breakState=row.dataset.breakState;go("s23");renderBreak();
});
$("#s23 .pad").innerHTML=[
  '<div class="status-strip" id="breakBadge"></div>',
  '<h2 id="breakHeadline" style="font-size:22px;line-height:1.35;margin:18px 0 8px"></h2>',
  '<p class="microcopy" id="breakBody"></p>',
  '<div class="card" style="margin-top:16px"><div class="review-kicker">证据快照 · 演示</div><div class="chain"><div class="st"><div class="k">ST-101 · 已知</div><div class="tx">观察方程结构，尝试因式分解</div></div><div class="st" id="breakStep"><div class="k" id="breakStepLabel">ST-102 · 尚未定位</div><div class="tx">寻找积为 6、和为 −5 的因数对</div><div class="more" style="display:block">符号依据：两个负因数积正、和负。正式跳转必须校验解法版本与步骤 ID。</div></div></div></div>',
  '<div class="status-strip" id="breakPath"></div>',
  '<div class="choice-row" style="margin-top:14px"><button type="button" id="breakConfirm">我确认卡在这里</button><button type="button" id="breakIgnore">仍不确定</button></div>',
  '<div class="sect">下一步</div><button type="button" class="row" data-go="s17"><div style="flex:1"><div class="t">回看知识点四卡</div><div class="d">先补前置，再练这一步</div></div><span class="ar">›</span></button><button type="button" class="row" data-go="s15"><div style="flex:1"><div class="t">在深钻里看依据</div><div class="d">从 ST-102 的合法性与动机继续</div></div><span class="ar">›</span></button>',
  '<div class="status-strip warn" style="margin-top:12px">本稿不保存真实断链证据，也不把 AI 文字计入推理能力分。</div>'
].join("");
function renderBreak(){
  const info=breakCases[breakState];
  setStatus("#breakBadge",info.label,info.tone);
  $("#breakHeadline").textContent=info.headline;$("#breakBody").textContent=info.body;
  $("#breakStep").classList.toggle("broken",breakState==="observed");
  $("#breakStep").classList.toggle("suggested",breakState==="suggested");
  $("#breakStepLabel").textContent="ST-102 · "+({observed:"作答证据定位",suggested:"AI 猜测 · 待核",self_reported:"学习者自报",unlocated:"尚未定位"}[breakState]);
  setStatus("#breakPath",info.path,"");
  $("#breakConfirm").disabled=breakState==="observed"||breakState==="self_reported";
}
$("#breakConfirm").addEventListener("click",()=>{breakState="self_reported";renderBreak();mto("已切为本地自报示例；不计为客观观测");});
$("#breakIgnore").addEventListener("click",()=>{breakState="unlocated";renderBreak();mto("保持未定位，先收集更多证据");});
renderBreak();

/* M4：五种深钻玩法使用清楚的模式切换和步骤展开。 */
let deepMode="0";
$("#ddTabs").setAttribute("role","tablist");
$$("#ddTabs .mt").forEach(tab=>{
  tab.setAttribute("role","tab");tab.tabIndex=0;tab.setAttribute("aria-selected",String(tab.dataset.dm==="0"));
  tab.addEventListener("click",()=>{deepMode=tab.dataset.dm;refreshDeepDive();});
});
function refreshDeepDive(){
  $$("#ddTabs .mt").forEach(tab=>{const active=tab.dataset.dm===deepMode;tab.classList.toggle("on",active);tab.setAttribute("aria-selected",String(active));});
  $$("#s15 .dm").forEach(panel=>panel.style.display=panel.dataset.m===deepMode?"block":"none");
}
$$("#s15 .chain .st").forEach((step,index)=>{
  step.setAttribute("role","button");step.tabIndex=0;step.setAttribute("aria-expanded","false");
  step.setAttribute("aria-label","第 "+(index+1)+" 步，展开依据、动机与岔路");
  step.addEventListener("click",()=>{
    const open=!step.classList.contains("open");
    $$("#s15 .chain .st").forEach(item=>{item.classList.remove("open");item.setAttribute("aria-expanded","false");});
    step.classList.toggle("open",open);step.setAttribute("aria-expanded",String(open));
  });
});
let predictionDone=false;
$$("#s15 .pred").forEach(option=>{
  option.setAttribute("role","button");option.tabIndex=0;
  option.addEventListener("click",()=>{
    if(predictionDone)return;predictionDone=true;
    const right=option.dataset.ok==="1";option.classList.add(right?"right":"wrong");
    const feedback=$("#predCm");feedback.style.display="block";feedback.style.borderColor=right?"var(--ok)":"var(--warn)";
    feedback.style.background=right?"#EFF9F3":"#FFF8E9";
    feedback.textContent=(right?"本地预测示例：零因子律正是依据。":"本地预测示例：若除以 x−2，会漏掉 x=2 的可能。")+" 正式 observed 证据须关联题号、解法版本与步骤 ID。";
  });
});
$("#s15 .dm[data-m='3']").insertAdjacentHTML("beforeend",'<div class="card" id="solutionCompare"><strong>解法对比</strong><p class="microcopy">因式分解：短，但要发现因数对；求根公式：条件广、步骤多；图像交点：帮助直观理解。</p></div>');
const solutionChips=$$("#s15 .dm[data-m='3'] .chip");
solutionChips.forEach((chip,index)=>{chip.setAttribute("role","button");chip.tabIndex=0;chip.addEventListener("click",()=>{
  solutionChips.forEach(item=>item.classList.add("gray"));chip.classList.remove("gray");
  const descriptions=["因式分解 · 3 步：寻找因数对 → 写成乘积 → 用零因子律。","求根公式 · 4 步：确认 a≠0 → 求判别式 → 代入 → 检验。","图像交点 · 先画 y=x²−5x+6，再找与 x 轴交点。"];
  $("#solutionCompare .microcopy").textContent=descriptions[index]+" 三种解法得到相同的两个根。";
});});
$("#s15 .dm[data-m='4'] .btn").removeAttribute("data-go");
$("#s15 .dm[data-m='4'] .btn").addEventListener("click",openAiHalf);
if(!aiEnabled){$("#ddTabs [data-dm='4']").hidden=true;$("#s15 .dm[data-m='4']").hidden=true;$$(".fab").forEach(fab=>fab.hidden=true);}
$("#s15 .pad").insertAdjacentHTML("afterbegin",'<div class="status-strip" style="margin-bottom:12px">步骤内容为审核版设计示例。模式会记住你停留的位置；AI 入口受作答策略限制。</div>');
function aiRestricted(){return assessmentActive();}
function openAiHalf(){
  if(!aiEnabled){mto("AI 能力未启用");return;}
  if(aiRestricted()){mto("测评草稿未交卷：AI、答案与深钻辅助不可用");return;}
  openFlowSheet("围绕本题问 AI · 半屏",'<div class="status-strip warn">携带题目 #1024 与当前步骤上下文；以下为固定文案，未请求 AI 服务。</div><div class="card" style="margin-top:12px"><strong>先别急着求根</strong><p class="microcopy">看到 (x−2)(x−3)=0，你能先说出“积为零”意味着什么吗？</p></div><label for="halfAiInput" class="review-kicker">继续追问</label><input id="halfAiInput" placeholder="例如：为什么不能两边同除？" style="width:100%;min-height:44px;border:1px solid var(--line);border-radius:11px;padding:9px"><button type="button" class="btn block" id="halfAiSend" style="margin-top:10px">查看引导式回答示例</button><div id="halfAiReply" class="status-strip" style="margin-top:10px" hidden></div>');
  $("#halfAiSend").addEventListener("click",()=>{
    const query=$("#halfAiInput").value.trim();if(!query){mto("先写下你的问题");return;}
    const reply=$("#halfAiReply");reply.hidden=false;reply.textContent="固定引导示例：先检查 x−2 是否可能为 0；若可能，同除会漏掉什么解？";
  });
}
$("#s39 .aiwrap").insertAdjacentHTML("afterbegin",'<div class="status-strip warn" style="margin:10px 14px 0">全屏 AI 对话版式示例；没有 Provider 请求、积分扣除或真实生成。</div>');
let aiDirect=false;
$("#aiMode").setAttribute("role","button");$("#aiMode").tabIndex=0;
$("#aiMode").addEventListener("click",()=>{
  aiDirect=!aiDirect;
  $("#aiMode").textContent=aiDirect?"切换苏格拉底":"切换直接讲解";
  mto(aiDirect?"直接讲解模式 · 本地文案":"苏格拉底模式 · 本地文案");
});
function aiReply(query){
  if(aiRestricted()){mto("测评进行中，AI 辅助不可用");return;}
  const stream=$("#aiStream"),user=document.createElement("div"),assistant=document.createElement("div");
  user.className="bub me";user.textContent=query;assistant.className="bub ai";
  assistant.textContent=aiDirect?"固定示例：零因子律给出 x−2=0 或 x−3=0，因此 x=2 或 3。":"固定引导示例：若一个乘积为 0，两个因子各自可能是什么？先试着列出两种情况。";
  stream.append(user,assistant);stream.scrollTop=stream.scrollHeight;
}
$("#aiSend").addEventListener("click",()=>{const input=$("#aiIn"),query=input.value.trim();if(!query)return;aiReply(query);input.value="";});
$("#aiIn").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();$("#aiSend").click();}});
$$("#s39 [data-aq]").forEach(chip=>{chip.setAttribute("role","button");chip.tabIndex=0;chip.addEventListener("click",()=>aiReply(chip.dataset.aq));});

/* BR-10：测评先给建议，计划差异由学习者确认；缺席不自动降级。 */
$("#s27 .pad").innerHTML=[
  '<span class="review-kicker">PLACEMENT · 开考说明</span><h2 style="font-size:24px;line-height:1.3;margin:0 0 12px">先看清规则，再决定开答。</h2>',
  '<div class="card"><strong>入学测评 · 本地流程预览</strong><p class="microcopy" style="margin-top:8px">示例共 5 道客观题，每题 20 分；正式定级仅针对实际覆盖领域。跳过后推荐起点待校准。</p></div>',
  '<div class="status-strip">本稿时限示例为 20 分钟，未连接真实计时。交卷后才反馈；限制 AI、答案、深钻与公式摘要。同端本机会话可续答，正式恢复、截止与计分由服务端冻结。</div>',
  '<div class="card" style="margin-top:13px"><strong>本轮可能得到什么</strong><p class="microcopy" style="margin-top:8px">只对实际覆盖的领域给建议；证据不足时保持“待校准”。建议由你确认后才应用到计划。</p></div>',
  '<button type="button" class="btn block" id="assessmentBegin">开始测评界面示例</button>',
  '<button type="button" class="btn gray block" id="assessmentLater" style="margin-top:9px">暂不测评 · 返回路径</button>'
].join("");
$("#s27 .nav .rt").setAttribute("role","button");$("#s27 .nav .rt").tabIndex=0;
$("#s27 .nav .rt").addEventListener("click",()=>confirmLocal("退出测评说明","若已有作答，正式产品应保留服务端草稿并说明恢复时限。本稿只保存当前本机会话。",()=>go(screenOrigin.get("s27")||"s09",true),"返回原页"));
$("#assessmentBegin").addEventListener("click",()=>{
  confirmLocal("开始测评示例","将创建新的本地测评草稿。交卷前不显示答案、解析、深钻、AI 或公式摘要；本稿不创建真实 attempt。",()=>{
    attempt=blankAttempt("assessment");attempt.purpose="入学测评";persistAttempt();go("s19");
  },"进入作答");
});
$("#assessmentLater").addEventListener("click",()=>{go(screenOrigin.get("s27")||"s09",true);mto("测评已跳过；起点保持待校准");});
$("#s28 .pad").innerHTML=[
  '<span class="review-kicker">PLACEMENT REPORT · 版式示例</span><h2 style="font-size:24px;margin:0 0 10px">推荐从这里开始，决定权在你。</h2>',
  '<div class="status-strip warn">以下是虚构测评报告结构，不是本机答题的真实定级结果。</div>',
  '<div class="card" style="margin-top:14px"><span class="microcopy">覆盖领域 · 示例</span><h3 style="font-size:23px;margin:6px 0">代数基础：建议 L2</h3><p class="microcopy">几何样本 0 → 尚未测量；根的分布样本 3 → 待校准。不会给未覆盖领域推断等级。</p></div>',
  '<div class="card"><strong>首周计划建议 · 尚未应用</strong><p class="microcopy" style="margin-top:8px">原计划：因式分解课时 1 节 + 到期错题 3 题<br>建议：先加不等式性质 1 节，再接根的分布 8 题</p></div>',
  '<label class="review-kicker" for="assessmentMinutes">你想每天学多久？ <span id="assessmentMinuteValue">30</span> 分钟</label><input id="assessmentMinutes" type="range" min="10" max="90" value="30" style="width:100%;accent-color:var(--p);min-height:44px">',
  '<button type="button" class="btn block" id="placementReview" style="margin-top:15px">查看计划差异</button><button type="button" class="btn gray block" data-go="s08" style="margin-top:9px">稍后决定</button>'
].join("");
$("#assessmentMinutes").addEventListener("input",e=>$("#assessmentMinuteValue").textContent=e.target.value);
$("#placementReview").addEventListener("click",()=>{go("s29");mto("建议已带到计划页，仍需你明确确认");});
let planState="pending",planBaseRevision=5,planRevision=5,planUndoAllowed=false;
$("#s29 .pad").innerHTML=[
  '<span class="review-kicker">WEEKLY PLAN · 建议先看差异</span><h2 style="font-size:24px;margin:0 0 10px">让计划适应你，不替你做决定。</h2>',
  '<div class="card"><strong>这周的学习节奏</strong><div class="choice-row" style="margin-top:12px"><button type="button" class="on">周一</button><button type="button">周二</button><button type="button">周三</button><button type="button">周四</button><button type="button">周五</button><button type="button">周末</button></div></div>',
  '<div class="sect">今日任务 · 进度由服务端证据确认</div>',
  '<button type="button" class="row" data-go="s14"><div style="flex:1"><div class="t">判别式课时 · 待完成</div><div class="d">打开课时；阅读确认与随堂练分别检查</div></div><span class="ar">›</span></button>',
  '<button type="button" class="row" data-go="s19"><div style="flex:1"><div class="t">每日一练 · 待完成</div><div class="d">不能靠手动勾选变成已完成</div></div><span class="ar">›</span></button>',
  '<div class="sect">一条待确认的调整建议</div>',
  '<div class="card" id="planSuggestion"><div class="review-kicker">revision 5 → 建议版本 6</div><strong>先补前置，再进入根的分布</strong><div class="status-strip" style="margin:12px 0">原：周三根的分布 8 题 → 建议：周三不等式性质 1 节 + 周五根的分布 8 题</div><p class="microcopy">依据示例：最近 7 天该知识点 12 条有效客观证据，5 题正确（41.7%），低于 60%。不足 10 条时只提示证据不足。建议不会自动改变掌握度。</p><div class="choice-row"><button type="button" id="planAccept">确认应用示例</button><button type="button" id="planIgnore">暂不调整</button><button type="button" id="planConflict">预览版本冲突</button></div></div>',
  '<div id="planStatus" class="status-strip warn" role="status">建议待确认；计划未变更。</div>',
  '<div class="card" id="planConflictDiff" hidden><strong>版本冲突 · 原版 / 最新版 / 建议</strong><p class="microcopy" style="margin-top:8px">原版 revision 5：周三根的分布 8 题。<br>服务端最新版 revision 7：周三已改为复习因式分解 5 题。<br>旧建议 revision 6：周三补不等式性质，周五再练根的分布。<br>需要基于 revision 7 重新选择；旧建议不会覆盖你的新安排。</p><button type="button" class="btn ghost block" id="planReReview">按最新版重新审阅</button></div>',
  '<button type="button" class="btn ghost block" id="planUndo" disabled style="margin-top:12px">撤销上一步示例</button>'
].join("");
function renderPlan(){
  const messages={pending:"建议待确认；计划未变更。",accepted:"仅在当前页面演示“已应用”。正式应用要比较服务端 revision，未写入学习计划。",ignored:"已在本页忽略建议；正式忽略需记录原因与时窗。",conflict:"3011 · 服务端版本已变化。请先比较差异，再按最新版重新审阅；本地没有覆盖新版本。"};
  setStatus("#planStatus",messages[planState],planState==="conflict"?"bad":planState==="accepted"?"good":"warn");
  $("#planConflictDiff").hidden=planState!=="conflict";
  $("#planAccept").disabled=planState==="conflict";
  $("#planUndo").disabled=!planUndoAllowed;
}
$("#planAccept").addEventListener("click",()=>confirmLocal("确认计划差异","原计划与建议版本只在本地演示。正式应用须由服务端校验 expected revision；客观任务完成仍由学习证据决定。",()=>{planState="accepted";planRevision=planBaseRevision+1;planUndoAllowed=true;renderPlan();},"预览应用"));
$("#planIgnore").addEventListener("click",()=>{planState="ignored";planUndoAllowed=false;renderPlan();});
$("#planConflict").addEventListener("click",()=>{planState="conflict";planRevision=7;planUndoAllowed=false;renderPlan();});
$("#planReReview").addEventListener("click",()=>{
  planBaseRevision=7;planState="pending";planUndoAllowed=false;
  $("#planSuggestion .review-kicker").textContent="revision 7 → 重审建议版本 8";
  $("#planSuggestion .status-strip").textContent="最新：周三因式分解 5 题 → 重审建议：保持周三任务，周五加不等式性质 1 节，下周再练根的分布";
  renderPlan();mto("已基于最新版重审；仍需明确确认");
});
$("#planUndo").addEventListener("click",()=>{if(!planUndoAllowed||planRevision!==planBaseRevision+1)return;planState="pending";planRevision=planBaseRevision;planUndoAllowed=false;renderPlan();mto("本地撤销示例；正式撤销还需无后续消费与版本条件");});

/* BR-01/11：阶梯先开晋级战，晋级卷达标才解锁下一档。 */
const ladderDescription=$("#s24 .pad > .card:first-child .muted");
ladderDescription.textContent="7/8 题正确（87.5%）；还需 2 条有效题，达标后先开启晋级战";
$("#s24 .ring").style.setProperty("--v",".875");
$("#s24 .ring span").textContent="88%";
const ladderButton=$("#s24 .pad > .btn.block");
ladderButton.textContent="先补 2 道有效题，解锁晋级战";
ladderButton.removeAttribute("data-go");
ladderButton.addEventListener("click",()=>{go("s19");mto("练习题入口示例；晋级卷达标后才开启下一难度");});
$("#s24 .pad").insertAdjacentHTML("beforeend",'<div class="status-strip warn">晋级战需独立审核客观题池。内容缺失显示“筹备中”，不冒充能力锁定；晋级卷 ≥80% 后才开下一难度。</div>');
const ladderOldNote=$("#s24 .pad > p.muted");
if(ladderOldNote)ladderOldNote.textContent="当前 8 条有效客观题，先补 2 条再核对正确率；晋级战通过后才解锁下一档。";
$("#s25 .pad").insertAdjacentHTML("afterbegin",'<div class="status-strip warn" style="margin-bottom:14px;text-align:left">关卡、星数与周榜均为版式示例；普通关与 Boss 战采用不同反馈规则。</div>');
const bossCard=$$("#s25 .card").find(card=>card.textContent.includes("BOSS · 模拟卷"));
if(bossCard){bossCard.insertAdjacentHTML("beforeend",'<button type="button" class="btn ghost block" id="bossBrief" style="margin-top:12px">查看 Boss 战开考说明</button>');$("#bossBrief").addEventListener("click",()=>showRestrictedBrief("Boss 战"));}
const graphLegend=$("#s16 .pad .card.muted");
if(graphLegend)graphLegend.textContent="掌握 ≥80 且证据充足；低于 80 为薄弱；n<5 显示样本不足；前置锁定、内容筹备中与未学分别标记。颜色和文字同时说明状态。";

/* BR-06/08：公式七区与条件红条；长公式允许横向查看。 */
$("#s33 .pad").innerHTML=[
  '<span class="review-kicker">FORMULA LIBRARY · 七区阅读</span><h1 style="font-size:27px;line-height:1.25;margin:0 0 7px">勾股定理</h1><div class="microcopy">几何 · 严格证明示例 · 别名：商高定理、毕达哥拉斯定理</div>',
  '<div class="card" style="margin-top:14px"><div class="formula-scroll math" style="font-size:36px;text-align:center">a² + b² = c²</div><p class="microcopy" style="text-align:center">公式过长时可横向查看；变量和单位见下方符号表。</p></div>',
  '<div class="status-strip bad" style="margin-bottom:14px"><strong>成立条件：</strong>仅适用于直角三角形，a、b 为直角边，c 为斜边；边长为正且单位一致。</div>',
  '<details class="card" open><summary>01 · 起源</summary><p class="microcopy">从直角三角形三个正方形的面积关系理解。具体历史年代与来源需经内容审核后再展示。</p></details>',
  '<details class="card"><summary>02 · 符号表</summary><p class="microcopy">a、b：直角边长度；c：斜边长度；三者同单位，长度均为正实数。</p></details>',
  '<details class="card"><summary>03 · 推导链</summary><p class="microcopy">拼图面积法：(a+b)²=4×ab/2+c²；展开并消去 2ab，得 a²+b²=c²。每一步的合法性与动机在完整内容中单独校对。</p></details>',
  '<details class="card"><summary>04 · 条件与误用</summary><p class="microcopy">非直角三角形需要余弦定理修正项；不能写成 a+b=c。由平方关系还原边长时只取正根。</p></details>',
  '<details class="card"><summary>05 · 应用</summary><p class="microcopy">矩形对角线、平面两点距离和测高问题。应用题需先确认几何模型包含直角。</p></details>',
  '<details class="card"><summary>06 · 家族关系</summary><p class="microcopy">它是余弦定理在夹角 90° 时的特例；空间距离问题可逐层应用。</p></details>',
  '<details class="card"><summary>07 · 变形族</summary><p class="microcopy">c=√(a²+b²)；若 c>b>0，则 a=√(c²−b²)。开根必须结合长度正值约束。</p></details>',
  '<div class="sect">三种小练 · 各自独立</div><div class="choice-row" id="formulaPractice"><button type="button" data-formula-practice="辨条件">辨条件</button><button type="button" data-formula-practice="选符号">选符号</button><button type="button" data-formula-practice="算长度">算长度</button></div>',
  '<div class="status-strip" id="formulaPracticeStatus" style="margin-top:10px">选择一种练习查看题型说明；不会向题库提交作答。</div>',
  '<div class="row" data-go="s17" style="margin-top:14px"><div style="flex:1"><div class="t">关联知识点</div><div class="d">四张概念卡与代表题分开阅读</div></div><span class="ar">›</span></div>'
].join("");
$$("#s33 details summary").forEach(summary=>{summary.style.cursor="pointer";summary.style.minHeight="44px";summary.style.display="flex";summary.style.alignItems="center";summary.style.fontWeight="750";summary.style.fontSize="15px";});
$("#formulaPractice").addEventListener("click",e=>{
  const button=e.target.closest("[data-formula-practice]");if(!button)return;
  $$("#formulaPractice button").forEach(item=>item.classList.toggle("on",item===button));
  const notes={"辨条件":"判断三角形是否为直角；不满足时不能直接用 a²+b²=c²。","选符号":"辨认斜边 c 与两条直角边 a、b；交换 a、b 不改变关系。","算长度":"给定 a=3、b=4，示例问题是求斜边 c；正式判分由服务端完成。"};
  setStatus("#formulaPracticeStatus",notes[button.dataset.formulaPractice],"");
});
const nodeExternal=$("#s17 a[href='../review/index.html']");
if(nodeExternal){nodeExternal.removeAttribute("href");nodeExternal.setAttribute("role","button");nodeExternal.tabIndex=0;nodeExternal.textContent="查看关联应用示例 →";nodeExternal.addEventListener("click",()=>{go("s15");mto("关联应用示例：进入同题推理链；正式目标还需资源类型与版本校验");}); }
$("#fcTabs").setAttribute("role","tablist");
$$("#fcTabs .fc").forEach(tab=>{
  tab.setAttribute("role","tab");tab.tabIndex=0;
  tab.addEventListener("click",()=>{
    $$("#fcTabs .fc").forEach(item=>{const active=item===tab;item.classList.toggle("on",active);item.classList.toggle("gray",!active);item.setAttribute("aria-selected",String(active));});
    $$("#s17 .fcp").forEach(panel=>panel.style.display=panel.dataset.fc===tab.dataset.fc?"block":"none");
  });
});
$("#s17 .hr").insertAdjacentHTML("beforebegin",'<div class="card"><span class="review-kicker">代表题 · 独立于四卡</span><strong>把 x²−5x+6 分解成两个一次因子</strong><p class="microcopy" style="margin-top:7px">四卡讲概念，代表题用于验证应用；缺题时展示内容筹备中。</p></div>');
const graphSearch=$("#s16 input");
graphSearch.setAttribute("aria-label","搜索知识点示例");
graphSearch.addEventListener("input",()=>{
  const q=graphSearch.value.trim().toLocaleLowerCase();
  $$("#s16 .row").forEach(row=>row.hidden=!row.textContent.toLocaleLowerCase().includes(q));
});
const formulaCards=$$("#s32 .card[data-go='s33']");
formulaCards.slice(1).forEach(card=>{
  card.removeAttribute("data-go");
  card.setAttribute("role","button");card.tabIndex=0;
  card.addEventListener("click",()=>mto("本稿完整七区示例为勾股定理；该公式详情仍在内容筹备中"));
});
$("#s39 .aiwrap .card").textContent="全局对话未绑定当前题目；从题面发起时会带题号和步骤，并显示 60% 半屏。";

/* 图表以清楚的演示数据替换抽象占位纹理。 */
const charts=$$("#s30 .chartph");
if(charts.length===3){
  charts[0].innerHTML='<svg viewBox="0 0 300 140" role="img" aria-label="近七日练习正确率示例折线" style="width:100%;height:100%"><path d="M20 105 L65 88 L108 93 L151 65 L194 72 L237 50 L280 43" fill="none" stroke="#2F6BFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 105 L65 88 L108 93 L151 65 L194 72 L237 50 L280 43 L280 130 L20 130 Z" fill="#2F6BFF18"/><g fill="#2F6BFF"><circle cx="20" cy="105" r="4"/><circle cx="151" cy="65" r="4"/><circle cx="280" cy="43" r="4"/></g><text x="20" y="135" font-size="10" fill="#607188">周一</text><text x="246" y="135" font-size="10" fill="#607188">周日</text></svg>';
  charts[1].innerHTML='<div style="display:grid;gap:12px;padding:20px;font-size:12px"><div>工具选择　<span style="color:var(--p)">████████</span> 8</div><div>依据判断　<span style="color:var(--p)">██████</span> 6</div><div>回代检验　<span style="color:var(--warn)">███</span> 3</div><div class="microcopy">AI 建议与自报不计入客观画像。</div></div>';
  charts[2].innerHTML='<div style="display:grid;gap:14px;padding:20px;font-size:12px"><div>因式分解　<span style="color:var(--p)">██████</span> 样本充足</div><div>求根公式　<span style="color:var(--ink3)">███</span> 样本不足</div><div>根的分布　<span style="color:var(--ink3)">—</span> 尚未测量</div><div class="microcopy">不把无数据展示成 100% 掌握。</div></div>';
  $("#s30 .pad").insertAdjacentHTML("afterbegin",'<div class="status-strip warn" style="margin-bottom:14px">趋势与数字均为演示。客观判分、自评与 AI 建议分别统计。</div>');
}
const noteButton=$$("#s18 button").find(button=>button.textContent.includes("新建笔记"));
if(noteButton)noteButton.addEventListener("click",()=>{
  openFlowSheet("新建学习笔记 · 本地演示",'<label for="mobileNote" class="review-kicker">笔记内容</label><textarea id="mobileNote" style="width:100%;min-height:130px;border:1px solid var(--line);border-radius:12px;padding:12px" placeholder="写下你的思路…"></textarea><button type="button" class="btn block" id="saveMobileNote">保存到本机会话</button><div class="status-strip warn" style="margin-top:11px">正式笔记同步、冲突与资源锚点需服务端处理。</div>',true);
  $("#saveMobileNote").addEventListener("click",()=>{const value=$("#mobileNote").value.trim();if(!value){mto("先写点内容");return;}try{sessionStorage.setItem("lm-mobile-v2-note",value);}catch(error){}closeFlowSheet();mto("笔记仅保留在本机会话；未同步");});
});

/* 搜索和通知保留可用的本地筛选状态。 */
const mobileSearch=$("#s41 input");
mobileSearch.id="mobileSearch";mobileSearch.setAttribute("aria-label","搜索示例内容");
$("#s41 .pad").insertAdjacentHTML("beforeend",'<div id="searchEmpty" class="status-strip" hidden>没有匹配的本地示例；试试“公式”或“因式分解”。</div>');
mobileSearch.addEventListener("input",()=>{
  const q=mobileSearch.value.trim().toLocaleLowerCase();let count=0;
  $$("#s41 .row").forEach(row=>{const shown=row.textContent.toLocaleLowerCase().includes(q);row.hidden=!shown;if(shown)count++;});
  $("#searchEmpty").hidden=count>0;
});
const notificationAll=$$("#s40 .nav .rt")[0];
notificationAll.setAttribute("role","button");notificationAll.tabIndex=0;
notificationAll.addEventListener("click",()=>{notificationAll.textContent="本地已读样式";mto("仅修改本页演示状态；未更新通知服务");});
$$("#s36 button").forEach(button=>{if(button.textContent.includes("报名"))button.addEventListener("click",()=>mto("赛事报名入口示例；没有报名或修改榜单"));});

/* 设置与合规：仅预览状态，不假称文件、注销或服务端通知已生效。 */
$("#s43 .pad").innerHTML=[
  '<span class="review-kicker">DATA EXPORT · 请求流程</span><h2 style="font-size:24px;margin:0 0 12px">你的学习数据，应该方便带走。</h2>',
  '<div class="card"><strong>导出范围</strong><p class="microcopy" style="margin-top:8px">个人资料与设置、作答与成绩、错题本、笔记及收藏。正式导出需身份校验和服务端任务。</p></div>',
  '<div class="status-strip">真实导出包经站内信给下载链接，7 天后清除。本稿不创建 ZIP 或下载链接。</div>',
  '<button type="button" class="btn block" id="exportPreview" style="margin-top:15px">预览申请确认</button>',
  '<div class="card" style="margin-top:14px"><strong>历史导出</strong><p class="microcopy" style="margin-top:7px">本地演示没有读取历史任务。</p></div>'
].join("");
$("#exportPreview").addEventListener("click",()=>confirmLocal("申请导出 · 流程预览","正式产品会二次验证身份、创建服务端任务，并在完成后通过站内信给出有期限的下载链接。本稿不会生成文件。",()=>mto("已查看导出申请流程；没有生成任务"),"知道了"));
$("#s44 .pad").innerHTML=[
  '<span class="review-kicker">ACCOUNT · 注销流程</span><h2 style="font-size:24px;margin:0 0 12px">注销前，把后果说清楚。</h2>',
  '<div class="status-strip bad">以下为流程状态设计示例，不会注销账号或清除任何真实数据。</div>',
  '<div class="card" style="margin-top:14px"><strong>正式注销会影响</strong><p class="microcopy" style="margin-top:8px">积分与学习进度按协议处理；社区内容匿名化；冷静期结束后全端下线。具体数据清单需在正式确认页完整列出。</p></div>',
  '<div class="card"><strong>二次验证 → 最终确认</strong><p class="microcopy" style="margin-top:8px">敏感操作应校验身份，再展示最后确认与 7 天冷静期。按钮不会跳过验证。</p><button type="button" class="btn ghost block" id="deletionPreview">查看二次确认设计</button></div>',
  '<div class="card" style="border-color:#B9CBEE"><strong>冷静期样式示例</strong><p class="microcopy" style="margin-top:8px">剩余 6 天 23 小时 · 此数字为固定展示，不是实际倒计时。</p><button type="button" class="btn gray block" id="deletionUndoPreview">查看撤销规则</button></div>'
].join("");
$("#deletionPreview").addEventListener("click",()=>confirmLocal("注销确认设计","正式流程要求短信或等效二次验证、列出待删除数据与冷静期、记录服务端确认。此处不提交申请。",()=>mto("仅查看流程；账号未改变"),"知道了"));
$("#deletionUndoPreview").addEventListener("click",()=>mto("正式撤销须在冷静期内通过身份与状态校验；本稿没有申请可撤销"));
const settingExit=$$("#s42 button").find(b=>b.textContent.includes("退出登录"));
if(settingExit)settingExit.addEventListener("click",()=>confirmLocal("退出登录 · 设计预览","本稿没有真实登录会话；这一步用于评审二次确认与返回入口。",()=>go("s04"),"返回登录页"));

/* 次要操作也给出准确回执。 */
const ckButton=$("#ckBtn2");
if(ckButton)ckButton.addEventListener("click",()=>{ckButton.textContent="本地打卡样式";ckButton.disabled=true;mto("仅演示打卡状态；未写积分、连续天数或服务端事件");});
$$("#s31 button").forEach(button=>{if(button.textContent.includes("海报"))button.addEventListener("click",()=>mto("分享海报为设计入口；本稿未生成图片"));});
$$("#s21 button").forEach(button=>{if(button.textContent.includes("海报"))button.addEventListener("click",()=>mto("分享海报为设计入口；本稿未生成图片"));});
$$("#s37 button").forEach(button=>{if(button.textContent.includes("提交")||button.textContent.includes("发布"))button.addEventListener("click",()=>mto("发帖仅示意审核流程；没有提交社区内容"));});
$$("#s38 button").forEach(button=>{if(button.textContent.includes("回复"))button.addEventListener("click",()=>mto("回复仅示意编辑入口；没有提交社区内容"));});
const postAction=$("#s37 .nav .rt");
if(postAction){postAction.setAttribute("role","button");postAction.tabIndex=0;postAction.addEventListener("click",()=>mto("发帖仅示意审核流程；没有提交社区内容"));}
$$("#s38 button").forEach(button=>{if(button.textContent.includes("发送"))button.addEventListener("click",()=>mto("回复仅示意编辑入口；没有提交社区内容"));});
$$("[data-go]").forEach(el=>{
  if(el.tagName==="A")el.setAttribute("href","#"+el.dataset.go);
  else if(!["BUTTON","INPUT"].includes(el.tagName)){el.setAttribute("role","button");el.tabIndex=0;}
});
/* 首次展示首页；评审目录仍可打开完整 S01–S44。 */
directGo("s08");
})();
