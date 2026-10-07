/* VectorLab calculus engine (window.CalcLab) — NO DOM.
   All mathematics is done by Nerdamer (window.nerdamer): diff(), limit() and integrate().
   This file only (1) cleans input, (2) guards two known Nerdamer limit quirks, and
   (3) maps results onto small rule templates for the explanations. */
(function(){
const N=()=>window.nerdamer;
const R={sin:['\\sin @','\\cos @'],cos:['\\cos @','-\\sin @'],tan:['\\tan @','\\sec^2 @'],sec:['\\sec @','\\sec @\\tan @'],csc:['\\csc @','-\\csc @\\cot @'],cot:['\\cot @','-\\csc^2 @'],
 asin:['\\arcsin @','\\frac{1}{\\sqrt{1-@^2}}'],acos:['\\arccos @','-\\frac{1}{\\sqrt{1-@^2}}'],atan:['\\arctan @','\\frac{1}{1+@^2}'],sinh:['\\sinh @','\\cosh @'],cosh:['\\cosh @','\\sinh @'],
 tanh:['\\tanh @','\\operatorname{sech}^2 @'],log:['\\ln @','\\frac{1}{@}'],exp:['e^{@}','e^{@}'],sqrt:['\\sqrt{@}','\\frac{1}{2\\sqrt{@}}'],abs:['|@|','\\frac{@}{|@|}']};

function norm(s){
  s=String(s==null?'':s).trim().replace(/\u2212/g,'-').replace(/[\u00b7\u00d7]/g,'*').replace(/\u03c0/g,'pi').replace(/\u221e/g,'Infinity').replace(/\*\*/g,'^');
  if(!s)throw new Error('Please enter an expression.');
  if(s.length>200)throw new Error('That expression is too long.');
  if(/[^0-9a-zA-Z_+\-*/^().,\s]/.test(s))throw new Error('Unsupported character. Use + - * / ^ ( ) and names like sin, cos, tan, ln, log, exp, sqrt, abs, pi, e.');
  s=s.replace(/(^|[^a-zA-Z])ln\(/g,'$1log(').replace(/\binf(inity)?\b/gi,'Infinity');
  try{N()(s);}catch(e){throw new Error('Could not read that expression \u2014 check brackets, operators and function names.');}
  return s;
}
function tex(s){
  s=String(s);if(s==='undefined')return '\\text{undefined}';if(s==='Inf'||s==='Infinity')return '\\infty';if(s==='-Inf'||s==='-Infinity')return '-\\infty';
  try{return N()(s).toTeX().replace(/\\mathrm\{(?:ln|log)\}/g,'\\ln ').replace(/\\cdot\s*/g,'\\,').replace(/(^|[^\\a-zA-Z])(?:ln|log)(?=\s*(\\left)?\()/g,'$1\\ln ');}catch(e){return s;}
}
const clean=r=>/^-?\d+\.0+$/.test(r)?String(parseInt(r,10)):r;
const tokens=s=>s.match(/[A-Za-z_]+/g)||[];
const hasVar=(s,v)=>tokens(s).includes(v);
function simp(s){try{let r=N()('simplify('+s+')').toString();r=r&&!/simplify|undefined/.test(r)?N()(r).toString():s;return r;}catch(e){return s;}}
function D(e,v,n){return clean(N()('diff('+e+','+v+(n>1?','+n:'')+')').toString());}

/* ---- tiny depth-aware helpers (string splitting only, not a parser) ---- */
function splitTop(s,chars){const out=[];let d=0,cur='',prev='';
  for(let i=0;i<s.length;i++){const c=s[i];
    if(c==='(')d++;else if(c===')')d--;
    if(d===0&&chars.includes(c)&&i>0&&!'^*/+-('.includes(prev)){out.push(cur);cur=(c==='-'||c==='+')?c:'';if(c==='/')cur='';out.push({op:c});}else cur+=c;
    if(c!==' ')prev=c;}
  out.push(cur);return out;}
function strip(s){s=s.trim();while(s[0]==='('){let d=0,ok=true;for(let i=0;i<s.length;i++){if(s[i]==='(')d++;else if(s[i]===')'){d--;if(d===0&&i<s.length-1){ok=false;break;}}}if(ok&&s.endsWith(')'))s=s.slice(1,-1).trim();else break;}return s;}
const terms=s=>splitTop(s,'+-').filter(x=>typeof x==='string').map(x=>x.replace(/^\+/,'')).filter(Boolean);

/* ---- differentiation explanation ---- */
function explainDiff(e,v){
  const dx='\\frac{d}{d'+v+'}',T=tex,st=(t,l)=>({t,l}),fin=()=>'\\text{Therefore }'+dx+'\\left['+T(e)+'\\right]='+T(simp(D(e,v)));
  const ts=terms(e);
  if(ts.length>1)return{rule:'Sum / difference rule',steps:[st('Differentiate each term separately',ts.map(t=>dx+'\\left['+T(t)+'\\right]='+T(D(t,v)))),st('Add the results',[fin()])]};
  const q=splitTop(e,'/');
  if(q.length===3){const u=strip(q[0]),w=strip(q[2]);
    if(!hasVar(w,v))return{rule:'Constant multiple rule',steps:[st('Pull out the constant divisor',[dx+'\\left[\\frac{'+T(u)+'}{'+T(w)+'}\\right]=\\frac{1}{'+T(w)+'}\\cdot'+dx+'\\left['+T(u)+'\\right]','\\text{where }'+dx+'\\left['+T(u)+'\\right]='+T(D(u,v))]),st('Result',[fin()])]};
    return{rule:'Quotient rule',steps:[st('Name the top and bottom',['u='+T(u),'w='+T(w)]),st('Differentiate each',['u\' = '+T(D(u,v)),'w\' = '+T(D(w,v))]),st('Apply the rule',['\\left(\\frac{u}{w}\\right)\'=\\frac{u\'w-uw\'}{w^{2}}']),st('Result',[fin()])]};}
  const m=splitTop(e,'*').filter(x=>typeof x==='string').map(strip),vs=m.filter(x=>hasVar(x,v));
  if(m.length>1&&vs.length===1&&!hasVar(e.replace(vs[0],''),v)){const c=m.filter(x=>x!==vs[0]).join('*');return{rule:'Constant multiple rule',steps:[st('Keep the constant, differentiate the rest',[dx+'\\left['+T(c)+'\\cdot '+T(vs[0])+'\\right]='+T(c)+'\\cdot'+dx+'\\left['+T(vs[0])+'\\right]','\\text{where }'+dx+'\\left['+T(vs[0])+'\\right]='+T(D(vs[0],v))]),st('Result',[fin()])]};}
  if(m.length>1){const u=m[0],w=m.slice(1).join('*');return{rule:'Product rule',steps:[st('Name the two factors',['u='+T(u),'w='+T(w)]),st('Differentiate each',['u\' = '+T(D(u,v)),'w\' = '+T(D(w,v))]),st('Apply the rule',['(uw)\'=u\'w+uw\'']),st('Result',[fin()])]};}
  const s=strip(e),f=s.match(/^([a-zA-Z]+)\((.*)\)$/);
  if(f&&R[f[1]]&&strip(s.slice(f[1].length))===f[2]){const[ lhs,rhs]=R[f[1]],inner=strip(f[2]),rule=(x)=>dx.replace(v,'u')+'['+lhs.replace(/@/g,x)+']='+rhs.replace(/@/g,x);
    if(inner===v)return{rule:'Basic derivative',steps:[st('Use the standard derivative',[dx+'\\left['+lhs.replace(/@/g,v)+'\\right]='+rhs.replace(/@/g,v)]),st('Result',[fin()])]};
    return{rule:'Chain rule',steps:[st('Identify the inner function',['u='+T(inner)]),st('Differentiate the outer function',[rule('u')]),st('Differentiate the inner function',['\\frac{du}{d'+v+'}='+T(D(inner,v))]),st('Multiply (outer \u00b7 inner)',[dx+'\\left['+lhs.replace(/@/g,'u')+'\\right]='+rhs.replace(/@/g,'u')+'\\cdot\\frac{du}{d'+v+'}']),st('Result',[fin()])]};}
  const p=splitTop(s,'^');
  if(p.length===3){const b=strip(p[0]),x=strip(p[2]),hb=hasVar(b,v),hx=hasVar(x,v);
    if(b==='e'||b==='E'){if(x===v)return{rule:'Exponential rule',steps:[st('Use the standard derivative',[dx+'\\left[e^{'+v+'}\\right]=e^{'+v+'}']),st('Result',[fin()])]};
      return{rule:'Chain rule (exponential)',steps:[st('Identify the exponent',['u='+T(x)]),st('Outer derivative',['\\frac{d}{du}e^{u}=e^{u}']),st('Inner derivative',['\\frac{du}{d'+v+'}='+T(D(x,v))]),st('Multiply',[dx+'e^{u}=e^{u}\\cdot\\frac{du}{d'+v+'}']),st('Result',[fin()])]};}
    if(!hb&&hx)return{rule:'Exponential rule (base a)',steps:[st('Use d/du[a\u1d58] = a\u1d58 ln a \u00b7 du/d'+v,['a='+T(b),'u='+T(x),'\\frac{du}{d'+v+'}='+T(D(x,v))]),st('Result',[fin()])]};
    if(hb&&!hx){if(b===v)return{rule:'Power rule',steps:[st('Bring the exponent down, lower it by 1',[dx+'\\left['+v+'^{n}\\right]=n\\,'+v+'^{n-1},\\; n='+T(x)]),st('Result',[fin()])]};
      return{rule:'Chain rule (power)',steps:[st('Identify the inner function',['u='+T(b)]),st('Power rule on the outside',['\\frac{d}{du}u^{n}=n\\,u^{n-1},\\; n='+T(x)]),st('Inner derivative',['\\frac{du}{d'+v+'}='+T(D(b,v))]),st('Multiply',['n\\,u^{n-1}\\cdot\\frac{du}{d'+v+'}']),st('Result',[fin()])]};}
    if(hb&&hx)return{rule:'Logarithmic differentiation',steps:[st('Variable base and exponent: take ln of both sides',['y='+T(s),'\\ln y='+T(x)+'\\cdot\\ln\\left('+T(b)+'\\right)']),st('Differentiate implicitly, then multiply by y',['\\frac{y\'}{y}=\\frac{d}{d'+v+'}\\left[\\ln y\\right]']),st('Result',[fin()])]};}
  return{rule:'Direct differentiation',steps:[st('Differentiate',[fin()])]};
}
function differentiate(expr,v,order){
  v=v||'x';order=order||1;const e=norm(expr);
  if(!tokens(e).includes(v)&&!/\d/.test(e)&&!tokens(e).length)throw new Error('Nothing to differentiate.');
  const chain=[];let cur=e;
  for(let i=1;i<=order;i++){cur=simp(D(cur,v));chain.push(cur);}
  const ex=explainDiff(e,v);
  return{input:e,v,order,result:chain[order-1],chain,rule:ex.rule,steps:ex.steps,tex:{input:tex(e),result:tex(chain[order-1])}};
}

/* ---- limits ---- */
function sub(e,v,a){try{const o={};o[v]=a;const r=N()(e,o).evaluate().toString();return/undefined|NaN/i.test(r)?null:clean(r);}catch(x){return null;}}
function numAt(f,v,a){try{return N()(f).buildFunction([v])(parseFloat(N()(a).evaluate().text('decimals')));}catch(e){return NaN;}}
function numLim(f,v,a,d){
  try{const g=N()(f).buildFunction([v]),inf=/Infinity/.test(a),A=inf?(a[0]==='-'?-1:1):parseFloat(N()(a).evaluate().text('decimals'));
    const at=h=>inf?A/h:A+(d==='left'?-h:h),y=[1e-3,1e-6,1e-9].map(h=>g(at(h)));
    if(y.some(t=>!isFinite(t)&&!Number.isNaN(t)))return null;if(y.some(Number.isNaN))return null;
    if(Math.abs(y[2]-y[1])<1e-4*(1+Math.abs(y[2])))return{val:String(+y[2].toPrecision(6)),est:true};
    if(Math.abs(y[2])>10&&Math.abs(y[2])>Math.abs(y[1])&&Math.abs(y[1])>Math.abs(y[0]))return{val:y[2]>0?'Inf':'-Inf',est:true};}catch(e){}return null;}
function runLim(f,v,a,d){
  try{const r=N()('limit('+f+','+v+','+a+(d?','+d:'')+')').toString();if(!/limit\(|undefined|NaN/i.test(r))return{val:clean(r)};}catch(e){}
  return numLim(f,v,a,d);}
const same=(p,q)=>p&&q&&(p.val===q.val||(isFinite(+p.val)&&isFinite(+q.val)&&Math.abs(p.val-q.val)<1e-9));
function limit(expr,v,pt,dir){
  v=v||'x';const f=norm(expr),a=norm(pt),inf=/Infinity/.test(a);dir=inf?'both':(dir||'both');
  let res,L,Rr,dne=false;
  if(dir==='both'&&!inf){L=runLim(f,v,a,'left');Rr=runLim(f,v,a,'right');if(same(L,Rr))res=L;else dne=true;}
  else res=runLim(f,v,a,dir==='both'?null:dir);
  if(!res&&!dne&&!(L||Rr))throw new Error('Could not evaluate this limit symbolically. Try rewriting the expression.');
  const T=tex,steps=[],dsp=dir==='left'?'^{-}':dir==='right'?'^{+}':'',lim='\\lim_{'+v+'\\to '+T(a)+dsp+'}';
  const direct=inf||!isFinite(numAt(f,v,a))?null:sub(f,v,a),q=splitTop(f,'/'),isQ=q.length===3&&splitTop(f,'+-').length===1;
  if(direct&&!/Inf/.test(direct)&&!dne)steps.push({t:'Direct substitution',l:['f('+T(a)+')='+T(direct)],n:'The function is defined and continuous here, so the limit equals the value.'});
  else if(isQ){const nu=strip(q[0]),de=strip(q[2]),nv=inf?null:sub(nu,v,a),dv=inf?null:sub(de,v,a);
    if(nv==='0'&&dv==='0'&&!/abs/.test(f)){const lh=runLim(D(nu,v),v,a,null);const dd=D(nu,v)+'/('+D(de,v)+')';
      steps.push({t:'Substitute: indeterminate form 0/0',l:['\\frac{'+T(nu)+'}{'+T(de)+'}\\to\\frac{0}{0}'],n:'Direct substitution is inconclusive, so rewrite or use L\u2019H\u00f4pital\u2019s rule.'});
      steps.push({t:'L\u2019H\u00f4pital: differentiate top and bottom',l:['\\frac{d}{d'+v+'}\\left['+T(nu)+'\\right]='+T(D(nu,v)),'\\frac{d}{d'+v+'}\\left['+T(de)+'\\right]='+T(D(de,v)),lim+'\\frac{'+T(nu)+'}{'+T(de)+'}='+lim+T(dd)]});}
    else if(inf){const nl=runLim(nu,v,a),dl=runLim(de,v,a);if(nl&&dl&&/Inf/.test(nl.val)&&/Inf/.test(dl.val)){
      steps.push({t:'Both parts grow without bound: \u221e/\u221e',l:['\\frac{'+T(nu)+'}{'+T(de)+'}\\to\\frac{\\infty}{\\infty}'],n:'Compare growth rates: divide by the highest power of '+v+', or apply L\u2019H\u00f4pital.'});
      steps.push({t:'L\u2019H\u00f4pital: differentiate top and bottom',l:[lim+'\\frac{'+T(nu)+'}{'+T(de)+'}='+lim+T(D(nu,v)+'/('+D(de,v)+')')]});}}
    else if(dv==='0'&&nv&&nv!=='0')steps.push({t:'Non-zero over zero',l:['\\frac{'+T(nu)+'}{'+T(de)+'}\\to\\frac{'+T(nv)+'}{0}'],n:'The denominator vanishes but the numerator does not, so the values grow without bound; the sign of each side decides \u00b1\u221e.'});}
  if(!steps.length&&!dne&&res)steps.push({t:'Evaluate the limit',l:[lim+T(f)+'='+T(res.val)],n:inf?'Behaviour of the expression as '+v+' grows without bound.':'Direct substitution does not settle this, so the library evaluated the limit.'});
  if(!res&&!dne&&(L||Rr)){dne=true;}
  if((L||Rr)&&!(steps[0]&&steps[0].t==='Direct substitution'))steps.push({t:'Compare the one-sided limits',l:['\\lim_{'+v+'\\to '+T(a)+'^{-}}='+T(L?L.val:'undefined'),'\\lim_{'+v+'\\to '+T(a)+'^{+}}='+T(Rr?Rr.val:'undefined')],n:dne?'The two sides disagree (or one side is undefined), so the two-sided limit does not exist.':'Both sides agree, so the two-sided limit exists.'});
  const est=(res&&res.est)||(L&&L.est)||(Rr&&Rr.est);
  return{input:f,v,a,dir,dne,est:!!est,result:dne?null:res.val,sides:L||Rr?{left:L?L.val:'undefined',right:Rr?Rr.val:'undefined'}:null,steps,tex:{input:lim+T(f),result:dne?'\\text{does not exist}':T(res.val)}};
}
/* ---- indefinite integration ----
   The antiderivative itself always comes from Nerdamer's integrate(). VectorLab adds:
   (1) a safety net: results that are unevaluated, complex, or that fail a numeric d/dx check are rejected;
   (2) fallbacks that still call Nerdamer: integrate term by term after expanding, and u-substitution;
   (3) explanation templates (power / table / constant multiple / parts / substitution). */
const KNOWN=['x','e','E','pi','sin','cos','tan','sec','csc','cot','asin','acos','atan','sinh','cosh','tanh','log','exp','sqrt','abs'];
const isConst=s=>tokens(s).every(t=>t==='e'||t==='E'||t==='pi');
function numVal(s){try{return parseFloat(N()(s).evaluate().text('decimals'));}catch(e){return NaN;}}
const canon=s=>{try{return N()(s).toString();}catch(e){return s;}};
const wrapP=s=>'('+s+')';

/* numeric check: central difference of the antiderivative must reproduce the integrand */
function verify(f,r,v){
  try{const F=N()(r).buildFunction([v]),g=N()(f).buildFunction([v]);let ok=0;
    for(const p of [0.31,0.77,1.23,1.9,2.7,-0.45,-1.1,-2.3,0.5,3.4]){
      const h=1e-5*Math.max(1,Math.abs(p)),y1=F(p+h),y0=F(p-h),fx=g(p);
      if(![y1,y0,fx].every(t=>typeof t==='number'&&isFinite(t)))continue;
      if(Math.abs((y1-y0)/(2*h)-fx)>2e-4*(1+Math.abs(fx)))return false;ok++;}
    return ok>=3;}catch(e){return false;}}
function direct(f,v){let r;
  try{r=N()('integrate('+f+','+v+')').toString();}catch(e){return null;}
  if(!r||/integrate|undefined|NaN|Infinity|imaginary/.test(r)||tokens(r).includes('i'))return null;
  return verify(f,r,v)?r:null;}

/* inner-argument candidates for substitution: function arguments, bases of powers, exponents */
function innerArgs(f){const out=[];
  for(let i=0;i<f.length;i++)if(f[i]==='('){let d=0,j=i;
    for(;j<f.length;j++){if(f[j]==='(')d++;else if(f[j]===')'){d--;if(d===0)break;}}
    const pre=f.slice(0,i),prev=pre.trim().slice(-1);
    if(/[A-Za-z]$/.test(pre)||f[j+1]==='^'||prev==='^')out.push(f.slice(i+1,j).trim());}
  return[...new Set(out)];}
function subst(f){
  for(const u of innerArgs(f)){
    if(u==='x'||!hasVar(u,'x'))continue;
    let du;try{du=D(u,'x');}catch(e){continue;}
    if(!du||du==='0')continue;
    let h=null;
    try{
      if(isConst(du)){ /* linear: x = (U - b)/a */
        const b=simp(u+'-('+du+')*x');
        const g=N()(f).sub('x','(u-('+b+'))/('+du+')').toString();
        h=simp('('+g+')/('+du+')');
      }else{ /* general: f = F(U)*U'  ->  F(u) */
        const uc=canon(u),qq=canon(simp('('+f+')/('+du+')'));
        const parts=qq.split(uc);
        if(parts.length>1){const t=parts.join('(u)');if(!hasVar(t,'x'))h=t;}
      }
    }catch(e){h=null;}
    if(!h||hasVar(h,'x'))continue;
    const inner=direct(h,'u');if(!inner)continue;
    let back;try{back=N()(inner).sub('u','('+u+')').toString();}catch(e){continue;}
    if(verify(f,back,'x'))return{u,du,h,inner,res:back,linear:isConst(du)};
  }
  return null;}
function solve(f){const d=direct(f,'x');if(d)return{res:d};const s=subst(f);return s?{res:s.res,sub:s}:null;}

/* textbook form: ln|...| for logarithms that come from integrating a reciprocal */
function absLog(s){let out='',i=0;
  while(i<s.length){const k=s.indexOf('log(',i);
    if(k<0||(k>0&&/[A-Za-z]/.test(s[k-1]))){const k2=k<0?s.length:k+4;out+=s.slice(i,k2);i=k2;continue;}
    let d=1,j=k+4;for(;j<s.length&&d>0;j++){if(s[j]==='(')d++;else if(s[j]===')')d--;}
    const arg=s.slice(k+4,j-1);out+=s.slice(i,k)+'log('+(/^[\d.\s]*$/.test(arg)||isConst(arg)?arg:'abs('+absLog(arg)+')')+')';i=j;}
  return out;}
function itex(s){return tex(s).replace(/\\ln \\left\((\\left\|(?:(?!\\right\|).)*\\right\|)\\right\)/g,'\\ln$1');}

/* ---- explanation templates ---- */
const TAB={'sin(x)':['\\sin x','-\\cos x'],'cos(x)':['\\cos x','\\sin x'],'sec(x)^2':['\\sec^{2}x','\\tan x'],'csc(x)^2':['\\csc^{2}x','-\\cot x'],
 'e^x':['e^{x}','e^{x}'],'exp(x)':['e^{x}','e^{x}'],'sinh(x)':['\\sinh x','\\cosh x'],'cosh(x)':['\\cosh x','\\sinh x'],
 'tan(x)':['\\tan x','\\ln\\left|\\sec x\\right|'],'cot(x)':['\\cot x','\\ln\\left|\\sin x\\right|'],'sec(x)':['\\sec x','\\ln\\left|\\sec x+\\tan x\\right|'],
 'csc(x)':['\\csc x','-\\ln\\left|\\csc x+\\cot x\\right|'],'sec(x)*tan(x)':['\\sec x\\tan x','\\sec x'],
 '1/(1+x^2)':['\\frac{1}{1+x^{2}}','\\arctan x'],'1/(x^2+1)':['\\frac{1}{1+x^{2}}','\\arctan x'],'1/sqrt(1-x^2)':['\\frac{1}{\\sqrt{1-x^{2}}}','\\arcsin x']};
function powerOf(f){f=strip(f);
  if(f==='x')return'1';if(f==='sqrt(x)')return'1/2';
  const p=splitTop(f,'^');if(p.length===3&&strip(p[0])==='x'&&isConst(strip(p[2])))return strip(p[2]);
  const q=splitTop(f,'/');if(q.length===3&&isConst(q[0])&&numVal(q[0])===1){const d=powerOf(q[2]);if(d!==null)return'-('+d+')';}
  return null;}
function explainInt(f,res){
  const T=tex,st=(t,l,n)=>({t,l,n}),I=x=>'\\int '+T(x)+'\\,dx',R=()=>T(absLog(res));
  f=strip(f);
  if(isConst(f))return{rule:'Constant rule',steps:[st('The integrand has no x in it',['\\int c\\,dx=c\\,x',I(f)+'='+itex(res)])]};
  /* constant multiple (also leading minus and division by a constant) */
  let c=null,g=null,m=splitTop(f,'*').filter(x=>typeof x==='string').map(strip),vs=m.filter(x=>hasVar(x,'x')),q=splitTop(f,'/');
  if(f[0]==='-'&&f.length>1&&splitTop(f.slice(1),'+-').length===1){c='-1';g=f.slice(1);}
  else if(m.length>1&&vs.length===1&&m.filter(x=>x!==vs[0]).every(isConst)){c=m.filter(x=>x!==vs[0]).join('*');g=vs[0];}
  else if(q.length===3&&isConst(strip(q[2]))&&hasVar(q[0],'x')){c='1/('+strip(q[2])+')';g=strip(q[0]);}
  if(c!==null){const gi=solve(g);
    if(gi){const sub=explainInt(g,gi.res);
      return{rule:'Constant multiple rule'+(sub.rule==='Direct integration'?'':' + '+sub.rule.charAt(0).toLowerCase()+sub.rule.slice(1)),
        steps:[st('Pull the constant out of the integral',['\\int c\\,g(x)\\,dx=c\\int g(x)\\,dx','c='+T(c),'g(x)='+T(g)]),...sub.steps.map((s,i)=>i===sub.steps.length-1?st('Multiply back by the constant',[I(f)+'='+T(c)+'\\cdot\\left('+itex(absLog(gi.res))+'\\right)='+R()]):s)]};}}
  /* power rule family */
  const pw=powerOf(f);
  if(pw!==null){const n=numVal(pw);
    if(Math.abs(n+1)<1e-12)return{rule:'Reciprocal rule',steps:[st('Recognise 1/x',['\\int\\frac{1}{x}\\,dx=\\ln|x|'],'This is the one power of x the power rule cannot handle.'),st('Result',[I(f)+'='+R()])]};
    const n1=simp(pw+'+1');
    return{rule:'Power rule',steps:[st('Write the integrand as a power of x',[T(f)+'=x^{'+T(pw)+'}','n='+T(pw)]),st('Raise the exponent by 1 and divide by the new exponent',['\\int x^{n}\\,dx=\\frac{x^{n+1}}{n+1},\\; n\\neq -1','n+1='+T(n1),'\\int x^{'+T(pw)+'}\\,dx=\\frac{x^{'+T(n1)+'}}{'+T(n1)+'}']),st('Result',[I(f)+'='+R()])]};}
  /* standard table */
  const key=f.replace(/\s/g,''),tb=TAB[key],ab=key.match(/^(\d+(?:\.\d+)?)\^x$/);
  if(tb)return{rule:'Standard integral',steps:[st('Use the standard integral',['\\int '+tb[0]+'\\,dx='+tb[1]]),st('Result',[I(f)+'='+R()])]};
  if(ab&&numVal(ab[1])>0&&numVal(ab[1])!==1)return{rule:'Exponential rule (base a)',steps:[st('Use \u222b a\u02e3 dx = a\u02e3 / ln a',['a='+ab[1],'\\int a^{x}\\,dx=\\frac{a^{x}}{\\ln a}']),st('Result',[I(f)+'='+R()])]};
  /* integration by parts (polynomial \u00d7 e^x / sin / cos, or ln x) */
  const poly=s=>{const p=powerOf(s);return p!==null&&/^\d+$/.test(p)?p:null;},qf=s=>['sin(x)','cos(x)','e^x','exp(x)'].includes(s.replace(/\s/g,''));
  let u=null,dv=null;
  if(m.length===2&&poly(m[0])!==null&&qf(m[1])){u=m[0];dv=m[1];}
  else if(m.length===2&&poly(m[1])!==null&&qf(m[0])){u=m[1];dv=m[0];}
  else if(key==='log(x)'){u='log(x)';dv='1';}
  else if(m.length===2&&m.some(s=>s.replace(/\s/g,'')==='log(x)')&&m.some(s=>poly(s)!==null)){u='log(x)';dv=m.find(s=>s.replace(/\s/g,'')!=='log(x)');}
  if(u){const du=D(u,'x'),vr=direct(dv,'x'),vdu=vr&&simp('('+vr+')*('+du+')'),rest=vdu&&direct(vdu,'x');
    if(vr&&rest){return{rule:'Integration by parts',steps:[
      st('Choose u and dv',['u='+T(u),'dv='+T(dv)+'\\,dx']),
      st('Differentiate u, integrate dv',['du='+T(du)+'\\,dx','v='+T(vr)]),
      st('Apply \u222b u dv = uv \u2212 \u222b v du',['\\int u\\,dv=uv-\\int v\\,du','\\int v\\,du=\\int '+T(vdu)+'\\,dx='+itex(absLog(rest))],'If a power of x is still left inside the new integral, apply parts again.'),
      st('Result',[I(f)+'='+R()])]};}}
  /* u-substitution */
  const sb=subst(f);
  if(sb)return{rule:'Substitution',steps:[
    st('Choose u',['u='+T(sb.u),'\\frac{du}{dx}='+T(sb.du),'du='+T(sb.du)+'\\,dx']),
    st('Rewrite the integral in terms of u',[I(f)+'=\\int '+T(sb.h)+'\\,du'],sb.linear?'The inside is linear, so dx = du / '+T(sb.du)+' and the constant factor comes out.':'The factor du/dx = '+T(sb.du)+' appears in the integrand, so it is absorbed into du.'),
    st('Integrate with respect to u',['\\int '+T(sb.h)+'\\,du='+itex(absLog(sb.inner))]),
    st('Substitute back u = '+sb.u.replace(/\s/g,''),['u='+T(sb.u)]),st('Result',[I(f)+'='+R()])]};
  return{rule:'Direct integration',steps:[st('Integrate',[I(f)+'='+R()])]};}

function integrate(expr){
  const e0=norm(expr),bad=tokens(e0).filter(t=>!KNOWN.includes(t));
  if(bad.length)throw new Error('Integration here works with the variable x only (found \u201c'+[...new Set(bad)].join(', ')+'\u201d). Use x, and constants like e and pi.');
  const e=canon(e0),hasLog=/log\(/.test(e);let how,parts=null,total;
  const ts=terms(e),solveAll=list=>{const out=[];for(const t of list){const s=solve(t);if(!s)return null;out.push({term:t,res:s.res});}return out;};
  if(ts.length>1)parts=solveAll(ts);
  if(!parts){const s=solve(e);if(s){parts=null;total=s.res;how='whole';}}
  if(!parts&&!total){const ex=canon(N()('expand('+e+')').toString());if(ex!==e){const t2=terms(ex);if(t2.length>1){parts=solveAll(t2);if(parts)how='expanded';}}}
  if(parts&&!total){how=how||'terms';try{total=canon(parts.map(p=>wrapP(p.res)).join('+'));}catch(x){total=null;}}
  if(!total||!verify(e,total,'x'))throw new Error('Could not find a reliable antiderivative for this expression. It may have no elementary closed form (for example sin(x^2) or e^(x^2)), or it needs a technique this tool does not support yet.');
  const shown=hasLog?total:absLog(total);let rule,steps;
  const I=x=>'\\int '+tex(x)+'\\,dx';
  if(parts){
    const sec=parts.map((p,i)=>{const ex=explainInt(p.term,p.res);return{t:'Term '+(i+1)+': '+ex.rule,l:ex.steps.reduce((a,s)=>a.concat(s.l),[])};});
    rule='Sum / difference rule';
    steps=[{t:how==='expanded'?'Expand, then split into terms':'Split the integral into terms',l:['\\int\\left(f\\pm g\\right)dx=\\int f\\,dx\\pm\\int g\\,dx',I(how==='expanded'?canon(N()('expand('+e+')').toString()):e)+'='+parts.map(p=>'\\int '+tex(p.term)+'\\,dx').join('+').replace(/\+\\int -/g,'-\\int ')]},
      ...sec,{t:'Add the results',l:[I(e)+'='+itex(hasLog?total:absLog(total))+'+C']}];
  }else{const ex=explainInt(e,total);rule=ex.rule;steps=ex.steps;}
  return{input:e,v:'x',result:shown,rule,steps,tex:{input:'\\int '+tex(e0)+'\\,dx',result:itex(shown)}};
}

/* ---- definite integration (added) ----
   Antiderivative: CalcLab.integrate() (Nerdamer, unchanged). Bounds are substituted by Nerdamer.
   VectorLab only (1) validates the bounds, (2) refuses integrands that are undefined/unbounded on [a,b]
   (the Fundamental Theorem would give a wrong answer there), and (3) cross-checks F(b)-F(a) against a
   numerical sum of f over [a,b] before showing it. */
function nval(s){try{const v=N()(s).buildFunction([])();return typeof v==='number'?v:NaN;}catch(e){return NaN;}}
function bound(raw,name){
  let s=String(raw==null?'':raw).trim();
  if(!s)throw new Error('Please enter the '+name+' bound.');
  if(/inf(inity)?|\u221e/i.test(s))throw new Error('The '+name+' bound is infinite. Improper integrals are not supported yet \u2014 use finite bounds.');
  const b=norm(s),bad=tokens(b).filter(t=>!['e','E','pi','sqrt','sin','cos','tan','log','exp','abs','atan'].includes(t));
  if(bad.length)throw new Error('The '+name+' bound must be a number (like 2, -1, 1/2, pi or sqrt(2)); found \u201c'+[...new Set(bad)].join(', ')+'\u201d.');
  const v=nval(b);
  if(!isFinite(v))throw new Error('The '+name+' bound \u201c'+s+'\u201d is not a finite real number.');
  return{s:b,v};}
function atX(F,x){try{const r=N()(F,{x:x}).toString();return/undefined|NaN|Infinity|imaginary|\bi\b/.test(r)?null:r;}catch(e){return null;}}
function subTex(Ftex,bs){const t=tex(bs),w=/^(\d+(\.\d+)?|pi|e)$/.test(bs)?t:'\\left('+t+'\\right)';
  return Ftex.replace(/(^|[^\\a-zA-Z])x(?![a-zA-Z])/g,(m,p)=>p+'{'+w+'}');}
function definite(expr,lo,hi){
  const A=bound(lo,'lower'),B=bound(hi,'upper'),f=norm(expr),bad=tokens(f).filter(t=>!KNOWN.includes(t));
  if(bad.length)throw new Error('Integration here works with the variable x only (found \u201c'+[...new Set(bad)].join(', ')+'\u201d). Use x, and constants like e and pi.');
  const sameB=A.v===B.v,reversed=A.v>B.v,L=Math.min(A.v,B.v),H=Math.max(A.v,B.v);
  const g=N()(f).buildFunction(['x']),y=x=>{try{const t=g(x);return typeof t==='number'?t:NaN;}catch(e){return NaN;}};
  let n=4000,sum=0,mx=0;
  if(!sameB){
    const pts=[];for(let i=0;i<=n;i++)pts.push(L+(H-L)*i/n);
    pts.push(L+(H-L)*0.3183098861837907,L+(H-L)*0.6180339887498949);
    for(const x of pts){const t=y(x);
      if(!isFinite(t))throw new Error('The function is undefined or unbounded at x = '+(+x.toPrecision(6))+', inside or at the edge of ['+(+L.toPrecision(6))+', '+(+H.toPrecision(6))+']. That makes this an improper integral (or one with no real value), which is not supported \u2014 choose bounds where the function is defined and finite.');
      mx=Math.max(mx,Math.abs(t));}
    if(mx>1e6)throw new Error('The function grows extremely large on this interval (it probably has a vertical asymptote). Improper integrals are not supported \u2014 choose bounds that avoid it.');
    const h=(H-L)/n;sum=y(L)+y(H);for(let i=1;i<n;i++)sum+=(i%2?4:2)*y(L+i*h);sum*=h/3;}
  const base=integrate(f),F=base.result,Ftex=itex(F);
  const Fb=atX(F,B.s),Fa=atX(F,A.s);
  if(Fb===null||Fa===null)throw new Error('The antiderivative is not defined at one of the bounds, so the integral cannot be evaluated this way.');
  let val=canon(N()('('+Fb+')-('+Fa+')').toString());
  const num=nval(val);
  if(!isFinite(num))throw new Error('The result is not a finite real number.');
  if(!sameB&&Math.abs(num-(reversed?-sum:sum))>1e-5*(1+Math.abs(num)))
    throw new Error('The function is not continuous on this interval (or the antiderivative has a break inside it), so the Fundamental Theorem of Calculus cannot be applied directly. Try splitting the interval or choose different bounds.');
  const exact=Math.abs(num)<1e-12?'0':val,isInt=/^-?\d+$/.test(exact),isDec=/^-?\d*\.\d+$/.test(exact);
  const T=tex,I='\\int_{'+T(A.s)+'}^{'+T(B.s)+'}'+T(f)+'\\,dx',vb=Fb,va=Fa;
  const fixd=s=>Math.abs(nval(s))<1e-12?'0':s;
  const steps=[
    {t:'State the integral and the method',l:[I,'\\int_{a}^{b}f(x)\\,dx=F(b)-F(a)'],n:'Fundamental Theorem of Calculus, where F\u2032(x) = f(x): find any antiderivative F, then subtract its value at the lower bound from its value at the upper bound. The constant C cancels, so it is left out.'+(reversed?' Here a > b, so the result is the negative of the integral taken from the smaller bound to the larger one.':'')},
    {t:'Find the antiderivative',l:['F(x)='+Ftex],n:'Method used: '+base.rule+'.',sub:base.steps},
    {t:'Substitute the upper bound',l:['x=b='+T(B.s),'F\\left('+T(B.s)+'\\right)='+subTex(Ftex,B.s),'F\\left('+T(B.s)+'\\right)='+T(fixd(vb))]},
    {t:'Substitute the lower bound',l:['x=a='+T(A.s),'F\\left('+T(A.s)+'\\right)='+subTex(Ftex,A.s),'F\\left('+T(A.s)+'\\right)='+T(fixd(va))]},
    {t:'Subtract: F(b) \u2212 F(a)',l:['F\\left('+T(B.s)+'\\right)-F\\left('+T(A.s)+'\\right)=\\left('+T(fixd(vb))+'\\right)-\\left('+T(fixd(va))+'\\right)','='+T(exact)]}];
  const approx=!(isInt||isDec)?String(+num.toPrecision(10)):null;
  return{input:f,a:A.s,b:B.s,F,reversed,zeroWidth:sameB,exact,approx,value:num,steps,rule:base.rule,
    tex:{input:I,F:Ftex,exact:T(exact),approx:approx}};}

window.CalcLab={norm,tex,differentiate,limit,integrate,definite,compile:(e,v)=>{const g=N()(norm(e)).buildFunction([v||'x']);return x=>{try{const y=g(x);return isFinite(y)?y:NaN;}catch(_){return NaN;}};}};
})();
