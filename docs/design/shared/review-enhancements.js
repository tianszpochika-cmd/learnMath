/* Design-only state demonstrations. No backend, grading or authorization claims. */
(() => {
  'use strict';
  const web = !!document.getElementById('w09');
  const mobile = !!document.getElementById('s21');
  const banner = document.createElement('aside');
  banner.style.cssText='position:fixed;right:12px;bottom:12px;z-index:9999;background:#112b46;color:white;padding:10px 16px;border-radius:12px;max-width:calc(100vw - 24px);font:14px/1.6 system-ui;box-shadow:0 4px 18px #0002';
  const link = document.createElement('a');
  link.href='../review/index.html'; link.style.color='white';
  link.textContent='查看完成、自评、恢复与计划的闭环演示 →';
  banner.append(link); document.body.append(banner);
  if (!web && !mobile) {
    const tab=document.querySelector('[data-gl="3"]');
    const pane=document.querySelector('.gl-pane[data-gl="3"], .gl-panel[data-gl="3"]');
    if(tab)tab.textContent='能力地图';
    if(pane)pane.innerHTML='<h3>能力地图</h3><p>用正弦描述波动、分析周期和测量高度。代表题在四卡之后独立展示。</p><a href="../review/index.html">继续学习这个概念</a>';
    return;
  }
  const report=document.getElementById(web?'w09':'s21');
  const card=document.createElement('div');card.className='card';card.style.margin='16px';
  card.innerHTML='<h3>解答题自评 · 与客观分分开展示</h3><p>解释为什么边长的平方根取正值。</p><details><summary>对照参考解析</summary><p>边长为正实数，因此从平方关系还原边长时取正的平方根。</p></details><p data-self-status role="status">待评价：1 题；离开本页后可以回来继续。</p><div data-self-options style="display:flex;gap:8px;flex-wrap:wrap"></div><p style="font-size:13px;color:#52657b">自评不会提高客观掌握度或榜单成绩，改评不重发积分。本原型状态保存在当前页面会话。</p>';
  ['不会','半会','会','暂不评价'].forEach(label=>{const b=document.createElement('button');b.className='btn';b.textContent=label;b.onclick=()=>{card.querySelector('[data-self-status]').textContent='本题自评：'+label+'；待评价：0 题。客观成绩不变。';};card.querySelector('[data-self-options]').append(b);});
  report.append(card);
  const formula=document.getElementById(web?'w14':'s33');
  const sections=document.createElement('div');sections.className='card';sections.style.margin='16px';
  sections.innerHTML='<h3>勾股定理 · 七件套完整研习</h3><details><summary>起源</summary><p>从直角三角形三边上的正方形面积关系出发理解。历史出处待补全，不给出未经审核的年代断言。</p></details><details><summary>符号表</summary><p>a、b为两条直角边，c为斜边；均为正实数，使用相同长度单位。</p></details><details><summary>推导链</summary><p>面积拼图：(a+b)²=4×ab/2+c²，展开并消去2ab，得a²+b²=c²。</p><a href="../review/index.html">展开对应公式研习</a></details><details><summary>完整条件与误用边界</summary><p>夹角90°；斜边与直角边身份不可混淆；一般三角形不能省略余弦定理的修正项，也不能推出a+b=c。</p></details><details><summary>应用</summary><p>矩形对角线、平面两点距离、测高问题。</p><a href="../review/index.html">进入测量应用</a></details><details><summary>家族关系</summary><p>余弦定理的直角特例；连续应用得到空间距离关系。</p></details><details><summary>变形族</summary><p>c=√(a²+b²)；c&gt;b&gt;0时a=√(c²−b²)；边长取正根。</p></details>';
  formula.append(sections);
  const lesson=document.getElementById(web?'w04':'s14');
  const completion=[...lesson.querySelectorAll('button')].filter(b=>b.textContent.includes('标记完成'));
  let passed=false,done=false;
  const read=document.createElement('label');read.style.cssText='display:block;padding:12px;background:#edf3ff;border-radius:8px;margin:12px';
  read.innerHTML='<input type="checkbox"> 我已读完（默认还需随堂练达标才能完成课时）';
  lesson.prepend(read);
  const state=document.createElement('p');state.setAttribute('role','status');state.style.margin='12px';state.textContent='课时进行中；请确认阅读并完成随堂练。';read.after(state);
  function refresh(){completion.forEach(b=>{b.disabled=done||!passed||!read.querySelector('input').checked;});}
  read.querySelector('input').onchange=refresh;
  lesson.querySelectorAll(web?'.qz':'.quiz1').forEach(b=>b.addEventListener('click',()=>{passed=(b.dataset.r||b.dataset.ok)==='1';state.textContent=passed?'随堂练已达标；掌握度仍按有效证据判断。':'随堂练未达标，可先记录阅读并再练。';refresh();}));
  completion.forEach(b=>{b.removeAttribute('onclick');b.removeAttribute('data-go');b.onclick=()=>{if(done||!passed||!read.querySelector('input').checked)return;done=true;state.textContent='课时已完成，首次积分+10。掌握度不作固定上升承诺。';b.textContent='已完成';refresh();};});refresh();
  // Place representative questions after the four semantic cards.
  const node=document.getElementById(web?'w07':'s17');
  const examples=document.createElement('p');examples.className=web?'mut':'muted';examples.textContent='代表题（四卡之后）：因式分解、十字相乘与零点问题。';node.append(examples);
})();
