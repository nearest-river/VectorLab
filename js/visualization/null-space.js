/* ============ NULL SPACE EXPLORER + 3D BOOTSTRAP ============
   Loads after three-helpers.js, vector3d.js and matrix-transform3d.js.
   Responsibilities:
     1. Create the three WebGL hosts (H3V, H3M, H3N) and hide the "Loading 3D engine…" overlays.
     2. Compute / render the null space of the matrix A from the Row reduction tab (nsCompute, nsRender, nsDraw).
     3. Do the first render of the 3D vector explorer and the 3×3 matrix view. */

let H3V=null,H3M=null,H3N=null;
const NS={basis:[],rank:0,n:0,m:0,free:[]};

/* ---- 3D host bootstrap ---- */
function init3DHosts(){
  const setMsg=(id,msg)=>{const el=$(id);if(el){el.hidden=false;el.textContent=msg;}};
  const hide=id=>{const el=$(id);if(el)el.hidden=true;};
  const pairs=[['#c3v','#c3vload',h=>{H3V=h;}],['#c3m','#c3mload',h=>{H3M=h;}],['#c3n','#c3nload',h=>{H3N=h;}]];
  if(typeof THREE==='undefined'||typeof make3D!=='function'){
    pairs.forEach(([,l])=>setMsg(l,'Could not load the 3D library. Check your connection and reload.'));
    return;
  }
  pairs.forEach(([cv,ld,set])=>{
    const canvas=$(cv);if(!canvas)return;
    try{set(make3D(canvas));hide(ld);}
    catch(e){console.error('3D init failed for '+cv,e);setMsg(ld,'3D view unavailable: WebGL is disabled or not supported in this browser.');}
  });
}

/* ---- null space maths (numeric, from R3.Mf) ---- */
function nsCompute(){
  const A=(typeof R3!=='undefined'&&R3.Mf&&R3.Mf.length)?R3.Mf:null;
  if(!A){NS.basis=[];NS.rank=0;NS.n=0;NS.m=0;NS.free=[];return;}
  const m=A.length,n=A[0].length,{R,pivots,rank}=rref(A);
  const pc=pivots.map(p=>p[1]),free=[],basis=[];
  for(let j=0;j<n;j++){
    if(pc.includes(j))continue;
    free.push(j);
    const x=new Array(n).fill(0);x[j]=1;
    pivots.forEach(([r,c])=>{const v=-R[r][j];x[c]=Object.is(v,-0)?0:v;});
    basis.push(x);
  }
  NS.basis=basis;NS.rank=rank;NS.n=n;NS.m=m;NS.free=free;
  nsRender();
}
const nsVec=v=>`<span style="display:inline-flex;flex-direction:column;align-items:center;font-family:var(--math);font-size:15px;line-height:1.25;padding:0 8px;border-left:2px solid var(--line);border-right:2px solid var(--line);border-radius:6px;vertical-align:middle">${v.map(x=>`<span>${fmt(x)}</span>`).join('')}</span>`;
function nsRender(){
  const box=$('#nsbody');if(!box)return;
  const {basis,rank,n}=NS,k=basis.length;
  const span=k===0?'{0}, only the zero vector':k===1?'a line through the origin':k===2?'a plane through the origin':`a ${k}-dimensional subspace`;
  let h=`<dl class="facts"><dt>Columns (n)</dt><dd>${n}</dd><dt>Rank</dt><dd>${rank}</dd><dt>Nullity</dt><dd>${k}</dd><dt>Null space</dt><dd>${span}</dd></dl>`;
  if(!k){
    h+='<p class="hint">The columns are linearly independent, so Ax = 0 has only the trivial solution x = 0.</p>';
  }else{
    h+='<p class="hint" style="margin-bottom:8px">Basis for null space (one vector per free column):</p><div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center">';
    basis.forEach((v,i)=>{h+=`<span style="display:inline-flex;align-items:center;gap:6px"><b style="color:var(--amber);font-family:var(--math)">n${SUB[i]}</b>${nsVec(v)}</span>`;});
    h+='</div><p class="hint" style="margin-top:10px">Every solution of Ax = 0 is a combination of these vectors.</p>';
  }
  box.innerHTML=h;
  const tooHigh=n>3;
  const w=$('#nscwrap'),t=$('#nstoohigh'),c=$('#nscamctrl'),l=$('#nslegend');
  if(w)w.hidden=tooHigh;if(c)c.hidden=tooHigh;if(l)l.hidden=tooHigh;
  if(t){t.hidden=!tooHigh;t.textContent='A matrix with 4 columns has its null space in ℝ⁴, which can\u2019t be drawn. The basis vectors above are its exact representation.';}
}

/* ---- null space 3D view ---- */
function nsDraw(){
  if(!H3N||NS.n>3||!NS.n||!H3N.resize())return;
  H3N.clearContent();
  const amber=0xffc857,pad=v=>[v[0]||0,v[1]||0,v[2]||0],B=NS.basis.map(pad),k=B.length;
  if(k===0)addPointMarker(H3N,amber);
  else if(k===1){addLineSpan(H3N,B[0],amber);addArrow3(H3N,B[0],amber,'n'+SUB[0]);}
  else if(k===2){addPlaneSpan(H3N,B[0],B[1],amber);B.forEach((v,i)=>addArrow3(H3N,v,amber,'n'+SUB[i]));}
  else{addParallelepiped(H3N,B[0],B[1],B[2],amber);B.forEach((v,i)=>addArrow3(H3N,v,amber,'n'+SUB[i]));}
  H3N.setFit(Math.max(1,...B.map(v=>Math.hypot(v[0],v[1],v[2]))));
  if(!H3N._framed){H3N.frame();H3N._framed=true;}
  H3N.render();
}

/* ---- first render ---- */
init3DHosts();
v3RenderList();v3Update();
m3RenderInputs();m3Draw();
nsCompute();
if(tab===4)draw4();
