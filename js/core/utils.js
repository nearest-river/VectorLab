/* ============ MATH ============ */
const TOL=1e-10;
const neg=s=>s.replace('-','\u2212');
function fmt(x){
  if(!isFinite(x)) return '\u221e';
  if(Math.abs(x)<1e-10) return '0';
  const r=Math.round(x); if(Math.abs(x-r)<1e-9) return neg(String(r));
  for(let q=2;q<=12;q++){const p=Math.round(x*q); if(Math.abs(x-p/q)<1e-9) return neg(p+'/'+q);}
  return neg(String(+x.toFixed(3)));
}
const dec=x=>neg(String(+(+x).toFixed(4)));
function parseVal(s){
  s=s.trim().replace('\u2212','-');
  const f=s.match(/^(-?\d*\.?\d+)\/(-?\d*\.?\d+)$/);
  if(f){const d=+f[2];return d===0?NaN:+f[1]/d;}
  return /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(s)?+s:NaN;
}
const cp=M=>M.map(r=>r.slice());
const active=(M,m,n)=>M.slice(0,m).map(r=>r.slice(0,n));
function tolFor(M){let mx=0;for(const r of M)for(const v of r)mx=Math.max(mx,Math.abs(v));return TOL*Math.max(1,mx);}

const SUB=['\u2081','\u2082','\u2083','\u2084','\u2085','\u2086','\u2087','\u2088','\u2089'],SUP={2:'\u00b2',3:'\u00b3',4:'\u2074'};
const $=s=>document.querySelector(s);
const I3=[[1,0,0],[0,1,0],[0,0,1]];
