/** Static design checks and arithmetic examples; NOT backend/UAT tests. */
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const docs=join(root,'docs');
const paths=readdirSync(docs).filter(n=>/^\d\d-.*\.md$/.test(n));
const read=n=>readFileSync(join(docs,paths.find(p=>p.startsWith(String(n).padStart(2,'0')+'-'))),'utf8');
const failures=[];let checks=0;
function check(ok,label){checks++;if(!ok)failures.push(label);}
const rules=read(20), tests=read(7), requirement=read(1);
for(let i=1;i<=11;i++){const id=`BR-${String(i).padStart(2,'0')}`;check(requirement.includes(id)&&rules.includes(id),`${id}: requirement and specification`);}
for(let i=1;i<=12;i++){const id=`D${String(i).padStart(2,'0')}`;check(tests.includes(`| ${id} |`)&&rules.includes(id),`${id}: mapped acceptance`);}
const forbidden=[/静默校准/,/不阻塞标记完成/,/完成按钮仍可用/,/30 天未碰/,/status<3/,/draft:true/,/权重 ×0\.8/,/公式卡可开、小练入口隐藏/,/连 3 天未完成 → 插入先修复测/];
for(const name of paths.filter(n=>!n.startsWith('19-'))){
  const full=readFileSync(join(docs,name),'utf8');
  const live=full.split('## 变更记录')[0];
  for(const pattern of forbidden)check(!pattern.test(live),`${name}: obsolete rule ${pattern}`);
  check((full.match(/^```/gm)||[]).length%2===0,`${name}: balanced fences`);
  for(const match of full.matchAll(/\]\((\.\.?\/[^)]+)\)/g)){
    const target=decodeURIComponent(match[1].split('#')[0]);
    check(existsSync(resolve(docs,target)),`${name}: link ${target}`);
  }
}
// Independently evaluate the published reference examples, not production code.
function mastery({answers=[],difficulty=3,days=0}){
  if(!answers.length)return null;
  const weights=answers.map((_,i)=>2**((i+1-answers.length)/answers.length));
  const base=answers.reduce((s,v,i)=>s+v*weights[i],0)/weights.reduce((s,v)=>s+v,0);
  const raw=Math.max(0,Math.min(100,100*base*(1+0.05*(difficulty-3))));
  return Math.round(Math.max(0,raw-Math.max(0,days-14)*1.5)*100)/100;
}
const fixtures=[
  [{},null],[{answers:[1,1,1,1,1]},100],[{answers:[1,1,1,1,1],difficulty:1},90],
  [{answers:[0,0,0,0,0]},0],...[[14,100],[15,98.5],[30,76],[31,74.5]].map(([days,expected])=>[{answers:[1,1,1,1,1],days},expected])
];
fixtures.forEach(([input,expected],i)=>check(mastery(input)===expected,`mastery reference ${i+1}`));
check(mastery({answers:[0,1]})>mastery({answers:[1,0]}),'newer answer weighs more');
check(rules.includes('baseScore=clamp(100×base×factor,0,100)')&&rules.includes('score=roundHalfUp'),'formula scales before decay');
const htmlFiles=['web','mobile','official','review'].map(n=>join(docs,'design',n,'index.html'));
for(const file of htmlFiles){
  const html=readFileSync(file,'utf8');
  const ids=[...html.matchAll(/\bid="([^"\s]+)"/g)].map(m=>m[1]);
  check(ids.length===new Set(ids).size,`${file}: unique ids`);
  const targets=[...html.matchAll(/data-go="([^"]+)"/g)].map(m=>m[1]);
  for(const target of new Set(targets))check(ids.includes(target),`${file}: target ${target}`);
  for(const m of html.matchAll(/(?:src|href)="(\.\.?\/[^"#]+)"/g))check(existsSync(resolve(dirname(file),decodeURIComponent(m[1]))),`${file}: local asset ${m[1]}`);
  for(const [i,m] of [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].entries()){
    if(!m[1].trim()||/type="application\/ld\+json"/.test(m[0]))continue;
    try{new vm.Script(m[1],{filename:`${file}:script${i}`});check(true,'script parses');}catch(e){check(false,`${file}: ${e.message}`);}
  }
}
const shared=join(docs,'design/shared/review-enhancements.js');
try{new vm.Script(readFileSync(shared,'utf8'));check(true,'shared prototype script parses');}catch(e){check(false,e.message);}
const sourceFiles=[...paths.map(n=>join(docs,n)),...htmlFiles,shared];
const digests=Object.fromEntries(sourceFiles.map(p=>[p.slice(root.length+1).replaceAll('\\','/'),createHash('sha256').update(readFileSync(p)).digest('hex')]));
console.log(JSON.stringify({scope:'static_design_and_reference_examples_only',checks,failed:failures.length,failures,runtimeAcceptance:'NOT_RUN',sourceSha256:digests},null,2));
if(failures.length)process.exitCode=1;
