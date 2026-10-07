/* ============ EIGEN VECTOR — 2×2 VISUALIZATION (part of tab 6) ============
   No calculation of its own: it subscribes to window.EigenShared (published by eigen-calculator.js after every
   Calculate) and draws the exact same Eigen.analyze() result. Reuses the shared canvas helpers from
   linear-combination.js (fit, base, tgrid, square, arrow, infLine, badge, V, P) and the formatters exported
   by the calculator (window.EigenFmt).

   What is drawn, for A = [[a,b],[c,d]] and the morph A_t = I + t(A − I), t: 0 → 1:
   · original grid (faint, fixed) and the transformed grid A_t·grid, plus the unit square → parallelogram
   · for every REAL eigenvector v: its eigen-line, the dashed arrow v, the solid arrow A_t·v (computed with the
     matrix, not with λ) sweeping from v, and a ring at λv — so at t = 1 the arrow visibly lands on the ring: Av = λv
   · nothing is drawn for complex eigenvalues, and a drawn eigenvector must pass a numerical Av = λv check. */
(function(){
  'use strict';
  const F=window.EigenFmt,SH=window.EigenShared,SUBS=['\u2081','\u2082'];
  const COLV=['#ffc857','#ff5fa2'];                          /* eigenpair 1 / 2 (existing --amber / --pink) */
  const GRID_COL='rgba(91,124,255,.34)',GRID_AX='rgba(120,150,255,.72)',FAN_COL='rgba(233,237,248,.2)';
  const RES_TOL=1e-8,MAX_ARROW=4.5;
  const st={mode:'idle',M:[[1,0],[0,1]],lines:[],fan:[],rejected:0,sel:null,t:1,range:5,raf:0,playing:false};

  const card=$('#egvViz'),body=$('#egvBody'),empty=$('#egvEmpty'),emptyMsg=$('#egvEmptyMsg'),to2=$('#egvTo2'),
        cv=$('#egvCanvas'),note=$('#egvNote'),info=$('#egvInfo'),legend=$('#egvLegend'),rmNote=$('#egvRm'),
        bPlay=$('#egvPlay'),bPause=$('#egvPause'),bReset=$('#egvReset'),slT=$('#egvT'),slR=$('#egvRange');
  const mq=window.matchMedia('(prefers-reduced-motion: reduce)'),reduced=()=>mq.matches;
  const n2=(x,d=3)=>F.numStr(x,d);
  const vtxt=(a,d=3)=>'('+a.map(x=>n2(x,d)).join(', ')+')';
  const mul=(M,v)=>[M[0][0]*v[0]+M[0][1]*v[1],M[1][0]*v[0]+M[1][1]*v[1]];
  const tM=t=>[[1+t*(st.M[0][0]-1),t*st.M[0][1]],[t*st.M[1][0],1+t*(st.M[1][1]-1)]];

  /* ---------- model: what is honestly drawable for this matrix ---------- */
  function build(M,an){
    let mode;
    if(!an.allReal)mode='complex';                                              /* no real eigenvector exists */
    else if(an.values.length===1&&an.values[0].geo===2)mode='plane';             /* repeated, two independent: A = λI */
    else if(an.values.some(v=>v.defective))mode='defective';                    /* repeated, ONE independent eigenvector */
    else mode='lines';                                                           /* two distinct real eigenvalues */
    const lines=[];let rejected=0;
    if(mode!=='complex'){
      const grp={};
      an.values.forEach((v,vi)=>{
        const key=v.form||('#'+vi);grp[key]=grp[key]||0;const idx=grp[key]++;
        const lamTxt=F.lamText(v,idx,null,3);
        let cand;
        if(mode==='plane')cand=[{d:[1,0],vt:['1','0']},{d:[0,1],vt:['0','1']}];  /* e₁, e₂ — valid examples, every vector is one */
        else cand=v.basis.map((b,k)=>({d:[b[0][0],b[1][0]],im:Math.max(Math.abs(b[0][1]),Math.abs(b[1][1])),
          vt:v.q?v.basisQ[k].map(F.qStr):[b[0][0],b[1][0]].map(x=>n2(x,3))}));
        cand.forEach(cd=>{
          const len=Math.hypot(cd.d[0],cd.d[1]);
          const Av=mul(M,cd.d),res=Math.hypot(Av[0]-v.re*cd.d[0],Av[1]-v.re*cd.d[1])/(1+Math.hypot(Av[0],Av[1]));
          if(!(len>1e-9)||(cd.im||0)>1e-9||!(res<RES_TOL)){rejected++;return;}   /* never draw an unverified eigenvector */
          const k=Math.min(1,MAX_ARROW/(len*Math.max(1,Math.abs(v.re))));         /* scale only if it would leave the view */
          lines.push({lam:v.re,d:cd.d,dd:[cd.d[0]*k,cd.d[1]*k],k,u:[cd.d[0]/len,cd.d[1]/len],vt:cd.vt,lamTxt,
            exact:!!v.q,closed:!!v.form,color:COLV[lines.length%2],val:v});
        });
      });
    }
    const fan=mode==='plane'?[30,45,60,120,135,150].map(a=>[Math.cos(a*Math.PI/180),Math.sin(a*Math.PI/180)]):[];
    return {mode,lines,fan,rejected};
  }
  function autoRange(){                                       /* a view in which the grid image, v, Av and λv all fit */
    const [[a,b],[c,d]]=st.M;let ext=1;
    [a,b,c,d,a+b,c+d].forEach(x=>{ext=Math.max(ext,Math.abs(x));});
    st.lines.forEach(l=>{ext=Math.max(ext,Math.abs(l.dd[0]),Math.abs(l.dd[1]),Math.abs(l.lam*l.dd[0]),Math.abs(l.lam*l.dd[1]));});
    st.range=Math.min(12,Math.max(3,Math.ceil(ext*1.3*2)/2));
    slR.value=st.range;$('#egvRv').textContent=st.range;
  }

  /* ---------- text ---------- */
  const lamLine=l=>'\u03bb'+(l.exact||l.closed?' = ':' \u2248 ')+l.lamTxt;
  function effect(l){
    if(Math.abs(l)<1e-9)return 'collapses v to the zero vector';
    const a=Math.abs(l),f=a>1+1e-9?'stretches':a<1-1e-9?'shrinks':'keeps the length of';
    return f+' v'+(l<0?' and reverses its direction (still on the same line)':'');
  }
  function renderNote(){
    const L=st.lines[0],c=L?L.lamTxt:'';
    const t={
      lines:'A has two distinct real eigenvalues, so there are two eigenvector lines (dashed). Each dashed arrow is an eigenvector v and each ring marks \u03bbv. Tap an eigenvector (or its card below) to focus on it. Press Play: the solid arrow Av grows out of v and lands exactly on the ring, because A only scales v. Every other direction gets turned.',
      plane:'The eigenvalue \u03bb = '+c+' is repeated and has two independent eigenvectors: A = \u03bbI scales every vector by the same factor, so every non-zero vector is an eigenvector (the faint lines are more of them). e\u2081 and e\u2082 are shown as two examples.',
      defective:'The eigenvalue \u03bb = '+c+' is repeated, but there is only one independent eigenvector (geometric multiplicity 1, algebraic multiplicity 2), so A is not diagonalizable. Only that single line is drawn \u2014 there is no second eigenvector. Everything off the line is sheared away from it.',
      complex:'A has no real eigenvalues, so it has no real eigenvectors: no line through the origin is sent to itself. Nothing is drawn as an eigenvector; the grid still shows what A does to the plane. The complex eigenvalues are listed below.'
    }[st.mode];
    note.className='eg-notice'+(st.mode==='complex'?' warn':'');note.textContent=t;
  }
  function renderLegend(){
    let h='<span style="--c:rgba(233,237,248,.45)">original grid</span><span style="--c:var(--blue)">transformed grid</span><span style="--c:var(--violet)">unit square under A</span>';
    if(st.lines.length)h+='<span class="dash" style="--c:var(--ink)">v (eigenvector)</span><span style="--c:var(--ink)">Av (moving arrow)</span><span class="ring" style="--c:var(--ink)">\u03bbv (target)</span>';
    legend.innerHTML=h;
  }
  function renderInfo(){
    let h='';
    if(st.mode==='complex'){
      const vals=SH.state.an?SH.state.an.values:[];const grp={};
      vals.forEach((v,i)=>{
        const key=v.form||('#'+i);grp[key]=grp[key]||0;const lt=F.lamText(v,grp[key]++,null,3),ap=F.cStr([v.re,v.im],3);
        h+='<div class="egv-row"><div class="egv-h">\u03bb'+(SUBS[i]||'')+' = '+lt+(v.form&&ap!==lt?' <span class="eg-approx">\u2248 '+ap+'</span>':'')+'</div><div class="eg-note">Complex eigenvalue \u2014 no real eigenvector to draw.</div></div>';
      });
      info.innerHTML=h;return;
    }
    st.lines.forEach((l,i)=>{
      const Av=mul(st.M,l.dd),lv=[l.lam*l.dd[0],l.lam*l.dd[1]];
      const err=Math.hypot(Av[0]-lv[0],Av[1]-lv[1])/(1+Math.hypot(Av[0],Av[1])),ok=err<RES_TOL;
      const vShown=l.k===1?'('+l.vt.join(', ')+')':vtxt(l.dd);
      h+='<div class="egv-row egv-pick" data-i="'+i+'" tabindex="0" role="button" aria-pressed="false" style="--c:'+l.color+'"><div class="egv-h"><i></i>\u03bb'+SUBS[i]+(l.exact||l.closed?' = ':' \u2248 ')+l.lamTxt+(l.closed?' <span class="eg-approx">\u2248 '+n2(l.lam)+'</span>':'')+'<small> \u2194 v'+SUBS[i]+'</small></div>'+
        '<dl><dt>v'+SUBS[i]+(l.k===1?'':' (scaled copy)')+'</dt><dd>'+vShown+'</dd>'+
        '<dt>Av'+SUBS[i]+' (matrix \u00d7 v)</dt><dd>'+vtxt(Av)+'</dd>'+
        '<dt>\u03bb'+SUBS[i]+'v'+SUBS[i]+' (number \u00d7 v)</dt><dd>'+vtxt(lv)+'</dd></dl>'+
        '<div class="egv-rel '+(ok?'ok':'bad')+'">'+(ok?'\u2713':'\u2717')+' Av'+SUBS[i]+' = \u03bb'+SUBS[i]+'v'+SUBS[i]+(l.exact?'':' <small>(checked numerically)</small>')+'</div>'+
        '<div class="eg-note">\u03bb = '+n2(l.lam)+' '+effect(l.lam)+'.'+(l.k===1?'':' The arrow is drawn at '+n2(l.k,3)+'\u00d7 the basis vector so it fits; any non-zero multiple of an eigenvector is an eigenvector.')+'</div></div>';
    });
    if(st.rejected)h+='<div class="eg-note warn">'+st.rejected+' computed eigenvector'+(st.rejected>1?'s':'')+' failed the Av = \u03bbv check and '+(st.rejected>1?'were':'was')+' not drawn.</div>';
    info.innerHTML=h;
  }
  function describe(){                                          /* accessible text alternative for the canvas */
    let s='A grid in the plane, shown before and after applying the matrix. ';
    if(st.mode==='complex')s+='The matrix has no real eigenvectors.';
    else s+=st.lines.map((l,i)=>'Eigenvector v'+(i+1)+' = ('+l.vt.join(', ')+') with eigenvalue '+n2(l.lam)+'.').join(' ')+(st.mode==='defective'?' There is only one independent eigenvector.':'');
    cv.setAttribute('aria-label',s);
  }

  /* ---------- drawing ---------- */
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const hit=(p,q)=>p[0]<q[2]&&q[0]<p[2]&&p[1]<q[3]&&q[1]<p[3];
  function tag(ctx,c,placed,px,py,text,color){                 /* label that avoids earlier labels and the canvas edge */
    ctx.font='500 12px Sora, system-ui, sans-serif';ctx.textAlign='left';
    const w=ctx.measureText(text).width,offs=[[10,-8],[10,18],[-w-10,-8],[-w-10,18],[-w/2,-18],[-w/2,26],[10,-26],[10,36],[-w-10,-26],[-w-10,36]];
    let best=null;
    for(const [dx,dy] of offs){
      const x=clamp(px+dx,4,c._w-w-4),y=clamp(py+dy,14,c._h-8),r=[x-3,y-13,x+w+3,y+4];
      best={x,y,r};if(!placed.some(q=>hit(q,r)))break;
    }
    placed.push(best.r);
    ctx.lineWidth=4;ctx.lineJoin='round';ctx.strokeStyle='rgba(6,9,19,.92)';ctx.strokeText(text,best.x,best.y);
    ctx.fillStyle=color;ctx.fillText(text,best.x,best.y);
  }
  function draw(){
    if(st.mode==='idle'||(!cv.offsetParent&&!cv.getBoundingClientRect().width))return;
    fit(cv);const ctx=cv.getContext('2d'),c=cv;ctx.setTransform(c._d,0,0,c._d,0,0);
    const keep=V.range;V.range=st.range;
    try{
      const t=st.t,Mt=tM(t);
      base(ctx,c);                                              /* original grid + axes, fixed */
      tgrid(ctx,c,Mt,GRID_COL,GRID_AX);                         /* transformed grid */
      square(ctx,c,Mt);
      const dim=l=>st.sel!==null&&st.lines[st.sel]!==l,fade=(hex,a)=>'rgba('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(',')+','+a+')';
      st.fan.forEach(u=>infLine(ctx,c,u[0],u[1],FAN_COL,[3,6],1));
      st.lines.forEach(l=>infLine(ctx,c,l.u[0],l.u[1],dim(l)?fade(l.color,.25):l.color,[7,6],dim(l)?1.2:st.sel!==null?2.6:1.6));
      const items=st.lines.map(l=>{
        const Av=mul(Mt,l.dd),tg=[l.lam*l.dd[0],l.lam*l.dd[1]];  /* Av from the matrix, λv from the scalar: independent */
        return {l,Av,tg,pv:P(c,l.dd[0],l.dd[1]),pt:P(c,tg[0],tg[1]),pa:P(c,Av[0],Av[1])};
      });
      items.forEach(({l,pt})=>{                                 /* v (dashed) and the λv target ring */
        ctx.save();ctx.globalAlpha=dim(l)?.2:.7;arrow(ctx,c,l.dd[0],l.dd[1],l.color,2,0,0,[5,4]);ctx.restore();
        ctx.save();ctx.globalAlpha=dim(l)?.25:1;ctx.fillStyle='rgba(6,9,19,.55)';ctx.strokeStyle=l.color;ctx.lineWidth=2.5;
        ctx.beginPath();ctx.arc(pt[0],pt[1],10,0,7);ctx.fill();ctx.stroke();ctx.restore();
      });
      items.forEach(({l,Av,pa})=>{                              /* Av (solid, moving) */
        ctx.save();ctx.globalAlpha=dim(l)?.25:1;
        arrow(ctx,c,Av[0],Av[1],l.color,4,0,0);
        ctx.fillStyle=l.color;ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(pa[0],pa[1],4.5,0,7);ctx.fill();ctx.stroke();ctx.restore();
      });
      const o=P(c,0,0);ctx.fillStyle='#e9edf8';ctx.beginPath();ctx.arc(o[0],o[1],3,0,7);ctx.fill();

      /* labels: names that sit on the same spot are merged (Av₁ = λ₁v₁ once the arrow has landed) */
      const text=t>=.999?'Matrix A (t = 1)':t<=.001?'Identity (t = 0)':'t = '+n2(t,2);
      ctx.font='500 12px Sora, system-ui, sans-serif';
      const placed=[[8,c._h-30,8+ctx.measureText(text).width+16,c._h-8]];
      items.forEach(({l,pv,pt,pa},i)=>{
        const s=SUBS[i],pts=[['Av'+s,pa,0],['\u03bb'+s+'v'+s,pt,1],['v'+s,pv,2]],used=[];
        pts.forEach(a=>{
          if(used.includes(a))return;
          const grp=[a];used.push(a);
          pts.forEach(b=>{if(!used.includes(b)&&Math.hypot(a[1][0]-b[1][0],a[1][1]-b[1][1])<10){grp.push(b);used.push(b);}});
          grp.sort((x,y)=>x[2]-y[2]);
          tag(ctx,c,placed,a[1][0],a[1][1],grp.map(g=>g[0]).join(' = '),dim(l)?fade(l.color,.4):l.color);
        });
      });
      items.forEach(({l},i)=>{                                  /* eigenvalue tied to its eigenvector line */
        const sg=(l.u[0]>1e-9||(Math.abs(l.u[0])<=1e-9&&l.u[1]>0))?1:-1,r=st.range*.88/Math.max(Math.abs(l.u[0]),Math.abs(l.u[1]),1e-9);
        const p=P(c,sg*l.u[0]*r,sg*l.u[1]*r);
        tag(ctx,c,placed,p[0],p[1],'\u03bb'+SUBS[i]+(l.exact?' = ':' \u2248 ')+(l.exact?l.lamTxt:n2(l.lam,3)),dim(l)?fade(l.color,.4):l.color);
      });
      badge(ctx,c,text,st.mode==='complex'?'#ff9bc6':'#9aa6d1');
    }finally{V.range=keep;}
  }
  window.egvDraw=draw;

  /* ---------- select an eigenvector: tap its line/arrow on the canvas, or its card ---------- */
  function select(i){
    st.sel=(i===null||i===st.sel)?null:i;
    info.querySelectorAll('.egv-pick').forEach(r=>{const on=+r.dataset.i===st.sel;r.classList.toggle('sel',on);r.setAttribute('aria-pressed',on);});
    draw();
  }
  info.addEventListener('click',e=>{const r=e.target.closest('.egv-pick');if(r)select(+r.dataset.i);});
  info.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('egv-pick')){e.preventDefault();select(+e.target.dataset.i);}});
  function pickAt(x,y){                                         /* nearest eigen-line within a finger-sized distance */
    const o=P(cv,0,0);let best=null,bd=28;
    st.lines.forEach((l,i)=>{
      const q=P(cv,l.u[0],l.u[1]),dx=q[0]-o[0],dy=q[1]-o[1],L=Math.hypot(dx,dy)||1;
      const d=Math.abs((x-o[0])*dy-(y-o[1])*dx)/L;
      if(d<bd){bd=d;best=i;}
    });
    return best;
  }
  const withRange=f=>{const k=V.range;V.range=st.range;try{return f();}finally{V.range=k;}};
  let down=null;
  cv.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
  cv.addEventListener('pointerup',e=>{
    if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>8){down=null;return;}down=null;
    if(!st.lines.length)return;
    const r=cv.getBoundingClientRect(),i=withRange(()=>pickAt(e.clientX-r.left,e.clientY-r.top));
    if(i===null)select(null);else if(i!==st.sel)select(i);else select(null);
  });
  cv.addEventListener('pointermove',e=>{
    if(!st.lines.length||e.pointerType==='touch')return;
    const r=cv.getBoundingClientRect();cv.style.cursor=withRange(()=>pickAt(e.clientX-r.left,e.clientY-r.top))!==null?'pointer':'default';
  });

  /* ---------- animation controls ---------- */
  function setBtns(){bPlay.disabled=st.playing;bPause.disabled=!st.playing;}
  function stop(){cancelAnimationFrame(st.raf);st.playing=false;setBtns();}
  function play(){
    if(reduced()){stop();st.t=1;slT.value=100;draw();return;}   /* no motion: jump to the result */
    stop();const t0=performance.now(),from=st.t>=.999?0:st.t,dur=2600*(1-from);
    st.playing=true;setBtns();
    const step=now=>{
      if(!cv.offsetParent){stop();return;}                      /* tab hidden: pause where we are */
      const p=Math.min(1,(now-t0)/dur),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
      st.t=from+(1-from)*e;slT.value=st.t*100;draw();
      if(p<1)st.raf=requestAnimationFrame(step);else{st.t=1;slT.value=100;stop();draw();}
    };
    st.raf=requestAnimationFrame(step);
  }
  bPlay.onclick=play;bPause.onclick=stop;
  bReset.onclick=()=>{stop();st.t=0;slT.value=0;draw();};
  slT.addEventListener('input',()=>{stop();st.t=slT.value/100;draw();});
  slR.addEventListener('input',()=>{st.range=+slR.value;$('#egvRv').textContent=st.range;draw();});
  const syncRm=()=>{rmNote.hidden=!reduced();};
  (mq.addEventListener?mq.addEventListener('change',()=>{syncRm();if(reduced()&&st.playing){stop();st.t=1;slT.value=100;draw();}}):mq.addListener(syncRm));
  syncRm();
  new ResizeObserver(()=>draw()).observe(card);

  /* ---------- shared state from the calculator ---------- */
  function showEmpty(msg,offer){
    stop();st.mode='idle';st.lines=[];
    body.hidden=true;empty.hidden=false;emptyMsg.textContent=msg;to2.hidden=!offer;
  }
  function load(s){
    stop();
    const m=build(s.M,s.an);
    st.M=s.M;st.mode=m.mode;st.lines=m.lines;st.fan=m.fan;st.rejected=m.rejected;st.sel=null;st.t=1;slT.value=100;
    empty.hidden=true;body.hidden=false;
    autoRange();renderNote();renderLegend();renderInfo();describe();setBtns();draw();
  }
  to2.onclick=()=>SH.setSize(2);
  SH.subscribe(s=>{
    card.classList.toggle('eg-stale',s.status==='stale');
    if(s.status==='ok'){
      if(s.n!==2)showEmpty('The visualization shows how a 2\u00d72 matrix moves the plane. A '+s.n+'\u00d7'+s.n+' matrix acts on a space you cannot draw on a flat grid, so only the calculation above applies.',true);
      else load(s);
    }else if(s.status==='invalid')showEmpty('Fix the highlighted entry and press Calculate to see the visualization.',false);
  });
})();
