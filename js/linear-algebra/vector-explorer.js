/* ============ PHASE 2: VECTOR EXPLORER ============ */
const VCOL=['#5cf2b0','#ff6b6b','#a78bfa','#4fd1ff','#d4e157','#f472b6'];
const E={vecs:[{x:2,y:1,vis:true},{x:-1,y:2,vis:true}],iu:0,iv:1,a:1,b:1,mode:'tip',show:true,tt:1,raf:0};
const cex=$('#cex');
const vname=i=>'v'+SUB[i],tnum=v=>String(+(+v).toFixed(2));
const visIdx=()=>E.vecs.map((_,i)=>i).filter(i=>E.vecs[i].vis);
function rndVec(m){let x,y;do{x=Math.round(Math.random()*2*m-m);y=Math.round(Math.random()*2*m-m);}while(!x&&!y);return {x,y,vis:true};}

function renderVecs(){
  const box=$('#vlist');box.innerHTML='';
  if(!E.vecs.length)box.innerHTML='<p class="hint">No vectors yet. Add one to start.</p>';
  E.vecs.forEach((v,i)=>{
    const row=document.createElement('div');row.className='vrow';
    const eye=document.createElement('input');eye.type='checkbox';eye.className='eye';eye.checked=v.vis;eye.setAttribute('aria-label','Include '+vname(i));
    eye.onchange=()=>{v.vis=eye.checked;updateE({sync:false});};
    const nm=document.createElement('div');nm.className='vn';nm.innerHTML=`<b style="color:${VCOL[i]}">${vname(i)}</b><small></small>`;
    row.append(eye,nm);
    ['x','y'].forEach(k=>{
      const inp=document.createElement('input');inp.type='text';inp.inputMode='decimal';inp.autocomplete='off';inp.className='vin';inp.dataset.k=k;
      inp.setAttribute('aria-label',`${vname(i)} ${k} component`);inp.value=dec(v[k]);
      inp.addEventListener('input',()=>{
        const t=inp.value.trim();if(t===''||t==='-'||t==='.'||t==='\u2212')return;
        const n=parseVal(inp.value);if(isNaN(n)){inp.classList.add('bad');return;}
        inp.classList.remove('bad');v[k]=Math.max(-1e6,Math.min(1e6,n));updateE({sync:false});
      });
      inp.addEventListener('blur',()=>{inp.classList.remove('bad');inp.value=dec(v[k]);});
      inp.addEventListener('keydown',e=>{
        if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();
        const st=e.shiftKey?.1:.5,n=parseVal(inp.value),b=isNaN(n)?v[k]:n;
        inp.value=dec(+(b+(e.key==='ArrowUp'?st:-st)).toFixed(6));inp.dispatchEvent(new Event('input'));
      });
      row.append(inp);
    });
    const rm=document.createElement('button');rm.className='x';rm.textContent='\u00d7';rm.setAttribute('aria-label','Remove '+vname(i));
    rm.onclick=()=>{E.vecs.splice(i,1);renderVecs();renderOpsSel();updateE();};
    row.append(rm);box.append(row);
  });
  $('#vadd').disabled=E.vecs.length>=6;
  syncVecs();
}
function syncVecs(){
  document.querySelectorAll('#vlist .vrow').forEach((row,i)=>{
    const v=E.vecs[i];if(!v)return;
    row.querySelectorAll('.vin').forEach(el=>{if(document.activeElement!==el){el.value=dec(v[el.dataset.k]);el.classList.remove('bad');}});
    row.querySelector('.vn small').textContent='|v| = '+n2(Math.hypot(v.x,v.y));
    row.classList.toggle('off',!v.vis);
  });
}
function renderOpsSel(){
  const n=E.vecs.length;
  E.iu=Math.min(E.iu,Math.max(0,n-1));E.iv=Math.min(E.iv,Math.max(0,n-1));
  if(n>=2&&E.iu===E.iv)E.iv=(E.iu+1)%n;
  [['su',E.iu],['sv',E.iv]].forEach(([id,val])=>{const s=$('#'+id);s.innerHTML=E.vecs.map((_,i)=>`<option value="${i}">${vname(i)}</option>`).join('');s.value=val;});
  document.querySelectorAll('#ops select,#ops input,#ops .chip,#ops .btn,#ops .seg button').forEach(el=>el.disabled=n<2);
  $('#opnote').textContent=n<2?'Add at least two vectors to combine them.':'';
}
function setAB(a,b){E.a=a;E.b=b;$('#sa').value=a;$('#sb').value=b;$('#oa').textContent=tnum(a);$('#ob').textContent=tnum(b);}

/* expression (KaTeX, MathML output: no stylesheet needed) */
function renderExpr(){
  const el=$('#expr');
  if(E.vecs.length<2){el.innerHTML='';return;}
  const u=E.vecs[E.iu],v=E.vecs[E.iv],U=[u.x,u.y],W=[v.x,v.y],w=comb(E.a,U,E.b,W);
  const M=p=>`\\begin{bmatrix}${tnum(p[0])}\\\\${tnum(p[1])}\\end{bmatrix}`,sc=s=>s<0?`(${tnum(s)})`:tnum(s);
  const src=`\\mathbf{w}=${sc(E.a)}\\,\\mathbf{v}_{${E.iu+1}}+${sc(E.b)}\\,\\mathbf{v}_{${E.iv+1}}=${sc(E.a)}${M(U)}+${sc(E.b)}${M(W)}=${M(w)}`;
  const plain=`w = ${sc(E.a)}\u00b7${vname(E.iu)} + ${sc(E.b)}\u00b7${vname(E.iv)} = (${tnum(w[0])}, ${tnum(w[1])})`;
  if(window.katex){try{el.innerHTML=katex.renderToString(src,{output:'mathml',displayMode:true,throwOnError:false}).replace(/<annotation[\s\S]*?<\/annotation>/,'');return;}catch(e){}}
  el.textContent=plain;
}

/* analysis + explanation */
function edu(info,names){
  const k=info.k,L=c=>names[c],rel=info.rels.map(r=>`${L(r.j)} = ${termStr(r.terms,L)}`);
  if(k===0)return ['No vectors are included, so the span is {0}, the origin.'];
  if(info.rank===0)return [k===1?`${L(0)} is the zero vector, so its span is only the origin {0}. A single zero vector is linearly dependent.`:'Every included vector is the zero vector, so the span is only the origin {0}. The set is linearly dependent.'];
  const out=[];
  if(info.independent){
    if(k===1)return [`A single nonzero vector is linearly independent. Its span is the line of all multiples c\u00b7${L(0)} through the origin.`];
    out.push('These vectors are linearly independent because neither vector is a scalar multiple of the other.');
    out.push(`The span is \u211d\u00b2, meaning every vector in \u211d\u00b2 can be expressed as a linear combination of ${L(0)} and ${L(1)}.`);
    if(info.angle<2)out.push(`They are nearly parallel (${n2(info.angle)}\u00b0 apart), so they are independent, but reaching most points needs very large coefficients.`);
    return out;
  }
  if(info.zeros.length)out.push(`These vectors are linearly dependent because the set contains the zero vector (${info.zeros.map(L).join(', ')}).`);
  else if(k===2)out.push(`These vectors are linearly dependent because they lie on the same line through the origin: ${rel[0]}.`);
  else out.push(`These vectors are linearly dependent: more than two vectors in \u211d\u00b2 can never be independent. For example, ${rel[0]}.`);
  if(info.rank===1)out.push(`Their span is a line through the origin: all multiples of ${L(info.basis[0])}.`);
  else out.push(`Their span is \u211d\u00b2: ${L(info.basis[0])} and ${L(info.basis[1])} already span the plane, and the others are combinations of them.`);
  return out;
}
function renderAnalysis(){
  const vi=visIdx(),vs=vi.map(i=>[E.vecs[i].x,E.vecs[i].y]),names=vi.map(vname),info=spanInfo(vs),k=vs.length;
  const spanTxt=info.rank===2?'\u211d\u00b2':info.rank===1?'a line through the origin':'{0}, the origin';
  $('#spanbody').innerHTML=`
    <div class="hero"><div class="rk">${info.rank}</div><div><div class="h">Rank of the vector set</div><div class="cap">${k} included vector${k===1?'':'s'} of ${E.vecs.length}</div></div></div>
    <dl class="facts">
      <dt>Independence</dt><dd class="${info.independent?'yes':'no'}">${info.independent?(k?'independent':'independent (empty set)'):'dependent'}</dd>
      <dt>Span</dt><dd>${spanTxt}</dd>
      <dt>Span dimension</dt><dd>${info.dim}</dd>
    </dl>${edu(info,names).map(t=>`<p class="edu">${t}</p>`).join('')}`;
}
function updateE({sync=true}={}){
  syncVecs();
  renderAnalysis();renderExpr();drawE();
}

/* drawing */
function drawE(){
  const c=cex;if(!c.getBoundingClientRect().width)return;
  fit(c);const ctx=c.getContext('2d');ctx.setTransform(c._d,0,0,c._d,0,0);base(ctx,c);
  const vi=visIdx(),vs=vi.map(i=>[E.vecs[i].x,E.vecs[i].y]),info=spanInfo(vs);
  if(info.rank===2){
    ctx.fillStyle='rgba(255,200,87,.05)';ctx.fillRect(0,0,c._w,c._h);
    const p=vs[info.basis[0]],q=vs[info.basis[1]];
    tgrid(ctx,c,[[p[0],q[0]],[p[1],q[1]]],'rgba(255,200,87,.2)','rgba(255,200,87,.5)');
  }else if(info.rank===1)infLine(ctx,c,info.dir[0],info.dir[1],'#ffc857',[],3);
  else{const [ox,oy]=P(c,0,0);ctx.strokeStyle='#ffc857';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ox,oy,9,0,7);ctx.stroke();}
  /* input vectors */
  vi.forEach(i=>{const v=E.vecs[i];arrow(ctx,c,v.x,v.y,VCOL[i],2.4);});
  /* operation */
  if(E.show&&E.vecs.length>=2){
    const u=E.vecs[E.iu],v=E.vecs[E.iv],aU=[E.a*u.x,E.a*u.y],bV=[E.b*v.x,E.b*v.y],w=[aU[0]+bV[0],aU[1]+bV[1]],t=E.tt;
    const cu=VCOL[E.iu],cv2=VCOL[E.iv];
    ctx.save();ctx.globalAlpha=.6;
    arrow(ctx,c,aU[0],aU[1],cu,5);
    if(E.mode==='para'){
      arrow(ctx,c,bV[0],bV[1],cv2,5);
      ctx.globalAlpha=.85;
      arrow(ctx,c,t*aU[0]+bV[0],t*aU[1]+bV[1],cv2,2,t*aU[0],t*aU[1],[5,5]);
      arrow(ctx,c,t*bV[0]+aU[0],t*bV[1]+aU[1],cu,2,t*bV[0],t*bV[1],[5,5]);
    }else arrow(ctx,c,t*aU[0]+bV[0],t*aU[1]+bV[1],cv2,5,t*aU[0],t*aU[1]);
    ctx.restore();
    ctx.save();ctx.shadowColor='#fff';ctx.shadowBlur=12;arrow(ctx,c,w[0],w[1],'#ffffff',4);ctx.restore();
    if(Math.abs(E.a-1)>1e-9)label(ctx,c,aU[0],aU[1],`${tnum(E.a)}\u00b7${vname(E.iu)}`,cu);
    if(Math.abs(E.b-1)>1e-9)label(ctx,c,bV[0],bV[1],`${tnum(E.b)}\u00b7${vname(E.iv)}`,cv2);
    label(ctx,c,w[0],w[1],`w (${n2(w[0])}, ${n2(w[1])})`,'#ffffff');
  }
  /* labels + handles */
  vi.forEach(i=>{const v=E.vecs[i];label(ctx,c,v.x,v.y,`${vname(i)} (${n2(v.x)}, ${n2(v.y)})`,VCOL[i]);});
  vi.forEach(i=>{const v=E.vecs[i],[hx,hy]=P(c,v.x,v.y);ctx.fillStyle=VCOL[i];ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(hx,hy,6,0,7);ctx.fill();ctx.stroke();});
  badge(ctx,c,info.rank===2?'Span: \u211d\u00b2':info.rank===1?'Span: a line':'Span: {0}','#ffc857');
}
function playE(){
  cancelAnimationFrame(E.raf);
  if(reduce){E.tt=1;drawE();return;}
  const t0=performance.now();E.tt=0;
  const step=now=>{const p=Math.min(1,(now-t0)/1400);E.tt=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;drawE();if(p<1)E.raf=requestAnimationFrame(step);};
  E.raf=requestAnimationFrame(step);
}

/* controls */
$('#vadd').onclick=()=>{if(E.vecs.length>=6)return;E.vecs.push(rndVec(3));renderVecs();renderOpsSel();updateE();};
$('#vrand').onclick=()=>{E.vecs=E.vecs.map(v=>({...rndVec(4),vis:v.vis}));renderVecs();updateE();};
$('#vreset').onclick=()=>{E.vecs=[{x:2,y:1,vis:true},{x:-1,y:2,vis:true}];E.iu=0;E.iv=1;setAB(1,1);E.tt=1;renderVecs();renderOpsSel();updateE();};
$('#su').onchange=e=>{E.iu=+e.target.value;updateE();};
$('#sv').onchange=e=>{E.iv=+e.target.value;updateE();};
$('#sa').addEventListener('input',e=>{E.a=+e.target.value;$('#oa').textContent=tnum(E.a);updateE();});
$('#sb').addEventListener('input',e=>{E.b=+e.target.value;$('#ob').textContent=tnum(E.b);updateE();});
$('#opchips').addEventListener('click',e=>{
  const o=e.target.dataset.op;if(!o)return;
  if(o==='add')setAB(1,1);else if(o==='sub')setAB(1,-1);else setAB(2,0);
  E.tt=1;updateE();
});
$('#modes').addEventListener('click',e=>{
  const m=e.target.dataset.mode;if(!m)return;E.mode=m;E.tt=1;
  document.querySelectorAll('#modes button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===m));drawE();
});
$('#eplay').onclick=playE;
$('#showop').onchange=e=>{E.show=e.target.checked;drawE();};

/* dragging vector tips */
let edrag=null;
const eptr=e=>{const r=cex.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
function enearest(x,y){
  const u=cex._w/(2*V.range);let best=null,bd=22;
  E.vecs.forEach((v,i)=>{if(!v.vis)return;const d=Math.hypot(cex._w/2+v.x*u-x,cex._h/2-v.y*u-y);if(d<bd){bd=d;best=i;}});
  return best;
}
cex.addEventListener('pointerdown',e=>{
  const [x,y]=eptr(e),i=enearest(x,y);if(i===null)return;
  edrag=i;cex.setPointerCapture(e.pointerId);cex.style.cursor='grabbing';cancelAnimationFrame(E.raf);E.tt=1;e.preventDefault();
});
cex.addEventListener('pointermove',e=>{
  const [x,y]=eptr(e);
  if(edrag===null){cex.style.cursor=enearest(x,y)!==null?'grab':'default';return;}
  const u=cex._w/(2*V.range);
  E.vecs[edrag].x=snap((x-cex._w/2)/u);E.vecs[edrag].y=snap(-(y-cex._h/2)/u);updateE();
});
const eEnd=()=>{edrag=null;cex.style.cursor='default';};
cex.addEventListener('pointerup',eEnd);cex.addEventListener('pointercancel',eEnd);

