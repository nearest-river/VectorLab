const S={m:2,n:2,A:[[1,1,0],[-1,1,0],[0,0,1]],shown:cp(I3)};
const V={range:5};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

const PRESETS={
  '2x2':[['Identity',[[1,0],[0,1]]],['Rotate 45°',[[.7071,-.7071],[.7071,.7071]]],['Shear',[[1,1],[0,1]]],['Stretch',[[2,0],[0,.5]]],['Reflect',[[1,0],[0,-1]]],['Project',[[.5,.5],[.5,.5]]],['Collapse',[[1,2],[2,4]]],['Zero',[[0,0],[0,0]]]],
  '2x3':[['Full rank',[[1,0,2],[0,1,-1]]],['Rank 1',[[1,-1,2],[2,-2,4]]],['Zero',[[0,0,0],[0,0,0]]]],
  '3x2':[['Full rank',[[1,0],[0,1],[1,1]]],['Rank 1',[[1,-1],[2,-2],[-1,1]]],['Zero',[[0,0],[0,0],[0,0]]]],
  '3x3':[['Identity',[[1,0,0],[0,1,0],[0,0,1]]],['Full rank',[[2,1,0],[0,1,3],[1,0,1]]],['Rank 2',[[1,2,3],[4,5,6],[7,8,9]]],['Rank 1',[[1,-1,2],[2,-2,4],[-1,1,-2]]],['Zero',[[0,0,0],[0,0,0],[0,0,0]]]]
};

/* ---------- inputs ---------- */
function renderSizes(){
  const box=$('#sizes');box.innerHTML='';
  [[2,2],[2,3],[3,2],[3,3]].forEach(([m,n])=>{
    const b=document.createElement('button');b.textContent=m+'\u00d7'+n;
    b.setAttribute('aria-pressed',m===S.m&&n===S.n);
    b.onclick=()=>{S.m=m;S.n=n;renderInputs();commit();};
    box.appendChild(b);
  });
}
function renderInputs(){
  renderSizes();
  const mx=$('#mx');mx.innerHTML='';mx.style.gridTemplateColumns=`repeat(${S.n},auto)`;
  for(let i=0;i<S.m;i++)for(let j=0;j<S.n;j++){
    const inp=document.createElement('input');
    inp.type='text';inp.inputMode='decimal';inp.autocomplete='off';inp.dataset.i=i;inp.dataset.j=j;
    inp.setAttribute('aria-label',`Row ${i+1}, column ${j+1}`);inp.value=dec(S.A[i][j]);
    inp.addEventListener('input',()=>{
      const s=inp.value.trim();if(s===''||s==='-'||s==='.'||s==='\u2212'){return;}
      const v=parseVal(inp.value);
      if(isNaN(v)){inp.classList.add('bad');return;}
      inp.classList.remove('bad');S.A[i][j]=Math.max(-1e6,Math.min(1e6,v));commit({sync:false});
    });
    inp.addEventListener('blur',()=>{inp.classList.remove('bad');inp.value=dec(S.A[i][j]);});
    inp.addEventListener('keydown',e=>{
      if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();
      const st=e.shiftKey?.1:.5,v=parseVal(inp.value),b=isNaN(v)?S.A[i][j]:v;
      inp.value=dec(+(b+(e.key==='ArrowUp'?st:-st)).toFixed(6));inp.dispatchEvent(new Event('input'));
    });
    mx.appendChild(inp);
  }
  const ps=$('#presets');ps.innerHTML='';
  (PRESETS[S.m+'x'+S.n]||[]).forEach(([name,M])=>{
    const b=document.createElement('button');b.className='chip';b.textContent=name;
    b.onclick=()=>{for(let i=0;i<S.m;i++)for(let j=0;j<S.n;j++)S.A[i][j]=M[i][j];syncInputs();commit({sync:false});};
    ps.appendChild(b);
  });
}
function syncInputs(){
  document.querySelectorAll('#mx input').forEach(el=>{
    if(document.activeElement===el)return;
    el.value=dec(S.A[+el.dataset.i][+el.dataset.j]);el.classList.remove('bad');
  });
}

/* ---------- results ---------- */
function termStr(terms,nm=c=>'a'+SUB[c]){
  if(!terms.length)return '0';
  return terms.map(([v,c],k)=>{
    const a=Math.abs(v),lab=(Math.abs(a-1)<1e-9?'':fmt(a)+'\u00b7')+nm(c);
    if(k===0)return (v<0?'\u2212':'')+lab;
    return (v<0?' \u2212 ':' + ')+lab;
  }).join('');
}
function renderResults(){
  const {m,n}=S,Mx=active(S.A,m,n),{R,pivots,rank:rk}=rref(Mx),sq=m===n;
  const d=sq?(rk<m?0:det(Mx)):null;
  const rows=[];
  rows.push(`<dt>Maps</dt><dd>ℝ${SUP[n]} → ℝ${SUP[m]}</dd>`);
  if(sq){
    const w=m===2?'area':'volume',o=rk<m?`${w} collapses to 0`:d>0?`${w} × ${fmt(Math.abs(d))}, orientation kept`:`${w} × ${fmt(Math.abs(d))}, orientation flipped`;
    rows.push(`<dt>Determinant</dt><dd>${fmt(d)}<small>${o}</small></dd>`);
    rows.push(`<dt>Invertible</dt><dd class="${rk===m?'yes':'no'}">${rk===m?'yes':'no'}</dd>`);
  }
  rows.push(`<dt>Columns</dt><dd class="${rk===n?'yes':'no'}">${rk===n?'independent':'dependent'}</dd>`);
  rows.push(`<dt>Rows</dt><dd class="${rk===m?'yes':'no'}">${rk===m?'independent':'dependent'}</dd>`);
  const rels=relations(R,pivots,n);
  const pvset=new Set(pivots.map(p=>p[1]));
  let rr=`<div class="rref" style="grid-template-columns:repeat(${n},auto)">`;
  R.forEach((row,i)=>row.forEach((v,j)=>{rr+=`<span class="${pivots.some(p=>p[0]===i&&p[1]===j)?'pv':''}">${fmt(v)}</span>`;}));
  rr+='</div>';
  $('#results').innerHTML=`
    <h2>Rank analysis</h2>
    <div class="hero"><div class="rk">${rk}</div><div>
      <div class="h">Rank of A</div>
      <div class="strip" role="img" aria-label="${rk} of ${n} input dimensions survive">${Array.from({length:n},(_,j)=>`<i class="${j<rk?'on':'off'}"></i>`).join('')}</div>
      <div class="cap">${rk} of ${n} input dimension${n>1?'s':''} survive; ${n-rk} collapse to 0</div>
    </div></div>
    <dl class="facts">${rows.join('')}</dl>
    <h2>Reduced row echelon form</h2>
    <div class="rrefbox">${rr}</div>
    <div class="sub"><b>Pivots:</b> ${pivots.length?pivots.map(([r,c])=>`(${r+1}, ${c+1})`).join(', '):'none'}${pivots.length?` in column${pivots.length>1?'s':''} ${pivots.map(p=>p[1]+1).join(', ')}`:''}</div>
    ${rels.length?`<div class="sub"><b>Dependent columns</b> (from the RREF):</div>`+rels.map(r=>`<div class="rel">a${SUB[r.j]} = ${termStr(r.terms)}</div>`).join(''):`<div class="sub">Every column has a pivot, so no column is a combination of the others.</div>`}
    <div class="sub">Entries smaller than 1e-10 × the largest entry are treated as 0.</div>`;
  renderLabels(rk);
}
function renderLabels(rk){
  const {m,n}=S;
  $('#tin').textContent='Input space ℝ'+SUP[n];
  $('#tout').textContent='Output space ℝ'+SUP[m];
  const spans=rk===0?'only the origin':rk===1?'a line through the origin':rk===2?(m===2?'all of ℝ²':'a plane in ℝ³'):'all of ℝ³';
  let h=`<p class="m">Rank ${rk} → the columns of A span ${spans}.</p>`;
  if(m===2&&n===2){
    const Mx=active(S.A,2,2),dd=det(Mx);
    h+=rk===2?`<p>Ae₁ and Ae₂ are independent, so the transformed vectors span ℝ². The unit square becomes a parallelogram of area |det| = ${fmt(Math.abs(dd))}.</p>`
      :rk===1?`<p>Ae₁ and Ae₂ lie on one line, so every output does. The dashed kernel in the input space is squashed onto the origin, and the unit square flattens to a segment.</p>`
      :`<p>A sends every vector to the origin. The image is {0} and the kernel is all of ℝ².</p>`;
  }else if(n===3&&m===2){
    h+=`<p>Three columns in ℝ²: rank ≤ 2, so at least one dimension of ℝ³ is always lost (kernel dimension ${n-rk}). <button class="gotab4" type="button">See ℝ³ in 3D →</button></p>`;
  }else if(m===3){
    h+=`<p>The output lives in ℝ³. ${n===2?'The input plane is drawn on the left.':''} The rank, RREF and pivots are fully live. <button class="gotab4" type="button">See ℝ³ in 3D →</button></p>`;
  }
  if(m===2)h+=`<p style="color:var(--dim);font-size:12.5px">Drag a vector tip in the output space to edit A.</p>`;
  $('#explain').innerHTML=h;
}

/* ---------- drawing ---------- */
const cv=[$('#cin'),$('#cout')];
cv.forEach(c=>c.addEventListener('click',()=>{if(c.classList.contains('clickable3d'))showTab(4);}));
$('#explain').addEventListener('click',e=>{if(e.target.closest('.gotab4'))showTab(4);});
function fit(c){
  const r=c.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);
  const W=Math.max(1,Math.round(r.width*d)),H=Math.max(1,Math.round(r.height*d));
  if(c.width!==W||c.height!==H){c.width=W;c.height=H;}
  c._d=d;c._w=r.width;c._h=r.height;
}
const P=(c,x,y)=>{const u=c._w/(2*V.range);return [c._w/2+x*u,c._h/2-y*u];};
const n2=v=>neg(String(+v.toFixed(2)));
function base(ctx,c){
  const w=c._w,h=c._h,u=w/(2*V.range),K=Math.ceil(V.range);
  ctx.clearRect(0,0,w,h);
  ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.06)';ctx.beginPath();
  for(let k=-K;k<=K;k++){const x=w/2+k*u,y=h/2-k*u;ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.moveTo(0,y);ctx.lineTo(w,y);}
  ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.3)';ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.stroke();
  ctx.fillStyle='rgba(180,190,220,.55)';ctx.font='10px Sora, system-ui, sans-serif';
  const st=Math.max(1,Math.round(V.range/5));
  for(let k=st;k<V.range;k+=st){
    ctx.textAlign='center';ctx.fillText(k,w/2+k*u,h/2+13);ctx.fillText('\u2212'+k,w/2-k*u,h/2+13);
    ctx.textAlign='right';ctx.fillText(k,w/2-4,h/2-k*u+3);ctx.fillText('\u2212'+k,w/2-4,h/2+k*u+3);
  }
}
function tgrid(ctx,c,M,col='rgba(91,124,255,.3)',ax='rgba(120,150,255,.85)'){
  const a=M[0][0],b=M[0][1],cc=M[1][0],d=M[1][1],F=a*a+b*b+cc*cc+d*d,D=Math.abs(a*d-b*cc);
  const s1=Math.sqrt((F+Math.sqrt(Math.max(0,F*F-4*D*D)))/2)||1,s2=D/s1;
  const N=Math.min(80,Math.ceil(V.range*1.5/Math.max(s2,.03)));
  const map=(x,y)=>P(c,a*x+b*y,cc*x+d*y);
  const line=(x0,y0,x1,y1)=>{const p=map(x0,y0),q=map(x1,y1);ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);};
  ctx.lineWidth=1;ctx.strokeStyle=col;ctx.beginPath();
  for(let k=-N;k<=N;k++){if(k===0)continue;line(k,-N,k,N);line(-N,k,N,k);}
  ctx.stroke();
  ctx.lineWidth=1.6;ctx.strokeStyle=ax;ctx.beginPath();line(0,-N,0,N);line(-N,0,N,0);ctx.stroke();
}
function square(ctx,c,M){
  const pts=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>P(c,M[0][0]*x+M[0][1]*y,M[1][0]*x+M[1][1]*y));
  const flip=(M[0][0]*M[1][1]-M[0][1]*M[1][0])<0;
  ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
  ctx.fillStyle=flip?'rgba(255,95,162,.26)':'rgba(139,108,255,.28)';ctx.fill();
  ctx.lineWidth=1.5;ctx.strokeStyle=flip?'#ff5fa2':'#8b6cff';ctx.stroke();
}
function arrow(ctx,c,x,y,color,w=3,ox=0,oy=0,dash=[]){
  const [ax,ay]=P(c,ox,oy),[bx,by]=P(c,x,y),dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy);
  if(L<2)return;const ux=dx/L,uy=dy/L,h=Math.min(8+w*1.5,L*.45);
  ctx.strokeStyle=ctx.fillStyle=color;ctx.lineWidth=w;ctx.lineCap='round';ctx.setLineDash(dash);
  ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx-ux*h*.7,by-uy*h*.7);ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx-ux*h+uy*h*.5,by-uy*h-ux*h*.5);ctx.lineTo(bx-ux*h-uy*h*.5,by-uy*h+ux*h*.5);ctx.closePath();ctx.fill();
}
function label(ctx,c,x,y,text,color){
  let [px,py]=P(c,x,y);px+=9;py-=9;
  ctx.font='500 12px Sora, system-ui, sans-serif';const w=ctx.measureText(text).width;
  px=Math.max(4,Math.min(c._w-w-4,px));py=Math.max(14,Math.min(c._h-6,py));
  ctx.textAlign='left';ctx.lineWidth=4;ctx.strokeStyle='rgba(6,9,19,.9)';ctx.strokeText(text,px,py);ctx.fillStyle=color;ctx.fillText(text,px,py);
}
function badge(ctx,c,text,color){
  ctx.font='500 12px Sora, system-ui, sans-serif';const w=ctx.measureText(text).width+16;
  ctx.fillStyle='rgba(6,9,19,.85)';ctx.beginPath();ctx.roundRect?ctx.roundRect(8,c._h-30,w,22,8):ctx.rect(8,c._h-30,w,22);ctx.fill();
  ctx.fillStyle=color;ctx.textAlign='left';ctx.fillText(text,16,c._h-15);
}
function infLine(ctx,c,dx,dy,color,dash,width){
  const L=Math.hypot(dx,dy);if(L<1e-12)return;const k=V.range*3/L,p=P(c,-dx*k,-dy*k),q=P(c,dx*k,dy*k);
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.lineCap='round';
  if(!dash.length){ctx.shadowColor=color;ctx.shadowBlur=14;}
  ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke();ctx.restore();
}
function placeholder(ctx,c,title,note,cta){
  ctx.clearRect(0,0,c._w,c._h);
  ctx.strokeStyle='rgba(255,255,255,.08)';ctx.setLineDash([5,6]);ctx.strokeRect(14,14,c._w-28,c._h-28);ctx.setLineDash([]);
  ctx.textAlign='center';ctx.fillStyle='rgba(233,237,248,.85)';ctx.font='600 15px Sora, system-ui, sans-serif';ctx.fillText(title,c._w/2,c._h/2-4);
  ctx.fillStyle='rgba(139,149,181,.9)';ctx.font='12px Sora, system-ui, sans-serif';ctx.fillText(note,c._w/2,c._h/2+16);
  if(cta){ctx.fillStyle='#5cf2b0';ctx.font='600 12px Sora, system-ui, sans-serif';ctx.fillText(cta,c._w/2,c._h/2+38);}
}
const COLS=['#5cf2b0','#ff6b6b','#a78bfa'];
function draw(){
  const {m,n}=S,Sh=active(S.shown,m,n),rk=rref(Sh).rank;
  cv.forEach(fit);
  const [ci,co]=cv,xi=ci.getContext('2d'),xo=co.getContext('2d');
  [xi,xo].forEach((x,k)=>x.setTransform(cv[k]._d,0,0,cv[k]._d,0,0));
  /* input space */
  if(n===2){
    base(xi,ci);
    if(rk===0){xi.fillStyle='rgba(255,95,162,.12)';xi.fillRect(0,0,ci._w,ci._h);}
    else if(rk===1){
      let best=null,bn=0;for(const r of Sh){const l=Math.hypot(r[0],r[1]);if(l>bn){bn=l;best=r;}}
      infLine(xi,ci,-best[1],best[0],'#ff5fa2',[7,6],2);
    }
    square(xi,ci,[[1,0],[0,1]]);arrow(xi,ci,1,0,COLS[0]);arrow(xi,ci,0,1,COLS[1]);
    label(xi,ci,1,0,'e₁',COLS[0]);label(xi,ci,0,1,'e₂',COLS[1]);
    badge(xi,ci,rk===2?'Kernel: {0}':rk===1?'Kernel: a line':'Kernel: all of ℝ²','#ff9bc6');
  }else if(n===3){placeholder(xi,ci,'Input space ℝ³','Full 3D view is in the “3D & null space” tab','Tap to open →');ci.classList.add('clickable3d');}
  else{placeholder(xi,ci,'Input space ℝ'+SUP[n],'ℝ'+SUP[n]+' has no 2D or 3D drawing — RREF, rank and pivots stay exact');ci.classList.remove('clickable3d');}
  /* output space */
  if(m===2){
    base(xo,co);
    if(n===2){tgrid(xo,co,Sh);}
    if(rk===1){
      let best=null,bn=0;for(let j=0;j<n;j++){const l=Math.hypot(Sh[0][j],Sh[1][j]);if(l>bn){bn=l;best=[Sh[0][j],Sh[1][j]];}}
      infLine(xo,co,best[0],best[1],'#ffc857',[],3);
    }else if(rk===0){
      const [ox,oy]=P(co,0,0);xo.strokeStyle='#ffc857';xo.lineWidth=2;xo.beginPath();xo.arc(ox,oy,9,0,7);xo.stroke();
    }
    if(n===2)square(xo,co,Sh);
    for(let j=0;j<n;j++){
      const x=Sh[0][j],y=Sh[1][j];arrow(xo,co,x,y,COLS[j]);
      const nm=n===2?'Ae'+SUB[j]:'a'+SUB[j];label(xo,co,x,y,`${nm} (${n2(x)}, ${n2(y)})`,COLS[j]);
    }
    for(let j=0;j<n;j++){const [hx,hy]=P(co,Sh[0][j],Sh[1][j]);xo.fillStyle=COLS[j];xo.strokeStyle='#fff';xo.lineWidth=1.5;xo.beginPath();xo.arc(hx,hy,6,0,7);xo.fill();xo.stroke();}
    badge(xo,co,rk===2?'Image: all of ℝ²':rk===1?'Image: a line':'Image: {0}','#ffc857');
  }else{placeholder(xo,co,'Output space ℝ³','Full 3D view is in the “3D & null space” tab','Tap to open →');co.classList.add('clickable3d');}
}

/* ---------- animation ---------- */
let raf=0;
function cancelAnim(){cancelAnimationFrame(raf);}
function animate(from,to,dur,slider){
  cancelAnim();from=cp(from);to=cp(to);
  if(reduce||dur<=0){S.shown=cp(to);if(slider)$('#morph').value=100;draw();return;}
  const t0=performance.now();
  const step=now=>{
    const p=Math.min(1,(now-t0)/dur),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
    S.shown=from.map((r,i)=>r.map((v,j)=>v+(to[i][j]-v)*e));
    if(slider)$('#morph').value=e*100;
    if(p<1){draw();raf=requestAnimationFrame(step);}else{S.shown=cp(to);draw();}
  };
  raf=requestAnimationFrame(step);
}
function commit({animate:an=true,sync=true}={}){
  renderResults();if(sync)syncInputs();
  $('#morph').value=100;
  if(an)animate(S.shown,S.A,650);else{cancelAnim();S.shown=cp(S.A);draw();}
}
$('#morph').addEventListener('input',e=>{
  cancelAnim();const t=e.target.value/100;
  S.shown=S.A.map((r,i)=>r.map((v,j)=>I3[i][j]+t*(v-I3[i][j])));draw();
});
$('#replay').onclick=()=>animate(I3,S.A,1500,true);
function setRange(v){V.range=+v;['#range','#rangeE','#rangeR'].forEach(q=>$(q).value=V.range);$('#rv').textContent=$('#rvE').textContent=$('#rvR').textContent=V.range;redraw();}
$('#range').addEventListener('input',e=>setRange(e.target.value));
$('#rangeE').addEventListener('input',e=>setRange(e.target.value));

/* ---------- drag vector tips (output space, 2 rows) ---------- */
let drag=null;
const co=cv[1];
const ptr=e=>{const r=co.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
const snap=v=>{const r=Math.round(v*2)/2;return Math.max(-12,Math.min(12,Math.abs(v-r)<.1?r:Math.round(v*20)/20));};
function nearest(x,y){
  if(S.m!==2)return null;const u=co._w/(2*V.range);let best=null,bd=22;
  for(let j=0;j<S.n;j++){const d=Math.hypot(co._w/2+S.shown[0][j]*u-x,co._h/2-S.shown[1][j]*u-y);if(d<bd){bd=d;best=j;}}
  return best;
}
co.addEventListener('pointerdown',e=>{
  const [x,y]=ptr(e),j=nearest(x,y);
  if(j===null)return;drag=j;co.setPointerCapture(e.pointerId);co.style.cursor='grabbing';e.preventDefault();
});
co.addEventListener('pointermove',e=>{
  const [x,y]=ptr(e);
  if(drag===null){co.style.cursor=nearest(x,y)!==null?'grab':'default';return;}
  const u=co._w/(2*V.range);
  S.A[0][drag]=snap((x-co._w/2)/u);S.A[1][drag]=snap(-(y-co._h/2)/u);
  commit({animate:false});
});
const endDrag=()=>{drag=null;co.style.cursor='default';};
co.addEventListener('pointerup',endDrag);co.addEventListener('pointercancel',endDrag);

/* ---------- init ---------- */
