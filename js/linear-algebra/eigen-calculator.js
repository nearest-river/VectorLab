/* ============ EIGENVECTORS PAGE: matrix input → Calculate → eigenvalues & eigenvectors (tab 6) ============
   UI only: all math lives in eigen-core.js. The result of every calculation is published once through
   window.EigenShared, which the 2×2 visualization (js/visualization/eigen-visualizer.js) subscribes to, so the
   input, the written solution and the visualization always describe the same matrix. Reuses $, neg, parseVal, parseQ, mkQ, EXACT, SUP from the
   existing scripts and the shared .mx / .seg / .chip / .glass / .sm-status styles. */
(function(){
  'use strict';
  const st={n:2,cells:[],prec:4};
  const PRESETS={
    2:[['Distinct real',[[2,1],[1,2]]],['Repeated (diagonalizable)',[[3,0],[0,3]]],['Repeated (one eigenvector)',[[1,1],[0,1]]],['Irrational',[[2,1],[1,1]]],['Complex (rotation)',[[0,-1],[1,0]]]],
    3:[['Distinct real',[[2,1,0],[0,3,1],[0,0,4]]],['Repeated λ=3',[[4,1,1],[1,4,1],[1,1,4]]],['Repeated (one eigenvector)',[[2,1,0],[0,2,1],[0,0,2]]],['Irrational',[[2,-1,0],[-1,2,-1],[0,-1,2]]],['Complex pair',[[0,-1,0],[1,0,0],[0,0,2]]]],
    4:[['Symmetric tridiagonal',[[2,1,0,0],[1,2,1,0],[0,1,2,1],[0,0,1,2]]],['Repeated, blocks',[[1,2,0,0],[0,1,0,0],[0,0,3,4],[0,0,0,3]]],['Complex (rotations)',[[0,1,0,0],[-1,0,0,0],[0,0,0,1],[0,0,-1,0]]]]
  };
  const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const sup=m=>m>1?'<sup>'+m+'</sup>':'';
  const SUBS=['\u2081','\u2082','\u2083','\u2084'];

  /* ---------- number formatting (no "-0", NaN, Infinity or float noise) ---------- */
  function numStr(x,dp){
    if(!isFinite(x))return '\u2014';
    let v=Math.abs(x)<1e-9?0:+x.toFixed(dp);
    if(v===0)v=0;
    return neg(String(v));
  }
  function cStr(z,dp){
    const re=Math.abs(z[0])<1e-9?0:z[0],im=Math.abs(z[1])<1e-9?0:z[1];
    if(im===0)return numStr(re,dp);
    const a=Math.abs(im),ia=(+a.toFixed(dp)===1?'':numStr(a,dp))+'i';
    if(re===0||+re.toFixed(dp)===0)return (im<0?'\u2212':'')+ia;
    return numStr(re,dp)+(im<0?' \u2212 ':' + ')+ia;
  }
  const qStr=q=>q.d===1n?neg(q.n.toString()):neg(q.n+'/'+q.d);
  function polyStr(co){                          /* co: Q[] low → high, in λ */
    let out='';
    for(let k=co.length-1;k>=0;k--){
      const c=co[k];if(c.n===0n)continue;
      const ng=c.n<0n,ac=mkQ(ng?-c.n:c.n,c.d),one=ac.n===1n&&ac.d===1n;
      let body;
      if(k===0)body=qStr(ac);
      else body=(one?'':ac.d===1n?ac.n.toString():'('+ac.n+'/'+ac.d+')')+'\u03bb'+(k>1?(SUP[k]||'^'+k):'');
      out+=out?(ng?' \u2212 ':' + ')+body:(ng?'\u2212':'')+body;
    }
    return out||'0';
  }
  const scaleQ=(co,s)=>co.map(c=>EXACT.mul(c,s));
  const matHtml=rows=>'<span class="eg-mat" style="--c:'+rows[0].length+'">'+rows.flat().map(x=>'<i>'+x+'</i>').join('')+'</span>';
  const vecHtml=cells=>'<span class="eg-mat eg-col" style="--c:1">'+cells.map(x=>'<i>'+x+'</i>').join('')+'</span>';

  /* ---------- eigenvalue text ---------- */
  function lamText(v,idx,grp,dp){
    if(v.q)return qStr(v.q);
    if(v.form){
      const s=idx===0?'\u2212':'+';
      let t=v.form.replace('\u00b1',s);
      if(t.startsWith('+'))t=t.slice(1);
      return esc(t).replace(/^\(\u2212/,'(\u2212');
    }
    return cStr([v.re,v.im],dp);
  }
  function lamApprox(v,dp){return cStr([v.re,v.im],dp);}
  function tagFor(v){return v.exact?['exact','exact']:v.form?['closed','exact form']:['approx','\u2248 numerical'];}

  /* ---------- verification A·v = λ·v ---------- */
  function residual(an,v,vec){
    let r=0,sc=1;
    for(let i=0;i<an.n;i++){
      let s=[0,0];
      for(let j=0;j<an.n;j++){const a=Number(an.Aq[i][j].n)/Number(an.Aq[i][j].d);s=Eigen.cadd(s,[a*vec[j][0],a*vec[j][1]]);sc=Math.max(sc,Math.abs(a));}
      const lv=Eigen.cmul([v.re,v.im],vec[i]);
      r=Math.max(r,Eigen.cabs(Eigen.csub(s,lv)));
    }
    return r/sc;
  }

  /* ---------- rendering ---------- */
  function render(an){
    const dp=st.prec,n=an.n,A=an.Aq,odd=n%2===1;
    const g={};an.values.forEach(v=>{const k=v.form||('#'+Math.random());(g[k]=g[k]||[]).push(v);});
    const idxOf=v=>v.form?g[v.form].indexOf(v):0;
    /* step 1 */
    const symb=A.map((r,i)=>r.map((q,j)=>i!==j?qStr(q):(q.n===0n?'\u2212\u03bb':qStr(q)+' \u2212 \u03bb')));
    let h='<div class="eg-step"><h3><b>1</b>Form A \u2212 \u03bbI</h3><p>Subtract \u03bb from each diagonal entry. A non-zero v can satisfy (A \u2212 \u03bbI)v = 0 only when this matrix is singular, i.e. its determinant is 0.</p><div class="eg-scroll">'+matHtml(symb)+'</div></div>';
    /* step 2 */
    const co=an.charA.map(c=>odd?EXACT.neg(c):c);
    const poly=polyStr(co);
    let fac=[];
    an.values.filter(v=>v.q).forEach(v=>{const z=v.q.n===0n;fac.push('(\u03bb'+(z?'':(v.q.n>0n?' \u2212 '+qStr(v.q):' + '+qStr(mkQ(-v.q.n,v.q.d))))+')'+sup(v.mult));});
    an.factors.forEach(f=>fac.push('('+polyStr(f.poly)+')'+sup(f.mult)));
    const factored=(odd?'\u2212':'')+fac.join('');
    const showFac=fac.length>1||an.values.some(v=>v.mult>1&&v.q)||(fac.length===1&&an.values.some(v=>v.mult>1));
    h+='<div class="eg-step"><h3><b>2</b>Characteristic polynomial</h3><div class="eg-eq">det(A \u2212 \u03bbI) = '+poly+(showFac?'<br>= '+factored:'')+'</div>';
    if(n===2)h+='<p class="eg-note">For 2\u00d72: \u03bb\u00b2 \u2212 tr(A)\u03bb + det(A), with tr(A) = '+qStr(an.trace)+' and det(A) = '+qStr(an.det)+'.</p>';
    h+='<p class="eg-note">Its roots are the eigenvalues. Solving det(A \u2212 \u03bbI) = 0:</p></div>';
    /* step 3 */
    h+='<div class="eg-step"><h3><b>3</b>Eigenvalues</h3><ul class="eg-vals">';
    an.values.forEach((v,i)=>{
      const [tc,tl]=tagFor(v),t=lamText(v,idxOf(v),g,dp),isNum=!v.q&&!v.form;
      const apv=lamApprox(v,dp),ap=((v.q&&v.q.d!==1n)||v.form)&&apv!==t?' <span class="eg-approx">\u2248 '+apv+'</span>':'';
      h+='<li><span class="eg-lam">\u03bb'+(SUBS[i]||'')+(isNum?' \u2248 ':' = ')+t+ap+'</span><span class="eg-meta">algebraic multiplicity '+v.mult+'</span><span class="eg-tag '+tc+'">'+tl+'</span></li>';
    });
    h+='</ul>';
    if(!an.allReal)h+='<p class="eg-note warn">Some eigenvalues are complex, so those eigenvalues have no real eigenvectors \u2014 their eigenvectors have complex entries.</p>';
    h+='<p class="eg-note">Check: the eigenvalues (counted with multiplicity) add up to tr(A) = '+qStr(an.trace)+' and multiply to det(A) = '+qStr(an.det)+'. The eigenvalue \u03bb tells you how much its eigenvector is scaled.</p></div>';
    /* step 4 */
    h+='<div class="eg-step"><h3><b>4</b>Eigenvectors</h3><p class="eg-note">For each \u03bb, solve (A \u2212 \u03bbI)v = 0. Every non-zero solution is an eigenvector; the solutions form the <i>eigenspace</i>.</p>';
    an.values.forEach((v,i)=>{
      const t=lamText(v,idxOf(v),g,dp),isC=v.im!==0;
      h+='<div class="eg-ev"><div class="eg-evh">For \u03bb'+(SUBS[i]||'')+(!v.q&&!v.form?' \u2248 ':' = ')+t+'</div>';
      /* matrix A − λI */
      let mrows;
      if(v.q)mrows=A.map((r,a)=>r.map((q,b)=>a===b?qStr(EXACT.add(q,EXACT.neg(v.q))):qStr(q)));
      else mrows=A.map((r,a)=>r.map((q,b)=>cStr([Number(q.n)/Number(q.d)-(a===b?v.re:0),a===b?-v.im:0],dp)));
      h+='<div class="eg-solve"><span class="eg-scroll">'+matHtml(mrows)+'</span><span class="eg-op">v = 0</span></div>';
      h+='<div class="eg-basis">';v._res=0;
      v.basis.forEach((vec,k)=>{
        const cs=v.q?v.basisQ[k].map(qStr):vec.map(c=>cStr(c,dp));
        const res=residual(an,v,vec);
        h+='<span class="eg-bv"><span class="eg-vn">v'+(v.basis.length>1?SUBS[k]||'':'')+' =</span>'+vecHtml(cs)+'</span>';
        v._res=Math.max(v._res||0,res);
      });
      h+='</div>';
      const ok=v.q?true:v._res<1e-8;
      h+='<p class="eg-note">'+(v.q?'\u2713 Av = \u03bbv holds exactly for these vectors.':ok?'\u2713 Av = \u03bbv checked numerically (error < 10<sup>\u22128</sup>).':'Numerical check shows a larger error than expected \u2014 treat this vector with caution.');
      if(v.geo>1)h+=' The eigenspace has dimension '+v.geo+': every non-zero combination of these vectors is an eigenvector, not just the ones shown.';
      else if(v.mult>1&&v.defective)h+=' Algebraic multiplicity is '+v.mult+' but there is only '+v.geo+' independent eigenvector (geometric multiplicity '+v.geo+').';
      else if(v.geo===1)h+=' Any non-zero multiple of v is also an eigenvector.';
      if(isC)h+=' (complex entries)';
      h+='</p></div>';
    });
    if(!an.diagonalizable)h+='<p class="eg-note warn">A is defective: for at least one eigenvalue there are fewer independent eigenvectors than its algebraic multiplicity, so A cannot be diagonalized.</p>';
    else if(an.allReal)h+='<p class="eg-note">A has a full set of '+n+' independent real eigenvectors, so it is diagonalizable: A = PDP<sup>\u22121</sup>.</p>';
    h+='</div>';
    return h;
  }

  /* ---------- shared state (calculator → visualization) ---------- */
  const listeners=[];
  const Shared=window.EigenShared={
    state:{status:'idle'},
    subscribe(fn){listeners.push(fn);fn(Shared.state);},
    setSize(n){if(n!==st.n)setSize(n);}
  };
  function emit(s){Shared.state=s;listeners.forEach(fn=>fn(s));}

  /* ---------- inputs ---------- */
  const mx=$('#egMx'),out=$('#egOut'),status=$('#egStatus'),calcBtn=$('#egCalc');
  function setSize(n){
    const old=st.cells,on=st.n;st.n=n;
    st.cells=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i<on&&j<on&&old[i]?old[i][j]:(i===j?'1':'0')));
    buildInputs();compute();
  }
  function setValues(M){st.cells=M.map(r=>r.map(x=>String(x)));buildInputs();compute();}
  function buildInputs(){
    $('#egSizes').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.n===st.n));
    mx.innerHTML='';mx.style.gridTemplateColumns='repeat('+st.n+',auto)';mx.dataset.n=st.n;
    for(let i=0;i<st.n;i++)for(let j=0;j<st.n;j++){
      const inp=document.createElement('input');
      inp.type='text';inp.inputMode='decimal';inp.autocomplete='off';inp.spellcheck=false;
      inp.setAttribute('aria-label','Row '+(i+1)+', column '+(j+1));inp.value=neg(st.cells[i][j]);
      inp.addEventListener('input',()=>{st.cells[i][j]=inp.value;markStale();});
      inp.addEventListener('keydown',e=>{
        if(e.key==='Enter'){e.preventDefault();compute();return;}
        if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();
        const step=e.shiftKey?.1:.5,v=parseVal(inp.value),b=isNaN(v)?0:v;
        inp.value=neg(String(+(b+(e.key==='ArrowUp'?step:-step)).toFixed(6)));inp.dispatchEvent(new Event('input'));
      });
      mx.appendChild(inp);
    }
    const ps=$('#egPresets');ps.innerHTML='';
    (PRESETS[st.n]||[]).forEach(([name,M])=>{
      const b=document.createElement('button');b.className='chip';b.type='button';b.textContent=name;
      b.onclick=()=>setValues(M);ps.appendChild(b);
    });
  }
  /* read + validate the entries; returns Q[][] or null (and marks bad cells) */
  function readMatrix(){
    const inputs=mx.querySelectorAll('input'),Aq=[];let bad=null;
    for(let i=0;i<st.n;i++){Aq.push([]);for(let j=0;j<st.n;j++){
      const inp=inputs[i*st.n+j],s=st.cells[i][j].trim(),q=s===''?null:parseQ(s);
      inp.classList.toggle('bad',!q);
      if(!q&&!bad)bad=[i+1,j+1,s===''];
      Aq[i].push(q);
    }}
    return {Aq,bad};
  }
  const badMsg=bad=>'Row '+bad[0]+', column '+bad[1]+': '+(bad[2]?'this entry is empty.':'enter a number or a fraction such as 3/4.');
  function markStale(){                       /* entries edited: keep the last result visible but flag it */
    const {bad}=readMatrix();
    if(bad){status.className='sm-status err';status.textContent=badMsg(bad);}
    else{status.className='sm-status';status.textContent='Entries changed \u2014 press Calculate to update the results.';}
    out.classList.add('eg-stale');
    if(Shared.state.status==='ok')emit({status:'stale',prev:Shared.state.prev||Shared.state});
  }
  let ready=false,doneTimer=0;
  function announce(){                         /* visible + audible confirmation that a result was produced */
    if(!ready)return;
    status.className='sm-status ok';status.textContent='\u2713 Done \u2014 results updated below.';
    calcBtn.classList.add('done');calcBtn.textContent='\u2713 Calculated';
    clearTimeout(doneTimer);doneTimer=setTimeout(()=>{calcBtn.classList.remove('done');calcBtn.textContent='Calculate';},1400);
    out.classList.remove('eg-fresh');void out.offsetWidth;out.classList.add('eg-fresh');
    if(out.getBoundingClientRect().top>innerHeight*.7)out.scrollIntoView({block:'start'});
  }
  function compute(){
    const {Aq,bad}=readMatrix();
    out.classList.remove('eg-stale');
    if(bad){
      status.className='sm-status err';status.textContent=badMsg(bad);
      out.innerHTML='<p class="hint">Fix the highlighted entry to see the eigenvalues and eigenvectors.</p>';
      emit({status:'invalid'});return;
    }
    if(Aq.length!==st.n||Aq.some(r=>r.length!==Aq.length)){status.className='sm-status err';status.textContent='The matrix must be square.';emit({status:'invalid'});return;}
    status.className='sm-status ok';status.textContent='';
    try{
      const an=Eigen.analyze(Aq);                       /* the single place the matrix is analysed */
      out.innerHTML=(st.n===2?'<button type="button" class="chip eg-jump" id="egJump">Jump to the visualization \u2193</button>':'')+render(an);
      emit({status:'ok',n:st.n,an,M:Aq.map(r=>r.map(q=>Number(q.n)/Number(q.d)))});
      announce();
    }
    catch(e){console.error(e);status.className='sm-status err';status.textContent='Could not analyze this matrix.';out.innerHTML='';emit({status:'invalid'});}
  }
  calcBtn.addEventListener('click',compute);
  out.addEventListener('click',e=>{if(e.target.closest('#egJump')){const v=$('#egvViz');if(v)v.scrollIntoView({block:'start'});}});
  $('#egSizes').addEventListener('click',e=>{const b=e.target.closest('button[data-n]');if(b&&+b.dataset.n!==st.n)setSize(+b.dataset.n);});
  $('#egPrec').addEventListener('click',e=>{
    const b=e.target.closest('button[data-dp]');if(!b)return;
    st.prec=+b.dataset.dp;$('#egPrec').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));compute();
  });
  window.EigenFmt={numStr,cStr,qStr,lamText,tagFor,esc};
  st.cells=PRESETS[2][0][1].map(r=>r.map(String));
  buildInputs();compute();ready=true;
})();
