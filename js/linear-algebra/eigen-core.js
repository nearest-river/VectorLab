/* ============ EIGEN ENGINE (pure math, no DOM) ============
   Reuses the exact-rational field from row-reduction.js (mkQ / EXACT / bgcd).

   Pipeline for an n×n rational matrix A (n ≤ 4):
   1. Scale to an integer matrix B = L·A (L = common denominator) and get the characteristic polynomial of B
      EXACTLY (Faddeev–LeVerrier over BigInt).
   2. Split it into square-free factors (Yun, exact), so repeated eigenvalues and their algebraic multiplicities
      are exact and never depend on floating-point luck.
   3. Rational eigenvalues are found by rounding a numeric root and VERIFYING it exactly; the rest come from the
      quadratic formula (shown in closed form) or Aberth iteration (cubic/quartic remainder → approximate).
   4. Eigenspaces: exact nullspace over ℚ for rational eigenvalues, tolerance-aware complex elimination otherwise.
   Results are tagged exact / approximate so the UI never passes a numerical value off as exact. */
const Eigen=(function(){
  'use strict';
  const Q=mkQ,ZERO=Q(0n),ONE=Q(1n);
  const qa=EXACT.add,qm=EXACT.mul,qd=EXACT.div,qn=EXACT.neg,qz=q=>q.n===0n;
  const qNum=q=>Number(q.n)/Number(q.d);
  const babs=a=>a<0n?-a:a;
  const blcm=(a,b)=>a===0n||b===0n?0n:babs(a/bgcd(a,b)*b);

  /* ---------- rational polynomials (arrays of Q, low → high degree) ---------- */
  const trim=p=>{while(p.length&&qz(p[p.length-1]))p.pop();return p;};
  const deg=p=>p.length-1;
  const monic=p=>{if(!p.length)return p;const l=p[p.length-1];return p.map(c=>qd(c,l));};
  const pderiv=p=>p.slice(1).map((c,i)=>qm(c,Q(BigInt(i+1))));
  const psub=(a,b)=>{const n=Math.max(a.length,b.length),r=[];for(let i=0;i<n;i++)r.push(qa(a[i]||ZERO,qn(b[i]||ZERO)));return trim(r);};
  function pdivmod(a0,b){
    const a=a0.slice(),db=deg(b),q=[];
    for(let i=0;i<=deg(a)-db;i++)q.push(ZERO);
    while(a.length&&deg(a)>=db){
      const k=deg(a)-db,c=qd(a[a.length-1],b[db]);q[k]=c;
      for(let i=0;i<=db;i++)a[i+k]=qa(a[i+k],qn(qm(c,b[i])));
      a.pop();trim(a);
    }
    return [trim(q),a];
  }
  function pgcd(a,b){a=a.slice();b=b.slice();while(b.length){const r=pdivmod(a,b)[1];a=b;b=r;}return monic(a);}
  function sqfree(f){                         /* Yun: f = ∏ a_i^i, each a_i square-free and coprime */
    const fp=pderiv(f),a0=pgcd(f,fp);
    let b=pdivmod(f,a0)[0],c=pdivmod(fp,a0)[0],d=psub(c,pderiv(b));
    const out=[];let i=1;
    while(deg(b)>0&&i<12){
      const a=pgcd(b,d);
      if(deg(a)>0)out.push([a,i]);
      b=pdivmod(b,a)[0];c=pdivmod(d,a)[0];d=psub(c,pderiv(b));i++;
    }
    return out;
  }
  const pevalQ=(p,x)=>{let r=ZERO;for(let i=p.length-1;i>=0;i--)r=qa(qm(r,x),p[i]);return r;};
  const deflate=(p,root)=>pdivmod(p,[qn(root),ONE])[0];

  /* ---------- characteristic polynomial, exact: det(λI − B) for integer B (BigInt) ---------- */
  function charPolyInt(B){
    const n=B.length,I=(i,j)=>i===j?1n:0n,c=new Array(n+1).fill(0n);c[n]=1n;
    let M=B.map(r=>r.map(()=>0n));
    const mul=(X,Y)=>X.map((r,i)=>Y[0].map((_,j)=>{let s=0n;for(let k=0;k<n;k++)s+=r[k]*Y[k][j];return s;}));
    for(let k=1;k<=n;k++){
      const BM=mul(B,M);
      M=BM.map((r,i)=>r.map((v,j)=>v+c[n-k+1]*I(i,j)));
      const AM=mul(B,M);let tr=0n;for(let i=0;i<n;i++)tr+=AM[i][i];
      c[n-k]=-tr/BigInt(k);
    }
    return c;
  }

  /* ---------- complex helpers & numeric roots (Aberth–Ehrlich with Newton polish) ---------- */
  const cadd=(a,b)=>[a[0]+b[0],a[1]+b[1]],csub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
  const cmul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
  const cabs=a=>Math.hypot(a[0],a[1]);
  function cdiv(a,b){const d=b[0]*b[0]+b[1]*b[1];return [(a[0]*b[0]+a[1]*b[1])/d,(a[1]*b[0]-a[0]*b[1])/d];}
  function aberth(co){                        /* co: real coefficients, low → high */
    const n=co.length-1;if(n<1)return [];
    const a=co.map(c=>c/co[n]);
    const horner=z=>{let p=[1,0],dp=[0,0];for(let i=n-1;i>=0;i--){dp=cadd(cmul(dp,z),p);p=cadd(cmul(p,z),[a[i],0]);}return [p,dp];};
    let rad=0;for(let i=0;i<n;i++)rad=Math.max(rad,Math.pow(Math.abs(a[i]),1/(n-i)));
    rad=rad||1;
    const z=[];for(let k=0;k<n;k++){const t=2*Math.PI*k/n+0.4;z.push([rad*Math.cos(t),rad*Math.sin(t)]);}
    for(let it=0;it<500;it++){
      let mx=0;
      for(let k=0;k<n;k++){
        const [p,dp]=horner(z[k]);if(cabs(p)===0)continue;
        const w=cdiv(p,dp);let s=[0,0];
        for(let j=0;j<n;j++)if(j!==k)s=cadd(s,cdiv([1,0],csub(z[k],z[j])));
        const dl=cdiv(w,csub([1,0],cmul(w,s)));
        z[k]=csub(z[k],dl);mx=Math.max(mx,cabs(dl)/(1+cabs(z[k])));
      }
      if(mx<1e-16)break;
    }
    for(let k=0;k<n;k++)for(let it=0;it<4;it++){const [p,dp]=horner(z[k]);if(cabs(dp)<1e-300)break;z[k]=csub(z[k],cdiv(p,dp));}
    return z;
  }

  /* ---------- exact nullspace over ℚ ---------- */
  function nullQ(M){
    const n=M.length,A=M.map(r=>r.slice()),piv=[];let r=0;
    for(let c=0;c<n&&r<n;c++){
      let p=-1;for(let i=r;i<n;i++)if(!qz(A[i][c])){p=i;break;}
      if(p<0)continue;
      [A[r],A[p]]=[A[p],A[r]];
      const pv=A[r][c];for(let j=0;j<n;j++)A[r][j]=qd(A[r][j],pv);
      for(let i=0;i<n;i++){if(i===r)continue;const f=A[i][c];if(qz(f))continue;for(let j=0;j<n;j++)A[i][j]=qa(A[i][j],qn(qm(f,A[r][j])));}
      piv.push(c);r++;
    }
    const free=[];for(let c=0;c<n;c++)if(!piv.includes(c))free.push(c);
    return free.map(f=>{const v=new Array(n).fill(ZERO);v[f]=ONE;piv.forEach((pc,i)=>{v[pc]=qn(A[i][f]);});return primitive(v);});
  }
  function primitive(v){                      /* clear denominators, divide by gcd, first non-zero entry positive */
    let L=1n;v.forEach(q=>{L=blcm(L,q.d);});
    let w=v.map(q=>q.n*(L/q.d)),g=0n;w.forEach(x=>{g=bgcd(g,x);});
    if(g>1n)w=w.map(x=>x/g);
    const f=w.find(x=>x!==0n);if(f<0n)w=w.map(x=>-x);
    return w.map(x=>Q(x));
  }

  /* ---------- numeric complex nullspace (eigenvalue not exactly representable) ---------- */
  function nullC(M,mult){
    const n=M.length;let norm=0;M.forEach(r=>r.forEach(c=>{norm=Math.max(norm,cabs(c));}));
    const tol=1e-9*Math.max(1,norm);
    const run=(steps)=>{
      const A=M.map(r=>r.map(c=>c.slice())),perm=[...Array(n).keys()];let k=0;
      for(;k<n;k++){
        let bi=-1,bj=-1,bv=-1;
        for(let i=k;i<n;i++)for(let j=k;j<n;j++){const v=cabs(A[i][j]);if(v>bv){bv=v;bi=i;bj=j;}}
        if(steps===null?bv<=tol:k>=steps)break;
        [A[k],A[bi]]=[A[bi],A[k]];
        for(let i=0;i<n;i++){[A[i][k],A[i][bj]]=[A[i][bj],A[i][k]];}
        [perm[k],perm[bj]]=[perm[bj],perm[k]];
        const pv=A[k][k];for(let j=0;j<n;j++)A[k][j]=cdiv(A[k][j],pv);
        for(let i=0;i<n;i++){if(i===k)continue;const f=A[i][k];if(cabs(f)===0)continue;for(let j=0;j<n;j++)A[i][j]=csub(A[i][j],cmul(f,A[k][j]));}
      }
      return {A,perm,rank:k};
    };
    let R=run(null).rank;                     /* then respect the exact algebraic multiplicity */
    R=Math.max(n-mult,Math.min(R,n-1));
    const {A,perm}=run(R),out=[];
    for(let f=R;f<n;f++){
      const v=Array.from({length:n},()=>[0,0]);v[perm[f]]=[1,0];
      for(let i=0;i<R;i++)v[perm[i]]=[-A[i][f][0],-A[i][f][1]];
      out.push(v);
    }
    return out.map(v=>{
      v=v.map(c=>[Math.abs(c[0])<1e-11?0:c[0],Math.abs(c[1])<1e-11?0:c[1]]);
      if(out.length===1){const k=v.findIndex(c=>cabs(c)>1e-9);if(k>=0){const s=v[k];v=v.map(c=>cdiv(c,s));v=v.map(c=>[Math.abs(c[0])<1e-11?0:c[0],Math.abs(c[1])<1e-11?0:c[1]]);}}
      return v;
    });
  }

  /* ---------- exact closed form for a quadratic factor μ² + bμ + c = 0 (μ = L·λ) ---------- */
  function sqSplit(D){                        /* |D| = s²·t */
    let a=babs(D),s=1n,t=a;
    if(a>10n**13n||a===0n)return [1n,a];
    for(let p=2n;p*p<=t&&p<=1000000n;p++){while(t%(p*p)===0n){t/=p*p;s*=p;}}
    return [s,t];
  }
  function quadForm(b,c,L){                   /* λ = (−b ± √D)/(2L) → text + numeric */
    const D=b*b-4n*c,[s,t]=sqSplit(D),neg_=D<0n;
    let num0=-b,den=2n*L,sg=s;
    const g=bgcd(bgcd(babs(num0),sg),den);if(g>1n){num0/=g;sg/=g;den/=g;}
    const rad=(neg_?'i':'')+(t===1n?'':'\u221a'+t);
    let body=(sg===1n?'':sg.toString())+rad;
    if(sg===1n&&t===1n&&!neg_)body='1';
    const top=(num0!==0n?neg(num0.toString())+' ':'')+(num0!==0n?'\u00b1 ':'\u00b1')+body;
    const exact=den===1n?(num0!==0n?top:top):'('+top+')/'+den;
    return exact;
  }

  /* ---------- main analysis ---------- */
  function analyze(Aq){
    const n=Aq.length;
    let L=1n;Aq.forEach(r=>r.forEach(q=>{L=blcm(L,q.d);}));
    const B=Aq.map(r=>r.map(q=>q.n*(L/q.d)));
    const cB=charPolyInt(B).map(c=>Q(c));                         /* monic, in μ = L·λ */
    const Lp=k=>{let p=1n;for(let i=0;i<k;i++)p*=L;return p;};
    const cA=cB.map((c,k)=>qd(c,Q(Lp(n-k))));                    /* monic det(λI − A) */
    const vals=[],factors=[];
    const sf=sqfree(cB);
    sf.forEach(([g0,m])=>{
      let g=g0.slice();
      const toA=p=>p.map((c,k)=>qd(c,Q(Lp(deg(p)-k))));          /* factor coefficients in λ */
      /* 1) rational (integer μ) roots, verified exactly */
      for(let guard=0;guard<4&&deg(g)>=1;guard++){
        const rts=aberth(g.map(qNum));let hit=null;
        for(const z of rts){
          if(Math.abs(z[1])>1e-6*(1+Math.abs(z[0])))continue;
          const base=Math.round(z[0]);
          for(const d of [0,-1,1]){const cand=Q(BigInt(base+d));if(qz(pevalQ(g,cand))){hit=cand;break;}}
          if(hit)break;
        }
        if(!hit)break;
        vals.push({re:qNum(hit)/Number(L),im:0,mult:m,q:Q(hit.n,L),exact:true,text:null});
        g=deflate(g,hit);
      }
      if(deg(g)<1)return;
      factors.push({poly:toA(g),mult:m});
      if(deg(g)===2){                                              /* closed form */
        const b=g[1].n,c=g[0].n,D=b*b-4n*c,Ln=Number(L);
        const text=quadForm(b,c,L);
        if(D>=0n){
          const sq=Math.sqrt(Number(D)),qq=-(Number(b)+Math.sign(Number(b)||1)*sq)/2,r1=qq,r2=Number(c)/qq;
          [r1,r2].sort((x,y)=>x-y).forEach(r=>vals.push({re:r/Ln,im:0,mult:m,q:null,exact:false,form:text,text:null}));
        }else{
          const sq=Math.sqrt(-Number(D));
          vals.push({re:-Number(b)/(2*Ln),im:sq/(2*Ln),mult:m,q:null,exact:false,form:text,text:null});
          vals.push({re:-Number(b)/(2*Ln),im:-sq/(2*Ln),mult:m,q:null,exact:false,form:text,text:null});
        }
      }else{                                                       /* cubic / quartic remainder: numeric */
        const co=g.map(qNum),rts=aberth(co),Ln=Number(L);
        rts.forEach(z=>{
          let re=z[0]/Ln,im=z[1]/Ln;
          if(Math.abs(im)<1e-9*(1+Math.abs(re)))im=0;
          vals.push({re,im,mult:m,q:null,exact:false,form:null,text:null});
        });
      }
    });
    vals.sort((p,q)=>p.re-q.re||p.im-q.im);
    /* eigenspaces */
    const Aeff=Aq;
    vals.forEach(v=>{
      if(v.q){
        const M=Aeff.map((r,i)=>r.map((x,j)=>i===j?qa(x,qn(v.q)):x));
        v.basisQ=nullQ(M);
        v.basis=v.basisQ.map(vec=>vec.map(q=>[qNum(q),0]));
      }else{
        const M=Aeff.map((r,i)=>r.map((x,j)=>[qNum(x)-(i===j?v.re:0),i===j?-v.im:0]));
        v.basis=nullC(M,v.mult);v.basisQ=null;
      }
      v.geo=v.basis.length;v.defective=v.geo<v.mult;
    });
    const real=vals.every(v=>v.im===0);
    const tr=Aq.reduce((s,r,i)=>qa(s,r[i]),ZERO);
    const detA=qm(cA[0],Q(n%2?-1n:1n));
    return {n,L,Aq,charA:cA,charB:cB,factors,values:vals,allReal:real,
      diagonalizable:vals.every(v=>!v.defective),trace:tr,det:detA,
      sumVals:vals.reduce((s,v)=>s+v.re*v.mult,0),prodVals:vals.reduce((p,v)=>p*Math.pow(Math.hypot(v.re,v.im),v.mult),1)};
  }
  return {analyze,cmul,cabs,cadd,csub,cdiv};
})();
