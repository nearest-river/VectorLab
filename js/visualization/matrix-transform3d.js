
/* ---- 3×3 matrix transformation ---- */
const M3={A:[[1,0,0],[0,1,0],[0,0,1]]};
const M3_PRESETS=[['Identity',[[1,0,0],[0,1,0],[0,0,1]]],['Scale',[[2,0,0],[0,.5,0],[0,0,1.5]]],
  ['Shear',[[1,0,.6],[0,1,.3],[0,0,1]]],['Rank 2',[[1,2,3],[2,4,6],[1,1,1]]],
  ['Rank 1',[[1,2,-1],[2,4,-2],[-1,-2,1]]],['Zero',[[0,0,0],[0,0,0],[0,0,0]]]];
function m3RenderInputs(){
  const mx=$('#m3mx');if(!mx)return;mx.innerHTML='';mx.style.gridTemplateColumns='repeat(3,auto)';
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
    const inp=document.createElement('input');inp.type='text';inp.inputMode='decimal';inp.autocomplete='off';
    inp.dataset.i=i;inp.dataset.j=j;inp.setAttribute('aria-label',`Row ${i+1}, column ${j+1}`);inp.value=dec(M3.A[i][j]);
    inp.addEventListener('input',()=>{
      const t=inp.value.trim();if(t===''||t==='-'||t==='.'||t==='\u2212')return;
      const v=parseVal(inp.value);if(isNaN(v)){inp.classList.add('bad');return;}
      inp.classList.remove('bad');M3.A[i][j]=Math.max(-8,Math.min(8,v));m3Draw();
    });
    inp.addEventListener('blur',()=>{inp.classList.remove('bad');inp.value=dec(M3.A[i][j]);});
    mx.appendChild(inp);
  }
  const ps=$('#m3presets');ps.innerHTML='';
  M3_PRESETS.forEach(([name,M])=>{
    const b=document.createElement('button');b.className='chip';b.textContent=name;
    b.onclick=()=>{M3.A=M.map(r=>r.slice());m3SyncInputs();m3Draw();};
    ps.appendChild(b);
  });
}
function m3SyncInputs(){
  document.querySelectorAll('#m3mx input').forEach(el=>{
    if(document.activeElement===el)return;el.value=dec(M3.A[+el.dataset.i][+el.dataset.j]);el.classList.remove('bad');
  });
}
function m3Facts(){
  const {rank,pivots}=rref(M3.A),d=det(M3.A);
  const spanTxt=rank===3?'all of ℝ³':rank===2?'a plane through the origin':rank===1?'a line through the origin':'{0}, the origin';
  const el=$('#m3facts');if(el)el.innerHTML=`<dt>Rank</dt><dd>${rank}</dd>
    <dt>Determinant</dt><dd>${fmt(d)}</dd>
    <dt>Independence</dt><dd class="${rank===3?'yes':'no'}">${rank===3?'independent':'dependent'}</dd>
    <dt>Span of columns</dt><dd>${spanTxt}</dd>`;
  return {rank,pivots};
}
function m3Draw(){
  const {rank,pivots}=m3Facts();
  if(!H3M||!H3M.resize())return;
  H3M.clearContent();
  const pc=pivots.map(p=>p[1]);
  // original basis e1,e2,e3 as short muted arrows (finite, so they read as vectors rather than
  // overlapping the colored axis lines already drawn by make3D)
  [[1,0,0],[0,1,0],[0,0,1]].forEach((e,i)=>addArrow3(H3M,e,0x5b6690,'e'+SUB[i]));
  const cols=[0,1,2].map(j=>[M3.A[0][j],M3.A[1][j],M3.A[2][j]]),ecol=[0x5cf2b0,0xff6b6b,0x8b6cff];
  cols.forEach((v,j)=>addArrow3(H3M,v,ecol[j],'Ae'+SUB[j]));
  const amber=0xffc857;
  if(rank===3)addParallelepiped(H3M,cols[0],cols[1],cols[2],amber);
  else if(rank===2){const [a,b]=pc;addPlaneSpan(H3M,cols[a],cols[b],amber);}
  else if(rank===1)addLineSpan(H3M,cols[pc[0]],amber);
  else addPointMarker(H3M,amber);
  const maxMag=Math.max(1,...cols.map(v=>Math.hypot(v[0],v[1],v[2])));
  H3M.setFit(maxMag);
  if(!H3M._framed){H3M.frame();H3M._framed=true;}
  H3M.render();
}
if($('#m3resetcam'))$('#m3resetcam').onclick=()=>H3M&&H3M.reset();
if($('#v3resetcam'))$('#v3resetcam').onclick=()=>H3V&&H3V.reset();
if($('#nsresetcam'))$('#nsresetcam').onclick=()=>H3N&&H3N.reset();

