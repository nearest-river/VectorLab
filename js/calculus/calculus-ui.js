/* VectorLab Calculus UI — DOM only. Math: js/calculus/calculus-engine.js (Nerdamer).
   Graphs: function-plot. Both libraries load lazily the first time the Calculus tab opens.
   This file never does any maths itself: it calls CalcLab.limit / differentiate / integrate / definite
   exactly as before and only changes how inputs, states and results are presented. */
(function(){
const q=s=>document.querySelector(s),qa=s=>Array.from(document.querySelectorAll(s)),C=()=>window.CalcLab;
const LIBS=['js/vendor/nerdamer.bundle.min.js','js/calculus/calculus-engine.js','js/vendor/function-plot.min.js'];
let libs=null;
function load(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('LOAD'));document.head.appendChild(s);});}
function ensureLibs(){return libs||(libs=LIBS.reduce((p,s)=>p.then(()=>load(s)),Promise.resolve()).catch(e=>{libs=null;throw e;}));}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const frame=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
const calm=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- LaTeX (KaTeX, MathML output: no stylesheet needed) ---------- */
function m(t,block){if(!window.katex)return '<span class="sm-term">'+esc(t)+'</span>';
  try{return '<span class="sm-term">'+katex.renderToString(t,{output:'mathml',displayMode:!!block,throwOnError:false})+'</span>';}catch(e){return '<span class="sm-term">'+esc(t)+'</span>';}}
/* a few engine strings contain plain-text maths; show them as LaTeX without touching the engine */
const TITLE_TEX=[
  [/^Use d\/du\[a\u1d58\] = a\u1d58 ln a \u00b7 du\/d(\w)$/,(x)=>['Use ',m('\\frac{d}{du}\\left[a^{u}\\right]=a^{u}\\ln a\\cdot\\frac{du}{d'+x+'}')]],
  [/^Use \u222b a\u02e3 dx = a\u02e3 \/ ln a$/,()=>['Use ',m('\\int a^{x}\\,dx=\\frac{a^{x}}{\\ln a}')]],
  [/^Apply \u222b u dv = uv \u2212 \u222b v du$/,()=>['Apply ',m('\\int u\\,dv=uv-\\int v\\,du')]],
  [/^Recognise 1\/x$/,()=>['Recognise ',m('\\frac{1}{x}')]],
  [/^Subtract: F\(b\) \u2212 F\(a\)$/,()=>['Subtract: ',m('F(b)-F(a)')]],
  [/^Substitute: indeterminate form 0\/0$/,()=>['Substitute: indeterminate form ',m('\\tfrac{0}{0}')]],
  [/^Both parts grow without bound: \u221e\/\u221e$/,()=>['Both parts grow without bound: ',m('\\tfrac{\\infty}{\\infty}')]]];
function titleHtml(t){for(const [re,fn] of TITLE_TEX){const g=t.match(re);if(g)return fn.apply(null,g.slice(1)).join('');}return esc(t);}
function noteHtml(n){return esc(n).replace(/F\u2032\(x\) = f\(x\)/g,()=>m("F'(x)=f(x)"));}
function steps(list){return '<ol class="cl-steplist">'+list.map(s=>'<li class="cl-step"><div><h4>'+titleHtml(s.t)+'</h4>'+s.l.map(l=>'<div class="cl-line">'+m(l)+'</div>').join('')+(s.n?'<p class="cl-note">'+noteHtml(s.n)+'</p>':'')+
  (s.sub?'<details class="cl-more"><summary>Show how the antiderivative was found</summary>'+steps(s.sub)+'</details>':'')+'</div></li>').join('')+'</ol>';}
const ruleBadge=r=>r?'<span class="cl-rule"><small>Rule</small>'+esc(r)+'</span>':'';

/* ---------- tabs inside Calculus ---------- */
const TABS=['home','limits','diff','int','defint','guides'];
function fadeTabs(){const n=q('#cl-tabnav');if(!n)return;const max=n.scrollWidth-n.clientWidth;
  n.classList.toggle('cl-fade-r',max>4&&n.scrollLeft<max-4);n.classList.toggle('cl-fade-l',n.scrollLeft>4);}
function showCl(k){if(!TABS.includes(k))k='home';
  qa('.cl-panel').forEach(p=>p.hidden=p.id!=='cl-'+k);
  qa('#cl-tabs button').forEach(b=>{const on=b.dataset.cl===k;b.setAttribute('aria-pressed',on);if(on&&b.scrollIntoView&&q('#cl-tabnav').scrollWidth>q('#cl-tabnav').clientWidth)b.scrollIntoView({inline:'center',block:'nearest',behavior:calm()?'auto':'smooth'});});
  if(k==='guides')renderGuides();
  setTimeout(()=>{fadeTabs();redraw();},0);}
qa('#cl-tabs button,[data-cl-go]').forEach(b=>b.addEventListener('click',()=>showCl(b.dataset.cl||b.dataset.clGo)));
q('#cl-tabnav').addEventListener('scroll',fadeTabs,{passive:true});window.addEventListener('resize',fadeTabs);
qa('#cats button').forEach(b=>{if(b.dataset.cat==='calculus')b.addEventListener('click',()=>{ensureLibs().then(refreshPreviews).catch(()=>{});setTimeout(fadeTabs,0);});});
qa('[data-tex]').forEach(el=>{el.innerHTML=m(el.dataset.tex);});

/* ---------- shared result states: empty / loading / error / result ---------- */
const busy={};
function view(p,state,msg){['empty','loading','error','result'].forEach(s=>{q('#cl-'+p+'-'+s).hidden=s!==state;});if(state==='error')q('#cl-'+p+'-errmsg').textContent=msg||'Something went wrong evaluating that expression.';}
function reveal(p){const el=q('#cl-'+p+'-out');if(!el)return;const r=el.getBoundingClientRect();
  if(r.top>innerHeight*.7||r.top<-40)el.scrollIntoView({behavior:calm()?'auto':'smooth',block:'start'});}
function friendly(e){const t=e&&e.message;if(t==='LOAD')return 'The calculus engine could not be loaded. Check your connection and try again.';return t||'Something went wrong evaluating that expression.';}
async function run(p,job){
  if(busy[p])return;busy[p]=true;const btn=q('#cl-'+p+'-run'),label=btn.innerHTML;
  btn.disabled=true;btn.setAttribute('aria-busy','true');btn.innerHTML='<span class="cl-spin" aria-hidden="true"></span>Calculating\u2026';
  q('#cl-'+p+'-loadmsg').textContent=libs?'Calculating\u2026':'Loading the calculus engine\u2026';view(p,'loading');
  try{await ensureLibs();await frame();await job();reveal(p);}
  catch(e){view(p,'error',friendly(e));}
  finally{busy[p]=false;btn.disabled=false;btn.removeAttribute('aria-busy');btn.innerHTML=label;}}
function fill(p,{answer,hint,est,rule,body,alabel}){
  q('#cl-'+p+'-answer').innerHTML=answer;q('#cl-'+p+'-alabel').textContent=alabel||'Answer';
  const h=q('#cl-'+p+'-ahint');h.hidden=!hint;h.textContent=hint||'';h.className='cl-ahint'+(est?' est':'');
  q('#cl-'+p+'-rule').innerHTML=ruleBadge(rule);q('#cl-'+p+'-steps').innerHTML=body;view(p,'result');}

/* ---------- graphs (function-plot) ---------- */
function yRange(fns,d){const v=[];for(const f of fns)for(let i=0;i<=120;i++){const y=f.f(d[0]+(d[1]-d[0])*i/120);if(isFinite(y))v.push(y);}
  if(v.length<2)return null;v.sort((a,b)=>a-b);let lo=v[Math.floor(v.length*.04)],hi=v[Math.ceil(v.length*.96)-1];if(hi-lo<1e-6){lo-=1;hi+=1;}const pad=(hi-lo)*.12;return[lo-pad,hi+pad];}
function noGraph(target,msg){q(target).innerHTML='<p class="cl-nograph">'+esc(msg||'No graph is available for this expression.')+'</p>';}
function plot(target,fns,domain,marks){
  const el=q(target);el.innerHTML='';if(!window.functionPlot)return;
  const yr=yRange(fns,domain);
  if(!yr||fns.some(f=>{for(let i=0;i<=40;i++){if(isFinite(f.f(domain[0]+(domain[1]-domain[0])*i/40)))return false;}return true;}))
    return noGraph(target,'No graph: this expression has no real values to plot on this range (it may use symbols other than x, or be undefined here).');
  try{functionPlot({target:el,width:Math.max(260,el.clientWidth||320),height:Math.min(320,Math.max(220,(el.clientWidth||320)*.62)),grid:true,xAxis:{domain},yAxis:{domain:yr},disableZoom:false,
    data:fns.map(f=>({graphType:'polyline',fn:s=>f.f(s.x),color:f.color})),annotations:marks||[]});}catch(e){noGraph(target,'Graph unavailable for this expression.');}}
function legend(el,items){el.innerHTML=items.map(i=>'<span style="--c:'+i[0]+'">'+i[1]+'</span>').join('');}

/* ---------- live "Reads as" preview (display only) ---------- */
const PV={};
function showPreview(p,fn){const el=q('#cl-'+p+'-pv');if(!el)return;
  const raw=(q('#cl-'+p+'-f').value||'').trim();
  if(!raw){el.innerHTML='<span class="cl-pm">Type above and it appears here as math.</span>';return;}
  if(!C()){el.innerHTML='<span class="cl-pm">Loading the math engine\u2026</span>';return;}
  try{el.innerHTML=m(fn());}catch(e){el.innerHTML='<span class="cl-pm bad">Can\u2019t read this yet. Check brackets and operators.</span>';}}
const T=s=>C().tex(C().norm(s));
PV.l=()=>{const dir=q('#cl-l-dir [aria-pressed=true]').dataset.v,a=q('#cl-l-a').value.trim();if(!a)throw 0;const inf=/inf/i.test(a);
  return '\\lim_{x\\to '+T(a)+(inf?'':dir==='left'?'^{-}':dir==='right'?'^{+}':'')+'}'+T(q('#cl-l-f').value);};
PV.d=()=>{const n=+q('#cl-d-n [aria-pressed=true]').dataset.v;return (n>1?'\\frac{d^{'+n+'}}{dx^{'+n+'}}':'\\frac{d}{dx}')+'\\left['+T(q('#cl-d-f').value)+'\\right]';};
PV.i=()=>'\\int '+T(q('#cl-i-f').value)+'\\,dx';
PV.di=()=>{const a=q('#cl-di-a').value.trim(),b=q('#cl-di-b').value.trim();if(!a||!b)throw 0;return '\\int_{'+T(a)+'}^{'+T(b)+'}'+T(q('#cl-di-f').value)+'\\,dx';};
let pt={};
function schedulePreview(p){clearTimeout(pt[p]);pt[p]=setTimeout(()=>showPreview(p,PV[p]),140);}
function refreshPreviews(){Object.keys(PV).forEach(p=>showPreview(p,PV[p]));}

/* ---------- limits ---------- */
let lastL=null,lastD=null;
const setSeg=(sel,v)=>qa(sel+' button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===v));
const segVal=sel=>q(sel+' [aria-pressed=true]').dataset.v;
function runLimit(){return run('l',async()=>{
  const r=C().limit(q('#cl-l-f').value,'x',q('#cl-l-a').value,segVal('#cl-l-dir'));lastL=r;
  fill('l',{answer:m(r.tex.input+'='+r.tex.result,true),est:r.est,hint:r.est?'Numerical estimate \u2014 the symbolic engine could not settle this exactly.':'',body:steps(r.steps),alabel:'Result'});
  drawL();});}
function drawL(){if(!lastL||q('#cl-limits').hidden)return;const r=lastL,inf=/Infinity/.test(r.a);let c=0;try{c=inf?0:parseFloat(nerdamer(r.a).evaluate().text('decimals'));}catch(e){}
  q('#cl-l-gwrap').hidden=false;let f;
  try{f=C().compile(r.input,'x');}catch(e){noGraph('#cl-l-graph','Graph unavailable for this expression.');q('#cl-l-legend').innerHTML='';return;}
  const w=inf?10:4,d=inf?[(r.a[0]==='-'?-30:0),(r.a[0]==='-'?0:30)]:[c-w,c+w];
  plot('#cl-l-graph',[{f,color:'#5cf2b0'}],d,inf?[]:[{x:c,text:'x = '+(+c.toFixed(3))}]);
  legend(q('#cl-l-legend'),[['#5cf2b0','f(x)'],['#8b95b5','x = approach value']]);}

/* ---------- differentiation ---------- */
function runDiff(){return run('d',async()=>{
  const n=+segVal('#cl-d-n'),r=C().differentiate(q('#cl-d-f').value,'x',n);lastD=r;
  const dx=n>1?'\\frac{d^{'+n+'}}{dx^{'+n+'}}':'\\frac{d}{dx}';
  let h=steps(r.steps);
  if(n>1)h+='<div class="cl-step-more"><h4 class="cl-sec" style="margin:14px 0 8px;font-size:14px">Higher derivatives</h4>'+r.chain.map((c,i)=>'<div class="cl-line">'+m('f'+"'".repeat(i+1)+'(x)='+C().tex(c))+'</div>').join('')+'<p class="cl-note">The rule breakdown above explains the first derivative; each further derivative repeats the process.</p></div>';
  fill('d',{answer:m(dx+'\\left['+r.tex.input+'\\right]='+r.tex.result,true),rule:r.rule,body:h,alabel:n>1?'Derivative of order '+n:'Derivative'});
  drawD();});}
function drawD(){if(!lastD||q('#cl-diff').hidden)return;const r=lastD;q('#cl-d-gwrap').hidden=false;let f,g;
  try{f=C().compile(r.input,'x');g=C().compile(r.chain[r.order-1],'x');}catch(e){noGraph('#cl-d-graph','Graph unavailable for this expression (it could not be turned into a plottable function).');q('#cl-d-legend').innerHTML='';return;}
  plot('#cl-d-graph',[{f,color:'#5cf2b0'},{f:g,color:'#ffc857'}],[-6,6]);
  legend(q('#cl-d-legend'),[['#5cf2b0','f(x)'],['#ffc857',r.order>1?'f'+"'".repeat(Math.min(r.order,3))+'(x)':'f\u2032(x)']]);}

/* ---------- indefinite integration ---------- */
function runInt(){return run('i',async()=>{
  const r=C().integrate(q('#cl-i-f').value);
  fill('i',{answer:m(r.tex.input+'='+r.tex.result+'+C',true),rule:r.rule,body:steps(r.steps),alabel:'Antiderivative'});});}

/* ---------- definite integration ---------- */
function runDef(){return run('di',async()=>{
  const r=C().definite(q('#cl-di-f').value,q('#cl-di-a').value,q('#cl-di-b').value);
  fill('di',{answer:m(r.tex.input+'='+r.tex.exact+(r.tex.approx?'\\approx '+r.tex.approx:''),true),hint:r.zeroWidth?'Both bounds are equal, so the interval has no width and the integral is 0.':'',rule:r.rule,body:steps(r.steps),alabel:'Value of the integral'});});}

/* ---------- examples (LaTeX shown on the chips, plain text goes to the engine) ---------- */
const LEX=[['sin(x)/x','0','\\frac{\\sin x}{x}','0'],['(x^2-1)/(x-1)','1','\\frac{x^2-1}{x-1}','1'],['(1-cos(x))/x^2','0','\\frac{1-\\cos x}{x^2}','0'],['(3x^2+1)/(2x^2-5)','inf','\\frac{3x^2+1}{2x^2-5}','\\infty'],
  ['(1+1/x)^x','inf','\\left(1+\\frac1x\\right)^x','\\infty'],['(e^x-1)/x','0','\\frac{e^x-1}{x}','0'],['abs(x)/x','0','\\frac{|x|}{x}','0'],['1/x','0','\\frac1x','0']];
const DEX=[['x^3+2x','x^3+2x'],['sin(x^2)','\\sin(x^2)'],['x*sin(x)','x\\sin x'],['sin(x)/x','\\frac{\\sin x}{x}'],['ln(x^2+1)','\\ln(x^2+1)'],['e^(3x)','e^{3x}'],['(x^2+1)/(x-1)','\\frac{x^2+1}{x-1}'],['cos(3x+1)^2','\\cos^2(3x+1)']];
const IEX=[['x^3+2x','x^3+2x'],['sqrt(x)','\\sqrt{x}'],['1/x','\\frac1x'],['3sin(x)-2cos(x)','3\\sin x-2\\cos x'],['e^(2x)','e^{2x}'],['ln(x)','\\ln x'],['x*e^x','xe^x'],['x*sin(x)','x\\sin x'],['2x*cos(x^2)','2x\\cos(x^2)'],['1/(2x+1)','\\frac{1}{2x+1}'],['sin(x)^2','\\sin^2 x'],['1/(1+x^2)','\\frac{1}{1+x^2}']];
const DIEX=[['x^2','0','3','x^2','0','3'],['sin(x)','0','pi','\\sin x','0','\\pi'],['e^x','0','1','e^x','0','1'],['1/x','1','e','\\frac1x','1','e'],['1/(1+x^2)','0','1','\\frac{1}{1+x^2}','0','1'],['x*e^x','0','1','xe^x','0','1'],
  ['sqrt(x)','0','4','\\sqrt{x}','0','4'],['2x*cos(x^2)','0','sqrt(pi)','2x\\cos(x^2)','0','\\sqrt{\\pi}'],['x^3','3','0','x^3','3','0'],['cos(x)^2','0','pi/2','\\cos^2 x','0','\\tfrac{\\pi}{2}']];
const chip=(tex,label,i)=>'<button class="chip" type="button" data-i="'+i+'" aria-label="'+esc(label)+'">'+m(tex)+'</button>';
q('#cl-l-ex').innerHTML=LEX.map((e,i)=>chip(e[2]+'\\;(x\\to '+e[3]+')','Example: '+e[0]+' as x approaches '+e[1],i)).join('');
q('#cl-d-ex').innerHTML=DEX.map((e,i)=>chip(e[1],'Example: '+e[0],i)).join('');
q('#cl-i-ex').innerHTML=IEX.map((e,i)=>chip('\\int '+e[1]+'\\,dx','Example: integral of '+e[0],i)).join('');
q('#cl-di-ex').innerHTML=DIEX.map((e,i)=>chip('\\int_{'+e[4]+'}^{'+e[5]+'}'+e[3]+'\\,dx','Example: integral of '+e[0]+' from '+e[1]+' to '+e[2],i)).join('');

/* ---------- wiring ---------- */
function setVals(map){Object.keys(map).forEach(id=>{q(id).value=map[id];});}
function pick(e){const b=e.target.closest('button');return b?+b.dataset.i:-1;}
q('#cl-l-ex').onclick=e=>{const i=pick(e);if(i<0)return;const x=LEX[i];setVals({'#cl-l-f':x[0],'#cl-l-a':x[1]});setSeg('#cl-l-dir','both');schedulePreview('l');runLimit();};
q('#cl-d-ex').onclick=e=>{const i=pick(e);if(i<0)return;q('#cl-d-f').value=DEX[i][0];schedulePreview('d');runDiff();};
q('#cl-i-ex').onclick=e=>{const i=pick(e);if(i<0)return;q('#cl-i-f').value=IEX[i][0];schedulePreview('i');runInt();};
q('#cl-di-ex').onclick=e=>{const i=pick(e);if(i<0)return;const x=DIEX[i];setVals({'#cl-di-f':x[0],'#cl-di-a':x[1],'#cl-di-b':x[2]});schedulePreview('di');runDef();};
[['l',runLimit],['d',runDiff],['i',runInt],['di',runDef]].forEach(([p,fn])=>{q('#cl-'+p+'-form').addEventListener('submit',e=>{e.preventDefault();fn();});
  qa('#cl-'+p+'-form input').forEach(i=>i.addEventListener('input',()=>schedulePreview(p)));});
q('#cl-l-dir').addEventListener('click',e=>{const b=e.target.closest('button');if(b){setSeg('#cl-l-dir',b.dataset.v);schedulePreview('l');}});
q('#cl-d-n').addEventListener('click',e=>{const b=e.target.closest('button');if(b){setSeg('#cl-d-n',b.dataset.v);schedulePreview('d');}});

/* ---------- Methods & Guides ---------- */
const G=[
 {k:'limits',name:'Limits',page:'calculus-limits',items:[
  ['direct-substitution','Direct substitution','\\lim_{x\\to a}f(x)=f(a)','The function is defined at a. Always try this first.',{tab:'limits',f:'x^2+3x',a:'2'}],
  ['factorization','Factorization','\\frac{x^2-1}{x-1}=x+1','Substitution gives 0/0 and top and bottom share a factor.',{tab:'limits',f:'(x^2-1)/(x-1)',a:'1'}],
  ['rationalization','Rationalization','\\frac{\\sqrt{x}-2}{x-4}\\cdot\\frac{\\sqrt{x}+2}{\\sqrt{x}+2}','A square root causes 0/0. Multiply by the conjugate.',{tab:'limits',f:'(sqrt(x)-2)/(x-4)',a:'4'}],
  ['standard-trig-limits','Standard trigonometric limits','\\lim_{x\\to0}\\frac{\\sin x}{x}=1','A trig function sits over x as x approaches 0.',{tab:'limits',f:'sin(x)/x',a:'0'}],
  ['one-sided-limits','One-sided limits','\\lim_{x\\to a^-}f\\ne\\lim_{x\\to a^+}f','The function jumps, blows up or has an absolute value at a.',{tab:'limits',f:'abs(x)/x',a:'0'}]]},
 {k:'diff',name:'Differentiation',page:'calculus-differentiation',items:[
  ['power-rule','Power rule','\\frac{d}{dx}x^n=nx^{n-1}','Differentiating x raised to a constant power.',{tab:'diff',f:'x^3+2x'}],
  ['product-rule','Product rule','(uv)\'=u\'v+uv\'','Two functions of x are multiplied together.',{tab:'diff',f:'x*sin(x)'}],
  ['quotient-rule','Quotient rule','\\left(\\frac{u}{v}\\right)\'=\\frac{u\'v-uv\'}{v^2}','One function of x is divided by another.',{tab:'diff',f:'(x^2+1)/(x-1)'}],
  ['chain-rule','Chain rule','\\frac{d}{dx}f(g(x))=f\'(g(x))\\,g\'(x)','A function sits inside another function.',{tab:'diff',f:'sin(x^2)'}],
  ['trigonometric','Trigonometric functions','\\frac{d}{dx}\\sin x=\\cos x','Sine, cosine and tangent have standard derivatives.',{tab:'diff',f:'sin(x)+cos(x)'}],
  ['exponential','Exponential functions','\\frac{d}{dx}e^{x}=e^{x}','The variable is in the exponent.',{tab:'diff',f:'e^(3x)'}],
  ['logarithmic','Logarithmic functions','\\frac{d}{dx}\\ln x=\\frac{1}{x}','The function contains a natural logarithm.',{tab:'diff',f:'ln(x^2+1)'}]]},
 {k:'int',name:'Integration',page:'calculus-integration',items:[
  ['power-rule','Basic power rule','\\int x^n\\,dx=\\frac{x^{n+1}}{n+1}+C','Integrating x raised to a constant power (not −1).',{tab:'int',f:'x^3'}],
  ['constant-multiple','Constant multiple rule','\\int c\\,f(x)\\,dx=c\\int f(x)\\,dx','A constant multiplies the function.',{tab:'int',f:'5x^2'}],
  ['sum-difference','Sum and difference rule','\\int(f\\pm g)\\,dx=\\int f\\,dx\\pm\\int g\\,dx','The integrand is a sum or difference of terms.',{tab:'int',f:'x^3+2x'}],
  ['trigonometric','Trigonometric integrals','\\int\\sin x\\,dx=-\\cos x+C','Sine, cosine and related functions.',{tab:'int',f:'3sin(x)-2cos(x)'}],
  ['exponential-logarithmic','Exponential and logarithmic integrals','\\int e^{x}dx=e^{x}+C,\\quad\\int\\frac{1}{x}dx=\\ln|x|+C','e to a power, or 1/x.',{tab:'int',f:'e^(2x)'}],
  ['definite-integrals','Definite integrals','\\int_a^b f(x)\\,dx=F(b)-F(a)','You need a number (area) between two bounds.',{tab:'defint',f:'x^2',a:'0',b:'3'}]]}];
let guidesDone=false;
function renderGuides(){if(guidesDone)return;guidesDone=true;
  q('#cl-guides-body').innerHTML='<div class="cl-gjump" role="group" aria-label="Jump to a topic">'+G.map((g,gi)=>'<button type="button" class="chip" data-j="'+gi+'">'+g.name+'</button>').join('')+'</div>'+G.map((g,gi)=>'<div class="cl-gsec" id="cl-gsec-'+gi+'"><div class="cl-ghead"><h3>'+g.name+'</h3><a href="/guides/'+g.page+'.html">Read the full guide</a></div><div class="cl-gtiles">'+
    g.items.map((it,i)=>'<article class="cl-gtile"><h4><a href="/guides/'+g.page+'.html#'+it[0]+'">'+esc(it[1])+'</a></h4><div class="cl-gf">'+m(it[2])+'</div><p class="cl-gw">'+esc(it[3])+'</p><div class="cl-gact"><a href="/guides/'+g.page+'.html#'+it[0]+'">Read the guide</a><button type="button" data-g="'+gi+'-'+i+'">Try an example</button></div></article>').join('')+'</div></div>').join('');}
q('#cl-guides-body').addEventListener('click',e=>{const j=e.target.closest('button[data-j]');if(j){q('#cl-gsec-'+j.dataset.j).scrollIntoView({block:'start',behavior:calm()?'auto':'smooth'});return;}const b=e.target.closest('button[data-g]');if(!b)return;const [gi,i]=b.dataset.g.split('-').map(Number),t=G[gi].items[i][4];
  showCl(t.tab);
  if(t.tab==='limits'){setVals({'#cl-l-f':t.f,'#cl-l-a':t.a});setSeg('#cl-l-dir','both');schedulePreview('l');runLimit();}
  else if(t.tab==='diff'){q('#cl-d-f').value=t.f;setSeg('#cl-d-n','1');schedulePreview('d');runDiff();}
  else if(t.tab==='int'){q('#cl-i-f').value=t.f;schedulePreview('i');runInt();}
  else{setVals({'#cl-di-f':t.f,'#cl-di-a':t.a,'#cl-di-b':t.b});schedulePreview('di');runDef();}
  const sh=q('#calculus-shell').getBoundingClientRect();if(sh.top<-20)q('#calculus-shell').scrollIntoView({block:'start',behavior:calm()?'auto':'smooth'});});

/* ---------- redraw graphs on resize / when a tab is shown ---------- */
function redraw(){if(lastL&&!q('#cl-limits').hidden)drawL();if(lastD&&!q('#cl-diff').hidden)drawD();}
let rt;new ResizeObserver(()=>{clearTimeout(rt);rt=setTimeout(redraw,200);}).observe(q('#secCalculus'));

/* ---------- deep links from the guide pages: /#calculus, /#calculus/guides ---------- */
window.addEventListener('load',()=>{const h=location.hash.match(/^#calculus(?:\/(\w+))?$/);if(!h)return;
  if(typeof showCategory==='function')showCategory('calculus');ensureLibs().then(refreshPreviews).catch(()=>{});showCl(h[1]||'home');
  const n=q('#calculus-shell');if(n)n.scrollIntoView({block:'start'});});
fadeTabs();
})();
